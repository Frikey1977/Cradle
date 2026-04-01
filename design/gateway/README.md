# Gateway 网关层

## 模块概述

Gateway 网关层是系统的统一接入层，负责处理所有外部请求，包括路由分发、认证授权、权限控制等功能。Web 端（playground）的所有请求都通过 Gateway 接入。

## 核心职责

| 职责 | 说明 |
|------|------|
| **路由分发** | 将请求路由到对应的后端服务 |
| **认证授权** | 用户登录认证和权限验证 |
| **会话管理** | Token 管理和会话维护 |
| **协议转换** | HTTP/WebSocket 协议适配 |

## 子模块列表

| 子模块 | 说明 | 文档 |
|--------|------|------|
| 认证授权 | 登录认证、Token管理、权限控制 | [auth.md](./auth.md) |
| 架构设计 | 网关层整体架构设计 | [architecture.md](./architecture.md) |
| 路由设计 | API路由规范 | [routing.md](./routing.md) |
| 协议设计 | HTTP/WebSocket协议规范 | [protocol.md](./protocol.md) |

## Web 端集成

Web 端（`web/playground`）通过以下方式与 Gateway 交互：

```
┌─────────────────┐      HTTP/WebSocket       ┌─────────────────┐
│   Web 前端      │  ───────────────────────→  │   Gateway       │
│  (playground)   │                           │  (认证/路由)     │
│                 │  ←───────────────────────  │                 │
└─────────────────┘                           └────────┬────────┘
                                                       │
                                                       ↓
                                              ┌─────────────────┐
                                              │   后端服务       │
                                              │ (Agent/组织/记忆) │
                                              └─────────────────┘
```

### 前端 API 目录

```
web/playground/src/api/
├── core/
│   ├── auth.ts      # 登录/登出/刷新Token
│   ├── user.ts      # 用户信息
│   └── menu.ts      # 菜单权限
└── request.ts       # 请求封装
```

## 认证流程

```
用户登录
    ↓
POST /auth/login
    ↓
验证 t_users + t_employees
    ↓
生成 AccessToken + RefreshToken
    ↓
返回 Token
    ↓
后续请求携带 AccessToken
    ↓
Gateway 验证 Token
    ↓
转发到后端服务
```

## 关联文档

- [认证授权设计](./auth.md)
- [架构设计](./architecture.md)
- [路由设计](./routing.md)
- [协议设计](./protocol.md)
- [系统设计总索引](../README.md)
- [Agent 运行时层](../agents/README.md)
- [组织管理](../organization/README.md)
- [记忆模块](../memory/README.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
