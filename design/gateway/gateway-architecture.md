# Gateway 架构设计

## 单端口多路复用架构

### 为什么采用单端口？

| 方案 | 优点 | 缺点 |
|-----|------|------|
| **单端口多路复用** (当前采用) | 简化部署、防火墙配置、负载均衡；URL 路径清晰表达路由 | 需要内部路由层 |
| 多端口 (每个 Channel 独立端口) | 端口级别隔离 | 部署复杂、防火墙配置繁琐、端口管理困难 |

### URL 路由设计

```
Gateway 监听单一端口 (默认 3000)

WebSocket 连接:
  ws://localhost:3000/ws/cradle     → Cradle Channel (内部客户端)
  ws://localhost:3000/ws/admin      → Admin Channel (管理后台)

Webhook 接收 (来自 IM 平台):
  POST http://localhost:3000/webhook/wechat    → WeChat Channel
  POST http://localhost:3000/webhook/dingtalk  → DingTalk Channel
  POST http://localhost:3000/webhook/feishu    → Feishu Channel
  POST http://localhost:3000/webhook/telegram  → Telegram Channel
  POST http://localhost:3000/webhook/slack     → Slack Channel

HTTP API:
  GET  http://localhost:3000/health            → 健康检查
  POST http://localhost:3000/v1/chat/completions → OpenAI 兼容 API
```

## 架构层级

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Cradle Web  │  │ Cradle Mobile│  │  IM Platforms       │  │
│  │ (ws/cradle) │  │ (ws/cradle) │  │  (webhook/:channel) │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          └────────────────┴────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   Gateway Runtime                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              HTTP Server (Port 3000)                │    │
│  │  ┌───────────────────────────────────────────────┐  │    │
│  │  │            URL Router                         │  │    │
│  │  │  /ws/:channel → WebSocket Upgrade Handler     │  │    │
│  │  │  /webhook/:channel → Webhook Handler          │  │    │
│  │  │  /health → Health Check                       │  │    │
│  │  └───────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Channel Plugins                        │    │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │    │
│  │  │   Cradle    │ │   WeChat    │ │   DingTalk  │    │    │
│  │  │   Channel   │ │   Channel   │ │   Channel   │    │    │
│  │  │  (WebSocket)│ │  (Webhook)  │ │  (Webhook)  │    │    │
│  │  └─────────────┘ └─────────────┘ └─────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Message Queue                          │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Worker Pool                            │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │    │
│  │  │ Worker  │ │ Worker  │ │ Worker  │ │ Worker  │    │    │
│  │  │    1    │ │    2    │ │    3    │ │    4    │    │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  t_channels │  │  t_agents   │  │  t_messages         │  │
│  │  通道配置    │  │  Agent配置   │  │  消息历史            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Channel 插件接口

### 职责划分

| 层级 | 职责 | 示例 |
|-----|------|------|
| **Gateway** | URL 路由、连接管理、消息队列、Worker 调度 | 接收请求，根据 URL 路由到对应 Channel |
| **Channel Plugin** | 协议处理、握手认证、消息归一化 | 验证 token、JWT、消息格式转换 |
| **Worker** | Agent 路由、LLM 调用、业务逻辑 | 消息处理、Agent 响应生成 |

### Channel 插件接口定义

```typescript
export interface ChannelPlugin {
  /** 获取通道名称 */
  getName(): string;

  /** 获取通道类型 */
  getType(): string;

  /** 初始化插件 */
  initialize(config: ChannelConfig): Promise<void>;

  /** 处理 WebSocket 连接升级 */
  handleWebSocketUpgrade(
    request: IncomingMessage,
    socket: Socket,
    head: Buffer,
  ): void;

  /** 处理 Webhook 请求 */
  handleWebhook(request: IncomingMessage, response: ServerResponse): void;

  /** 发送消息到客户端 */
  sendMessage(context: OutboundMessageContext): Promise<void>;

  /** 关闭插件 */
  shutdown(): Promise<void>;
}
```

## 握手流程

### 阶段 1: WebSocket 连接建立

```
Client                              Gateway Master
  │                                       │
  │────── WebSocket Upgrade ─────────────>│
  │     GET /ws/cradle HTTP/1.1           │
  │     Upgrade: websocket                │
  │                                       │
  │<─────── 101 Switching Protocols ─────│
  │                                       │
  │<────── { type: "connected",           │
  │          payload: { clientId } }──────│
  │                                       │
```

### 阶段 2: 握手验证（Channel 插件自治）

```
Client                              Cradle Channel
  │                                       │
  │────── { type: "handshake",            │
  │         payload: {                    │
  │           name: "cradle",             │
  │           client: "cradle-web",       │
  │           token: "xxx"                │
  │         } } ─────────────────────────>│
  │                                       │
  │         [验证 name 匹配]               │
  │         [验证 client 存在且 enabled]   │
  │         [验证 token 匹配]              │
  │                                       │
  │<────── { type: "handshake_success",   │
  │          payload: {                   │
  │            name: "cradle",            │
  │            client: "cradle-web",      │
  │            sessionId: "xxx",          │
  │            serverTime: 1234567890,    │
  │            requiresAuth: true         │
  │          } } ─────────────────────────│
```

### 阶段 3: JWT 认证（Channel 插件自治）

```
Client                              Cradle Channel
  │                                       │
  │────── { type: "auth",                 │
  │         payload: {                    │
  │           token: "JWT_TOKEN"          │
  │         } } ─────────────────────────>│
  │                                       │
  │         [验证 JWT 签名和有效期]         │
  │                                       │
  │<────── { type: "auth_success",        │
  │          payload: {                   │
  │            userId: "xxx",             │
  │            userName: "xxx"            │
  │          } } ─────────────────────────│
```

### 阶段 4: 业务消息

```
Client                              Cradle Channel
  │                                       │
  │────── { type: "message",              │
  │         payload: {                    │
  │           content: "你好",             │
  │           agentId: "agent-1"          │
  │         } } ─────────────────────────>│
  │                                       │
  │         [构建 InboundMessageContext]   │
  │         [提交到消息队列]                │
  │                                       │
  │<────── { type: "ack",                 │
  │          payload: { messageId } } ────│
  │                                       │
  │         [Worker 处理消息]              │
  │         [Agent 生成响应]               │
  │                                       │
  │<────── { type: "message",             │
  │          payload: {                   │
  │            content: "你好！我是 Agent", │
  │            sender: "Agent"            │
  │          } } ─────────────────────────│
```

## 数据库设计

### t_channels 表

```sql
CREATE TABLE t_channels (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,  -- 通道唯一标识
    type            VARCHAR(50) NOT NULL,          -- 通道类型: cradle, wechat, dingtalk, etc.
    enabled         BOOLEAN DEFAULT TRUE,          -- 是否启用
    config          JSONB DEFAULT '{}',            -- 服务端配置
    client_config   JSONB DEFAULT '{}',            -- 客户端配置
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 示例数据

```sql
-- Cradle Channel (内部客户端)
INSERT INTO t_channels (name, type, enabled, config, client_config) VALUES (
    'cradle',
    'cradle',
    TRUE,
    '{
        "heartbeatInterval": 30000,
        "connectionTimeout": 60000
    }',
    '{
        "cradle-web": {
            "token": "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab",
            "enabled": true
        },
        "cradle-mobile": {
            "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
            "enabled": true
        }
    }'
);

-- WeChat Channel
INSERT INTO t_channels (name, type, enabled, config, client_config) VALUES (
    'wechat',
    'wechat',
    TRUE,
    '{
        "webhookPath": "/webhook/wechat",
        "verifyToken": "xxx"
    }',
    '{}'
);
```

## 消息流

```
┌─────────┐     ┌──────────┐     ┌─────────────┐     ┌─────────┐     ┌──────┐
│ Client  │────>│  Gateway │────>│   Channel   │────>│ Worker  │────>│ LLM  │
└─────────┘     └──────────┘     └─────────────┘     └─────────┘     └──────┘
                    │                  │                  │
                    │                  │                  │
                    │ 1. URL 路由      │ 2. 握手/认证      │ 3. 入队
                    │    /ws/cradle    │    归一化消息     │    分发
                    │                  │                  │
                    │                  │                  │
                    │ 6. 发送响应      │ 5. 返回结果      │ 4. 处理
                    │                  │    归一化响应     │    Agent
                    │                  │                  │
```

## 关键设计决策

### 1. 为什么 Channel 插件自治处理握手？

- **不同 Channel 有不同的握手协议**
  - Cradle Channel: name + client + token
  - WeChat: signature 验证
  - DingTalk: timestamp + sign 验证

- **Gateway 只负责 URL 路由，不处理具体协议**
  - 简化 Gateway 逻辑
  - 易于添加新 Channel 类型
  - 插件可独立升级

### 2. 为什么使用单端口？

- **简化部署**
  - 只需开放一个端口
  - 防火墙配置简单
  - 负载均衡配置简单

- **URL 路径语义清晰**
  - `/ws/cradle` → Cradle Channel
  - `/webhook/wechat` → WeChat Channel

### 3. 为什么分离 Channel 和 Agent？

- **关注点分离**
  - Channel: 协议适配、连接管理
  - Agent: 业务逻辑、LLM 交互

- **可独立扩展**
  - 新增 Channel 类型不影响 Agent
  - 新增 Agent 不影响 Channel

## 实现状态

| 组件 | 状态 | 说明 |
|-----|------|------|
| Gateway Master | ✅ 已重构 | 单端口多路复用、URL 路由 |
| Channel Plugin 接口 | ✅ 已完成 | BaseChannelPlugin 基类 |
| Cradle Channel | ✅ 已完成 | WebSocket 握手、认证、消息处理 |
| Worker 进程 | 🔄 基础实现 | 需要完善 Agent 集成 |
| 数据库集成 | ⏳ 待实现 | 从 t_channels 加载配置 |
| Webhook Channel | ⏳ 待实现 | WeChat、DingTalk 等 |
