# Gateway 路由设计

## 1. 路由规范

### 1.1 URL 规范

```
/api/{module}/{function}/{action}
```

| 部分 | 说明 | 示例 |
|------|------|------|
| `/api` | API 前缀 | - |
| `{module}` | 模块名 | auth, system, org, agent, memory |
| `{function}` | 功能名 | user, role, departments, employee, agent |
| `{action}` | 动作（可选） | list, :id, bind-agent |

### 1.2 系统管理概念对应

| 概念 | 说明 | 示例 |
|------|------|------|
| **Module** | 系统模块/菜单 | 系统管理、组织管理 |
| **Function** | 功能点 | 用户管理、角色管理、部门管理 |
| **Action** | 操作 | 列表、详情、创建、更新、删除 |

### 1.3 HTTP 方法规范

| 方法 | 用途 | 示例 |
|------|------|------|
| GET | 查询资源 | `GET /api/system/user` |
| POST | 创建资源 | `POST /api/system/departments` |
| PUT | 更新资源 | `PUT /api/system/roles/:id` |
| DELETE | 删除资源 | `DELETE /api/departments/employees/:id` |
| PATCH | 部分更新 | `PATCH /api/system/users/:id/status` |

## 2. 认证路由

### 2.1 路由列表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/login` | 用户登录 | 否 |
| POST | `/api/auth/logout` | 用户登出 | 是 |
| POST | `/api/auth/refresh` | 刷新 Token | 否 |
| GET | `/api/auth/codes` | 获取权限码列表 | 是 |
| GET | `/api/auth/captcha` | 获取验证码 | 否 |

### 2.2 接口定义

#### 登录

```typescript
// Request
POST /api/auth/login
Content-Type: application/json

{
  "username": "string",  // 用户名
  "password": "string",  // 密码
  "captcha": "string"    // 验证码（可选）
}

// Response
{
  "code": 200,
  "data": {
    "accessToken": "string",  // JWT Token
    "expires": 1700000000,    // 过期时间戳
    "users": {
      "id": "string",
      "name": "string",
      "avatar": "string"
    }
  }
}
```

#### 刷新 Token

```typescript
// Request
POST /api/auth/refresh
Cookie: refreshToken=xxx  // HttpOnly Cookie

// Response
{
  "code": 200,
  "data": {
    "accessToken": "string",
    "expires": 1700000000
  }
}
```

#### 获取权限码

```typescript
// Request
GET /api/auth/codes

// Response
{
  "code": 200,
  "data": [
    "system:user:view",
    "system:user:create",
    "org:employee:view"
  ]
}
```

## 3. 系统管理路由

### 3.1 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/user` | 用户列表 |
| GET | `/api/system/users/:id` | 用户详情 |
| POST | `/api/system/user` | 创建用户 |
| PUT | `/api/system/users/:id` | 更新用户 |
| DELETE | `/api/system/users/:id` | 删除用户 |
| PATCH | `/api/system/users/:id/status` | 启用/停用 |
| POST | `/api/system/users/:id/reset-password` | 重置密码 |

### 3.2 角色管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/role` | 角色列表 |
| GET | `/api/system/roles/:id` | 角色详情 |
| POST | `/api/system/role` | 创建角色 |
| PUT | `/api/system/roles/:id` | 更新角色 |
| DELETE | `/api/system/roles/:id` | 删除角色 |

### 3.3 模块管理（菜单）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/system/module` | 模块列表（树形菜单） |
| GET | `/api/system/module/user` | 当前用户模块（菜单） |
| GET | `/api/system/module/:id` | 模块详情 |
| GET | `/api/system/module/name-exists` | 检查名称是否存在 |
| GET | `/api/system/module/path-exists` | 检查路径是否存在 |
| POST | `/api/system/module` | 创建模块 |
| PUT | `/api/system/module/:id` | 更新模块 |
| DELETE | `/api/system/module/:id` | 删除模块 |

## 4. 组织管理路由

### 4.1 部门管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments/departments` | 部门列表（树形） |
| GET | `/api/departments/departments/:id` | 部门详情 |
| POST | `/api/departments/departments` | 创建部门 |
| PUT | `/api/departments/departments/:id` | 更新部门 |
| DELETE | `/api/departments/departments/:id` | 删除部门 |

### 4.2 岗位管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments/position` | 岗位列表 |
| GET | `/api/departments/positions/:id` | 岗位详情 |
| POST | `/api/departments/position` | 创建岗位 |
| PUT | `/api/departments/positions/:id` | 更新岗位 |
| DELETE | `/api/departments/positions/:id` | 删除岗位 |

### 4.3 员工管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/departments/employee` | 员工列表 |
| GET | `/api/departments/employees/:id` | 员工详情 |
| POST | `/api/departments/employee` | 创建员工 |
| PUT | `/api/departments/employees/:id` | 更新员工 |
| DELETE | `/api/departments/employees/:id` | 删除员工 |
| POST | `/api/departments/employees/:id/bind-agent` | 绑定 Agent |
| POST | `/api/departments/employees/:id/unbind-agent` | 解绑 Agent |

## 5. Agent 路由

### 5.1 Agent 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agent` | Agent 列表 |
| GET | `/api/agents/:id` | Agent 详情 |
| POST | `/api/agent` | 创建 Agent |
| PUT | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 删除 Agent |

### 5.2 对话接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/agents/chat` | 发送消息 |
| GET | `/api/agents/chat/history` | 获取历史记录 |
| DELETE | `/api/agents/chat/:sessionId` | 清空会话 |

### 5.3 技能管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/agents/skill` | 技能列表 |
| POST | `/api/agents/skill/install` | 安装技能 |
| DELETE | `/api/agents/skill/:id` | 卸载技能 |

## 6. 记忆路由

### 6.1 Subject 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/memory/subject` | Subject 列表 |
| GET | `/api/memory/subject/:id` | Subject 详情 |
| POST | `/api/memory/subject` | 创建 Subject |
| PUT | `/api/memory/subject/:id` | 更新 Subject |
| DELETE | `/api/memory/subject/:id` | 删除 Subject |

### 6.2 记忆检索

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/memory/search` | 语义检索 |
| GET | `/api/memory/conversation` | 获取对话记录 |

## 7. 当前用户接口

### 7.1 路由列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/users/info` | 获取当前用户信息 |
| GET | `/api/users/modules` | 获取当前用户模块（菜单） |
| PUT | `/api/users/profile` | 更新个人资料 |
| PUT | `/api/users/password` | 修改密码 |

### 7.2 接口定义

#### 获取当前用户信息

```typescript
// Request
GET /api/users/info

// Response
{
  "code": 200,
  "data": {
    "id": "string",
    "username": "string",
    "name": "string",
    "avatar": "string",
    "status": 1,
    "employee": {
      "id": "string",
      "employeeNo": "string",
      "departmentsId": "string",
      "departmentsName": "string",
      "positionId": "string",
      "positionName": "string"
    },
    "roles": ["string"],
    "permissions": ["string"]
  }
}
```

## 8. WebSocket 路由

### 8.1 连接端点

```
WS /api/ws
```

### 8.2 消息类型

| 方法 | 说明 |
|------|------|
| `agent.chat` | 对话消息 |
| `agent.subscribe` | 订阅 Agent 事件 |
| `agent.unsubscribe` | 取消订阅 |
| `session.create` | 创建会话 |
| `session.close` | 关闭会话 |

### 8.3 事件类型

| 事件 | 说明 |
|------|------|
| `agent.message` | Agent 回复消息 |
| `agent.typing` | Agent 正在输入 |
| `agent.error` | Agent 错误 |
| `session.update` | 会话状态更新 |

## 9. 响应格式

### 9.1 成功响应

```json
{
  "code": 200,
  "data": { ... },
  "message": "success"
}
```

### 9.2 列表响应

```json
{
  "code": 200,
  "data": {
    "list": [ ... ],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 9.3 错误响应

```json
{
  "code": 400,
  "data": null,
  "message": "请求参数错误"
}
```

## 10. 模块与功能对照表

| 模块 | 功能 | 路径前缀 |
|------|------|---------|
| **认证** | 登录/登出/刷新 | `/api/auth/*` |
| **系统管理** | 模块管理 | `/api/system/module/*` |
| **系统管理** | 用户管理 | `/api/system/users/*` |
| **系统管理** | 角色管理 | `/api/system/roles/*` |
| **组织管理** | 部门管理 | `/api/departments/departments/*` |
| **组织管理** | 岗位管理 | `/api/departments/positions/*` |
| **组织管理** | 员工管理 | `/api/departments/employees/*` |
| **Agent** | Agent 管理 | `/api/agents/*` |
| **Agent** | 技能管理 | `/api/agents/skill/*` |
| **记忆** | Subject 管理 | `/api/memory/subject/*` |
| **记忆** | 记忆检索 | `/api/memory/*` |
| **当前用户** | 个人信息 | `/api/users/*` |

## 11. 关联文档

- [架构设计](./architecture.md)
- [认证授权](./auth.md)
- [协议设计](./protocol.md)
