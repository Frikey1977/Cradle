# Cradle 代码开发规范

## 目录

1. [项目概述](#1-项目概述)
2. [目录结构规范](#2-目录结构规范)
3. [命名规范](#3-命名规范)
4. [TypeScript 编码规范](#4-typescript-编码规范)
5. [数据库操作规范](#5-数据库操作规范)
6. [API 设计规范](#6-api-设计规范)
7. [错误处理规范](#7-错误处理规范)
8. [日志规范](#8-日志规范)
9. [测试规范](#9-测试规范)
10. [代码审查清单](#10-代码审查清单)

---

## 1. 项目概述

### 1.1 项目定位

Cradle 是一个面向企业的**私有化部署 AI 助理平台**，为每个员工提供专属 Agent，沉淀岗位工作逻辑，形成企业数字员工资产。

### 1.2 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Gateway 网关层                       │
│                   (认证/路由/权限控制)                        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      Agent 运行时层                          │
│              【五重画像 + 四层记忆架构驱动】                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       Skills 技能层                          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                        数据存储层                            │
│         (SQLite + sqlite-vec，未来迁移至 MySQL)              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 核心业务模块

| 模块 | 说明 | 对应目录 |
|------|------|----------|
| **System** | 系统管理（用户/角色/权限/菜单） | `system/` |
| **Organization** | 组织管理（组织/岗位/员工/技能定义） | `org/` |
| **Agent** | 数字员工管理（Agent定义/运行时/心跳） | `agent/` |
| **Gateway** | 网关层（认证/路由/协议转换） | `gateway/` |
| **Memory** | 记忆系统（上下文/长期记忆） | `memory/` |
| **Skills** | 技能执行引擎 | `system/skills/` |

---

## 2. 目录结构规范

### 2.1 总体结构

代码目录结构与 system_design 设计文档保持一致：

```
cradle/
├── src/
│   ├── gateway/                    # 网关层（对应 system_design/gateway/）
│   │   ├── index.ts               # 入口文件
│   │   ├── config/                # 网关配置
│   │   ├── middleware/            # 中间件
│   │   │   ├── auth.ts           # 认证中间件
│   │   │   ├── error.ts          # 错误处理中间件
│   │   │   └── rate-limit.ts     # 限流中间件
│   │   ├── routes/                # 路由集中管理
│   │   │   ├── index.ts          # 路由统一注册
│   │   │   ├── auth.ts           # 认证路由
│   │   │   ├── user.ts           # 用户路由
│   │   │   ├── role.ts           # 角色路由
│   │   │   ├── org.ts            # 组织路由
│   │   │   ├── employee.ts       # 员工路由
│   │   │   ├── agent.ts          # Agent路由
│   │   │   └── ...               # 其他业务路由
│   │   ├── auth/                  # 认证模块（对应 gateway/auth.md）
│   │   └── shared/                # 共享资源
│   │       ├── types.ts
│   │       ├── errors.ts
│   │       └── utils.ts
│   │
│   ├── system/                     # 系统管理（对应 system_design/system/）
│   │   ├── user/                  # 用户管理（对应 system_design/system/users.md）
│   │   ├── role/                  # 角色管理（对应 system_design/system/roles.md）
│   │   ├── module/                # 模块管理（对应 system_design/system/module.md）
│   │   ├── code/                  # 代码管理（对应 system_design/system/code.md）
│   │   └── cli/                   # CLI基础设施（对应 system_design/system/cli.md）
│   │
│   ├── organization/               # 组织管理（对应 system_design/organization/）
│   │   ├── org/                   # 组织管理（对应 system_design/organization/org.md）
│   │   ├── departments/                  # 部门管理（对应 system_design/organization/position.md）
│   │   ├── employee/              # 员工管理（对应 system_design/organization/employee.md）
│   │   ├── position/              # 岗位管理（对应 system_design/organization/position.md）
│   │   └── skills/                # 技能定义（对应 system_design/organization/skills.md）
│   │
│   ├── agent/                      # Agent管理（对应 system_design/agents/）
│   │   ├── agent/                 # Agent定义管理（对应 system_design/agents/agents.md）
│   │   ├── runtime/               # 运行时（对应 system_design/agents/runtime.md）
│   │   ├── heartbeat/             # 心跳机制（对应 system_design/agents/heartbeat.md）
│   │   ├── monitor/               # 执行监控（对应 system_design/agents/monitor.md）
│   │   └── knowledge/             # 执行知识（对应 system_design/agents/knowledge.md）
│   │
│   ├── core/                       # 核心层（对应 system_design/core/）
│   │   ├── context/               # 上下文管理（对应 system_design/core/context-manager.md）
│   │   ├── adapter/               # 大模型对接（对应 system_design/core/llm-adapter.md）
│   │   │   ├── provider/          # 提供商适配器
│   │   │   ├── manager/           # 模型管理
│   │   │   └── engine/            # 执行引擎
│   │   └── session/               # 会话管理
│   │
│   ├── cron/                       # 定时任务（对应 system_design/cron/）
│   │   ├── scheduler/             # 调度器（对应 system_design/cron/scheduler.md）
│   │   └── job/                   # 任务管理
│   │
│   ├── store/                      # 数据层（使用 Drizzle ORM）
│   │   ├── database.ts           # 数据库连接
│   │   ├── schema.ts             # 表结构定义（所有表）
│   │   └── types.ts              # 数据库类型
│   │
│   └── shared/                     # 全局共享资源
│       ├── errors.ts             # 错误定义
│       └── utils.ts              # 工具函数
│
├── tests/                          # 测试文件
├── docs/                           # 文档
└── scripts/                        # 脚本工具
```

### 2.2 模块内部结构

使用 Drizzle ORM 后，业务模块采用简化结构：

```
src/{module}/{submodule}/
├── index.ts              # 模块入口，统一导出
├── service.ts            # 业务逻辑（直接操作数据库）
├── schema.ts             # Zod 验证Schema
├── types.ts              # 业务类型定义
└── constants.ts          # 模块常量（可选）
```

**说明**：
- **无 controller** - 路由层直接调用 service
- **无 repository** - 使用 Drizzle ORM 直接操作数据库
- **路由集中管理** - 在 `src/gateway/routes/` 中定义

**示例**：

```
src/system/users/          # 对应 system_design/system/users.md
├── index.ts
├── service.ts            # 业务逻辑
├── schema.ts             # Zod 验证
└── types.ts              # 类型定义

src/organization/departments/     # 对应 system_design/organization/org.md
├── index.ts
├── service.ts
├── schema.ts
└── types.ts

src/agents/runtime/        # 对应 system_design/agents/runtime.md
├── index.ts
├── service.ts
├── types.ts
└── constants.ts
```

### 2.3 目录命名规则

| 类型 | 命名格式 | 示例 |
|------|----------|------|
| 目录 | `kebab-case` | `modules/`, `middleware/` |
| 模块 | 小写单数 | `auth/`, `user/`, `org/` |
| 子模块 | 小写单数 | `modules/system/users/` |
| 文件 | `kebab-case.ts` | `routes.ts`, `controller.ts` |

---

## 3. 命名规范

### 3.1 文件命名

| 文件类型 | 命名格式 | 示例 |
|----------|----------|------|
| 路由文件 | `{module}.ts` | `gateway/routes/users.ts` |
| 服务层 | `service.ts` | `user/service.ts` |
| 类型定义 | `types.ts` | `types.ts` |
| 验证Schema | `schema.ts` | `schema.ts` |
| 常量定义 | `constants.ts` | `constants.ts` |
| 工具函数 | `utils.ts` | `utils.ts` |
| 中间件 | `{name}.middleware.ts` | `auth.middleware.ts` |
| 测试文件 | `{name}.test.ts` | `service.test.ts` |

### 3.2 代码命名

#### 变量/函数

```typescript
// ✅ 使用 camelCase
const userName: string = "张三";
const isActive: boolean = true;
const userList: User[] = [];

// ✅ 函数使用动词开头
function getUserById(id: string): Promise<User> {}
function createUser(data: CreateUserDto): Promise<User> {}
function validatePassword(password: string): boolean {}
```

#### 类/接口/类型

```typescript
// ✅ 使用 PascalCase
class UserService {}
class AuthController {}

// ✅ 接口使用 PascalCase
interface User {
  id: string;
  name: string;
}

interface CreateUserDto {
  username: string;
  password: string;
}

// ✅ 类型别名使用 PascalCase
type UserStatus = "active" | "inactive" | "suspended";
type ServiceMode = "exclusive" | "shared" | "public";
```

#### 常量

```typescript
// ✅ 使用 UPPER_SNAKE_CASE
const MAX_LOGIN_ATTEMPTS = 5;
const JWT_EXPIRES_IN = "2h";
const DEFAULT_PAGE_SIZE = 20;

// ✅ 枚举使用 PascalCase + 枚举值 UPPER_SNAKE_CASE
enum UserStatus {
  DISABLED = 0,
  ENABLED = 1,
  SUSPENDED = 2,
}

enum OrgType {
  COMPANY = "company",
  BRANCH = "branch",
  DEPT = "departments",
  GROUP = "group",
}
```

### 3.3 数据库相关命名

遵循 `DATABASE_SPECIFICATION.md` 规范：

| 类型 | 前缀 | 示例 |
|------|------|------|
| 数据表 | `t_` | `t_users`, `t_agent`, `t_departments` |
| 关系表 | `r_` | `r_user_role`, `r_agent_skill` |
| 视图 | `v_` | `v_user_detail` |
| 字段 | `snake_case` | `create_time`, `user_id` |

---

## 4. TypeScript 编码规范

### 4.1 类型定义

#### 优先使用接口（interface）

```typescript
// ✅ 推荐：使用 interface 定义对象类型
interface User {
  sid: string;
  name: string;
  username: string;
  status: UserStatus;
  createTime: Date;
}

// ✅ DTO 使用 interface
interface CreateUserDto {
  username: string;
  password: string;
  name: string;
}

interface UpdateUserDto {
  name?: string;
  avatar?: string;
  status?: UserStatus;
}
```

#### 使用类型别名（type）的场景

```typescript
// ✅ 联合类型
type UserStatus = "active" | "inactive" | "suspended";
type ServiceMode = "exclusive" | "shared" | "public";

// ✅ 元组类型
type UserTuple = [string, string, number];

// ✅ 映射类型
type PartialUser = Partial<User>;
type RequiredDto = Required<CreateUserDto>;
```

### 4.2 函数定义

#### 使用箭头函数

```typescript
// ✅ 推荐：使用箭头函数
const getUserById = async (id: string): Promise<User> => {
  // ...
};

// ✅ 函数参数使用解构
const createUser = async (data: CreateUserDto): Promise<User> => {
  const { username, password, name } = data;
  // ...
};

// ✅ 默认参数
const getUsers = async (page = 1, pageSize = 20): Promise<User[]> => {
  // ...
};
```

#### 函数返回值必须显式声明

```typescript
// ✅ 显式声明返回值类型
async function validateUser(username: string, password: string): Promise<boolean> {
  // ...
}

// ✅ 复杂返回值使用类型别名
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expires: number;
  user: UserInfo;
}

async function login(data: LoginDto): Promise<LoginResult> {
  // ...
}
```

### 4.3 导入/导出规范

#### 导入顺序

```typescript
// 1. 内置模块
import path from "path";
import { readFile } from "fs/promises";

// 2. 第三方模块
import Fastify from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";

// 3. 内部模块（按层级：shared -> store -> 其他模块 -> 当前模块）
import { AppError } from "../../shared/errors.js";
import { db } from "../../store/database.js";
import { roleService } from "../roles/service.js";
import { UserService } from "./service.js";
import { UserSchema } from "./schema.js";
import type { User, CreateUserDto } from "./types.js";
```

#### 导出规范

```typescript
// ✅ 命名导出（推荐）
export interface User {
  id: string;
  name: string;
}

export class UserService {
  // ...
}

export async function getUserById(id: string): Promise<User> {
  // ...
}

// ✅ 默认导出（仅入口文件）
export default async function routes(fastify: FastifyInstance) {
  // ...
}

// ✅ 统一导出（index.ts）
export * from "./types.js";
export * from "./schema.js";
export { UserService } from "./service.js";
export { default as authRoutes } from "./routes.js";
```

### 4.4 错误处理

#### 使用自定义错误类

```typescript
// shared/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "认证失败") {
    super("AUTHENTICATION_ERROR", message, 401);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource}不存在`, 404);
  }
}
```

#### 错误处理模式

```typescript
// ✅ 使用 try-catch 处理异步错误
try {
  const user = await userService.create(data);
  return reply.send({ success: true, data: user });
} catch (error) {
  if (error instanceof ValidationError) {
    return reply.status(400).send({
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }
  
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
  }
  
  // 未知错误
  request.log.error(error);
  return reply.status(500).send({
    code: "INTERNAL_ERROR",
    message: "服务器内部错误",
  });
}
```

---

## 5. 数据库操作规范（Drizzle ORM）

### 5.1 表结构定义

所有表结构集中定义在 `store/schema.ts`：

```typescript
// store/schema.ts
import { mysqlTable, varchar, text, int, datetime, json } from "drizzle-orm/mysql-core";

// 系统管理 - 用户表
export const tUser = mysqlTable("t_users", {
  sid: varchar("sid", { length: 36 }).primaryKey(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  avatar: varchar("avatar", { length: 500 }),
  status: int("status").default(1),
  createTime: datetime("create_time").defaultNow(),
  deleted: int("deleted").default(0),
});

// 系统管理 - 角色表
export const tRole = mysqlTable("t_roles", {
  sid: varchar("sid", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  permissions: json("permissions"),  // 权限列表 ["module-1", "module-2"]
  status: int("status").default(1),
  createTime: datetime("create_time").defaultNow(),
  deleted: int("deleted").default(0),
});

// 组织管理 - 组织架构表
export const tOrg = mysqlTable("t_departments", {
  sid: varchar("sid", { length: 36 }).primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  type: varchar("type", { length: 50 }).notNull(),  // company/branch/departments/group
  parentId: varchar("parent_id", { length: 36 }),
  path: varchar("path", { length: 500 }),
  level: int("level").default(0),
  sort: int("sort").default(0),
  status: int("status").default(1),
  createTime: datetime("create_time").defaultNow(),
  deleted: int("deleted").default(0),
});

// Agent管理 - Agent定义表
export const tAgent = mysqlTable("t_agent", {
  sid: varchar("sid", { length: 36 }).primaryKey(),
  agentNo: varchar("agent_no", { length: 100 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  serviceMode: varchar("service_mode", { length: 20 }).default("exclusive"),
  bindUserId: varchar("bind_user_id", { length: 36 }),
  modelConfig: json("model_config"),
  runtimeConfig: json("runtime_config"),
  status: int("status").default(1),
  createTime: datetime("create_time").defaultNow(),
  deleted: int("deleted").default(0),
});

// 关系表 - 用户角色关联
export const rUserRole = mysqlTable("r_user_roles", {
  userId: varchar("user_id", { length: 36 }).notNull(),
  roleId: varchar("role_id", { length: 36 }).notNull(),
  createTime: datetime("create_time").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));
```

### 5.2 数据库连接

使用 `mysql2/promise` 内置的连接池管理，无需额外库。

```typescript
// store/database.ts
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema.js";

// mysql2/promise 内置连接池管理
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  
  // 连接池配置
  waitForConnections: true,     // 连接忙时等待
  connectionLimit: 10,          // 最大连接数
  queueLimit: 0,                // 队列限制（0 = 无限制）
  
  // 可选优化配置
  enableKeepAlive: true,        // 保持连接活跃
  keepAliveInitialDelay: 10000, // 10秒后开始 keepalive
  connectTimeout: 10000,        // 连接超时 10秒
});

// 创建 Drizzle ORM 实例
export const db = drizzle(pool, { schema, mode: "default" });

// 导出 schema 方便使用
export * from "./schema.js";

// 健康检查
export async function healthCheck(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    return true;
  } catch {
    return false;
  }
}

// 优雅关闭
export async function close(): Promise<void> {
  await pool.end();
}
```

**说明**：`mysql2/promise` 已内置完善的连接池管理功能：
- 自动连接复用
- 连接数控制
- 队列管理
- 自动重连
- 无需额外引入连接管理库

### 5.3 Service 层直接使用 ORM

```typescript
// system/users/service.ts
import { db, tUser } from "../../store/database.js";
import { eq, and, like, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import type { CreateUserDto, UpdateUserDto, UserListParams } from "./types.js";

export class UserService {
  // 根据ID查询
  async findById(id: string) {
    const user = await db.query.tUser.findFirst({
      where: and(eq(tUser.sid, id), eq(tUser.deleted, 0)),
    });
    
    if (!user) {
      throw new NotFoundError("用户");
    }
    
    return user;
  }

  // 根据用户名查询
  async findByUsername(username: string) {
    return db.query.tUser.findFirst({
      where: and(eq(tUser.username, username), eq(tUser.deleted, 0)),
    });
  }

  // 分页查询
  async findMany(params: UserListParams) {
    const { page = 1, pageSize = 20, keyword, status } = params;
    
    const conditions = [eq(tUser.deleted, 0)];
    
    if (keyword) {
      conditions.push(
        or(like(tUser.username, `%${keyword}%`), like(tUser.name, `%${keyword}%`))
      );
    }
    
    if (status !== undefined) {
      conditions.push(eq(tUser.status, status));
    }
    
    const whereClause = and(...conditions);
    
    const [list, total] = await Promise.all([
      db.query.tUser.findMany({
        where: whereClause,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: [desc(tUser.createTime)],
      }),
      db.$count(tUser, whereClause),
    ]);
    
    return { list, total, page, pageSize };
  }

  // 创建用户
  async create(data: CreateUserDto) {
    // 检查用户名是否已存在
    const existing = await this.findByUsername(data.username);
    if (existing) {
      throw new ValidationError("用户名已存在");
    }
    
    const result = await db.insert(tUser).values({
      sid: generateUUID(),
      username: data.username,
      password: await hashPassword(data.password),
      name: data.name,
      status: 1,
    }).returning();
    
    return result[0];
  }

  // 更新用户
  async update(id: string, data: UpdateUserDto) {
    // 检查用户是否存在
    await this.findById(id);
    
    const updateData: Partial<typeof tUser.$inferInsert> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.status !== undefined) updateData.status = data.status;
    
    const result = await db.update(tUser)
      .set(updateData)
      .where(eq(tUser.sid, id))
      .returning();
    
    return result[0];
  }

  // 逻辑删除
  async delete(id: string) {
    await this.findById(id);
    
    await db.update(tUser)
      .set({ deleted: 1 })
      .where(eq(tUser.sid, id));
  }
}

// 导出单例
export const userService = new UserService();
    );
    return result.affectedRows > 0;
  }
}

// 导出单例
export const userService = new UserService();
```

### 5.4 关联查询

```typescript
// ✅ 使用 Drizzle 的 with 进行关联查询
async function getUserWithRoles(userId: string) {
  return db.query.tUser.findFirst({
    where: eq(tUser.sid, userId),
    with: {
      roles: {
        with: {
          role: true,  // 关联角色详情
        },
      },
    },
  });
}

// ✅ 手动关联查询（灵活控制）
async function getUserWithOrg(userId: string) {
  const user = await db.query.tUser.findFirst({
    where: eq(tUser.sid, userId),
  });
  
  if (!user) return null;
  
  const org = await db.query.tOrg.findFirst({
    where: eq(tOrg.sid, user.orgId),
  });
  
  return { ...user, org };
}
```

### 5.5 事务处理

```typescript
import { db } from "../../store/database.js";
import { tUser, tEmployee, rUserRole } from "../../store/schema.js";

// ✅ 使用 Drizzle 事务
async function createEmployeeWithUser(data: CreateEmployeeDto) {
  return await db.transaction(async (tx) => {
    // 1. 创建用户
    const userId = generateUUID();
    await tx.insert(tUser).values({
      sid: userId,
      username: data.username,
      password: await hashPassword(data.password),
      name: data.name,
    });
    
    // 2. 创建员工
    const employeeId = generateUUID();
    await tx.insert(tEmployee).values({
      sid: employeeId,
      userId,
      orgId: data.orgId,
      employeeNo: data.employeeNo,
      name: data.name,
    });
    
    // 3. 分配默认角色
    await tx.insert(rUserRole).values({
      userId,
      roleId: DEFAULT_ROLE_ID,
    });
    
    // 4. 返回创建的员工
    return tx.query.tEmployee.findFirst({
      where: eq(tEmployee.sid, employeeId),
    });
  });
}
```

---

## 6. API 设计规范

### 6.1 RESTful API 规范

#### URL 设计

```typescript
// ✅ 使用资源名词复数形式
GET    /api/users              // 获取用户列表
GET    /api/users/:id          // 获取单个用户
POST   /api/users              // 创建用户
PUT    /api/users/:id          // 全量更新用户
PATCH  /api/users/:id          // 部分更新用户
DELETE /api/users/:id          // 删除用户

// ✅ 嵌套资源
GET    /api/departments/:id/employees     // 获取组织下的员工
GET    /api/users/:id/roles        // 获取用户的角色
POST   /api/users/:id/roles        // 为用户分配角色
DELETE /api/users/:id/roles/:rid   // 移除用户角色

// ✅ 动作型接口使用动词
POST   /api/auth/login           // 登录
POST   /api/auth/logout          // 登出
POST   /api/auth/refresh         // 刷新 Token
POST   /api/users/:id/reset-password  // 重置密码
```

#### 请求/响应格式

```typescript
// ✅ 标准响应格式
interface ApiResponse<T> {
  code: string;           // 业务状态码
  message: string;        // 提示信息
  data: T;               // 响应数据
  timestamp: number;     // 时间戳
}

// ✅ 分页响应格式
interface PaginatedResponse<T> {
  code: string;
  message: string;
  data: {
    list: T[];           // 数据列表
    total: number;       // 总记录数
    page: number;        // 当前页
    pageSize: number;    // 每页大小
    totalPages: number;  // 总页数
  };
  timestamp: number;
}

// ✅ 列表查询参数
interface ListQueryParams {
  page?: number;         // 页码，默认 1
  pageSize?: number;     // 每页大小，默认 20
  keyword?: string;      // 搜索关键词
  status?: number;       // 状态筛选
  sortField?: string;    // 排序字段
  sortOrder?: "asc" | "desc";  // 排序方向
}
```

### 6.2 路由集中管理

所有业务路由统一在 `src/gateway/routes/` 中定义和管理。

#### 路由注册入口

```typescript
// gateway/routes/index.ts
import type { FastifyInstance } from "fastify";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import roleRoutes from "./role.js";
import orgRoutes from "./org.js";
import employeeRoutes from "./employee.js";
import agentRoutes from "./agents.js";

export async function registerRoutes(fastify: FastifyInstance) {
  // 认证路由（无需认证）
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  
  // 业务路由（需要认证）
  await fastify.register(async (app) => {
    app.addHook("preHandler", app.authenticate);
    
    await app.register(userRoutes, { prefix: "/api/users" });
    await app.register(roleRoutes, { prefix: "/api/roles" });
    await app.register(orgRoutes, { prefix: "/api/departments" });
    await app.register(employeeRoutes, { prefix: "/api/employees" });
    await app.register(agentRoutes, { prefix: "/api/agents" });
  });
}
```

#### 业务路由示例

路由层直接调用 Service，无需 Controller：

```typescript
// gateway/routes/users.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { userService } from "../../system/users/service.js";
import { paginationSchema, createUserSchema, updateUserSchema } from "../../system/users/schema.js";

export default async function userRoutes(fastify: FastifyInstance) {
  // 获取用户列表
  fastify.get(
    "/",
    {
      schema: {
        querystring: paginationSchema,
        tags: ["用户管理"],
        summary: "获取用户列表",
      },
    },
    async (request: FastifyRequest<{ Querystring: z.infer<typeof paginationSchema> }>, reply: FastifyReply) => {
      const result = await userService.findMany(request.query);
      return reply.send({
        code: "SUCCESS",
        message: "获取成功",
        data: result,
        timestamp: Date.now(),
      });
    }
  );

  // 获取单个用户
  fastify.get(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        tags: ["用户管理"],
        summary: "获取用户详情",
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const result = await userService.findById(request.params.id);
      return reply.send({
        code: "SUCCESS",
        message: "获取成功",
        data: result,
        timestamp: Date.now(),
      });
    }
  );

  // 创建用户
  fastify.post(
    "/",
    {
      schema: {
        body: createUserSchema,
        tags: ["用户管理"],
        summary: "创建用户",
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof createUserSchema> }>, reply: FastifyReply) => {
      const result = await userService.create(request.body);
      return reply.status(201).send({
        code: "SUCCESS",
        message: "创建成功",
        data: result,
        timestamp: Date.now(),
      });
    }
  );

  // 更新用户
  fastify.patch(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: updateUserSchema,
        tags: ["用户管理"],
        summary: "更新用户",
      },
    },
    async (request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof updateUserSchema> }>, reply: FastifyReply) => {
      const result = await userService.update(request.params.id, request.body);
      return reply.send({
        code: "SUCCESS",
        message: "更新成功",
        data: result,
        timestamp: Date.now(),
      });
    }
  );

  // 删除用户
  fastify.delete(
    "/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        tags: ["用户管理"],
        summary: "删除用户",
      },
    },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      await userService.delete(request.params.id);
      return reply.send({
        code: "SUCCESS",
        message: "删除成功",
        timestamp: Date.now(),
      });
    }
  );

  // 检查唯一字段是否存在
  fastify.get(
    "/:field-exists",
    {
      schema: {
        querystring: z.object({
          value: z.string(),
          excludeId: z.string().uuid().optional(),  // 排除当前记录ID（编辑时使用）
        }),
        tags: ["用户管理"],
        summary: "检查字段值是否已存在",
      },
    },
    async (request: FastifyRequest<{ Querystring: { value: string; excludeId?: string } }>, reply: FastifyReply) => {
      const exists = await userService.isFieldExists(request.params.field, request.query.value, request.query.excludeId);
      return reply.send({
        code: "SUCCESS",
        message: "检查完成",
        data: exists,
        timestamp: Date.now(),
      });
    }
  );
}
```

### 6.3 存在性检查接口规范

用于检查唯一字段（如 slug、code、username 等）是否已存在。

#### URL 命名规范

```typescript
// ✅ 统一使用 {field}-exists 格式
GET /api/users/username-exists?value=zhangsan&excludeId=xxx
GET /api/skills/slug-exists?value=my-skill&excludeSid=xxx
GET /api/departments/code-exists?value=DEPT001&sid=xxx
GET /api/codes/value-exists?value=status&parentId=xxx&excludeId=xxx
```

#### 参数命名规范

| 参数名 | 说明 | 使用场景 |
|--------|------|----------|
| `value` | **必填**，要检查的值 | 所有存在性检查接口 |
| `excludeId` | **可选**，排除的记录ID | 通用主键为 `id` 的表 |
| `excludeSid` | **可选**，排除的记录SID | 主键为 `sid` 的表（如 skills） |
| `parentId` | **可选**，父级ID | 树形结构或层级数据（如 codes） |

#### 统一参数命名建议

**推荐方案**：统一使用 `excludeId` 作为排除参数名，无论主键是 `id` 还是 `sid`。

```typescript
// ✅ 推荐：统一使用 excludeId
GET /api/skills/slug-exists?slug=my-skill&excludeId=xxx
GET /api/departments/code-exists?code=DEPT001&excludeId=xxx

// ❌ 避免：不同模块使用不同参数名
GET /api/skills/slug-exists?slug=my-skill&excludeSid=xxx
GET /api/departments/code-exists?code=DEPT001&sid=xxx
```

#### 响应格式

```typescript
// ✅ 统一响应格式
{
  code: "SUCCESS",
  message: "检查完成",
  data: boolean,  // true = 已存在, false = 不存在
  timestamp: number
}
```

#### 实现示例

```typescript
// system/skills/service.ts
export async function isSlugExists(slug: string, excludeId?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_skills WHERE slug = ? AND deleted = 0";
  const params: any[] = [slug];

  if (excludeId) {
    sql += " AND sid != ?";  // 注意：这里用 sid 是因为表主键是 sid
    params.push(excludeId);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

// gateway/routes/skills.ts
fastify.get<{ Querystring: { slug: string; excludeId?: string } }>(
  "/slug-exists",
  async (request, reply) => {
    const { slug, excludeId } = request.query;
    const exists = await isSlugExists(slug, excludeId);
    return successResponse(reply, exists, "检查完成");
  }
);
```

#### 认证路由示例

```typescript
// gateway/routes/auth.ts
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AuthService } from "../auth/service.js";
import { loginSchema } from "../auth/schema.js";

const authService = new AuthService();

export default async function authRoutes(fastify: FastifyInstance) {
  // 登录
  fastify.post(
    "/login",
    {
      schema: {
        body: loginSchema,
        tags: ["认证"],
        summary: "用户登录",
      },
    },
    async (request: FastifyRequest<{ Body: z.infer<typeof loginSchema> }>, reply: FastifyReply) => {
      const result = await authService.login(request.body);
      
      // 设置 RefreshToken Cookie
      reply.setCookie("refreshToken", result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      });
      
      return reply.send({
        code: "SUCCESS",
        message: "登录成功",
        data: {
          accessToken: result.accessToken,
          expires: result.expires,
          user: result.user,
        },
        timestamp: Date.now(),
      });
    }
  );

  // 刷新 Token
  fastify.post(
    "/refresh",
    {
      schema: {
        tags: ["认证"],
        summary: "刷新访问令牌",
      },
    },
    async (request, reply) => {
      const refreshToken = request.cookies.refreshToken;
      if (!refreshToken) {
        return reply.status(401).send({
          code: "UNAUTHORIZED",
          message: "未提供刷新令牌",
        });
      }
      
      const result = await authService.refreshToken(refreshToken);
      return reply.send({
        code: "SUCCESS",
        message: "刷新成功",
        data: result,
        timestamp: Date.now(),
      });
    }
  );

  // 登出（需要认证）
  fastify.post(
    "/logout",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["认证"],
        summary: "用户登出",
      },
    },
    async (request, reply) => {
      await authService.logout(request.users.id);
      reply.clearCookie("refreshToken");
      return reply.send({
        code: "SUCCESS",
        message: "登出成功",
        timestamp: Date.now(),
      });
    }
  );

  // 获取当前用户信息
  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ["认证"],
        summary: "获取当前用户信息",
      },
    },
    async (request, reply) => {
      const user = await authService.getUserInfo(request.users.id);
      return reply.send({
        code: "SUCCESS",
        message: "获取成功",
        data: user,
        timestamp: Date.now(),
      });
    }
  );
}
```

### 6.3 Zod 验证 Schema

```typescript
// modules/auth/schema.ts
import { z } from "zod";

// 登录请求验证
export const loginSchema = z.object({
  username: z.string().min(3).max(50).describe("用户名"),
  password: z.string().min(6).max(100).describe("密码"),
});

// 创建用户请求验证
export const createUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(200),
  employeeNo: z.string().optional(),
  orgId: z.string().uuid(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
});

// 更新用户请求验证
export const updateUserSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  avatar: z.string().url().optional(),
  status: z.enum(["0", "1"]).optional(),
  email: z.string().email().optional(),
  phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
});

// 分页查询验证
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
  keyword: z.string().optional(),
  status: z.coerce.number().optional(),
});

// 组织创建验证
export const createOrgSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(100).regex(/^[A-Z0-9-]+$/),
  type: z.enum(["company", "branch", "departments", "group"]),
  parentId: z.string().uuid().optional(),
  sort: z.number().default(0),
  leaderId: z.string().uuid().optional(),
});

// Agent 创建验证
export const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  agentNo: z.string().regex(/^AGT_\d+$/),
  orgId: z.string().uuid(),
  skillId: z.string().uuid().optional(),
  serviceMode: z.enum(["exclusive", "shared", "public"]).default("exclusive"),
  bindUserId: z.string().uuid().optional(),
  modelConfig: z.record(z.unknown()).optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
  welcomeMessage: z.string().optional(),
});
```

---

## 7. 错误处理规范

### 7.1 错误码定义

```typescript
// shared/errors.ts

export const ErrorCodes = {
  // 系统级错误 (1xxxxx)
  INTERNAL_ERROR: { code: "100001", message: "服务器内部错误", status: 500 },
  SERVICE_UNAVAILABLE: { code: "100002", message: "服务暂不可用", status: 503 },
  TIMEOUT_ERROR: { code: "100003", message: "请求超时", status: 504 },
  
  // 认证授权错误 (2xxxxx)
  UNAUTHORIZED: { code: "200001", message: "未授权访问", status: 401 },
  TOKEN_EXPIRED: { code: "200002", message: "令牌已过期", status: 401 },
  TOKEN_INVALID: { code: "200003", message: "令牌无效", status: 401 },
  FORBIDDEN: { code: "200004", message: "权限不足", status: 403 },
  LOGIN_FAILED: { code: "200005", message: "用户名或密码错误", status: 401 },
  ACCOUNT_DISABLED: { code: "200006", message: "账号已停用", status: 401 },
  
  // 参数验证错误 (3xxxxx)
  VALIDATION_ERROR: { code: "300001", message: "参数验证失败", status: 400 },
  MISSING_PARAM: { code: "300002", message: "缺少必要参数", status: 400 },
  INVALID_FORMAT: { code: "300003", message: "参数格式错误", status: 400 },
  
  // 资源错误 (4xxxxx)
  NOT_FOUND: { code: "400001", message: "资源不存在", status: 404 },
  USER_NOT_FOUND: { code: "400002", message: "用户不存在", status: 404 },
  ORG_NOT_FOUND: { code: "400003", message: "组织不存在", status: 404 },
  AGENT_NOT_FOUND: { code: "400004", message: "Agent不存在", status: 404 },
  DUPLICATE_RESOURCE: { code: "400005", message: "资源已存在", status: 409 },
  DUPLICATE_USERNAME: { code: "400006", message: "用户名已存在", status: 409 },
  DUPLICATE_CODE: { code: "400007", message: "编码已存在", status: 409 },
  
  // 业务逻辑错误 (5xxxxx)
  BUSINESS_ERROR: { code: "500001", message: "业务处理失败", status: 422 },
  OPERATION_NOT_ALLOWED: { code: "500002", message: "操作不允许", status: 422 },
  RESOURCE_IN_USE: { code: "500003", message: "资源被使用中", status: 422 },
} as const;

export type ErrorCode = keyof typeof ErrorCodes;
```

### 7.2 错误处理中间件

```typescript
// gateway/middleware/error.ts
import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { AppError } from "../shared/errors.js";

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    (error: FastifyError | AppError | Error, request: FastifyRequest, reply: FastifyReply) => {
      request.log.error(error);
      
      // Zod 验证错误
      if (error instanceof ZodError) {
        return reply.status(400).send({
          code: "VALIDATION_ERROR",
          message: "参数验证失败",
          details: error.errors.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
          timestamp: Date.now(),
        });
      }
      
      // 自定义应用错误
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: Date.now(),
        });
      }
      
      // Fastify 错误
      if ("statusCode" in error) {
        return reply.status(error.statusCode || 500).send({
          code: "REQUEST_ERROR",
          message: error.message,
          timestamp: Date.now(),
        });
      }
      
      // 未知错误
      return reply.status(500).send({
        code: "INTERNAL_ERROR",
        message: process.env.NODE_ENV === "production" 
          ? "服务器内部错误" 
          : error.message,
        timestamp: Date.now(),
      });
    }
  );
}
```

---

## 8. 日志规范

### 8.1 日志级别使用

```typescript
// ✅ 使用适当的日志级别
fastify.log.trace("详细的调试信息");   // 最详细的跟踪信息
fastify.log.debug("调试信息");         // 开发调试使用
fastify.log.info("一般信息");          // 正常业务流程
fastify.log.warn("警告信息");          // 需要注意但非错误
fastify.log.error("错误信息");         // 错误事件
fastify.log.fatal("致命错误");         // 系统无法继续运行
```

### 8.2 日志内容规范

```typescript
// ✅ 记录关键业务操作
fastify.log.info(`用户登录成功: userId=${userId}, username=${username}`);

// ✅ 记录错误上下文
fastify.log.error({
  err: error,
  userId: request.user?.id,
  requestId: request.id,
  path: request.url,
}, "处理请求时发生错误");

// ✅ 使用结构化日志
request.log.info({
  operation: "CREATE_USER",
  userId: newUser.id,
  username: newUser.username,
  operator: request.users.id,
}, "创建用户成功");
```

---

## 9. 测试规范

### 9.1 测试文件结构

```
src/system/users/
├── service.ts
├── service.test.ts       # 服务层测试
├── routes.ts
├── routes.test.ts        # 路由层测试（集成测试）
└── __mocks__/            # Mock 数据
    └── database.ts
```

### 9.2 单元测试示例

```typescript
// src/system/users/service.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserService } from "./service.js";
import { userRepository } from "./repository.js";
import { ValidationError, NotFoundError } from "../../shared/errors.js";

// Mock 依赖
vi.mock("./repository.js", () => ({
  userRepository: {
    findById: vi.fn(),
    findByUsername: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

describe("UserService", () => {
  let service: UserService;
  
  beforeEach(() => {
    service = new UserService();
    vi.clearAllMocks();
  });
  
  describe("create", () => {
    it("应该成功创建用户", async () => {
      const mockUser = {
        sid: "user-1",
        username: "zhangsan",
        name: "张三",
        status: 1,
      };
      
      vi.mocked(userRepository.findByUsername).mockResolvedValue(null);
      vi.mocked(userRepository.create).mockResolvedValue(mockUser as any);
      
      const result = await service.create({
        username: "zhangsan",
        password: "password123",
        name: "张三",
        orgId: "org-1",
      });
      
      expect(result).toEqual(mockUser);
      expect(userRepository.findByUsername).toHaveBeenCalledWith("zhangsan");
    });
    
    it("用户名已存在时应抛出错误", async () => {
      vi.mocked(userRepository.findByUsername).mockResolvedValue({
        sid: "existing-user",
      } as any);
      
      await expect(
        service.create({
          username: "zhangsan",
          password: "password123",
          name: "张三",
          orgId: "org-1",
        })
      ).rejects.toThrow(ValidationError);
    });
  });
  
  describe("getById", () => {
    it("应该返回用户信息", async () => {
      const mockUser = { sid: "user-1", name: "张三" };
      vi.mocked(userRepository.findById).mockResolvedValue(mockUser as any);
      
      const result = await service.getById("user-1");
      
      expect(result).toEqual(mockUser);
    });
    
    it("用户不存在时应抛出错误", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);
      
      await expect(service.getById("non-existent")).rejects.toThrow(NotFoundError);
    });
  });
});
```

---

## 10. 代码审查清单

### 10.1 提交前自检清单

- [ ] 代码通过 TypeScript 编译（`tsc --noEmit`）
- [ ] 代码通过 ESLint 检查（`oxlint`）
- [ ] 代码通过格式化检查（`oxfmt --check`）
- [ ] 所有测试通过（`vitest run`）
- [ ] 新增功能包含对应测试
- [ ] 敏感信息未提交（密码、密钥等）
- [ ] 无调试代码（console.log 等）

### 10.2 代码审查要点

#### 架构层面
- [ ] 是否符合模块划分规范
- [ ] 是否遵循分层架构（Controller -> Service -> Repository）
- [ ] 是否正确处理错误和异常
- [ ] 是否有适当的日志记录

#### 代码质量
- [ ] 命名是否清晰、符合规范
- [ ] 函数是否单一职责
- [ ] 是否有重复代码（DRY原则）
- [ ] 类型定义是否完整

#### 安全性
- [ ] SQL 是否使用参数化查询
- [ ] 用户输入是否经过验证
- [ ] 敏感操作是否有权限检查
- [ ] 密码是否加密存储

#### 性能
- [ ] 数据库查询是否有索引
- [ ] 是否避免 N+1 查询问题
- [ ] 大数据量是否使用分页

---

## 附录

### A. 常用工具命令

```bash
# 类型检查
npx tsc --noEmit

# 代码检查
npx oxlint --type-aware

# 代码格式化
npx oxfmt --write

# 运行测试
npx vitest run

# 开发模式
npm run gateway:dev
```

### B. 相关文档

- [数据库设计规范](./system_design/DATABASE_SPECIFICATION.md)
- [系统设计规范](./system_design/DESIGN_SPECIFICATION.md)
- [总体架构设计](./system_design/overall.md)

### C. 设计文档与代码目录映射

| 设计文档 | 代码目录 | 说明 |
|----------|----------|------|
| `system_design/gateway/auth.md` | `src/gateway/auth/` | 认证授权模块 |
| `system_design/gateway/routing.md` | `src/gateway/routing/` | 路由模块 |
| `system_design/system/users.md` | `src/system/users/` | 用户管理 |
| `system_design/system/roles.md` | `src/system/roles/` | 角色管理 |
| `system_design/system/menu.md` | `src/system/menu/` | 菜单管理 |
| `system_design/system/module.md` | `src/system/module/` | 模块管理 |
| `system_design/system/code.md` | `src/system/codes/` | 代码管理 |
| `system_design/system/cli.md` | `src/system/cli/` | CLI基础设施 |
| `system_design/organization/org.md` | `src/organization/departments/` | 组织管理 |
| `system_design/organization/employee.md` | `src/organization/employees/` | 员工管理 |
| `system_design/organization/position.md` | `src/organization/positions/` | 岗位管理 |
| `system_design/organization/skills.md` | `src/organization/skills/` | 技能定义 |
| `system_design/agents/agents.md` | `src/agents/agent/` | Agent定义管理 |
| `system_design/agents/runtime.md` | `src/agents/runtime/` | Agent运行时 |
| `system_design/agents/heartbeat.md` | `src/agents/heartbeat/` | 心跳机制 |
| `system_design/agents/monitor.md` | `src/agents/monitor/` | 执行监控 |
| `system_design/agents/knowledge.md` | `src/agents/knowledge/` | 执行知识 |
| `system_design/cron/scheduler.md` | `src/cron/scheduler/` | 任务调度器 |
| `system_design/core/context-manager.md` | `src/core/context/` | 上下文管理 |
| `system_design/core/llm-adapter.md` | `src/core/adapter/` | 大模型对接 |
