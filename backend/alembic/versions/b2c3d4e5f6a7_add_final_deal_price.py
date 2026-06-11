"""add final_deal_price to properties

法拍成交价（用户 2026-06-10 要求）：来自成交确认书/成交公告，用于小程序「昨日成交」
展示「成交价 vs 评估价」折扣冲击力。

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-10 22:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('properties', sa.Column(
        'final_deal_price', sa.BigInteger(), nullable=False, server_default='0',
        comment='法拍成交价(元),来自成交确认书'))


def downgrade():
    op.drop_column('properties', 'final_deal_price')
