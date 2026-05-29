"""Seed Shanghai community metadata — run once to populate reference data."""
import asyncio
from app.models.community import CommunityInfo
from app.core.database import async_session


SHANGHAI_COMMUNITIES = [
    # 浦东新区
    {"name": "陆家嘴花园", "district": "浦东新区", "sub_district": "陆家嘴", "lat": 31.2355, "lng": 121.5080, "avg_price": 98000, "build_year_start": 2005, "build_year_end": 2015, "property_type": "住宅"},
    {"name": "仁恒滨江园", "district": "浦东新区", "sub_district": "陆家嘴", "lat": 31.2320, "lng": 121.5050, "avg_price": 120000, "build_year_start": 2002, "build_year_end": 2008, "property_type": "住宅"},
    {"name": "汤臣一品", "district": "浦东新区", "sub_district": "陆家嘴", "lat": 31.2360, "lng": 121.5100, "avg_price": 180000, "build_year_start": 2006, "build_year_end": 2010, "property_type": "住宅"},
    {"name": "联洋花园", "district": "浦东新区", "sub_district": "联洋", "lat": 31.2280, "lng": 121.5500, "avg_price": 90000, "build_year_start": 2003, "build_year_end": 2010, "property_type": "住宅"},
    {"name": "证大家园", "district": "浦东新区", "sub_district": "三林", "lat": 31.1500, "lng": 121.5100, "avg_price": 55000, "build_year_start": 2008, "build_year_end": 2015, "property_type": "住宅"},
    {"name": "花木苑", "district": "浦东新区", "sub_district": "花木", "lat": 31.2100, "lng": 121.5400, "avg_price": 75000, "build_year_start": 2004, "build_year_end": 2012, "property_type": "住宅"},
    {"name": "碧云花园", "district": "浦东新区", "sub_district": "碧云", "lat": 31.2400, "lng": 121.5800, "avg_price": 85000, "build_year_start": 2005, "build_year_end": 2012, "property_type": "住宅"},
    {"name": "世纪公园", "district": "浦东新区", "sub_district": "世纪公园", "lat": 31.2100, "lng": 121.5450, "avg_price": 80000, "build_year_start": 2006, "build_year_end": 2015, "property_type": "住宅"},
    {"name": "万科翡翠公园", "district": "浦东新区", "sub_district": "张江", "lat": 31.2000, "lng": 121.5900, "avg_price": 65000, "build_year_start": 2014, "build_year_end": 2019, "property_type": "住宅"},
    {"name": "金桥新城", "district": "浦东新区", "sub_district": "金桥", "lat": 31.2600, "lng": 121.6000, "avg_price": 50000, "build_year_start": 2006, "build_year_end": 2013, "property_type": "住宅"},

    # 静安区
    {"name": "中凯城市之光", "district": "静安区", "sub_district": "南京西路", "lat": 31.2280, "lng": 121.4550, "avg_price": 110000, "build_year_start": 2008, "build_year_end": 2012, "property_type": "住宅"},
    {"name": "静安枫景", "district": "静安区", "sub_district": "静安寺", "lat": 31.2250, "lng": 121.4450, "avg_price": 105000, "build_year_start": 2005, "build_year_end": 2010, "property_type": "住宅"},
    {"name": "嘉天汇", "district": "静安区", "sub_district": "大宁", "lat": 31.2800, "lng": 121.4500, "avg_price": 95000, "build_year_start": 2010, "build_year_end": 2017, "property_type": "住宅"},
    {"name": "达安花园", "district": "静安区", "sub_district": "曹家渡", "lat": 31.2300, "lng": 121.4300, "avg_price": 70000, "build_year_start": 2003, "build_year_end": 2008, "property_type": "住宅"},

    # 徐汇区
    {"name": "尚海湾", "district": "徐汇区", "sub_district": "徐汇滨江", "lat": 31.1800, "lng": 121.4600, "avg_price": 100000, "build_year_start": 2010, "build_year_end": 2018, "property_type": "住宅"},
    {"name": "东方曼哈顿", "district": "徐汇区", "sub_district": "徐家汇", "lat": 31.1950, "lng": 121.4380, "avg_price": 95000, "build_year_start": 2005, "build_year_end": 2012, "property_type": "住宅"},
    {"name": "徐汇苑", "district": "徐汇区", "sub_district": "龙华", "lat": 31.1700, "lng": 121.4480, "avg_price": 75000, "build_year_start": 2008, "build_year_end": 2015, "property_type": "住宅"},

    # 黄浦区
    {"name": "翠湖天地", "district": "黄浦区", "sub_district": "新天地", "lat": 31.2190, "lng": 121.4750, "avg_price": 160000, "build_year_start": 2006, "build_year_end": 2018, "property_type": "住宅"},
    {"name": "绿城黄浦湾", "district": "黄浦区", "sub_district": "外滩", "lat": 31.2280, "lng": 121.4950, "avg_price": 140000, "build_year_start": 2012, "build_year_end": 2018, "property_type": "住宅"},
    {"name": "华润外滩九里", "district": "黄浦区", "sub_district": "外滩", "lat": 31.2250, "lng": 121.5000, "avg_price": 130000, "build_year_start": 2010, "build_year_end": 2016, "property_type": "住宅"},

    # 长宁区
    {"name": "天山星城", "district": "长宁区", "sub_district": "天山", "lat": 31.2150, "lng": 121.4000, "avg_price": 70000, "build_year_start": 2008, "build_year_end": 2014, "property_type": "住宅"},
    {"name": "古北国际花园", "district": "长宁区", "sub_district": "古北", "lat": 31.2000, "lng": 121.3900, "avg_price": 85000, "build_year_start": 2005, "build_year_end": 2012, "property_type": "住宅"},

    # 虹口区
    {"name": "瑞虹新城", "district": "虹口区", "sub_district": "临平路", "lat": 31.2600, "lng": 121.4900, "avg_price": 80000, "build_year_start": 2008, "build_year_end": 2019, "property_type": "住宅"},
    {"name": "北外滩水城", "district": "虹口区", "sub_district": "北外滩", "lat": 31.2520, "lng": 121.5000, "avg_price": 75000, "build_year_start": 2010, "build_year_end": 2017, "property_type": "住宅"},

    # 杨浦区
    {"name": "创智天地", "district": "杨浦区", "sub_district": "五角场", "lat": 31.3000, "lng": 121.5200, "avg_price": 65000, "build_year_start": 2010, "build_year_end": 2018, "property_type": "住宅"},
    {"name": "新江湾城", "district": "杨浦区", "sub_district": "新江湾", "lat": 31.3300, "lng": 121.5100, "avg_price": 70000, "build_year_start": 2012, "build_year_end": 2019, "property_type": "住宅"},
    {"name": "合生江湾国际公寓", "district": "杨浦区", "sub_district": "新江湾", "lat": 31.3280, "lng": 121.5080, "avg_price": 68000, "build_year_start": 2010, "build_year_end": 2016, "property_type": "住宅"},

    # 普陀区
    {"name": "中远两湾城", "district": "普陀区", "sub_district": "中山北路", "lat": 31.2500, "lng": 121.4350, "avg_price": 65000, "build_year_start": 2005, "build_year_end": 2012, "property_type": "住宅"},
    {"name": "长风馨苑", "district": "普陀区", "sub_district": "长风", "lat": 31.2280, "lng": 121.3900, "avg_price": 60000, "build_year_start": 2008, "build_year_end": 2015, "property_type": "住宅"},

    # 闵行区
    {"name": "万科城市花园", "district": "闵行区", "sub_district": "七宝", "lat": 31.1580, "lng": 121.3480, "avg_price": 55000, "build_year_start": 2006, "build_year_end": 2014, "property_type": "住宅"},
    {"name": "莘庄南广场", "district": "闵行区", "sub_district": "莘庄", "lat": 31.1100, "lng": 121.3800, "avg_price": 50000, "build_year_start": 2008, "build_year_end": 2016, "property_type": "住宅"},

    # 宝山区
    {"name": "大华锦绣华城", "district": "宝山区", "sub_district": "大华", "lat": 31.2800, "lng": 121.4200, "avg_price": 48000, "build_year_start": 2006, "build_year_end": 2015, "property_type": "住宅"},
]

Ningbo_COMMUNITIES = [
    {"name": "江东金茂府", "district": "鄞州区", "lat": 29.8680, "lng": 121.5650, "avg_price": 35000, "build_year_start": 2015, "build_year_end": 2019, "property_type": "住宅", "city_id": 330200},
    {"name": "中海国际社区", "district": "鄞州区", "lat": 29.8200, "lng": 121.5800, "avg_price": 28000, "build_year_start": 2012, "build_year_end": 2018, "property_type": "住宅", "city_id": 330200},
    {"name": "万科城", "district": "鄞州区", "lat": 29.8600, "lng": 121.5500, "avg_price": 32000, "build_year_start": 2014, "build_year_end": 2019, "property_type": "住宅", "city_id": 330200},
    {"name": "荣安府", "district": "海曙区", "lat": 29.8730, "lng": 121.5400, "avg_price": 30000, "build_year_start": 2013, "build_year_end": 2018, "property_type": "住宅", "city_id": 330200},
    {"name": "雅戈尔新明洲", "district": "江北区", "lat": 29.9000, "lng": 121.5500, "avg_price": 29000, "build_year_start": 2014, "build_year_end": 2019, "property_type": "住宅", "city_id": 330200},
]


async def seed_communities():
    from app.core.database import async_session

    async with async_session() as db:
        from sqlalchemy import select
        existing = await db.execute(select(CommunityInfo.name))
        existing_names = {r[0] for r in existing.all()}

        all_communities = SHANGHAI_COMMUNITIES + Ningbo_COMMUNITIES
        added = 0
        for c in all_communities:
            if c["name"] in existing_names:
                continue
            db.add(CommunityInfo(
                name=c["name"],
                district=c["district"],
                sub_district=c.get("sub_district"),
                city_id=c.get("city_id", 310000),
                lat=c.get("lat"),
                lng=c.get("lng"),
                avg_price=c.get("avg_price"),
                build_year_start=c.get("build_year_start"),
                build_year_end=c.get("build_year_end"),
                property_type=c.get("property_type", "住宅"),
                source="manual_seed",
            ))
            added += 1

        await db.commit()
        print(f"Added {added} new communities (total: {len(all_communities)}, existing: {len(existing_names)})")


if __name__ == "__main__":
    asyncio.run(seed_communities())
