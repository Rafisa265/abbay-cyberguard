import hashlib
import logging
import secrets
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Optional

import argon2
from argon2.exceptions import VerificationError, VerifyMismatchError
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from . import config
from .database import get_db
from .models import User, UserSession

log = logging.getLogger("cybershield.auth")

COOKIE_NAME = "cybershield_session"

# Argon2id hasher configuration
_hasher = argon2.PasswordHasher(
    time_cost=2,
    memory_cost=65536,  # 64 MiB
    parallelism=1,
    hash_len=32,
    type=argon2.Type.ID,
)

# Pre-computed dummy Argon2id hash to ensure constant-time verification and prevent timing-based user enumeration
_DUMMY_HASH = _hasher.hash("cybershield_timing_enumeration_defense_sentinel")


def hash_password(password: str) -> str:
    """Hash plaintext password with Argon2id. Never logs or leaks plaintext."""
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Verify password against Argon2id hash with safe boolean return."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError):
        return False
    except Exception:
        return False


def generate_session_token() -> str:
    """Generate high-entropy random session token."""
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """SHA-256 hash of session token for safe storage in database."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RateLimiter:
    """In-memory thread-safe sliding window rate limiter for auth endpoints."""

    def __init__(self, max_requests: int = 5, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._lock = Lock()
        self._records = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        if not config.RATE_LIMIT_ENABLED:
            return True
        now = time.time()
        with self._lock:
            cutoff = now - self.window_seconds
            self._records[key] = [t for t in self._records[key] if t > cutoff]
            if len(self._records[key]) >= self.max_requests:
                return False
            self._records[key].append(now)
            return True

    def get_retry_after(self, key: str) -> int:
        """Calculate remaining wait time in seconds until the oldest request leaves the window."""
        now = time.time()
        with self._lock:
            if not self._records[key]:
                return self.window_seconds
            earliest = self._records[key][0]
            return max(1, int(earliest + self.window_seconds - now))

    def reset(self, key: str) -> None:
        with self._lock:
            self._records.pop(key, None)


auth_rate_limiter = RateLimiter(max_requests=5, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract client IP safely. Trusts X-Forwarded-For strictly when immediate client is in TRUSTED_PROXIES."""
    client = request.client
    direct_ip = client.host if client else "127.0.0.1"

    if direct_ip in config.TRUSTED_PROXIES:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # First IP in X-Forwarded-For chain is the client origin
            client_origin = forwarded.split(",")[0].strip()
            if client_origin:
                return client_origin

    return direct_ip


def get_session_token(request: Request) -> Optional[str]:
    """Retrieve session token from Authorization header or HttpOnly cookie."""
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    return request.cookies.get(COOKIE_NAME)


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    """Authenticate request and return active User instance."""
    token = get_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    token_hash = hash_session_token(token)
    now = datetime.now(timezone.utc)

    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == token_hash,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > now,
        )
        .first()
    )

    if not session:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="UNAUTHORIZED")

    return user
