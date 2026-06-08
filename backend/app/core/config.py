"""Application settings — loaded from environment / .env file."""
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ===== database =====
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

    # ===== wechat mini-program =====
    WECHAT_APPID: str = "wx4ed176b1fd0eac4f"
    WECHAT_APPSECRET: str = "change-me"
    # 小程序码生成的版本：develop / trial / release。发布到线上后改为 release
    WECHAT_ENV_VERSION: str = "trial"

    # ===== wechat official account (公众号 拍来盟科技) =====
    # 已认证服务号，用于把公众号已群发文章同步到文章管理。
    # 注意：调用接口前需把生产服务器 IP 加入公众号后台「IP白名单」。
    WECHAT_MP_APPID: str = ""
    WECHAT_MP_APPSECRET: str = ""

    # ===== jwt =====
    SECRET_KEY: str = "change-me-in-production"
    # access_token 比前端的 idle 超时多 5 分钟，确保用户在最后一次点击之前 token 还有效
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 35
    # refresh_token 有效期 14 天：用户 14 天内再次打开小程序可凭 refresh_token 静默续期，免重新登录
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14

    # ===== local image storage (cosfs mount, shared with crawler) =====
    IMAGE_STORAGE_PATH: str = "/picture"
    IMAGE_BASE_URL: str = ""

    # ===== app =====
    APP_NAME: str = "法拍者联盟"
    DEBUG: bool = False

    # ===== data audit scheduler =====
    ENABLE_AUDIT_SCHEDULER: bool = True

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()
