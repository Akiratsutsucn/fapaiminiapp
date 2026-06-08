"""数据审核清洗服务核心逻辑"""
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger

from ..models.data_audit import AuditRule, AuditTask, AuditViolation, AuditReport
from ..models.property import Property


class DataAuditService:
    """数据审核服务"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute_audit_task(self, task_id: int) -> Dict[str, Any]:
        """执行审核任务"""
        # 获取任务
        task = await self.db.get(AuditTask, task_id)
        if not task:
            raise ValueError(f"任务ID {task_id} 不存在")

        # 更新任务状态
        task.status = "running"
        task.started_at = datetime.now()
        task.progress = 0.0
        await self.db.commit()

        try:
            # 获取规则列表
            rule_ids = task.rule_ids
            rules_result = await self.db.execute(
                select(AuditRule).where(
                    and_(
                        AuditRule.id.in_(rule_ids),
                        AuditRule.enabled == True
                    )
                )
            )
            rules = rules_result.scalars().all()

            if not rules:
                raise ValueError("没有启用的审核规则")

            # 构建查询条件
            query = select(Property)
            if task.scope:
                query = self._apply_scope_filter(query, task.scope)

            # 获取待审核的房源
            properties_result = await self.db.execute(query)
            properties = properties_result.scalars().all()

            task.total_records = len(properties)
            await self.db.commit()

            # 执行审核
            passed_count = 0
            flagged_count = 0
            fixed_count = 0
            deleted_count = 0

            for idx, property_obj in enumerate(properties):
                # 对每条房源应用所有规则
                property_violations = []
                for rule in rules:
                    violation = await self._check_rule(property_obj, rule)
                    if violation:
                        property_violations.append(violation)

                # 处理违规
                if property_violations:
                    for violation_data in property_violations:
                        # 创建违规记录
                        violation = AuditViolation(
                            task_id=task_id,
                            rule_id=violation_data["rule_id"],
                            property_id=property_obj.id,
                            rule_code=violation_data["rule_code"],
                            rule_name=violation_data["rule_name"],
                            severity=violation_data["severity"],
                            violation_detail=violation_data["detail"],
                            action_taken=violation_data["action"],
                            status="open"
                        )
                        self.db.add(violation)

                        # 执行动作
                        action_result = await self._execute_action(
                            property_obj, rule, violation_data
                        )

                        if action_result == "deleted":
                            deleted_count += 1
                        elif action_result == "fixed":
                            fixed_count += 1
                            violation.status = "resolved"
                            violation.fixed_at = datetime.now()
                            violation.fixed_by = "system"
                        elif action_result == "flagged":
                            flagged_count += 1
                else:
                    passed_count += 1

                # 更新进度
                task.progress = ((idx + 1) / len(properties)) * 100
                if (idx + 1) % 100 == 0:
                    await self.db.commit()

            # 更新任务统计
            task.passed_count = passed_count
            task.flagged_count = flagged_count
            task.fixed_count = fixed_count
            task.deleted_count = deleted_count
            task.status = "completed"
            task.completed_at = datetime.now()
            task.duration_seconds = int((task.completed_at - task.started_at).total_seconds())
            task.progress = 100.0

            await self.db.commit()

            # 生成报告
            await self._generate_report(task_id)

            logger.info(f"审核任务 {task_id} 完成: 总数={task.total_records}, "
                       f"通过={passed_count}, 标记={flagged_count}, "
                       f"修复={fixed_count}, 删除={deleted_count}")

            return {
                "task_id": task_id,
                "status": "completed",
                "total": task.total_records,
                "passed": passed_count,
                "flagged": flagged_count,
                "fixed": fixed_count,
                "deleted": deleted_count,
            }

        except Exception as e:
            # 任务失败
            task.status = "failed"
            task.error_message = str(e)
            task.completed_at = datetime.now()
            if task.started_at:
                task.duration_seconds = int((task.completed_at - task.started_at).total_seconds())
            await self.db.commit()
            logger.error(f"审核任务 {task_id} 失败: {e}")
            raise

    def _apply_scope_filter(self, query, scope: Dict[str, Any]):
        """应用审核范围过滤"""
        if "platforms" in scope and scope["platforms"]:
            query = query.where(Property.auction_platform.in_(scope["platforms"]))

        if "cities" in scope and scope["cities"]:
            query = query.where(Property.city_id.in_(scope["cities"]))

        if "date_range" in scope:
            date_range = scope["date_range"]
            if "start" in date_range:
                query = query.where(Property.created_at >= date_range["start"])
            if "end" in date_range:
                query = query.where(Property.created_at <= date_range["end"])

        return query

    async def _check_rule(self, property_obj: Property, rule: AuditRule) -> Optional[Dict[str, Any]]:
        """检查单条规则，返回违规信息或None"""
        config = rule.config
        category = rule.category

        violation = None

        if category == "field_required":
            # 必填字段检查
            violation = self._check_required_fields(property_obj, config)

        elif category == "field_range":
            # 字段范围检查
            violation = self._check_field_range(property_obj, config)

        elif category == "field_format":
            # 字段格式检查
            violation = self._check_field_format(property_obj, config)

        elif category == "region_filter":
            # 地区过滤
            violation = self._check_region(property_obj, config)

        elif category == "property_type_filter":
            # 房产类型过滤
            violation = self._check_property_type(property_obj, config)

        if violation:
            return {
                "rule_id": rule.id,
                "rule_code": rule.rule_code,
                "rule_name": rule.rule_name,
                "severity": rule.severity,
                "action": rule.action,
                "detail": violation,
            }

        return None

    def _check_required_fields(self, property_obj: Property, config: Dict) -> Optional[Dict]:
        """检查必填字段"""
        fields = config.get("fields", [])
        missing_fields = []

        for field in fields:
            value = getattr(property_obj, field, None)
            if value is None or value == "" or value == 0:
                missing_fields.append(field)

        if missing_fields:
            return {
                "type": "missing_required_fields",
                "missing_fields": missing_fields,
                "message": f"缺少必填字段: {', '.join(missing_fields)}"
            }
        return None

    def _check_field_range(self, property_obj: Property, config: Dict) -> Optional[Dict]:
        """检查字段范围"""
        field = config.get("field")
        min_val = config.get("min")
        max_val = config.get("max")

        value = getattr(property_obj, field, None)
        if value is None:
            return None

        if min_val is not None and value < min_val:
            return {
                "type": "value_below_minimum",
                "field": field,
                "value": value,
                "expected_min": min_val,
                "message": f"{field}值({value})低于最小值({min_val})"
            }

        if max_val is not None and value > max_val:
            return {
                "type": "value_above_maximum",
                "field": field,
                "value": value,
                "expected_max": max_val,
                "message": f"{field}值({value})超过最大值({max_val})"
            }

        return None

    def _check_field_format(self, property_obj: Property, config: Dict) -> Optional[Dict]:
        """检查字段格式"""
        field = config.get("field")
        pattern = config.get("pattern")

        value = getattr(property_obj, field, None)
        if not value:
            return None

        if pattern and not re.match(pattern, str(value)):
            return {
                "type": "invalid_format",
                "field": field,
                "value": value,
                "expected_pattern": pattern,
                "message": f"{field}格式不符合要求"
            }

        return None

    def _check_region(self, property_obj: Property, config: Dict) -> Optional[Dict]:
        """检查地区"""
        allowed_cities = config.get("allowed_cities", [])

        if property_obj.city_id not in allowed_cities:
            return {
                "type": "invalid_region",
                "city_id": property_obj.city_id,
                "province_city": property_obj.province_city,
                "allowed_cities": allowed_cities,
                "message": f"不在允许的城市范围内: {property_obj.province_city}"
            }

        return None

    def _check_property_type(self, property_obj: Property, config: Dict) -> Optional[Dict]:
        """检查房产类型"""
        allowed_types = config.get("allowed_types", [])

        if property_obj.property_type not in allowed_types:
            return {
                "type": "invalid_property_type",
                "property_type": property_obj.property_type,
                "allowed_types": allowed_types,
                "message": f"不在允许的房产类型范围内: {property_obj.property_type}"
            }

        return None

    async def _execute_action(
        self,
        property_obj: Property,
        rule: AuditRule,
        violation_data: Dict
    ) -> str:
        """执行规则动作"""
        action = rule.action

        if action == "delete":
            # 删除房源
            await self.db.delete(property_obj)
            return "deleted"

        elif action == "fix" and rule.auto_fix:
            # 自动修复（仅支持部分场景）
            if self._try_auto_fix(property_obj, violation_data):
                return "fixed"
            else:
                return "flagged"

        elif action == "flag":
            # 仅标记，不做修改
            return "flagged"

        return "flagged"

    def _try_auto_fix(self, property_obj: Property, violation_data: Dict) -> bool:
        """尝试自动修复"""
        detail = violation_data.get("detail", {})
        fix_type = detail.get("type")

        # 这里可以根据具体情况实现自动修复逻辑
        # 例如：补充默认值、格式化数据等

        # 示例：补充缺失的必填字段为默认值
        if fix_type == "missing_required_fields":
            missing = detail.get("missing_fields", [])
            for field in missing:
                if field in ["starting_price", "deposit", "increment_amount"]:
                    setattr(property_obj, field, 0)
                elif field in ["area"]:
                    setattr(property_obj, field, 0.0)
            return True

        return False

    async def _generate_report(self, task_id: int):
        """生成审核报告"""
        task = await self.db.get(AuditTask, task_id)
        if not task:
            return

        # 获取违规记录
        violations_result = await self.db.execute(
            select(AuditViolation).where(AuditViolation.task_id == task_id)
        )
        violations = violations_result.scalars().all()

        # 总体统计
        total_checked = task.total_records
        total_violations = len(violations)
        pass_rate = (task.passed_count / total_checked * 100) if total_checked > 0 else 0
        violation_rate = (total_violations / total_checked * 100) if total_checked > 0 else 0

        # Top违规规则
        rule_violation_counts = {}
        for v in violations:
            rule_violation_counts[v.rule_code] = rule_violation_counts.get(v.rule_code, 0) + 1

        top_violations = sorted(
            [{"rule": k, "rule_name": "", "count": v} for k, v in rule_violation_counts.items()],
            key=lambda x: x["count"],
            reverse=True
        )[:10]

        # 补充规则名称
        for item in top_violations:
            for v in violations:
                if v.rule_code == item["rule"]:
                    item["rule_name"] = v.rule_name
                    break

        summary = {
            "total_checked": total_checked,
            "total_passed": task.passed_count,
            "total_violations": total_violations,
            "pass_rate": round(pass_rate, 2),
            "violation_rate": round(violation_rate, 2),
            "top_violations": top_violations,
        }

        # 分规则统计
        rule_statistics = []
        for rule_id in task.rule_ids:
            rule_violations = [v for v in violations if v.rule_id == rule_id]
            if rule_violations:
                rule_name = rule_violations[0].rule_name
                rule_code = rule_violations[0].rule_code
            else:
                rule_obj = await self.db.get(AuditRule, rule_id)
                rule_name = rule_obj.rule_name if rule_obj else "未知规则"
                rule_code = rule_obj.rule_code if rule_obj else ""

            violation_count = len(rule_violations)
            violation_rate_for_rule = (violation_count / total_checked * 100) if total_checked > 0 else 0

            rule_statistics.append({
                "rule_id": rule_id,
                "rule_code": rule_code,
                "rule_name": rule_name,
                "checked": total_checked,
                "violations": violation_count,
                "violation_rate": round(violation_rate_for_rule, 2),
            })

        # 分平台统计
        platform_statistics = {}
        for v in violations:
            prop = await self.db.get(Property, v.property_id)
            if prop:
                platform = prop.auction_platform
                if platform not in platform_statistics:
                    platform_statistics[platform] = {"checked": 0, "violations": 0}
                platform_statistics[platform]["violations"] += 1

        # 分城市统计
        city_statistics = {}
        for v in violations:
            prop = await self.db.get(Property, v.property_id)
            if prop:
                city = prop.province_city
                if city not in city_statistics:
                    city_statistics[city] = {"checked": 0, "violations": 0}
                city_statistics[city]["violations"] += 1

        # 计算数据质量评分（简单算法：通过率）
        quality_score = pass_rate

        # 创建报告
        report = AuditReport(
            task_id=task_id,
            report_date=datetime.now(),
            summary=summary,
            rule_statistics=rule_statistics,
            platform_statistics=platform_statistics,
            city_statistics=city_statistics,
            quality_score=round(quality_score, 2),
        )

        self.db.add(report)
        await self.db.commit()

        logger.info(f"审核报告已生成: task_id={task_id}, quality_score={quality_score}")
