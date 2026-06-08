# 爬虫任务记录详细化功能实现说明

## 实现概览
本次实现为爬虫系统添加了详细的任务统计功能，能够记录三个平台（阿里拍卖、京东拍卖、公拍网）在三个城市（上海、宁波、杭州）的抓取详情。

## 修改文件清单

### 1. 数据库模型层
**文件：`backend/app/models/crawl.py`**
- 新增 `CrawlerTaskDetail` 模型类
- 字段包括：task_id, platform, city, total_fetched, new_count, updated_count, failed_count, skipped_count, error_messages, duration_seconds

**文件：`backend/app/models/__init__.py`**
- 导出新增的 `CrawlerTaskDetail` 模型

### 2. 数据库迁移
**文件：`backend/alembic/versions/d1e2f3a4b5c6_add_crawler_task_details.py`**
- 创建 `crawler_task_details` 表的迁移脚本
- 包含外键约束和索引

### 3. 数据访问层
**文件：`crawler/storage/repository.py`**
- 新增 `CrawlerTaskDetailRepository` 类
- 实现 `create_or_update()` 方法：创建或更新任务详情
- 实现 `get_by_task_id()` 方法：查询指定任务的所有详情

### 4. 爬虫引擎核心
**文件：`crawler/engine.py`**
- 在 `_process_platform()` 方法中新增 `city_stats` 字典，按城市统计数据
- 在列表抓取阶段初始化各城市的统计计数器
- 在详情处理阶段根据每个item的城市属性进行统计归类
- 平台处理完成后，将各城市统计保存到数据库

**文件：`crawler/platforms/base.py`**
- 在 `ListItem` 类中新增 `city` 字段，用于标识每个item所属城市

### 5. API接口层
**文件：`backend/app/api/admin/crawler.py`**
- 新增 `GET /api/admin/crawler/tasks/{task_id}/details` 接口
- 返回指定任务的详细统计信息，按平台和城市分组展示

## 数据库表结构

```sql
CREATE TABLE crawler_task_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    task_id INT NOT NULL COMMENT '关联的爬虫任务ID',
    platform VARCHAR(32) NOT NULL COMMENT '平台名称：阿里拍卖/京东拍卖/公拍网',
    city VARCHAR(32) NOT NULL COMMENT '城市名称：上海/宁波/杭州',
    total_fetched INT DEFAULT 0 COMMENT '抓取总数',
    new_count INT DEFAULT 0 COMMENT '新增数量',
    updated_count INT DEFAULT 0 COMMENT '更新数量',
    failed_count INT DEFAULT 0 COMMENT '失败数量',
    skipped_count INT DEFAULT 0 COMMENT '跳过数量',
    error_messages TEXT COMMENT '错误信息（截断至1000字符）',
    duration_seconds INT COMMENT '耗时（秒）',
    created_at DATETIME DEFAULT NOW(),
    FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
    INDEX idx_task_details_task_id (task_id)
);
```

## API接口规范

### 获取任务详情
```
GET /api/admin/crawler/tasks/{task_id}/details
```

**响应示例：**
```json
{
  "task_id": 123,
  "task_status": "completed",
  "task_created_at": "2026-06-08 19:00:00",
  "details": [
    {
      "platform": "阿里拍卖",
      "city": "上海",
      "total_fetched": 100,
      "new_count": 20,
      "updated_count": 75,
      "failed_count": 5,
      "skipped_count": 0,
      "error_messages": null,
      "duration_seconds": 120,
      "created_at": "2026-06-08 19:02:00"
    }
  ]
}
```

## 部署步骤

### 1. 运行数据库迁移
```bash
cd backend
alembic upgrade head
```

### 2. 重启后端服务
```bash
systemctl restart fapai-backend
```

### 3. 测试验证
```bash
# 运行测试脚本
cd backend
python test_crawler_details.py
```

## 功能特性

1. **细粒度统计**：按平台×城市维度记录详细数据
2. **向后兼容**：不影响现有爬虫功能，新旧任务可共存
3. **错误追踪**：记录每个城市的错误信息，方便问题排查
4. **时间统计**：记录每个平台×城市的抓取耗时
5. **自动归类**：爬虫运行时自动识别item所属城市并统计

## 注意事项

1. 错误信息会自动截断到1000字符，避免数据库字段溢出
2. 每次爬虫运行都会为涉及的平台×城市组合创建详情记录
3. 如果同一任务多次运行同一平台×城市，会更新而非重复创建记录
4. 现有的 `crawl_tasks` 表的统计字段保持不变，新增的详情表是补充信息
