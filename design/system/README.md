# 系统管理模块

## 模块概述

系统管理模块提供系统级别的基础功能，包括用户认证、角色权限、菜单模块等核心功能。这些功能是系统运行的基础，与业务模块（组织管理）分离。

## 核心职责

| 职责 | 说明 |
|------|------|
| **用户认证** | 用户登录认证、Token管理（仅人类员工） |
| **角色权限** | 角色定义、权限分配（RBAC模型） |
| **菜单模块** | 系统菜单/模块管理、前端路由配置 |
| **代码字典** | 系统代码字典管理 |

## 子模块列表

| 子模块 | 说明 | 文档 |
|--------|------|------|
| 用户管理 | 系统用户认证管理 | [user.md](./users.md) |
| 角色管理 | 角色定义与权限分配 | [roles.md](./roles.md) |
| 模块管理 | 系统功能模块/菜单管理 | [module.md](./module.md) |
| 代码管理 | 统一管理系统代码字典 | [code.md](./code.md) |
| CLI基础设施 | 命令行执行引擎和安全管控 | [cli.md](./cli.md) |

## 权限模型（RBAC）

```
用户 (t_users)
    ↓ 1:N
角色 (t_roles)
    ↓ 1:N
模块/菜单 (t_modules)
```

### 权限控制流程

```
用户登录
    ↓
验证用户名密码（t_users）
    ↓
获取用户角色（r_user_role）
    ↓
获取角色权限（t_roles.permissions JSON字段）
    ↓
返回 Token + 权限列表
    ↓
后续请求验证权限
```

## 数据库设计

### 数据表

| 表名 | 说明 | 文档 |
|------|------|------|
| t_users | 用户认证表 | [database/t_users.md](./database/t_users.md) |
| t_roles | 角色管理表 | [database/t_roles.md](./database/t_roles.md) |
| t_modules | 模块/菜单表 | [database/t_modules.md](./database/t_modules.md) |
| t_codes | 代码字典表 | [database/t_codes.md](./database/t_codes.md) |
| t_exec_session | 命令执行会话表 | [database/t_exec_session.md](./database/t_exec_session.md) |
| t_exec_approval | 执行审批记录表 | [database/t_exec_approval.md](./database/t_exec_approval.md) |

### 关系表

| 表名 | 说明 | 文档 |
|------|------|------|
| r_user_role | 用户-角色关联表 | [database/r_user_roles.md](./database/r_user_roles.md) |

> **说明**：角色-模块权限使用 `t_roles.permissions` JSON字段存储，无需单独的关系表。详见 [t_roles.md](./database/t_roles.md#permissions-权限列表)。

### 与组织管理模块的关系

| 系统管理表 | 关联字段 | 组织管理模块表 | 说明 |
|-----------|---------|--------------|------|
| t_users | - | [t_employees](../organization/database/t_employees.md) | Employee.user_id 关联 User |
| t_roles | - | - | 独立管理 |
| t_modules | - | - | 独立管理 |

## 模块边界

### 系统管理负责

- ✅ 用户登录认证（用户名、密码、Token）
- ✅ 角色定义和管理
- ✅ 权限分配（角色-模块关联）
- ✅ 菜单/模块管理
- ✅ 代码字典管理

### 组织管理负责

- ❌ 员工业务信息管理（移至 [organization](../organization/README.md)）
- ❌ 部门组织架构（移至 [organization](../organization/README.md)）
- ❌ 数字员工管理（移至 [organization](../organization/README.md)）

## 使用场景

### 场景1：新员工入职

```
HR 在组织管理创建员工
    ↓
系统自动创建 User 记录
    ↓
HR 分配角色（如"普通用户"）
    ↓
员工使用用户名密码登录
```

### 场景2：权限调整

```
管理员修改角色权限
    ↓
所有该角色用户自动生效
    ↓
无需修改代码或重新登录
```

## 关联文档

- [角色管理设计](./roles.md)
- [模块管理设计](./module.md)
- [代码管理设计](./code.md)
- [组织管理模块](../organization/README.md) - 员工、部门管理
- [Gateway认证](../gateway/auth.md) - 登录认证流程
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
