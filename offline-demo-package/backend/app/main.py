import logging
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
from . import routes_artwork
from . import routes_notifications
from . import routes_daily

log = logging.getLogger("cybershield")  # logs event type + outcome only (SR-07)

SECURITY_HEADERS = {
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
                               "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store",
}
ERRORS = {
    "INVALID_SCENARIO": 400, "INVALID_REQUEST": 400, "HOST_NOT_ALLOWED": 421, "ORIGIN_NOT_ALLOWED": 403,
    "UNSUPPORTED_MEDIA_TYPE": 415, "PAYLOAD_TOO_LARGE": 413, "NOT_FOUND": 404, "INTERNAL_ERROR": 500,
    "UNAUTHORIZED": 401, "FORBIDDEN": 403, "EMAIL_ALREADY_EXISTS": 409, "INVALID_CREDENTIALS": 401,
    "TOO_MANY_REQUESTS": 429, "SYNC_NOT_ENABLED": 403,
}

app = FastAPI(title="CyberShield local API", version="1.0.0", docs_url="/api/docs", redoc_url=None,
              openapi_url="/api/openapi.json")


def err(code: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code}}, status_code=ERRORS.get(code, 400))


def host_ok(host: str) -> bool:
    host = host.lower()
    if host.startswith("["):
        name, _, rest = host[1:].partition("]")
        port = rest.lstrip(":")
    else:
        name, _, port = host.partition(":")
    return name in config.LOOPBACK_NAMES and port == str(config.PORT)


@app.middleware("http")
async def guard(request: Request, call_next):
    try:
        if not host_ok(request.headers.get("host", "")):
            resp = err("HOST_NOT_ALLOWED")
        elif request.method in ("POST", "PUT", "PATCH", "DELETE") and request.headers.get("origin") not in (None, *config.ALLOWED_ORIGINS):
            resp = err("ORIGIN_NOT_ALLOWED")  # absent Origin is allowed (non-browser local clients)
        elif request.method in ("POST", "PUT", "PATCH") and not request.headers.get("content-type", "").lower().startswith("application/json"):
            content_length = int(request.headers.get("content-length") or 0)
            if content_length > 0 or request.headers.get("content-type"):
                resp = err("UNSUPPORTED_MEDIA_TYPE")
            else:
                resp = await call_next(request)
        elif int(request.headers.get("content-length") or 0) > config.MAX_BODY_BYTES:
            resp = err("PAYLOAD_TOO_LARGE")
        else:
            resp = await call_next(request)
    except Exception:  # SR-08: never leak internals
        log.error("event=unhandled outcome=500")
        resp = err("INTERNAL_ERROR")
    for k, v in SECURITY_HEADERS.items():
        resp.headers[k] = v
    log.info("event=request method=%s outcome=%s", request.method, resp.status_code)
    return resp


@app.exception_handler(RequestValidationError)
async def _validation(_: Request, __: RequestValidationError):
    return err("INVALID_REQUEST")


@app.exception_handler(StarletteHTTPException)
async def _http(_: Request, exc: StarletteHTTPException):
    if exc.detail in ERRORS:
        return err(exc.detail)
    return err("NOT_FOUND") if exc.status_code in (404, 405) else err("INVALID_REQUEST")


class DemoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scenario_id: str = Field(max_length=16)


@app.get("/api/v1/health", summary="Liveness check")
def health():
    return {"status": "ok"}


@app.get("/api/v1/m4/scenarios", summary="List bundled SIMULATED demo scenarios")
def scenarios():
    return {"simulated": True, "scenarios": [{"id": k, "hostname": v["hostname"]} for k, v in SCENARIOS.items()]}


@app.post("/api/v1/m4/demo", summary="Return SIMULATED fixture findings for an enumerated scenario id")
def demo(body: DemoRequest):
    s = SCENARIOS.get(body.scenario_id)
    if s is None:
        return err("INVALID_SCENARIO")
    return {"simulated": True, "scenario_id": body.scenario_id, "hostname": s["hostname"], "findings": s["findings"]}


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

_cache_dir = config.AI_ARTWORK_CACHE_DIR
_cache_dir.mkdir(parents=True, exist_ok=True)
app.mount("/images/journey/cache", StaticFiles(directory=_cache_dir), name="journey_artwork_cache")

_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _dist.is_dir():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")

