"""CyberShield Ethiopia — Dynamic AI Mission Artwork Pipeline

Provides:
1. Provider abstraction (Unconfigured, Mock, Gemini/Imagen).
2. Deterministic scenario prompt formulation from sanitized metadata.
3. Content validation (magic bytes, MIME type, size limits).
4. Local caching with disk quotas and cache cleanup.
5. 100% offline-first fallback guarantees (zero external network calls when unconfigured or offline).
"""

import hashlib
import json
import logging
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Optional, Tuple

from . import config
from .schemas import ArtworkGenerateRequest, ArtworkGenerateResponse

log = logging.getLogger("cybershield")

# Pre-defined deterministic fallbacks matching frontend assets
SPECIFIC_FALLBACKS = {
    "m01": "/images/journey/m01_scholarship_phishing.svg",
    "m02": "/images/journey/m02_sim_upgrade.svg",
    "m03": "/images/journey/m03_banking_bot.svg",
    "m04": "/images/journey/m04_malicious_apk.svg",
    "p01": "/images/journey/p01_fake_job.svg",
    "p02": "/images/journey/p02_password_sync.svg",
    "p03": "/images/journey/p03_qr_phishing.svg",
    "p04": "/images/journey/p04_social_transfer.svg",
    "p05": "/images/journey/p05_data_leak.svg",
    "p06": "/images/journey/p06_compromised_peer.svg",
    "p07": "/images/journey/p02_password_sync.svg",
    "p08": "/images/journey/p02_password_sync.svg",
    "p09": "/images/journey/p03_qr_phishing.svg",
    "p10": "/images/journey/m02_sim_upgrade.svg",
    "p11": "/images/journey/p05_data_leak.svg",
    "p12": "/images/journey/p06_compromised_peer.svg",
}

CATEGORY_FALLBACKS = {
    "phishing_advance_fee": "/images/journey/m01_scholarship_phishing.svg",
    "credential_harvesting_telecom": "/images/journey/m02_sim_upgrade.svg",
    "fake_banking_bot": "/images/journey/m03_banking_bot.svg",
    "malicious_apk_telegram": "/images/journey/m04_malicious_apk.svg",
    "fake_job_offers": "/images/journey/p01_fake_job.svg",
    "password_safety": "/images/journey/p02_password_sync.svg",
    "suspicious_links": "/images/journey/p03_qr_phishing.svg",
    "social_engineering": "/images/journey/p04_social_transfer.svg",
    "privacy_incident_response": "/images/journey/p05_data_leak.svg",
    "account_security": "/images/journey/p02_password_sync.svg",
    "procedural_defense": "/images/journey/practice_adaptive.svg",
}

DIFFICULTY_FALLBACKS = {
    "beginner": "/images/journey/diff_beginner.svg",
    "intermediate": "/images/journey/diff_intermediate.svg",
    "advanced": "/images/journey/diff_advanced.svg",
}

DEFAULT_FALLBACK = "/images/journey/practice_adaptive.svg"

# Valid minimal 1x1 transparent PNG for mock test provider (67 bytes)
MOCK_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)

MAX_ARTWORK_FILE_BYTES = 5 * 1024 * 1024  # 5 MB
MIN_ARTWORK_FILE_BYTES = 50
MAX_CACHE_TOTAL_BYTES = 100 * 1024 * 1024  # 100 MB


def get_fallback_artwork_url(mission_id: str, category: str, difficulty: str = "intermediate") -> str:
    """Deterministically returns a bundled vector fallback URL without network access."""
    import re
    clean_id = (mission_id or "").strip().lower()
    clean_cat = (category or "").strip().lower()
    clean_diff = (difficulty or "intermediate").strip().lower()

    if clean_id in SPECIFIC_FALLBACKS:
        return SPECIFIC_FALLBACKS[clean_id]

    # Practice template match (p01-p06 or p1-p6)
    match_practice = re.search(r"p0?([1-6])", clean_id)
    if match_practice:
        tid = f"p0{match_practice.group(1)}"
        if tid in SPECIFIC_FALLBACKS:
            return SPECIFIC_FALLBACKS[tid]

    # Legacy code matching (e.g. mission_p5 -> p05, mission_p7 -> p01, practice-05 -> p05)
    match_code = re.search(r"(?:mission[_\-]?p|practice[_\-]?0?)([1-9][0-9]*)", clean_id)
    if match_code:
        n = int(match_code.group(1))
        rot = f"p0{n}" if 1 <= n <= 6 else f"p0{((n - 1) % 6) + 1}"
        if rot in SPECIFIC_FALLBACKS:
            return SPECIFIC_FALLBACKS[rot]

    # Legacy gen_m05 / gen_m06 match
    match_legacy_gen = re.search(r"(?:^|[^a-z0-9])(?:gen_m_?0?|m0)([56])(?:[^a-z0-9]|$)", clean_id)
    if match_legacy_gen:
        tid = f"p0{match_legacy_gen.group(1)}"
        if tid in SPECIFIC_FALLBACKS:
            return SPECIFIC_FALLBACKS[tid]

    # Category match before campaign regex to prevent gen_m01... from matching m01
    if clean_cat in CATEGORY_FALLBACKS:
        return CATEGORY_FALLBACKS[clean_cat]

    # Campaign mission match only for actual campaign IDs (m01-m04)
    if not clean_id.startswith("gen_"):
        match_campaign = re.search(r"\b(m0[1-4])\b", clean_id)
        if match_campaign and match_campaign.group(1) in SPECIFIC_FALLBACKS:
            return SPECIFIC_FALLBACKS[match_campaign.group(1)]

    if clean_diff in DIFFICULTY_FALLBACKS:
        return DIFFICULTY_FALLBACKS[clean_diff]
    return DEFAULT_FALLBACK


def validate_image_bytes(data: bytes) -> str:
    """Validates raw image data against magic bytes and size constraints.
    Returns the file extension ('png', 'jpeg', or 'webp').
    Raises ValueError if invalid.
    """
    if not isinstance(data, (bytes, bytearray)):
        raise ValueError("Invalid image data type")
    if len(data) < MIN_ARTWORK_FILE_BYTES:
        raise ValueError(f"Image data too small: {len(data)} bytes")
    if len(data) > MAX_ARTWORK_FILE_BYTES:
        raise ValueError(f"Image data exceeds 5MB limit: {len(data)} bytes")

    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"RIFF") and len(data) >= 12 and data[8:12] == b"WEBP":
        return "webp"

    raise ValueError("Untrusted image format: magic bytes do not match PNG, JPEG, or WebP")


def get_cache_key(spec: ArtworkGenerateRequest) -> str:
    """Computes a deterministic hash for a scenario specification."""
    parts = [
        spec.mission_id.strip().lower(),
        spec.category.strip().lower(),
        (spec.threat_type or "").strip().lower(),
        (spec.character or "").strip().lower(),
        (spec.environment or "").strip().lower(),
        (spec.difficulty or "").strip().lower(),
    ]
    raw = ":".join(parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def count_cached_images() -> int:
    """Returns the count of cached artwork files on disk."""
    cache_dir = config.AI_ARTWORK_CACHE_DIR
    if not cache_dir.is_dir():
        return 0
    try:
        return sum(1 for f in cache_dir.iterdir() if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"))
    except Exception:
        return 0


def cleanup_cache_if_needed(max_total_bytes: int = MAX_CACHE_TOTAL_BYTES) -> None:
    """Prunes oldest cached files if cache size exceeds limit."""
    cache_dir = config.AI_ARTWORK_CACHE_DIR
    if not cache_dir.is_dir():
        return
    try:
        files = [f for f in cache_dir.iterdir() if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")]
        total_size = sum(f.stat().st_size for f in files)
        if total_size <= max_total_bytes:
            return

        # Sort oldest first by mtime
        files.sort(key=lambda f: f.stat().st_mtime)
        for f in files:
            try:
                size = f.stat().st_size
                f.unlink(missing_ok=True)
                total_size -= size
                if total_size <= (max_total_bytes * 0.75):
                    break
            except Exception:
                pass
    except Exception as e:
        log.warning("event=artwork_cache_cleanup_error reason=%s", str(e))


class ArtworkProviderError(Exception):
    pass


class ArtworkNotConfiguredError(ArtworkProviderError):
    pass


class BaseArtworkProvider:
    """Base provider interface."""

    @property
    def name(self) -> str:
        return "base"

    def is_configured(self) -> bool:
        return False

    async def generate(self, spec: ArtworkGenerateRequest) -> Tuple[bytes, str]:
        raise NotImplementedError


class UnconfiguredArtworkProvider(BaseArtworkProvider):
    @property
    def name(self) -> str:
        return "none"

    def is_configured(self) -> bool:
        return False

    async def generate(self, spec: ArtworkGenerateRequest) -> Tuple[bytes, str]:
        raise ArtworkNotConfiguredError("No approved AI artwork provider is configured.")


class MockTestArtworkProvider(BaseArtworkProvider):
    """Deterministic offline mock provider for automated unit test coverage."""

    @property
    def name(self) -> str:
        return "mock_test"

    def is_configured(self) -> bool:
        return True

    async def generate(self, spec: ArtworkGenerateRequest) -> Tuple[bytes, str]:
        # Generates deterministic mock PNG with valid magic bytes
        return MOCK_PNG_BYTES, "png"


class GeminiImagenArtworkProvider(BaseArtworkProvider):
    """Adapter for Google Gemini / Imagen models.
    Requires explicit CYBERSHIELD_AI_ARTWORK_API_KEY approval.
    """

    def __init__(self, api_key: str, timeout: float = 8.0):
        self._api_key = api_key
        self._timeout = timeout

    @property
    def name(self) -> str:
        return "gemini_imagen"

    def is_configured(self) -> bool:
        return bool(self._api_key.strip())

    async def generate(self, spec: ArtworkGenerateRequest) -> Tuple[bytes, str]:
        if not self.is_configured():
            raise ArtworkNotConfiguredError("Gemini Imagen provider missing API key.")

        # Non-sensitive educational scenario description
        prompt = (
            f"Futuristic cybersecurity digital concept art: {spec.threat_type or spec.category}. "
            f"Character: {spec.character or 'Cyber defense specialist'}. "
            f"Setting: {spec.environment or 'Cybersecurity command center in Addis Ababa'}. "
            f"Style: Dark navy and deep indigo background, neon cyan and electric blue highlights, "
            f"clean readable isometric composition, no readable text or words, subtle Ethiopian cyber shield emblem."
        )

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key={self._api_key}"
        payload = {
            "instances": [{"prompt": prompt}],
            "parameters": {
                "sampleCount": 1,
                "aspectRatio": "1:1",
                "outputOptions": {"mimeType": "image/png"},
            },
        }

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "CyberShield-Ethiopia-Educational/1.0"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as resp:
                data = resp.read()
                result = json.loads(data.decode("utf-8"))
                predictions = result.get("predictions", [])
                if not predictions:
                    raise ArtworkProviderError("Provider returned empty predictions.")
                import base64
                b64_data = predictions[0].get("bytesBase64Encoded", "")
                if not b64_data:
                    raise ArtworkProviderError("Provider response missing image data.")
                raw_bytes = base64.b64decode(b64_data)
                ext = validate_image_bytes(raw_bytes)
                return raw_bytes, ext
        except urllib.error.HTTPError as he:
            log.warning("event=gemini_artwork_http_error code=%s", he.code)
            raise ArtworkProviderError(f"HTTP error {he.code}") from he
        except urllib.error.URLError as ue:
            log.warning("event=gemini_artwork_network_error reason=%s", str(ue.reason))
            raise ArtworkProviderError(f"Network error: {ue.reason}") from ue
        except Exception as e:
            log.warning("event=gemini_artwork_error reason=%s", str(e))
            raise ArtworkProviderError(str(e)) from e


def get_active_provider() -> BaseArtworkProvider:
    """Instantiates the configured provider based on current backend settings."""
    if not config.AI_ARTWORK_ENABLED:
        return UnconfiguredArtworkProvider()

    provider_name = config.AI_ARTWORK_PROVIDER.strip().lower()
    if provider_name == "mock_test":
        return MockTestArtworkProvider()
    elif provider_name in ("gemini", "imagen", "gemini_imagen"):
        if config.AI_ARTWORK_API_KEY:
            return GeminiImagenArtworkProvider(config.AI_ARTWORK_API_KEY, config.AI_ARTWORK_TIMEOUT_SECONDS)
        return UnconfiguredArtworkProvider()
    return UnconfiguredArtworkProvider()


async def resolve_artwork(spec: ArtworkGenerateRequest) -> ArtworkGenerateResponse:
    """Coordinates cached lookup, AI generation when available, and deterministic offline fallback.
    Guaranteed non-blocking and safe: failures immediately fall back to verified bundled assets.
    """
    fallback_url = get_fallback_artwork_url(spec.mission_id, spec.category, spec.difficulty or "intermediate")
    cache_key = get_cache_key(spec)
    cache_dir = config.AI_ARTWORK_CACHE_DIR
    cache_dir.mkdir(parents=True, exist_ok=True)

    # 1. Check local disk cache
    for ext in ("png", "jpeg", "webp"):
        candidate = cache_dir / f"{cache_key}.{ext}"
        if candidate.is_file():
            try:
                raw = candidate.read_bytes()
                validate_image_bytes(raw)
                return ArtworkGenerateResponse(
                    mission_id=spec.mission_id,
                    status="cached",
                    artwork_url=f"/images/journey/cache/{cache_key}.{ext}",
                    provider="disk_cache",
                    is_ai_generated=True,
                    cached=True,
                    details="Retrieved from verified local cache.",
                )
            except Exception:
                # Corrupt cache file, delete it safely
                candidate.unlink(missing_ok=True)

    # 2. Check if AI generation is enabled and provider is configured
    provider = get_active_provider()
    if not provider.is_configured():
        return ArtworkGenerateResponse(
            mission_id=spec.mission_id,
            status="unconfigured",
            artwork_url=fallback_url,
            provider=provider.name,
            is_ai_generated=False,
            cached=False,
            details="AI artwork generator is unconfigured. Using deterministic offline fallback.",
        )

    # 3. Attempt generation via provider
    try:
        raw_bytes, ext = await provider.generate(spec)
        validate_image_bytes(raw_bytes)

        # Save to local disk cache
        cleanup_cache_if_needed()
        cache_file = cache_dir / f"{cache_key}.{ext}"
        cache_file.write_bytes(raw_bytes)

        return ArtworkGenerateResponse(
            mission_id=spec.mission_id,
            status="available",
            artwork_url=f"/images/journey/cache/{cache_key}.{ext}",
            provider=provider.name,
            is_ai_generated=True,
            cached=False,
            details="Successfully generated and cached new artwork.",
        )
    except ArtworkNotConfiguredError as nce:
        log.info("event=artwork_unconfigured provider=%s", provider.name)
        return ArtworkGenerateResponse(
            mission_id=spec.mission_id,
            status="unconfigured",
            artwork_url=fallback_url,
            provider=provider.name,
            is_ai_generated=False,
            cached=False,
            details=str(nce),
        )
    except Exception as e:
        log.warning("event=artwork_generation_failed provider=%s reason=%s", provider.name, str(e))
        return ArtworkGenerateResponse(
            mission_id=spec.mission_id,
            status="failed",
            artwork_url=fallback_url,
            provider=provider.name,
            is_ai_generated=False,
            cached=False,
            details=f"Generation failed ({str(e)}). Using deterministic offline fallback.",
        )
