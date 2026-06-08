"""初始化默认审核规则脚本"""
import asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.data_audit import AuditRule


async def init_default_rules():
    """初始化默认审核规则"""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # 检查是否已有规则
        result = await session.execute(select(AuditRule))
        existing_rules = result.scalars().all()

        if existing_rules:
            print(f"已存在 {len(existing_rules)} 条规则，跳过初始化")
            return

        # 定义默认规则
        default_rules = [
            # 1. 必填字段检查
            AuditRule(
                rule_name="核心价格字段必填",
                rule_code="REQUIRED_PRICE_FIELDS",
                category="field_required",
                description="检查起拍价、保证金、加价幅度等核心价格字段是否填写",
                config={
                    "fields": ["starting_price", "deposit", "increment_amount"]
                },
                action="flag",
                severity="error",
                enabled=True,
                auto_fix=False,
            ),
            AuditRule(
                rule_name="房源面积必填",
                rule_code="REQUIRED_AREA",
                category="field_required",
                description="检查房源面积是否填写",
                config={
                    "fields": ["area"]
                },
                action="flag",
                severity="error",
                enabled=True,
                auto_fix=False,
            ),

            # 2. 字段范围检查
            AuditRule(
                rule_name="起拍价合理性检查",
                rule_code="VALID_STARTING_PRICE",
                category="field_range",
                description="起拍价应在10万到1亿之间",
                config={
                    "field": "starting_price",
                    "min": 100000,
                    "max": 100000000
                },
                action="flag",
                severity="warning",
                enabled=True,
                auto_fix=False,
            ),
            AuditRule(
                rule_name="保证金合理性检查",
                rule_code="VALID_DEPOSIT",
                category="field_range",
                description="保证金应大于0且小于起拍价",
                config={
                    "field": "deposit",
                    "min": 1,
                    "max": 50000000
                },
                action="flag",
                severity="warning",
                enabled=True,
                auto_fix=False,
            ),
            AuditRule(
                rule_name="房源面积合理性检查",
                rule_code="VALID_AREA",
                category="field_range",
                description="房源面积应在10到1000平方米之间",
                config={
                    "field": "area",
                    "min": 10,
                    "max": 1000
                },
                action="flag",
                severity="warning",
                enabled=True,
                auto_fix=False,
            ),

            # 3. 地区过滤
            AuditRule(
                rule_name="目标城市范围过滤",
                rule_code="REGION_FILTER_TARGET_CITIES",
                category="region_filter",
                description="仅保留上海、宁波、杭州的房源，其他城市的数据标记删除",
                config={
                    "allowed_cities": [310000, 330200, 330100]
                },
                action="delete",
                severity="critical",
                enabled=True,
                auto_fix=False,
            ),

            # 4. 房产类型过滤
            AuditRule(
                rule_name="不动产类型过滤",
                rule_code="PROPERTY_TYPE_FILTER",
                category="property_type_filter",
                description="仅保留住宅、别墅、公寓等不动产类型",
                config={
                    "allowed_types": ["住宅", "别墅", "公寓", "商铺", "写字楼", "厂房", "仓库", "车位"]
                },
                action="delete",
                severity="critical",
                enabled=True,
                auto_fix=False,
            ),

            # 5. 数据完整性检查
            AuditRule(
                rule_name="地址信息完整性",
                rule_code="REQUIRED_ADDRESS_INFO",
                category="field_required",
                description="检查地址、区域等位置信息是否完整",
                config={
                    "fields": ["address", "district"]
                },
                action="flag",
                severity="warning",
                enabled=True,
                auto_fix=False,
            ),
            AuditRule(
                rule_name="拍卖状态必填",
                rule_code="REQUIRED_AUCTION_STATUS",
                category="field_required",
                description="检查拍卖状态是否填写",
                config={
                    "fields": ["auction_status"]
                },
                action="flag",
                severity="error",
                enabled=True,
                auto_fix=False,
            ),

            # 6. 坐标有效性检查
            AuditRule(
                rule_name="经纬度合理性检查",
                rule_code="VALID_COORDINATES",
                category="field_range",
                description="检查经度是否在合理范围（中国东部）",
                config={
                    "field": "lng",
                    "min": 115,
                    "max": 125
                },
                action="flag",
                severity="warning",
                enabled=True,
                auto_fix=False,
            ),
        ]

        # 添加所有规则
        for rule in default_rules:
            session.add(rule)

        await session.commit()
        print(f"成功初始化 {len(default_rules)} 条默认审核规则")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(init_default_rules())
