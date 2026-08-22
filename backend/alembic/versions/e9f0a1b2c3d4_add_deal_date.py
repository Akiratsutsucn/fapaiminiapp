"""add deal_date to properties

真实成交时间（用户 2026-08-04 要求）。区别于 online_auction_end_time
（拍卖前预估的结束日，到期不一定真成交）；deal_date 是真实成交那一刻：
公拍网=「竞价成功确认书」成交时间；京东=获拍/领先时间；阿里=成交结果时间。
管理后台房源管理据此展示「成交日期」。

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
Create Date: 2026-08-04 12:40:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'e9f0a1b2c3d4'
down_revision = 'd8e9f0a1b2c3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('properties', sa.Column(
        'deal_date', sa.DateTime(), nullable=True,
        comment='真实成交时间(成交确认书/获拍时间)'))


def downgrade():
    op.drop_column('properties', 'deal_date')
