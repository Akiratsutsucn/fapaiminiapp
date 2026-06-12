"""add soft-delete fields (is_deleted, deleted_reason) to properties

软删除（用户 2026-06-12 要求）：数据审核判定为非房产/外省等时，改为标记隐藏而非物理删除，
保留在库可追溯/恢复。小程序所有 C 端入口经 auction_status 单一事实源过滤 is_deleted==0。

Revision ID: c7d8e9f0a1b2
Revises: b2c3d4e5f6a7
Create Date: 2026-06-12 10:50:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c7d8e9f0a1b2'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('properties', sa.Column(
        'is_deleted', sa.Integer(), nullable=False, server_default='0',
        comment='软删除标记:0正常/1已删(审核隐藏)'))
    op.add_column('properties', sa.Column(
        'deleted_reason', sa.String(length=64), nullable=True,
        comment='软删除原因(审核规则code)'))


def downgrade():
    op.drop_column('properties', 'deleted_reason')
    op.drop_column('properties', 'is_deleted')
