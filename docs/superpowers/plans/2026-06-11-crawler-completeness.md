# 爬虫核心字段+覆盖+过滤+每日更新 完善计划 (限时:明天02:00前)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** 在明天凌晨爬虫启动前,补齐评估价兜底、公拍杭州类型B、阿里/公拍类目映射、京东省级城市误判防护,并把 upsert 改为"动态字段强刷/静态字段保留",让明天跑出更完整、更准、每日正确更新的数据。

**Architecture:** 全部为低风险增量改动,不动抓取主流程。新增正则兜底/配置/映射,改 upsert 字段策略。每项独立可验证(单测或样本)。

**Tech Stack:** Python 爬虫;改动集中在 crawler/cleaners、crawler/parsers、crawler/utils、crawler/storage。

**约束:** 部署目标 /opt/fapai(属主 ubuntu,爬虫用 /opt/fapai/venv);改完热部署,下轮 02:00 自然生效,不手动补跑(用户已定)。

---

## 文件结构

| 文件 | 改动 | 任务 |
|------|------|------|
| `crawler/cleaners/field_miner.py` | 新增 `mine_appraisal_price()` + 接入 `apply_text_fallbacks` | T1 |
| `crawler/utils/url_registry.py` | 公拍杭州补 at=381 一条 | T2 |
| `crawler/parsers/taobao_paimai_detail.py` | CATEGORY_MAP 补"办公" + 标题猜测补办公关键词 | T3 |
| `crawler/parsers/gpai_detail.py` | 类目标准化补工业/办公 | T4 |
| `crawler/parsers/jd_detail.py` | 省级搜索城市误判防护(district 为空且 province 仅省级时收紧) | T5 |
| `crawler/storage/repository.py` | upsert 动态字段强刷/静态字段保留 | T6 |
| `crawler/tests/test_field_miner_appraisal.py` | 新增单测 | T1 |
| `crawler/tests/test_upsert_policy.py` | 新增单测 | T6 |

> 注:crawler/tests/ 可能不存在,T1 第一步会创建并加 `__init__.py`。

---

## Task 1: 评估价正文兜底 mine_appraisal_price()(最高优先)

**背景:** 评估价是6核心字段里最脆弱的——三平台都只从结构化字段取,缺了就是0,`apply_text_fallbacks` 里没有它的兜底。公告正文常有"评估价/评估值/市场价为XX万元"。

**Files:**
- Test: `crawler/tests/test_field_miner_appraisal.py`(新建)
- Modify: `crawler/cleaners/field_miner.py`(新增函数 + 接入入口)

- [ ] **Step 1: 建测试目录(若无)+写失败测试**

先确保目录存在:`crawler/tests/__init__.py`(空文件,若不存在则建)。

创建 `crawler/tests/test_field_miner_appraisal.py`:

```python
"""mine_appraisal_price 评估价正文兜底单测。无需DB/pytest,可直接跑:
    cd crawler && python -m tests.test_field_miner_appraisal
"""
import sys
from pathlib import Path

_CRAWLER = Path(__file__).resolve().parent.parent
if str(_CRAWLER) not in sys.path:
    sys.path.insert(0, str(_CRAWLER))

from cleaners.field_miner import mine_appraisal_price  # noqa: E402

_CASES = [
    ("经评估,该房产评估价为350万元", 3_500_000, "评估价为X万元"),
    ("房屋评估价值：280.5万元", 2_805_000, "评估价值X万"),
    ("评估单价不计,市场价约500万元", 5_000_000, "市场价X万"),
    ("起拍价300万元,保证金30万元", 0, "无评估价表述→0(不被起拍价误命中)"),
    ("评估总价人民币12,000,000元", 12_000_000, "带千分位的元"),
    ("", 0, "空文本→0"),
]


def test_mine_appraisal_price():
    for text, expect, desc in _CASES:
        got = mine_appraisal_price(text)
        assert got == expect, f"{desc}: {text!r} -> {got}, expect {expect}"


if __name__ == "__main__":
    test_mine_appraisal_price()
    print(f"mine_appraisal_price 单测通过({len(_CASES)} 例)")
```

- [ ] **Step 2: 运行确认失败**

Run: `cd crawler && python -m tests.test_field_miner_appraisal`
Expected: FAIL — `ImportError: cannot import name 'mine_appraisal_price'`

- [ ] **Step 3: 实现 mine_appraisal_price()**

在 `crawler/cleaners/field_miner.py` 的 `mine_deposit()` 函数之后(第125行 `return 0` 之后、`_money_with_unit` 之前)新增:

```python
def mine_appraisal_price(full_text: str) -> int:
    """从全文兜底挖评估价/市场价（元）。覆盖 评估价/评估值/评估总价/市场价 等写法。

    注意：负向排除「起拍价/保证金」就近误命中——只认明确的「评估/市场价」标签。
    """
    if not full_text:
        return 0
    patterns = (
        r"评估价(?:值|格)?[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"评估总价[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"房屋评估价?值?[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
        r"市场价(?:值|格)?[为约是：:\s]*[¥￥]?\s*([\d,.]+)\s*(万|亿|元)?",
    )
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            val = _money_with_unit(m.group(1), m.group(2))
            if val > 0:
                return val
    return 0
```

- [ ] **Step 4: 接入 apply_text_fallbacks**

在 `apply_text_fallbacks` 的五字段兜底块里(第217-220行 deposit 兜底之后)追加:

```python
    if not item.appraisal_price or item.appraisal_price <= 0:
        v = mine_appraisal_price(full_text)
        if v > 0:
            item.appraisal_price = v
```

同时把该函数 docstring 里"五字段"措辞改为涵盖评估价(把第192行 `五字段（面积/加价幅度/起拍价/保证金）` 改为 `面积/加价幅度/起拍价/保证金/评估价`)。

- [ ] **Step 5: 运行确认通过**

Run: `cd crawler && python -m tests.test_field_miner_appraisal`
Expected: PASS — `mine_appraisal_price 单测通过(6 例)`

- [ ] **Step 6: 提交**

```bash
git add crawler/cleaners/field_miner.py crawler/tests/test_field_miner_appraisal.py crawler/tests/__init__.py
git commit -m "feat(crawler): 评估价正文兜底mine_appraisal_price+接入兜底入口"
```

---

## Task 2: 公拍网杭州补 at=381 配置

**背景:** 上海/宁波各有 at=376+at=381 两条,杭州只有 at=376,漏掉 at=381 资产类型的房源。

**Files:**
- Modify: `crawler/utils/url_registry.py`(杭州配置后追加一条)

- [ ] **Step 1: 追加杭州 at=381 配置**

在 `crawler/utils/url_registry.py` 杭州那条 SourceConfig(label="公拍网-杭州-住宅代理城市搜索")之后、`# 注:` 注释之前,追加:

```python
    SourceConfig(
        platform="公拍网",
        city="杭州",
        source_url="https://s.gpai.net/sf/search.do?at=381&cityNum=3301",
        label="公拍网-杭州-类型B",
    ),
```

- [ ] **Step 2: 验证配置可加载且杭州有2条**

Run: `cd crawler && python -c "from utils.url_registry import GPAI_CONFIGS; hz=[c for c in GPAI_CONFIGS if c.city=='杭州']; print('杭州配置数:', len(hz)); [print(c.source_url) for c in hz]"`
Expected: `杭州配置数: 2`,且打印出 at=376 和 at=381 两条 URL

- [ ] **Step 3: 提交**

```bash
git add crawler/utils/url_registry.py
git commit -m "feat(crawler): 公拍网杭州补at=381资产类型配置"
```

---

## Task 3: 阿里 CATEGORY_MAP 补"办公"

**背景:** 阿里 CATEGORY_MAP 有住宅/商业/工业/其他/土地,缺"办公",办公房源被归"其他"或靠标题猜。

**Files:**
- Modify: `crawler/parsers/taobao_paimai_detail.py`(CATEGORY_MAP + 标题猜测)

- [ ] **Step 1: 看标题猜测函数现状**

先读 `crawler/parsers/taobao_paimai_detail.py:455-470`(标题二次猜测类型的逻辑),确认是否已含"办公/写字楼"关键词。

- [ ] **Step 2: CATEGORY_MAP 补办公(若有明确 category_id)**

注意:阿里"办公"的真实 category_id 需 MTOP 返回值佐证,**不臆造数字**。本任务安全做法:不往 CATEGORY_MAP 塞猜的 id,改为**强化标题猜测兜底**——在标题猜测逻辑里确保"写字楼/办公楼/办公用房/办公"→"办公"。

在 `taobao_paimai_detail.py` 标题猜测类型处,确保含办公分支(若已有则跳过,若无则补)。参考 jd_detail 的 `_guess_property_type` 关键词:`写字楼/办公楼/办公用房/办公室/办公`。具体改法:在该函数的商业判断之前加办公判断:

```python
        if any(k in t for k in ("写字楼", "办公楼", "办公用房", "办公室", "办公")):
            return "办公"
```

(`t` 为标题变量名,按实际代码调整。)

- [ ] **Step 3: 验证编译 + 办公识别**

Run: `cd crawler && python -c "import ast; ast.parse(open('parsers/taobao_paimai_detail.py',encoding='utf-8').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 4: 提交**

```bash
git add crawler/parsers/taobao_paimai_detail.py
git commit -m "feat(crawler): 阿里标题类型识别补办公分类"
```

---

## Task 4: 公拍网类目标准化补工业/办公

**背景:** gpai_detail 现在只把"店铺/商铺/商业/办公→商业"、"住宅/公寓/别墅→住宅",办公被错并入商业,工业未标准化。

**Files:**
- Modify: `crawler/parsers/gpai_detail.py:356-362`

- [ ] **Step 1: 改写类目标准化分支**

把 `gpai_detail.py` 第356-362行:

```python
            # Normalize GPai types: 店铺/商铺→商业, 公寓/住宅→住宅
            if any(w in ptype for w in ("店铺", "商铺", "商业", "办公")):
                item.property_type = "商业"
            elif any(w in ptype for w in ("住宅", "公寓", "别墅")):
                item.property_type = "住宅"
            else:
                item.property_type = ptype
```

改为(办公/工业独立成类,顺序:先办公、工业,再商业、住宅):

```python
            # Normalize GPai types → 五大类:办公/工业/商业/住宅/其他
            if any(w in ptype for w in ("写字楼", "办公")):
                item.property_type = "办公"
            elif any(w in ptype for w in ("工业", "厂房", "仓库", "车间")):
                item.property_type = "工业"
            elif any(w in ptype for w in ("店铺", "商铺", "商业", "商服")):
                item.property_type = "商业"
            elif any(w in ptype for w in ("住宅", "公寓", "别墅")):
                item.property_type = "住宅"
            else:
                item.property_type = ptype
```

- [ ] **Step 2: 验证编译**

Run: `cd crawler && python -c "import ast; ast.parse(open('parsers/gpai_detail.py',encoding='utf-8').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: 提交**

```bash
git add crawler/parsers/gpai_detail.py
git commit -m "feat(crawler): 公拍网类目标准化补办公/工业独立分类"
```

---

## Task 5: 京东省级搜索城市误判防护

**背景:** 京东宁波/杭州用浙江省 provinceId 搜索。engine.py:511 当 province_city 仅"浙江省"且 city_id∈(330200,330100) 时按目标城市兜底——若实为浙江其他市(嘉兴等)且 district 为空,会被误判放行。注:engine 的 district 白名单(526行)对京东同样生效,本任务只补"district为空时的省级兜底收紧"。

**Files:**
- Modify: `crawler/engine.py:509-519`(省级兜底分支)

- [ ] **Step 1: 收紧省级兜底——要求 district 命中目标城市白名单**

把 `engine.py` 第509-513行:

```python
                        # province_city 仅到省级（如「浙江省」），用本次抓取的目标城市兜底：
                        # 阿里列表用 keyword=城市名 搜出，city_id 即对应城市，地址未能细分时按其归属。
                        elif pc in ("浙江省", "浙江") and city_id in (330200, 330100):
                            auction_item.city_id = city_id
                            auction_item.province_city = "宁波" if city_id == 330200 else "杭州"
```

改为(仅当解析出的 district 属于该目标城市辖区才兜底放行,否则视为浙江其他市跳过):

```python
                        # province_city 仅到省级（如「浙江省」）：仅当解析出的 district 属于
                        # 目标城市(宁波/杭州)辖区白名单才兜底放行；否则可能是浙江其他市
                        # (嘉兴/衢州等,京东省级搜索会混入),跳过。
                        elif pc in ("浙江省", "浙江") and city_id in (330200, 330100):
                            _d = (auction_item.district or "").strip()
                            if _d and _d in VALID_DISTRICTS.get(city_id, set()):
                                auction_item.city_id = city_id
                                auction_item.province_city = "宁波" if city_id == 330200 else "杭州"
                            else:
                                logger.debug(
                                    f"[{platform_name}] Skipping 浙江省级兜底未命中辖区: "
                                    f"district={_d!r} city_id={city_id} — {item.source_url}"
                                )
                                return "skipped_city", None
```

- [ ] **Step 2: 验证编译**

Run: `cd crawler && python -c "import ast; ast.parse(open('engine.py',encoding='utf-8').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: 提交**

```bash
git add crawler/engine.py
git commit -m "feat(crawler): 京东浙江省级搜索收紧,仅辖区命中才兜底放行"
```

---

## Task 6: upsert 动态字段强刷/静态字段保留

**背景:** 现在 upsert 用 `v is not None` 才覆盖,导致 Day2 解析失败返回 None 时旧值锁死;但也使"已下架/已清零"无法反映。用户定的策略:**价格/状态/时间等动态字段每次以新值为准(含变空覆盖);面积/朝向/户型等静态字段保留旧值防解析抖动清空。**

**Files:**
- Test: `crawler/tests/test_upsert_policy.py`(新建,纯函数测策略,不连DB)
- Modify: `crawler/storage/repository.py`(upsert + 抽出策略函数)

- [ ] **Step 1: 写失败测试(测一个纯函数 build_update_data)**

创建 `crawler/tests/test_upsert_policy.py`:

```python
"""upsert 字段更新策略单测:动态字段强刷(含变空)、静态字段保留旧值。
无需DB,测纯函数 build_update_data。
    cd crawler && python -m tests.test_upsert_policy
"""
import sys
from pathlib import Path

_CRAWLER = Path(__file__).resolve().parent.parent
if str(_CRAWLER) not in sys.path:
    sys.path.insert(0, str(_CRAWLER))

from storage.repository import build_update_data, DYNAMIC_FIELDS  # noqa: E402


def test_dynamic_field_overwrites_even_if_empty():
    # 动态字段:新值为0/None也覆盖(反映下架/清零)
    new = {"starting_price": 0, "auction_status": "已撤回"}
    out = build_update_data(new)
    assert out["starting_price"] == 0, "动态字段新值0应覆盖"
    assert out["auction_status"] == "已撤回"


def test_static_field_kept_when_new_is_empty():
    # 静态字段:新值为None/0时不进 update_data(保留旧值)
    new = {"area": None, "orientation": None, "layout": ""}
    out = build_update_data(new)
    assert "area" not in out, "静态字段新值空→不覆盖"
    assert "orientation" not in out
    assert "layout" not in out


def test_static_field_overwrites_when_new_nonempty():
    new = {"area": 88.5, "orientation": "南"}
    out = build_update_data(new)
    assert out["area"] == 88.5
    assert out["orientation"] == "南"


def test_image_urls_excluded():
    new = {"image_urls": ["a.jpg"], "starting_price": 100}
    out = build_update_data(new)
    assert "image_urls" not in out


def test_dynamic_fields_membership():
    # 价格/状态/时间类应在动态集合
    for f in ("starting_price", "auction_status", "auction_end_time", "final_deal_price"):
        assert f in DYNAMIC_FIELDS, f"{f} 应属动态字段"


if __name__ == "__main__":
    test_dynamic_field_overwrites_even_if_empty()
    test_static_field_kept_when_new_is_empty()
    test_static_field_overwrites_when_new_nonempty()
    test_image_urls_excluded()
    test_dynamic_fields_membership()
    print("upsert 字段策略单测全部通过")
```

- [ ] **Step 2: 运行确认失败**

Run: `cd crawler && python -m tests.test_upsert_policy`
Expected: FAIL — `ImportError: cannot import name 'build_update_data'`

- [ ] **Step 3: 实现 DYNAMIC_FIELDS + build_update_data,改 upsert 调用**

在 `crawler/storage/repository.py` 顶部(import 之后、class 之前)新增:

```python
# 「动态字段」:每次重抓以新值为准(即使新值为空/0也覆盖),反映价格调整/状态流转/下架清零。
DYNAMIC_FIELDS = frozenset({
    "starting_price", "starting_unit_price", "appraisal_price",
    "court_discount_rate", "deposit", "increment_amount",
    "market_deal_price", "market_deal_unit_price",
    "auction_status", "auction_round",
    "auction_start_time", "auction_end_time", "online_auction_end_time",
    "final_deal_price", "deal_confirmed",
    "view_count", "participant_count",
})

# 永不参与 update 的字段(主键/创建时间/图片单独处理)。
_UPSERT_EXCLUDE = frozenset({"image_urls", "id", "created_at"})


def build_update_data(item_dict: dict) -> dict:
    """构造 update 字段集:动态字段强刷(含空值覆盖);静态字段仅在新值非空时覆盖。

    静态字段(面积/朝向/户型/地址/坐标等)新值为 None/0/"" 时保留旧值,
    避免某次解析抖动把已抓到的好数据清空。
    """
    out = {}
    for k, v in item_dict.items():
        if k in _UPSERT_EXCLUDE:
            continue
        if k in DYNAMIC_FIELDS:
            out[k] = v  # 动态:无条件覆盖(含 None/0)
        elif v is not None and v != "" and v != 0:
            out[k] = v  # 静态:仅非空覆盖
    return out
```

把 `upsert` 的 update 分支(第85-95行)改为:

```python
        if existing_id:
            # Update existing:动态字段强刷、静态字段保留(见 build_update_data)
            update_data = build_update_data(item.__dict__)
            update_data["updated_at"] = datetime.now()

            await db.execute(
                update(Property).where(Property.id == existing_id).values(**update_data)
            )
            await db.flush()
            return existing_id, "updated"
```

> 注:insert 分支(新增房源)保持不变,仍写入所有非 image_urls 字段。

- [ ] **Step 4: 运行确认通过**

Run: `cd crawler && python -m tests.test_upsert_policy`
Expected: PASS — `upsert 字段策略单测全部通过`

- [ ] **Step 5: 验证 repository 整体可导入(无语法/import 错误)**

Run: `cd crawler && python -c "import ast; ast.parse(open('storage/repository.py',encoding='utf-8').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 6: 提交**

```bash
git add crawler/storage/repository.py crawler/tests/test_upsert_policy.py
git commit -m "feat(crawler): upsert动态字段强刷/静态字段保留,解决每日更新字段锁死"
```

---

## Task 7: 部署到生产 + 验证

**Files:** 无代码改动,部署 + 验证。

- [ ] **Step 1: 跑全部新单测(本地最终回归)**

Run:
```bash
cd crawler && python -m tests.test_field_miner_appraisal && python -m tests.test_upsert_policy
```
Expected: 两个都 PASS。

- [ ] **Step 2: scp 改动文件到生产 /tmp + diff 核对**

改动文件清单:`field_miner.py`、`url_registry.py`、`taobao_paimai_detail.py`、`gpai_detail.py`、`engine.py`、`repository.py`。
scp 到 `ubuntu@122.51.156.252:/tmp/`,逐个 `ssh diff /opt/fapai/crawler/<相对路径> /tmp/<f>` 确认只有目标改动。

- [ ] **Step 3: 备份 + 覆盖 + 修属主 + 语法校验**

```bash
# 服务器上,时间戳备份到 /opt/fapai/_backup/crawler_<ts>/
# 覆盖对应路径(注意子目录:cleaners/parsers/utils/storage)
# chown ubuntu:ubuntu(爬虫属主)
# 用 /opt/fapai/venv/bin/python -B -c 'compile(...)' 逐个语法校验
```

- [ ] **Step 4: 不重启不手动跑(下轮02:00自然生效)**

确认:不需要重启任何 service(爬虫是 oneshot,02:00 由 timer 触发跑新代码)。仅确认文件已就位、语法 OK。

- [ ] **Step 5: 同步改动回 git 并推送**

```bash
# 本地已逐任务提交;此处快进 main 并 push(沿用本项目 main 工作流)
git fetch . feature/v4-round5-spec:main && git push origin main
```

- [ ] **Step 6: 留验证锚点(明天验收用)**

记录明天该查什么:① 评估价非0占比是否上升 ② 公拍杭州房源量是否上升(at=381 生效) ③ 办公/工业类目是否出现 ④ 有无浙江非目标市混入 ⑤ 同一房源价格/状态当日是否随平台变化更新。写入记忆。

---

## 自查结论

- **需求覆盖**:评估价缺失→T1;三地全(公拍杭州)→T2;五类全(阿里办公T3、公拍工业办公T4);外省过滤(京东省级误判T5);每日正确更新→T6。图片广告过滤/非房产过滤经核实**现状已足够**(engine.py 六层动产过滤 + junk_image_filter 四类检测,共用主路径),今晚不动,避免引入风险。
- **占位符**:无 TBD,代码步骤均含完整代码;T3 因阿里 category_id 不可臆造,采用"强化标题猜测"安全兜底并注明。
- **类型一致**:`mine_appraisal_price`(int)与其他 mine_* 一致;`build_update_data`/`DYNAMIC_FIELDS` 命名贯穿 T6 测试与实现;engine 复用既有 `VALID_DISTRICTS`。
- **风险控制**:全部增量改动,不动列表抓取/详情渲染主流程;upsert 改动有单测护栏;不手动补跑,下轮自然生效。
