"""智能字段补全器：从 title / description 中抽取 parser 漏掉的字段。

调用方：
- 爬虫流水线（每个房源入库后）
- 后台一键回填脚本（scripts/backfill_extracted_fields.py）

抽取字段：
- community_name 小区名（从 title 中"X路Y弄"模式）
- sub_district  板块（从 title 中"XX街道/镇"模式）
- layout 户型（从 description 中"X室Y厅"）
- floor_info 楼层（从 title/description 中"X楼/X层"）
- total_floors 总楼层（从 description 中"共X层"）
- has_elevator 电梯（"电梯/无电梯/电梯房/步梯"）
- decoration 装修（"精装/简装/毛坯/中装/豪装"）
- orientation 朝向（"朝南/朝北/南北通透"）
- build_year 建成年代（"199X年/20XX年建"）
- case_number 案号（"(20XX)XX民X初XXXX号"）
"""
import re
from typing import Optional


# === 正则规则 ===
# 小区名：在 title 中找"路名+弄号"或"小区名+号/弄"模式
_RE_COMMUNITY_FROM_TITLE = re.compile(
    r"(?:上海市|宁波市|杭州市|浙江省|海市)?[一-龥]+?(?:区|新区|开发区)"
    r"([一-龥A-Za-z0-9]+?(?:路|街|大道|村|弄)\d*\s*(?:弄|号|号楼)?)"
    r"(?=\d|号|室|楼)"
)

# 户型："3室2厅2卫"、"3房2厅"、"两室一厅"
_RE_LAYOUT = re.compile(
    r"(\d+|一|二|三|四|五|六)(?:室|房)"
    r"(\d+|一|二|三|四|五)?[一-龥]?厅"
    r"(?:(\d+|一|二|三|四|五)?[一-龥]?[卫厨])?"
)

# 楼层："7楼" / "第7层" / "X层" - 从 title 末尾抽
_RE_FLOOR = re.compile(r"(\d+)(?:楼|层|F)\b")
# 总楼层："共7层" / "总7层"
_RE_TOTAL_FLOORS = re.compile(r"(?:共|总|高)\s*(\d+)\s*层")

# 电梯
_RE_ELEVATOR_YES = re.compile(r"(?:配备|有|带|含)电梯|电梯房")
_RE_ELEVATOR_NO = re.compile(r"无电梯|步梯|多层楼梯|楼梯房")

# 装修
_RE_DECORATION = re.compile(r"(豪华装修|精装修|精装|中等装修|中装|简装修|简装|毛坯|未装修|清水)")

# 朝向
_RE_ORIENTATION = re.compile(
    r"(南北通透|朝南北|南北朝向|朝南偏[东西]|"
    r"朝(?:东南|西南|东北|西北|东|西|南|北)|"
    r"(?:东南|西南|东北|西北|东|西|南|北)向)"
)

# 建成年代
_RE_BUILD_YEAR = re.compile(r"(?:建于|竣工|建成于|建成|建造于|始建于|于)?\s*(19\d{2}|20[0-3]\d)\s*年")

# 案号："(2025)沪01民初123号" / "(2024)X1民初XXX号"
_RE_CASE_NUMBER = re.compile(
    r"[（(]\s*(\d{4})\s*[）)]"
    r"\s*[一-龥A-Za-z0-9]{2,8}"
    r"民(?:初|辖|执|终)\s*\d+\s*号"
)

# 板块（街道/镇/乡）。板块名取「街道/镇/乡」前 2-4 个汉字,
# 但需剔除行政前缀(省/市/区/县/自治区等),避免提到「市松江区泗泾镇」这种脏值。
_RE_SUB_DISTRICT = re.compile(r"([一-龥]{2,6}(?:街道|镇|乡))")
# 板块名里若残留行政区前缀,贪婪匹配到最后一个「区/市/县」,之后才是真正的板块名。
_RE_ADMIN_PREFIX = re.compile(r"^.*[市区县旗盟]")

# 商业地产强特征词:标题命中这些词,即使平台 category 标成「住宅」也应修正为商业。
# 保守口径——只收歧义低的强信号词,避免把真住宅误判成商业。
_RE_COMMERCIAL_TITLE = re.compile(
    r"商业中心|商务中心|写字楼|商务楼|商业楼|商铺|店铺|门面|档口|"
    r"办公楼|办公用房|写字间|商业用房|商业房|loft|LOFT|"
    r"国际大厦|金座|银座|商城|购物中心|商业广场|商业街"
)

# 「用途」字段(标的调查表/权证里的土地用途·房屋用途)——分类的最高权威依据。
# 详情正文里形如:「土地用途:工业用地」「地类(用途):工业用地」「房屋用途:店铺」
# 「用途:其他商服用地」等。匹配「用途」附近的值,映射到标准房产类型。
_RE_USE_FIELD = re.compile(r"(?:土地用途|房屋用途|地类[（(]?用途[）)]?|用途)[：:\s]*([一-龥/]{2,12})")


def classify_by_use(description: str) -> str:
    """从详情正文的「用途」字段判定房产类型。返回标准类型或 ""(无法判定)。
    优先级最高——这是标的调查表/不动产权证里的权威用途。
    """
    if not description:
        return ""
    for m in _RE_USE_FIELD.finditer(description):
        val = m.group(1)
        # 工业
        if "工业" in val:
            return "工业"
        # 商服/商业/办公/店铺 → 商业
        if any(k in val for k in ("商服", "商业", "办公", "店铺", "商务", "市场")):
            return "商业"
        # 住宅(城镇住宅/普通住宅/住宅用地)
        if "住宅" in val:
            return "住宅"
    return ""


# 商用细分:在「商业/办公」大类下,按标题+用途细分为 商铺/写字楼/商住房/其他商用。
def classify_commercial_subtype(title: str, description: str = "") -> str:
    """把商用房细分:商铺 / 写字楼 / 商住房 / 其他商用。判不出归「其他商用」。"""
    text = f"{title or ''} {description or ''}"
    # 商铺:沿街店铺/门面/商铺/档口
    if any(k in text for k in ("商铺", "店铺", "门面", "门市", "档口", "商业用房", "底商")):
        return "商铺"
    # 写字楼:办公/写字楼/写字间
    if any(k in text for k in ("写字楼", "写字间", "办公楼", "办公用房", "办公室", "办公")):
        return "写字楼"
    # 商住房:商住两用/公寓/loft/酒店式公寓
    if any(k in text for k in ("商住", "公寓", "loft", "LOFT", "酒店式", "商务公寓")):
        return "商住房"
    return "其他商用"


def refine_property_type(property_type: str, title: str, description: str = "") -> str:
    """修正并细化房产类型。最终 property_type 取值:
       住宅 / 商铺 / 写字楼 / 商住房 / 其他商用 / 工业 / 车位 / 土地 / 其他。
    优先级:① 详情「用途」字段(权威大类) ② 标题强商业特征(兜底→商业)。
    判为「商业/办公」大类后,进一步用 classify_commercial_subtype 细分到具体商用类型。
    """
    pt = (property_type or "").strip()
    # 车位/车库:标题明确是车位的,保持不动(用途字段对车位常缺失/误导)
    if title and ("车位" in title or "车库" in title):
        return property_type

    # ① 最高优先级:详情「用途」字段判大类
    big = classify_by_use(description)
    if not big:
        # ② 兜底:标题强商业特征(仅对 住宅/其他/空 做 →商业 单向修正)
        if title and pt in ("", "住宅", "其他") and _RE_COMMERCIAL_TITLE.search(title):
            big = "商业"
        else:
            big = pt

    # 商业/办公大类 → 细分到 商铺/写字楼/商住房/其他商用
    if big in ("商业", "办公"):
        return classify_commercial_subtype(title, description)
    return big or property_type


# Chinese number to int
_CN_NUM = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def _to_int(s: str) -> int:
    if not s:
        return 0
    if s.isdigit():
        return int(s)
    if s in _CN_NUM:
        return _CN_NUM[s]
    return 0


def extract_community_name(title: str) -> Optional[str]:
    """从 title 中提取小区名。

    title 格式举例：
    - "上海市金山区龙轩路1998弄114号802室" → "龙轩路1998弄"
    - "上海市浦东新区齐恒路177弄9号1104室" → "齐恒路177弄"
    - "上海市宝山区共和新路5000弄6号815室" → "共和新路5000弄"
    - "上海市闵行区都市路X号商铺" → "都市路X号"
    """
    if not title:
        return None

    # 方案 1: "X路/街/大道YYYY弄" 模式（最常见）
    m = re.search(
        r"(?:[一-龥]+?(?:区|新区|开发区))"
        r"([一-龥A-Za-z0-9]+?(?:路|街|大道)\d+弄)",
        title,
    )
    if m:
        return m.group(1)

    # 方案 2: "X村/X小区/X花园/X公寓"
    m = re.search(
        r"(?:[一-龥]+?(?:区|新区|开发区))"
        r"([一-龥]{2,15}?(?:新村|村|花园|公寓|小区|大厦|广场|名邸|别墅|苑|城|府|庭|寓))",
        title,
    )
    if m:
        return m.group(1)

    # 方案 3: 街/路 + 数字号（不带"弄"）— 仅当后面紧跟"X号"且没"弄"时
    m = re.search(
        r"(?:[一-龥]+?(?:区|新区|开发区))"
        r"([一-龥A-Za-z0-9]+?(?:路|街|大道)\d+号)",
        title,
    )
    if m:
        return m.group(1)

    return None


# 小区名实体后缀（花园/苑/城/公寓 等）
_COMM_SUFFIX = (
    r"(?:花园|家园|公寓|别墅|公馆|名邸|山庄|新村|花苑|嘉苑|雅苑|景苑|苑|新城|"
    r"城(?!区|镇|市)|府|庭|园(?!区)|湾|阁|轩|居|大厦|广场|华庭|豪庭|世家|绿洲|"
    r"景园|佳园|名苑|嘉园|里(?!弄)|水岸|名门|大院|公社)"
)
# 小区名核心：不含行政区划与门牌字符
_COMM_CORE = r"[^省市区县镇乡街道路弄号幢室单元层栋座\d\s]{1,11}?"


def extract_community_from_title(title: str) -> Optional[str]:
    """从司法拍卖房源标题提取小区名（适配上海/宁波/杭州的复杂标题）。

    与 extract_community_name 的区别：本函数优先识别"花园/苑/城/公寓"等小区名
    实体，再回退到上海常见的"X路NNN弄"格式。务必只传单条房源的 title（或
    address），不要传整页文本，否则会抓到页面里其它房源的名字。

    举例：
    - "杭州市余杭区临平街道东港花苑36幢1单元102室" → "东港花苑"
    - "杭州市拱墅区绿洲花园6幢101室" → "绿洲花园"
    - "余姚市城区伊顿国际城1幢106室" → "伊顿国际城"
    - "上海市长宁区剑河路688弄3号" → "剑河路688弄"
    - "淳安县千岛湖镇知丰路21号2302室"（纯路号房，无小区名）→ None
    """
    if not title:
        return None
    t = re.sub(r"^[（(][^）)]{0,8}[）)]", "", title)  # 去掉开头的(刑)等
    t = re.sub(r"^拍卖", "", t)

    # 小区名实体后面不能紧跟"路/街/大道/公路"（否则是路名的一部分，如"龙轩路""杭州湾大道"）
    # 也排除"城路/城街"（如"江湾城路"，"江湾"不是小区名）
    _NOT_ROAD = r"(?!路|街|大道|公路|城路|城街|城大道)"

    # 1) 行政区划/门牌之后的小区名实体
    m = re.search(r"(?:\d+号|街道|镇|乡|区|县|市)(" + _COMM_CORE + _COMM_SUFFIX + r")" + _NOT_ROAD, t)
    if m:
        return m.group(1)
    # 2) 全串第一个小区名实体（前面不是数字/号，避免吃进门牌）
    m = re.search(r"(?<![\d号])(" + _COMM_CORE + _COMM_SUFFIX + r")" + _NOT_ROAD, t)
    if m:
        return m.group(1)
    # 3) 上海常见"X路/街/大道 NNN弄"（区/县/镇/街道 之后）
    m = re.search(r"(?:区|县|镇|街道)([一-龥A-Za-z0-9]{2,12}?(?:路|街|大道|公路)\d+弄)", t)
    if m:
        return m.group(1)
    # 3b) "市" 之后直接是"X路NNN弄"（无区县，如"上海市白丽路99弄"）；捕获组不含区县镇
    m = re.search(r"市([^省市区县镇乡\d]{2,10}?(?:路|街|大道|公路)\d+弄)", t)
    if m:
        return m.group(1)
    # 4) 直接"X路NNN弄"
    m = re.search(r"([一-龥A-Za-z0-9]{2,8}?(?:路|街|大道|公路)\d+弄)", t)
    if m:
        return m.group(1)
    return None


def extract_layout(text: str) -> Optional[str]:
    """从文本抽取户型。"""
    if not text:
        return None
    m = _RE_LAYOUT.search(text)
    if not m:
        return None
    rooms = _to_int(m.group(1))
    halls = _to_int(m.group(2)) if m.group(2) else 0
    baths = _to_int(m.group(3)) if m.group(3) else 0
    if rooms == 0:
        return None
    parts = [f"{rooms}室"]
    if halls:
        parts.append(f"{halls}厅")
    if baths:
        parts.append(f"{baths}卫")
    return "".join(parts)


def extract_floor(title: str, description: str = "") -> tuple[Optional[str], Optional[int]]:
    """返回 (floor_info 楼层信息, total_floors 总楼层)。"""
    floor_info = None
    total_floors = None

    if title:
        # 从标题抽"X楼/X层"
        # 但要避免 "1998弄" 这种被误抓
        m = re.search(r"(?<![弄号])(\d+)(?:楼|层)(?![弄])", title)
        if m:
            floor_info = m.group(0)

    text = (description or "") + " " + (title or "")
    m = _RE_TOTAL_FLOORS.search(text)
    if m:
        total_floors = int(m.group(1))

    return floor_info, total_floors


def extract_has_elevator(text: str) -> Optional[bool]:
    if not text:
        return None
    if _RE_ELEVATOR_NO.search(text):
        return False
    if _RE_ELEVATOR_YES.search(text):
        return True
    return None


def extract_decoration(text: str) -> Optional[str]:
    if not text:
        return None
    m = _RE_DECORATION.search(text)
    if not m:
        return None
    raw = m.group(1)
    # 标准化
    if "豪华" in raw:
        return "豪华装修"
    if raw in ("精装修", "精装"):
        return "精装"
    if "中" in raw:
        return "中装"
    if raw in ("简装修", "简装"):
        return "简装"
    if raw in ("毛坯", "未装修", "清水"):
        return "毛坯"
    return raw


def extract_orientation(text: str) -> Optional[str]:
    if not text:
        return None
    m = _RE_ORIENTATION.search(text)
    if not m:
        return None
    raw = m.group(1)
    # 标准化为"朝X"格式
    if "通透" in raw or "朝南北" in raw or "南北朝向" in raw:
        return "南北通透"
    raw = raw.replace("向", "")
    if not raw.startswith("朝"):
        raw = "朝" + raw
    return raw


def extract_build_year(text: str) -> Optional[int]:
    if not text:
        return None
    m = _RE_BUILD_YEAR.search(text)
    if not m:
        return None
    year = int(m.group(1))
    if 1900 <= year <= 2030:
        return year
    return None


def extract_case_number(text: str) -> Optional[str]:
    if not text:
        return None
    m = _RE_CASE_NUMBER.search(text)
    if not m:
        return None
    return m.group(0).replace("（", "(").replace("）", ")").replace(" ", "")


def clean_sub_district(value: Optional[str]) -> Optional[str]:
    """清洗板块名:剔除残留的行政区前缀(省/市/区/县),只保留真正的板块名。
    例: '市松江区泗泾镇' → '泗泾镇';'宁波市镇' → None(无效);'良渚街道' → '良渚街道'。
    """
    if not value:
        return None
    v = value.strip()
    # 从最后一个「市/区/县/旗/盟」之后截取(去掉省市区前缀)
    m = _RE_ADMIN_PREFIX.match(v)
    if m:
        v = v[m.end():]
    v = v.strip()
    # 截完若为空、或不再以街道/镇/乡结尾(说明原值就是脏的,如"宁波市镇")→ 视为无效
    if not v or not v.endswith(("街道", "镇", "乡")):
        return None
    # 板块名长度合理性:2-6 字
    if len(v) < 2 or len(v) > 6:
        return None
    return v


def extract_sub_district(text: str) -> Optional[str]:
    if not text:
        return None
    m = _RE_SUB_DISTRICT.search(text)
    if not m:
        return None
    return clean_sub_district(m.group(1))


def enrich_property(p) -> dict:
    """对一个 Property ORM 对象提取所有缺失字段。
    返回 dict，仅包含从原值"空/默认"变成"有值"的字段。
    """
    title = p.title or ""
    desc = p.description or ""
    full = f"{title}\n{desc}"

    updates = {}

    if not p.community_name:
        cn = extract_community_name(title)
        if cn:
            updates["community_name"] = cn

    if not p.layout:
        lay = extract_layout(full)
        if lay:
            updates["layout"] = lay

    if not p.floor_info or p.total_floors is None:
        floor_info, total_floors = extract_floor(title, desc)
        if not p.floor_info and floor_info:
            updates["floor_info"] = floor_info
        if p.total_floors is None and total_floors:
            updates["total_floors"] = total_floors

    if p.has_elevator is None:
        has_e = extract_has_elevator(full)
        if has_e is not None:
            updates["has_elevator"] = has_e

    if not p.decoration:
        dec = extract_decoration(full)
        if dec:
            updates["decoration"] = dec

    if not p.orientation:
        ori = extract_orientation(full)
        if ori:
            updates["orientation"] = ori

    if not p.build_year:
        yr = extract_build_year(full)
        if yr:
            updates["build_year"] = yr

    if not p.case_number:
        cn2 = extract_case_number(full)
        if cn2:
            updates["case_number"] = cn2

    if not p.sub_district:
        sd = extract_sub_district(title)
        if sd:
            updates["sub_district"] = sd

    return updates
