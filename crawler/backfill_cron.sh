#!/bin/bash
# 四城市字段/照片持续低频回填（用户 2026-07-24 要求）。
#
# 目标：不停但低负荷地补全 面积/评估价/小区名/照片 等缺失字段，让服务器空闲算力
#       用于补数据，且绝不影响线上服务。
#
# 设计：
#   - 每次只跑「一个城市」的一小批（默认 25 条），四城市轮转（按运行序号取模）。
#   - backfill_fields 默认模式即覆盖 面积/加价/起拍价/保证金/评估价/照片（只补非空更优值，
#     绝不用空覆盖已有数据），order_by(id.desc()) 优先补最新房源。
#   - 抓不到的老房源(已下架/非司法标的)自动判为 fail 跳过，不阻塞。
#   - 小区名(仅上海/宁波，走贝壳搜索接口)每 4 次运行补一次。
#   - nice/ionice 降到最低优先级，flock 防重入（上一轮没跑完就跳过本轮）。
#
# 由 cron 低频调用（见 crontab）。手动测试：bash backfill_cron.sh
set -u

FAPAI_DIR=/opt/fapai
PY="$FAPAI_DIR/venv/bin/python"
BATCH="${BACKFILL_BATCH:-25}"          # 每次每城市回填条数
LOGDIR=/opt/fapai/backfill_logs         # ubuntu 用户可写（cron 以 ubuntu 身份运行，勿用 sudo/root）
STATE="$LOGDIR/state"                    # 记录运行序号，用于城市轮转
LOG="$LOGDIR/backfill_$(date +%Y%m%d).log"

CITIES=(310000 330100 330200 371300)    # 上海 杭州 宁波 临沂
CITY_NAMES=(上海 杭州 宁波 临沂)

# 读取并递增运行序号
N=0
[ -f "$STATE" ] && N=$(cat "$STATE" 2>/dev/null || echo 0)
IDX=$(( N % 4 ))
CITY=${CITIES[$IDX]}
CNAME=${CITY_NAMES[$IDX]}
echo $(( N + 1 )) > "$STATE"

# 清理 7 天前的旧日志，避免磁盘堆积
find "$LOGDIR" -name 'backfill_*.log' -mtime +7 -delete 2>/dev/null

{
  echo "===== backfill run #$N city=$CNAME($CITY) batch=$BATCH $(date) ====="
  cd "$FAPAI_DIR" || exit 1

  # 1) 字段+照片回填（覆盖 面积/评估价/照片 等），低优先级运行
  nice -n 19 ionice -c3 timeout 3000 "$PY" -m crawler.backfill_fields \
      --commit --city-id "$CITY" --limit "$BATCH" 2>&1

  # 2) 小区名：仅上海/宁波支持（贝壳），每 4 轮补一次，避免过于频繁触发反爬
  if { [ "$CITY" = "310000" ] || [ "$CITY" = "330200" ]; } && [ $(( N % 4 )) -eq 0 ]; then
      CN=上海; [ "$CITY" = "330200" ] && CN=宁波
      echo "----- community_scraper $CN -----"
      nice -n 19 ionice -c3 timeout 900 "$PY" -m crawler.community_scraper \
          --city "$CN" --limit 15 2>&1 || true
  fi

  echo "===== done run #$N $(date) ====="
} >> "$LOG" 2>&1
