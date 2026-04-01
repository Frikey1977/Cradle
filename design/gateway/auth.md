# 认证授权模块设计

## 1. 功能定位

认证授权模块是 Gateway 网关层的核心组件，负责处理 Web 端的用户认证和权限控制。数据来源于组织管理模块的 Employee 和 User 表。

## 2. 认证流程

### 2.1 登录流程

```
用户输入用户名密码
    ↓
Gateway /auth/login 接口
    ↓
验证 t_users（用户名+密码）
    ↓
查询 t_employees（通过 user_id 关联）
    ↓
查询 r_user_role + t_roles（获取权限）
    ↓
生成 AccessToken + RefreshToken
    ↓
更新 last_login_time / last_login_ip
    ↓
返回 Token + 基础用户信息
```

### 2.2 Token 设计

| Token 类型 | 有效期 | 存储位置 | 用途 |
|-----------|--------|---------|------|
| AccessToken | 2小时 | 内存/LocalStorage | 接口访问凭证 |
| RefreshToken | 7天 | HttpOnly Cookie | 刷新 AccessToken |

### 2.3 登录接口

**接口**: `POST /auth/login`

**请求参数**:

```typescript
interface LoginParams {
  username: string;    // 用户名
  password: string;    // 密码
}
```

**响应数据**:

```typescript
interface LoginResult {
  accessToken: string;     // JWT AccessToken
  expires: number;         // 过期时间（时间戳）
  user: {
    id: string;            // 用户ID
    name: string;          // 用户姓名
    avatar?: string;       // 头像
  };
}
```

**错误码**:

| 错误码 | 说明 |
|-------|------|
| 401001 | 用户名或密码错误 |
| 401002 | 账号已停用 |
| 401003 | 员工已离职 |

### 2.4 刷新 Token 接口

**接口**: `POST /auth/refresh`

**说明**: 使用 RefreshToken（Cookie）换取新的 AccessToken

**响应数据**:

```typescript
interface RefreshTokenResult {
  accessToken: string;
  expires: number;
}
```

### 2.5 登出接口

**接口**: `POST /auth/logout`

**说明**: 清除 RefreshToken，使 Token 失效

## 3. 用户信息接口

### 3.1 获取用户信息

**接口**: `GET /users/info`

**说明**: 获取当前登录用户的完整信息

**响应数据**:

```typescript
interface UserInfoResult {
  // User 表数据
  id: string;              // 用户ID
  username: string;        // 用户名
  name: string;            // 姓名
  avatar?: string;         // 头像
  status: number;          // 账号状态
  
  // Employee 表数据
  employee: {
    id: string;            // 员工ID
    employeeNo: string;    // 工号
    departmentsId: string;        // 部门ID
    departmentsName: string;      // 部门名称
    positionId: string;    // 职位ID
    positionName: string;  // 职位名称
    email?: string;        // 邮箱
    phone?: string;        // 电话
    hireDate?: string;     // 入职日期
  };
  
  // 权限数据
  roles: string[];         // 角色编码列表
  permissions: string[];   // 权限标识列表
}
```

### 3.2 获取用户菜单

**接口**: `GET /users/menus`

**说明**: 获取当前用户可见的菜单列表

**响应数据**:

```typescript
interface MenuResult {
  menus: Menu[];
}

interface Menu {
  id: string;           // 菜单ID
  parentId: string;     // 父菜单ID
  name: string;         // 菜单名称
  path: string;         // 路由路径
  component?: string;   // 组件路径
  icon?: string;        // 图标
  sort: number;         // 排序
  status: number;       // 状态
  children?: Menu[];    // 子菜单
}
```

## 4. 权限控制

### 4.1 权限模型

```
用户 (User)
    ↓ 1:N
角色 (Role)
    ↓ 1:N
模块/菜单 (Module)
```

### 4.2 权限验证

Gateway 在请求处理时进行权限验证：

```
请求到达 Gateway
    ↓
解析 AccessToken
    ↓
获取用户角色
    ↓
验证接口权限
    ↓
通过 → 转发到后端服务
拒绝 → 返回 403
```

### 4.3 前端权限

前端通过 `permissions` 列表控制：
- 菜单显示/隐藏
- 按钮禁用/启用
- 页面访问权限

## 5. 数据表关联

### 5.1 认证相关表

| 表名 | 模块 | 用途 | 关联 |
|------|------|------|------|
| t_users | [system](../system/README.md) | 认证主体（用户名、密码） | - |
| t_employees | [organization](../organization/README.md) | 业务数据（部门、职位） | user_id → t_users.sid |
| t_roles | [system](../system/README.md) | 角色定义 | - |
| r_user_role | [system](../system/README.md) | 用户角色关联 | user_id + role_id |
| t_modules | [system](../system/README.md) | 菜单/模块 | - |
| r_role_module | [system](../system/README.md) | 角色模块关联 | role_id + module_id |

### 5.2 模块关系

```
Gateway 认证
    ├── 系统管理模块 (system)
    │   ├── t_users (认证数据)
    │   ├── t_roles (角色定义)
    │   ├── t_modules (菜单模块)
    │   ├── r_user_role (用户角色关联)
    │   └── r_role_module (角色模块关联)
    │
    └── 组织管理模块 (organization)
        └── t_employees (业务数据)
            └── user_id → t_users.sid
```

### 5.3 查询示例

```sql
-- 登录验证查询（关联 system + organization 模块）
SELECT u.sid, u.name, u.password, u.status, u.avatar,
       e.sid as employee_id, e.employee_no, e.departments_id, e.position_id
FROM system.t_users u
LEFT JOIN organization.t_employees e ON e.user_id = u.sid
WHERE u.username = ? AND u.deleted = 0;

-- 获取用户角色权限（system 模块）
SELECT r.sid, r.name, r.permissions
FROM system.t_roles r
INNER JOIN system.r_user_role ur ON ur.role_id = r.sid
WHERE ur.user_id = ? AND r.deleted = 0;
```

## 6. 前端适配

### 6.1 API 接口定义

参考 `web/playground/src/api/core/` 目录：

```typescript
// auth.ts - 认证接口
export namespace AuthApi {
  export interface LoginParams {
    username: string;
    password: string;
  }
  
  export interface LoginResult {
    accessToken: string;
    expires: number;
    user: {
      id: string;
      name: string;
      avatar?: string;
    };
  }
}

// user.ts - 用户信息接口
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/users/info');
}
```

### 6.2 登录流程

```
用户输入账号密码
    ↓
调用 loginApi()
    ↓
存储 AccessToken
    ↓
调用 getUserInfoApi()
    ↓
存储用户信息
    ↓
跳转到首页
```

### 6.3 Token 刷新

- AccessToken 过期前自动刷新
- 使用 RefreshToken（Cookie）换取新 Token
- 刷新失败则跳转登录页

## 7. 安全设计

### 7.1 密码安全

- 使用 bcrypt 算法加密
- 密码强度要求：8位以上，包含大小写字母和数字

### 7.2 Token 安全

- AccessToken 短期有效（2小时）
- RefreshToken 使用 HttpOnly Cookie
- Token 绑定设备指纹

### 7.3 登录安全

- 登录失败锁定（5次失败锁定30分钟）
- 异地登录提醒
- 操作日志记录

## 8. 关联文档

### 系统管理模块（system）
- [用户表](../system/database/t_users.md) - 认证数据
- [角色表](../system/database/t_roles.md) - 角色定义
- [模块表](../system/database/t_modules.md) - 菜单模块
- [系统管理设计](../system/README.md)
- [用户管理设计](../system/users.md)
- [角色管理设计](../system/roles.md)

### 组织管理模块（organization）
- [员工表](../organization/database/t_employees.md) - 业务数据
- [组织管理设计](../organization/README.md)
- [员工管理设计](../organization/employee.md)
