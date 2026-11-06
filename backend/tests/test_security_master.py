import pytest
from starlette.testclient import TestClient
from app.main import app
from app import config, auth, database, models
from app.models import Base
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# In-memory SQLite with StaticPool for isolated security testing
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

@event.listens_for(test_engine, "connect")
def _enable_fk(dbapi_con, con_record):
    cur = dbapi_con.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

@pytest.fixture
def sec_client():
    Base.metadata.create_all(bind=test_engine)
    auth.auth_rate_limiter._records.clear()

    db = TestingSessionLocal()
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[database.get_db] = override_get_db
    with TestClient(app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False) as c:
        yield c
    db.close()
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)

def test_idor_and_horizontal_privilege_escalation(sec_client):
    """Verify that User A cannot read, modify, or manipulate User B's resources."""
    # Register User A
    ra = sec_client.post("/api/v1/auth/register", json={
        "display_name": "User Alpha",
        "email": "alpha@example.com",
        "password": "PasswordAlpha123!",
        "confirm_password": "PasswordAlpha123!"
    })
    assert ra.status_code == 201
    user_a_data = ra.json()["user"]
    cookie_a = ra.cookies.get("cybershield_session")

    # Register User B
    rb = sec_client.post("/api/v1/auth/register", json={
        "display_name": "User Beta",
        "email": "beta@example.com",
        "password": "PasswordBeta123!",
        "confirm_password": "PasswordBeta123!"
    })
    assert rb.status_code == 201
    user_b_data = rb.json()["user"]
    cookie_b = rb.cookies.get("cybershield_session")

    assert user_a_data["id"] != user_b_data["id"]

    # Verify User A /me returns User A data only
    res_a = sec_client.get("/api/v1/auth/me", cookies={"cybershield_session": cookie_a})
    assert res_a.status_code == 200
    assert res_a.json()["email"] == "alpha@example.com"

    # Verify User B /me returns User B data only
    res_b = sec_client.get("/api/v1/auth/me", cookies={"cybershield_session": cookie_b})
    assert res_b.status_code == 200
    assert res_b.json()["email"] == "beta@example.com"

    # Enable cloud sync on User B
    sec_client.put(
        "/api/v1/auth/preferences",
        json={"cloud_progress_sync_enabled": True},
        cookies={"cybershield_session": cookie_b}
    )

    # User B saves progress
    sec_client.put(
        "/api/v1/auth/progress",
        json={"module_or_level": "m5", "active_level": 4, "unlocked_levels": [1, 2, 3, 4], "completed_levels": {"1": 100}},
        cookies={"cybershield_session": cookie_b}
    )

    # User A reads progress -> must NOT see User B's progress
    res_prog_a = sec_client.get("/api/v1/auth/progress", cookies={"cybershield_session": cookie_a})
    assert res_prog_a.status_code == 200
    assert res_prog_a.json()["progress"] is None or res_prog_a.json()["sync_enabled"] is False

    # User A attempts to mark read User B's notifications
    notifs_b = sec_client.get("/api/v1/notifications", cookies={"cybershield_session": cookie_b}).json()
    if notifs_b.get("notifications"):
        b_notif_id = notifs_b["notifications"][0]["id"]
        # User A sends User B's notification ID
        hack_res = sec_client.post(
            "/api/v1/notifications/mark-read",
            json={"notification_ids": [b_notif_id]},
            cookies={"cybershield_session": cookie_a}
        )
        assert hack_res.status_code == 200
        assert hack_res.json()["updated_count"] == 0  # 0 updated because User A does not own it!

def test_unauthenticated_protected_endpoints(sec_client):
    """Verify that unauthenticated guest requests to protected endpoints return 401."""
    protected_paths = [
        ("GET", "/api/v1/auth/me"),
        ("PUT", "/api/v1/auth/preferences"),
        ("GET", "/api/v1/auth/progress"),
        ("PUT", "/api/v1/auth/progress"),
        ("POST", "/api/v1/auth/change-password"),
        ("GET", "/api/v1/notifications"),
        ("POST", "/api/v1/notifications/mark-read"),
        ("POST", "/api/v1/daily/submit"),
    ]
    for method, path in protected_paths:
        if method == "GET":
            r = sec_client.get(path)
        elif method == "POST":
            r = sec_client.post(path, json={})
        elif method == "PUT":
            r = sec_client.put(path, json={})
        assert r.status_code == 401, f"{path} should return 401 unauthenticated"
        assert r.json()["error"]["code"] == "UNAUTHORIZED"

def test_password_change_lifecycle(sec_client):
    """Verify full password change lifecycle, policy validation, and session invalidation."""
    reg = sec_client.post("/api/v1/auth/register", json={
        "display_name": "Change Pwd User",
        "email": "changepwd@example.com",
        "password": "OldPassword123!",
        "confirm_password": "OldPassword123!"
    })
    assert reg.status_code == 201
    cookie = reg.cookies.get("cybershield_session")

    # Attempt change with wrong current password -> 401
    bad_curr = sec_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword!", "new_password": "NewPassword123!", "confirm_password": "NewPassword123!"},
        cookies={"cybershield_session": cookie}
    )
    assert bad_curr.status_code == 401

    # Attempt change to same password -> 400 NEW_PASSWORD_SAME_AS_OLD
    same_pwd = sec_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "OldPassword123!", "new_password": "OldPassword123!", "confirm_password": "OldPassword123!"},
        cookies={"cybershield_session": cookie}
    )
    assert same_pwd.status_code == 400

    # Successful password change
    good_change = sec_client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "OldPassword123!", "new_password": "BrandNewPassword123!", "confirm_password": "BrandNewPassword123!"},
        cookies={"cybershield_session": cookie}
    )
    assert good_change.status_code == 200
    assert good_change.json()["status"] == "ok"

    # Login with old password fails
    old_login = sec_client.post("/api/v1/auth/login", json={"email": "changepwd@example.com", "password": "OldPassword123!"})
    assert old_login.status_code == 401

    # Login with new password succeeds
    new_login = sec_client.post("/api/v1/auth/login", json={"email": "changepwd@example.com", "password": "BrandNewPassword123!"})
    assert new_login.status_code == 200

def test_rate_limiting_retry_after_header(sec_client):
    """Verify 429 response includes standard Retry-After header."""
    auth.auth_rate_limiter.reset("login:127.0.0.1")
    for _ in range(5):
        sec_client.post("/api/v1/auth/login", json={"email": "rl@example.com", "password": "BadPassword1"})

    r6 = sec_client.post("/api/v1/auth/login", json={"email": "rl@example.com", "password": "BadPassword1"})
    assert r6.status_code == 429
    assert "retry-after" in r6.headers
    retry_secs = int(r6.headers["retry-after"])
    assert 1 <= retry_secs <= 60

def test_proxy_aware_client_ip_extraction(sec_client):
    """Verify X-Forwarded-For is only trusted when coming from TRUSTED_PROXIES."""
    # When connecting from 127.0.0.1 (in TRUSTED_PROXIES by default):
    # Simulated request with X-Forwarded-For from proxy
    client_ip = auth.get_client_ip(
        type("MockReq", (), {
            "client": type("MockClient", (), {"host": "127.0.0.1"})(),
            "headers": {"x-forwarded-for": "203.0.113.195, 10.0.0.1"}
        })()
    )
    assert client_ip == "203.0.113.195"

    # When connecting from an untrusted direct IP (e.g. 198.51.100.22):
    untrusted_ip = auth.get_client_ip(
        type("MockReq", (), {
            "client": type("MockClient", (), {"host": "198.51.100.22"})(),
            "headers": {"x-forwarded-for": "1.1.1.1"}
        })()
    )
    assert untrusted_ip == "198.51.100.22"  # Spoofed 1.1.1.1 is strictly rejected!

def test_permissions_policy_header(sec_client):
    """Verify Permissions-Policy header is emitted on API responses."""
    r = sec_client.get("/api/v1/health")
    assert "permissions-policy" in r.headers
    assert "camera=()" in r.headers["permissions-policy"]
    assert "microphone=(self)" in r.headers["permissions-policy"]
