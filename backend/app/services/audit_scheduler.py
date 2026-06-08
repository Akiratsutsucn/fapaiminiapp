"""数据审核定时任务调度器"""
import asyncio
from datetime import datetime, time
from loguru import logger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.data_audit import AuditRule, AuditTask, DataAuditExecution
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
            execution_start_time = datetime.now()
            execution_record = None

            try:
                # 获取所有启用的规则
                result = await session.execute(
                    select(AuditRule).where(AuditRule.enabled == True)
                )
                rules = result.scalars().all()

                if not rules:
                    logger.warning("没有启用的审核规则，跳过每日审核任务")
                    return

                rule_ids = [r.id for r in rules]

                # 准备规则列表（用于记录）
                rules_applied = [
                    {
                        "rule_id": r.id,
                        "rule_name": r.rule_name,
                        "rule_code": r.rule_code,
                        "enabled": r.enabled,
                        "action": r.action,
                    }
                    for r in rules
                ]

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
                    audit_result = await service.execute_audit_task(task.id)
                    logger.info(f"每日审核任务完成: {audit_result}")

                    # 计算执行耗时
                    execution_end_time = datetime.now()
                    duration_seconds = int((execution_end_time - execution_start_time).total_seconds())

                    # 统计违规详情
                    violations_found = await self._get_violations_summary(session, task.id)

                    # 创建执行历史记录（增强版）
                    execution_record = DataAuditExecution(
                        execution_time=execution_start_time,
                        rules_applied=rules_applied,
                        properties_checked=audit_result.get("total", 0),
                        properties_deleted=audit_result.get("deleted", 0),
                        properties_fixed=audit_result.get("fixed", 0),
                        violations_found=violations_found,  # 已包含详细信息
                        execution_duration=duration_seconds,
                        status="completed",
                        error_message=None,
                    )

                    session.add(execution_record)
                    await session.commit()
                    logger.info(f"审核执行历史已记录: execution_id={execution_record.id}")

                except Exception as e:
                    logger.error(f"每日审核任务执行失败: {e}", exc_info=True)

                    # 记录失败的执行历史
                    execution_end_time = datetime.now()
                    duration_seconds = int((execution_end_time - execution_start_time).total_seconds())

                    execution_record = DataAuditExecution(
                        execution_time=execution_start_time,
                        rules_applied=rules_applied,
                        properties_checked=0,
                        properties_deleted=0,
                        properties_fixed=0,
                        violations_found={},
                        execution_duration=duration_seconds,
                        status="failed",
                        error_message=str(e),
                    )

                    session.add(execution_record)
                    await session.commit()
                    logger.info(f"失败的审核执行历史已记录: execution_id={execution_record.id}")

            except Exception as e:
                logger.error(f"创建每日审核任务时出错: {e}", exc_info=True)

                # 记录异常情况
                execution_end_time = datetime.now()
                duration_seconds = int((execution_end_time - execution_start_time).total_seconds())

                execution_record = DataAuditExecution(
                    execution_time=execution_start_time,
                    rules_applied=[],
                    properties_checked=0,
                    properties_deleted=0,
                    properties_fixed=0,
                    violations_found={},
                    execution_duration=duration_seconds,
                    status="failed",
                    error_message=str(e),
                )

                session.add(execution_record)
                await session.commit()

    async def _get_violations_summary(self, session: AsyncSession, task_id: int) -> dict:
        """获取违规统计摘要（详细版本）"""
        from app.models.data_audit import AuditViolation

        result = await session.execute(
            select(AuditViolation).where(AuditViolation.task_id == task_id)
        )
        violations = result.scalars().all()

        # 按规则名称和动作类型统计违规数量
        violations_summary = {}
        action_details = {
            "deleted": [],
            "fixed": [],
            "flagged": []
        }

        for v in violations:
            rule_name = v.rule_name
            action = v.action_taken

            # 统计每条规则的违规数量
            violations_summary[rule_name] = violations_summary.get(rule_name, 0) + 1

            # 记录详细的操作信息
            detail = v.violation_detail or {}
            detail_msg = detail.get("message", "")

            if action == "deleted":
                action_details["deleted"].append({
                    "rule_name": rule_name,
                    "property_id": v.property_id,
                    "detail": detail_msg
                })
            elif action == "fixed":
                action_details["fixed"].append({
                    "rule_name": rule_name,
                    "property_id": v.property_id,
                    "detail": detail_msg
                })
            elif action == "flagged":
                action_details["flagged"].append({
                    "rule_name": rule_name,
                    "property_id": v.property_id,
                    "detail": detail_msg
                })

        # 生成人性化的详细操作描述
        detailed_actions = []

        # 按规则分组统计删除操作
        delete_by_rule = {}
        for item in action_details["deleted"]:
            rule = item["rule_name"]
            delete_by_rule[rule] = delete_by_rule.get(rule, 0) + 1

        for rule, count in delete_by_rule.items():
            detailed_actions.append(f"{rule}：已删除{count}条")

        # 按规则分组统计修复操作
        fix_by_rule = {}
        for item in action_details["fixed"]:
            rule = item["rule_name"]
            fix_by_rule[rule] = fix_by_rule.get(rule, 0) + 1

        for rule, count in fix_by_rule.items():
            detailed_actions.append(f"{rule}：已修复{count}条")

        # 按规则分组统计标记操作
        flag_by_rule = {}
        for item in action_details["flagged"]:
            rule = item["rule_name"]
            flag_by_rule[rule] = flag_by_rule.get(rule, 0) + 1

        for rule, count in flag_by_rule.items():
            detailed_actions.append(f"{rule}：已标记{count}条")

        return {
            "summary": violations_summary,
            "detailed_actions": detailed_actions,
            "action_statistics": {
                "deleted_count": len(action_details["deleted"]),
                "fixed_count": len(action_details["fixed"]),
                "flagged_count": len(action_details["flagged"])
            }
        }

    async def run_scheduler(self):
        """运行调度器（每天凌晨5点执行）"""
        logger.info("数据审核调度器已启动")

        while True:
            now = datetime.now()
            # 计算到凌晨5点的时间差
            target_time = datetime.combine(now.date(), time(hour=5, minute=0))
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
