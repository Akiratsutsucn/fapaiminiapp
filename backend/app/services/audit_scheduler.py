"""数据审核定时任务调度器"""
import asyncio
from datetime import datetime, time
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.data_audit import AuditRule, AuditTask
from app.services.data_audit_service import DataAuditService


class AuditScheduler:
    """审核任务调度器"""

    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_async_engine(db_url, echo=False)
        self.async_session = sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def create_daily_audit_task(self):
        """创建每日审核任务"""
        async with self.async_session() as session:
            # 获取所有启用的规则
            result = await session.execute(
                select(AuditRule).where(AuditRule.enabled == True)
            )
            rules = result.scalars().all()

            if not rules:
                logger.warning("没有启用的审核规则，跳过每日审核任务")
                return

            rule_ids = [r.id for r in rules]

            # 创建审核任务
            task = AuditTask(
                task_name=f"每日自动审核_{datetime.now().strftime('%Y%m%d')}",
                task_type="scheduled",
                rule_ids=rule_ids,
                scope=None,  # 全量审核
                status="pending",
            )

            session.add(task)
            await session.commit()
            await session.refresh(task)

            logger.info(f"创建每日审核任务: task_id={task.id}, rules={len(rule_ids)}")

            # 执行审核
            service = DataAuditService(session)
            try:
                result = await service.execute_audit_task(task.id)
                logger.info(f"每日审核任务完成: {result}")
            except Exception as e:
                logger.error(f"每日审核任务执行失败: {e}", exc_info=True)

    async def run_scheduler(self):
        """运行调度器（每天凌晨2点执行）"""
        logger.info("数据审核调度器已启动")

        while True:
            now = datetime.now()
            # 计算到凌晨2点的时间差
            target_time = datetime.combine(now.date(), time(hour=2, minute=0))
            if now >= target_time:
                # 如果已过今天的2点，计算到明天2点
                from datetime import timedelta
                target_time += timedelta(days=1)

            wait_seconds = (target_time - now).total_seconds()
            logger.info(f"下次审核时间: {target_time}, 等待 {wait_seconds/3600:.2f} 小时")

            # 等待到目标时间
            await asyncio.sleep(wait_seconds)

            # 执行审核
            try:
                await self.create_daily_audit_task()
            except Exception as e:
                logger.error(f"执行每日审核任务时出错: {e}", exc_info=True)

            # 等待一分钟，避免在同一分钟内重复执行
            await asyncio.sleep(60)

    async def close(self):
        """关闭调度器"""
        await self.engine.dispose()


async def start_audit_scheduler():
    """启动审核调度器"""
    scheduler = AuditScheduler(settings.DATABASE_URL)
    try:
        await scheduler.run_scheduler()
    finally:
        await scheduler.close()


if __name__ == "__main__":
    # 可以独立运行调度器
    asyncio.run(start_audit_scheduler())
