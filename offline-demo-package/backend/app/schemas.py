import re
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("Display name cannot be blank")
        return clean

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def validate_password_complexity(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Za-z]", v) or not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one letter and one number")
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserPreferenceUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    preferred_language: Optional[str] = Field(default=None, max_length=10)
    cloud_progress_sync_enabled: Optional[bool] = None

    @field_validator("preferred_language")
    @classmethod
    def validate_lang(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in ("en", "om", "am"):
            raise ValueError("Preferred language must be one of: en, om, am")
        return v


class UserPreferenceResponse(BaseModel):
    preferred_language: str
    cloud_progress_sync_enabled: bool
    updated_at: datetime


class UserResponse(BaseModel):
    id: str
    display_name: str
    email: str
    created_at: datetime
    preferences: Optional[UserPreferenceResponse] = None


class AuthResponse(BaseModel):
    user: UserResponse
    token: Optional[str] = None
    message: str = "Success"


class ProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    module_or_level: str = Field(default="m5", max_length=50)
    active_level: int = Field(default=1, ge=1, le=50)
    unlocked_levels: List[int] = Field(default_factory=lambda: [1])
    completed_levels: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("unlocked_levels")
    @classmethod
    def validate_unlocked(cls, v: List[int]) -> List[int]:
        if not v:
            return [1]
        for lvl in v:
            if lvl < 1 or lvl > 50:
                raise ValueError("Level numbers must be between 1 and 50")
        return sorted(list(set(v)))

    @field_validator("completed_levels")
    @classmethod
    def validate_completed(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for k, item in v.items():
            if not isinstance(item, dict):
                continue
            # Store only minimum necessary progress data: score, stars, completed_at
            # Strictly NEVER store individual answers, submitted passwords, or URLs (Privacy rule)
            clean_item = {}
            if "score" in item and isinstance(item["score"], (int, float)):
                clean_item["score"] = int(item["score"])
            if "stars" in item and isinstance(item["stars"], int):
                clean_item["stars"] = item["stars"]
            if "completed_at" in item and isinstance(item["completed_at"], str):
                clean_item["completed_at"] = item["completed_at"][:32]
            sanitized[str(k)] = clean_item
        return sanitized


class ProgressData(BaseModel):
    module_or_level: str
    active_level: int
    unlocked_levels: List[int]
    completed_levels: Dict[str, Any]
    updated_at: datetime


class ProgressResponse(BaseModel):
    sync_enabled: bool
    progress: Optional[ProgressData] = None


class M1CheckRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    url: str = Field(min_length=1, max_length=2048)


class CTIDetailsResponse(BaseModel):
    provider: str
    status: str
    threat_types: List[str] = []
    details: str = ""
    unavailable_reason: Optional[str] = None
    source: str = "cti_provider"
    checked_at: Optional[str] = None
    feed_updated_at: Optional[str] = None


class M1CheckResponse(BaseModel):
    url: str
    canonical_url: str
    cti: CTIDetailsResponse


class ArtworkStatusResponse(BaseModel):
    enabled: bool
    configured: bool
    provider: str
    cached_images_count: int
    message: str


class ArtworkGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mission_id: str = Field(min_length=1, max_length=64)
    category: str = Field(min_length=1, max_length=64)
    threat_type: Optional[str] = Field(default=None, max_length=128)
    character: Optional[str] = Field(default=None, max_length=128)
    environment: Optional[str] = Field(default=None, max_length=256)
    difficulty: Optional[str] = Field(default="intermediate", max_length=32)
    style_guide: Optional[str] = Field(default=None, max_length=256)


class ArtworkGenerateResponse(BaseModel):
    mission_id: str
    status: str
    artwork_url: str
    provider: str
    is_ai_generated: bool
    cached: bool
    details: Optional[str] = None


class NotificationResponse(BaseModel):
    id: str
    type: str
    title_key: str
    message_key: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationListResponse(BaseModel):
    notifications: List[NotificationResponse]
    unread_count: int
    server_time: datetime


class MarkReadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    notification_ids: Optional[List[str]] = None
    mark_all: bool = False


class SyncNotificationsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    last_sync_timestamp: Optional[datetime] = None
    pending_read_ids: List[str] = Field(default_factory=list)


class CreateNotificationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: str = Field(default="system", max_length=50)
    title_key: str = Field(min_length=1, max_length=100)
    message_key: Optional[str] = Field(default=None, max_length=255)
    data: Dict[str, Any] = Field(default_factory=dict)


class DailyChallengePublic(BaseModel):
    id: str
    date: str
    topic: str
    xp_reward: int
    scenario_key: str
    question_key: str
    options_keys: List[str]
    completed: bool = False
    chosen_choice: Optional[int] = None
    is_correct: Optional[bool] = None
    explanation_key: Optional[str] = None


class DailySubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    choice: int = Field(ge=0, le=2)


class DailySubmitResponse(BaseModel):
    is_correct: bool
    correct_choice: int
    explanation_key: str
    xp_awarded: int
    already_completed: bool
    badge_awarded: Optional[str] = None



