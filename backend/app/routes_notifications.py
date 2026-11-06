import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.exc import DBAPIError, OperationalError, ProgrammingError
from sqlalchemy.orm import Session

from .auth import get_current_user
from .database import get_db
from .models import Notification, User, utc_now
from .schemas import (
    CreateNotificationRequest,
    MarkReadRequest,
    NotificationListResponse,
    NotificationResponse,
    SyncNotificationsRequest,
)

log = logging.getLogger("cybershield.notifications")

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"], include_in_schema=False)


def _parse_notification(n: Notification) -> NotificationResponse:
    data = {}
    if n.data_json:
        try:
            data = json.loads(n.data_json)
        except Exception:
            data = {}
    return NotificationResponse(
        id=str(n.id),
        type=n.type,
        title_key=n.title_key,
        message_key=n.message_key,
        data=data,
        is_read=n.is_read,
        created_at=n.created_at,
        read_at=n.read_at,
    )


def _seed_initial_notifications_if_empty(db: Session, user: User) -> None:
    """Idempotently seed welcome notification and initial safety reminder for new user."""
    try:
        count = db.query(Notification).filter(Notification.user_id == user.id).count()
        if count == 0:
            welcome = Notification(
                id=uuid.uuid4(),
                user_id=user.id,
                type="system",
                title_key="notif.welcome_title",
                message_key="notif.welcome_msg",
                data_json=json.dumps({"category": "welcome"}),
                is_read=False,
                created_at=utc_now(),
            )
            tip = Notification(
                id=uuid.uuid4(),
                user_id=user.id,
                type="tip",
                title_key="notif.security_tip_title",
                message_key="notif.security_tip_msg",
                data_json=json.dumps({"category": "advance_fee_phishing"}),
                is_read=False,
                created_at=utc_now(),
            )
            db.add(welcome)
            db.add(tip)
            db.commit()
    except (ProgrammingError, OperationalError):
        db.rollback()
    except Exception as exc:
        db.rollback()
        log.warning("event=seed_notifications_failed error=%s", str(exc))


@router.get("", response_model=NotificationListResponse, summary="List notifications for authenticated user")
def list_notifications(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve notifications owned strictly by the authenticated user."""
    _seed_initial_notifications_if_empty(db, user)

    try:
        records = (
            db.query(Notification)
            .filter(Notification.user_id == user.id)
            .order_by(Notification.created_at.desc())
            .limit(50)
            .all()
        )
        unread_count = (
            db.query(Notification)
            .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
            .count()
        )
        return NotificationListResponse(
            notifications=[_parse_notification(n) for n in records],
            unread_count=unread_count,
            server_time=utc_now(),
        )
    except (ProgrammingError, OperationalError):
        # Graceful fallback if migrations have not yet been applied
        return NotificationListResponse(
            notifications=[],
            unread_count=0,
            server_time=utc_now(),
        )


@router.post("/mark-read", summary="Mark specified or all notifications as read")
def mark_notifications_read(
    body: MarkReadRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark one, multiple, or all notifications read. Enforces strict ownership."""
    now = utc_now()
    try:
        query = db.query(Notification).filter(Notification.user_id == user.id)

        if body.mark_all:
            query = query.filter(Notification.is_read.is_(False))
            updated_count = query.update(
                {"is_read": True, "read_at": now},
                synchronize_session=False,
            )
        elif body.notification_ids:
            # Parse UUIDs safely
            valid_uuids = []
            for raw_id in body.notification_ids:
                try:
                    valid_uuids.append(uuid.UUID(str(raw_id)))
                except (ValueError, TypeError):
                    continue

            if not valid_uuids:
                return {"status": "ok", "updated_count": 0, "unread_count": 0}

            # Enforce ownership: only notifications where user_id == user.id are updated
            query = query.filter(Notification.id.in_(valid_uuids), Notification.is_read.is_(False))
            updated_count = query.update(
                {"is_read": True, "read_at": now},
                synchronize_session=False,
            )
        else:
            updated_count = 0

        db.commit()

        unread_count = (
            db.query(Notification)
            .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
            .count()
        )
        return {
            "status": "ok",
            "updated_count": updated_count,
            "unread_count": unread_count,
            "server_time": now.isoformat(),
        }
    except (ProgrammingError, OperationalError):
        db.rollback()
        return {"status": "ok", "updated_count": 0, "unread_count": 0, "server_time": now.isoformat()}


@router.post("/sync", response_model=NotificationListResponse, summary="Sync offline notifications and pending actions")
def sync_notifications(
    body: SyncNotificationsRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reconcile offline client read actions and fetch new notifications for user."""
    now = utc_now()
    try:
        # 1. Process pending offline read actions with ownership validation
        if body.pending_read_ids:
            valid_uuids = []
            for raw_id in body.pending_read_ids:
                try:
                    valid_uuids.append(uuid.UUID(str(raw_id)))
                except (ValueError, TypeError):
                    continue

            if valid_uuids:
                db.query(Notification).filter(
                    Notification.user_id == user.id,
                    Notification.id.in_(valid_uuids),
                    Notification.is_read.is_(False),
                ).update(
                    {"is_read": True, "read_at": now},
                    synchronize_session=False,
                )
                db.commit()

        # 2. Query all notifications for user
        query = db.query(Notification).filter(Notification.user_id == user.id)
        if body.last_sync_timestamp:
            # Query items created or updated after last sync
            query = query.filter(Notification.created_at >= body.last_sync_timestamp)

        records = query.order_by(Notification.created_at.desc()).limit(50).all()
        unread_count = (
            db.query(Notification)
            .filter(Notification.user_id == user.id, Notification.is_read.is_(False))
            .count()
        )

        return NotificationListResponse(
            notifications=[_parse_notification(n) for n in records],
            unread_count=unread_count,
            server_time=now,
        )
    except (ProgrammingError, OperationalError):
        db.rollback()
        return NotificationListResponse(
            notifications=[],
            unread_count=0,
            server_time=now,
        )


@router.post("/create", response_model=NotificationResponse, summary="Internal/system notification creation")
def create_notification(
    body: CreateNotificationRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new notification for the authenticated user."""
    # Ensure sensitive fields are not included in data
    safe_data = {k: v for k, v in body.data.items() if not any(s in k.lower() for s in ["password", "token", "otp", "secret", "card", "report"])}

    notif = Notification(
        id=uuid.uuid4(),
        user_id=user.id,
        type=body.type,
        title_key=body.title_key,
        message_key=body.message_key,
        data_json=json.dumps(safe_data),
        is_read=False,
        created_at=utc_now(),
    )
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return _parse_notification(notif)
