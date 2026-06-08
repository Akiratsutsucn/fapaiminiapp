"""Data audit and cleaning system models."""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, JSON, Float,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class AuditRule(Base):
    """审核规则配置表"""
    __tablename__ = "audit_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 规则基本信息
    rule_name = Column(String(128), nullable=False, comment="规则名称")
    rule_code = Column(String(64), nullable=False, unique=True, comment="规则唯一标识码")
    category = Column(String(32), nullable=False, comment="规则分类: field_required/field_range/field_format/region_filter/property_type_filter")
    description = Column(Text, nullable=True, comment="规则描述")

    # 规则配置
    config = Column(JSON, nullable=False, comment="规则配置JSON")
    # 示例配置格式：
    # field_required: {"fields": ["starting_price", "deposit", "area"]}
    # field_range: {"field": "starting_price", "min": 10000, "max": 100000000}
    # field_format: {"field": "phone", "pattern": "^1[3-9]\\d{9}$"}
    # region_filter: {"allowed_cities": [310000, 330200, 330100], "action": "delete"}
    # property_type_filter: {"allowed_types": ["住宅", "别墅", "公寓"], "action": "flag"}

    # 执行动作
    action = Column(String(32), nullable=False, default="flag", comment="违规时执行动作: flag/delete/fix")
    severity = Column(String(16), nullable=False, default="warning", comment="严重级别: info/warning/error/critical")

    # 状态控制
    enabled = Column(Boolean, nullable=False, default=True, comment="是否启用")
    auto_fix = Column(Boolean, nullable=False, default=False, comment="是否自动修复")

    # 统计信息
    total_checked = Column(Integer, nullable=False, default=0, comment="累计检查次数")
    total_violations = Column(Integer, nullable=False, default=0, comment="累计违规次数")
    last_executed_at = Column(DateTime, nullable=True, comment="最后执行时间")

    # 系统字段
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class AuditTask(Base):
    """审核任务表"""
    __tablename__ = "audit_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 任务基本信息
    task_name = Column(String(128), nullable=False, comment="任务名称")
    task_type = Column(String(32), nullable=False, comment="任务类型: scheduled/manual")

    # 任务配置
    rule_ids = Column(JSON, nullable=False, comment="使用的规则ID列表")
    scope = Column(JSON, nullable=True, comment="审核范围配置")
    # 示例: {"platforms": ["阿里拍卖", "京东拍卖"], "date_range": {"start": "2024-01-01", "end": "2024-12-31"}}

    # 执行状态
    status = Column(String(16), nullable=False, default="pending", comment="任务状态: pending/running/completed/failed")
    progress = Column(Float, nullable=False, default=0.0, comment="执行进度0-100")

    # 执行结果统计
    total_records = Column(Integer, nullable=False, default=0, comment="总检查记录数")
    passed_count = Column(Integer, nullable=False, default=0, comment="通过数量")
    flagged_count = Column(Integer, nullable=False, default=0, comment="标记数量")
    fixed_count = Column(Integer, nullable=False, default=0, comment="修复数量")
    deleted_count = Column(Integer, nullable=False, default=0, comment="删除数量")

    # 执行时间
    started_at = Column(DateTime, nullable=True, comment="开始时间")
    completed_at = Column(DateTime, nullable=True, comment="完成时间")
    duration_seconds = Column(Integer, nullable=True, comment="执行耗时(秒)")

    # 错误信息
    error_message = Column(Text, nullable=True, comment="错误信息")

    # 系统字段
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class AuditViolation(Base):
    """审核违规记录表"""
    __tablename__ = "audit_violations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 关联信息
    task_id = Column(Integer, nullable=False, index=True, comment="审核任务ID")
    rule_id = Column(Integer, nullable=False, index=True, comment="违规规则ID")
    property_id = Column(Integer, nullable=False, index=True, comment="房源ID")

    # 违规详情
    rule_code = Column(String(64), nullable=False, comment="规则代码")
    rule_name = Column(String(128), nullable=False, comment="规则名称")
    severity = Column(String(16), nullable=False, comment="严重级别")
    violation_detail = Column(JSON, nullable=False, comment="违规详情")
    # 示例: {"field": "starting_price", "expected": ">10000", "actual": 0, "message": "起拍价为0"}

    # 处理状态
    action_taken = Column(String(32), nullable=False, comment="执行的动作: flagged/deleted/fixed/ignored")
    status = Column(String(16), nullable=False, default="open", comment="处理状态: open/resolved/ignored")

    # 修复信息
    fixed_at = Column(DateTime, nullable=True, comment="修复时间")
    fixed_by = Column(String(64), nullable=True, comment="修复人")
    fix_note = Column(Text, nullable=True, comment="修复说明")

    # 系统字段
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)


class AuditReport(Base):
    """审核报告表"""
    __tablename__ = "audit_reports"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # 报告基本信息
    task_id = Column(Integer, nullable=False, unique=True, index=True, comment="关联审核任务ID")
    report_date = Column(DateTime, nullable=False, default=datetime.now, comment="报告日期")

    # 总体统计
    summary = Column(JSON, nullable=False, comment="总体统计摘要")
    # 示例: {
    #   "total_checked": 1000,
    #   "pass_rate": 85.5,
    #   "violation_rate": 14.5,
    #   "top_violations": [{"rule": "xxx", "count": 50}, ...]
    # }

    # 分规则统计
    rule_statistics = Column(JSON, nullable=False, comment="各规则统计")
    # 示例: [
    #   {"rule_id": 1, "rule_name": "xxx", "checked": 1000, "violations": 50, "violation_rate": 5.0},
    #   ...
    # ]

    # 分平台统计
    platform_statistics = Column(JSON, nullable=True, comment="各平台统计")
    # 示例: {
    #   "阿里拍卖": {"checked": 500, "violations": 30},
    #   "京东拍卖": {"checked": 300, "violations": 20}
    # }

    # 分城市统计
    city_statistics = Column(JSON, nullable=True, comment="各城市统计")

    # 数据质量评分
    quality_score = Column(Float, nullable=False, default=0.0, comment="数据质量评分0-100")

    # 趋势对比
    trend_comparison = Column(JSON, nullable=True, comment="与上次对比")
    # 示例: {"violation_rate_change": -2.3, "quality_score_change": 5.1}

    # 系统字段
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
