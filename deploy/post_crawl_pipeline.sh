#!/bin/bash
# 爬虫完成后的数据处理流水线（由 fapai-audit.service 在爬虫 OnSuccess 时触发）
# 顺序：成交回访 → 审核回填 → 数据审核
# 设计原则：每步失败不阻断后续（数据处理尽力而为），全程记日志。
set -u

VENV=/opt/fapai/venv/bin/python
CRAWLER_ROOT=/opt/fapai
BACKEND_ROOT=/opt/fapai/backend
LOG_PREFIX="[post-crawl-pipeline]"

echo "$LOG_PREFIX ===== 流水线开始 $(date '+%Y-%m-%d %H:%M:%S') ====="

# 加载环境变量（DB、cookie、代理等）
set -a
# shellcheck disable=SC1091
[ -f /opt/fapai/.env ] && source /opt/fapai/.env
set +a

# ── 步骤1：成交回访 ──────────────────────────────────────────
# 复核近3天内已结束/活跃但结束时间已过的房源的真实终态（成交/流拍/撤回）。
# 京东接口无成交数据会保守标已结束（不比现状差）；公拍网/阿里可解析终态。
echo "$LOG_PREFIX --- 步骤1/3 成交回访 $(date '+%H:%M:%S') ---"
cd "$CRAWLER_ROOT" || exit 1
PYTHONPATH="$CRAWLER_ROOT:$BACKEND_ROOT" "$VENV" -m crawler.backfill_revisit_ended \
    --recent-ended-days 3 --commit 2>&1 || echo "$LOG_PREFIX 成交回访异常（已跳过，继续后续）"

# ── 步骤2：审核回填 ──────────────────────────────────────────
# 从公告正文(description)正则回填缺失的起拍价/保证金/加价幅度/面积（提取不到则跳过不填0）
# + 恢复被误隐藏的房源图片。
echo "$LOG_PREFIX --- 步骤2/3 审核回填 $(date '+%H:%M:%S') ---"
cd "$BACKEND_ROOT" || exit 1
PYTHONPATH="$BACKEND_ROOT:$CRAWLER_ROOT" "$VENV" scripts/audit_backfill_fix.py \
    --commit 2>&1 || echo "$LOG_PREFIX 审核回填异常（已跳过，继续后续）"

# ── 步骤3：数据审核 ──────────────────────────────────────────
# 清理非沪甬杭/非不动产/非房产标题；标记缺字段；生成审核报告与执行历史。
echo "$LOG_PREFIX --- 步骤3/3 数据审核 $(date '+%H:%M:%S') ---"
cd "$BACKEND_ROOT" || exit 1
PYTHONPATH="$BACKEND_ROOT" "$VENV" -m app.services.audit_scheduler --once 2>&1 \
    || echo "$LOG_PREFIX 数据审核异常"

echo "$LOG_PREFIX ===== 流水线结束 $(date '+%Y-%m-%d %H:%M:%S') ====="
