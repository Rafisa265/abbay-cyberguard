import os
from pathlib import Path


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

PORT = int(os.getenv("CYBERSHIELD_PORT", "8000"))
BIND = os.getenv("CYBERSHIELD_BIND", "127.0.0.1")
ALLOW_NON_LOOPBACK = os.getenv("CYBERSHIELD_ALLOW_NON_LOOPBACK", "false").lower() == "true"
LOOPBACK_NAMES = {"127.0.0.1", "::1", "localhost"}
ALLOWED_ORIGINS = {
    f"http://127.0.0.1:{PORT}", f"http://localhost:{PORT}",
    f"http://[::1]:{PORT}",
    "http://127.0.0.1:5173", "http://localhost:5173",  # Vite dev server
}
MAX_BODY_BYTES = 4096

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_dev"
)
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://postgres@127.0.0.1:5432/cybershield_test"
)
SECRET_KEY = os.getenv(
    "CYBERSHIELD_SECRET_KEY",
    "dev_secret_key_cybershield_ethiopia_local_only_1234567890"
)
SESSION_LIFETIME_HOURS = int(os.getenv("CYBERSHIELD_SESSION_LIFETIME_HOURS", "24"))
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

# Fixed CTI endpoints (SSRF protection: backend contacts only hard-coded provider URLs)
SAFE_BROWSING_V5_ENDPOINT = "https://safebrowsing.googleapis.com/v5/hashes:search"
WEB_RISK_ENDPOINT = "https://webrisk.googleapis.com/v1/hashes:search"

# Dynamic AI Artwork Generator Settings
# Offline-first: default is disabled / unconfigured unless explicitly approved and configured.
AI_ARTWORK_ENABLED = os.getenv("CYBERSHIELD_AI_ARTWORK_ENABLED", "false").lower() == "true"
AI_ARTWORK_PROVIDER = os.getenv("CYBERSHIELD_AI_ARTWORK_PROVIDER", "none").lower()
AI_ARTWORK_API_KEY = os.getenv("CYBERSHIELD_AI_ARTWORK_API_KEY", "")
AI_ARTWORK_TIMEOUT_SECONDS = float(os.getenv("CYBERSHIELD_AI_ARTWORK_TIMEOUT_SECONDS", "8.0"))
AI_ARTWORK_CACHE_DIR = Path(__file__).resolve().parents[2] / "frontend" / "public" / "images" / "journey" / "cache"



def check_bind(bind: str = BIND, allow: bool = ALLOW_NON_LOOPBACK) -> None:
    """SR-01: refuse non-loopback binding unless explicitly enabled."""
    if bind not in LOOPBACK_NAMES and not allow:
        raise SystemExit("Refusing non-loopback bind (set CYBERSHIELD_ALLOW_NON_LOOPBACK=true; unsupported).")
