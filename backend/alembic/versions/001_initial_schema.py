"""Initial schema for users, preferences, progress, and sessions

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-21 04:15:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Determine UUID type based on dialect
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"
    uuid_type = PG_UUID(as_uuid=True) if is_postgres else sa.CHAR(36)

    # 1. users table
    op.create_table(
        'users',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # 2. user_preferences table
    op.create_table(
        'user_preferences',
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('preferred_language', sa.String(10), nullable=False, server_default='en'),
        sa.Column('cloud_progress_sync_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. learning_progress table
    op.create_table(
        'learning_progress',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('module_or_level', sa.String(50), nullable=False, server_default='m5'),
        sa.Column('active_level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('unlocked_levels', sa.String(255), nullable=False, server_default='[1]'),
        sa.Column('completed_levels', sa.Text(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'module_or_level', name='uq_user_module_progress'),
    )
    op.create_index('ix_learning_progress_user_id', 'learning_progress', ['user_id'])

    # 4. user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', uuid_type, primary_key=True),
        sa.Column('user_id', uuid_type, sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_token_hash', 'user_sessions', ['token_hash'], unique=True)


def downgrade() -> None:
    op.drop_table('user_sessions')
    op.drop_table('learning_progress')
    op.drop_table('user_preferences')
    op.drop_table('users')
