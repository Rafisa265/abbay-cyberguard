import json
import uuid
from datetime import datetime, timezone
import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.auth import get_current_user
from app.models import User, LearningProgress, UserPreference, utc_now

# Fully isolated in-memory SQLite database for safe, non-destructive testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,
)

Base.metadata.create_all(bind=engine)


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

user_1_id = uuid.uuid4()
user_2_id = uuid.uuid4()

with TestingSessionLocal() as db:
    u1 = User(
        id=user_1_id,
        email="challenger_1@example.com",
        display_name="Challenger One",
        password_hash="mock_hash_1",
        created_at=utc_now(),
    )
    pref1 = UserPreference(
        user_id=user_1_id,
        preferred_language="en",
        cloud_progress_sync_enabled=True,
    )
    u2 = User(
        id=user_2_id,
        email="challenger_2@example.com",
        display_name="Challenger Two",
        password_hash="mock_hash_2",
        created_at=utc_now(),
    )
    pref2 = UserPreference(
        user_id=user_2_id,
        preferred_language="en",
        cloud_progress_sync_enabled=True,
    )
    db.add(u1)
    db.add(pref1)
    db.add(u2)
    db.add(pref2)
    db.commit()


def get_current_user_1(db: Session = Depends(override_get_db)) -> User:
    return db.query(User).filter(User.id == user_1_id).first()


def get_current_user_2(db: Session = Depends(override_get_db)) -> User:
    return db.query(User).filter(User.id == user_2_id).first()


def test_daily_challenge_today_deterministic():
    """Daily challenge returns valid, deterministic challenge metadata for a given date."""
    app.dependency_overrides[get_current_user] = get_current_user_1

    res = client.get("/api/v1/daily/today?date=2026-10-22")
    assert res.status_code == 200
    data = res.json()
    assert data["date"] == "2026-10-22"
    assert "id" in data
    assert "topic" in data
    assert "options_keys" in data
    assert len(data["options_keys"]) == 3
    assert data["xp_reward"] == 50
    assert data["completed"] is False


def test_unauthenticated_daily_submit_rejected():
    """Unauthenticated users cannot submit server daily challenge completions."""
    app.dependency_overrides.pop(get_current_user, None)
    res = client.post(
        "/api/v1/daily/submit",
        json={"date": "2026-10-22", "choice": 1},
    )
    assert res.status_code == 401


def test_daily_submit_and_anti_duplicate_xp():
    """Submitting daily challenge awards XP once and strictly prevents duplicate XP."""
    app.dependency_overrides[get_current_user] = get_current_user_1
    test_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. First submission (correct answer: 1)
    res1 = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 1},
    )
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["is_correct"] is True
    assert data1["xp_awarded"] == 50
    assert data1["already_completed"] is False
    assert data1["badge_awarded"] == "badge_daily_defender"

    # 2. Second submission for same date (anti-duplicate check)
    res2 = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 1},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["already_completed"] is True
    assert data2["xp_awarded"] == 0  # Duplicate XP strictly prevented!
    assert data2["badge_awarded"] is None

    # 3. Verify get_today reflects completed status
    res_today = client.get(f"/api/v1/daily/today?date={test_date}")
    assert res_today.status_code == 200
    today_data = res_today.json()
    assert today_data["completed"] is True
    assert today_data["chosen_choice"] == 1
    assert today_data["is_correct"] is True


def test_cross_user_daily_isolation():
    """User 2 is not affected by User 1's daily challenge completion."""
    app.dependency_overrides[get_current_user] = get_current_user_2
    test_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # User 2 has not completed current date
    res_u2 = client.get(f"/api/v1/daily/today?date={test_date}")
    assert res_u2.status_code == 200
    assert res_u2.json()["completed"] is False

    # User 2 completes with incorrect choice 0
    res_submit = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 0},
    )
    assert res_submit.status_code == 200
    assert res_submit.json()["is_correct"] is False
    assert res_submit.json()["xp_awarded"] == 0
    assert res_submit.json()["already_completed"] is False


def test_unified_progress_module_filtering():
    """Auth progress endpoint supports module_or_level filtering for m5 and daily_challenge."""
    app.dependency_overrides[get_current_user] = get_current_user_1
    test_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Fetch daily_challenge progress
    res_daily_prog = client.get("/api/v1/auth/progress?module_or_level=daily_challenge")
    assert res_daily_prog.status_code == 200
    data = res_daily_prog.json()
    assert data["sync_enabled"] is True
    assert data["progress"] is not None
    assert data["progress"]["module_or_level"] == "daily_challenge"
    assert test_date in data["progress"]["completed_levels"]


def test_out_of_window_date_rejected():
    """Future or past dates outside the +/- 1 day boundary are rejected to prevent arbitrary XP farming."""
    app.dependency_overrides[get_current_user] = get_current_user_1

    # Far future date
    res_future = client.post(
        "/api/v1/daily/submit",
        json={"date": "2027-01-01", "choice": 1},
    )
    assert res_future.status_code == 400
    assert res_future.json()["error"]["code"] == "INVALID_REQUEST"

    # Far past date
    res_past = client.post(
        "/api/v1/daily/submit",
        json={"date": "2024-01-01", "choice": 1},
    )
    assert res_past.status_code == 400
    assert res_past.json()["error"]["code"] == "INVALID_REQUEST"


def test_incorrect_choice_allows_subsequent_retry():
    """An incorrect submission does not permanently lock the user out from retrying and completing."""
    user_3_id = uuid.uuid4()
    with TestingSessionLocal() as db:
        u3 = User(
            id=user_3_id,
            email="challenger_3@example.com",
            display_name="Challenger Three",
            password_hash="mock_hash_3",
            created_at=utc_now(),
        )
        db.add(u3)
        db.commit()

    def get_user_3(db: Session = Depends(override_get_db)) -> User:
        return db.query(User).filter(User.id == user_3_id).first()

    app.dependency_overrides[get_current_user] = get_user_3
    test_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # 1. Submit incorrect choice
    res_wrong = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 0},
    )
    assert res_wrong.status_code == 200
    data_wrong = res_wrong.json()
    assert data_wrong["is_correct"] is False
    assert data_wrong["xp_awarded"] == 0
    assert data_wrong["already_completed"] is False

    # 2. Retry with correct choice
    res_correct = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 1},
    )
    assert res_correct.status_code == 200
    data_correct = res_correct.json()
    assert data_correct["is_correct"] is True
    assert data_correct["xp_awarded"] == 50
    assert data_correct["already_completed"] is False

    # 3. Subsequent submit blocked from duplicate XP
    res_dup = client.post(
        "/api/v1/daily/submit",
        json={"date": test_date, "choice": 1},
    )
    assert res_dup.status_code == 200
    data_dup = res_dup.json()
    assert data_dup["already_completed"] is True
    assert data_dup["xp_awarded"] == 0

