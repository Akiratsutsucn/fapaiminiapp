"""extend community_info for beike crawl

Revision ID: a3d1c8f47be2
Revises: 32ad0e3ac0b7
Create Date: 2026-05-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3d1c8f47be2'
down_revision: Union[str, Sequence[str], None] = '32ad0e3ac0b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('community_info', sa.Column('plot_ratio', sa.Float(), nullable=True, comment='容积率'))
    op.add_column('community_info', sa.Column('green_rate', sa.Float(), nullable=True, comment='绿化率(0-1)'))
    op.add_column('community_info', sa.Column('property_company', sa.String(length=128), nullable=True, comment='物业公司'))
    op.add_column('community_info', sa.Column('property_fee', sa.String(length=64), nullable=True, comment='物业费(元/㎡/月)'))
    op.add_column('community_info', sa.Column('huxing_summary', sa.String(length=256), nullable=True, comment='主力户型摘要'))
    op.add_column('community_info', sa.Column('address_full', sa.String(length=256), nullable=True, comment='完整地址'))
    op.add_column('community_info', sa.Column('recent_deal_count_30d', sa.Integer(), nullable=True, comment='近30天成交套数'))
    op.add_column('community_info', sa.Column('recent_avg_price_30d', sa.Float(), nullable=True, comment='近30天成交均价(元/㎡)'))
    op.add_column('community_info', sa.Column('on_sale_count', sa.Integer(), nullable=True, comment='在售房源数'))
    op.add_column('community_info', sa.Column('rent_count', sa.Integer(), nullable=True, comment='在租房源数'))
    op.add_column('community_info', sa.Column('description', sa.Text(), nullable=True, comment='小区详细介绍（用户可见）'))
    op.add_column('community_info', sa.Column('beike_url', sa.String(length=256), nullable=True, comment='贝壳小区详情页链接'))
    op.add_column('community_info', sa.Column('last_crawled_at', sa.DateTime(), nullable=True, comment='贝壳上次抓取时间'))


def downgrade() -> None:
    for col in ('last_crawled_at', 'beike_url', 'description', 'rent_count', 'on_sale_count',
                'recent_avg_price_30d', 'recent_deal_count_30d', 'address_full', 'huxing_summary',
                'property_fee', 'property_company', 'green_rate', 'plot_ratio'):
        op.drop_column('community_info', col)
