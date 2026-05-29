"""C-end /api/v1 routes."""
from fastapi import APIRouter
from . import auth, properties, articles, users, demands, common, agent

router = APIRouter()
router.include_router(auth.router, prefix="/auth", tags=["认证"])
router.include_router(properties.router, prefix="/properties", tags=["房源"])
router.include_router(articles.router, prefix="/articles", tags=["文章"])
router.include_router(users.router, prefix="/user", tags=["用户"])
router.include_router(demands.router, prefix="/demands", tags=["购房需求"])
router.include_router(common.router, prefix="", tags=["通用"])
router.include_router(agent.router, prefix="/agent", tags=["代理商"])
