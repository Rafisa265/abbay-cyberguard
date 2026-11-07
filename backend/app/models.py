import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator, CHAR

from .database import Base


# UUID TypeDecorator to support PostgreSQL UUID natively while remaining portable
class GUID(TypeDecorator):
    """Platform-independent GUID/UUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(36).
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    display_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now, nullable=False)

    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")
    learning_progress = relationship("LearningProgress", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    preferred_language = Column(String(10), default="en", nullable=False)
    cloud_progress_sync_enabled = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="preferences")


class LearningProgress(Base):
    __tablename__ = "learning_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "module_or_level", name="uq_user_module_progress"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    module_or_level = Column(String(50), default="m5", nullable=False)
    active_level = Column(Integer, default=1, nullable=False)
    unlocked_levels = Column(String(255), default="[1]", nullable=False)
    completed_levels = Column(Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), onupdate=utc_now, nullable=False)

    user = relationship("User", back_populates="learning_progress")


class AcademyLessonProgress(Base):
    __tablename__ = "academy_lesson_progress"
    __table_args__ = (
        UniqueConstraint("user_id", "topic_key", name="uq_academy_lesson_user_topic"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    topic_key = Column(String(32), nullable=False)
    completed_sections = Column(Text, default="[]", nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)


class AcademyLevelCompletion(Base):
    __tablename__ = "academy_level_completions"
    __table_args__ = (
        UniqueConstraint("user_id", "level_num", name="uq_academy_level_user_level"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    level_num = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False)
    correct_count = Column(Integer, nullable=False)
    total_count = Column(Integer, nullable=False)
    completed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    assessment_attempt_id = Column(
        GUID,
        ForeignKey("academy_quiz_attempts.id", ondelete="RESTRICT"),
        unique=True,
        nullable=True,
    )


class AcademyQuizAttempt(Base):
    __tablename__ = "academy_quiz_attempts"
    __table_args__ = (
        Index(
            "uq_academy_quiz_attempts_active_user_level",
            "user_id",
            "level_num",
            unique=True,
            sqlite_where=text("status = 'in_progress'"),
            postgresql_where=text("status = 'in_progress'"),
        ),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    level_num = Column(Integer, nullable=False)
    question_data = Column(Text, nullable=False)
    status = Column(String(16), default="in_progress", nullable=False)
    score = Column(Integer, nullable=True)
    correct_count = Column(Integer, nullable=True)
    total_count = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)


class AcademyCertificate(Base):
    __tablename__ = "academy_certificates"
    __table_args__ = (
        UniqueConstraint("user_id", "level_num", name="uq_academy_certificate_user_level"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    certificate_id = Column(String(48), unique=True, index=True, nullable=False)
    level_num = Column(Integer, nullable=False)
    recipient_name = Column(String(200), nullable=False)
    course_title = Column(String(200), nullable=False)
    issued_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    status = Column(String(16), default="issued", nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_user_created", "user_id", "created_at"),
    )

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    type = Column(String(50), default="system", nullable=False)  # system, security_tip, achievement, reminder
    title_key = Column(String(100), nullable=False)
    message_key = Column(String(255), nullable=True)
    data_json = Column(Text, default="{}", nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utc_now, server_default=func.now(), nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="notifications")
