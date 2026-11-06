"""
CyberShield Ethiopia — M1 URL Dataset Pilot: URL Parsing & Normalization

Deterministic URL canonicalization and feature extraction preserving security signals.
Zero network requests. Zero outbound DNS or HTTP connections.
"""

import ipaddress
import re
import urllib.parse
from dataclasses import dataclass
from typing import Optional, Tuple

try:
    import idna
except ImportError:
    idna = None

try:
    from .psl import get_psl
except ImportError:
    from data.m1_url_pilot.pipeline.psl import get_psl

# Dangerous / unsupported schemes to reject
UNSUPPORTED_SCHEMES = {
    "javascript", "data", "file", "ftp", "ftps", "blob", "about",
    "vbscript", "ws", "wss", "ldap", "mailto", "tel", "ssh",
}


@dataclass
class NormalizedURLResult:
    is_valid: bool
    error: Optional[str]
    raw_url: str
    normalized_url: Optional[str]
    scheme: Optional[str]
    hostname: Optional[str]
    registered_domain: Optional[str]
    subdomain: Optional[str]
    tld: Optional[str]
    has_ip_host: bool
    has_userinfo: bool
    has_punycode: bool
    scheme_defaulted: bool


def _is_ip_address(host: str) -> bool:
    """Detect IPv4 (including octal/hex) and IPv6 addresses."""
    clean_host = host.strip("[]")
    try:
        ipaddress.ip_address(clean_host)
        return True
    except ValueError:
        pass

    # Heuristic for IPv4 representations like 0x7f.0.0.1 or 0177.0.0.1
    if re.fullmatch(r"(?:0x[0-9a-fA-F]+|\d+)(?:\.(?:0x[0-9a-fA-F]+|\d+)){1,3}", clean_host):
        return True

    return False


def extract_domain_components(
    hostname: str, include_private: bool = True
) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Extract (subdomain, registered_domain, tld) using the authoritative Mozilla Public Suffix List.

    Semantics:
    - registered_domain (eTLD+1): The public suffix plus exactly one preceding organizational label.
      None if the input is an IP address or a public suffix only (e.g. 'co.uk', 'com').
    - tld (public_suffix): The matched public suffix rule (e.g. 'com', 'co.uk', 'gov.et', 'github.io').
    - subdomain: Any label(s) preceding registered_domain, or None.

    Strict boundary:
    Requires an authenticated, pinned local snapshot of Mozilla's public_suffix_list.dat.
    Fails fast if the snapshot is missing or checksum verification fails (zero silent heuristic fallback).
    """
    if not hostname or _is_ip_address(hostname):
        return None, hostname, None

    clean_host = hostname.strip().rstrip(".").lower()
    if not clean_host:
        return None, None, None

    psl = get_psl()
    return psl.decompose(clean_host, include_private=include_private)


def normalize_url(
    raw_url: str, default_scheme: str = "http", include_private: bool = True
) -> NormalizedURLResult:
    """
    Robust, deterministic URL canonicalization preserving security-relevant signals.
    
    Guarantees:
    - Never throws uncaught exceptions on malformed input.
    - Strips user-info/credentials while retaining has_userinfo=True.
    - Preserves case in path and query parameters (sensitive tokens/hashes).
    - Preserves ASCII punycode representation (xn--) for IDN detection.
    - Preserves percent-encoding tokens.
    - Drops client-side fragments (#).
    - Rejects non-HTTP(S) schemes.
    """
    if not isinstance(raw_url, str):
        return NormalizedURLResult(
            is_valid=False,
            error="INVALID_TYPE",
            raw_url=str(raw_url),
            normalized_url=None,
            scheme=None,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=False,
        )

    stripped = raw_url.strip()
    if not stripped:
        return NormalizedURLResult(
            is_valid=False,
            error="EMPTY_URL",
            raw_url=raw_url,
            normalized_url=None,
            scheme=None,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=False,
        )

    if len(stripped) > 2048:
        return NormalizedURLResult(
            is_valid=False,
            error="URL_TOO_LONG",
            raw_url=raw_url[:100] + "...[truncated]",
            normalized_url=None,
            scheme=None,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=False,
        )

    # Detect scheme defaulting
    scheme_defaulted = False
    url_to_parse = stripped
    if "://" not in stripped:
        # Check if it starts with an unsupported scheme followed by colon (e.g. javascript:...)
        prefix = stripped.split(":", 1)[0].lower()
        if prefix in UNSUPPORTED_SCHEMES:
            return NormalizedURLResult(
                is_valid=False,
                error=f"UNSUPPORTED_SCHEME_{prefix.upper()}",
                raw_url=stripped,
                normalized_url=None,
                scheme=prefix,
                hostname=None,
                registered_domain=None,
                subdomain=None,
                tld=None,
                has_ip_host=False,
                has_userinfo=False,
                has_punycode=False,
                scheme_defaulted=False,
            )
        url_to_parse = f"{default_scheme}://{stripped}"
        scheme_defaulted = True

    try:
        parts = urllib.parse.urlsplit(url_to_parse)
    except Exception as e:
        return NormalizedURLResult(
            is_valid=False,
            error=f"PARSE_ERROR: {str(e)}",
            raw_url=stripped,
            normalized_url=None,
            scheme=None,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=scheme_defaulted,
        )

    scheme = parts.scheme.lower()
    if scheme in UNSUPPORTED_SCHEMES or scheme not in {"http", "https"}:
        return NormalizedURLResult(
            is_valid=False,
            error=f"UNSUPPORTED_SCHEME_{scheme.upper()}",
            raw_url=stripped,
            normalized_url=None,
            scheme=scheme,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=scheme_defaulted,
        )

    # Hostname validation
    raw_netloc = parts.netloc
    if not raw_netloc:
        return NormalizedURLResult(
            is_valid=False,
            error="MISSING_HOSTNAME",
            raw_url=stripped,
            normalized_url=None,
            scheme=scheme,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=False,
            has_punycode=False,
            scheme_defaulted=scheme_defaulted,
        )

    # Userinfo / credentials extraction
    has_userinfo = False
    clean_netloc = raw_netloc
    if "@" in raw_netloc:
        has_userinfo = True
        clean_netloc = raw_netloc.split("@", 1)[1]

    # Port extraction
    port = None
    host = clean_netloc
    if ":" in clean_netloc:
        # Check if IPv6 literal like [::1]:8080
        if clean_netloc.startswith("["):
            bracket_close = clean_netloc.find("]")
            if bracket_close != -1 and bracket_close < len(clean_netloc) - 1:
                if clean_netloc[bracket_close + 1] == ":":
                    host = clean_netloc[: bracket_close + 1]
                    port_str = clean_netloc[bracket_close + 2 :]
                    try:
                        port = int(port_str)
                    except ValueError:
                        return NormalizedURLResult(
                            is_valid=False,
                            error="INVALID_PORT",
                            raw_url=stripped,
                            normalized_url=None,
                            scheme=scheme,
                            hostname=None,
                            registered_domain=None,
                            subdomain=None,
                            tld=None,
                            has_ip_host=False,
                            has_userinfo=has_userinfo,
                            has_punycode=False,
                            scheme_defaulted=scheme_defaulted,
                        )
            else:
                host = clean_netloc
        else:
            host_part, _, port_part = clean_netloc.partition(":")
            host = host_part
            try:
                port = int(port_part)
            except ValueError:
                return NormalizedURLResult(
                    is_valid=False,
                    error="INVALID_PORT",
                    raw_url=stripped,
                    normalized_url=None,
                    scheme=scheme,
                    hostname=None,
                    registered_domain=None,
                    subdomain=None,
                    tld=None,
                    has_ip_host=False,
                    has_userinfo=has_userinfo,
                    has_punycode=False,
                    scheme_defaulted=scheme_defaulted,
                )

    # Hostname normalization
    host = host.strip().rstrip(".").lower()
    if not host or " " in host or host.startswith(".") or ".." in host:
        return NormalizedURLResult(
            is_valid=False,
            error="INVALID_HOSTNAME",
            raw_url=stripped,
            normalized_url=None,
            scheme=scheme,
            hostname=None,
            registered_domain=None,
            subdomain=None,
            tld=None,
            has_ip_host=False,
            has_userinfo=has_userinfo,
            has_punycode=False,
            scheme_defaulted=scheme_defaulted,
        )

    # IP host check
    has_ip_host = _is_ip_address(host)

    # Punycode / IDN check
    has_punycode = "xn--" in host
    if not has_punycode and idna:
        try:
            # Check if domain has non-ASCII characters that encode to punycode
            encoded_host = idna.encode(host).decode("ascii")
            if "xn--" in encoded_host:
                has_punycode = True
                host = encoded_host
        except Exception:
            pass

    # Port normalization: strip default ports
    normalized_netloc = host
    if port is not None:
        if not (0 < port <= 65535):
            return NormalizedURLResult(
                is_valid=False,
                error="PORT_OUT_OF_RANGE",
                raw_url=stripped,
                normalized_url=None,
                scheme=scheme,
                hostname=host,
                registered_domain=None,
                subdomain=None,
                tld=None,
                has_ip_host=has_ip_host,
                has_userinfo=has_userinfo,
                has_punycode=has_punycode,
                scheme_defaulted=scheme_defaulted,
            )
        if not ((scheme == "http" and port == 80) or (scheme == "https" and port == 443)):
            normalized_netloc = f"{host}:{port}"

    # Path normalization: default to '/' if empty
    path = parts.path or "/"
    if not path.startswith("/"):
        path = "/" + path

    # Query string: preserve exact case and parameters
    query = parts.query

    # Assemble canonical URL (drop fragment)
    if query:
        normalized_url = f"{scheme}://{normalized_netloc}{path}?{query}"
    else:
        normalized_url = f"{scheme}://{normalized_netloc}{path}"

    # Domain component decomposition via authoritative PSL
    subdomain, registered_domain, tld = extract_domain_components(
        host, include_private=include_private
    )

    return NormalizedURLResult(
        is_valid=True,
        error=None,
        raw_url=stripped,
        normalized_url=normalized_url,
        scheme=scheme,
        hostname=host,
        registered_domain=registered_domain,
        subdomain=subdomain,
        tld=tld,
        has_ip_host=has_ip_host,
        has_userinfo=has_userinfo,
        has_punycode=has_punycode,
        scheme_defaulted=scheme_defaulted,
    )
