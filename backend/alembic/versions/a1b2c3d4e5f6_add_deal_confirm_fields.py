"""add attachments / deal_confirmed / online_auction_end_time to properties

为「成交确认书判成交」需求新增三字段（用户 2026-06-10 要求）：
  - attachments：附件清单 JSON [{"name","url"}]，三平台统一抓取
  - deal_confirmed：附件含「成交确认书」=已成交铁证
  - online_auction_end_time：成交确认书 PDF 内的"网拍结束时间"，判昨日成交的准绳

Revision ID: a1b2c3d4e5f6
Revises: f3a4b5c6d7e8
Create Date: 2026-06-10 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1b2c3d4e5f6'
down_revision = 'f3a4b5c6d7e8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('properties', sa.Column(
        'attachments', sa.JSON(), nullable=True, comment='附件清单[{name,url}]'))
    op.add_column('properties', sa.Column(
        'deal_confirmed', sa.Boolean(), nullable=True,
        comment='存在成交确认书附件=已成交铁证'))
    op.add_column('properties', sa.Column(
        'online_auction_end_time', sa.DateTime(), nullable=True,
        comment='成交确认书内网拍结束时间'))
    # 索引：sold_on_sql 会按 online_auction_end_time 的日期过滤"昨日成交"
    op.create_index(
        'idx_properties_online_end', 'properties', ['online_auction_end_time'])


def downgrade():
    op.drop_index('idx_properties_online_end', table_name='properties')
    op.drop_column('properties', 'online_auction_end_time')
    op.drop_column('properties', 'deal_confirmed')
    op.drop_column('properties', 'attachments')
