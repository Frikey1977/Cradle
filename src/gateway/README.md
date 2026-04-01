# Cradle Gateway

Cradle Gateway 是一个多通道消息网关，负责接收来自不同渠道的消息，路由到对应的 Agent 处理，并返回响应。

## 架构分层

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Layer (外部客户端)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Cradle   │  │ 微信     │  │ 钉钉     │  │ 飞书     │  ...   │
│  │ Chat UI  │  │          │  │          │  │          │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Gateway Master (Runtime)                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │ HTTP Server │  │ Message Queue│  │   Worker Manager    │     │
│  │  (Port 3000)│  │             │  │   (Process Pool)    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘     │
└─────────┼────────────────┼────────────────────┼────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Gateway Worker(s) (Runtime)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐     │
│  │   Router    │  │    Agent    │  │   Channel Manager   │     │
│  │  (Decision) │  │  (Process)  │  │   (Send Response)   │     │
│  └─────────────┘  └─────────────┘  └─────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### 架构概念澄清

| 层级 | 组件 | 说明 |
|------|------|------|
| **Client Layer** | 外部客户端 | 包括 Cradle Chat UI、微信、钉钉、飞书等 |
| **Gateway Runtime** | Gateway Master | 运行时消息网关，负责连接管理、消息路由 |
| **Gateway Runtime** | Channel Plugin | 运行时通道插件，负责消息归一化、协议适配 |
| **Gateway Runtime** | Gateway Worker | 运行时工作进程，负责调用 Agent、LLM |
| **Data Layer** | t_channel (DB) | 通道配置数据表（与 Runtime Channel 是不同概念）|

**重要区分：**
- **t_channel (数据库表)**：存储通道配置信息（通道ID、名称、启用状态等）
- **Channel Plugin (运行时)**：Gateway 内部的运行时对象，负责消息处理

**Channel Plugin 职责：**
- 封装不同客户端的协议差异（握手、认证、消息格式）
- 提供统一的消息归一化接口
- 对外暴露标准化的 `InboundMessageContext` 和 `OutboundMessageContext`
- 后续业务逻辑（路由、Agent处理）与具体客户端类型无关

## 连接握手流程

```
Client                    Gateway Master                 Channel Plugin
  │                             │                              │
  │  1. WebSocket 连接          │                              │
  │ ───────────────────────────►│                              │
  │                             │                              │
  │  2. 转发给 Channel          │                              │
  │                             │─────────────────────────────►│
  │                             │                              │
  │  3. 读取 t_channel 配置     │                              │
  │                             │                              │
  │  4. 验证客户端标识和 token  │                              │
  │                             │                              │
  │  5. 返回验证结果            │                              │
  │ ◄──────────────────────────────────────────────────────────│
  │                             │                              │
  │  6. JWT 身份验证            │                              │
  │ ───────────────────────────►│                              │
  │                             │                              │
  │  7. 返回 auth_success       │                              │
  │ ◄───────────────────────────│                              │
  │                             │                              │
  │  8. 业务消息交换 (chat)     │                              │
  │ ───────────────────────────►│─────────────────────────────►│
  │                             │                              │
```

### 阶段 1: 通道层验证（连接合法性）

**客户端发送:**
```json
{
  "type": "handshake",
  "payload": {
    "name": "cradle",
    "client": "cradle-web",
    "token": "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab"
  }
}
```

**字段说明:**
- `name`: 通道标识（对应 t_channels 表的 name 字段）
- `client`: 客户端类型名称（如 `cradle-web`, `cradle-mobile`）
- `token`: 该客户端类型的访问令牌（对应 t_channels.config.credentials 中的 token）

**握手流程:**
1. 客户端发送握手消息到 Gateway
2. Gateway 根据 `name` 路由到对应的 Channel 插件
3. Channel 插件调用 `verifyHandshake()` 方法验证
4. Channel 插件从内存中的配置验证客户端
5. 返回握手结果

**实现代码:**

*Gateway Master 路由逻辑 (`master.ts`):*
```typescript
case "handshake": {
  const { name, client, token } = message.payload || {};

  // 1. 参数校验
  if (!name || !client || !token) {
    client.socket.send(JSON.stringify({
      type: "handshake_error",
      payload: { error: "name, client and token are required" },
    }));
    break;
  }

  // 2. 路由到 Channel 插件
  const channelPlugin = this.getChannelPlugin(name);
  if (!channelPlugin) {
    client.socket.send(JSON.stringify({
      type: "handshake_error",
      payload: { error: `Channel '${name}' not found` },
    }));
    break;
  }

  // 3. 调用 Channel 插件验证
  const handshakeResult = channelPlugin.verifyHandshake({ name, client, token });

  if (!handshakeResult.success) {
    client.socket.send(JSON.stringify({
      type: "handshake_error",
      payload: { error: handshakeResult.error },
    }));
    break;
  }

  // 4. 保存客户端状态
  (client as any).channelName = name;
  (client as any).clientName = client;
  (client as any).handshakeCompleted = true;

  // 5. 返回成功响应
  client.socket.send(JSON.stringify({
    type: "handshake_success",
    payload: {
      name: handshakeResult.name,
      client: handshakeResult.client,
      sessionId: handshakeResult.sessionId,
      serverTime: handshakeResult.serverTime,
      requiresAuth: handshakeResult.requiresAuth,
    },
  }));
  break;
}
```

*CradleChannel 验证逻辑 (`cradle-channel.ts`):*
```typescript
export class CradleChannel extends BaseChannel {
  private static instance: CradleChannel | null = null;
  private clientConfigs: Map<string, ClientConfig> = new Map();

  // 单例模式获取实例
  static getInstance(options?: ChannelPluginOptions): CradleChannel {
    if (!CradleChannel.instance) {
      CradleChannel.instance = new CradleChannel(options);
    }
    return CradleChannel.instance;
  }

  // 启动时从配置加载客户端凭证
  private loadClientConfigs(): void {
    const config = this.config as Record<string, unknown>;
    const credentials = config.credentials as ClientConfig[] | undefined;

    if (credentials && Array.isArray(credentials)) {
      for (const clientConfig of credentials) {
        if (clientConfig.name && clientConfig.enabled) {
          this.clientConfigs.set(clientConfig.name, clientConfig);
        }
      }
    }
  }

  // 验证握手请求
  verifyHandshake(request: HandshakeRequest): HandshakeResponse {
    const { name, client, token } = request;

    // 验证通道名称
    if (name !== this.channelName) {
      return { success: false, error: `Channel '${name}' not found` };
    }

    // 查找客户端配置
    const clientConfig = this.clientConfigs.get(client);
    if (!clientConfig) {
      return { success: false, error: `Client '${client}' not allowed` };
    }

    // 验证客户端是否启用
    if (!clientConfig.enabled) {
      return { success: false, error: `Client '${client}' is disabled` };
    }

    // 验证 Token
    if (token !== clientConfig.token) {
      return { success: false, error: "Invalid token" };
    }

    // 握手成功
    return {
      success: true,
      name: name,
      client: client,
      sessionId: this.generateSessionId(),
      serverTime: Date.now(),
      requiresAuth: true,
    };
  }
}
```

*前端握手发送 (`useWebSocket.ts`):*
```typescript
const sendHandshake = () => {
  const name = "cradle";            // 通道标识（对应 t_channels.name）
  const client = "cradle-web";      // 客户端类型名称
  const token = "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab";

  ws.value?.send(
    JSON.stringify({
      type: "handshake",
      payload: { name, client, token },
    }),
  );
};
```

**Channel 插件职责:**
- 启动时从数据库加载配置到内存（单例模式）
- 提供 `verifyHandshake()` 方法验证客户端连接
- 配置常驻内存，避免每次握手都查询数据库

**Channel 响应:**
```json
// 成功
{
  "type": "handshake_success",
  "payload": {
    "channelId": "internal-1",
    "sessionId": "session-uuid",
    "serverTime": "2025-02-26T10:00:00Z",
    "requiresAuth": true
  }
}

// 失败
{
  "type": "handshake_error",
  "payload": {
    "code": "INVALID_CHANNEL",
    "message": "Channel not found or disabled"
  }
}
```

### 阶段 2: JWT 身份验证（身份合法性）

**客户端发送:**
```json
{
  "type": "auth",
  "payload": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "userId": "user-uuid"
  }
}
```

**Gateway 验证:**
1. 验证 JWT 签名和过期时间
2. 提取用户身份信息
3. 绑定用户到当前连接

**Gateway 响应:**
```json
// 成功
{
  "type": "auth_success",
  "payload": {
    "userId": "user-uuid",
    "userName": "张三",
    "permissions": ["chat:read", "chat:write"]
  }
}

// 失败
{
  "type": "auth_error",
  "payload": {
    "code": "TOKEN_EXPIRED",
    "message": "Authentication token has expired"
  }
}
```

### 阶段 3: 业务消息处理

连接建立后，进入正常的消息交换:
```json
{
  "type": "chat",
  "payload": {
    "content": "你好",
    "agentId": "default-agent"
  }
}
```

## 快速开始

### 1. 安装依赖

```bash
npx pnpm install
```

### 2. 启动 Master 进程

```bash
npx tsx src/gateway/cli.ts master --port 3000 --workers 4
```

或者使用 npm 脚本：

```bash
npm run gateway:master
```

### 3. 启动 Worker 进程（可选，Master 会自动启动）

```bash
npx tsx src/gateway/cli.ts worker --id worker-1
```

或者使用 npm 脚本：

```bash
npm run gateway:worker
```

### 4. 检查状态

```bash
curl http://localhost:3000/health
```

## 支持的通道

### Internal Channel

通过 WebSocket 与 Cradle Chat UI 通信。

**配置：**
```json
{
  "port": 3000,
  "heartbeatInterval": 30000,
  "connectionTimeout": 60000,
  "cors": true
}
```

**连接：**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
```

### DingTalk Channel

通过 Webhook 接入钉钉机器人。

**配置：**
```json
{
  "appKey": "your-app-key",
  "appSecret": "your-app-secret",
  "callbackPath": "/webhook/dingtalk",
  "enableSignature": true
}
```

**Webhook URL：**
```
https://your-domain.com/webhook/dingtalk
```

## API

### 健康检查

```bash
GET /health
```

响应：
```json
{
  "status": "ok",
  "timestamp": 1704067200000,
  "stats": {
    "workers": [...],
    "queueLength": 0,
    "totalMessages": 100
  }
}
```

### 统计信息

```bash
GET /stats
```

响应：
```json
{
  "workers": [...],
  "queueLength": 0,
  "totalMessages": 100,
  "isRunning": true
}
```

## 数据库表设计

### t_channel 表

```sql
CREATE TABLE t_channel (
  name VARCHAR(128) PRIMARY KEY, -- 通道唯一标识
  type VARCHAR(32) NOT NULL, -- internal, dingtalk, wechat, feishu, etc.
  enabled BOOLEAN DEFAULT TRUE,
  config JSON, -- 通道配置
  credentials JSON, -- 访问凭证
  max_connections INT DEFAULT 1000,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**示例数据 (t_channels 表):**
```json
{
  "sid": "ch-001",
  "channel_name": "Internal Channel",
  "config": {
    "heartbeatInterval": 30000,
    "connectionTimeout": 60000,
    "cors": true,
    "max_connections": 1000
  },
  "client_config": [
    {
      "name": "cradle-web",
      "token": "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab"
    },
    {
      "name": "cradle-mobile",
      "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
    }
  ],
  "status": "enabled"
}
```

## 开发

### 类型检查

```bash
npm run typecheck
```

### 构建

```bash
npm run gateway:build
```

## 配置

参考 `gateway.config.json` 了解完整配置选项。

## 许可证

MIT
