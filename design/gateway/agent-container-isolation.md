# Agent 容器化隔离架构重构方案

## 1. 背景与目标

### 1.1 当前架构

当前系统采用 **Master-Worker 进程隔离架构**：

```
┌─────────────────────────────────────────────────────────────────┐
│                        Master 进程                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ CradleChan  │  │DingTalkChan │  │  OtherChan  │             │
│  │  (身份识别)  │  │  (身份识别)  │  │  (身份识别)  │             │
│  │  (路由决策)  │  │  (路由决策)  │  │  (路由决策)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┴────────────────┘                     │
│                          │                                      │
│                    根据 agentId 路由                            │
│                    找到对应的 Worker                            │
│                          │                                      │
│         ┌────────────────┼────────────────┐                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Worker进程-A │  │ Worker进程-B │  │ Worker进程-C │             │
│  │ AgentRuntime│  │ AgentRuntime│  │ AgentRuntime│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│         │                │                │                     │
│         └────────────────┴────────────────┘                     │
│                     IPC (process.send)                          │
└─────────────────────────────────────────────────────────────────┘
```

**核心特点**：
- 1 Worker = 1 AgentManager = 1 Agent
- 每个 Agent 运行在独立的 Worker 进程中
- 通过 Node.js IPC (process.send) 进行通信

### 1.2 存在的安全风险

| 风险类型 | 说明 | 风险等级 |
|---------|------|---------|
| 文件系统泄露 | Worker 可访问宿主机任意文件 | 高 |
| 网络无隔离 | Agent 可访问任意网络资源 | 高 |
| 资源无限制 | 恶意 Agent 可能耗尽系统资源 | 中 |
| 环境变量泄露 | 可能读取敏感配置 | 中 |
| 进程间干扰 | 同一用户下的进程可能相互影响 | 低 |

### 1.3 重构目标

1. **安全隔离**：Agent 运行在独立容器中，实现系统级隔离
2. **资源限制**：精确控制每个 Agent 的 CPU、内存、网络资源
3. **渐进式迁移**：支持进程模式和容器模式并存
4. **零代码改动**：通过抽象层实现部署方式切换

---

## 2. 目标架构

### 2.1 容器化架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        宿主机 (Docker Host)                      │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Master 容器 (Docker)                        │   │
│  │  ├── Gateway (端口监听)                                  │   │
│  │  ├── Channel 插件                                        │   │
│  │  ├── LLM Service Manager                                 │   │
│  │  ├── Database Pool                                       │   │
│  │  └── Docker SDK (管理 Agent 容器)                        │   │
│  └────────────────────────┬────────────────────────────────┘   │
│                           │ Docker API / HTTP                   │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐           │
│  │ Agent-A 容器 │   │ Agent-B 容器 │   │ Agent-C 容器 │           │
│  │ ┌─────────┐ │   │ ┌─────────┐ │   │ ┌─────────┐ │           │
│  │ │ Server  │ │   │ │ Server  │ │   │ │ Server  │ │           │
│  │ │ Agent   │ │   │ │ Agent   │ │   │ │ Agent   │ │           │
│  │ └─────────┘ │   │ └─────────┘ │   │ └─────────┘ │           │
│  │             │   │             │   │             │           │
│  │ 资源限制:    │   │ 资源限制:    │   │ 资源限制:    │           │
│  │ CPU: 0.5    │   │ CPU: 1.0    │   │ CPU: 0.5    │           │
│  │ MEM: 512MB  │   │ MEM: 1GB    │   │ MEM: 512MB  │           │
│  │ 网络: bridge │   │ 网络: bridge │   │ 网络: bridge │           │
│  └─────────────┘   └─────────────┘   └─────────────┘           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              共享基础设施 (Docker Network)               │   │
│  │  ├── Redis (消息队列/缓存)                               │   │
│  │  └── PostgreSQL (数据库)                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 通信架构变化

| 对比项 | 当前 (进程模式) | 目标 (容器模式) |
|--------|----------------|----------------|
| 通信方式 | IPC (process.send) | HTTP/WebSocket |
| 启动方式 | spawn() | docker.createContainer() |
| 隔离级别 | 进程级 | 系统级 (容器) |
| 资源限制 | 有限 (ulimit) | 完整 (cgroup) |
| 网络隔离 | 无 | 完整 (NetworkPolicy) |
| 文件系统 | 共享 | 隔离 (Volume) |

---

## 3. 项目拆分方案

### 3.1 Monorepo 结构

```
cradle/
├── packages/
│   ├── agent-protocol/          # 共享协议包
│   │   ├── src/
│   │   │   ├── types.ts         # 类型定义
│   │   │   ├── client.ts        # Master API 客户端
│   │   │   ├── server.ts        # Agent API 服务端
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── cradle-master/           # Master 项目
│   │   ├── src/
│   │   │   ├── gateway/         # 网关
│   │   │   ├── channels/        # Channel 插件
│   │   │   ├── llm/             # LLM 服务
│   │   │   ├── store/           # 数据库
│   │   │   ├── organization/    # 组织管理
│   │   │   ├── agent-manager/   # Agent 容器管理
│   │   │   │   ├── process-manager.ts    # 进程模式
│   │   │   │   ├── container-manager.ts  # 容器模式
│   │   │   │   └── types.ts
│   │   │   └── main.ts
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   └── cradle-agent/            # Agent 项目
│       ├── src/
│       │   ├── runtime/         # Agent 运行时
│       │   ├── context/         # 上下文管理
│       │   ├── tools/           # 工具
│       │   ├── skills/          # 技能
│       │   ├── memory/          # 记忆
│       │   ├── executor/        # 执行器
│       │   ├── orchestrator/    # 编排器
│       │   ├── server/          # HTTP/WebSocket 服务
│       │   │   ├── http-server.ts
│       │   │   ├── ws-handler.ts
│       │   │   └── routes.ts
│       │   ├── client/          # Master API 客户端
│       │   │   ├── master-client.ts
│       │   │   ├── llm-client.ts
│       │   │   └── db-client.ts
│       │   └── main.ts          # 入口
│       ├── package.json
│       └── Dockerfile
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── Dockerfile.agent
│
├── design/                       # 设计文档
├── package.json                  # workspace 根配置
└── tsconfig.json                 # 共享 TypeScript 配置
```

### 3.2 包依赖关系

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ┌─────────────────┐                                           │
│  │ cradle-master   │                                           │
│  │                 │                                           │
│  │ 依赖:           │                                           │
│  │ - agent-protocol│                                           │
│  │ - dockerode     │                                           │
│  │ - fastify       │                                           │
│  │ - ws            │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           │ 依赖                                                 │
│           ▼                                                     │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │ agent-protocol  │◀────────│ cradle-agent    │               │
│  │                 │  依赖    │                 │               │
│  │ 类型定义:       │         │ 依赖:           │               │
│  │ - MessageRequest│         │ - agent-protocol│               │
│  │ - LLMRequest    │         │ - fastify       │               │
│  │ - DBQueryRequest│         │ - ws            │               │
│  │                 │         │                 │               │
│  │ 接口:           │         │ 独立运行:        │               │
│  │ - MasterClient  │         │ - HTTP Server   │               │
│  │ - AgentServer   │         │ - WebSocket     │               │
│  └─────────────────┘         └─────────────────┘               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. 通信协议设计

### 4.1 协议总览

```
┌─────────────────────────────────────────────────────────────────┐
│                    通信协议层次                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Master 容器                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ HTTP Server │  │  WS Server  │  │ Agent API   │      │   │
│  │  │ :3000       │  │  :3000/ws   │  │ /api/agent/*│      │   │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘      │   │
│  └─────────┼────────────────┼───────────────────────────────┘   │
│            │                │                                    │
│            │                │                                    │
│  ┌─────────┼────────────────┼───────────────────────────────┐   │
│  │         │                │              Agent 容器        │   │
│  │  ┌──────┴──────┐  ┌──────┴──────┐                        │   │
│  │  │ HTTP Client │  │  WS Client  │  ┌─────────────┐       │   │
│  │  │             │  │             │  │ AgentServer │       │   │
│  │  │ 调用 Master │  │ 接收推送    │  │ :8080       │       │   │
│  │  │ API         │  │             │  │             │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 API 接口定义

#### 4.2.1 Agent → Master (资源请求)

**LLM 调用接口**

```typescript
// POST /api/agent/llm/chat
interface LLMChatRequest {
  requestId: string;
  instanceId?: string;
  messages: ConversationMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  modelConfig?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

interface LLMChatResponse {
  requestId: string;
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 流式响应: POST /api/agent/llm/stream
// 返回 Server-Sent Events (SSE)
interface LLMStreamEvent {
  event: 'chunk' | 'tool_call' | 'done' | 'error';
  data: {
    content?: string;
    toolCall?: ToolCall;
    error?: string;
  };
}
```

**数据库查询接口**

```typescript
// POST /api/agent/db/query
interface DBQueryRequest {
  requestId: string;
  sql: string;
  params?: any[];
}

interface DBQueryResponse {
  requestId: string;
  rows: any[];
  rowCount: number;
}

// POST /api/agent/db/execute
interface DBExecuteRequest {
  requestId: string;
  sql: string;
  params?: any[];
}

interface DBExecuteResponse {
  requestId: string;
  affectedRows: number;
  insertId?: number;
}
```

**配置获取接口**

```typescript
// GET /api/agent/config/:agentId
interface AgentConfigResponse {
  agentId: string;
  name: string;
  eName: string;
  profile: AgentProfile;
  heartbeatConfig?: HeartbeatConfig;
  modelConfig: ModelConfig;
  skills: SkillEntry[];
  tools: ToolDefinition[];
}

// GET /api/agent/contact/:contactId
interface ContactInfoResponse {
  contactId: string;
  name: string;
  language?: string;
  profile: ContactProfile;
}
```

#### 4.2.2 Master → Agent (消息处理)

**消息处理接口**

```typescript
// POST /message
interface MessageRequest {
  messageId: string;
  agentId: string;
  contactId: string;
  contactName?: string;
  content: string;
  metadata?: {
    channelType?: string;
    channelName?: string;
    chatType?: 'private' | 'group';
    chatId?: string;
    images?: ImageContent[];
    audio?: AudioContent;
  };
  stream?: boolean;
  voice?: boolean;
  voiceResponse?: boolean;
}

interface ImageContent {
  type: 'image';
  url: string;
  mimeType?: string;
}

interface AudioContent {
  type: 'audio';
  url: string;
  mimeType?: string;
  duration?: number;
}

interface MessageResponse {
  messageId: string;
  content: string;
  metadata?: {
    images?: string[];
    audio?: string;
    [key: string]: any;
  };
}
```

**流式响应**

```typescript
// POST /stream (Server-Sent Events)
// 请求体同 MessageRequest
// 响应格式:
interface StreamEvent {
  event: 'chunk' | 'tool_call' | 'done' | 'error';
  data: {
    content?: string;
    toolCall?: ToolCall;
    error?: string;
  };
}
```

**健康检查**

```typescript
// GET /health
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  agentId: string;
  timestamp: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
  };
}
```

#### 4.2.3 WebSocket 通信协议

```typescript
// Agent → Master 连接
// WS: /ws?agentId={agentId}&token={token}

// 消息格式
interface WSMessage {
  id: string;           // 消息 ID
  type: string;         // 消息类型
  payload: any;         // 消息内容
  timestamp: number;    // 时间戳
}

// 消息类型定义
type MessageType =
  | 'agent-ready'       // Agent 就绪
  | 'agent-status'      // Agent 状态
  | 'inbound'           // 入站消息
  | 'outbound'          // 出站消息
  | 'heartbeat'         // 心跳
  | 'llm-request'       // LLM 请求
  | 'llm-response'      // LLM 响应
  | 'db-request'        // 数据库请求
  | 'db-response'       // 数据库响应
  | 'error';            // 错误

// Agent 就绪
interface AgentReadyMessage {
  type: 'agent-ready';
  agentId: string;
  timestamp: number;
}

// 入站消息
interface InboundMessage {
  type: 'inbound';
  messageId: string;
  payload: MessageRequest;
}

// 出站消息
interface OutboundMessage {
  type: 'outbound';
  messageId: string;
  payload: MessageResponse;
}

// 心跳
interface HeartbeatMessage {
  type: 'heartbeat';
  agentId: string;
  timestamp: number;
}
```

### 4.3 类型定义文件

```typescript
// packages/agent-protocol/src/types.ts

// ============ 基础类型 ============

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  name?: string;
  toolCallId?: string;
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// ============ 请求/响应类型 ============

export interface LLMChatRequest {
  requestId: string;
  instanceId?: string;
  messages: ConversationMessage[];
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  stream?: boolean;
  modelConfig?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
}

export interface LLMChatResponse {
  requestId: string;
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: 'stop' | 'tool_calls';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface DBQueryRequest {
  requestId: string;
  sql: string;
  params?: any[];
}

export interface DBQueryResponse {
  requestId: string;
  rows: any[];
  rowCount: number;
}

export interface MessageRequest {
  messageId: string;
  agentId: string;
  contactId: string;
  contactName?: string;
  content: string;
  metadata?: MessageMetadata;
  stream?: boolean;
  voice?: boolean;
  voiceResponse?: boolean;
}

export interface MessageMetadata {
  channelType?: string;
  channelName?: string;
  chatType?: 'private' | 'group';
  chatId?: string;
  images?: ImageContent[];
  audio?: AudioContent;
}

export interface ImageContent {
  type: 'image';
  url: string;
  mimeType?: string;
}

export interface AudioContent {
  type: 'audio';
  url: string;
  mimeType?: string;
  duration?: number;
}

export interface MessageResponse {
  messageId: string;
  content: string;
  metadata?: Record<string, any>;
}

// ============ WebSocket 消息类型 ============

export interface WSMessage<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
}

export interface AgentReadyPayload {
  agentId: string;
}

export interface HeartbeatPayload {
  agentId: string;
  status: 'running' | 'idle' | 'error';
}
```

---

## 5. 核心实现

### 5.1 agent-protocol 包

#### 5.1.1 MasterClient (Agent 端使用)

```typescript
// packages/agent-protocol/src/client.ts

import WebSocket from 'ws';
import type {
  LLMChatRequest,
  LLMChatResponse,
  DBQueryRequest,
  DBQueryResponse,
  MessageRequest,
  MessageResponse,
  WSMessage,
} from './types.js';

export interface MasterClientConfig {
  masterUrl: string;
  masterWsUrl: string;
  agentId: string;
  token?: string;
}

export class MasterClient {
  private config: MasterClientConfig;
  private ws?: WebSocket;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
  }>();
  private messageHandlers = new Set<(message: MessageRequest) => Promise<MessageResponse>>();

  constructor(config: MasterClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.config.masterWsUrl}/ws?agentId=${this.config.agentId}`;
      
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[MasterClient] Connected to Master');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });

      this.ws.on('error', (error) => {
        console.error('[MasterClient] Connection error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[MasterClient] Connection closed');
        setTimeout(() => this.connect(), 5000);
      });
    });
  }

  private handleMessage(message: WSMessage): void {
    if (message.type === 'inbound') {
      this.handleInboundMessage(message);
    } else {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        pending.resolve(message.payload);
      }
    }
  }

  private async handleInboundMessage(message: WSMessage): Promise<void> {
    for (const handler of this.messageHandlers) {
      try {
        const response = await handler(message.payload);
        this.send({
          id: message.id,
          type: 'outbound',
          payload: response,
          timestamp: Date.now(),
        });
      } catch (error) {
        this.send({
          id: message.id,
          type: 'error',
          payload: { error: (error as Error).message },
          timestamp: Date.now(),
        });
      }
    }
  }

  onMessage(handler: (message: MessageRequest) => Promise<MessageResponse>): void {
    this.messageHandlers.add(handler);
  }

  async llmChat(request: LLMChatRequest): Promise<LLMChatResponse> {
    return this.request('llm-request', request);
  }

  async dbQuery(request: DBQueryRequest): Promise<DBQueryResponse> {
    return this.request('db-request', request);
  }

  private async request<T>(type: string, payload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      this.pendingRequests.set(id, { resolve, reject });

      this.send({
        id,
        type,
        payload,
        timestamp: Date.now(),
      });

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  private send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  sendHeartbeat(): void {
    this.send({
      id: `heartbeat-${Date.now()}`,
      type: 'heartbeat',
      payload: { agentId: this.config.agentId },
      timestamp: Date.now(),
    });
  }
}
```

#### 5.1.2 AgentServer (Agent 端使用)

```typescript
// packages/agent-protocol/src/server.ts

import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type { MessageRequest, MessageResponse } from './types.js';

export interface AgentServerConfig {
  agentId: string;
  port?: number;
  masterClient: MasterClient;
}

export class AgentServer {
  private config: AgentServerConfig;
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private masterClient: MasterClient;
  private messageHandler?: (message: MessageRequest) => Promise<MessageResponse>;

  constructor(config: AgentServerConfig) {
    this.config = config;
    this.masterClient = config.masterClient;
    this.app = express();
    this.wss = new WebSocketServer({ noServer: true });
    
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupRoutes(): void {
    this.app.use(express.json());

    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        agentId: this.config.agentId,
        timestamp: Date.now(),
      });
    });

    this.app.post('/message', async (req, res) => {
      if (!this.messageHandler) {
        res.status(500).json({ error: 'Message handler not set' });
        return;
      }

      try {
        const result = await this.messageHandler(req.body);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    this.app.post('/stream', async (req, res) => {
      if (!this.messageHandler) {
        res.status(500).json({ error: 'Message handler not set' });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        await this.messageHandler(req.body);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`);
        res.end();
      }
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      ws.on('message', async (data) => {
        if (!this.messageHandler) return;

        try {
          const message = JSON.parse(data.toString());
          const result = await this.messageHandler(message);
          ws.send(JSON.stringify(result));
        } catch (error) {
          ws.send(JSON.stringify({ error: (error as Error).message }));
        }
      });
    });
  }

  onMessage(handler: (message: MessageRequest) => Promise<MessageResponse>): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    const port = this.config.port || 8080;

    this.server = this.app.listen(port, () => {
      console.log(`[AgentServer] Listening on port ${port}`);
    });

    this.server.on('upgrade', (request: any, socket: any, head: any) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });
  }

  async stop(): Promise<void> {
    this.wss.close();
    this.server.close();
  }
}
```

### 5.2 cradle-agent 项目

#### 5.2.1 入口文件

```typescript
// packages/cradle-agent/src/main.ts

import { MasterClient, AgentServer } from '@cradle/agent-protocol';
import { Agent } from './runtime/agent.js';
import { ContextManager } from './context/context-manager.js';

interface AgentConfig {
  agentId: string;
  masterUrl: string;
  masterWsUrl: string;
  port?: number;
}

async function main(): Promise<void> {
  const config: AgentConfig = {
    agentId: process.env.AGENT_ID!,
    masterUrl: process.env.MASTER_URL || 'http://localhost:3000',
    masterWsUrl: process.env.MASTER_WS_URL || 'ws://localhost:3000',
    port: parseInt(process.env.PORT || '8080'),
  };

  if (!config.agentId) {
    throw new Error('AGENT_ID environment variable is required');
  }

  // 创建 Master 客户端
  const masterClient = new MasterClient({
    masterUrl: config.masterUrl,
    masterWsUrl: config.masterWsUrl,
    agentId: config.agentId,
  });

  // 连接 Master
  await masterClient.connect();

  // 获取 Agent 配置
  const agentConfig = await masterClient.getAgentConfig(config.agentId);

  // 创建上下文管理器 (使用 MasterClient 进行数据库查询)
  const contextManager = new ContextManager(config.agentId, {
    dbQuery: (sql, params) => masterClient.dbQuery({ requestId: '', sql, params }),
  });

  // 创建 Agent
  const agent = new Agent(agentConfig, contextManager, {
    chat: (req) => masterClient.llmChat(req),
    streamChat: (req) => masterClient.llmStreamChat(req),
  });

  await agent.initialize();

  // 创建 HTTP 服务
  const server = new AgentServer({
    agentId: config.agentId,
    port: config.port,
    masterClient,
  });

  // 设置消息处理器
  server.onMessage(async (message) => {
    return agent.handleMessage(message);
  });

  // 同时监听 WebSocket 消息
  masterClient.onMessage(async (message) => {
    return agent.handleMessage(message);
  });

  await server.start();

  // 启动心跳
  setInterval(() => {
    masterClient.sendHeartbeat();
  }, 30000);

  console.log(`[Agent] ${config.agentId} started successfully`);
}

main().catch((error) => {
  console.error('[Agent] Failed to start:', error);
  process.exit(1);
});
```

### 5.3 cradle-master 项目

#### 5.3.1 Agent 容器管理器

```typescript
// packages/cradle-master/src/agent-manager/container-manager.ts

import Docker from 'dockerode';
import type { AgentContainerConfig } from './types.js';

export class AgentContainerManager {
  private docker: Docker;
  private containers: Map<string, Docker.Container> = new Map();

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  async createAgent(config: AgentContainerConfig): Promise<string> {
    const containerName = `agent-${config.agentId}`;

    const container = await this.docker.createContainer({
      name: containerName,
      Image: config.image,
      Env: [
        `AGENT_ID=${config.agentId}`,
        `MASTER_URL=${config.masterUrl}`,
        `MASTER_WS_URL=${config.masterWsUrl}`,
        `NODE_ENV=production`,
      ],
      HostConfig: {
        CpuQuota: config.cpuLimit * 100000,
        Memory: config.memoryLimit * 1024 * 1024,
        NetworkMode: config.networkMode || 'bridge',
        SecurityOpt: ['no-new-privileges'],
        CapDrop: ['ALL'],
        ReadonlyRootfs: true,
      },
    });

    await container.start();
    this.containers.set(config.agentId, container);

    return container.id;
  }

  async stopAgent(agentId: string): Promise<void> {
    const container = this.containers.get(agentId);
    if (container) {
      await container.stop();
      await container.remove();
      this.containers.delete(agentId);
    }
  }

  async getAgentStatus(agentId: string): Promise<{
    status: 'running' | 'stopped' | 'unknown';
    stats?: any;
  }> {
    const container = this.containers.get(agentId);
    if (!container) {
      return { status: 'unknown' };
    }

    const info = await container.inspect();
    return {
      status: info.State.Running ? 'running' : 'stopped',
    };
  }
}
```

---

## 6. 迁移路径

### 6.1 阶段规划

```
┌─────────────────────────────────────────────────────────────────┐
│                    迁移阶段                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  阶段 1: 协议层抽象 (1-2 周)                                     │
│  ├── 创建 agent-protocol 包                                     │
│  ├── 定义类型接口                                               │
│  ├── 实现 MasterClient                                          │
│  └── 实现 AgentServer                                           │
│                                                                 │
│  阶段 2: Worker 改造 (2-3 周)                                    │
│  ├── 用 MasterClient 替换直接数据库访问                         │
│  ├── 用 MasterClient 替换 LLM IPC                               │
│  ├── 添加 HTTP 服务端支持                                       │
│  └── 保持 IPC 模式兼容                                          │
│                                                                 │
│  阶段 3: Master API 扩展 (1-2 周)                                │
│  ├── POST /api/agent/db/query                                   │
│  ├── POST /api/agent/llm/chat                                   │
│  ├── GET /api/agent/config/:agentId                             │
│  └── WebSocket /ws (Agent 连接)                                 │
│                                                                 │
│  阶段 4: 项目拆分 (2-3 周)                                       │
│  ├── 创建 cradle-agent 子项目                                   │
│  ├── 迁移 Agent 相关代码                                        │
│  ├── 配置 Monorepo                                              │
│  └── 验证功能完整性                                             │
│                                                                 │
│  阶段 5: Docker 化 (1-2 周)                                      │
│  ├── 创建 Agent Dockerfile                                      │
│  ├── 配置 docker-compose                                        │
│  ├── 实现容器生命周期管理                                        │
│  └── 生产环境部署验证                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 阶段 1 详细任务

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 创建 agent-protocol 包 | 初始化包结构、配置 TypeScript | P0 |
| 定义类型接口 | 所有 API 的请求/响应类型 | P0 |
| 实现 MasterClient | HTTP/WebSocket 客户端 | P0 |
| 实现 AgentServer | HTTP/WebSocket 服务端 | P0 |
| 编写单元测试 | 协议层测试 | P1 |

### 6.3 阶段 2 详细任务

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 改造 ContextManager | 用 MasterClient 替换直接数据库访问 | P0 |
| 改造 LLMClient | 用 MasterClient 替换 IPC | P0 |
| 添加 HTTP 服务 | 在 Worker 中启动 HTTP 服务 | P0 |
| 保持 IPC 兼容 | 支持进程模式和容器模式切换 | P1 |
| 集成测试 | 验证功能完整性 | P1 |

### 6.4 兼容性策略

```typescript
// 支持两种模式的 Worker
interface WorkerConfig {
  mode: 'process' | 'container';
  agentId: string;
  
  // 进程模式
  ipcMode?: {
    sendToMaster: (message: any) => void;
  };
  
  // 容器模式
  httpMode?: {
    masterUrl: string;
    masterWsUrl: string;
    port: number;
  };
}

class AgentWorker {
  private mode: 'process' | 'container';
  private masterClient?: MasterClient;
  private agentServer?: AgentServer;

  constructor(config: WorkerConfig) {
    this.mode = config.mode;

    if (config.mode === 'container' && config.httpMode) {
      this.masterClient = new MasterClient({
        masterUrl: config.httpMode.masterUrl,
        masterWsUrl: config.httpMode.masterWsUrl,
        agentId: config.agentId,
      });

      this.agentServer = new AgentServer({
        agentId: config.agentId,
        port: config.httpMode.port,
        masterClient: this.masterClient,
      });
    }
  }

  // 统一的资源访问接口
  get dbClient() {
    if (this.mode === 'container') {
      return {
        query: (sql: string, params?: any[]) => 
          this.masterClient!.dbQuery({ requestId: '', sql, params }),
      };
    }
    // 进程模式使用原有实现
    return { query };
  }
}
```

---

## 7. Docker 配置

### 7.1 Agent Dockerfile

```dockerfile
# packages/cradle-agent/Dockerfile

FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npm ci && npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

USER node

CMD ["node", "dist/main.js"]
```

### 7.2 docker-compose.yml

```yaml
# docker/docker-compose.yml

version: '3.8'

networks:
  cradle-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

services:
  master:
    build:
      context: ../packages/cradle-master
      dockerfile: Dockerfile
    container_name: cradle-master
    networks:
      - cradle-network
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@postgres:5432/cradle
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  agent-template:
    build:
      context: ../packages/cradle-agent
      dockerfile: Dockerfile
    networks:
      - cradle-network
    environment:
      - MASTER_URL=http://master:3000
      - MASTER_WS_URL=ws://master:3000
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  postgres:
    image: postgres:15-alpine
    networks:
      - cradle-network
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=cradle
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    networks:
      - cradle-network
    volumes:
      - redis-data:/data

volumes:
  postgres-data:
  redis-data:
```

### 7.3 安全配置

```yaml
# Agent 容器安全配置
services:
  agent:
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
    cap_drop:
      - ALL
    read_only: true
    tmpfs:
      - /tmp:size=100M,mode=1777
    networks:
      - cradle-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.1'
          memory: 128M
```

---

## 8. 监控与运维

### 8.1 监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|---------|
| agent_container_status | 容器运行状态 | 非运行状态 |
| agent_cpu_usage | CPU 使用率 | > 80% |
| agent_memory_usage | 内存使用率 | > 85% |
| agent_message_latency | 消息处理延迟 | > 5s |
| agent_error_rate | 错误率 | > 1% |
| agent_llm_latency | LLM 调用延迟 | > 30s |

### 8.2 日志规范

```typescript
// Agent 日志格式
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "agentId": "agent-assistant-zhang",
  "component": "AgentRuntime",
  "message": "Message processed successfully",
  "context": {
    "messageId": "msg-123",
    "contactId": "contact-456",
    "duration": 1500
  }
}
```

### 8.3 故障恢复

```
┌─────────────────────────────────────────────────────────────────┐
│                    故障恢复流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. 健康检查失败                                                │
│     │                                                           │
│     ▼                                                           │
│  2. Master 标记 Agent 为 unhealthy                              │
│     │                                                           │
│     ▼                                                           │
│  3. 停止当前容器                                                │
│     │                                                           │
│     ▼                                                           │
│  4. 创建新容器                                                  │
│     │                                                           │
│     ▼                                                           │
│  5. 等待 Agent 就绪 (WebSocket 连接)                            │
│     │                                                           │
│     ├── 成功 → 标记为 healthy                                   │
│     │                                                           │
│     └── 失败 → 重试 (最多 3 次)                                 │
│              │                                                  │
│              └── 仍失败 → 告警通知                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|------|------|------|
| 通信延迟增加 | 消息处理变慢 | 使用 WebSocket 长连接、连接池 |
| 容器资源开销 | 内存/CPU 占用增加 | 使用 Alpine 镜像、优化资源限制 |
| 网络故障 | Agent 无法连接 Master | 自动重连、本地缓存、降级处理 |
| 数据一致性 | 分布式事务问题 | 幂等设计、最终一致性 |
| 迁移成本 | 开发时间增加 | 渐进式迁移、双模式运行 |

---

## 10. Agent 容器调度策略

### 10.1 调度场景分析

容器化后，需要解决 **Agent 与容器的映射关系** 问题：

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent 容器调度场景                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  场景 1: 公共 Agent (共享容器)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  一个容器运行一个公共 Agent 实例                          │   │
│  │  多个用户共享同一个 Agent 容器                            │   │
│  │                                                          │   │
│  │  示例: 客服机器人、FAQ助手、通用助手                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 2: 私有 Agent (独占容器)                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  一个容器运行一个用户的私有 Agent                         │   │
│  │  每个用户有独立的 Agent 容器                              │   │
│  │                                                          │   │
│  │  示例: 个人助理、专属顾问、VIP客服                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  场景 3: 按需创建 (动态容器)                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  根据负载动态创建/销毁 Agent 容器                         │   │
│  │  支持弹性伸缩                                            │   │
│  │                                                          │   │
│  │  示例: 高峰期扩容、任务型 Agent                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 Agent 类型定义

```typescript
// Agent 部署类型
type AgentDeploymentType = 
  | 'shared'    // 共享容器 - 多用户共享一个 Agent 实例
  | 'dedicated' // 独占容器 - 每个用户独立 Agent 实例
  | 'dynamic';  // 动态容器 - 按需创建/销毁

// Agent 配置扩展
interface AgentConfig {
  sid: string;
  name: string;
  eName: string;
  status: 'enabled' | 'disabled';
  
  // 部署配置
  deployment: {
    type: AgentDeploymentType;
    
    // 共享模式配置
    shared?: {
      maxConcurrentUsers: number;  // 最大并发用户数
      queueEnabled: boolean;       // 是否启用排队
    };
    
    // 独占模式配置
    dedicated?: {
      perUser: boolean;            // 是否每个用户独立
      perContact: boolean;         // 是否每个联系人独立
      ttl: number;                 // 空闲超时时间(秒)
    };
    
    // 动态模式配置
    dynamic?: {
      minInstances: number;        // 最小实例数
      maxInstances: number;        // 最大实例数
      scaleUpThreshold: number;    // 扩容阈值(并发数)
      scaleDownThreshold: number;  // 缩容阈值
      cooldownPeriod: number;      // 冷却时间(秒)
    };
  };
  
  // 资源配置
  resources: {
    cpuLimit: number;      // CPU 限制(核)
    memoryLimit: number;   // 内存限制(MB)
  };
}
```

### 10.3 容器调度架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    容器调度架构                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户消息                                                       │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Master 进程                           │   │
│  │                                                         │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │   Channel   │  │ AgentRouter │  │ Scheduler   │      │   │
│  │  │   Plugin    │──▶│ (路由决策)   │──▶│ (容器调度)   │      │   │
│  │  └─────────────┘  └─────────────┘  └──────┬──────┘      │   │
│  │                                           │              │   │
│  │                                           ▼              │   │
│  │                              ┌─────────────────────────┐ │   │
│  │                              │   ContainerRegistry     │ │   │
│  │                              │   (容器注册表)           │ │   │
│  │                              │                         │ │   │
│  │                              │  agentId → containerId  │ │   │
│  │                              │  status                 │ │   │
│  │                              │  metrics                │ │   │
│  │                              └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                           │                     │
│         ┌─────────────────────────────────┼─────────────────┐   │
│         │                                 │                 │   │
│         ▼                                 ▼                 ▼   │
│  ┌─────────────┐                   ┌─────────────┐   ┌─────────┐│
│  │ 公共Agent容器│                   │ 私有Agent容器│   │ 动态容器 ││
│  │             │                   │             │   │         ││
│  │ agent-faq   │                   │ user-A-agent│   │ task-1  ││
│  │ (共享)      │                   │ user-B-agent│   │ task-2  ││
│  │             │                   │ user-C-agent│   │ ...     ││
│  │ 多用户并发   │                   │ (独占)      │   │ (按需)  ││
│  └─────────────┘                   └─────────────┘   └─────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.4 AgentRouter 扩展设计

```typescript
// src/gateway/router/agent-router.ts (扩展)

import { ContainerScheduler } from '../scheduler/container-scheduler.js';

export interface AgentRouterConfig {
  defaultAgentId?: string;
  scheduler: ContainerScheduler;
}

export class AgentRouter {
  private config: AgentRouterConfig;
  private scheduler: ContainerScheduler;

  constructor(config: AgentRouterConfig) {
    this.config = config;
    this.scheduler = config.scheduler;
  }

  /**
   * 路由消息到 Agent 容器
   */
  async route(
    context: InboundMessageContext,
    channelName: string
  ): Promise<AgentMessage & { containerId?: string }> {
    // 1. 解析 Contact
    const contactId = await this.resolveContact(channelName, context.senderId);

    // 2. 确定目标 Agent
    const agentId = await this.resolveAgent(context, channelName);

    // 3. 获取 Agent 配置
    const agentConfig = await this.getAgentConfig(agentId);

    // 4. 根据部署类型调度容器
    const containerId = await this.scheduler.schedule(agentConfig, {
      contactId,
      channelName,
      messageId: context.messageId,
    });

    // 5. 构建消息
    return {
      messageId: context.messageId,
      agentId,
      contactId,
      content: context.body,
      channelName,
      timestamp: context.timestamp,
      containerId,  // 添加容器 ID
      metadata: {
        deploymentType: agentConfig.deployment.type,
      },
    };
  }
}
```

### 10.5 容器调度器实现

```typescript
// src/gateway/scheduler/container-scheduler.ts

import Docker from 'dockerode';

interface ScheduleContext {
  contactId: string;
  channelName: string;
  messageId: string;
}

interface ContainerInstance {
  containerId: string;
  agentId: string;
  ownerId?: string;        // 独占模式: 用户/联系人ID
  status: 'starting' | 'running' | 'stopping' | 'stopped';
  createdAt: Date;
  lastActiveAt: Date;
  activeConnections: number;
}

export class ContainerScheduler {
  private docker: Docker;
  private registry: Map<string, ContainerInstance> = new Map();
  private agentContainers: Map<string, Set<string>> = new Map();  // agentId -> containerIds

  constructor() {
    this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
  }

  /**
   * 调度容器
   * 返回可用的容器 ID
   */
  async schedule(
    agentConfig: AgentConfig,
    context: ScheduleContext
  ): Promise<string> {
    const { type } = agentConfig.deployment;

    switch (type) {
      case 'shared':
        return this.scheduleShared(agentConfig, context);
      
      case 'dedicated':
        return this.scheduleDedicated(agentConfig, context);
      
      case 'dynamic':
        return this.scheduleDynamic(agentConfig, context);
      
      default:
        throw new Error(`Unknown deployment type: ${type}`);
    }
  }

  /**
   * 共享模式调度
   * 多用户共享同一个 Agent 容器
   */
  private async scheduleShared(
    agentConfig: AgentConfig,
    context: ScheduleContext
  ): Promise<string> {
    const agentId = agentConfig.sid;
    const containers = this.agentContainers.get(agentId);

    // 查找可用的共享容器
    if (containers && containers.size > 0) {
      for (const containerId of containers) {
        const instance = this.registry.get(containerId);
        
        if (instance && instance.status === 'running') {
          const maxUsers = agentConfig.deployment.shared?.maxConcurrentUsers || 100;
          
          if (instance.activeConnections < maxUsers) {
            instance.activeConnections++;
            instance.lastActiveAt = new Date();
            return containerId;
          }
        }
      }
    }

    // 没有可用容器，创建新的
    return this.createContainer(agentConfig, { agentId });
  }

  /**
   * 独占模式调度
   * 每个用户/联系人独立的 Agent 容器
   */
  private async scheduleDedicated(
    agentConfig: AgentConfig,
    context: ScheduleContext
  ): Promise<string> {
    const agentId = agentConfig.sid;
    const ownerId = agentConfig.deployment.dedicated?.perContact
      ? context.contactId
      : context.contactId;  // 可根据需要调整

    // 查找用户的专属容器
    const containers = this.agentContainers.get(agentId);
    if (containers) {
      for (const containerId of containers) {
        const instance = this.registry.get(containerId);
        
        if (instance && instance.ownerId === ownerId) {
          if (instance.status === 'running') {
            instance.lastActiveAt = new Date();
            return containerId;
          }
        }
      }
    }

    // 创建用户的专属容器
    return this.createContainer(agentConfig, {
      agentId,
      ownerId,
    });
  }

  /**
   * 动态模式调度
   * 根据负载自动扩缩容
   */
  private async scheduleDynamic(
    agentConfig: AgentConfig,
    context: ScheduleContext
  ): Promise<string> {
    const agentId = agentConfig.sid;
    const containers = this.agentContainers.get(agentId);
    const config = agentConfig.deployment.dynamic!;

    // 计算当前负载
    let totalConnections = 0;
    let runningContainers = 0;

    if (containers) {
      for (const containerId of containers) {
        const instance = this.registry.get(containerId);
        if (instance && instance.status === 'running') {
          totalConnections += instance.activeConnections;
          runningContainers++;
        }
      }
    }

    // 检查是否需要扩容
    const avgLoad = runningContainers > 0 
      ? totalConnections / runningContainers 
      : config.scaleUpThreshold + 1;

    if (avgLoad >= config.scaleUpThreshold && runningContainers < config.maxInstances) {
      // 扩容
      return this.createContainer(agentConfig, { agentId });
    }

    // 查找负载最低的容器
    if (containers && containers.size > 0) {
      let minLoad = Infinity;
      let targetContainerId: string | null = null;

      for (const containerId of containers) {
        const instance = this.registry.get(containerId);
        if (instance && instance.status === 'running') {
          if (instance.activeConnections < minLoad) {
            minLoad = instance.activeConnections;
            targetContainerId = containerId;
          }
        }
      }

      if (targetContainerId) {
        const instance = this.registry.get(targetContainerId);
        if (instance) {
          instance.activeConnections++;
          instance.lastActiveAt = new Date();
        }
        return targetContainerId;
      }
    }

    // 创建新容器
    if (runningContainers < config.maxInstances) {
      return this.createContainer(agentConfig, { agentId });
    }

    throw new Error('No available container and max instances reached');
  }

  /**
   * 创建容器
   */
  private async createContainer(
    agentConfig: AgentConfig,
    options: { agentId: string; ownerId?: string }
  ): Promise<string> {
    const containerName = options.ownerId
      ? `agent-${agentConfig.sid}-${options.ownerId}`
      : `agent-${agentConfig.sid}-${Date.now()}`;

    const container = await this.docker.createContainer({
      name: containerName,
      Image: 'cradle-agent:latest',
      Env: [
        `AGENT_ID=${agentConfig.sid}`,
        `MASTER_URL=${process.env.MASTER_URL}`,
        `MASTER_WS_URL=${process.env.MASTER_WS_URL}`,
        `NODE_ENV=production`,
      ],
      HostConfig: {
        CpuQuota: agentConfig.resources.cpuLimit * 100000,
        Memory: agentConfig.resources.memoryLimit * 1024 * 1024,
        NetworkMode: 'cradle-network',
        SecurityOpt: ['no-new-privileges'],
        CapDrop: ['ALL'],
      },
    });

    await container.start();

    const containerId = container.id;
    const instance: ContainerInstance = {
      containerId,
      agentId: agentConfig.sid,
      ownerId: options.ownerId,
      status: 'starting',
      createdAt: new Date(),
      lastActiveAt: new Date(),
      activeConnections: 1,
    };

    this.registry.set(containerId, instance);

    if (!this.agentContainers.has(agentConfig.sid)) {
      this.agentContainers.set(agentConfig.sid, new Set());
    }
    this.agentContainers.get(agentConfig.sid)!.add(containerId);

    // 等待容器就绪
    await this.waitForReady(containerId);

    instance.status = 'running';
    return containerId;
  }

  /**
   * 等待容器就绪
   */
  private async waitForReady(containerId: string, timeout = 30000): Promise<void> {
    const instance = this.registry.get(containerId);
    if (!instance) throw new Error('Container not found');

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const container = this.docker.getContainer(containerId);
        const info = await container.inspect();

        if (info.State.Running) {
          // 检查健康状态
          const response = await fetch(
            `http://localhost:${info.NetworkSettings.Ports['8080/tcp'][0].HostPort}/health`
          );
          if (response.ok) {
            return;
          }
        }
      } catch {
        // 继续等待
      }

      await new Promise(r => setTimeout(r, 500));
    }

    throw new Error('Container failed to start within timeout');
  }

  /**
   * 释放容器连接
   */
  releaseConnection(containerId: string): void {
    const instance = this.registry.get(containerId);
    if (instance) {
      instance.activeConnections = Math.max(0, instance.activeConnections - 1);
      instance.lastActiveAt = new Date();
    }
  }

  /**
   * 清理空闲容器
   */
  async cleanupIdleContainers(): Promise<void> {
    const now = Date.now();

    for (const [containerId, instance] of this.registry) {
      if (instance.status !== 'running') continue;

      // 检查空闲时间
      const idleTime = now - instance.lastActiveAt.getTime();
      const ttl = 30 * 60 * 1000; // 30 分钟

      if (instance.activeConnections === 0 && idleTime > ttl) {
        await this.stopContainer(containerId);
      }
    }
  }

  /**
   * 停止容器
   */
  async stopContainer(containerId: string): Promise<void> {
    const instance = this.registry.get(containerId);
    if (!instance) return;

    instance.status = 'stopping';

    try {
      const container = this.docker.getContainer(containerId);
      await container.stop();
      await container.remove();
    } catch (error) {
      console.error(`Failed to stop container ${containerId}:`, error);
    }

    this.registry.delete(containerId);
    this.agentContainers.get(instance.agentId)?.delete(containerId);
  }

  /**
   * 获取调度状态
   */
  getStatus(): {
    totalContainers: number;
    agents: Map<string, { containers: number; activeConnections: number }>;
  } {
    const agents = new Map<string, { containers: number; activeConnections: number }>();

    for (const [agentId, containerIds] of this.agentContainers) {
      let containers = 0;
      let activeConnections = 0;

      for (const containerId of containerIds) {
        const instance = this.registry.get(containerId);
        if (instance && instance.status === 'running') {
          containers++;
          activeConnections += instance.activeConnections;
        }
      }

      agents.set(agentId, { containers, activeConnections });
    }

    return {
      totalContainers: this.registry.size,
      agents,
    };
  }
}
```

### 10.6 数据库表设计

```sql
-- Agent 部署配置表
CREATE TABLE t_agent_deployment (
  sid VARCHAR(64) PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL COMMENT 'Agent ID',
  type ENUM('shared', 'dedicated', 'dynamic') NOT NULL DEFAULT 'shared' COMMENT '部署类型',
  
  -- 共享模式配置
  max_concurrent_users INT DEFAULT 100 COMMENT '最大并发用户数',
  queue_enabled TINYINT(1) DEFAULT 0 COMMENT '是否启用排队',
  
  -- 独占模式配置
  per_user TINYINT(1) DEFAULT 0 COMMENT '是否每用户独立',
  per_contact TINYINT(1) DEFAULT 1 COMMENT '是否每联系人独立',
  idle_ttl INT DEFAULT 1800 COMMENT '空闲超时时间(秒)',
  
  -- 动态模式配置
  min_instances INT DEFAULT 1 COMMENT '最小实例数',
  max_instances INT DEFAULT 10 COMMENT '最大实例数',
  scale_up_threshold INT DEFAULT 50 COMMENT '扩容阈值',
  scale_down_threshold INT DEFAULT 10 COMMENT '缩容阈值',
  
  -- 资源配置
  cpu_limit DECIMAL(4,2) DEFAULT 0.5 COMMENT 'CPU限制(核)',
  memory_limit INT DEFAULT 512 COMMENT '内存限制(MB)',
  
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (agent_id) REFERENCES t_agents(sid),
  INDEX idx_agent_id (agent_id)
) COMMENT 'Agent部署配置表';

-- Agent 容器实例表
CREATE TABLE t_agent_container (
  sid VARCHAR(64) PRIMARY KEY,
  agent_id VARCHAR(64) NOT NULL COMMENT 'Agent ID',
  container_id VARCHAR(128) NOT NULL COMMENT 'Docker容器ID',
  container_name VARCHAR(128) NOT NULL COMMENT '容器名称',
  
  owner_id VARCHAR(64) COMMENT '独占模式: 所有者ID',
  owner_type ENUM('contact', 'user', 'none') DEFAULT 'none' COMMENT '所有者类型',
  
  status ENUM('starting', 'running', 'stopping', 'stopped', 'error') DEFAULT 'starting',
  
  -- 资源使用
  active_connections INT DEFAULT 0 COMMENT '活跃连接数',
  total_messages INT DEFAULT 0 COMMENT '处理消息总数',
  
  -- 时间戳
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  start_time DATETIME COMMENT '启动时间',
  last_active_time DATETIME COMMENT '最后活跃时间',
  stop_time DATETIME COMMENT '停止时间',
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_container_id (container_id),
  INDEX idx_owner_id (owner_id),
  INDEX idx_status (status)
) COMMENT 'Agent容器实例表';
```

### 10.7 调度流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    消息调度流程                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  用户消息                                                       │
│      │                                                          │
│      ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  1. AgentRouter.route()                                 │   │
│  │     ├── resolveContact() → contactId                    │   │
│  │     ├── resolveAgent() → agentId                        │   │
│  │     └── getAgentConfig() → deployment type              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  2. ContainerScheduler.schedule()                       │   │
│  │                                                         │   │
│  │     ┌─────────────────────────────────────────────┐     │   │
│  │     │ type = 'shared'                              │     │   │
│  │     │ ├── 查找可用共享容器                          │     │   │
│  │     │ ├── 检查并发限制                              │     │   │
│  │     │ └── 无可用 → 创建新容器                       │     │   │
│  │     └─────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  │     ┌─────────────────────────────────────────────┐     │   │
│  │     │ type = 'dedicated'                           │     │   │
│  │     │ ├── 查找用户的专属容器                        │     │   │
│  │     │ ├── 存在 → 返回容器ID                        │     │   │
│  │     │ └── 不存在 → 创建专属容器                     │     │   │
│  │     └─────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  │     ┌─────────────────────────────────────────────┐     │   │
│  │     │ type = 'dynamic'                             │     │   │
│  │     │ ├── 计算当前负载                             │     │   │
│  │     │ ├── 负载高 → 扩容                           │     │   │
│  │     │ ├── 负载低 → 选择空闲容器                    │     │   │
│  │     │ └── 达到上限 → 拒绝/排队                     │     │   │
│  │     └─────────────────────────────────────────────┘     │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼ containerId                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  3. 发送消息到容器                                       │   │
│  │     HTTP POST /message → Agent容器                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  4. Agent 容器处理                                       │   │
│  │     ├── AgentRuntime.handleMessage()                    │   │
│  │     └── 返回响应                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10.8 典型场景示例

#### 场景 1: 公共客服 Agent (共享模式)

```yaml
# t_agent_deployment 配置
agent_id: agent-customer-service
type: shared
max_concurrent_users: 50
queue_enabled: true
cpu_limit: 1.0
memory_limit: 1024

# 调度行为
# - 所有用户共享同一个容器
# - 超过50并发时排队等待
# - 单容器，无需扩容
```

#### 场景 2: VIP 专属 Agent (独占模式)

```yaml
# t_agent_deployment 配置
agent_id: agent-vip-assistant
type: dedicated
per_contact: true
idle_ttl: 3600  # 1小时无活动后销毁
cpu_limit: 0.5
memory_limit: 512

# 调度行为
# - 每个联系人创建独立容器
# - 容器命名: agent-vip-assistant-{contactId}
# - 空闲1小时后自动销毁
```

#### 场景 3: 任务型 Agent (动态模式)

```yaml
# t_agent_deployment 配置
agent_id: agent-task-processor
type: dynamic
min_instances: 1
max_instances: 10
scale_up_threshold: 20   # 平均20并发时扩容
scale_down_threshold: 5  # 平均5并发时缩容
cpu_limit: 0.5
memory_limit: 512

# 调度行为
# - 保持至少1个实例运行
# - 负载高时自动扩容到最多10个
# - 负载低时自动缩容
```

### 10.9 监控与告警

```typescript
// 调度器监控指标
interface SchedulerMetrics {
  // 容器指标
  totalContainers: number;
  runningContainers: number;
  startingContainers: number;
  
  // Agent 指标
  agentMetrics: Map<string, {
    containers: number;
    activeConnections: number;
    avgLoad: number;
  }>;
  
  // 资源指标
  totalCpuUsed: number;
  totalMemoryUsed: number;
  
  // 调度指标
  scheduleLatency: number;    // 调度延迟
  containerCreateTime: number; // 容器创建时间
  scaleUpEvents: number;      // 扩容事件数
  scaleDownEvents: number;    // 缩容事件数
}

// 告警规则
const alertRules = [
  {
    name: 'container-create-failure',
    condition: 'container_create_failures > 3 in 5m',
    severity: 'critical',
  },
  {
    name: 'high-container-count',
    condition: 'total_containers > 100',
    severity: 'warning',
  },
  {
    name: 'agent-overload',
    condition: 'agent_avg_load > 80%',
    severity: 'warning',
  },
  {
    name: 'resource-exhaustion',
    condition: 'total_memory_used > 80% of host',
    severity: 'critical',
  },
];
```

---

## 11. 参考文档

- [Agent 实例化设计](../agent/AGENT_INSTANTIATION.md)
- [Agent 运行时设计](../agent/runtime.md)
- [Gateway 架构设计](./architecture.md)
- [LLM 服务架构](../core/llm-service-architecture.md)
- [Skill 执行器设计](../system/skill-executor.md)
