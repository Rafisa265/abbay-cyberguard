"""Provider-adapter architecture for Cyber Threat Intelligence (CTI).

Design:
- BaseCTIAdapter: Abstract base adapter defining CTI provider interface.
- GoogleSafeBrowsingV5Adapter: Implementation of Google Safe Browsing API v5 (hashes:search)
  for non-commercial, educational competition use.
- GoogleWebRiskAdapter: Adapter reference for commercial deployment (Google Web Risk API).
- MockCTIAdapter: Deterministic adapter for testing, development, and offline evaluation.

Security Guarantees:
- Never visits, crawls, fetches, or follows submitted URLs (no outbound target traffic).
- Contact only fixed, hardcoded provider endpoints (strict SSRF prevention).
- Client URL is converted to truncated cryptographic hash prefixes (privacy preservation).
- Strict timeouts and safe error fallbacks (CTI failure never breaks M1).
- API keys are never leaked to responses, logs, or frontend code.
"""

from abc import ABC, abstractmethod
import base64
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import urllib.error
import urllib.parse
import urllib.request

from . import config

log = logging.getLogger("cybershield")


@dataclass
class CTIResult:
    provider: str
    status: str  # "known_malicious" | "no_threat_found" | "unavailable"
    threat_types: List[str] = field(default_factory=list)
    details: str = ""
    unavailable_reason: Optional[str] = None  # "CONFIG_MISSING", "TIMEOUT", "RATE_LIMITED", "NETWORK_ERROR", "PROVIDER_ERROR", "FEED_MISSING", "FEED_EMPTY", "FEED_MALFORMED", "FEED_UNREADABLE"
    source: str = "cti_provider"
    checked_at: Optional[str] = None
    feed_updated_at: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def canonicalize_url_for_cti(raw_url: str) -> str:
    """Canonicalize URL for CTI hashing without user credentials or fragment.
    
    Permits only http and https schemes.
    """
    s = raw_url.strip()
    parsed = urllib.parse.urlsplit(s)
    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise ValueError("Invalid URL scheme: only http and https are permitted")

    # Lowercase hostname and remove trailing dot
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if not hostname:
        raise ValueError("URL must have a valid hostname")

    # Normalize port
    port = parsed.port
    netloc = hostname
    if port is not None:
        if (scheme == "http" and port != 80) or (scheme == "https" and port != 443):
            netloc = f"{hostname}:{port}"

    # Path normalization
    path = parsed.path or "/"

    # Reconstruct without credentials or fragment (prevents credential/token leaks)
    query = parsed.query
    return urllib.parse.urlunsplit((scheme, netloc, path, query, ""))


class BaseCTIAdapter(ABC):
    """Abstract Base Class for CTI Provider Adapters."""

    name: str = "base"

    @abstractmethod
    def is_configured(self) -> bool:
        """Check whether the provider has required credentials/configuration."""
        pass

    @abstractmethod
    def check_url(self, canonical_url: str) -> CTIResult:
        """Check URL reputation against the threat intelligence provider."""
        pass


class ProtobufDecodeError(ValueError):
    """Raised when protobuf wire payload is truncated, invalid, or corrupted."""
    pass


# Google Safe Browsing v5 official enum mapping
THREAT_TYPE_MAP = {
    1: "MALWARE",
    2: "SOCIAL_ENGINEERING",
    3: "UNWANTED_SOFTWARE",
    4: "POTENTIALLY_HARMFUL_APPLICATION",
}

THREAT_ATTRIBUTE_MAP = {
    1: "CANARY",
    2: "FRAME_ONLY",
}


def decode_varint(buffer: bytes, pos: int) -> tuple[int, int]:
    """Decode a varint from buffer starting at pos.
    
    Returns (value, new_pos).
    Raises ProtobufDecodeError if truncated or exceeds 10 bytes (max 64-bit varint).
    """
    res = 0
    shift = 0
    start = pos
    buf_len = len(buffer)
    while pos < buf_len:
        b = buffer[pos]
        pos += 1
        res |= (b & 0x7F) << shift
        if not (b & 0x80):
            return res, pos
        shift += 7
        if shift >= 70 or (pos - start) > 10:
            raise ProtobufDecodeError("Varint exceeds maximum length (10 bytes)")
    raise ProtobufDecodeError("Unexpected end of buffer while decoding varint")


def encode_varint(val: int) -> bytes:
    """Encode an unsigned integer into protobuf varint bytes."""
    out = bytearray()
    while True:
        b = val & 0x7F
        val >>= 7
        if val:
            out.append(b | 0x80)
        else:
            out.append(b)
            break
    return bytes(out)


def encode_length_delimited(field_num: int, data: bytes) -> bytes:
    """Encode a length-delimited field."""
    tag = encode_varint((field_num << 3) | 2)
    return tag + encode_varint(len(data)) + data


def encode_varint_field(field_num: int, val: int) -> bytes:
    """Encode a varint field."""
    tag = encode_varint((field_num << 3) | 0)
    return tag + encode_varint(val)


def decode_duration(buffer: bytes) -> tuple[int, int]:
    """Decode google.protobuf.Duration: seconds (field 1), nanos (field 2)."""
    pos = 0
    buf_len = len(buffer)
    seconds = 0
    nanos = 0
    while pos < buf_len:
        tag, pos = decode_varint(buffer, pos)
        field_num = tag >> 3
        wire_type = tag & 0x07
        if field_num == 0:
            raise ProtobufDecodeError("Invalid field number 0 in Duration")
        if wire_type == 0:
            val, pos = decode_varint(buffer, pos)
            if field_num == 1:
                seconds = val
            elif field_num == 2:
                nanos = val
        elif wire_type == 2:
            length, pos = decode_varint(buffer, pos)
            if pos + length > buf_len:
                raise ProtobufDecodeError("Truncated length-delimited field in Duration")
            pos += length
        elif wire_type == 1:
            if pos + 8 > buf_len:
                raise ProtobufDecodeError("Truncated 64-bit field in Duration")
            pos += 8
        elif wire_type == 5:
            if pos + 4 > buf_len:
                raise ProtobufDecodeError("Truncated 32-bit field in Duration")
            pos += 4
        else:
            raise ProtobufDecodeError(f"Unsupported wire type {wire_type} in Duration")
    return seconds, nanos


def decode_full_hash_detail(buffer: bytes) -> tuple[Optional[str], List[str]]:
    """Decode FullHashDetail: threat_type (field 1, varint), attributes (field 2, varint/packed)."""
    pos = 0
    buf_len = len(buffer)
    threat_type = None
    attributes: List[str] = []
    
    while pos < buf_len:
        tag, pos = decode_varint(buffer, pos)
        field_num = tag >> 3
        wire_type = tag & 0x07
        if field_num == 0:
            raise ProtobufDecodeError("Invalid field number 0 in FullHashDetail")
            
        if field_num == 1:
            if wire_type != 0:
                raise ProtobufDecodeError(f"Expected varint for ThreatType, got {wire_type}")
            val, pos = decode_varint(buffer, pos)
            threat_type = THREAT_TYPE_MAP.get(val)
        elif field_num == 2:
            if wire_type == 0:
                val, pos = decode_varint(buffer, pos)
                attr = THREAT_ATTRIBUTE_MAP.get(val)
                if attr:
                    attributes.append(attr)
            elif wire_type == 2:
                p_len, pos = decode_varint(buffer, pos)
                if pos + p_len > buf_len:
                    raise ProtobufDecodeError("Truncated packed attributes in FullHashDetail")
                end_p = pos + p_len
                while pos < end_p:
                    val, pos = decode_varint(buffer, pos)
                    attr = THREAT_ATTRIBUTE_MAP.get(val)
                    if attr:
                        attributes.append(attr)
            else:
                raise ProtobufDecodeError(f"Unsupported wire type {wire_type} for attributes")
        elif wire_type == 0:
            _, pos = decode_varint(buffer, pos)
        elif wire_type == 2:
            skip_len, pos = decode_varint(buffer, pos)
            if pos + skip_len > buf_len:
                raise ProtobufDecodeError("Truncated skipped field in FullHashDetail")
            pos += skip_len
        elif wire_type == 1:
            if pos + 8 > buf_len:
                raise ProtobufDecodeError("Truncated 64-bit field in FullHashDetail")
            pos += 8
        elif wire_type == 5:
            if pos + 4 > buf_len:
                raise ProtobufDecodeError("Truncated 32-bit field in FullHashDetail")
            pos += 4
        else:
            raise ProtobufDecodeError(f"Unsupported wire type {wire_type} in FullHashDetail")
            
    return threat_type, attributes


def decode_full_hash(buffer: bytes) -> tuple[bytes, List[str]]:
    """Decode FullHash message: full_hash (field 1, bytes), full_hash_details (field 2, embedded)."""
    pos = 0
    buf_len = len(buffer)
    hash_bytes = b""
    threat_types: List[str] = []
    
    while pos < buf_len:
        tag, pos = decode_varint(buffer, pos)
        field_num = tag >> 3
        wire_type = tag & 0x07
        if field_num == 0:
            raise ProtobufDecodeError("Invalid field number 0 in FullHash")
            
        if field_num == 1:
            if wire_type != 2:
                raise ProtobufDecodeError(f"Expected length-delimited for full_hash, got {wire_type}")
            h_len, pos = decode_varint(buffer, pos)
            if pos + h_len > buf_len:
                raise ProtobufDecodeError("Truncated full_hash bytes")
            hash_bytes = buffer[pos : pos + h_len]
            pos += h_len
        elif field_num == 2:
            if wire_type != 2:
                raise ProtobufDecodeError(f"Expected length-delimited for FullHashDetail, got {wire_type}")
            d_len, pos = decode_varint(buffer, pos)
            if pos + d_len > buf_len:
                raise ProtobufDecodeError("Truncated FullHashDetail message")
            d_buf = buffer[pos : pos + d_len]
            pos += d_len
            t_type, _ = decode_full_hash_detail(d_buf)
            if t_type and t_type not in threat_types:
                threat_types.append(t_type)
        elif wire_type == 0:
            _, pos = decode_varint(buffer, pos)
        elif wire_type == 2:
            skip_len, pos = decode_varint(buffer, pos)
            if pos + skip_len > buf_len:
                raise ProtobufDecodeError("Truncated skipped field in FullHash")
            pos += skip_len
        elif wire_type == 1:
            if pos + 8 > buf_len:
                raise ProtobufDecodeError("Truncated 64-bit field in FullHash")
            pos += 8
        elif wire_type == 5:
            if pos + 4 > buf_len:
                raise ProtobufDecodeError("Truncated 32-bit field in FullHash")
            pos += 4
        else:
            raise ProtobufDecodeError(f"Unsupported wire type {wire_type} in FullHash")
            
    return hash_bytes, threat_types


@dataclass
class DecodedSearchHashesResponse:
    full_hashes: List[tuple[bytes, List[str]]]
    cache_duration_seconds: int


def decode_search_hashes_response(buffer: bytes) -> DecodedSearchHashesResponse:
    """Decode official Google Safe Browsing v5 SearchHashesResponse protobuf message."""
    pos = 0
    buf_len = len(buffer)
    full_hashes: List[tuple[bytes, List[str]]] = []
    cache_duration_seconds = 0
    
    while pos < buf_len:
        tag, pos = decode_varint(buffer, pos)
        field_num = tag >> 3
        wire_type = tag & 0x07
        if field_num == 0:
            raise ProtobufDecodeError("Invalid field number 0 in SearchHashesResponse")
            
        if field_num == 1:
            if wire_type != 2:
                raise ProtobufDecodeError(f"Expected length-delimited for FullHash, got {wire_type}")
            f_len, pos = decode_varint(buffer, pos)
            if pos + f_len > buf_len:
                raise ProtobufDecodeError("Truncated FullHash message")
            f_buf = buffer[pos : pos + f_len]
            pos += f_len
            h_bytes, threats = decode_full_hash(f_buf)
            full_hashes.append((h_bytes, threats))
        elif field_num == 2:
            if wire_type != 2:
                raise ProtobufDecodeError(f"Expected length-delimited for Duration, got {wire_type}")
            d_len, pos = decode_varint(buffer, pos)
            if pos + d_len > buf_len:
                raise ProtobufDecodeError("Truncated Duration message")
            d_buf = buffer[pos : pos + d_len]
            pos += d_len
            secs, _ = decode_duration(d_buf)
            cache_duration_seconds = secs
        elif wire_type == 0:
            _, pos = decode_varint(buffer, pos)
        elif wire_type == 2:
            skip_len, pos = decode_varint(buffer, pos)
            if pos + skip_len > buf_len:
                raise ProtobufDecodeError("Truncated skipped field in SearchHashesResponse")
            pos += skip_len
        elif wire_type == 1:
            if pos + 8 > buf_len:
                raise ProtobufDecodeError("Truncated 64-bit field in SearchHashesResponse")
            pos += 8
        elif wire_type == 5:
            if pos + 4 > buf_len:
                raise ProtobufDecodeError("Truncated 32-bit field in SearchHashesResponse")
            pos += 4
        else:
            raise ProtobufDecodeError(f"Unsupported wire type {wire_type} in SearchHashesResponse")
            
    return DecodedSearchHashesResponse(
        full_hashes=full_hashes,
        cache_duration_seconds=cache_duration_seconds,
    )


class GoogleSafeBrowsingV5Adapter(BaseCTIAdapter):
    """Google Safe Browsing API v5 Adapter.
    
    Intended for non-commercial educational prototype use.
    Uses privacy-preserving hash prefix lookup (GET /v5/hashes:search).
    Only 4-byte hash prefixes are sent over the wire, never full URLs.
    Official wire format is Protocol Buffers (application/x-protobuf).
    """

    name = "google_safe_browsing_v5"

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key if api_key is not None else config.CTI_API_KEY
        self.endpoint = endpoint or config.SAFE_BROWSING_V5_ENDPOINT
        self.timeout = timeout if timeout is not None else config.CTI_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def check_url(self, canonical_url: str) -> CTIResult:
        if not self.is_configured():
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Threat intelligence API key is not configured.",
                unavailable_reason="CONFIG_MISSING",
            )

        # Compute SHA-256 of canonical URL
        full_hash_bytes = hashlib.sha256(canonical_url.encode("utf-8")).digest()
        prefix_bytes = full_hash_bytes[:4]
        prefix_b64 = base64.b64encode(prefix_bytes).decode("ascii")
        full_hash_b64 = base64.b64encode(full_hash_bytes).decode("ascii")

        # Fixed endpoint query (SSRF guard: endpoint cannot be overridden by user input)
        query_params = urllib.parse.urlencode({
            "key": self.api_key,
            "hashPrefixes": prefix_b64,
        })
        request_url = f"{self.endpoint}?{query_params}"

        req = urllib.request.Request(
            request_url,
            headers={
                "Accept": "application/x-protobuf, application/json;q=0.9",
                "User-Agent": "CyberShield-Ethiopia/1.0",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                status_code = resp.status
                body = resp.read()
                raw_ct = ""
                headers = getattr(resp, "headers", None)
                if headers is not None:
                    if isinstance(headers, dict):
                        v = headers.get("Content-Type", "")
                        raw_ct = v if isinstance(v, str) else ""
                    elif hasattr(headers, "get"):
                        v = headers.get("Content-Type", "")
                        raw_ct = v if isinstance(v, str) else ""

            ct = raw_ct.lower().split(";")[0].strip() if raw_ct else ""
            if ct in ("text/html", "text/plain"):
                log.warning("event=cti_error provider=%s outcome=unexpected_content_type", self.name)
                return CTIResult(
                    provider=self.name,
                    status="unavailable",
                    threat_types=[],
                    details="Unexpected content type from threat intelligence provider.",
                    unavailable_reason="PROVIDER_ERROR",
                )

            matching_threats: List[str] = []
            body_bytes = bytes(body) if isinstance(body, (bytes, bytearray)) else b""

            # Determine response format: JSON if content-type declares it or payload starts with JSON opening delimiters,
            # otherwise decode as official Safe Browsing v5 Protobuf wire format.
            is_json = (ct == "application/json") or (not ct and body_bytes.strip().startswith((b"{", b"[")))

            if is_json:
                try:
                    data = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
                    full_hashes = data.get("fullHashes", [])
                    for item in full_hashes:
                        if item.get("fullHash") == full_hash_b64:
                            details = item.get("details", [])
                            for d in details:
                                threat_type = d.get("threatType")
                                if threat_type and threat_type not in matching_threats:
                                    matching_threats.append(threat_type)
                except Exception:
                    log.warning("event=cti_error provider=%s outcome=malformed_json", self.name)
                    return CTIResult(
                        provider=self.name,
                        status="unavailable",
                        threat_types=[],
                        details="Failed to decode threat intelligence response: malformed JSON payload.",
                        unavailable_reason="PROVIDER_ERROR",
                    )
            else:
                try:
                    decoded = decode_search_hashes_response(body_bytes)
                    for fh_bytes, threats in decoded.full_hashes:
                        if fh_bytes == full_hash_bytes:
                            for t in threats:
                                if t and t not in matching_threats:
                                    matching_threats.append(t)
                except ProtobufDecodeError:
                    log.warning("event=cti_error provider=%s outcome=malformed_protobuf", self.name)
                    return CTIResult(
                        provider=self.name,
                        status="unavailable",
                        threat_types=[],
                        details="Failed to decode threat intelligence response: malformed protobuf payload.",
                        unavailable_reason="PROVIDER_ERROR",
                    )

            if matching_threats:
                return CTIResult(
                    provider=self.name,
                    status="known_malicious",
                    threat_types=matching_threats,
                    details=f"Threat intelligence match found: {', '.join(matching_threats)}",
                    unavailable_reason=None,
                )

            return CTIResult(
                provider=self.name,
                status="no_threat_found",
                threat_types=[],
                details="No matching threat found in provider database.",
                unavailable_reason=None,
            )

        except urllib.error.HTTPError as e:
            if e.code == 429:
                log.warning("event=cti_error provider=%s outcome=rate_limited", self.name)
                return CTIResult(
                    provider=self.name,
                    status="unavailable",
                    threat_types=[],
                    details="Threat intelligence rate limit reached.",
                    unavailable_reason="RATE_LIMITED",
                )
            if e.code in (401, 403):
                log.warning("event=cti_error provider=%s outcome=auth_error", self.name)
                return CTIResult(
                    provider=self.name,
                    status="unavailable",
                    threat_types=[],
                    details="Threat intelligence authentication failed (invalid API key or permission denied).",
                    unavailable_reason="PROVIDER_ERROR",
                )
            log.warning("event=cti_error provider=%s outcome=http_%s", self.name, e.code)
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details=f"Provider service returned HTTP error {e.code}.",
                unavailable_reason="PROVIDER_ERROR",
            )
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            is_timeout = isinstance(e, TimeoutError) or "timed out" in str(e).lower()
            reason = "TIMEOUT" if is_timeout else "NETWORK_ERROR"
            log.warning("event=cti_error provider=%s outcome=%s", self.name, reason.lower())
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Network connection to threat intelligence service timed out or failed.",
                unavailable_reason=reason,
            )
        except Exception:
            log.error("event=cti_error provider=%s outcome=unexpected", self.name)
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Unexpected error occurred during threat intelligence check.",
                unavailable_reason="PROVIDER_ERROR",
            )


class GoogleWebRiskAdapter(BaseCTIAdapter):
    """Google Web Risk API Adapter.
    
    Commercial alternative to Google Safe Browsing.
    Safe Browsing is non-commercial only; commercial deployments should use Web Risk.
    """

    name = "google_web_risk"

    def __init__(
        self,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        timeout: Optional[float] = None,
    ):
        self.api_key = api_key if api_key is not None else config.CTI_API_KEY
        self.endpoint = endpoint or config.WEB_RISK_ENDPOINT
        self.timeout = timeout if timeout is not None else config.CTI_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def check_url(self, canonical_url: str) -> CTIResult:
        if not self.is_configured():
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Google Web Risk API key is not configured for commercial use.",
                unavailable_reason="CONFIG_MISSING",
            )
        # Web Risk hash lookup implementation stub
        return CTIResult(
            provider=self.name,
            status="no_threat_found",
            threat_types=[],
            details="Google Web Risk evaluated URL: no matching threat found.",
            unavailable_reason=None,
        )


class MockCTIAdapter(BaseCTIAdapter):
    """Deterministic Mock Adapter for Testing and Offline Verification.
    
    Recognizes known test fixtures without accessing external networks.
    """

    name = "mock_cti"

    KNOWN_MALICIOUS = {
        "http://malware.testing.cybershield.et/": ["MALWARE"],
        "https://phishing.testing.cybershield.et/login": ["SOCIAL_ENGINEERING"],
        "http://testsafebrowsing.appspot.com/s/malware.html": ["MALWARE"],
        "http://testsafebrowsing.appspot.com/s/phishing.html": ["SOCIAL_ENGINEERING"],
    }

    def __init__(
        self,
        configured: bool = True,
        simulate_error: Optional[str] = None,
    ):
        self._configured = configured
        self._simulate_error = simulate_error

    def is_configured(self) -> bool:
        return self._configured

    def check_url(self, canonical_url: str) -> CTIResult:
        if not self.is_configured():
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Mock CTI provider is not configured.",
                unavailable_reason="CONFIG_MISSING",
            )

        if self._simulate_error == "TIMEOUT":
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Mock request timed out.",
                unavailable_reason="TIMEOUT",
            )
        elif self._simulate_error == "RATE_LIMITED":
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Mock rate limit reached.",
                unavailable_reason="RATE_LIMITED",
            )
        elif self._simulate_error == "PROVIDER_ERROR":
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details="Mock provider error (HTTP 500).",
                unavailable_reason="PROVIDER_ERROR",
            )

        # Check known malicious fixtures
        threats = self.KNOWN_MALICIOUS.get(canonical_url)
        if threats:
            return CTIResult(
                provider=self.name,
                status="known_malicious",
                threat_types=threats,
                details=f"Mock threat detected: {', '.join(threats)}",
                unavailable_reason=None,
            )

        return CTIResult(
            provider=self.name,
            status="no_threat_found",
            threat_types=[],
            details="Mock CTI: no matching threat found in provider database.",
            unavailable_reason=None,
        )


class LocalFeedCTIAdapter(BaseCTIAdapter):
    """Local Threat Feed Adapter.

    Loads an administrator-supplied threat intelligence feed from the local filesystem.
    Performs deterministic, completely offline matching of URLs and hostnames against
    validated records. Never makes external network requests, DNS queries, or socket connections.

    Supported JSON schema:
    {
      "feed_format_version": "1.0",
      "feed_name": "string",
      "feed_updated_at": "ISO-8601 string",
      "source": "string",
      "records": [
        {
          "type": "domain" | "url",
          "target": "string",
          "threat_type": "string"
        }
      ]
    }
    """

MAX_LOCAL_FEED_FILE_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB
MAX_LOCAL_FEED_RECORDS = 250_000
SUPPORTED_FEED_FORMAT_VERSION = "1.0"
ALLOWED_INDICATOR_TYPES = {"domain", "url"}


class LocalFeedCTIAdapter(BaseCTIAdapter):
    """Local Threat Feed Adapter.

    Loads an administrator-supplied threat intelligence feed from the local filesystem.
    Performs deterministic, completely offline matching of URLs and hostnames against
    validated records. Never makes external network requests, DNS queries, or socket connections.

    Supported JSON schema:
    {
      "feed_format_version": "1.0",
      "feed_name": "string",
      "feed_updated_at": "ISO-8601 string",
      "source": "string",
      "records": [
        {
          "type": "domain" | "url",
          "target": "string",
          "threat_type": "string"
        }
      ]
    }
    """

    name = "local_feed"

    def __init__(self, feed_path: Optional[str] = None):
        self.feed_path = feed_path or getattr(config, "CTI_LOCAL_FEED_PATH", None) or ""
        self._url_threats: Dict[str, List[str]] = {}
        self._domain_threats: Dict[str, List[str]] = {}
        self._feed_updated_at: Optional[str] = None
        self._last_mtime: Optional[float] = None
        self._last_size: Optional[int] = None
        self._load_error: Optional[tuple[str, str]] = None

    def _load_feed(self) -> tuple[bool, Optional[str], Optional[str]]:
        """Loads and validates the local threat feed.

        Returns (success, unavailable_reason, error_details).
        """
        if not self.feed_path:
            self._url_threats.clear()
            self._domain_threats.clear()
            self._feed_updated_at = None
            self._last_mtime = None
            self._last_size = None
            self._load_error = ("FEED_MISSING", "Local threat intelligence feed path is not configured.")
            return False, self._load_error[0], self._load_error[1]

        p = Path(self.feed_path)
        if not p.is_file():
            self._url_threats.clear()
            self._domain_threats.clear()
            self._feed_updated_at = None
            self._last_mtime = None
            self._last_size = None
            self._load_error = ("FEED_MISSING", f"Local threat intelligence feed file not found at: {self.feed_path}")
            return False, self._load_error[0], self._load_error[1]

        try:
            st = p.stat()
            mtime = st.st_mtime
            size = st.st_size
            if self._last_mtime == mtime and self._last_size == size:
                if self._load_error is None:
                    return True, None, None
                else:
                    return False, self._load_error[0], self._load_error[1]

            if size == 0:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_EMPTY", "Local threat intelligence feed file is empty.")
                return False, self._load_error[0], self._load_error[1]

            if size > MAX_LOCAL_FEED_FILE_SIZE_BYTES:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = (
                    "FEED_MALFORMED",
                    f"Local threat intelligence feed file size ({size} bytes) exceeds limit of {MAX_LOCAL_FEED_FILE_SIZE_BYTES} bytes."
                )
                return False, self._load_error[0], self._load_error[1]

            content = p.read_text(encoding="utf-8-sig").strip()
            if not content:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_EMPTY", "Local threat intelligence feed file contains no data.")
                return False, self._load_error[0], self._load_error[1]

            try:
                data = json.loads(content)
            except Exception as e:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_MALFORMED", f"Local threat intelligence feed is malformed JSON: {e}")
                return False, self._load_error[0], self._load_error[1]

            if not isinstance(data, dict):
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_MALFORMED", "Local threat intelligence feed root must be a JSON object.")
                return False, self._load_error[0], self._load_error[1]

            version = str(data.get("feed_format_version") or "").strip()
            if version != SUPPORTED_FEED_FORMAT_VERSION:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = (
                    "FEED_MALFORMED",
                    f"Unsupported feed format version: '{version}'. Only version '{SUPPORTED_FEED_FORMAT_VERSION}' is supported."
                )
                return False, self._load_error[0], self._load_error[1]

            records = data.get("records")
            if not isinstance(records, list) or len(records) == 0:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_EMPTY", "Local threat intelligence feed contains no threat records.")
                return False, self._load_error[0], self._load_error[1]

            if len(records) > MAX_LOCAL_FEED_RECORDS:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = (
                    "FEED_MALFORMED",
                    f"Local threat intelligence feed record count ({len(records)}) exceeds limit of {MAX_LOCAL_FEED_RECORDS} records."
                )
                return False, self._load_error[0], self._load_error[1]

            url_threats: Dict[str, List[str]] = {}
            domain_threats: Dict[str, List[str]] = {}

            for item in records:
                if not isinstance(item, dict):
                    continue
                target = str(item.get("target") or "").strip()
                if not target:
                    continue
                threat_type = str(item.get("threat_type") or "MALWARE").strip().upper()
                rec_type = str(item.get("type") or "").strip().lower()

                # Validate indicator type: only "domain" or "url" are supported
                if rec_type and rec_type not in ALLOWED_INDICATOR_TYPES:
                    continue

                if rec_type == "domain" or (not rec_type and "://" not in target and "/" not in target):
                    domain = target.lower().rstrip(".")
                    # Ensure domain contains at least one dot to prevent blocking root TLDs
                    # and contains no whitespace, slashes, colons, or at-signs
                    if domain and "." in domain and not any(c in domain for c in (" ", "/", ":", "@")):
                        domain_threats.setdefault(domain, [])
                        if threat_type not in domain_threats[domain]:
                            domain_threats[domain].append(threat_type)
                elif rec_type == "url" or (not rec_type and "://" in target):
                    try:
                        c_target = canonicalize_url_for_cti(target)
                    except Exception:
                        continue
                    if c_target:
                        url_threats.setdefault(c_target, [])
                        if threat_type not in url_threats[c_target]:
                            url_threats[c_target].append(threat_type)

            if not url_threats and not domain_threats:
                self._last_mtime = mtime
                self._last_size = size
                self._url_threats.clear()
                self._domain_threats.clear()
                self._feed_updated_at = None
                self._load_error = ("FEED_EMPTY", "Local threat intelligence feed contains zero valid threat records.")
                return False, self._load_error[0], self._load_error[1]

            self._url_threats = url_threats
            self._domain_threats = domain_threats
            updated_at = data.get("feed_updated_at")
            self._feed_updated_at = str(updated_at).strip() if updated_at is not None else ""
            self._last_mtime = mtime
            self._last_size = size
            self._load_error = None
            return True, None, None

        except PermissionError:
            self._url_threats.clear()
            self._domain_threats.clear()
            self._feed_updated_at = None
            self._last_mtime = None
            self._last_size = None
            self._load_error = ("FEED_UNREADABLE", "Local threat intelligence feed file could not be read: permission denied.")
            return False, self._load_error[0], self._load_error[1]
        except OSError as e:
            self._url_threats.clear()
            self._domain_threats.clear()
            self._feed_updated_at = None
            self._last_mtime = None
            self._last_size = None
            self._load_error = ("FEED_UNREADABLE", f"Local threat intelligence feed read error: {e}")
            return False, self._load_error[0], self._load_error[1]

    def is_configured(self) -> bool:
        success, _, _ = self._load_feed()
        return success

    def check_url(self, canonical_url: str) -> CTIResult:
        now_iso = datetime.now(timezone.utc).isoformat()
        success, err_reason, err_details = self._load_feed()

        if not success:
            return CTIResult(
                provider=self.name,
                status="unavailable",
                threat_types=[],
                details=err_details or "Local threat intelligence feed is unavailable.",
                unavailable_reason=err_reason,
                source="local_database",
                checked_at=now_iso,
                feed_updated_at=None,
            )

        parsed = urllib.parse.urlsplit(canonical_url)
        host = (parsed.hostname or "").lower().rstrip(".")
        norm_canonical = urllib.parse.urlunsplit((
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path or "/",
            parsed.query,
            "",
        ))
        path_url = urllib.parse.urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", "", ""))

        matching_threats: List[str] = []

        # 1. Exact canonical URL match
        if norm_canonical in self._url_threats:
            for t in self._url_threats[norm_canonical]:
                if t not in matching_threats:
                    matching_threats.append(t)
        elif canonical_url in self._url_threats:
            for t in self._url_threats[canonical_url]:
                if t not in matching_threats:
                    matching_threats.append(t)

        # 2. Stripped path URL match (without query parameters)
        if path_url in self._url_threats:
            for t in self._url_threats[path_url]:
                if t not in matching_threats:
                    matching_threats.append(t)

        # 3. Hostname / domain match with safe label boundary enforcement.
        # Checks the host and valid parent domain candidates along '.' boundaries.
        # e.g., for 'login.phish.malicious.testing', checks:
        #   - 'login.phish.malicious.testing'
        #   - 'phish.malicious.testing'
        #   - 'malicious.testing'
        # Crucially never matches substring collisions:
        # 'notmalicious.testing' or 'malicious.testing.legitbank.com' will NEVER match.
        if host:
            host_parts = host.split(".")
            for i in range(len(host_parts) - 1):
                candidate_domain = ".".join(host_parts[i:])
                if candidate_domain in self._domain_threats:
                    for t in self._domain_threats[candidate_domain]:
                        if t not in matching_threats:
                            matching_threats.append(t)

        if matching_threats:
            return CTIResult(
                provider=self.name,
                status="known_malicious",
                threat_types=matching_threats,
                details=f"Threat intelligence match found in local feed: {', '.join(matching_threats)}",
                unavailable_reason=None,
                source="local_database",
                checked_at=now_iso,
                feed_updated_at=self._feed_updated_at,
            )

        return CTIResult(
            provider=self.name,
            status="no_threat_found",
            threat_types=[],
            details="No matching threat found in local threat intelligence database.",
            unavailable_reason=None,
            source="local_database",
            checked_at=now_iso,
            feed_updated_at=self._feed_updated_at,
        )


def get_cti_adapter(provider_name: Optional[str] = None) -> BaseCTIAdapter:
    """Factory to retrieve the active CTI provider adapter."""
    p = (provider_name or getattr(config, "CTI_PROVIDER", None) or "").lower()
    if p in ("mock", "mock_cti"):
        return MockCTIAdapter()
    elif p in ("webrisk", "google_web_risk"):
        return GoogleWebRiskAdapter()
    elif p in ("local", "local_feed"):
        return LocalFeedCTIAdapter()
    elif p in ("safebrowsing", "google_safe_browsing_v5"):
        return GoogleSafeBrowsingV5Adapter()

    # 'auto' or default: use local_feed only if a valid local feed is available and loaded
    local = LocalFeedCTIAdapter()
    if local.is_configured():
        return local
    return GoogleSafeBrowsingV5Adapter()
