"""创建数据审核相关表的Alembic迁移脚本"""
# 使用命令创建迁移：
# cd backend
# alembic revision -m "add data audit tables"

# 然后将以下内容复制到生成的迁移文件中

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers
revision = 'add_data_audit_001'
down_revision = 'b4e2d9f51a73'  # 最新的revision
branch_labels = None
depends_on = None


def upgrade():
    # 创建 audit_rules 表
    op.create_table(
        'audit_rules',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('rule_name', sa.String(length=128), nullable=False, comment='规则名称'),
        sa.Column('rule_code', sa.String(length=64), nullable=False, comment='规则唯一标识码'),
        sa.Column('category', sa.String(length=32), nullable=False, comment='规则分类'),
        sa.Column('description', sa.Text(), nullable=True, comment='规则描述'),
        sa.Column('config', sa.JSON(), nullable=False, comment='规则配置JSON'),
        sa.Column('action', sa.String(length=32), nullable=False, server_default='flag', comment='违规时执行动作'),
        sa.Column('severity', sa.String(length=16), nullable=False, server_default='warning', comment='严重级别'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default='1', comment='是否启用'),
        sa.Column('auto_fix', sa.Boolean(), nullable=False, server_default='0', comment='是否自动修复'),
        sa.Column('total_checked', sa.Integer(), nullable=False, server_default='0', comment='累计检查次数'),
        sa.Column('total_violations', sa.Integer(), nullable=False, server_default='0', comment='累计违规次数'),
        sa.Column('last_executed_at', sa.DateTime(), nullable=True, comment='最后执行时间'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rule_code'),
    )

    # 创建 audit_tasks 表
    op.create_table(
        'audit_tasks',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_name', sa.String(length=128), nullable=False, comment='任务名称'),
        sa.Column('task_type', sa.String(length=32), nullable=False, comment='任务类型'),
        sa.Column('rule_ids', sa.JSON(), nullable=False, comment='使用的规则ID列表'),
        sa.Column('scope', sa.JSON(), nullable=True, comment='审核范围配置'),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='pending', comment='任务状态'),
        sa.Column('progress', sa.Float(), nullable=False, server_default='0.0', comment='执行进度0-100'),
        sa.Column('total_records', sa.Integer(), nullable=False, server_default='0', comment='总检查记录数'),
        sa.Column('passed_count', sa.Integer(), nullable=False, server_default='0', comment='通过数量'),
        sa.Column('flagged_count', sa.Integer(), nullable=False, server_default='0', comment='标记数量'),
        sa.Column('fixed_count', sa.Integer(), nullable=False, server_default='0', comment='修复数量'),
        sa.Column('deleted_count', sa.Integer(), nullable=False, server_default='0', comment='删除数量'),
        sa.Column('started_at', sa.DateTime(), nullable=True, comment='开始时间'),
        sa.Column('completed_at', sa.DateTime(), nullable=True, comment='完成时间'),
        sa.Column('duration_seconds', sa.Integer(), nullable=True, comment='执行耗时(秒)'),
        sa.Column('error_message', sa.Text(), nullable=True, comment='错误信息'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # 创建 audit_violations 表
    op.create_table(
        'audit_violations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False, comment='审核任务ID'),
        sa.Column('rule_id', sa.Integer(), nullable=False, comment='违规规则ID'),
        sa.Column('property_id', sa.Integer(), nullable=False, comment='房源ID'),
        sa.Column('rule_code', sa.String(length=64), nullable=False, comment='规则代码'),
        sa.Column('rule_name', sa.String(length=128), nullable=False, comment='规则名称'),
        sa.Column('severity', sa.String(length=16), nullable=False, comment='严重级别'),
        sa.Column('violation_detail', sa.JSON(), nullable=False, comment='违规详情'),
        sa.Column('action_taken', sa.String(length=32), nullable=False, comment='执行的动作'),
        sa.Column('status', sa.String(length=16), nullable=False, server_default='open', comment='处理状态'),
        sa.Column('fixed_at', sa.DateTime(), nullable=True, comment='修复时间'),
        sa.Column('fixed_by', sa.String(length=64), nullable=True, comment='修复人'),
        sa.Column('fix_note', sa.Text(), nullable=True, comment='修复说明'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_task_id', 'audit_violations', ['task_id'])
    op.create_index('idx_rule_id', 'audit_violations', ['rule_id'])
    op.create_index('idx_property_id', 'audit_violations', ['property_id'])

    # 创建 audit_reports 表
    op.create_table(
        'audit_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False, comment='关联审核任务ID'),
        sa.Column('report_date', sa.DateTime(), nullable=False, comment='报告日期'),
        sa.Column('summary', sa.JSON(), nullable=False, comment='总体统计摘要'),
        sa.Column('rule_statistics', sa.JSON(), nullable=False, comment='各规则统计'),
        sa.Column('platform_statistics', sa.JSON(), nullable=True, comment='各平台统计'),
        sa.Column('city_statistics', sa.JSON(), nullable=True, comment='各城市统计'),
        sa.Column('quality_score', sa.Float(), nullable=False, server_default='0.0', comment='数据质量评分0-100'),
        sa.Column('trend_comparison', sa.JSON(), nullable=True, comment='与上次对比'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id'),
    )
    op.create_index('idx_report_task_id', 'audit_reports', ['task_id'])


def downgrade():
    op.drop_table('audit_reports')
    op.drop_table('audit_violations')
    op.drop_table('audit_tasks')
    op.drop_table('audit_rules')
