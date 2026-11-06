import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import auth, config, database, main, models

import socket
from sqlalchemy import event
from sqlalchemy.engine.url import make_url
from sqlalchemy.pool import StaticPool

def _create_test_engine():
    db_url = config.TEST_DATABASE_URL
    if db_url and not db_url.startswith("sqlite"):
        try:
            url = make_url(db_url)
            # Safety Guard: Verify target database is explicitly a test database, never dev/prod
            db_name = (url.database or "").lower()
            if "test" in db_name:
                host = url.host or "127.0.0.1"
                port = url.port or 5432
                with socket.create_connection((host, port), timeout=0.3):
                    eng = create_engine(
                        db_url,
                        pool_pre_ping=True,
                        connect_args={"connect_timeout": 2},
                    )
                    with eng.connect() as conn:
                        pass
                    return eng
        except Exception:
            pass

    # Seamless offline fallback: In-memory SQLite with StaticPool for safe, non-destructive testing
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(eng, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return eng

test_engine = _create_test_engine()
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)



@pytest.fixture(autouse=True)
def clean_db():
    models.Base.metadata.drop_all(bind=test_engine)
    models.Base.metadata.create_all(bind=test_engine)
    auth.auth_rate_limiter._records.clear()
    yield
    models.Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        def override_get_db():
            try:
                yield db
            finally:
                pass

        main.app.dependency_overrides[database.get_db] = override_get_db
        yield db
    finally:
        db.close()
        main.app.dependency_overrides.clear()


@pytest.fixture
def client(db_session):
    return TestClient(main.app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)


def test_registration_and_password_hashing(client, db_session):
    reg_data = {
        "display_name": "Abebe Bikila",
        "email": "Abebe@Example.Com",  # tests case normalization
        "password": "SecurePassword123!",
        "confirm_password": "SecurePassword123!",
    }
    r = client.post("/api/v1/auth/register", json=reg_data)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["user"]["display_name"] == "Abebe Bikila"
    assert data["user"]["email"] == "abebe@example.com"
    assert data["user"]["preferences"]["cloud_progress_sync_enabled"] is False
    assert "token" not in data

    # Check cookies
    assert auth.COOKIE_NAME in r.cookies
    cookie = r.cookies.get(auth.COOKIE_NAME)
    assert len(cookie) > 20

    # Verify database: Plaintext password must NEVER be stored!
    user = db_session.query(models.User).filter_by(email="abebe@example.com").first()
    assert user is not None
    assert user.password_hash != "SecurePassword123!"
    assert user.password_hash.startswith("$argon2id$")
    assert auth.verify_password(user.password_hash, "SecurePassword123!") is True


def test_duplicate_email_rejected(client, db_session):
    user_payload = {
        "display_name": "User One",
        "email": "user1@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    r1 = client.post("/api/v1/auth/register", json=user_payload)
    assert r1.status_code == 201

    # Second registration with exact same email (different case)
    user_payload["email"] = "USER1@EXAMPLE.COM"
    r2 = client.post("/api/v1/auth/register", json=user_payload)
    assert r2.status_code == 409
    assert r2.json()["error"]["code"] == "EMAIL_ALREADY_EXISTS"


def test_registration_validation(client):
    # Passwords do not match
    r = client.post("/api/v1/auth/register", json={
        "display_name": "Mismatch",
        "email": "mismatch@example.com",
        "password": "Password123!",
        "confirm_password": "Password999!",
    })
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "INVALID_REQUEST"

    # Password too short (<8 chars)
    r = client.post("/api/v1/auth/register", json={
        "display_name": "Short",
        "email": "short@example.com",
        "password": "Pass1",
        "confirm_password": "Pass1",
    })
    assert r.status_code == 400

    # Password without digits
    r = client.post("/api/v1/auth/register", json={
        "display_name": "NoDigits",
        "email": "nodigits@example.com",
        "password": "PasswordOnly",
        "confirm_password": "PasswordOnly",
    })
    assert r.status_code == 400

    # Blank display name
    r = client.post("/api/v1/auth/register", json={
        "display_name": "   ",
        "email": "blankname@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    })
    assert r.status_code == 400


def test_login_success_and_failure(client):
    client.post("/api/v1/auth/register", json={
        "display_name": "Login User",
        "email": "login@example.com",
        "password": "MySecretPass123",
        "confirm_password": "MySecretPass123",
    })

    # Successful login
    r = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "MySecretPass123",
    })
    assert r.status_code == 200
    assert auth.COOKIE_NAME in r.cookies
    token = r.cookies[auth.COOKIE_NAME]
    assert token is not None
    assert "token" not in r.json()

    # Failed login: incorrect password
    r_bad_pw = client.post("/api/v1/auth/login", json={
        "email": "login@example.com",
        "password": "WrongPassword123",
    })
    assert r_bad_pw.status_code == 401
    assert r_bad_pw.json()["error"]["code"] == "INVALID_CREDENTIALS"

    # Failed login: non-existent email (must return same generic 401 error, no user enumeration)
    r_no_user = client.post("/api/v1/auth/login", json={
        "email": "nobody@example.com",
        "password": "MySecretPass123",
    })
    assert r_no_user.status_code == 401
    assert r_no_user.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_logout_and_session_invalidation(client):
    reg = client.post("/api/v1/auth/register", json={
        "display_name": "Logout Tester",
        "email": "logout@example.com",
        "password": "LogoutPassword123",
        "confirm_password": "LogoutPassword123",
    })
    assert reg.status_code == 201, reg.text
    token = reg.cookies[auth.COOKIE_NAME]

    # Verify /me is accessible
    r_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    assert r_me.json()["email"] == "logout@example.com"

    # Call logout
    r_logout = client.post("/api/v1/auth/logout", json={}, headers={"Authorization": f"Bearer {token}"})
    assert r_logout.status_code == 200
    assert r_logout.json()["status"] == "logged_out"

    # Attempt to access /me with invalidated token -> must be 401 UNAUTHORIZED
    r_me_revoked = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me_revoked.status_code == 401
    assert r_me_revoked.json()["error"]["code"] == "UNAUTHORIZED"


def test_protected_endpoints_unauthenticated(client):
    for endpoint in ["/api/v1/auth/me", "/api/v1/auth/progress"]:
        r = client.get(endpoint)
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "UNAUTHORIZED"

    r_put_pref = client.put("/api/v1/auth/preferences", json={"preferred_language": "am"})
    assert r_put_pref.status_code == 401


def test_progress_consent_and_isolation(client):
    # Register User A
    r_a = client.post("/api/v1/auth/register", json={
        "display_name": "User Alpha",
        "email": "alpha@example.com",
        "password": "AlphaPassword123",
        "confirm_password": "AlphaPassword123",
    })
    assert r_a.status_code == 201, r_a.text
    token_a = r_a.cookies[auth.COOKIE_NAME]

    # Register User B
    r_b = client.post("/api/v1/auth/register", json={
        "display_name": "User Beta",
        "email": "beta@example.com",
        "password": "BetaPassword123",
        "confirm_password": "BetaPassword123",
    })
    assert r_b.status_code == 201, r_b.text
    token_b = r_b.cookies[auth.COOKIE_NAME]

    # 1. Cloud progress sync is OFF by default
    r_prog_default = client.get("/api/v1/auth/progress", headers={"Authorization": f"Bearer {token_a}"})
    assert r_prog_default.status_code == 200
    assert r_prog_default.json()["sync_enabled"] is False

    # 2. Attempting to upload progress without consent -> must return 403 SYNC_NOT_ENABLED
    progress_payload = {
        "module_or_level": "m5",
        "active_level": 2,
        "unlocked_levels": [1, 2],
        "completed_levels": {"1": {"score": 100, "stars": 3}},
    }
    r_put_no_consent = client.put(
        "/api/v1/auth/progress",
        json=progress_payload,
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r_put_no_consent.status_code == 403
    assert r_put_no_consent.json()["error"]["code"] == "SYNC_NOT_ENABLED"

    # 3. User A explicitly enables cloud progress sync
    r_enable = client.put(
        "/api/v1/auth/preferences",
        json={"cloud_progress_sync_enabled": True},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r_enable.status_code == 200
    assert r_enable.json()["cloud_progress_sync_enabled"] is True

    # 4. Now saving progress succeeds for User A
    r_save = client.put(
        "/api/v1/auth/progress",
        json=progress_payload,
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r_save.status_code == 200
    assert r_save.json()["progress"]["active_level"] == 2
    assert r_save.json()["progress"]["unlocked_levels"] == [1, 2]

    # 5. User B also enables sync, but User B's progress is independent
    client.put(
        "/api/v1/auth/preferences",
        json={"cloud_progress_sync_enabled": True},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    r_prog_b = client.get("/api/v1/auth/progress", headers={"Authorization": f"Bearer {token_b}"})
    assert r_prog_b.status_code == 200
    # User B has no progress saved yet
    assert r_prog_b.json()["progress"] is None

    # User B saves different progress
    b_payload = {
        "module_or_level": "m5",
        "active_level": 5,
        "unlocked_levels": [1, 2, 3, 4, 5],
        "completed_levels": {"1": {"score": 90}, "2": {"score": 85}},
    }
    client.put("/api/v1/auth/progress", json=b_payload, headers={"Authorization": f"Bearer {token_b}"})

    # Verify User A's progress is unchanged and cannot be overwritten by User B (isolation)
    r_prog_a = client.get("/api/v1/auth/progress", headers={"Authorization": f"Bearer {token_a}"})
    assert r_prog_a.json()["progress"]["active_level"] == 2
    assert r_prog_a.json()["progress"]["unlocked_levels"] == [1, 2]


def test_auth_rate_limiting(client):
    # Send 5 attempts (allowed)
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": "rate@example.com", "password": "Bad"})

    # 6th attempt -> must be 429 TOO_MANY_REQUESTS
    r6 = client.post("/api/v1/auth/login", json={"email": "rate@example.com", "password": "Bad"})
    assert r6.status_code == 429
    assert r6.json()["error"]["code"] == "TOO_MANY_REQUESTS"


def test_session_cookie_security_attributes(client):
    r = client.post("/api/v1/auth/register", json={
        "display_name": "Cookie User",
        "email": "cookie@example.com",
        "password": "Password123!",
        "confirm_password": "Password123!",
    })
    assert r.status_code == 201
    set_cookie_hdr = r.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_hdr
    assert "SameSite=lax" in set_cookie_hdr or "samesite=lax" in set_cookie_hdr.lower()
    assert "Path=/" in set_cookie_hdr


def test_static_spa_serving(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "html" in r.headers.get("content-type", "").lower()
