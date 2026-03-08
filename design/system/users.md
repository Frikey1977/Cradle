# 用户管理设计

## 1. 模块概述

### 1.1 功能定位
用户管理是系统认证的核心模块，负责系统用户的认证信息管理。用户（User）与员工（Employee）一一对应，但职责分离：
- **User**：负责登录认证（用户名、密码、Token）
- **Employee**：负责业务数据（部门、职位、画像）

### 1.2 核心价值
- **认证隔离**：登录认证与业务数据分离，职责清晰
- **安全可控**：密码、Token 等敏感信息独立管理
- **灵活扩展**：支持多种认证方式（用户名密码、OAuth、LDAP 等）

### 1.3 使用场景
- **场景1**：HR 创建员工时，系统自动创建对应的 User 记录
- **场景2**：员工使用用户名密码登录系统
- **场景3**：管理员重置员工密码
- **场景4**：员工离职时，禁用 User 账号

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 用户列表 | 查询系统用户列表（关联 Employee 显示） |
| 重置密码 | 管理员重置用户密码 |
| 启用/停用 | 控制用户登录状态 |
| 查看登录记录 | 查看用户最近登录信息 |
| **角色分配** | 为用户分配/移除角色 |
| **查看角色** | 查看用户拥有的角色列表 |

### 2.2 业务流程

#### 2.2.1 创建用户

**说明**：用户通常在创建员工时自动创建，不单独提供创建界面。

**自动创建流程**：
```
HR 在组织管理创建员工
    ↓
系统根据员工信息自动创建 User
    ↓
username = employee_no 或拼音
    ↓
生成随机初始密码
    ↓
通知员工修改密码
```

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| employeeId | string | 是 | 关联的员工ID |
| username | string | 是 | 用户名，建议用工号 |
| name | string | 是 | 用户姓名（冗余） |

#### 2.2.2 重置密码

**流程说明**：
1. 管理员选择用户
2. 输入新密码或生成随机密码
3. 确认重置
4. 通知用户

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| newPassword | string | 是 | 新密码 |

#### 2.2.3 查询用户列表

**流程说明**：
1. 分页查询用户列表
2. 关联 Employee 显示部门、职位信息
3. 支持按用户名、姓名搜索

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页条数，默认10 |
| keyword | string | 否 | 用户名/姓名搜索 |

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | string | 用户ID |
| username | string | 用户名 |
| name | string | 姓名 |
| status | number | 状态：0=停用，1=启用 |
| employee | object | 关联的员工信息 |
| employee.employeeNo | string | 工号 |
| employee.departmentsName | string | 部门名称 |
| employee.positionName | string | 职位名称 |
| lastLoginTime | string | 最后登录时间 |
| createTime | string | 创建时间 |

#### 2.2.4 为用户分配角色

**流程说明**：
1. 管理员选择目标用户
2. 系统展示可选角色列表（已启用的角色）
3. 管理员勾选/取消勾选角色
4. 系统保存用户-角色关联关系

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| userId | string | 是 | 用户ID |
| roleIds | string[] | 是 | 角色ID数组，如["role-1", "role-2"] |

**业务规则**：
| 规则 | 说明 |
|------|------|
| 全量替换 | 每次提交覆盖该用户的所有角色关联 |
| 去重校验 | 自动去重重复的角色ID |
| 有效性校验 | 校验所有roleIds是否存在且启用 |
| 最小权限 | 允许roleIds为空数组，表示用户无任何角色 |

**异常处理**：
| 异常情况 | 处理方式 |
|---------|---------|
| 用户不存在 | 返回错误：用户不存在 |
| 角色不存在 | 返回错误：角色XXX不存在 |
| 角色已停用 | 返回错误：角色XXX已停用，无法分配 |

#### 2.2.5 查看用户角色

**流程说明**：
1. 查询用户详情时，同时查询其角色列表
2. 返回角色的基本信息（ID、名称、状态）

**输出结果**：
| 字段名 | 类型 | 说明 |
|--------|------|------|
| roles | array | 角色列表 |
| roles[].id | string | 角色ID |
| roles[].name | string | 角色名称 |
| roles[].status | number | 角色状态：0=停用，1=启用 |
| roles[].permissions | string[] | 角色拥有的模块ID列表 |

**使用场景**：
- 用户详情页展示角色信息
- 用户登录时获取权限列表

## 3. 数据模型

### 3.1 与 Employee 的关系

```
┌─────────────────┐         ┌─────────────────┐
│   t_employees    │         │     t_users      │
│   (业务数据)     │◄───────►│   (认证数据)     │
│                 │  1:1    │                 │
│ • employee_no   │         │ • username      │
│ • name          │         │ • password      │
│ • departments_id       │         │ • status        │
│ • position_id   │         │ • last_login_*  │
│ • email         │         │                 │
│ • profile_json  │         │                 │
└─────────────────┘         └─────────────────┘
        │
        │ user_id
        ▼
┌─────────────────┐
│   r_user_role   │
│  (用户角色关联)  │
└─────────────────┘
```

### 3.2 数据分工

| 数据类型 | 存储位置 | 说明 |
|---------|---------|------|
| 业务数据 | t_employees | 工号、部门、职位、画像等 |
| 认证数据 | t_users | 用户名、密码、登录状态等 |
| 权限数据 | r_user_role | 用户与角色的关联关系 |

## 4. 接口设计

### 4.1 用户列表

```
GET /api/system/users
```

**Query 参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| pageSize | number | 否 | 每页条数，默认10 |
| keyword | string | 否 | 搜索关键词 |

**响应数据**：
```json
{
  "list": [
    {
      "id": "uuid-1",
      "username": "zhangsan",
      "name": "张三",
      "status": 1,
      "avatar": "https://...",
      "employee": {
        "id": "emp-1",
        "employeeNo": "E001",
        "departmentsName": "技术部",
        "positionName": "高级工程师"
      },
      "lastLoginTime": "2026-02-13 10:30:00",
      "createTime": "2026-01-01 09:00:00"
    }
  ],
  "total": 100
}
```

### 4.2 重置密码

```
POST /api/system/users/{id}/reset-password
```

**请求体**：
```json
{
  "newPassword": "newPass123"
}
```

**响应数据**：
```json
{
  "success": true,
  "message": "密码重置成功"
}
```

### 4.3 启用/停用用户

```
PUT /api/system/users/{id}/status
```

**请求体**：
```json
{
  "status": 0  // 0=停用，1=启用
}
```

### 4.4 获取用户角色

```
GET /api/system/users/{id}/roles
```

**响应数据**：
```json
{
  "userId": "uuid-1",
  "username": "zhangsan",
  "roles": [
    {
      "id": "role-1",
      "name": "管理员",
      "status": 1,
      "permissions": ["mod-1", "mod-2", "mod-3"]
    },
    {
      "id": "role-2",
      "name": "普通用户",
      "status": 1,
      "permissions": ["mod-1"]
    }
  ]
}
```

### 4.5 分配用户角色

```
PUT /api/system/users/{id}/roles
```

**请求体**：
```json
{
  "roleIds": ["role-1", "role-2"]
}
```

**响应数据**：
```json
{
  "success": true,
  "message": "角色分配成功",
  "data": {
    "userId": "uuid-1",
    "assignedRoles": ["role-1", "role-2"]
  }
}
```

## 5. 安全设计

### 5.1 密码安全

- 使用 bcrypt 算法加密存储
- 密码强度要求：8位以上，包含大小写字母和数字
- 定期强制修改密码（可配置）

### 5.2 登录安全

- 登录失败锁定：5次失败锁定30分钟
- 异地登录提醒
- 登录日志记录

### 5.3 权限控制

- 只有管理员可以重置密码
- 用户不能查看其他用户的敏感信息

## 6. 关联文档

- [用户表](./database/t_users.md)
- [员工表](../organization/database/t_employees.md)
- [角色管理设计](./roles.md)
- [Gateway认证](../gateway/auth.md)
