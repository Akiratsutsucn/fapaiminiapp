"""B-end /api/admin routes."""
from fastapi import APIRouter
from . import auth, dashboard, users, properties, demands, articles, banners, crawler, settings, upload, communities, data_audit, ai

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["管理员认证"])
router.include_router(dashboard.router, prefix="/dashboard", tags=["看板"])
router.include_router(users.router, prefix="/users", tags=["用户管理"])
router.include_router(properties.router, prefix="/properties", tags=["房源管理"])
router.include_router(demands.router, prefix="/demands", tags=["需求管理"])
router.include_router(articles.router, prefix="/articles", tags=["文章管理"])
router.include_router(banners.router, prefix="/banners", tags=["横幅管理"])
router.include_router(crawler.router, prefix="/crawler", tags=["爬虫管理"])
router.include_router(settings.router, prefix="/settings", tags=["系统设置"])
router.include_router(upload.router, prefix="/upload", tags=["文件上传"])
router.include_router(communities.router, prefix="/communities", tags=["小区管理"])
router.include_router(data_audit.router, prefix="/data-audit", tags=["数据审核"])
router.include_router(ai.router, prefix="/ai", tags=["AI助手"])
