"""add ai_sessions and ai_messages tables

Revision ID: f3a4b5c6d7e8
Revises: d1e2f3a4b5c6
Create Date: 2026-06-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a4b5c6d7e8'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ai_sessions',
        sa.Column('session_id', sa.String(length=64), nullable=False, comment='会话ID(UUID)'),
        sa.Column('title', sa.String(length=100), nullable=False, server_default='新会话'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('session_id'),
    )
    op.create_index('idx_ai_sessions_updated', 'ai_sessions', ['updated_at'])

    op.create_table(
        'ai_messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('session_id', sa.String(length=64), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False, comment='user/assistant'),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['session_id'], ['ai_sessions.session_id'], ondelete='CASCADE'),
    )
    op.create_index('idx_ai_messages_session', 'ai_messages', ['session_id'])


def downgrade():
    op.drop_index('idx_ai_messages_session', table_name='ai_messages')
    op.drop_table('ai_messages')
    op.drop_index('idx_ai_sessions_updated', table_name='ai_sessions')
    op.drop_table('ai_sessions')
