"""add audit executions table

Revision ID: c5f8d3a1e9b2
Revises: add_data_audit_001
Create Date: 2026-06-08 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'c5f8d3a1e9b2'
down_revision = 'add_data_audit_001'
branch_labels = None
depends_on = None


def upgrade():
    # 创建 data_audit_executions 表
    op.create_table(
        'data_audit_executions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('execution_time', sa.DateTime(), nullable=False, comment='执行时间'),
        sa.Column('rules_applied', sa.JSON(), nullable=True, comment='应用的规则列表'),
        sa.Column('properties_checked', sa.Integer(), nullable=False, server_default='0', comment='检查的房源数'),
        sa.Column('properties_deleted', sa.Integer(), nullable=False, server_default='0', comment='删除的房源数'),
        sa.Column('properties_fixed', sa.Integer(), nullable=False, server_default='0', comment='修复的房源数'),
        sa.Column('violations_found', sa.JSON(), nullable=True, comment='违规详情统计'),
        sa.Column('execution_duration', sa.Integer(), nullable=True, comment='执行耗时（秒）'),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='completed', comment='执行状态'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), comment='创建时间'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_audit_exec_time', 'data_audit_executions', ['execution_time'], unique=False)


def downgrade():
    op.drop_index('idx_audit_exec_time', table_name='data_audit_executions')
    op.drop_table('data_audit_executions')
