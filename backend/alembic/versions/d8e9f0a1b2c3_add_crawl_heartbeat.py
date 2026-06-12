"""add heartbeat/phase/progress fields to crawl_tasks

爬虫结果可视化（用户 2026-06-12 要求）：实时进度 + 心跳，用于「跑到哪了」展示
和看门狗判定卡死（running 但心跳超时 → 自动标记 failed）。

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-06-12 15:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd8e9f0a1b2c3'
down_revision = 'c7d8e9f0a1b2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('crawl_tasks', sa.Column('heartbeat_at', sa.DateTime(), nullable=True,
        comment='最近一次心跳时间;running时engine定期刷新'))
    op.add_column('crawl_tasks', sa.Column('phase', sa.String(length=64), nullable=True,
        comment='当前阶段'))
    op.add_column('crawl_tasks', sa.Column('progress_done', sa.Integer(), nullable=True,
        comment='当前阶段已处理数'))
    op.add_column('crawl_tasks', sa.Column('progress_total', sa.Integer(), nullable=True,
        comment='当前阶段总数'))


def downgrade():
    op.drop_column('crawl_tasks', 'progress_total')
    op.drop_column('crawl_tasks', 'progress_done')
    op.drop_column('crawl_tasks', 'phase')
    op.drop_column('crawl_tasks', 'heartbeat_at')
