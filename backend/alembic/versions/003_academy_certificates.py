"""Add server-verified academy progress and certificates.

Revision ID: 003_academy_certificates
Revises: 002_notifications
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = "003_academy_certificates"
down_revision: Union[str, None] = "002_notifications"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _uuid_type():
    return PG_UUID(as_uuid=True) if op.get_bind().dialect.name == "postgresql" else sa.CHAR(36)


def upgrade() -> None:
    uuid_type = _uuid_type()
    op.create_table(
        "academy_lesson_progress",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_key", sa.String(32), nullable=False),
        sa.Column("completed_sections", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "topic_key", name="uq_academy_lesson_user_topic"),
    )
    op.create_index("ix_academy_lesson_progress_user_id", "academy_lesson_progress", ["user_id"])

    op.create_table(
        "academy_quiz_attempts",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_num", sa.Integer(), nullable=False),
        sa.Column("question_data", sa.Text(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="in_progress"),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column("correct_count", sa.Integer(), nullable=True),
        sa.Column("total_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_academy_quiz_attempts_user_level_created",
        "academy_quiz_attempts",
        ["user_id", "level_num", "created_at"],
    )
    op.create_index(
        "uq_academy_quiz_attempts_active_user_level",
        "academy_quiz_attempts",
        ["user_id", "level_num"],
        unique=True,
        postgresql_where=sa.text("status = 'in_progress'"),
        sqlite_where=sa.text("status = 'in_progress'"),
    )

    op.create_table(
        "academy_level_completions",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("level_num", sa.Integer(), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("correct_count", sa.Integer(), nullable=False),
        sa.Column("total_count", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "assessment_attempt_id",
            uuid_type,
            sa.ForeignKey("academy_quiz_attempts.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.UniqueConstraint("user_id", "level_num", name="uq_academy_level_user_level"),
        sa.UniqueConstraint("assessment_attempt_id", name="uq_academy_level_assessment_attempt"),
    )
    op.create_index("ix_academy_level_completions_user_id", "academy_level_completions", ["user_id"])

    op.create_table(
        "academy_certificates",
        sa.Column("id", uuid_type, primary_key=True),
        sa.Column("user_id", uuid_type, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("certificate_id", sa.String(48), nullable=False),
        sa.Column("level_num", sa.Integer(), nullable=False),
        sa.Column("recipient_name", sa.String(200), nullable=False),
        sa.Column("course_title", sa.String(200), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("status", sa.String(16), nullable=False, server_default="issued"),
        sa.UniqueConstraint("user_id", "level_num", name="uq_academy_certificate_user_level"),
    )
    op.create_index("ix_academy_certificates_user_id", "academy_certificates", ["user_id"])
    op.create_index("ix_academy_certificates_certificate_id", "academy_certificates", ["certificate_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_academy_certificates_certificate_id", table_name="academy_certificates")
    op.drop_index("ix_academy_certificates_user_id", table_name="academy_certificates")
    op.drop_table("academy_certificates")
    op.drop_index("ix_academy_level_completions_user_id", table_name="academy_level_completions")
    op.drop_table("academy_level_completions")
    op.drop_index("ix_academy_quiz_attempts_user_level_created", table_name="academy_quiz_attempts")
    op.drop_index("uq_academy_quiz_attempts_active_user_level", table_name="academy_quiz_attempts")
    op.drop_table("academy_quiz_attempts")
    op.drop_index("ix_academy_lesson_progress_user_id", table_name="academy_lesson_progress")
    op.drop_table("academy_lesson_progress")
