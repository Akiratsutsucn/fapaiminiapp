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

    # 商圈映射缓存:{city_id: [(小区名, 商圈), ...]}(长名优先),进程内复用,避免每轮全表扫。
    _sub_map_cache: dict | None = None

    @staticmethod
    async def _load_sub_map(db: AsyncSession) -> dict:
        """从 community_info 构建 城市→[(小区名,商圈)] 映射(长名优先,便于最长匹配)。"""
        import sys
        from pathlib import Path
        BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
        if str(BACKEND_ROOT) not in sys.path:
            sys.path.insert(0, str(BACKEND_ROOT))
        from app.models.community import CommunityInfo  # noqa: E402

        rows = (await db.execute(
            select(CommunityInfo.name, CommunityInfo.sub_district, CommunityInfo.city_id)
            .where(CommunityInfo.sub_district.isnot(None), CommunityInfo.sub_district != "")
        )).all()
        by_city: dict = {}
        for name, sub, cid in rows:
            if name and sub:
                by_city.setdefault(cid or 310000, []).append((name, sub))
        for cid in by_city:
            by_city[cid].sort(key=lambda x: len(x[0]), reverse=True)  # 长名优先,避免短名误命中
        return by_city

    @staticmethod
    async def backfill_sub_districts(db: AsyncSession, limit: int = 1000) -> int:
        """用 community_info 的小区→商圈映射,给缺 sub_district 的房源回填商圈。
        匹配:小区名(≥3字)出现在 community_name 或 title 中即命中。抓取后调用,新房源自动补。
        """
        import sys
        from pathlib import Path
        BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent / "backend"
        if str(BACKEND_ROOT) not in sys.path:
            sys.path.insert(0, str(BACKEND_ROOT))
        from app.models.property import Property  # noqa: E402
        from sqlalchemy import or_  # noqa: E402

        if DataEnricher._sub_map_cache is None:
            DataEnricher._sub_map_cache = await DataEnricher._load_sub_map(db)
        by_city = DataEnricher._sub_map_cache
        if not by_city:
            return 0

        props = (await db.execute(
            select(Property).where(
                Property.is_deleted == 0,
                or_(Property.sub_district.is_(None), Property.sub_district == ""),
            ).limit(limit)
        )).scalars().all()

        filled = 0
        for p in props:
            cand = by_city.get(p.city_id or 310000, [])
            hay = (p.community_name or "") + " " + (p.title or "")
            for name, sub in cand:
                if len(name) >= 3 and name in hay:
                    p.sub_district = sub
                    filled += 1
                    break
        if filled:
            await db.commit()
            logger.info(f"商圈回填:{filled}/{len(props)} 条房源补全 sub_district")
        return filled
