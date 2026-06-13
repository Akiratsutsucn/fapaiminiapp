"""数据审核管理后台API接口"""
import asyncio
import threading
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ...core.database import get_session
from ...core.security import get_admin_user, check_module_permission, check_write_permission
from ...models.data_audit import AuditRule, AuditTask, AuditViolation, AuditReport, DataAuditExecution
from ...models.property import Property
from ...services.data_audit_service import DataAuditService

router = APIRouter()


# ==================== 请求/响应模型 ====================

class AuditRuleCreate(BaseModel):
    rule_name: str = Field(..., description="规则名称")
    rule_code: str = Field(..., description="规则唯一标识码")
    category: str = Field(..., description="规则分类")
    description: Optional[str] = Field(None, description="规则描述")
    config: dict = Field(..., description="规则配置")
    action: str = Field("flag", description="执行动作")
    severity: str = Field("warning", description="严重级别")
    enabled: bool = Field(True, description="是否启用")
    auto_fix: bool = Field(False, description="是否自动修复")


class AuditRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    description: Optional[str] = None
    config: Optional[dict] = None
    action: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None
    auto_fix: Optional[bool] = None


class AuditTaskCreate(BaseModel):
    task_name: str = Field(..., description="任务名称")
    task_type: str = Field("manual", description="任务类型")
    rule_ids: List[int] = Field(..., description="规则ID列表")
    scope: Optional[dict] = Field(None, description="审核范围")


class ViolationUpdate(BaseModel):
    status: str = Field(..., description="处理状态")
    fix_note: Optional[str] = Field(None, description="修复说明")


# ==================== 审核规则管理 ====================

@router.get("/rules")
async def list_rules(
    enabled: Optional[bool] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取审核规则列表"""
    query = select(AuditRule).order_by(AuditRule.created_at.desc())

    if enabled is not None:
        query = query.where(AuditRule.enabled == enabled)

    if category:
        query = query.where(AuditRule.category == category)

    result = await db.execute(query)
    rules = result.scalars().all()

    return [{
        "id": r.id,
        "rule_name": r.rule_name,
        "rule_code": r.rule_code,
        "category": r.category,
        "description": r.description,
        "config": r.config,
        "action": r.action,
        "severity": r.severity,
        "enabled": r.enabled,
        "auto_fix": r.auto_fix,
        "total_checked": r.total_checked,
        "total_violations": r.total_violations,
        "last_executed_at": str(r.last_executed_at) if r.last_executed_at else None,
        "created_at": str(r.created_at),
        "updated_at": str(r.updated_at),
    } for r in rules]


@router.get("/rules/{rule_id}")
async def get_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取单个规则详情"""
    rule = await db.get(AuditRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    return {
        "id": rule.id,
        "rule_name": rule.rule_name,
        "rule_code": rule.rule_code,
        "category": rule.category,
        "description": rule.description,
        "config": rule.config,
        "action": rule.action,
        "severity": rule.severity,
        "enabled": rule.enabled,
        "auto_fix": rule.auto_fix,
        "total_checked": rule.total_checked,
        "total_violations": rule.total_violations,
        "last_executed_at": str(rule.last_executed_at) if rule.last_executed_at else None,
        "created_at": str(rule.created_at),
        "updated_at": str(rule.updated_at),
    }


@router.post("/rules")
async def create_rule(
    req: AuditRuleCreate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """创建审核规则"""
    # 检查rule_code是否已存在
    existing = await db.execute(
        select(AuditRule).where(AuditRule.rule_code == req.rule_code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="规则代码已存在")

    rule = AuditRule(
        rule_name=req.rule_name,
        rule_code=req.rule_code,
        category=req.category,
        description=req.description,
        config=req.config,
        action=req.action,
        severity=req.severity,
        enabled=req.enabled,
        auto_fix=req.auto_fix,
    )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)

    logger.info(f"创建审核规则: {rule.rule_name} (ID={rule.id})")

    return {"message": "规则创建成功", "rule_id": rule.id}


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: int,
    req: AuditRuleUpdate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """更新审核规则"""
    rule = await db.get(AuditRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    if req.rule_name is not None:
        rule.rule_name = req.rule_name
    if req.description is not None:
        rule.description = req.description
    if req.config is not None:
        rule.config = req.config
    if req.action is not None:
        rule.action = req.action
    if req.severity is not None:
        rule.severity = req.severity
    if req.enabled is not None:
        rule.enabled = req.enabled
    if req.auto_fix is not None:
        rule.auto_fix = req.auto_fix

    rule.updated_at = datetime.now()

    await db.commit()

    logger.info(f"更新审核规则: {rule.rule_name} (ID={rule.id})")

    return {"message": "规则更新成功"}


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """删除审核规则"""
    rule = await db.get(AuditRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")

    await db.delete(rule)
    await db.commit()

    logger.info(f"删除审核规则: {rule.rule_name} (ID={rule.id})")

    return {"message": "规则删除成功"}


# ==================== 审核任务管理 ====================

def _run_audit_task_sync(task_id: int, db_url: str):
    """在后台线程中运行审核任务"""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker

    async def _run():
        engine = create_async_engine(db_url, echo=False)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with async_session() as session:
            service = DataAuditService(session)
            try:
                await service.execute_audit_task(task_id)
            except Exception as e:
                logger.error(f"审核任务 {task_id} 执行失败: {e}")
            finally:
                await engine.dispose()

    asyncio.run(_run())


@router.get("/tasks")
async def list_tasks(
    status: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取审核任务列表"""
    query = select(AuditTask).order_by(desc(AuditTask.created_at)).limit(limit)

    if status:
        query = query.where(AuditTask.status == status)

    result = await db.execute(query)
    tasks = result.scalars().all()

    return [{
        "id": t.id,
        "task_name": t.task_name,
        "task_type": t.task_type,
        "rule_ids": t.rule_ids,
        "scope": t.scope,
        "status": t.status,
        "progress": t.progress,
        "total_records": t.total_records,
        "passed_count": t.passed_count,
        "flagged_count": t.flagged_count,
        "fixed_count": t.fixed_count,
        "deleted_count": t.deleted_count,
        "started_at": str(t.started_at) if t.started_at else None,
        "completed_at": str(t.completed_at) if t.completed_at else None,
        "duration_seconds": t.duration_seconds,
        "error_message": t.error_message,
        "created_at": str(t.created_at),
    } for t in tasks]


@router.get("/tasks/{task_id}")
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取任务详情"""
    task = await db.get(AuditTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "id": task.id,
        "task_name": task.task_name,
        "task_type": task.task_type,
        "rule_ids": task.rule_ids,
        "scope": task.scope,
        "status": task.status,
        "progress": task.progress,
        "total_records": task.total_records,
        "passed_count": task.passed_count,
        "flagged_count": task.flagged_count,
        "fixed_count": task.fixed_count,
        "deleted_count": task.deleted_count,
        "started_at": str(task.started_at) if task.started_at else None,
        "completed_at": str(task.completed_at) if task.completed_at else None,
        "duration_seconds": task.duration_seconds,
        "error_message": task.error_message,
        "created_at": str(task.created_at),
    }


@router.post("/tasks")
async def create_task(
    req: AuditTaskCreate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """创建并执行审核任务"""
    # 验证规则ID
    if not req.rule_ids:
        raise HTTPException(status_code=400, detail="必须选择至少一个规则")

    rules_result = await db.execute(
        select(AuditRule).where(AuditRule.id.in_(req.rule_ids))
    )
    rules = rules_result.scalars().all()
    if len(rules) != len(req.rule_ids):
        raise HTTPException(status_code=400, detail="部分规则ID不存在")

    # 创建任务
    task = AuditTask(
        task_name=req.task_name,
        task_type=req.task_type,
        rule_ids=req.rule_ids,
        scope=req.scope,
        status="pending",
    )

    db.add(task)
    await db.commit()
    await db.refresh(task)

    logger.info(f"创建审核任务: {task.task_name} (ID={task.id})")

    # 在后台线程中执行审核
    from ...core.config import settings
    thread = threading.Thread(
        target=_run_audit_task_sync,
        args=(task.id, settings.DATABASE_URL),
        daemon=True,
    )
    thread.start()

    return {"message": "审核任务已创建并开始执行", "task_id": task.id}


# ==================== 违规记录管理 ====================

@router.get("/violations")
async def list_violations(
    task_id: Optional[int] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取违规记录列表"""
    query = select(AuditViolation).order_by(desc(AuditViolation.created_at))

    if task_id:
        query = query.where(AuditViolation.task_id == task_id)

    if status:
        query = query.where(AuditViolation.status == status)

    if severity:
        query = query.where(AuditViolation.severity == severity)

    # 获取总数
    count_result = await db.execute(
        select(func.count()).select_from(query.subquery())
    )
    total = count_result.scalar()

    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    violations = result.scalars().all()

    return {
        "total": total,
        "items": [{
            "id": v.id,
            "task_id": v.task_id,
            "rule_id": v.rule_id,
            "property_id": v.property_id,
            "rule_code": v.rule_code,
            "rule_name": v.rule_name,
            "severity": v.severity,
            "violation_detail": v.violation_detail,
            "action_taken": v.action_taken,
            "status": v.status,
            "fixed_at": str(v.fixed_at) if v.fixed_at else None,
            "fixed_by": v.fixed_by,
            "fix_note": v.fix_note,
            "created_at": str(v.created_at),
        } for v in violations]
    }


@router.put("/violations/{violation_id}")
async def update_violation(
    violation_id: int,
    req: ViolationUpdate,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_write_permission()),
):
    """更新违规记录状态"""
    violation = await db.get(AuditViolation, violation_id)
    if not violation:
        raise HTTPException(status_code=404, detail="违规记录不存在")

    violation.status = req.status
    if req.fix_note:
        violation.fix_note = req.fix_note

    if req.status == "resolved":
        violation.fixed_at = datetime.now()
        violation.fixed_by = admin.get("username", "admin")

    violation.updated_at = datetime.now()

    await db.commit()

    return {"message": "违规记录已更新"}


# ==================== 审核报告管理 ====================

@router.get("/reports")
async def list_reports(
    limit: int = 20,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取审核报告列表"""
    query = select(AuditReport).order_by(desc(AuditReport.report_date)).limit(limit)
    result = await db.execute(query)
    reports = result.scalars().all()

    return [{
        "id": r.id,
        "task_id": r.task_id,
        "report_date": str(r.report_date),
        "summary": r.summary,
        "quality_score": r.quality_score,
        "created_at": str(r.created_at),
    } for r in reports]


@router.get("/reports/{report_id}")
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取报告详情"""
    report = await db.get(AuditReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    return {
        "id": report.id,
        "task_id": report.task_id,
        "report_date": str(report.report_date),
        "summary": report.summary,
        "rule_statistics": report.rule_statistics,
        "platform_statistics": report.platform_statistics,
        "city_statistics": report.city_statistics,
        "quality_score": report.quality_score,
        "trend_comparison": report.trend_comparison,
        "created_at": str(report.created_at),
    }


@router.get("/reports/task/{task_id}")
async def get_report_by_task(
    task_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """根据任务ID获取报告"""
    result = await db.execute(
        select(AuditReport).where(AuditReport.task_id == task_id)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    return {
        "id": report.id,
        "task_id": report.task_id,
        "report_date": str(report.report_date),
        "summary": report.summary,
        "rule_statistics": report.rule_statistics,
        "platform_statistics": report.platform_statistics,
        "city_statistics": report.city_statistics,
        "quality_score": report.quality_score,
        "trend_comparison": report.trend_comparison,
        "created_at": str(report.created_at),
    }


# ==================== 统计数据 ====================

@router.get("/dashboard/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取仪表板统计数据"""
    # 规则统计
    rules_count = await db.execute(select(func.count(AuditRule.id)))
    total_rules = rules_count.scalar()

    enabled_rules_count = await db.execute(
        select(func.count(AuditRule.id)).where(AuditRule.enabled == True)
    )
    enabled_rules = enabled_rules_count.scalar()

    # 任务统计
    tasks_count = await db.execute(select(func.count(AuditTask.id)))
    total_tasks = tasks_count.scalar()

    # 最近一次任务
    latest_task_result = await db.execute(
        select(AuditTask).order_by(desc(AuditTask.created_at)).limit(1)
    )
    latest_task = latest_task_result.scalar_one_or_none()

    # 最近一次报告
    latest_report_result = await db.execute(
        select(AuditReport).order_by(desc(AuditReport.report_date)).limit(1)
    )
    latest_report = latest_report_result.scalar_one_or_none()

    # 待处理违规数
    open_violations_count = await db.execute(
        select(func.count(AuditViolation.id)).where(AuditViolation.status == "open")
    )
    open_violations = open_violations_count.scalar()

    return {
        "total_rules": total_rules,
        "enabled_rules": enabled_rules,
        "total_tasks": total_tasks,
        "open_violations": open_violations,
        "latest_task": {
            "id": latest_task.id,
            "task_name": latest_task.task_name,
            "status": latest_task.status,
            "quality_score": latest_report.quality_score if latest_report else None,
            "completed_at": str(latest_task.completed_at) if latest_task.completed_at else None,
        } if latest_task else None,
        "latest_quality_score": latest_report.quality_score if latest_report else None,
    }


# ==================== 审核执行历史 ====================

@router.get("/executions")
async def list_executions(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    days: Optional[int] = None,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取审核执行历史列表（增强版）"""
    from datetime import datetime, timedelta
    from sqlalchemy import and_

    query = select(DataAuditExecution).order_by(desc(DataAuditExecution.execution_time))

    # 日期范围过滤
    filters = []

    # 如果指定了days参数，优先使用
    if days:
        days_ago = datetime.now() - timedelta(days=days)
        filters.append(DataAuditExecution.execution_time >= days_ago)
    else:
        if start_date:
            try:
                start_dt = datetime.fromisoformat(start_date)
                filters.append(DataAuditExecution.execution_time >= start_dt)
            except ValueError:
                pass

        if end_date:
            try:
                end_dt = datetime.fromisoformat(end_date)
                # 包含当天全部时间
                end_dt = end_dt.replace(hour=23, minute=59, second=59)
                filters.append(DataAuditExecution.execution_time <= end_dt)
            except ValueError:
                pass

        # 如果没有指定日期范围，默认最近30天
        if not start_date and not end_date:
            thirty_days_ago = datetime.now() - timedelta(days=30)
            filters.append(DataAuditExecution.execution_time >= thirty_days_ago)

    # 状态过滤
    if status:
        filters.append(DataAuditExecution.status == status)

    if filters:
        query = query.where(and_(*filters))

    # 获取总数
    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar()

    # 分页
    offset = (page - 1) * page_size
    query = query.limit(page_size).offset(offset)
    result = await db.execute(query)
    executions = result.scalars().all()

    items = []
    for e in executions:
        violations_found = e.violations_found or {}

        # 计算总违规数
        summary = violations_found.get("summary", {})
        total_violations = sum(summary.values()) if summary else 0

        # 获取规则数量
        rules_applied = e.rules_applied or []
        total_rules = len(rules_applied)

        items.append({
            "id": e.id,
            "execution_time": str(e.execution_time),
            "total_rules": total_rules,
            "total_violations": total_violations,
            "cleaned_count": e.properties_deleted,
            "fixed_count": e.properties_fixed,
            "properties_checked": e.properties_checked,
            "execution_duration": e.execution_duration,
            "status": e.status,
            "error_message": e.error_message,
        })

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
        "items": items
    }


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取单次审核执行的详细信息（增强版）"""
    execution = await db.get(DataAuditExecution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="执行记录不存在")

    # 解析violations_found结构
    violations_found = execution.violations_found or {}

    # 提取详细操作列表
    detailed_actions = violations_found.get("detailed_actions", [])

    # 提取操作统计
    action_stats = violations_found.get("action_statistics", {
        "deleted_count": execution.properties_deleted,
        "fixed_count": execution.properties_fixed,
        "flagged_count": 0
    })

    # 提取规则统计摘要
    summary = violations_found.get("summary", {})
    rule_action_summary = violations_found.get("rule_action_summary", {})

    return {
        "id": execution.id,
        "execution_time": str(execution.execution_time),
        "rules_applied": execution.rules_applied or [],
        "properties_checked": execution.properties_checked,
        "properties_deleted": execution.properties_deleted,
        "properties_fixed": execution.properties_fixed,
        "violations_found": summary,  # 按规则分组的违规统计
        "rule_action_summary": rule_action_summary,  # 每规则的违规数+动作分解(删/标/修),消歧义
        "detailed_actions": detailed_actions,  # 详细操作描述
        "action_statistics": action_stats,  # 操作统计
        "execution_duration": execution.execution_duration,
        "status": execution.status,
        "error_message": execution.error_message,
        "created_at": str(execution.created_at),
    }


@router.get("/executions/stats/summary")
async def get_executions_summary(
    days: int = 30,
    db: AsyncSession = Depends(get_session),
    admin: dict = Depends(check_module_permission("data-audit")),
):
    """获取审核执行历史统计摘要（增强版）"""
    from datetime import datetime, timedelta

    # 计算日期范围
    end_date = datetime.now()
    start_date_7 = end_date - timedelta(days=7)
    start_date_30 = end_date - timedelta(days=30)

    # 查询最近7天的执行记录
    result_7 = await db.execute(
        select(DataAuditExecution).where(
            DataAuditExecution.execution_time >= start_date_7
        ).order_by(DataAuditExecution.execution_time)
    )
    executions_7 = result_7.scalars().all()

    # 查询最近30天的执行记录
    result_30 = await db.execute(
        select(DataAuditExecution).where(
            DataAuditExecution.execution_time >= start_date_30
        ).order_by(DataAuditExecution.execution_time)
    )
    executions_30 = result_30.scalars().all()

    def calculate_stats(executions):
        """计算统计数据"""
        if not executions:
            return []

        items = []
        for e in executions:
            violations_found = e.violations_found or {}
            summary = violations_found.get("summary", {})
            total_violations = sum(summary.values()) if summary else 0

            items.append({
                "id": e.id,
                "execution_time": str(e.execution_time),
                "total_violations": total_violations,
                "cleaned_count": e.properties_deleted,
                "fixed_count": e.properties_fixed,
            })

        return items

    return {
        "recent_7_days": calculate_stats(executions_7),
        "recent_30_days": calculate_stats(executions_30),
    }
