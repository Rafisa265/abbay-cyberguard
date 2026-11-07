import json
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import academy_assessment, models
from .auth import get_current_user
from .database import get_db

router = APIRouter(prefix="/api/v1/academy", tags=["academy"])

LESSON_TOPICS = {"phishing", "password", "privacy", "response", "website"}
LESSON_SECTIONS = {"overview", "how", "examples", "warnings", "actions", "recap"}
CERTIFICATE_TITLES = {
    1: {
        "en": "Level 1: Beginner — Cybersecurity Assessment Milestone",
        "om": "Sadarkaa 1: Jalqabaa — Madaallii Nageenya Saayibarii",
        "am": "ደረጃ 1፡ ጀማሪ — የሳይበር ደህንነት ግምገማ",
    },
    3: {
        "en": "Level 3: Intermediate — Cybersecurity Assessment Milestone",
        "om": "Sadarkaa 3: Giddu-galeessaa — Madaallii Nageenya Saayibarii",
        "am": "ደረጃ 3፡ መካከለኛ — የሳይበር ደህንነት ግምገማ",
    },
    6: {
        "en": "Level 6: Strategic Cyber Defense — Assessment Milestone",
        "om": "Sadarkaa 6: Ittisa Saayibarii Tarsiimoo — Madaallii",
        "am": "ደረጃ 6፡ ስትራቴጂያዊ የሳይበር መከላከያ — ግምገማ",
    },
}


class LessonSectionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    topic: str = Field(min_length=1, max_length=32)
    section: str = Field(min_length=1, max_length=16)


class QuizAttemptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level_num: int = Field(ge=1, le=6)


class QuizAttemptSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answers: Dict[StrictStr, StrictStr] = Field(min_length=1, max_length=10)


class CertificateIssueRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level_num: int
    recipient_name: str = Field(min_length=1, max_length=200)
    language: str = Field(default="en", pattern="^(en|om|am)$")

    @field_validator("recipient_name")
    @classmethod
    def validate_recipient_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized.split()) < 2:
            raise ValueError("Enter the learner's full name.")
        return normalized


def _certificate_data(certificate: models.AcademyCertificate) -> dict:
    return {
        "certificate_id": certificate.certificate_id,
        "level_num": certificate.level_num,
        "recipient_name": certificate.recipient_name,
        "course_title": certificate.course_title,
        "issued_at": certificate.issued_at,
        "status": certificate.status,
        "issuer": "ABBAY CYBERGUARD Academy",
    }


def _get_lesson_progress(db: Session, user_id) -> dict:
    rows = db.query(models.AcademyLessonProgress).filter_by(user_id=user_id).all()
    result = {}
    for row in rows:
        try:
            sections = json.loads(row.completed_sections)
        except (TypeError, json.JSONDecodeError):
            sections = []
        result[row.topic_key] = {
            "completed_sections": sections,
            "completed": LESSON_SECTIONS.issubset(set(sections)),
        }
    return result


def _get_level_progress(db: Session, user_id) -> dict:
    rows = (
        db.query(models.AcademyLevelCompletion)
        .join(
            models.AcademyQuizAttempt,
            models.AcademyLevelCompletion.assessment_attempt_id == models.AcademyQuizAttempt.id,
        )
        .filter(
            models.AcademyLevelCompletion.user_id == user_id,
            models.AcademyQuizAttempt.user_id == user_id,
            models.AcademyQuizAttempt.status == "passed",
            models.AcademyQuizAttempt.level_num == models.AcademyLevelCompletion.level_num,
        )
        .all()
    )
    return {
        row.level_num: {
            "score": row.score,
            "correct_count": row.correct_count,
            "total_count": row.total_count,
            "completed_at": row.completed_at,
        }
        for row in rows
    }


def _requirements(db: Session, user_id) -> dict:
    lessons = _get_lesson_progress(db, user_id)
    levels = _get_level_progress(db, user_id)
    completed_lessons = sorted(topic for topic, data in lessons.items() if data["completed"])
    verified_levels = sorted(levels)
    eligible_levels = [
        level
        for level in (1, 3, 6)
        if all(required in levels for required in range(1, level + 1))
    ]
    return {
        "completed_lessons": completed_lessons,
        "self_reported_lessons": completed_lessons,
        "lesson_progress_verified": False,
        "verified_levels": verified_levels,
        "eligible_levels": eligible_levels,
        "required_lessons": sorted(LESSON_TOPICS),
    }


@router.post("/lessons/section")
def record_lesson_section(
    body: LessonSectionRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.topic not in LESSON_TOPICS or body.section not in LESSON_SECTIONS:
        return JSONResponse({"error": {"code": "INVALID_LESSON_SECTION"}}, status_code=400)

    progress = (
        db.query(models.AcademyLessonProgress)
        .filter_by(user_id=current_user.id, topic_key=body.topic)
        .first()
    )
    if progress is None:
        progress = models.AcademyLessonProgress(
            user_id=current_user.id,
            topic_key=body.topic,
            completed_sections="[]",
        )
        db.add(progress)

    try:
        completed = set(json.loads(progress.completed_sections))
    except (TypeError, json.JSONDecodeError):
        completed = set()
    completed.add(body.section)
    progress.completed_sections = json.dumps(sorted(completed))
    if LESSON_SECTIONS.issubset(completed) and progress.completed_at is None:
        progress.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "topic": body.topic,
        "completed": LESSON_SECTIONS.issubset(completed),
        "completed_sections": sorted(completed),
        "self_reported": True,
        "verified_for_certification": False,
    }


def _attempt_response(attempt: models.AcademyQuizAttempt) -> dict:
    question_data = json.loads(attempt.question_data)
    return {
        "attempt_id": str(attempt.id),
        "level_num": attempt.level_num,
        "status": attempt.status,
        "expires_at": attempt.expires_at,
        "questions": [
            {
                "id": question["id"],
                "prompt": question["prompt"],
                "options": question["options"],
            }
            for question in question_data
        ],
    }


@router.post("/levels/attempts")
def start_level_attempt(
    body: QuizAttemptRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    completion = (
        db.query(models.AcademyLevelCompletion)
        .filter_by(user_id=current_user.id, level_num=body.level_num)
        .filter(models.AcademyLevelCompletion.assessment_attempt_id.isnot(None))
        .first()
    )
    if completion:
        return JSONResponse({"error": {"code": "LEVEL_ALREADY_VERIFIED"}}, status_code=409)

    levels = _get_level_progress(db, current_user.id)
    missing_prerequisites = [level for level in range(1, body.level_num) if level not in levels]
    if missing_prerequisites:
        return JSONResponse(
            {
                "error": {
                    "code": "LEVEL_PREREQUISITES_INCOMPLETE",
                    "missing_levels": missing_prerequisites,
                }
            },
            status_code=409,
        )

    now = datetime.now(timezone.utc)
    active = (
        db.query(models.AcademyQuizAttempt)
        .filter_by(user_id=current_user.id, level_num=body.level_num, status="in_progress")
        .order_by(models.AcademyQuizAttempt.created_at.desc())
        .first()
    )
    if active:
        expires_at = active.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at > now:
            return _attempt_response(active)
        active.status = "expired"
        db.commit()

    window_start = now - timedelta(hours=24)
    attempts_today = (
        db.query(models.AcademyQuizAttempt)
        .filter(
            models.AcademyQuizAttempt.user_id == current_user.id,
            models.AcademyQuizAttempt.level_num == body.level_num,
            models.AcademyQuizAttempt.created_at >= window_start,
        )
        .count()
    )
    if attempts_today >= academy_assessment.ATTEMPT_LIMIT_PER_DAY:
        return JSONResponse(
            {"error": {"code": "ATTEMPT_LIMIT_REACHED"}},
            status_code=429,
        )

    question_data = academy_assessment.build_attempt_questions(body.level_num)
    attempt = models.AcademyQuizAttempt(
        user_id=current_user.id,
        level_num=body.level_num,
        question_data=json.dumps(question_data),
        total_count=len(question_data),
        created_at=now,
        expires_at=now + timedelta(minutes=academy_assessment.ATTEMPT_LIFETIME_MINUTES),
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        active = (
            db.query(models.AcademyQuizAttempt)
            .filter_by(user_id=current_user.id, level_num=body.level_num, status="in_progress")
            .first()
        )
        if active:
            return _attempt_response(active)
        raise
    db.refresh(attempt)
    return _attempt_response(attempt)


@router.post("/levels/attempts/{attempt_id}/submit")
def submit_level_attempt(
    attempt_id: uuid.UUID,
    body: QuizAttemptSubmission,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    attempt = (
        db.query(models.AcademyQuizAttempt)
        .filter_by(id=attempt_id, user_id=current_user.id)
        .first()
    )
    if attempt is None:
        return JSONResponse({"error": {"code": "ATTEMPT_NOT_FOUND"}}, status_code=404)
    if attempt.status != "in_progress":
        return JSONResponse({"error": {"code": "ATTEMPT_ALREADY_SUBMITTED"}}, status_code=409)
    expires_at = attempt.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        attempt.status = "expired"
        db.commit()
        return JSONResponse({"error": {"code": "ATTEMPT_EXPIRED"}}, status_code=410)

    question_data = json.loads(attempt.question_data)
    expected_ids = {question["id"] for question in question_data}
    if set(body.answers) != expected_ids:
        return JSONResponse({"error": {"code": "INVALID_ATTEMPT_ANSWERS"}}, status_code=400)
    for question in question_data:
        allowed_options = {option["id"] for option in question["options"]}
        if body.answers[question["id"]] not in allowed_options:
            return JSONResponse({"error": {"code": "INVALID_ATTEMPT_ANSWERS"}}, status_code=400)

    correct = sum(
        body.answers[question["id"]] == question["correct_option_id"]
        for question in question_data
    )
    total = len(question_data)
    score = round(correct * 100 / total)
    attempt.status = "passed" if score >= academy_assessment.PASS_THRESHOLD else "failed"
    attempt.score = score
    attempt.correct_count = correct
    attempt.submitted_at = datetime.now(timezone.utc)
    if attempt.status == "passed":
        completion = models.AcademyLevelCompletion(
            user_id=current_user.id,
            level_num=attempt.level_num,
            score=score,
            correct_count=correct,
            total_count=total,
            completed_at=attempt.submitted_at,
            assessment_attempt_id=attempt.id,
        )
        db.add(completion)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return JSONResponse({"error": {"code": "LEVEL_ALREADY_VERIFIED"}}, status_code=409)
    return {
        "attempt_id": str(attempt.id),
        "level_num": attempt.level_num,
        "status": attempt.status,
        "passed": attempt.status == "passed",
        "score": score,
        "required_score": academy_assessment.PASS_THRESHOLD,
    }


@router.post("/levels/complete")
def retired_level_completion(
    current_user: models.User = Depends(get_current_user),
):
    return JSONResponse({"error": {"code": "ASSESSMENT_ATTEMPT_REQUIRED"}}, status_code=410)


@router.get("/certificates")
def list_certificates(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    certificates = (
        db.query(models.AcademyCertificate)
        .filter_by(user_id=current_user.id)
        .order_by(models.AcademyCertificate.issued_at.desc())
        .all()
    )
    return {
        **_requirements(db, current_user.id),
        "certificates": [_certificate_data(certificate) for certificate in certificates],
    }


@router.post("/certificates")
def issue_certificate(
    body: CertificateIssueRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.level_num not in CERTIFICATE_TITLES:
        return JSONResponse({"error": {"code": "CERTIFICATE_NOT_AVAILABLE"}}, status_code=400)

    existing = (
        db.query(models.AcademyCertificate)
        .filter_by(user_id=current_user.id, level_num=body.level_num)
        .first()
    )
    if existing:
        return _certificate_data(existing)

    requirements = _requirements(db, current_user.id)
    if body.level_num not in requirements["eligible_levels"]:
        return JSONResponse(
            {
                "error": {
                    "code": "CERTIFICATE_REQUIREMENTS_INCOMPLETE",
                    "missing_lessons": [],
                    "missing_levels": [
                        level for level in range(1, body.level_num + 1)
                        if level not in requirements["verified_levels"]
                    ],
                }
            },
            status_code=409,
        )

    certificate = models.AcademyCertificate(
        user_id=current_user.id,
        certificate_id=f"ACYBER-{datetime.now(timezone.utc).year}-{uuid.uuid4().hex.upper()}",
        level_num=body.level_num,
        recipient_name=body.recipient_name,
        course_title=CERTIFICATE_TITLES[body.level_num][body.language],
        issued_at=datetime.now(timezone.utc),
        status="issued",
    )
    db.add(certificate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(models.AcademyCertificate)
            .filter_by(user_id=current_user.id, level_num=body.level_num)
            .first()
        )
        if existing:
            return _certificate_data(existing)
        raise
    db.refresh(certificate)
    return _certificate_data(certificate)


@router.get("/certificates/verify/{certificate_id}")
def verify_certificate(certificate_id: str, db: Session = Depends(get_db)):
    if not re.fullmatch(r"ACYBER-[0-9]{4}-[A-F0-9]{32}", certificate_id):
        return JSONResponse({"error": {"code": "CERTIFICATE_NOT_FOUND"}}, status_code=404)
    certificate = (
        db.query(models.AcademyCertificate)
        .filter_by(certificate_id=certificate_id)
        .first()
    )
    if certificate is None:
        return JSONResponse({"error": {"code": "CERTIFICATE_NOT_FOUND"}}, status_code=404)
    return {
        "certificate_id": certificate.certificate_id,
        "course_title": certificate.course_title,
        "level_num": certificate.level_num,
        "issued_at": certificate.issued_at,
        "status": certificate.status,
        "issuer": "ABBAY CYBERGUARD Academy",
    }


@router.get("/certificates/{certificate_id}")
def get_certificate_for_owner(
    certificate_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    certificate = (
        db.query(models.AcademyCertificate)
        .filter_by(certificate_id=certificate_id, user_id=current_user.id)
        .first()
    )
    if certificate is None:
        return JSONResponse({"error": {"code": "CERTIFICATE_NOT_FOUND"}}, status_code=404)
    return _certificate_data(certificate)
