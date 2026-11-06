import logging
import os
import posixpath
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import config
from .demo_data import SCENARIOS
from . import routes_auth
from . import routes_m1
from . import routes_m4
from . import routes_artwork
from . import routes_notifications
from . import routes_daily
from . import routes_ml
from . import routes_assistant
from . import routes_voice
from . import routes_device_security
from . import tts_service

log = logging.getLogger("cybershield")  # logs event type + outcome only (SR-07)

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
                               "font-src 'self'; connect-src 'self'; media-src 'self' blob: data:; "
                               "frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=(), payment=()",
}
ERRORS = {
    "INVALID_SCENARIO": 400, "INVALID_REQUEST": 400, "HOST_NOT_ALLOWED": 421, "ORIGIN_NOT_ALLOWED": 403,
    "UNSUPPORTED_MEDIA_TYPE": 415, "PAYLOAD_TOO_LARGE": 413, "NOT_FOUND": 404, "INTERNAL_ERROR": 500,
    "UNAUTHORIZED": 401, "FORBIDDEN": 403, "EMAIL_ALREADY_EXISTS": 409, "INVALID_CREDENTIALS": 401,
    "TOO_MANY_REQUESTS": 429, "SYNC_NOT_ENABLED": 403, "NEW_PASSWORD_SAME_AS_OLD": 400,
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is ready on server startup
    if config.AUTO_CREATE_TABLES:
        try:
            from . import database, models
            models.Base.metadata.create_all(bind=database.engine)
            log.info("event=db_init outcome=tables_verified provider=%s", database.engine.dialect.name)
        except Exception as exc:
            log.error("event=db_init outcome=failed error=%s", str(exc))
    else:
        # In production mode, verify required tables exist without executing arbitrary DDL
        try:
            from . import database
            from sqlalchemy import text
            with database.engine.connect() as conn:
                conn.execute(text("SELECT 1 FROM users LIMIT 1"))
            log.info("event=db_init outcome=schema_verified provider=%s", database.engine.dialect.name)
        except Exception as exc:
            log.critical("event=db_init outcome=schema_verification_failed error=%s", str(exc))
            raise RuntimeError(
                "Production database schema verification failed: required tables missing or unmigrated. "
                "Run 'alembic upgrade head' before starting the application."
            ) from exc

    # Non-blocking pre-warm of TTS models on server startup (skipped during test runs)
    if not os.getenv("PYTEST_CURRENT_TEST"):
        threading.Thread(target=tts_service.warm_tts_models, daemon=True, name="tts_warmup").start()
    yield


app = FastAPI(
    title="CyberShield local API",
    version="1.0.0",
    docs_url="/api/docs" if config.ENABLE_DOCS else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if config.ENABLE_DOCS else None,
)


def err(code: str, headers: dict = None) -> JSONResponse:
    return JSONResponse({"error": {"code": code}}, status_code=ERRORS.get(code, 400), headers=headers)


def host_ok(host: str) -> bool:
    host = host.lower()
    if host.startswith("["):
        name, _, rest = host[1:].partition("]")
        port = rest.lstrip(":")
    else:
        name, _, port = host.partition(":")
    if config.IS_PRODUCTION or config.ALLOW_NON_LOOPBACK:
        if name in config.ALLOWED_HOSTS or f"{name}:{port}" in config.ALLOWED_HOSTS:
            return True
        if "*" in config.ALLOWED_HOSTS:
            return True
    return name in config.LOOPBACK_NAMES and port == str(config.PORT)


class PayloadTooLargeException(Exception):
    pass


class BoundedReceive:
    def __init__(self, receive, limit: int):
        self._receive = receive
        self._limit = limit
        self._bytes_read = 0

    async def __call__(self):
        message = await self._receive()
        if message.get("type") == "http.request":
            body = message.get("body", b"")
            self._bytes_read += len(body)
            if self._bytes_read > self._limit:
                raise PayloadTooLargeException()
        return message


@app.middleware("http")
async def guard(request: Request, call_next):
    try:
        norm_path = posixpath.normpath(request.url.path)
        body_limit = (
            config.MAX_VOICE_BODY_BYTES
            if norm_path == "/api/v1/voice/transcribe"
            else config.MAX_BODY_BYTES
        )
        content_length_str = request.headers.get("content-length")
        content_length_val = int(content_length_str) if content_length_str and content_length_str.isdigit() else 0

        if not host_ok(request.headers.get("host", "")):
            resp = err("HOST_NOT_ALLOWED")
        elif request.method == "OPTIONS":
            origin = request.headers.get("origin")
            if origin in config.ALLOWED_ORIGINS or (config.IS_PRODUCTION and "*" in config.ALLOWED_ORIGINS):
                resp = JSONResponse(None, status_code=204)
                resp.headers["Access-Control-Allow-Origin"] = origin or "*"
                resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
                resp.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
                resp.headers["Access-Control-Allow-Credentials"] = "true"
                resp.headers["Access-Control-Max-Age"] = "86400"
            else:
                resp = err("ORIGIN_NOT_ALLOWED")
        elif request.method in ("POST", "PUT", "PATCH", "DELETE") and request.headers.get("origin") not in (None, *config.ALLOWED_ORIGINS):
            resp = err("ORIGIN_NOT_ALLOWED")  # absent Origin is allowed (non-browser local clients)
        elif request.method in ("POST", "PUT", "PATCH") and not request.headers.get("content-type", "").lower().startswith("application/json"):
            if content_length_val > 0 or request.headers.get("content-type"):
                resp = err("UNSUPPORTED_MEDIA_TYPE")
            else:
                resp = await call_next(request)
        elif content_length_val > body_limit:
            resp = err("PAYLOAD_TOO_LARGE")
        else:
            request._receive = BoundedReceive(request._receive, body_limit)
            resp = await call_next(request)
    except PayloadTooLargeException:
        resp = err("PAYLOAD_TOO_LARGE")
    except Exception as exc:  # SR-08: never leak internals
        log.error("event=unhandled outcome=500")
        resp = err("INTERNAL_ERROR")
    for k, v in SECURITY_HEADERS.items():
        resp.headers[k] = v

    # HSTS: Only emitted if request is actually served over HTTPS (direct or verified via trusted proxy)
    is_https = (
        request.url.scheme == "https"
        or (
            request.headers.get("x-forwarded-proto") == "https"
            and request.client
            and request.client.host in config.TRUSTED_PROXIES
        )
    )
    if is_https:
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    origin = request.headers.get("origin")
    if origin and (origin in config.ALLOWED_ORIGINS or (config.IS_PRODUCTION and "*" in config.ALLOWED_ORIGINS)):
        resp.headers["Access-Control-Allow-Origin"] = origin
        resp.headers["Access-Control-Allow-Credentials"] = "true"

    log.info("event=request method=%s outcome=%s", request.method, resp.status_code)
    return resp


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, __: RequestValidationError):
    return err("INVALID_REQUEST")


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, exc: StarletteHTTPException):
    headers = exc.headers or None
    if exc.detail in ERRORS:
        return err(exc.detail, headers=headers)
    return err("NOT_FOUND", headers=headers) if exc.status_code in (404, 405) else err("INVALID_REQUEST", headers=headers)


DemoRequest = routes_m4.DemoRequest
scenarios = routes_m4.scenarios
demo = routes_m4.demo


@app.get("/api/v1/health", summary="Liveness check")
def health():
    return {"status": "ok"}


# Include M4 Website Security Check (Demo) routes
app.include_router(routes_m4.router)

# Include authenticated and account routes
app.include_router(routes_auth.router)

# Include M1 CTI routes
app.include_router(routes_m1.router)

# Include Journey Artwork routes
app.include_router(routes_artwork.router)

# Include Notifications routes
app.include_router(routes_notifications.router)

# Include Daily Challenge routes
app.include_router(routes_daily.router)

# Include Machine Learning routes
app.include_router(routes_ml.router)

# Include Conversational AI Assistant routes
app.include_router(routes_assistant.router)

# Include Offline-First Voice Assistant routes
app.include_router(routes_voice.router)

# Include Local Device Security Check routes
app.include_router(routes_device_security.router)

_cache_dir = config.AI_ARTWORK_CACHE_DIR
_cache_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images/journey/cache", StaticFiles(directory=_cache_dir), name="journey_artwork_cache")

_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")

