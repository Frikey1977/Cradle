# Gateway 架构设计

## 1. 功能定位

Gateway 是系统的统一接入层，负责处理所有外部请求的路由分发、协议转换、认证授权和会话管理。

## 2. 核心职责

| 职责 | 说明 |
|------|------|
| **统一接入** | 所有客户端（Web、移动端、第三方）的统一入口 |
| **协议适配** | HTTP REST API + WebSocket 双协议支持 |
| **认证授权** | JWT Token 验证、权限检查 |
| **路由分发** | 请求路由到对应的后端服务 |
| **会话管理** | WebSocket 连接管理和状态同步 |

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      客户端层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Web 前端   │  │   移动端    │  │  第三方应用  │     │
│  │  (Vue3)     │  │  (App)      │  │  (API)      │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼────────────┘
          │                │                │
          │                │                │
          │         ┌──────▼──────┐         │
          │         │  IM 通道    │         │
          │         │ 钉钉/微信等  │         │
          │         └──────┬──────┘         │
          │                │                │
          └────────────────┴────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│              Gateway Master (统一入口)                   │
│                    Port: 3000                            │
├─────────────────────────────────────────────────────────┤
│  统一 HTTP 服务器                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  REST API                                       │   │
│  │  ├── GET  /health      健康检查                  │   │
│  │  ├── GET  /stats       统计信息                  │   │
│  │  └── POST /webhook/*   Webhook 回调              │   │
│  ├─────────────────────────────────────────────────┤   │
│  │  WebSocket (Path: /ws)                          │   │
│  │  ├── 连接管理        WebUI 实时通信              │   │
│  │  ├── 消息路由        双向消息传递                │   │
│  │  └── 心跳检测        连接保活                    │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Master 核心功能                                          │
│  ├── 消息队列管理        入站消息缓冲与分发              │
│  ├── Worker 进程管理     多进程并行处理                  │
│  ├── 通道注册管理        动态通道配置                    │
│  └── 消息路由分发        基于 Contact/Agent 路由        │
├─────────────────────────────────────────────────────────┤
│  Worker 进程池                                            │
│  ├── Worker 1            处理消息请求                    │
│  ├── Worker 2            处理消息请求                    │
│  ├── Worker 3            处理消息请求                    │
│  └── Worker 4            处理消息请求                    │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼────────┐ ┌─────▼─────┐ ┌───────▼────────┐
│   系统管理模块    │ │  组织管理  │ │   Agent 模块    │
│   (system)       │ │  (org)    │ │   (agent)      │
└──────────────────┘ └───────────┘ └────────────────┘
```

### 3.2 统一入口设计原则

**核心设计：单一端口，统一协议**

```
Gateway Master (Port 3000)
│
├── HTTP Server (Node.js http.createServer)
│   │
│   ├── HTTP Request Handler
│   │   ├── GET  /health     → 返回服务状态
│   │   ├── GET  /stats      → 返回运行统计
│   │   └── POST /webhook/:channel → 处理 IM 回调
│   │
│   └── WebSocket Upgrade Handler (Path: /ws)
│       ├── 协议升级 (HTTP → WebSocket)
│       ├── 连接认证
│       ├── 消息收发
│       └── 心跳保活
│
└── 共享资源
    ├── 同一端口 (3000)
    ├── 同一进程
    └── 统一日志
```

**设计优势**：
- **简化部署**：只需开放一个端口，配置一个 SSL 证书
- **统一认证**：所有请求走相同的认证中间件
- **资源复用**：HTTP 和 WebSocket 共享服务器实例
- **标准协议**：遵循 RFC 6455 WebSocket 升级规范
- **易于扩展**：新增通道类型不需要新增端口

### 3.3 模块职责

| 层级 | 模块 | 职责 | 所在进程 |
|------|------|------|----------|
| 接入层 | HTTP Server | 统一 HTTP/WebSocket 入口，端口 3000 | Master |
| 协议层 | Channel Plugins | 协议解析、消息标准化、发送 | Master + Worker |
| 路由层 | Gateway Router | 识别 Contact/Agent，消息路由 | Master |
| 队列层 | Message Queue | 消息缓冲、负载均衡 | Master |
| 处理层 | Worker Pool | 多进程并行处理消息请求 | Worker |
| 业务层 | Agent Runtime | Agent 执行、LLM 调用 | Worker |

### 3.4 Channel 层详细设计

**Channel 是协议适配层，位于 Master 和 Worker 之间：**

```
┌─────────────────────────────────────────────────────────┐
│                    Channel 层架构                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  入站流程 (Master 进程)                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐             │
│  │ 接收    │───▶│ 解析    │───▶│ 标准化  │             │
│  │ 原始消息│    │ parse() │    │normalize│             │
│  └─────────┘    └─────────┘    └────┬────┘             │
│                                     │                   │
│                                     ▼                   │
│                          ┌─────────────────┐            │
│                          │ InboundMessage  │            │
│                          │    Context      │            │
│                          │   (统一格式)     │            │
│                          └────────┬────────┘            │
│                                   │                     │
└───────────────────────────────────┼─────────────────────┘
                                    │
                                    ▼ 入队
┌───────────────────────────────────┼─────────────────────┐
│                                   │                     │
│  出站流程 (Worker 进程)            │                     │
│                          ┌────────┴────────┐            │
│                          │ OutboundMessage │            │
│                          │    Context      │            │
│                          │   (统一格式)     │            │
│                          └────────┬────────┘            │
│                                   │                     │
│                                   ▼                     │
│                          ┌─────────────────┐            │
│                          │    格式化       │───▶ 发送   │
│                          │   format()      │    send()  │
│                          └─────────────────┘            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Channel 核心职责**：

| 方法 | 调用方 | 功能 |
|------|--------|------|
| `parse()` | Master | 解析平台特定格式（如钉钉加密消息） |
| `normalize()` | Master | 转为统一 `InboundMessageContext` |
| `format()` | Worker | 将统一格式转为平台特定格式 |
| `send()` | Worker | 调用平台 API 发送消息 |

**设计原则**：
1. **Channel 只负责协议适配**，不处理业务逻辑
2. **标准化消息是核心抽象**，Worker 无需关心来源通道
3. **同一 Channel 类在 Master 和 Worker 中复用**

### 3.4 端口分配

| 服务 | 端口 | 协议 | 用途 |
|------|------|------|------|
| Gateway Master | 3000 | HTTP + WebSocket | 统一入口（所有外部流量） |
| Backend API | 3001 | HTTP | 内部 REST API 服务 |
| Frontend Dev | 5666 | HTTP | Vue3 开发服务器 |

**流量走向**：
```
外部请求 → Gateway:3000 → 内部服务
├── WebSocket /ws → WebUI 实时通信
├── Webhook /webhook/* → IM 通道回调
└── REST API → 转发到 Backend:3001

内部调用 → Backend:3001
├── 系统管理 API
├── 组织管理 API
└── Agent 管理 API
```

## 4. 协议设计

### 4.1 HTTP 协议

**请求格式**:
```http
POST /api/auth/login HTTP/1.1
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "username": "zhangsan",
  "password": "password123"
}
```

**响应格式**:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": 200,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expires": 1700000000
  },
  "message": "success"
}
```

### 4.2 WebSocket 协议

**连接建立**:
```
Client                      Gateway
  │                           │
  │  GET /ws HTTP/1.1        │
  │  Upgrade: websocket      │
  │  Authorization: Bearer   │
  │─────────────────────────>│
  │                           │
  │  HTTP/1.1 101 Switching │
  │  Protocols               │
  │<─────────────────────────│
  │                           │
```

**消息帧格式**:
```typescript
// 请求帧
interface RequestFrame {
  id: string;        // 请求唯一标识
  method: string;    // 方法名，如 "agent.chat"
  params: unknown;   // 请求参数
}

// 响应帧
interface ResponseFrame {
  id: string;        // 对应请求ID
  result?: unknown;  // 成功结果
  error?: {          // 错误信息
    code: number;
    message: string;
  };
}

// 事件帧（服务端推送）
interface EventFrame {
  event: string;     // 事件名，如 "agent.message"
  payload: unknown;  // 事件数据
}
```

## 5. 认证设计

### 5.1 JWT Token

**AccessToken**:
- 有效期：2小时
- 存储：前端内存/LocalStorage
- 用途：API 访问凭证

**RefreshToken**:
- 有效期：7天
- 存储：HttpOnly Cookie
- 用途：刷新 AccessToken

### 5.2 认证流程

```
用户登录
    ↓
POST /api/auth/login
    ↓
验证用户名密码
    ↓
生成 AccessToken + RefreshToken
    ↓
Set-Cookie: refreshToken=xxx; HttpOnly
    ↓
返回 { accessToken, expires }
    ↓
后续请求 Header: Authorization: Bearer {accessToken}
```

## 6. 路由设计

### 6.1 API 路由规范

| 前缀 | 模块 | 说明 |
|------|------|------|
| `/api/auth/*` | 认证 | 登录、登出、刷新Token |
| `/api/system/*` | 系统管理 | 用户、角色、菜单、代码字典 |
| `/api/departments/*` | 组织管理 | 部门、员工、岗位 |
| `/api/agents/*` | Agent | Agent管理、对话、技能 |
| `/api/memory/*` | 记忆 | 记忆检索、Subject管理 |
| `/ws` | WebSocket | 实时通信端点 |

### 6.2 路由示例

```typescript
// 认证路由
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh

// 系统管理路由
GET    /api/system/users
POST   /api/system/users/:id/reset-password
GET    /api/system/roles
GET    /api/system/menus

// 组织管理路由
GET    /api/departments/departments
GET    /api/departments/employees
POST   /api/departments/employees

// Agent 路由
GET    /api/agents/list
POST   /api/agents/chat
GET    /api/agents/skills

// WebSocket
WS     /ws
```

## 7. 错误处理

### 7.1 错误码规范

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证/Token过期 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 7.2 错误响应格式

```json
{
  "code": 401,
  "message": "Token已过期",
  "data": null
}
```

## 8. 安全设计

### 8.1 安全措施

| 措施 | 说明 |
|------|------|
| HTTPS | 强制 HTTPS 传输 |
| CORS | 跨域白名单控制 |
| Rate Limit | 请求频率限制 |
| Input Validation | 输入参数校验 |
| SQL Injection | 参数化查询防止注入 |

### 8.2 密码安全

- 使用 bcrypt 算法加密
- 密码强度要求：8位以上，包含大小写字母和数字

## 9. 关联文档

- [认证授权设计](./auth.md)
- [路由设计](./routing.md)
- [协议设计](./protocol.md)
- [系统管理](../system/README.md)
- [组织管理](../organization/README.md)
