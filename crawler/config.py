"""Crawler configuration — reuses backend .env for DB, adds crawler-specific settings."""
from pydantic_settings import BaseSettings


class CrawlerSettings(BaseSettings):
    # ===== database (reuses backend env vars) =====
    DB_TYPE: str = "mysql"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "fapai"
    DB_PASSWORD: str = "fapai123"
    DB_NAME: str = "shanghai_fapai"

    @property
    def DATABASE_URL(self) -> str:
        if self.DB_TYPE == "sqlite":
            return f"sqlite+aiosqlite:///./{self.DB_NAME}.db"
        return (
            f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    # ===== playwright =====
    PLAYWRIGHT_HEADLESS: bool = True
    PLAYWRIGHT_BROWSER: str = "chromium"
    PLAYWRIGHT_TIMEOUT_MS: int = 30000
    PLAYWRIGHT_SLOW_MO_MS: int = 0  # set >0 to mimic human speed

    # ===== proxy =====
    PROXY_URL: str | None = None
    # 公拍网列表专用住宅代理（s.gpai.net 封服务器IP，城市精确搜索需住宅IP）
    # 格式：socks5h://user:pass@host:port  —— 仅用于抓 s.gpai.net 列表，详情页走直连
    GPAI_PROXY: str | None = None
    # 阿里图片下载专用代理（img.alicdn.com 对服务器IP突发限流 HTTP 420，走住宅代理规避）
    # 留空则复用 GPAI_PROXY；都为空则直连。格式同上 socks5h://user:pass@host:port
    IMAGE_PROXY: str | None = None

    # ===== rate limiting =====
    MIN_DELAY_SEC: float = 1.0
    MAX_DELAY_SEC: float = 3.0
    DETAIL_PAGE_CONCURRENCY: int = 3
    LIST_PAGE_TIMEOUT_MS: int = 60000
    DETAIL_PAGE_TIMEOUT_MS: int = 30000

    # ===== retry =====
    MAX_RETRIES: int = 3
    RETRY_BACKOFF_FACTOR: float = 2.0

    # ===== scheduler =====
    SCHEDULER_ENABLED: bool = False
    DAILY_CRON: str = "0 3 * * *"  # 3 AM daily

    # ===== incremental comparison =====
    STALE_DAYS_THRESHOLD: int = 7  # mark as ended if absent for N days
    STALE_REFRESH_HOURS: int = 24  # re-fetch existing records older than N hours

    # ===== 小区详情补充源（贝壳之外的备援，见 community_sources.py） =====
    # 总开关：贝壳抓取失败/字段缺失时，是否启用中原等补充源回填。默认关闭，
    # 开启前请先在生产环境实测各源可用性（中原站点有瑞数动态反爬）。
    COMMUNITY_SUPPLEMENT_ENABLED: bool = False
    # 中原地产（centanet.com）源开关。需 Playwright + 住宅代理才有机会过瑞数挑战，
    # 默认关闭。实测可用后再打开。
    CENTANET_ENABLED: bool = False

    # ===== auth cookies =====
    TAOBAO_COOKIE: str = ""  # logged-in cookie string for sf.taobao.com
    GPAI_COOKIE: str = ""    # 公拍网 cookie（备用，未来若需登录才能爬，配置此项）
    BEIKE_COOKIE: str = ""   # 贝壳找房 cookie（sh.ke.com / nb.ke.com 需登录）

    # ===== map / POI =====
    AMAP_API_KEY: str = ""

    # ===== debug =====
    DEBUG_API_RESPONSE: bool = False

    # ===== limits =====
    MAX_LIST_PAGES: int = 50  # safety cap per source URL
    MAX_DETAIL_ITEMS: int = 0  # 0 = unlimited

    # ===== local image storage (cosfs mount) =====
    IMAGE_STORAGE_PATH: str = "/picture"
    IMAGE_BASE_URL: str = ""

    # ===== image processing =====
    IMAGE_PROCESS_ENABLED: bool = True
    IMAGE_MAX_WIDTH: int = 1080
    IMAGE_THUMB_WIDTH: int = 300
    IMAGE_WEBP_QUALITY: int = 80

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = CrawlerSettings()
