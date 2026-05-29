"""Data enrichment — fill in missing community metadata and geo coordinates."""
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger


class DataEnricher:
    """Post-crawl enrichment: match properties to community info, fill lat/lng."""

    @staticmethod
    async def enrich_property(db: AsyncSession, property_id: int, community_name: str | None) -> bool:
        """Try to enrich a single property with community metadata."""
        if not community_name:
            return False

        import sys
        from pathlib import Path
        BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
        if str(BACKEND_ROOT) not in sys.path:
            sys.path.insert(0, str(BACKEND_ROOT))

        from app.models.property import Property  # noqa: E402
        from app.models.community import CommunityInfo  # noqa: E402

        # Find matching community
        result = await db.execute(
            select(CommunityInfo).where(
                CommunityInfo.name.contains(community_name.strip())
            ).limit(1)
        )
        community = result.scalar_one_or_none()
        if not community:
            return False

        # Update property with community data
        updates = {}
        if community.lat and community.lng:
            updates["lat"] = community.lat
            updates["lng"] = community.lng
        if community.avg_price:
            updates["beike_latest_deal_unit_price"] = community.avg_price

        if updates:
            await db.execute(
                update(Property).where(Property.id == property_id).values(**updates)
            )
            logger.debug(f"Enriched property #{property_id} from community '{community_name}'")
            return True

        return False

    @staticmethod
    async def enrich_all_stale(db: AsyncSession, limit: int = 500) -> int:
        """Enrich all properties that are missing lat/lng or beike_latest_deal_unit_price."""
        import sys
        from pathlib import Path
        BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
        if str(BACKEND_ROOT) not in sys.path:
            sys.path.insert(0, str(BACKEND_ROOT))

        from app.models.property import Property  # noqa: E402
        from app.models.community import CommunityInfo  # noqa: E402
        from sqlalchemy import or_  # noqa: E402

        # Find properties missing geo or reference price
        result = await db.execute(
            select(Property.id, Property.community_name)
            .where(
                or_(
                    Property.lat.is_(None),
                    Property.lng.is_(None),
                    Property.beike_latest_deal_unit_price.is_(None),
                ),
                Property.community_name.isnot(None),
                Property.community_name != "",
            )
            .limit(limit)
        )
        rows = result.all()

        enriched = 0
        for row in rows:
            if await DataEnricher.enrich_property(db, row.id, row.community_name):
                enriched += 1

        if enriched:
            await db.commit()
            logger.info(f"Enriched {enriched}/{len(rows)} properties with community data")

        return enriched
