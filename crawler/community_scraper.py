"""贝壳找房（sh.ke.com / nb.ke.com）小区基础数据抓取。

【设计取舍 · 2026-05-27】贝壳服务器侧反爬非常激进：
- 任何 /xiaoqu/* 路径（小区列表/详情/搜索）都强制 CAPTCHA，cookie 也救不了
- 但 ajax.api.ke.com/sug/headerSearch 这个搜索建议接口是开放的
- 因此当前只能拿到：小区名（标准化）、贝壳内部 ID、区/板块、ershoufang 链接

抓取字段（来自 sug API）：
- name             标准化的小区名（如 "田园别墅(剑河路896弄)"）
- district         区
- sub_district     板块（如 "西郊"）
- beike_url        ershoufang 链接（用户可点开看更多）
- description      用户友好的简介（拼装）

未来若需更详细的字段（建成年代、容积率、户型、物业费、近30成交等），
有以下路径：
1. 贝壳 cookie + 浏览器有头模式手动通过 CAPTCHA → 不适合自动化
2. 用住宅代理 IP → 一劳永逸（约 50 元/月）
3. 数据用人工补录（管理后台已支持）
"""
import asyncio
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import httpx
from loguru import logger
from sqlalchemy import select

BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.community import CommunityInfo  # noqa: E402
from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402
from crawler.config import settings  # noqa: E402
from crawler.anti_block import http_get_with_retry  # noqa: E402

CITY_MAP = {
    310000: ("sh", "上海"),
    330200: ("nb", "宁波"),
    330100: ("hz", "杭州"),
}

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/132.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}


def city_meta(city_id: int) -> tuple[str, str]:
    return CITY_MAP.get(city_id, CITY_MAP[310000])


def _city_id_from_en(city_en: str) -> int | None:
    """城市英文缩写（sh/nb/hz）反查 city_id。"""
    for cid, (en, _name) in CITY_MAP.items():
        if en == city_en:
            return cid
    return None


def _build_sug_headers(city_en: str) -> dict:
    headers = dict(DEFAULT_HEADERS)
    headers["Referer"] = f"https://{city_en}.ke.com/"
    if settings.BEIKE_COOKIE:
        headers["Cookie"] = settings.BEIKE_COOKIE
    return headers


def _district_from_region(region: str) -> tuple[str, str]:
    """region 字段示例: "(田园别墅公寓,田园别墅（公寓）) 西郊 长宁"
    返回 (district 区, sub_district 板块)。
    """
    # 把括号内容去掉
    r = re.sub(r"\([^)]*\)", "", region or "").strip()
    parts = [p for p in re.split(r"\s+", r) if p]
    if not parts:
        return "", ""
    # 末尾通常是区
    district = parts[-1]
    sub = parts[0] if len(parts) > 1 else ""
    # 修正：贝壳"长宁"实际是"长宁区"
    if district and not district.endswith("区"):
        district = district + "区"
    return district, sub


async def search_via_sug_api(
    client: httpx.AsyncClient, city_id: int, keyword: str
) -> dict | None:
    """通过 ajax.api.ke.com/sug/headerSearch 搜索小区。
    返回首条小区类型的结果（sugTypeName.text == "小区"）。
    使用 anti_block 框架做重试 + 代理轮换。
    """
    city_en, city_name = city_meta(city_id)
    url = (
        f"https://ajax.api.ke.com/sug/headerSearch"
        f"?cityId={city_id}&cityName={quote(city_name)}"
        f"&channel=site&keyword={quote(keyword)}&query={quote(keyword)}"
    )
    headers = _build_sug_headers(city_en)

    resp = await http_get_with_retry(
        url,
        headers=headers,
        cookie_str=settings.BEIKE_COOKIE or None,
        timeout=15,
        max_retries=3,
    )
    if not resp:
        return None

    if resp.status_code != 200:
        logger.warning(f"[beike] sug HTTP {resp.status_code}: {keyword}")
        return None

    try:
        data = resp.json()
    except Exception as e:
        logger.warning(f"[beike] sug JSON 解析失败 '{keyword}': {e}")
        return None

    if data.get("errno") != 0:
        logger.warning(f"[beike] sug errno={data.get('errno')} {data.get('error')}: {keyword}")
        return None

    results = (data.get("data") or {}).get("result") or []
    for item in results:
        sug_type = (item.get("sugTypeName") or {}).get("text", "")
        if sug_type != "小区":
            continue
        item_id = item.get("id") or (item.get("value") or {}).get("hdicResblockId")
        if not item_id:
            continue
        return {
            "id": int(item_id),
            "name": item.get("text") or "",
            "region": item.get("region") or "",
            "url_path": item.get("url") or "",
        }
    return None


async def fetch_community_detail(
    client: httpx.AsyncClient, city_id: int, resblock_id: int
) -> dict:
    """抓贝壳小区详情页 hz.ke.com/xiaoqu/{id}/ 并解析富字段。

    返回字段 dict（缺失项不含），失败返回空 dict。用 anti_block 框架做重试+换IP。
    """
    city_en, _ = city_meta(city_id)
    url = f"https://{city_en}.ke.com/xiaoqu/{resblock_id}/"
    headers = _build_sug_headers(city_en)
    resp = await http_get_with_retry(
        url, headers=headers, cookie_str=settings.BEIKE_COOKIE or None,
        timeout=20, max_retries=3,
    )
    if not resp or resp.status_code != 200:
        return {}

    html = resp.text
    out: dict = {}

    # label-content 配对（建筑类型/房屋总数/楼栋总数/绿化率/容积率/建成年代/物业费用/物业公司/开发商）
    pairs = re.findall(
        r'xiaoquInfoLabel["\'][^>]*>([^<]+)<.*?xiaoquInfoContent["\'][^>]*>([^<]*)',
        html, re.S,
    )
    info = {k.strip(): v.strip() for k, v in pairs}

    def _has(v: str) -> bool:
        return bool(v) and v not in ("暂无信息", "暂无数据", "-", "—")

    # 均价
    m = re.search(r'均价[:：]\s*([\d.]+)\s*元', html)
    if m:
        out["avg_price"] = _safe_float(m.group(1))
    # 坐标
    mm = re.search(r'resblockPosition["\':,\s]+([\d.]+),([\d.]+)', html)
    if mm:
        out["lng"] = _safe_float(mm.group(1))
        out["lat"] = _safe_float(mm.group(2))
    # 建成年代（"2008年建成" / "2008"）
    by = info.get("建成年代", "")
    if _has(by):
        ym = re.search(r'(\d{4})', by)
        if ym:
            out["build_year_start"] = int(ym.group(1))
    # 房屋总数 / 楼栋总数
    if _has(info.get("房屋总数", "")):
        n = _safe_int(info["房屋总数"])
        if n:
            out["total_units"] = n
    if _has(info.get("楼栋总数", "")):
        n = _safe_int(info["楼栋总数"])
        if n:
            out["total_buildings"] = n
    # 绿化率 / 容积率
    if _has(info.get("绿化率", "")):
        gr = re.search(r'([\d.]+)', info["绿化率"])
        if gr:
            out["green_rate"] = round(float(gr.group(1)) / 100, 4)
    if _has(info.get("容积率", "")):
        pr = re.search(r'([\d.]+)', info["容积率"])
        if pr:
            out["plot_ratio"] = float(pr.group(1))
    # 物业费 / 物业公司 / 开发商 / 建筑类型
    if _has(info.get("物业费用", "")):
        out["property_fee"] = info["物业费用"][:64]
    if _has(info.get("物业公司", "")):
        out["property_company"] = info["物业公司"][:128]
    if _has(info.get("开发商", "")):
        out["developer"] = info["开发商"][:128]
    if _has(info.get("建筑类型", "")):
        out["property_type"] = info["建筑类型"][:32]
    # 在售套数（meta 描述里"在售二手房源N套"）
    sc = re.search(r'在售二手房源\s*(\d+)\s*套', html)
    if sc:
        out["on_sale_count"] = int(sc.group(1))

    return out


def build_description(c: CommunityInfo, standard_name: str | None = None) -> str:
    """根据已知字段拼装一段用户友好的小区简介。"""
    parts: list[str] = []
    intro = c.name or ""
    # 如果贝壳标准名跟原始名不一样，提示用户
    if standard_name and standard_name != c.name:
        intro += f"（贝壳收录名：{standard_name}）"
    if c.sub_district or c.district:
        loc = " · ".join(filter(None, [c.district, c.sub_district]))
        city_name = city_meta(c.city_id)[1] if getattr(c, "city_id", None) else "上海"
        intro += f"，位于{city_name}{loc}板块"
    intro += "。"
    parts.append(intro)

    if c.address_full:
        parts.append(f"小区地址：{c.address_full}。")

    parts.append(
        "本小区数据由贝壳找房提供，更多详细信息（建成年代、户型分布、物业费、近期成交价等）"
        "可点击下方「在贝壳查看」按钮查看完整资料。"
    )
    return "".join(parts)


async def upsert_community(
    db,
    *,
    name: str,
    fallback_name: str,
    city_id: int,
    sug_data: dict,
    detail: dict | None = None,
) -> CommunityInfo:
    """根据 fallback_name (即数据库里 property.community_name) 做 upsert。

    重要：CommunityInfo.name 必须等于 property.community_name（用户原始名），
    否则后端 API 用 property.community_name 关联不上。
    贝壳标准名（更准确）放在 description 开头展示给用户。
    """
    primary_name = fallback_name  # 严格用原始名做关联键
    standard_name = name or fallback_name

    existing = (
        await db.execute(select(CommunityInfo).where(CommunityInfo.name == primary_name))
    ).scalar_one_or_none()

    district, sub_district = _district_from_region(sug_data.get("region", ""))
    city_en, _ = city_meta(city_id)
    url_path = sug_data.get("url_path") or ""
    beike_url = f"https://{city_en}.ke.com{url_path}" if url_path else None

    now = datetime.now()
    if existing:
        c = existing
        if district:
            c.district = district
        if sub_district:
            c.sub_district = sub_district
        if beike_url:
            c.beike_url = beike_url
        c.city_id = city_id
        c.source = "beike-sug"
        c.last_crawled_at = now
        # 把贝壳标准名暂存到 remark
        c.remark = f"贝壳标准名: {standard_name}" if standard_name != primary_name else None
    else:
        c = CommunityInfo(
            name=primary_name,
            district=district,
            sub_district=sub_district,
            city_id=city_id,
            beike_url=beike_url,
            source="beike-sug",
            last_crawled_at=now,
            remark=(f"贝壳标准名: {standard_name}" if standard_name != primary_name else None),
        )
        db.add(c)

    # 写入详情页富字段（仅覆盖抓到的，不清空已有）
    detail = detail or {}
    _DETAIL_FIELDS = (
        "avg_price", "lat", "lng", "build_year_start", "total_units",
        "total_buildings", "green_rate", "plot_ratio", "property_fee",
        "property_company", "developer", "property_type", "on_sale_count",
    )
    for f in _DETAIL_FIELDS:
        if detail.get(f) is not None:
            setattr(c, f, detail[f])
    if detail:
        c.source = "beike-detail"
        c.price_update_at = now

    # 描述里展示贝壳标准名（让用户感知到匹配关系）
    c.description = build_description(c, standard_name=standard_name)
    await db.commit()
    await db.refresh(c)
    return c


async def crawl_one(
    client: httpx.AsyncClient, db, community_name: str, city_id: int
) -> CommunityInfo | None:
    """对单个小区名抓贝壳数据。"""
    if not community_name:
        return None

    logger.info(f"[beike] sug: '{community_name}'")
    sug = await search_via_sug_api(client, city_id, community_name)

    if not sug:
        # 尝试简化关键词（去掉"路 N 弄"再搜）
        simplified = re.sub(r"\d+弄.*$", "", community_name).strip()
        if simplified and simplified != community_name and len(simplified) >= 2:
            logger.info(f"[beike] 简化关键词重试: '{simplified}'")
            sug = await search_via_sug_api(client, city_id, simplified)

    if not sug:
        logger.info(f"[beike] 贝壳未匹配: '{community_name}'")
        # 仍然 upsert 一条，标记为 not-found，避免反复抓
        return None

    logger.info(f"[beike] 命中: '{community_name}' → '{sug['name']}' (id={sug['id']})")
    # 抓详情页富字段（均价/建成年代/户数/物业费/容积率等）
    detail: dict = {}
    try:
        detail = await fetch_community_detail(client, city_id, sug["id"])
        if detail:
            logger.info(f"[beike] 详情页解析到 {len(detail)} 个字段: {list(detail.keys())}")
        else:
            logger.warning(f"[beike] 详情页未解析到富字段（id={sug['id']}），仅存基础信息")
    except Exception as e:
        logger.warning(f"[beike] 详情页抓取异常 id={sug['id']}: {e}")

    return await upsert_community(
        db,
        name=sug["name"],
        fallback_name=community_name,
        city_id=city_id,
        sug_data=sug,
        detail=detail,
    )


async def crawl_for_property(property_id: int) -> CommunityInfo | None:
    db = await get_session()
    try:
        p = (
            await db.execute(select(Property).where(Property.id == property_id))
        ).scalar_one_or_none()
        if not p or not p.community_name:
            logger.warning(f"[beike] 房源 {property_id} 不存在或无小区名")
            return None
        async with httpx.AsyncClient(follow_redirects=True) as client:
            return await crawl_one(client, db, p.community_name, p.city_id or 310000)
    finally:
        await db.close()


async def backfill_all(
    city: str | None = None, limit: int = 50, force: bool = False
) -> tuple[int, int]:
    db = await get_session()
    updated = 0
    skipped = 0
    try:
        q = (
            select(Property.community_name, Property.city_id)
            .where(Property.community_name != "")
            .distinct()
        )
        if city:
            from crawler.cleaners.city import standardize_city
            _, cid = standardize_city(city)
            q = q.where(Property.city_id == cid)

        rows = (await db.execute(q)).all()
        seen: set[str] = set()
        targets: list[tuple[str, int]] = []
        for name, city_id in rows:
            if not name or name in seen:
                continue
            seen.add(name)
            targets.append((name, city_id or 310000))
            if len(targets) >= limit:
                break

        cutoff = datetime.now() - timedelta(days=30)
        async with httpx.AsyncClient(follow_redirects=True) as client:
            for name, city_id in targets:
                if not force:
                    existing = (
                        await db.execute(
                            select(CommunityInfo).where(CommunityInfo.name == name)
                        )
                    ).scalar_one_or_none()
                    if existing and existing.last_crawled_at and existing.last_crawled_at > cutoff:
                        skipped += 1
                        continue
                try:
                    c = await crawl_one(client, db, name, city_id)
                    if c:
                        updated += 1
                except Exception as e:
                    logger.error(f"[beike] crawl_one 异常 {name}: {e}")
                # 速率限制 1.5s（sug API 比较宽松）
                await asyncio.sleep(1.5)
    finally:
        await db.close()
    return updated, skipped


async def _main():
    import argparse

    parser = argparse.ArgumentParser(description="贝壳小区抓取（sug API 模式）")
    parser.add_argument("--city", choices=["上海", "宁波"])
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--property-id", type=int)
    args = parser.parse_args()

    if args.property_id:
        c = await crawl_for_property(args.property_id)
        logger.info(f"完成：{c.name if c else '失败'}")
    else:
        updated, skipped = await backfill_all(args.city, args.limit, args.force)
        logger.info(f"完成：更新 {updated} / 跳过 {skipped}")


if __name__ == "__main__":
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")
    asyncio.run(_main())
import asyncio
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from loguru import logger
from sqlalchemy import select, update

BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.models.community import CommunityInfo  # noqa: E402
from app.models.property import Property  # noqa: E402
from crawler.storage.db import get_session  # noqa: E402
from crawler.config import settings  # noqa: E402

BEIKE_CITY_MAP = {
    "上海": "sh",
    "宁波": "nb",
    "杭州": "hz",
    310000: "sh",
    330200: "nb",
    330100: "hz",
}

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/132.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Cache-Control": "no-cache",
}


def city_code(city_id_or_name) -> str:
    return BEIKE_CITY_MAP.get(city_id_or_name, "sh")


def _build_headers() -> dict:
    headers = dict(DEFAULT_HEADERS)
    if settings.BEIKE_COOKIE:
        headers["Cookie"] = settings.BEIKE_COOKIE
    return headers


# === 代理 + 验证墙检测（D 方案：靠住宅代理 IP 池绕过 IP 风控）===
# 贝壳/链家撞验证时会 302 跳到 captcha 域名，或返回验证页关键词。
_CAPTCHA_HOST_HINTS = ("captcha", "hip.ke.com", "antirobot", "verify")
_CAPTCHA_TEXT_HINTS = ("人机验证", "安全验证", "请完成验证", "滑块", "请输入验证码")


def _make_client(proxy: str | None) -> httpx.AsyncClient:
    """创建 httpx client，可选走代理。proxy 为 None 时直连（无代理则退化为原行为）。"""
    kwargs = dict(headers=_build_headers(), follow_redirects=True, timeout=25)
    if proxy:
        kwargs["proxy"] = proxy
    return httpx.AsyncClient(**kwargs)


def _is_captcha_response(resp) -> bool:
    """判断响应是否被风控拦到验证页。"""
    try:
        final = str(resp.url).lower()
        if any(h in final for h in _CAPTCHA_HOST_HINTS):
            return True
        # 验证页通常很短且含验证关键词
        if resp.status_code in (202, 403) and len(resp.text) < 4000:
            return True
        head = resp.text[:3000]
        return any(t in head for t in _CAPTCHA_TEXT_HINTS)
    except Exception:
        return False


class CaptchaBlocked(Exception):
    """命中验证墙，需更换代理 IP。"""


def _safe_int(text: str) -> int | None:
    if not text:
        return None
    m = re.search(r"(\d+)", text)
    return int(m.group(1)) if m else None


def _safe_float(text: str) -> float | None:
    if not text:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else None


async def search_community(
    client: httpx.AsyncClient, city_en: str, name: str
) -> dict | None:
    """在贝壳搜索小区，返回首条匹配的简要信息（avg_price / detail_url / 在售数）。

    优先用 sug API（ajax.api.ke.com，经代理稳定可用）定位小区 id，再构造
    /xiaoqu/{id}/ 详情页 URL；sug 拿不到时回退到搜索列表页（反爬较严）。
    """
    city_id = _city_id_from_en(city_en)
    # 1) 优先 sug API（稳定）
    if city_id:
        try:
            sug = await search_via_sug_api(client, city_id, name)
            if not sug:
                simplified = re.sub(r"\d+弄.*$", "", name).strip()
                if simplified and simplified != name and len(simplified) >= 2:
                    sug = await search_via_sug_api(client, city_id, simplified)
            if sug and sug.get("id"):
                return {
                    "found_name": sug.get("name") or name,
                    "avg_price": 0,
                    "on_sale_count": 0,
                    "detail_url": f"https://{city_en}.ke.com/xiaoqu/{sug['id']}/",
                }
        except Exception as e:
            logger.warning(f"[beike] sug 定位异常 '{name}': {e}")

    # 2) 回退：搜索列表页（反爬较严，可能撞验证墙）
    search_url = f"https://{city_en}.ke.com/xiaoqu/rs{quote(name)}/"
    try:
        resp = await client.get(search_url, timeout=20)

        # 命中验证墙 → 抛出让上层换代理
        if _is_captcha_response(resp):
            raise CaptchaBlocked(search_url)

        if resp.status_code != 200:
            logger.warning(f"[beike] search 状态码 {resp.status_code}: {search_url}")
            return None

        # 检测登录墙
        if "login" in resp.url.path or "请登录" in resp.text:
            logger.warning(f"[beike] 触发登录墙：{search_url}")
            return None

        soup = BeautifulSoup(resp.text, "lxml")

        # 贝壳 2024-2026 版本主要 selector
        items = soup.select(".xiaoquListItem") or soup.select("li[data-id]") or soup.select(".content__list-item")
        if not items:
            return None

        for item in items:
            title_el = (
                item.select_one(".title a")
                or item.select_one("a.maidian-detail")
                or item.select_one(".content__list--item--title a")
            )
            if not title_el:
                continue
            found_name = title_el.get_text(strip=True)
            # 模糊匹配：抓到的小区名要么包含搜索词、要么被搜索词包含
            if name not in found_name and found_name not in name:
                continue

            detail_url = title_el.get("href", "")
            if detail_url and not detail_url.startswith("http"):
                detail_url = f"https://{city_en}.ke.com{detail_url}"

            price_el = (
                item.select_one(".totalPrice span")
                or item.select_one(".xiaoquListItemPrice span")
                or item.select_one(".totalPrice")
            )
            avg_price = _safe_int(price_el.get_text(strip=True) if price_el else "")

            on_sale = item.select_one(".xiaoquListItemSellCount span") or item.select_one(".houseIcon")
            on_sale_count = _safe_int(on_sale.get_text(strip=True) if on_sale else "")

            return {
                "found_name": found_name,
                "avg_price": avg_price or 0,
                "on_sale_count": on_sale_count or 0,
                "detail_url": detail_url,
            }
    except CaptchaBlocked:
        raise
    except Exception as e:
        logger.warning(f"[beike] search 异常 '{name}': {e}")
    return None


async def fetch_detail_page(client: httpx.AsyncClient, url: str) -> dict:
    """抓取贝壳小区详情页的所有有用字段。"""
    if not url:
        return {}

    info: dict = {"beike_url": url}

    try:
        resp = await client.get(url, timeout=25)

        if _is_captcha_response(resp):
            raise CaptchaBlocked(url)

        if resp.status_code != 200:
            logger.warning(f"[beike] detail 状态码 {resp.status_code}: {url}")
            return info

        if "login" in resp.url.path:
            logger.warning(f"[beike] detail 触发登录墙：{url}")
            return info

        soup = BeautifulSoup(resp.text, "lxml")

        # 1) 概览价格区（顶部大字）
        price_el = soup.select_one(".xiaoquPrice .xiaoquUnitPrice") or soup.select_one(".xiaoquPrice")
        if price_el:
            avg = _safe_int(price_el.get_text())
            if avg:
                info["avg_price"] = avg

        # 2) 小区基本信息表（贝壳通用结构：.xiaoquInfoItem）
        for label_el in soup.select(".xiaoquInfoItem"):
            label = (label_el.select_one(".xiaoquInfoLabel") or label_el).get_text(strip=True)
            value_el = label_el.select_one(".xiaoquInfoContent")
            value = value_el.get_text(strip=True) if value_el else ""
            if not value or value == "暂无信息":
                continue

            if "建筑年代" in label or "建成年代" in label:
                m = re.search(r"(\d{4})", value)
                if m:
                    info["build_year_start"] = int(m.group(1))
                m2 = re.search(r"(\d{4}).+?(\d{4})", value)
                if m2:
                    info["build_year_end"] = int(m2.group(2))
            elif "建筑类型" in label or "物业类型" in label:
                for pt in ["板楼", "塔楼", "板塔结合", "住宅", "商业", "办公", "别墅", "商住"]:
                    if pt in value:
                        info["property_type"] = pt
                        break
            elif "建筑结构" in label:
                info.setdefault("remark_struct", value)
            elif "占地面积" in label:
                info.setdefault("remark_area", value)
            elif "容积率" in label:
                info["plot_ratio"] = _safe_float(value)
            elif "绿化率" in label:
                # "30%" → 0.30
                pct = _safe_float(value)
                if pct:
                    info["green_rate"] = pct / 100 if pct > 1 else pct
            elif "楼栋总数" in label or "栋数" in label:
                info["total_buildings"] = _safe_int(value)
            elif "房屋总数" in label or "总户数" in label:
                info["total_units"] = _safe_int(value)
            elif "物业费" in label:
                info["property_fee"] = value[:64]
            elif "物业公司" in label:
                info["property_company"] = value[:128]
            elif "开发商" in label:
                info["developer"] = value[:128]
            elif "附近门店" in label:
                pass  # ignore
            elif "小区地址" in label or "位置" in label:
                info["address_full"] = value[:256]

        # 3) 户型 / 主力户型摘要（详情页常见模块）
        huxing_block = soup.select_one(".houseInfoListItem")
        if huxing_block:
            text = huxing_block.get_text(" ", strip=True)
            info["huxing_summary"] = text[:256]

        # 4) 在售/在租
        for stat in soup.select(".xiaoquHeader .lookFor a") or soup.select(".pieChart"):
            t = stat.get_text(" ", strip=True)
            if "在售" in t:
                info["on_sale_count"] = _safe_int(t)
            elif "在租" in t:
                info["rent_count"] = _safe_int(t)

        # 5) 近 90 天成交（贝壳有的会展示）
        deal_el = soup.find(string=re.compile("近\\s*\\d+\\s*天成交"))
        if deal_el:
            text = str(deal_el)
            count = _safe_int(text)
            if count is not None:
                info["recent_deal_count_30d"] = count

        return info
    except CaptchaBlocked:
        raise
    except Exception as e:
        logger.warning(f"[beike] detail 异常 {url}: {e}")
        return info


def build_description(c: CommunityInfo, info: dict) -> str:
    """根据抓到的字段拼装一段用户友好的小区介绍（小程序"小区详情"tab 直接显示）。"""
    parts: list[str] = []
    name = c.name

    intro = f"{name}"
    if info.get("address_full") or c.address_full:
        intro += f"位于{info.get('address_full') or c.address_full}"
    elif c.district:
        intro += f"位于{c.district}"
    intro += "。"

    if info.get("build_year_start") or c.build_year_start:
        y = info.get("build_year_start") or c.build_year_start
        intro += f"小区建成于 {y} 年，"
    if info.get("property_type") or c.property_type:
        intro += f"物业类型为{info.get('property_type') or c.property_type}，"
    if info.get("total_units") or c.total_units:
        intro += f"共{info.get('total_units') or c.total_units}户"
    if info.get("total_buildings") or c.total_buildings:
        intro += f"、{info.get('total_buildings') or c.total_buildings}栋楼"
    if info.get("total_units") or info.get("total_buildings") or c.total_units or c.total_buildings:
        intro += "。"

    parts.append(intro.rstrip("，。") + "。")

    if info.get("plot_ratio") or info.get("green_rate"):
        line = "规划方面，"
        if info.get("plot_ratio"):
            line += f"容积率 {info['plot_ratio']:.2f}"
        if info.get("plot_ratio") and info.get("green_rate"):
            line += "，"
        if info.get("green_rate"):
            line += f"绿化率 {info['green_rate']*100:.0f}%"
        parts.append(line + "。")

    if info.get("developer") or c.developer:
        parts.append(f"开发商：{info.get('developer') or c.developer}。")
    if info.get("property_company"):
        parts.append(f"物业公司：{info['property_company']}。")
    if info.get("property_fee"):
        parts.append(f"物业费：{info['property_fee']}。")

    if info.get("avg_price") or c.avg_price:
        avg = info.get("avg_price") or c.avg_price
        parts.append(f"贝壳参考均价：{avg:,.0f} 元/㎡。")
    if info.get("on_sale_count"):
        parts.append(f"目前在售房源 {info['on_sale_count']} 套。")

    return "".join(parts) or f"{name} · 暂无详细资料。"


async def upsert_community(
    db,
    name: str,
    district: str,
    city_id: int,
    info: dict,
    found_name: str | None = None,
) -> CommunityInfo:
    """根据小区名 upsert（按 name 唯一）。返回最终的 CommunityInfo 实例。"""
    existing = (
        await db.execute(select(CommunityInfo).where(CommunityInfo.name == name))
    ).scalar_one_or_none()

    now = datetime.now()
    fields = {
        "district": district or (existing.district if existing else ""),
        "city_id": city_id,
        "source": "beike",
        "last_crawled_at": now,
    }
    for k in (
        "avg_price", "build_year_start", "build_year_end", "property_type",
        "total_buildings", "total_units", "developer", "plot_ratio", "green_rate",
        "property_company", "property_fee", "huxing_summary", "address_full",
        "recent_deal_count_30d", "recent_avg_price_30d", "on_sale_count", "rent_count",
        "beike_url",
    ):
        if info.get(k) is not None:
            fields[k] = info[k]

    if "avg_price" in fields:
        fields["price_update_at"] = now

    if existing:
        c = existing
        for k, v in fields.items():
            setattr(c, k, v)
    else:
        c = CommunityInfo(name=name, **fields)
        db.add(c)

    # 拼装富文本介绍
    c.description = build_description(c, info)
    await db.commit()
    await db.refresh(c)
    return c


async def crawl_one(
    client: httpx.AsyncClient, db, community_name: str, district: str, city_id: int
) -> CommunityInfo | None:
    """抓取并写库一个小区。"""
    if not community_name:
        return None

    city_en = city_code(city_id) or city_code(district.split("区")[0] if district else None) or "sh"
    logger.info(f"[beike] crawl: {community_name} ({city_en})")

    summary = await search_community(client, city_en, community_name)
    if not summary:
        logger.info(f"[beike] 未找到匹配小区：{community_name}")
        # 贝壳完全没命中：尝试用补充源（中原等）兜底。默认关闭，开启后才工作，
        # 不影响现有贝壳逻辑。
        return await _try_supplement_only(db, community_name, district, city_id)

    info: dict = {
        "avg_price": summary.get("avg_price"),
        "on_sale_count": summary.get("on_sale_count"),
    }
    if summary.get("detail_url"):
        await asyncio.sleep(2)
        detail = await fetch_detail_page(client, summary["detail_url"])
        for k, v in detail.items():
            if v is not None:
                info[k] = v

    c = await upsert_community(
        db, community_name, district, city_id, info, found_name=summary.get("found_name")
    )
    # 贝壳已命中：若仍有字段缺失，用补充源（中原等）补齐。默认关闭。
    await _apply_supplement(db, c)
    return c


async def _apply_supplement(db, community) -> None:
    """对一条已存在的 CommunityInfo 调用多源补充框架补齐缺失字段并提交。

    全程 try/except 包裹：补充源（含 Playwright/瑞数/代理）任何异常都不得
    影响贝壳主流程已写入的数据。"""
    if community is None:
        return
    try:
        from .community_sources import supplement_fields
        applied = await supplement_fields(community)
        if applied:
            await db.commit()
            await db.refresh(community)
            logger.info(f"[supplement] {community.name} 补充字段已落库: {list(applied.keys())}")
    except Exception as e:
        logger.warning(f"[supplement] {getattr(community, 'name', '?')} 补充失败（不影响贝壳数据）: {e}")
        try:
            await db.rollback()
        except Exception:
            pass


async def _try_supplement_only(
    db, community_name: str, district: str, city_id: int
) -> CommunityInfo | None:
    """贝壳完全未命中时，仅靠补充源建档。默认关闭时返回 None（与原行为一致）。"""
    try:
        from .config import settings
        if not getattr(settings, "COMMUNITY_SUPPLEMENT_ENABLED", False):
            return None
        from .community_sources import supplement_fields
        # 先 upsert 一条最小记录（仅名字/区/城市），再让补充源填充
        c = await upsert_community(db, community_name, district, city_id, {})
        applied = await supplement_fields(c)
        if applied:
            await db.commit()
            await db.refresh(c)
            logger.info(f"[supplement] (贝壳未命中) {community_name} 由补充源建档: {list(applied.keys())}")
            return c
        return c
    except Exception as e:
        logger.warning(f"[supplement] (贝壳未命中) {community_name} 补充失败: {e}")
        try:
            await db.rollback()
        except Exception:
            pass
        return None


async def crawl_for_property(property_id: int) -> CommunityInfo | None:
    """单个房源触发：根据其 community_name 抓取小区详情。供管理后台一键调用。"""
    db = await get_session()
    try:
        p = (
            await db.execute(select(Property).where(Property.id == property_id))
        ).scalar_one_or_none()
        if not p or not p.community_name:
            logger.warning(f"[beike] 房源 {property_id} 不存在或无小区名")
            return None

        from .anti_block import get_proxy_pool
        from . import tunnel_proxy
        pool = get_proxy_pool()
        proxy = pool.get() if pool.has_proxies() else None

        # 撞验证墙时换出口 IP 重试（隧道代理：入口不变，换出口）
        max_attempts = 4 if tunnel_proxy.is_enabled() else 1
        for attempt in range(max_attempts):
            client = _make_client(proxy)
            try:
                return await crawl_one(client, db, p.community_name, p.district or "", p.city_id or 310000)
            except CaptchaBlocked as e:
                if tunnel_proxy.is_enabled() and attempt < max_attempts - 1:
                    logger.warning(f"[beike] 撞验证墙(第{attempt+1}次)，换IP重试：{e}")
                    await asyncio.to_thread(tunnel_proxy.trigger_ip_change, "beike captcha", force=True)
                    await asyncio.sleep(4)
                    continue
                pool.mark_bad(proxy, reason="captcha")
                logger.error(f"[beike] 单房源抓取撞验证墙：{e}（已换IP仍被封或无代理）")
                return None
            finally:
                await client.aclose()
        return None
    finally:
        await db.close()


async def backfill_all(city: str | None = None, limit: int = 50, force: bool = False) -> tuple[int, int]:
    """扫描所有 community_name 不为空的房源，依次抓取。
    返回 (新增/更新数, 跳过数)。
    """
    db = await get_session()
    updated = 0
    skipped = 0
    try:
        # 找出去重后的小区名集合
        q = (
            select(Property.community_name, Property.district, Property.city_id)
            .where(Property.community_name != "")
            .distinct()
        )
        if city:
            from crawler.cleaners.city import standardize_city
            _, cid = standardize_city(city)
            q = q.where(Property.city_id == cid)

        rows = (await db.execute(q)).all()
        seen: set[str] = set()
        target_list: list[tuple[str, str, int]] = []
        for name, district, city_id in rows:
            if not name or name in seen:
                continue
            seen.add(name)
            target_list.append((name, district or "", city_id or 310000))
            if len(target_list) >= limit:
                break

        cutoff = datetime.now() - timedelta(days=30)

        # === 代理池接入（D 方案）===
        from .anti_block import get_proxy_pool
        pool = get_proxy_pool()
        proxy = pool.get() if pool.has_proxies() else None
        if pool.has_proxies():
            logger.info(f"[beike] 启用代理池，当前代理：{proxy}")
        else:
            logger.warning("[beike] 未配置 PROXY_POOL，直连抓取（贝壳风控下大概率撞验证墙）")

        client = _make_client(proxy)
        # 连续撞墙计数：换了 N 个代理仍撞墙就早停，不空跑
        captcha_streak = 0
        MAX_CAPTCHA_STREAK = 3
        try:
            for name, district, city_id in target_list:
                # 命中缓存（30 天内已抓过）
                if not force:
                    existing = (
                        await db.execute(
                            select(CommunityInfo).where(CommunityInfo.name == name)
                        )
                    ).scalar_one_or_none()
                    if existing and existing.last_crawled_at and existing.last_crawled_at > cutoff:
                        skipped += 1
                        logger.debug(f"[beike] 缓存命中 {name}（{existing.last_crawled_at}）")
                        continue

                try:
                    c = await crawl_one(client, db, name, district, city_id)
                    if c:
                        updated += 1
                    captcha_streak = 0  # 成功一次就清零
                except CaptchaBlocked as e:
                    captcha_streak += 1
                    logger.warning(f"[beike] 撞验证墙({captcha_streak}/{MAX_CAPTCHA_STREAK}) {e}")
                    from . import tunnel_proxy
                    # 隧道代理：换出口 IP 后重建 client（入口不变）
                    if tunnel_proxy.is_enabled():
                        if captcha_streak >= MAX_CAPTCHA_STREAK:
                            logger.error(f"[beike] 连续 {MAX_CAPTCHA_STREAK} 次撞墙（已换IP仍被封）→ 早停")
                            break
                        await asyncio.to_thread(tunnel_proxy.trigger_ip_change, "beike captcha")
                        await asyncio.sleep(3)
                        await client.aclose()
                        client = _make_client(proxy)  # 入口不变，新出口已生效
                        logger.info("[beike] 已换出口IP，重建 client 继续")
                        continue
                    if not pool.has_proxies():
                        logger.error("[beike] 无代理可换，且已撞验证墙 → 终止贝壳抓取")
                        break
                    pool.mark_bad(proxy, reason="captcha")
                    if captcha_streak >= MAX_CAPTCHA_STREAK:
                        logger.error(f"[beike] 连续 {MAX_CAPTCHA_STREAK} 次撞墙，所有代理疑似被封 → 早停")
                        break
                    # 换下一个代理重建 client
                    await client.aclose()
                    proxy = pool.get()
                    if not proxy:
                        logger.error("[beike] 代理池已无可用 IP（全部冷却中）→ 早停")
                        break
                    logger.info(f"[beike] 切换代理：{proxy}")
                    client = _make_client(proxy)
                    continue
                except Exception as e:
                    logger.error(f"[beike] crawl_one 异常 {name}: {e}")

                # 速率限制：4-6s
                await asyncio.sleep(5)
        finally:
            await client.aclose()
    finally:
        await db.close()

    return updated, skipped


# ===== CLI =====
async def _main():
    import argparse

    parser = argparse.ArgumentParser(description="贝壳小区详情抓取")
    parser.add_argument("--city", choices=["上海", "宁波"], help="只抓某城市")
    parser.add_argument("--limit", type=int, default=50, help="本次最多抓多少小区")
    parser.add_argument("--force", action="store_true", help="忽略 30 天缓存")
    parser.add_argument("--property-id", type=int, help="只抓某个房源对应的小区")
    args = parser.parse_args()

    if args.property_id:
        c = await crawl_for_property(args.property_id)
        logger.info(f"完成：{c.name if c else '失败'}")
    else:
        updated, skipped = await backfill_all(args.city, args.limit, args.force)
        logger.info(f"完成：更新 {updated} / 跳过 {skipped}")


if __name__ == "__main__":
    from crawler.utils.logger import setup_logger
    setup_logger("INFO")
    asyncio.run(_main())
