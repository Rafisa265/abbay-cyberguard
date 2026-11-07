import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import auth, database, main, models


@pytest.fixture
def academy_context():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(dbapi_connection, _):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    models.Base.metadata.create_all(bind=engine)
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = session_local()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[database.get_db] = override_get_db
    auth.auth_rate_limiter._records.clear()
    with TestClient(main.app, base_url="http://127.0.0.1:8000") as client:
        yield client, session_local
    main.app.dependency_overrides.clear()
    models.Base.metadata.drop_all(bind=engine)
    engine.dispose()


def register(client, name, email):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "display_name": name,
            "email": email,
            "password": "SecurePassword123!",
            "confirm_password": "SecurePassword123!",
        },
    )
    assert response.status_code == 201
    return response.cookies.get(auth.COOKIE_NAME)


def submit_attempt(client, session_local, attempt, wrong_count=0):
    with session_local() as db:
        stored = db.query(models.AcademyQuizAttempt).filter_by(
            id=attempt["attempt_id"]
        ).one()
        questions = json.loads(stored.question_data)
        answers = {}
        for index, question in enumerate(questions):
            answer = question["correct_option_id"]
            if index < wrong_count:
                answer = next(
                    option["id"] for option in question["options"]
                    if option["id"] != answer
                )
            answers[question["id"]] = answer
    return client.post(
        f"/api/v1/academy/levels/attempts/{attempt['attempt_id']}/submit",
        json={"answers": answers},
    )


def complete_levels(client, session_local, final_level=6):
    for level in range(1, final_level + 1):
        start = client.post("/api/v1/academy/levels/attempts", json={"level_num": level})
        assert start.status_code == 200, start.text
        response = submit_attempt(client, session_local, start.json())
        assert response.status_code == 200, response.text
        assert response.json()["passed"] is True


def test_unauthorized_and_fabricated_progress_cannot_complete_or_issue(academy_context):
    client, session_local = academy_context
    payload = {"level_num": 1, "recipient_name": "Abebe Bikila", "language": "en"}
    assert client.post("/api/v1/academy/levels/attempts", json={"level_num": 1}).status_code == 401
    assert client.post("/api/v1/academy/certificates", json=payload).status_code == 401

    register(client, "Abebe Bikila", "abebe@example.com")
    with session_local() as db:
        user = db.query(models.User).filter_by(email="abebe@example.com").one()
        db.add(models.AcademyLevelCompletion(
            user_id=user.id,
            level_num=1,
            score=100,
            correct_count=5,
            total_count=5,
            completed_at=datetime.now(timezone.utc),
        ))
        db.commit()
    fabricated = client.post(
        "/api/v1/academy/levels/complete",
        json={"level_num": 1, "answers": {"q1": 1, "q2": 1}},
    )
    assert fabricated.status_code == 410
    assert fabricated.json()["error"]["code"] == "ASSESSMENT_ATTEMPT_REQUIRED"
    for topic in ["phishing", "password", "privacy", "response", "website"]:
        for section in ["overview", "how", "examples", "warnings", "actions", "recap"]:
            section_result = client.post(
                "/api/v1/academy/lessons/section",
                json={"topic": topic, "section": section},
            )
            assert section_result.status_code == 200
            assert section_result.json()["self_reported"] is True
            assert section_result.json()["verified_for_certification"] is False
    status = client.get("/api/v1/academy/certificates").json()
    assert len(status["self_reported_lessons"]) == 5
    assert status["lesson_progress_verified"] is False
    assert status["verified_levels"] == []
    assert status["eligible_levels"] == []
    assert client.post("/api/v1/academy/certificates", json=payload).status_code == 409


def test_attempt_does_not_leak_answers_validates_shape_and_prevents_replay(academy_context):
    client, session_local = academy_context
    register(client, "Abebe Bikila", "abebe@example.com")

    attempt = client.post("/api/v1/academy/levels/attempts", json={"level_num": 1}).json()
    assert len(attempt["questions"]) == 5
    assert all("correct_option_id" not in question for question in attempt["questions"])
    assert all("correct" not in option for question in attempt["questions"] for option in question["options"])

    bad_shape = client.post(
        f"/api/v1/academy/levels/attempts/{attempt['attempt_id']}/submit",
        json={"answers": {"fabricated": "answer"}},
    )
    assert bad_shape.status_code == 400
    assert bad_shape.json()["error"]["code"] == "INVALID_ATTEMPT_ANSWERS"

    passed = submit_attempt(client, session_local, attempt, wrong_count=1)
    assert passed.status_code == 200
    assert passed.json()["passed"] is True
    assert passed.json()["score"] == 80
    replay = submit_attempt(client, session_local, attempt)
    assert replay.status_code == 409
    assert replay.json()["error"]["code"] == "ATTEMPT_ALREADY_SUBMITTED"
    duplicate = client.post("/api/v1/academy/levels/attempts", json={"level_num": 1})
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "LEVEL_ALREADY_VERIFIED"


def test_failed_attempt_does_not_unlock_progress_and_attempt_limit_is_enforced(academy_context):
    client, session_local = academy_context
    register(client, "Abebe Bikila", "abebe@example.com")
    first_attempt = None
    for attempt_number in range(5):
        started = client.post("/api/v1/academy/levels/attempts", json={"level_num": 1})
        assert started.status_code == 200
        first_attempt = first_attempt or started.json()
        with session_local() as db:
            stored = db.query(models.AcademyQuizAttempt).filter_by(
                id=started.json()["attempt_id"]
            ).one()
            questions = json.loads(stored.question_data)
            answers = {
                question["id"]: next(
                    option["id"] for option in question["options"]
                    if option["id"] != question["correct_option_id"]
                )
                for question in questions
            }
        failed = client.post(
            f"/api/v1/academy/levels/attempts/{started.json()['attempt_id']}/submit",
            json={"answers": answers},
        )
        assert failed.status_code == 200
        assert failed.json()["passed"] is False
        assert failed.json()["status"] == "failed"
    limited = client.post("/api/v1/academy/levels/attempts", json={"level_num": 1})
    assert limited.status_code == 429
    assert client.get("/api/v1/academy/certificates").json()["verified_levels"] == []
    with session_local() as db:
        stored = db.query(models.AcademyQuizAttempt).filter_by(
            id=first_attempt["attempt_id"]
        ).one()
        questions = json.loads(stored.question_data)
        replay_answers = {
            question["id"]: question["options"][0]["id"] for question in questions
        }
    assert client.post(
        f"/api/v1/academy/levels/attempts/{first_attempt['attempt_id']}/submit",
        json={"answers": replay_answers},
    ).status_code == 409


def test_attempts_are_owned_by_the_authenticated_user(academy_context):
    client, _ = academy_context
    owner_cookie = register(client, "Abebe Bikila", "abebe@example.com")
    started = client.post("/api/v1/academy/levels/attempts", json={"level_num": 1})
    other_cookie = register(client, "Other Learner", "other@example.com")
    response = client.post(
        f"/api/v1/academy/levels/attempts/{started.json()['attempt_id']}/submit",
        json={"answers": {"question": "option"}},
        headers={"Cookie": f"{auth.COOKIE_NAME}={other_cookie}"},
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ATTEMPT_NOT_FOUND"
    assert owner_cookie


def test_certificate_requires_verified_milestones_and_preserves_privacy_and_download(academy_context):
    client, session_local = academy_context
    owner_cookie = register(client, "Abebe Bikila", "abebe@example.com")

    complete_levels(client, session_local, final_level=2)
    status = client.get("/api/v1/academy/certificates").json()
    assert status["verified_levels"] == [1, 2]
    assert status["eligible_levels"] == [1]
    incomplete = client.post(
        "/api/v1/academy/certificates",
        json={"level_num": 3, "recipient_name": "Abebe Bikila", "language": "en"},
    )
    assert incomplete.status_code == 409
    assert incomplete.json()["error"]["code"] == "CERTIFICATE_REQUIREMENTS_INCOMPLETE"

    started = client.post("/api/v1/academy/levels/attempts", json={"level_num": 3})
    assert started.status_code == 200
    assert submit_attempt(client, session_local, started.json()).status_code == 200
    status = client.get("/api/v1/academy/certificates").json()
    assert status["verified_levels"] == [1, 2, 3]
    assert status["eligible_levels"] == [1, 3]

    certificate_response = client.post(
        "/api/v1/academy/certificates",
        json={"level_num": 1, "recipient_name": "Abebe Bikila", "language": "en"},
        headers={"Cookie": f"{auth.COOKIE_NAME}={owner_cookie}"},
    )
    assert certificate_response.status_code == 200
    certificate = certificate_response.json()
    assert "assessment milestone" in certificate["course_title"].lower()

    duplicate = client.post(
        "/api/v1/academy/certificates",
        json={"level_num": 1, "recipient_name": "Different Name", "language": "en"},
        headers={"Cookie": f"{auth.COOKIE_NAME}={owner_cookie}"},
    )
    assert duplicate.json()["certificate_id"] == certificate["certificate_id"]
    owner_download = client.get(
        f"/api/v1/academy/certificates/{certificate['certificate_id']}",
        headers={"Cookie": f"{auth.COOKIE_NAME}={owner_cookie}"},
    )
    assert owner_download.status_code == 200
    other_cookie = register(client, "New Learner", "new@example.com")
    other_download = client.get(
        f"/api/v1/academy/certificates/{certificate['certificate_id']}",
        headers={"Cookie": f"{auth.COOKIE_NAME}={other_cookie}"},
    )
    assert other_download.status_code == 404
    public = client.get(
        f"/api/v1/academy/certificates/verify/{certificate['certificate_id']}"
    )
    assert public.status_code == 200
    assert "recipient_name" not in public.json()
    assert "email" not in public.json()
    assert "user_id" not in public.json()


@pytest.mark.parametrize("recipient_name", ["", "Abebe", "   "])
def test_certificate_requires_confirmable_full_name(academy_context, recipient_name):
    client, session_local = academy_context
    register(client, "Abebe Bikila", "abebe@example.com")
    complete_levels(client, session_local, final_level=1)
    response = client.post(
        "/api/v1/academy/certificates",
        json={"level_num": 1, "recipient_name": recipient_name},
    )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_invalid_or_unknown_public_certificate_does_not_verify(academy_context):
    client, _ = academy_context
    missing = client.get(
        "/api/v1/academy/certificates/verify/ACYBER-2026-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    )
    malformed = client.get("/api/v1/academy/certificates/verify/not-a-certificate")
    assert missing.status_code == 404
    assert malformed.status_code == 404
