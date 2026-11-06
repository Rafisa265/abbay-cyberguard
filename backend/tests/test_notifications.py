import socket
import uuid
from datetime import datetime, timezone
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.engine.url import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app import config
from app.main import app
from app.database import Base, get_db
from app.auth import get_current_user
from app.models import User, Notification, utc_now


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
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine,
    expire_on_commit=False,
)

user_a_id = uuid.uuid4()
user_b_id = uuid.uuid4()


@pytest.fixture(autouse=True)
def clean_db():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    with TestingSessionLocal() as db:
        u_a = User(
            id=user_a_id,
            email="defender_a@example.com",
            display_name="Defender A",
            password_hash="mock_hash_a",
            created_at=utc_now(),
        )
        u_b = User(
            id=user_b_id,
            email="defender_b@example.com",
            display_name="Defender B",
            password_hash="mock_hash_b",
            created_at=utc_now(),
        )
        db.add(u_a)
        db.add(u_b)
        db.commit()
    yield
    Base.metadata.drop_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


client = TestClient(app, base_url="http://127.0.0.1:8000", raise_server_exceptions=False)


def get_current_user_a(db: Session = Depends(override_get_db)) -> User:
    return db.query(User).filter(User.id == user_a_id).first()


def get_current_user_b(db: Session = Depends(override_get_db)) -> User:
    return db.query(User).filter(User.id == user_b_id).first()


def test_unauthenticated_notifications_access_rejected():
    """Unauthenticated users cannot access notification endpoints."""
    app.dependency_overrides.pop(get_current_user, None)
    res_get = client.get("/api/v1/notifications")
    assert res_get.status_code == 401

    res_post = client.post("/api/v1/notifications/mark-read", json={"mark_all": True})
    assert res_post.status_code == 401

    res_sync = client.post("/api/v1/notifications/sync", json={})
    assert res_sync.status_code == 401

    res_create = client.post("/api/v1/notifications/create", json={"title_key": "test"})
    assert res_create.status_code == 401


def test_authenticated_notifications_retrieval_and_seeding():
    """Authenticated user receives seeded initial welcome and security tip notifications."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    res = client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()
    assert "notifications" in data
    assert len(data["notifications"]) >= 2
    assert data["unread_count"] >= 2

    titles = [n["title_key"] for n in data["notifications"]]
    assert "notif.welcome_title" in titles
    assert "notif.security_tip_title" in titles
    assert any(n["is_read"] is False for n in data["notifications"])


def test_cross_user_isolation_enforced():
    """User B cannot see notifications belonging to User A or mark them read."""
    with TestingSessionLocal() as db:
        notif_a = Notification(
            id=uuid.uuid4(),
            user_id=user_a_id,
            type="tip",
            title_key="notif.security_tip_title",
            message_key="notif.security_tip_msg",
            is_read=False,
            created_at=utc_now(),
        )
        db.add(notif_a)
        db.commit()
        notif_a_id = str(notif_a.id)

    # User B queries notifications
    app.dependency_overrides[get_current_user] = get_current_user_b
    res_b = client.get("/api/v1/notifications")
    assert res_b.status_code == 200
    user_b_ids = [n["id"] for n in res_b.json()["notifications"]]
    assert notif_a_id not in user_b_ids

    # User B attempts to mark User A's notification as read
    res_mark = client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [notif_a_id], "mark_all": False},
    )
    assert res_mark.status_code == 200
    assert res_mark.json()["updated_count"] == 0

    # Verify notification remains unread for User A
    with TestingSessionLocal() as db:
        refreshed = db.query(Notification).filter(Notification.id == uuid.UUID(notif_a_id)).first()
        assert refreshed.is_read is False


def test_mark_as_read_endpoint_single_and_all():
    """User can mark their own notifications as read individually and in bulk."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    # Retrieve current unread list
    res = client.get("/api/v1/notifications")
    notif_id = res.json()["notifications"][0]["id"]

    # Mark single
    res_single = client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [notif_id], "mark_all": False},
    )
    assert res_single.status_code == 200
    assert res_single.json()["updated_count"] >= 1

    # Verify updated
    res_after = client.get("/api/v1/notifications")
    matching = [n for n in res_after.json()["notifications"] if n["id"] == notif_id][0]
    assert matching["is_read"] is True
    assert matching["read_at"] is not None

    # Mark all
    res_all = client.post(
        "/api/v1/notifications/mark-read",
        json={"mark_all": True},
    )
    assert res_all.status_code == 200
    res_after_all = client.get("/api/v1/notifications")
    assert res_after_all.json()["unread_count"] == 0


def test_mark_read_idempotency_and_unknown_ids():
    """Marking already-read or non-existent notification IDs returns safely with updated_count 0."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    random_id = str(uuid.uuid4())
    res = client.post(
        "/api/v1/notifications/mark-read",
        json={"notification_ids": [random_id], "mark_all": False},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "ok"
    assert res.json()["updated_count"] == 0


def test_sync_notifications_endpoint():
    """Reconciles offline pending reads and retrieves updated server records."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    with TestingSessionLocal() as db:
        new_n = Notification(
            id=uuid.uuid4(),
            user_id=user_a_id,
            type="system",
            title_key="notif.offline_ready_title",
            message_key="notif.offline_ready_msg",
            is_read=False,
            created_at=utc_now(),
        )
        db.add(new_n)
        db.commit()
        new_n_id = str(new_n.id)

    res = client.post(
        "/api/v1/notifications/sync",
        json={"pending_read_ids": [new_n_id]},
    )
    assert res.status_code == 200
    data = res.json()
    assert "server_time" in data
    synced_item = [n for n in data["notifications"] if n["id"] == new_n_id][0]
    assert synced_item["is_read"] is True


def test_create_notification_internal_api():
    """Creates a safe notification for the authenticated user and filters sensitive data."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    res = client.post(
        "/api/v1/notifications/create",
        json={
            "type": "tip",
            "title_key": "notif.security_tip_title",
            "message_key": "notif.security_tip_msg",
            "data": {
                "category": "test",
                "password": "leak_attempt_password",
                "user_token": "leak_attempt_token",
                "secret_key": "leak_attempt_secret",
            },
        },
    )
    assert res.status_code == 200
    created = res.json()
    assert created["title_key"] == "notif.security_tip_title"
    assert created["is_read"] is False
    # Ensure sensitive fields were stripped
    assert "password" not in created["data"]
    assert "user_token" not in created["data"]
    assert "secret_key" not in created["data"]
    assert created["data"].get("category") == "test"


def test_invalid_payload_rejected():
    """Request payloads with unexpected/extra fields are rejected with HTTP 400."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    res = client.post(
        "/api/v1/notifications/mark-read",
        json={"mark_all": True, "unauthorized_extra_field": "injected"},
    )
    assert res.status_code == 400


def test_malformed_data_json_handled_safely():
    """Corrupted data_json in database falls back to empty dictionary without raising 500."""
    app.dependency_overrides[get_current_user] = get_current_user_a

    with TestingSessionLocal() as db:
        bad_n = Notification(
            id=uuid.uuid4(),
            user_id=user_a_id,
            type="system",
            title_key="notif.welcome_title",
            data_json="NOT_VALID_JSON{{{",
            is_read=False,
            created_at=utc_now(),
        )
        db.add(bad_n)
        db.commit()

    res = client.get("/api/v1/notifications")
    assert res.status_code == 200
    data = res.json()
    bad_item = [n for n in data["notifications"] if n["id"] == str(bad_n.id)][0]
    assert bad_item["data"] == {}


def test_cascade_delete_removes_notifications():
    """Deleting a user cascade-deletes their associated notifications."""
    with TestingSessionLocal() as db:
        temp_user_id = uuid.uuid4()
        temp_user = User(
            id=temp_user_id,
            email="temp_user@example.com",
            display_name="Temp User",
            password_hash="temp_hash",
            created_at=utc_now(),
        )
        db.add(temp_user)
        db.commit()

        notif = Notification(
            id=uuid.uuid4(),
            user_id=temp_user_id,
            type="system",
            title_key="notif.welcome_title",
            created_at=utc_now(),
        )
        db.add(notif)
        db.commit()
        notif_id = notif.id

        # Verify notif exists
        assert db.query(Notification).filter(Notification.id == notif_id).count() == 1

        # Delete user
        db.delete(temp_user)
        db.commit()

        # Verify notification was cascade deleted
        assert db.query(Notification).filter(Notification.id == notif_id).count() == 0
