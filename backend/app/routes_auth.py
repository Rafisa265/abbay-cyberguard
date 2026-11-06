import json
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from . import config
from .auth import (
    COOKIE_NAME,
    auth_rate_limiter,
    generate_session_token,
    get_client_ip,
    get_current_user,
    get_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from .database import get_db
from .models import LearningProgress, User, UserPreference, UserSession
from .schemas import (
    AuthResponse,
    ChangePasswordRequest,
    LoginRequest,
    ProgressData,
    ProgressResponse,
    ProgressUpdate,
    RegisterRequest,
    UserPreferenceResponse,
    UserPreferenceUpdate,
    UserResponse,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
        max_age=config.SESSION_LIFETIME_HOURS * 3600,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
        secure=config.COOKIE_SECURE,
    )


def _build_user_response(user: User) -> UserResponse:
    pref_resp = None
    if user.preferences:
        pref_resp = UserPreferenceResponse(
            preferred_language=user.preferences.preferred_language,
            cloud_progress_sync_enabled=user.preferences.cloud_progress_sync_enabled,
            updated_at=user.preferences.updated_at,
        )
    return UserResponse(
        id=str(user.id),
        display_name=user.display_name,
        email=user.email,
        created_at=user.created_at,
        preferences=pref_resp,
    )


@router.post("/register", response_model=AuthResponse, status_code=201, include_in_schema=False)
def register(
    request: Request,
    response: Response,
    body: RegisterRequest,
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    if not auth_rate_limiter.is_allowed(f"register:{ip}"):
        retry_after = auth_rate_limiter.get_retry_after(f"register:{ip}")
        raise HTTPException(
            status_code=429,
            detail="TOO_MANY_REQUESTS",
            headers={"Retry-After": str(retry_after)},
        )

    # Email uniqueness check
    normalized_email = body.email.strip().lower()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=409, detail="EMAIL_ALREADY_EXISTS")

    # Hash password with Argon2id
    pwd_hash = hash_password(body.password)

    # Create user
    user = User(
        display_name=body.display_name,
        email=normalized_email,
        password_hash=pwd_hash,
    )
    db.add(user)
    db.flush()

    # Create default preferences
    pref = UserPreference(
        user_id=user.id,
        preferred_language="en",
        cloud_progress_sync_enabled=False,
    )
    db.add(pref)
    db.flush()

    # Create session
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=config.SESSION_LIFETIME_HOURS)
    session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, raw_token)
    return AuthResponse(
        user=_build_user_response(user),
        message="Registration successful",
    )


@router.post("/login", response_model=AuthResponse, include_in_schema=False)
def login(
    request: Request,
    response: Response,
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    if not auth_rate_limiter.is_allowed(f"login:{ip}"):
        retry_after = auth_rate_limiter.get_retry_after(f"login:{ip}")
        raise HTTPException(
            status_code=429,
            detail="TOO_MANY_REQUESTS",
            headers={"Retry-After": str(retry_after)},
        )

    normalized_email = body.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()

    # Constant-time verification: do not leak whether email exists via timing side-channels
    if user and user.is_active:
        pwd_valid = verify_password(user.password_hash, body.password)
    else:
        from .auth import _DUMMY_HASH
        verify_password(_DUMMY_HASH, body.password)
        pwd_valid = False

    if not pwd_valid:
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

    # Successful login: reset rate limiter for this client
    auth_rate_limiter.reset(f"login:{ip}")

    # Create new session
    raw_token = generate_session_token()
    token_hash = hash_session_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=config.SESSION_LIFETIME_HOURS)
    session = UserSession(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(session)
    db.commit()
    db.refresh(user)

    _set_session_cookie(response, raw_token)
    return AuthResponse(
        user=_build_user_response(user),
        message="Login successful",
    )


@router.post("/logout", include_in_schema=False)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = get_session_token(request)
    if token:
        token_hash = hash_session_token(token)
        now = datetime.now(timezone.utc)
        session = (
            db.query(UserSession)
            .filter(
                UserSession.token_hash == token_hash,
                UserSession.revoked_at.is_(None),
            )
            .first()
        )
        if session:
            session.revoked_at = now
            db.commit()

    _clear_session_cookie(response)
    return {"status": "logged_out"}


@router.get("/me", response_model=UserResponse, include_in_schema=False)
def me(
    current_user: User = Depends(get_current_user),
):
    return _build_user_response(current_user)


@router.put("/preferences", response_model=UserPreferenceResponse, include_in_schema=False)
def update_preferences(
    body: UserPreferenceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = db.query(UserPreference).filter(UserPreference.user_id == current_user.id).first()
    if not pref:
        pref = UserPreference(user_id=current_user.id)
        db.add(pref)

    now = datetime.now(timezone.utc)
    if body.preferred_language is not None:
        pref.preferred_language = body.preferred_language
    if body.cloud_progress_sync_enabled is not None:
        pref.cloud_progress_sync_enabled = body.cloud_progress_sync_enabled
    pref.updated_at = now

    db.commit()
    db.refresh(pref)

    return UserPreferenceResponse(
        preferred_language=pref.preferred_language,
        cloud_progress_sync_enabled=pref.cloud_progress_sync_enabled,
        updated_at=pref.updated_at,
    )


@router.get("/progress", response_model=ProgressResponse, include_in_schema=False)
def get_progress(
    module_or_level: str = "m5",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = current_user.preferences
    if not pref or not pref.cloud_progress_sync_enabled:
        return ProgressResponse(sync_enabled=False, progress=None)

    prog = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.user_id == current_user.id,
            LearningProgress.module_or_level == module_or_level,
        )
        .first()
    )

    if not prog:
        return ProgressResponse(sync_enabled=True, progress=None)

    try:
        unlocked = json.loads(prog.unlocked_levels)
    except Exception:
        unlocked = [1]
    try:
        completed = json.loads(prog.completed_levels)
    except Exception:
        completed = {}

    return ProgressResponse(
        sync_enabled=True,
        progress=ProgressData(
            module_or_level=prog.module_or_level,
            active_level=prog.active_level,
            unlocked_levels=unlocked,
            completed_levels=completed,
            updated_at=prog.updated_at,
        ),
    )


@router.put("/progress", response_model=ProgressResponse, include_in_schema=False)
def save_progress(
    body: ProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pref = current_user.preferences
    if not pref or not pref.cloud_progress_sync_enabled:
        raise HTTPException(
            status_code=403,
            detail="SYNC_NOT_ENABLED",
        )

    now = datetime.now(timezone.utc)
    prog = (
        db.query(LearningProgress)
        .filter(
            LearningProgress.user_id == current_user.id,
            LearningProgress.module_or_level == body.module_or_level,
        )
        .first()
    )

    unlocked_json = json.dumps(body.unlocked_levels)
    completed_json = json.dumps(body.completed_levels)

    if not prog:
        prog = LearningProgress(
            user_id=current_user.id,
            module_or_level=body.module_or_level,
            active_level=body.active_level,
            unlocked_levels=unlocked_json,
            completed_levels=completed_json,
            updated_at=now,
        )
        db.add(prog)
    else:
        prog.active_level = body.active_level
        prog.unlocked_levels = unlocked_json
        prog.completed_levels = completed_json
        prog.updated_at = now

    db.commit()
    db.refresh(prog)

    return ProgressResponse(
        sync_enabled=True,
        progress=ProgressData(
            module_or_level=prog.module_or_level,
            active_level=prog.active_level,
            unlocked_levels=body.unlocked_levels,
            completed_levels=body.completed_levels,
            updated_at=prog.updated_at,
        ),
    )


@router.post("/change-password", include_in_schema=False)
def change_password(
    request: Request,
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ip = get_client_ip(request)
    if not auth_rate_limiter.is_allowed(f"change_pwd:{current_user.id}"):
        retry_after = auth_rate_limiter.get_retry_after(f"change_pwd:{current_user.id}")
        raise HTTPException(
            status_code=429,
            detail="TOO_MANY_REQUESTS",
            headers={"Retry-After": str(retry_after)},
        )

    if not verify_password(current_user.password_hash, body.current_password):
        raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="NEW_PASSWORD_SAME_AS_OLD")

    now = datetime.now(timezone.utc)
    current_user.password_hash = hash_password(body.new_password)
    current_user.updated_at = now

    current_token = get_session_token(request)
    current_token_hash = hash_session_token(current_token) if current_token else None

    # Revoke all other active sessions for this user while keeping the current session valid
    other_sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == current_user.id,
            UserSession.revoked_at.is_(None),
            UserSession.token_hash != current_token_hash,
        )
        .all()
    )
    for s in other_sessions:
        s.revoked_at = now

    db.commit()

    return {
        "status": "ok",
        "message": "Password changed successfully",
        "other_sessions_revoked": len(other_sessions),
    }
