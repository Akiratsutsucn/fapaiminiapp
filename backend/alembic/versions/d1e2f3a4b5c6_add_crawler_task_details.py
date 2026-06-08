"""add crawler task details table

Revision ID: d1e2f3a4b5c6
Revises: c5f8d3a1e9b2
Create Date: 2026-06-08 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = 'd1e2f3a4b5c6'
down_revision = 'c5f8d3a1e9b2'
branch_labels = None
depends_on = None


def upgrade():
    # 创建 crawler_task_details 表
    op.create_table(
        'crawler_task_details',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False, comment='关联的爬虫任务ID'),
        sa.Column('platform', sa.String(length=32), nullable=False, comment='平台名称：阿里拍卖/京东拍卖/公拍网'),
        sa.Column('city', sa.String(length=32), nullable=False, comment='城市名称：上海/宁波/杭州'),
        sa.Column('total_fetched', sa.Integer(), nullable=False, server_default='0', comment='抓取总数'),
        sa.Column('new_count', sa.Integer(), nullable=False, server_default='0', comment='新增数量'),
        sa.Column('updated_count', sa.Integer(), nullable=False, server_default='0', comment='更新数量'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0', comment='失败数量'),
        sa.Column('skipped_count', sa.Integer(), nullable=False, server_default='0', comment='跳过数量'),
        sa.Column('error_messages', sa.Text(), nullable=True, comment='错误信息（截断至1000字符）'),
        sa.Column('duration_seconds', sa.Integer(), nullable=True, comment='耗时（秒）'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['task_id'], ['crawl_tasks.id'], ondelete='CASCADE'),
    )
    op.create_index('idx_task_details_task_id', 'crawler_task_details', ['task_id'])


def downgrade():
    op.drop_index('idx_task_details_task_id', table_name='crawler_task_details')
    op.drop_table('crawler_task_details')
