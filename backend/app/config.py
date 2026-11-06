import os
from pathlib import Path
from urllib.parse import parse_qs, urlsplit


def _load_env_file() -> None:
    for candidate in [
        Path(__file__).resolve().parents[2] / ".env",
        Path(__file__).resolve().parents[1] / ".env",
    ]:
        if candidate.is_file():
            try:
                for line in candidate.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        k, v = k.strip(), v.strip().strip("'\"")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass


_load_env_file()

ENVIRONMENT = os.getenv("CYBERSHIELD_ENV", "development").lower()
IS_PRODUCTION = ENVIRONMENT == "production"
ALLOW_SQLITE_FALLBACK = (
    os.getenv("CYBERSHIELD_ALLOW_SQLITE_FALLBACK", "false" if IS_PRODUCTION else "true").lower() == "true"
)
AUTO_CREATE_TABLES = (
    os.getenv("CYBERSHIELD_AUTO_CREATE_TABLES", "false" if IS_PRODUCTION else "true").lower() == "true"
)
ENABLE_DOCS = os.getenv("CYBERSHIELD_ENABLE_DOCS", "false" if IS_PRODUCTION else "true").lower() == "true"

PORT = int(os.getenv("CYBERSHIELD_PORT", os.getenv("PORT", "8000")))
BIND = os.getenv("CYBERSHIELD_BIND", "127.0.0.1")
ALLOW_NON_LOOPBACK = os.getenv("CYBERSHIELD_ALLOW_NON_LOOPBACK", "false").lower() == "true"
LOOPBACK_NAMES = {"127.0.0.1", "::1", "localhost"}
TRUSTED_PROXIES = {
    ip.strip()
    for ip in os.getenv("CYBERSHIELD_TRUSTED_PROXIES", "127.0.0.1,::1").split(",")
    if ip.strip()
}
ALLOWED_HOSTS = {
    h.strip().lower()
    for h in os.getenv("CYBERSHIELD_ALLOWED_HOSTS", "").split(",")
    if h.strip()
}
_extra_origins = {
    orig.strip().rstrip("/")
    for orig in os.getenv("CYBERSHIELD_ALLOWED_ORIGINS", "").split(",")
    if orig.strip()
}
ALLOWED_ORIGINS = {
    f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}",
    f"http://[::1]:{PORT}",
    "http://127.0.0.1:5173", "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5174", "http://localhost:5174",
    "http://127.0.0.1:5175", "http://localhost:5175",
    *_extra_origins,
}
MAX_BODY_BYTES = 4096
MAX_VOICE_BODY_BYTES = 2097152  # 2 MiB strict limit for voice payload

VOICE_DIR = Path(__file__).resolve().parents[2] / "models" / "voice"
WHISPER_CLI_PATH = Path(os.getenv(
    "CYBERSHIELD_WHISPER_CLI_PATH",
    str(VOICE_DIR / "bin" / "whisper-cli.exe")
))
WHISPER_MODEL_PATH = Path(os.getenv(
    "CYBERSHIELD_WHISPER_MODEL_PATH",
    str(VOICE_DIR / "stt" / "ggml-small-q5_1.bin")
))

# Amharic-specific: fine-tuned Whisper model via HuggingFace Transformers
# b1n1yam/whisper-small-am — Apache-2.0 license, WER ~51.4% on evaluation set
AMHARIC_MODEL_DIR = Path(os.getenv(
    "CYBERSHIELD_AMHARIC_MODEL_DIR",
    str(VOICE_DIR / "stt" / "amharic")
))
# Path to the standalone inference runner script
AMHARIC_STT_RUNNER = Path(__file__).resolve().parent / "amharic_stt_runner.py"

# Multilingual Offline Text-to-Speech (TTS) configuration
TTS_DIR = VOICE_DIR / "tts"
AMHARIC_TTS_MODEL_DIR = Path(os.getenv(
    "CYBERSHIELD_AMHARIC_TTS_MODEL_DIR",
    str(TTS_DIR / "amharic_mms")
))
OROMO_TTS_MODEL_DIR = Path(os.getenv(
    "CYBERSHIELD_OROMO_TTS_MODEL_DIR",
    str(TTS_DIR / "oromo")
))

def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


DATABASE_URL = _normalize_database_url(os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_dev"
))
TEST_DATABASE_URL = _normalize_database_url(os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_test"
))


def _validate_production_database_url(url: str) -> None:
    if urlsplit(url).scheme.startswith("postgresql"):
        sslmode = parse_qs(urlsplit(url).query).get("sslmode", [""])[0].lower()
        if sslmode in {"require", "verify-ca", "verify-full"}:
            return
        raise RuntimeError(
            "Production DATABASE_URL must require TLS with sslmode=require or stronger."
        )


if IS_PRODUCTION:
    _validate_production_database_url(DATABASE_URL)
SECRET_KEY = os.getenv(
    "CYBERSHIELD_SECRET_KEY",
    "dev_secret_key_cybershield_ethiopia_local_only_1234567890"
)
if IS_PRODUCTION:
    if not SECRET_KEY or SECRET_KEY == "dev_secret_key_cybershield_ethiopia_local_only_1234567890" or "dev" in SECRET_KEY.lower() or len(SECRET_KEY) < 32:
        raise RuntimeError(
            "CYBERSHIELD_SECRET_KEY is missing or insecure. "
            "A secure, random secret key (at least 32 characters) must be set in production mode."
        )
SESSION_LIFETIME_HOURS = int(os.getenv("CYBERSHIELD_SESSION_LIFETIME_HOURS", "24"))
if IS_PRODUCTION:
    if os.getenv("CYBERSHIELD_COOKIE_SECURE", "true").lower() == "false":
        raise RuntimeError(
            "CYBERSHIELD_COOKIE_SECURE cannot be false in production mode. "
            "Production sessions require Secure cookies over HTTPS."
        )
    COOKIE_SECURE = True
else:
    COOKIE_SECURE = os.getenv("CYBERSHIELD_COOKIE_SECURE", "false").lower() == "true"
RATE_LIMIT_ENABLED = os.getenv("CYBERSHIELD_RATE_LIMIT_ENABLED", "true").lower() == "true"

# Cyber Threat Intelligence (CTI) Settings
# 'auto': automatically selects local_feed if a valid local threat feed exists, otherwise falls back to configured provider.
# 'local_feed': strictly uses administrator-supplied local threat intelligence feed.
# 'google_safe_browsing_v5' / 'mock': explicit provider overrides.
CTI_PROVIDER = os.getenv("CYBERSHIELD_CTI_PROVIDER", "auto")
CTI_API_KEY = os.getenv("CYBERSHIELD_CTI_API_KEY", "")
CTI_TIMEOUT_SECONDS = float(os.getenv("CYBERSHIELD_CTI_TIMEOUT_SECONDS", "4.0"))
CTI_LOCAL_FEED_PATH = os.getenv(
    "CYBERSHIELD_CTI_LOCAL_FEED_PATH",
    str(Path(__file__).resolve().parent / "data" / "threat_feed.json"),
)

# Fixed CTI endpoint (SSRF protection: backend contacts only this hard-coded provider URL)
SAFE_BROWSING_V5_ENDPOINT = "https://safebrowsing.googleapis.com/v5/hashes:search"

# Dynamic AI Artwork Generator Settings
# Offline-first: default is disabled / unconfigured unless explicitly approved and configured.
AI_ARTWORK_ENABLED = os.getenv("CYBERSHIELD_AI_ARTWORK_ENABLED", "false").lower() == "true"
AI_ARTWORK_PROVIDER = os.getenv("CYBERSHIELD_AI_ARTWORK_PROVIDER", "none").lower()
AI_ARTWORK_API_KEY = os.getenv("CYBERSHIELD_AI_ARTWORK_API_KEY", "")
AI_ARTWORK_TIMEOUT_SECONDS = float(os.getenv("CYBERSHIELD_AI_ARTWORK_TIMEOUT_SECONDS", "8.0"))
AI_ARTWORK_CACHE_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "images" / "journey" / "cache"

# Machine Learning Adaptive Recommendation Settings
# Offline-first & privacy-safe: disabled by default unless explicitly enabled.
ML_RECOMMENDATIONS_ENABLED = os.getenv("CYBERSHIELD_ML_RECOMMENDATIONS_ENABLED", "false").lower() == "true"

# CyberShield AI Assistant Settings
# Offline-first & privacy-safe: online provider is unconfigured by default.
ASSISTANT_ONLINE_ENABLED = os.getenv("CYBERSHIELD_ASSISTANT_ONLINE_ENABLED", "false").lower() == "true"
ASSISTANT_PROVIDER = os.getenv("CYBERSHIELD_ASSISTANT_PROVIDER", "none").lower()
ASSISTANT_API_KEY = os.getenv("CYBERSHIELD_ASSISTANT_API_KEY", "")
ASSISTANT_MODEL = os.getenv("CYBERSHIELD_ASSISTANT_MODEL", "gemini-1.5-flash")
ASSISTANT_TIMEOUT_SECONDS = float(os.getenv("CYBERSHIELD_ASSISTANT_TIMEOUT_SECONDS", "6.0"))




def check_bind(bind: str = BIND, allow: bool = ALLOW_NON_LOOPBACK) -> None:
    """SR-01: refuse non-loopback binding unless explicitly enabled."""
    if bind not in LOOPBACK_NAMES and not allow:
        raise SystemExit("Refusing non-loopback bind (set CYBERSHIELD_ALLOW_NON_LOOPBACK=true to enable explicitly).")
