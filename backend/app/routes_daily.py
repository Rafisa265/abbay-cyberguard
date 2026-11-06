import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.exc import DBAPIError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from .auth import get_current_user
from .daily_challenge_data import DAILY_CHALLENGES, get_daily_challenge_for_date
from .database import get_db
from .models import LearningProgress, Notification, User, utc_now
from .schemas import DailyChallengePublic, DailySubmitRequest, DailySubmitResponse

log = logging.getLogger("cybershield.daily")

router = APIRouter(prefix="/api/v1/daily", tags=["daily_challenge"], include_in_schema=False)


def _get_daily_progress_record(db: Session, user_id: uuid.UUID) -> Optional[LearningProgress]:
    """Retrieve or None the LearningProgress record for daily_challenge."""
    try:
        return (
            db.query(LearningProgress)
            .filter(
                LearningProgress.user_id == user_id,
                LearningProgress.module_or_level == "daily_challenge",
            )
            .first()
        )
    except (ProgrammingError, OperationalError):
        return None


@router.get("/today", response_model=DailyChallengePublic, summary="Get today's daily challenge")
def get_today_challenge(
    date: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve the deterministic daily challenge for the specified or current date."""
    now_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    raw = get_daily_challenge_for_date(now_date)

    resp = DailyChallengePublic(
        id=raw["id"],
        date=now_date,
        topic=raw["topic"],
        xp_reward=raw["xp_reward"],
        scenario_key=raw["scenario_key"],
        question_key=raw["question_key"],
        options_keys=raw["options_keys"],
        completed=False,
    )

    if user:
        record = _get_daily_progress_record(db, user.id)
        if record and record.completed_levels:
            try:
                completed_map = json.loads(record.completed_levels)
                if now_date in completed_map:
                    day_info = completed_map[now_date]
                    resp.completed = True
                    resp.chosen_choice = day_info.get("chosen_choice")
                    resp.is_correct = day_info.get("is_correct", False)
                    resp.explanation_key = raw["explanation_key"]
            except Exception:
                pass

    return resp


@router.post("/submit", response_model=DailySubmitResponse, summary="Submit daily challenge answer idempotently")
def submit_daily_challenge(
    body: DailySubmitRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluate and store daily challenge answer with strict anti-duplicate XP enforcement and row locking."""
    # 1. Date window security check: reject arbitrary future or past dates
    today_utc = datetime.now(timezone.utc).date()
    try:
        sub_date = datetime.strptime(body.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST")

    # Grace period: allow today, yesterday, or tomorrow (UTC timezone boundary tolerance)
    if abs((sub_date - today_utc).days) > 1:
        raise HTTPException(status_code=400, detail="INVALID_REQUEST")

    challenge = get_daily_challenge_for_date(body.date)
    is_correct = body.choice == challenge["correct_choice"]

    # 2. If incorrect, return immediately with explanation, 0 XP, and allow retry
    if not is_correct:
        return DailySubmitResponse(
            is_correct=False,
            correct_choice=challenge["correct_choice"],
            explanation_key=challenge["explanation_key"],
            xp_awarded=0,
            already_completed=False,
            badge_awarded=None,
        )

    # 3. For correct answer, serialize concurrent requests with row-level lock
    now = utc_now()
    now_iso = now.isoformat()
    xp_to_award = challenge["xp_reward"]
    badge_awarded = None

    try:
        record = (
            db.query(LearningProgress)
            .filter(
                LearningProgress.user_id == user.id,
                LearningProgress.module_or_level == "daily_challenge",
            )
            .with_for_update()
            .first()
        )

        completed_map = {}
        if record and record.completed_levels:
            try:
                completed_map = json.loads(record.completed_levels)
            except Exception:
                completed_map = {}

        # Idempotency check: already recorded as correct
        if body.date in completed_map and completed_map[body.date].get("is_correct"):
            return DailySubmitResponse(
                is_correct=True,
                correct_choice=challenge["correct_choice"],
                explanation_key=challenge["explanation_key"],
                xp_awarded=0,  # Zero duplicate XP
                already_completed=True,
                badge_awarded=None,
            )

        # Record this successful completion
        completed_map[body.date] = {
            "chosen_choice": body.choice,
            "is_correct": True,
            "score": 1,
            "completed_at": now_iso,
            "xp_awarded": xp_to_award,
        }

        correct_count = sum(1 for d in completed_map.values() if d.get("is_correct"))
        if correct_count == 1:
            badge_awarded = "badge_daily_defender"
        elif correct_count >= 3:
            badge_awarded = "badge_daily_streak_3"

        if not record:
            record = LearningProgress(
                id=uuid.uuid4(),
                user_id=user.id,
                module_or_level="daily_challenge",
                active_level=len(completed_map),
                unlocked_levels="[1]",
                completed_levels=json.dumps(completed_map),
                updated_at=now,
            )
            db.add(record)
        else:
            record.active_level = len(completed_map)
            record.completed_levels = json.dumps(completed_map)
            record.updated_at = now

        db.commit()
    except DBAPIError as exc:
        db.rollback()
        # Handle concurrent insert race condition gracefully
        record = (
            db.query(LearningProgress)
            .filter(
                LearningProgress.user_id == user.id,
                LearningProgress.module_or_level == "daily_challenge",
            )
            .first()
        )
        if record and record.completed_levels:
            try:
                completed_map = json.loads(record.completed_levels)
                if body.date in completed_map:
                    return DailySubmitResponse(
                        is_correct=True,
                        correct_choice=challenge["correct_choice"],
                        explanation_key=challenge["explanation_key"],
                        xp_awarded=0,
                        already_completed=True,
                        badge_awarded=None,
                    )
            except Exception:
                pass
        log.error("event=daily_challenge_concurrent_save_failed error=%s", str(exc))
        raise HTTPException(status_code=500, detail="Failed to record challenge completion")
    except Exception as exc:
        db.rollback()
        log.error("event=daily_challenge_save_failed error=%s", str(exc))
        raise HTTPException(status_code=500, detail="Failed to record challenge completion")

    # Send Notification to user (try/except safe if table is unmigrated)
    try:
        notif_completed = Notification(
            id=uuid.uuid4(),
            user_id=user.id,
            type="challenge",
            title_key="notif.daily_completed_title",
            message_key="notif.daily_completed_msg",
            data_json=json.dumps({"date": body.date, "xp": xp_to_award}),
            is_read=False,
            created_at=now,
        )
        db.add(notif_completed)

        if badge_awarded:
            notif_badge = Notification(
                id=uuid.uuid4(),
                user_id=user.id,
                type="progress",
                title_key="notif.badge_earned_title",
                message_key="notif.badge_earned_msg",
                data_json=json.dumps({"badge_id": badge_awarded}),
                is_read=False,
                created_at=now,
            )
            db.add(notif_badge)

        db.commit()
    except Exception:
        db.rollback()

    return DailySubmitResponse(
        is_correct=is_correct,
        correct_choice=challenge["correct_choice"],
        explanation_key=challenge["explanation_key"],
        xp_awarded=xp_to_award,
        already_completed=False,
        badge_awarded=badge_awarded,
    )
