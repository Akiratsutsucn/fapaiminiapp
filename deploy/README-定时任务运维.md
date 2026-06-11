# 法拍者联盟 — 定时任务与运维说明

本目录存放生产服务器(122.51.156.252, ubuntu)的 systemd 单元与运维脚本的**版本库副本**。
生产实际路径在 `/etc/systemd/system/` 和 `/opt/fapai/`,改动后务必同步回本目录,避免配置漂移。

## 定时任务编排

```
fapai-crawler.timer  (每天 02:00)
   └─触发→ fapai-crawler.service  (爬虫一次性运行, Type=oneshot)
              ├─ drop-in: timeout.conf   → TimeoutStartSec=14400 (4h超时,防卡死)
              └─ drop-in: onsuccess.conf → OnSuccess=fapai-audit.service (成功后立即跑流水线)

fapai-audit.timer    (每天 06:23)  ← 独立兜底,不依赖爬虫成败
   └─触发→ fapai-audit.service  (Type=oneshot)
              └→ /opt/fapai/post_crawl_pipeline.sh
                    步骤1 成交回访  crawler.backfill_revisit_ended --recent-ended-days 3 --commit
                    步骤2 审核回填  backend/scripts/audit_backfill_fix.py --commit
                    步骤3 数据审核  app.services.audit_scheduler --once
```

**双触发设计**:爬虫成功 → `OnSuccess` 立即跑流水线(数据最新);若爬虫失败/卡死 →
次日 06:23 `fapai-audit.timer` 独立兜底,保证成交回访/审核照常补数据(成交状态、成交价)。

## 关键设计要点(踩过的坑)

1. **timer 的 `[Unit]` 不要写 `Requires=<service>`**
   timer 通过同名隐式关联 service,到点自动触发。若写 `Requires=`,会变成强绑定:
   service 被强杀(stop/SIGTERM)时会**连带把 timer 也停掉**,导致 timer 永久 dead、
   `NEXT` 排不出来。2026-06-11 爬虫卡死被杀后,正是此 bug 让定时任务整体停摆。

2. **爬虫必须有 `TimeoutStartSec`**
   2026-06-10 爬虫因 Playwright 浏览器管道崩溃(EPIPE)但主进程未退出,空耗 20 小时
   (CPU 22h、内存 1G)才被手动杀。drop-in `timeout.conf` 设 4h 超时自动终止。

3. **`post_crawl_pipeline.sh` 每步失败不阻断后续**(`|| echo 跳过`),数据处理尽力而为。

## 常用排查命令

```bash
# 看定时任务下次触发时间(NEXT 为 '-' 即异常)
systemctl list-timers fapai-crawler.timer fapai-audit.timer --all

# 看上次运行结果
systemctl status fapai-crawler.service --no-pager
systemctl status fapai-audit.service --no-pager

# 日志
sudo tail -50 /var/log/fapai/crawler.log
sudo tail -50 /var/log/fapai/crawler-error.log
sudo tail -50 /var/log/fapai/post-crawl-pipeline.log

# 手动补跑(谨慎,会占用服务器数小时)
sudo systemctl start fapai-crawler.service   # 手动跑爬虫
sudo systemctl start fapai-audit.service     # 手动跑数据流水线(成交回访+审核)
```

## 故障恢复:timer 变成 dead / NEXT 为空

```bash
sudo systemctl daemon-reload
sudo systemctl reset-failed fapai-crawler.service   # 清除 failed 状态
sudo systemctl enable --now fapai-crawler.timer
sudo systemctl enable --now fapai-audit.timer
systemctl list-timers --all | grep fapai            # 确认 NEXT 已排出
```

## 部署同步

修改本目录文件后,同步到生产:
```bash
scp deploy/fapai-*.timer deploy/fapai-*.service ubuntu@122.51.156.252:/tmp/
scp deploy/post_crawl_pipeline.sh ubuntu@122.51.156.252:/tmp/
# 服务器上: sudo cp /tmp/<f> 到对应路径 → daemon-reload → 重启相关 timer
```
