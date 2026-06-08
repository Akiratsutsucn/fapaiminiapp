# 用户角色管理强化实现报告

## 实施日期
2026-06-08

## 实施内容

### 1. 用户模型扩展
**文件**: `backend/app/models/user.py`

- 扩展了 `role` 字段的注释，支持新角色：
  - `leader`: 领导（只读）
  - `content_manager`: 内容管理员（限定模块）
  - `salesman`: 业务员（不能登录后台）
  - 保留现有角色：`admin`, `agent`, `customer`

### 2. 权限中间件实现
**文件**: `backend/app/core/security.py`

新增功能：

#### 2.1 角色权限映射
```python
ROLE_PERMISSIONS = {
    "admin": ["*"],  # 全部权限
    "leader": ["dashboard", "users", "properties", "demands", "articles", "banners", "crawler", "communities", "data-audit"],
    "content_manager": ["articles", "banners", "crawler"],
    "agent": ["dashboard", "users", "demands"],
}
```

#### 2.2 权限检查装饰器

**`check_module_permission(module: str)`**
- 检查当前用户是否有权访问指定模块
- admin 拥有全部权限（"*"）
- 其他角色根据 ROLE_PERMISSIONS 映射检查

**`check_write_permission()`**
- 检查当前用户是否有写权限
- leader 角色为只读，禁止所有写操作（POST/PUT/DELETE）
- 其他有登录权限的角色允许写操作

#### 2.3 后台访问控制
更新 `get_admin_user` 函数，允许以下角色登录管理后台：
- `admin`
- `agent`
- `leader`
- `content_manager`

明确禁止以下角色登录后台：
- `salesman`
- `customer`

### 3. 登录控制
**文件**: `backend/app/api/admin/auth.py`

更新登录逻辑，只允许 `admin`, `agent`, `leader`, `content_manager` 登录管理后台。

### 4. 用户管理API增强
**文件**: `backend/app/api/admin/users.py`

新增/更新接口：

#### 4.1 用户创建增强
- 验证角色合法性
- 检查手机号唯一性
- 自动生成密码哈希

#### 4.2 角色修改接口
```
PUT /api/admin/users/{user_id}/role
Body: { "role": "leader" }
```

#### 4.3 权限查询接口
```
GET /api/admin/users/me/permissions
返回: {
  "role": "leader",
  "permissions": ["dashboard", "users", ...],
  "is_readonly": true,
  "can_access_all": false
}
```

#### 4.4 角色列表接口
```
GET /api/admin/users/roles/list
返回所有可用角色及其描述，供前端下拉选择使用
```

### 5. 所有管理后台模块权限改造

已对所有管理后台路由应用权限控制：

#### 读权限（GET请求）
使用 `check_module_permission(module)` 进行模块级别权限检查：

- **users**: `check_module_permission("users")`
- **properties**: `check_module_permission("properties")`
- **demands**: `check_module_permission("demands")`
- **articles**: `check_module_permission("articles")`
- **banners**: `check_module_permission("banners")`
- **crawler**: `check_module_permission("crawler")`
- **dashboard**: `check_module_permission("dashboard")`
- **communities**: `check_module_permission("communities")`
- **data-audit**: `check_module_permission("data-audit")`

#### 写权限（POST/PUT/DELETE请求）
使用 `check_write_permission()` 拦截 leader 角色的写操作：

**用户管理** (`users.py`)
- POST /api/admin/users (创建)
- PUT /api/admin/users/{user_id} (更新)
- PUT /api/admin/users/{user_id}/role (修改角色)
- DELETE /api/admin/users/{user_id} (删除)

**房源管理** (`properties.py`)
- POST /api/admin/properties (创建)
- PUT /api/admin/properties/{property_id} (更新)
- POST /api/admin/properties/images/{image_id}/toggle-hidden (图片隐藏)
- DELETE /api/admin/properties/{property_id} (删除)
- POST /api/admin/properties/{property_id}/refresh-community (刷新小区)

**需求管理** (`demands.py`)
- POST /api/admin/demands (创建)
- PUT /api/admin/demands/{demand_id} (更新)
- DELETE /api/admin/demands/{demand_id} (删除)
- POST /api/admin/demands/recommend (推荐房源)

**文章管理** (`articles.py`)
- POST /api/admin/articles (创建)
- PUT /api/admin/articles/{article_id} (更新)
- DELETE /api/admin/articles/{article_id} (删除)
- POST /api/admin/articles/sync-from-mp (同步公众号)
- POST /api/admin/articles/import-from-url (导入链接)
- POST /api/admin/articles/{article_id}/refetch-content (重新抓取)

**横幅管理** (`banners.py`)
- POST /api/admin/banners (创建)
- PUT /api/admin/banners/{banner_id} (更新)
- DELETE /api/admin/banners/{banner_id} (删除)

**爬虫管理** (`crawler.py`)
- POST /api/admin/crawler/trigger (触发爬取)
- POST /api/admin/crawler/cookies (更新Cookie)

**小区管理** (`communities.py`)
- POST /api/admin/communities (创建)
- PUT /api/admin/communities/{community_id} (更新)
- DELETE /api/admin/communities/{community_id} (删除)
- POST /api/admin/communities/batch-import (批量导入)
- POST /api/admin/communities/refresh-prices (刷新价格)

**数据审核** (`data_audit.py`)
- POST /api/admin/data-audit/rules (创建规则)
- PUT /api/admin/data-audit/rules/{rule_id} (更新规则)
- DELETE /api/admin/data-audit/rules/{rule_id} (删除规则)
- POST /api/admin/data-audit/tasks (创建任务)
- PUT /api/admin/data-audit/violations/{violation_id} (更新违规记录)

**系统设置** (`settings.py`)
- PUT /api/admin/settings (更新设置)
- POST /api/admin/settings/cities (添加城市)
- POST /api/admin/settings/archive/export (导出归档)

### 6. 数据库迁移
**文件**: `backend/migrations/add_new_roles.sql`

创建了SQL迁移脚本，更新 `users` 表的 `role` 字段注释，说明新支持的角色。

## 角色权限矩阵

| 角色 | 后台登录 | 可访问模块 | 权限类型 | 说明 |
|------|---------|-----------|---------|------|
| admin | ✅ | 全部 | 读写 | 最高管理员 |
| leader | ✅ | 全部 | 只读 | 领导查看，不能修改 |
| content_manager | ✅ | articles, banners, crawler | 读写 | 仅内容管理 |
| agent | ✅ | dashboard, users, demands | 读写 | 代理商权限 |
| salesman | ❌ | - | - | 业务员，不能登录后台 |
| customer | ❌ | - | - | 普通客户 |

## 安全特性

1. **双重防护**：模块级权限 + 操作级权限
2. **细粒度控制**：GET请求模块检查，POST/PUT/DELETE写权限检查
3. **leader只读保证**：在API层面拦截所有写操作
4. **角色验证**：创建和修改用户时验证角色合法性
5. **向后兼容**：不破坏现有admin和agent逻辑

## 前端配套需求

前端需要实现以下功能以配合后端权限系统：

1. **路由守卫**
   - 调用 `GET /api/admin/users/me/permissions` 获取当前用户权限
   - 根据 `permissions` 数组过滤左侧菜单
   - 禁用或隐藏无权访问的模块

2. **按钮控制**
   - 根据 `is_readonly` 字段隐藏或禁用「创建」「编辑」「删除」按钮
   - leader 角色应看到所有数据但无法操作

3. **角色管理界面**
   - 调用 `GET /api/admin/users/roles/list` 获取角色列表
   - 创建用户时提供角色下拉选择
   - 显示角色描述帮助管理员理解

4. **错误处理**
   - 403错误提示"无权访问此模块"或"您是只读角色，无权进行此操作"

## 测试建议

1. **角色登录测试**
   - 创建不同角色用户并测试登录
   - 验证salesman和customer无法登录后台

2. **模块访问测试**
   - content_manager只能访问articles/banners/crawler
   - 访问其他模块应返回403

3. **只读测试**
   - leader登录后能看到所有模块数据
   - 尝试创建/编辑/删除应返回403

4. **权限接口测试**
   - 验证 `/api/admin/users/me/permissions` 返回正确的权限信息
   - 验证 `/api/admin/users/roles/list` 返回完整角色列表

## 注意事项

1. **数据库迁移**：部署前需执行 `add_new_roles.sql` 迁移脚本
2. **现有用户**：现有admin和agent用户不受影响，继续正常使用
3. **密码生成**：新创建用户默认密码为"123456"，建议首次登录后修改
4. **手机号唯一**：创建用户时检查手机号唯一性，避免重复

## 部署检查清单

- [ ] 执行数据库迁移脚本
- [ ] 重启后端服务
- [ ] 验证现有admin账号登录正常
- [ ] 创建测试leader账号并验证只读
- [ ] 创建测试content_manager账号并验证模块限制
- [ ] 前端更新路由守卫和权限控制
- [ ] 端到端测试所有角色权限

## 完成状态
✅ 后端实现完成
⏳ 等待前端配套开发
⏳ 等待测试验证
