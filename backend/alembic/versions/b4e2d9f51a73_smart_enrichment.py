"""add smart enrichment fields to properties

Revision ID: b4e2d9f51a73
Revises: a3d1c8f47be2
Create Date: 2026-05-27 23:55:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b4e2d9f51a73'
down_revision: Union[str, Sequence[str], None] = 'a3d1c8f47be2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('properties', sa.Column('tags', sa.JSON(), nullable=True, comment='智能标签数组'))
    op.add_column('properties', sa.Column('bargain_tagline', sa.String(length=256), nullable=True, comment='爆款营销文案'))
    op.add_column('properties', sa.Column('amenities_cache', sa.JSON(), nullable=True, comment='周边配套预处理'))
    op.add_column('properties', sa.Column('amenities_updated_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('properties', 'amenities_updated_at')
    op.drop_column('properties', 'amenities_cache')
    op.drop_column('properties', 'bargain_tagline')
    op.drop_column('properties', 'tags')
