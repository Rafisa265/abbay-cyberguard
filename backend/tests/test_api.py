import logging
import pytest
from fastapi.testclient import TestClient
from app import config, main

c = TestClient(main.app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)
J = {"Content-Type": "application/json"}


def test_demo_ok_and_simulated():
    r = c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A"})
    assert r.status_code == 200 and r.json()["simulated"] is True and len(r.json()["findings"]) == 7


def test_all_scenarios():
    for s in c.get("/api/v1/m4/scenarios").json()["scenarios"]:
        assert c.post("/api/v1/m4/demo", json={"scenario_id": s["id"]}).status_code == 200


@pytest.mark.parametrize("body", [{"scenario_id": "example.com"}, {"scenario_id": "../etc"}])
def test_invalid_scenario(body):
    r = c.post("/api/v1/m4/demo", json=body)
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_SCENARIO"


def test_extra_fields_and_missing_rejected():
    assert c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A", "host": "x.com"}).status_code == 400
    assert c.post("/api/v1/m4/demo", json={}).status_code == 400


def test_host_header():
    assert c.get("/api/v1/health", headers={"Host": "evil.example:8000"}).status_code == 421
    assert c.get("/api/v1/health", headers={"Host": "127.0.0.1:9999"}).status_code == 421
    assert c.get("/api/v1/health", headers={"Host": "localhost:8000"}).status_code == 200


def test_readiness_reports_database_availability(monkeypatch):
    from app import database

    monkeypatch.setattr(database, "check_database_health", lambda: False)
    r = c.get("/api/v1/ready")
    assert r.status_code == 503
    assert r.json() == {"status": "unavailable"}


def test_postgres_urls_use_installed_psycopg_driver():
    assert config._normalize_database_url("postgres://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )
    assert config._normalize_database_url("postgresql://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )
    assert config._normalize_database_url("postgresql+psycopg://user:pass@db.example/app") == (
        "postgresql+psycopg://user:pass@db.example/app"
    )


def test_production_database_url_requires_tls():
    with pytest.raises(RuntimeError, match="must require TLS"):
        config._validate_production_database_url("postgresql+psycopg://user:pass@db.example/app")
    config._validate_production_database_url(
        "postgresql+psycopg://user:pass@db.example/app?sslmode=require"
    )


def test_production_origins_reject_wildcards_and_keep_exact_origins():
    with pytest.raises(ValueError, match="Wildcard origins"):
        config.build_allowed_origins(
            "production",
            8000,
            "https://app.example.com,https://*.example.com",
        )

    origins = config.build_allowed_origins(
        "production",
        8000,
        "https://app.example.com",
    )
    assert "https://abbay-cyberguard.pages.dev" in origins
    assert "https://app.example.com" in origins
    assert "https://app.example.com.attacker.example" not in origins
    assert "http://localhost:5173" not in origins


def test_development_origins_reject_wildcards_with_credentials():
    with pytest.raises(ValueError, match="Wildcard origins"):
        config.build_allowed_origins("development", 8000, "http://*.example.com")


def test_development_origins_include_local_vite_origins():
    origins = config.build_allowed_origins("development", 8000, "")
    assert "http://localhost:5173" in origins
    assert "https://abbay-cyberguard.pages.dev" in origins


def test_origins_must_not_include_paths():
    with pytest.raises(ValueError, match="exact http\\(s\\) origins"):
        config.build_allowed_origins("production", 8000, "https://app.example.com/path")


def test_origin():
    assert c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A"}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A"}, headers={"Origin": "http://127.0.0.1:8000"}).status_code == 200
    pages_origin = "https://abbay-cyberguard.pages.dev"
    assert c.get("/api/v1/m4/scenarios", headers={"Origin": pages_origin}).status_code == 200
    assert c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A"}, headers={"Origin": pages_origin}).status_code == 200
    preflight = c.options("/api/v1/device-security/status", headers={
        "Origin": pages_origin,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Private-Network": "true",
    })
    assert preflight.status_code == 204
    assert preflight.headers["Access-Control-Allow-Private-Network"] == "true"
    assert preflight.headers["Access-Control-Allow-Origin"] == pages_origin


def test_local_device_status_allows_exact_pages_origin_and_rejects_other_preflight_origins():
    pages_origin = "https://abbay-cyberguard.pages.dev"
    status = c.get("/api/v1/device-security/status", headers={"Origin": pages_origin})
    assert status.status_code == 200
    assert status.headers["Access-Control-Allow-Origin"] == pages_origin
    assert status.headers["Access-Control-Allow-Credentials"] == "true"

    rejected = c.options("/api/v1/device-security/status", headers={
        "Origin": "https://evil.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Private-Network": "true",
    })
    assert rejected.status_code == 403
    assert "Access-Control-Allow-Origin" not in rejected.headers
    assert "Access-Control-Allow-Private-Network" not in rejected.headers


@pytest.mark.parametrize("ct", ["text/plain", "application/x-www-form-urlencoded", None])
def test_content_type(ct):
    h = {"Content-Type": ct} if ct else {}
    assert c.post("/api/v1/m4/demo", content=b'{"scenario_id":"DS-A"}', headers=h).status_code == 415


def test_live_paths_404():
    for p in ["/api/v1/m4/live", "/api/v1/m4/live/scan", "/api/v1/nope"]:
        r = c.get(p)
        assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"
    assert c.post("/api/v1/m4/live", json={"hostname": "a.com"}).status_code == 404


def test_headers_on_all_routes():
    for r in [c.get("/api/v1/health"), c.get("/api/v1/nope"), c.get("/api/v1/health", headers={"Host": "x"})]:
        assert "connect-src 'self'" in r.headers["content-security-policy"]
        assert r.headers["x-content-type-options"] == "nosniff"
        assert "access-control-allow-origin" not in r.headers


def test_generic_500(monkeypatch):
    monkeypatch.setattr(main, "SCENARIOS", None)
    r = c.post("/api/v1/m4/demo", json={"scenario_id": "DS-A"})
    assert r.status_code == 500 and r.json() == {"error": {"code": "INTERNAL_ERROR"}}
    assert "Traceback" not in r.text and ".py" not in r.text


def test_oversize_body():
    assert c.post("/api/v1/m4/demo", content=b"x" * 5000, headers=J).status_code == 413


def test_log_hygiene(caplog):
    caplog.set_level(logging.DEBUG)
    c.post("/api/v1/m4/demo?q=CANARY_Q", json={"scenario_id": "CANARY_BODY"}, headers={"Cookie": "s=CANARY_C"})
    c.get("/api/v1/CANARY_PATH")
    server = [r.getMessage() for r in caplog.records if not r.name.startswith(("httpx", "httpcore"))]
    assert server and not any("CANARY" in m for m in server)


def test_no_secret_fields_in_openapi():
    spec = c.get("/api/openapi.json").json()
    assert {"/api/v1/health", "/api/v1/m4/scenarios", "/api/v1/m4/demo"}.issubset(set(spec["paths"]))
    demo_props = str(spec["components"]["schemas"].get("DemoRequest", {})).lower()
    assert "password" not in demo_props and "report" not in demo_props


def test_bind_refused_without_flag():
    config.check_bind("127.0.0.1", False)
    with pytest.raises(SystemExit):
        config.check_bind("0.0.0.0", False)


def test_no_outbound_clients_imported():
    import pathlib, re
    src = "".join(p.read_text() for p in pathlib.Path(main.__file__).parent.glob("*.py"))
    assert not re.search(r"^\s*(import|from)\s+(requests|httpx|aiohttp|urllib3|socket)\b", src, re.M)
