# Gateway 实现任务计划

## 项目背景

基于现有 Cradle 项目实现 Gateway 通道模块，项目已使用 Fastify + TypeScript + MySQL 技术栈。

## 现有项目结构

```
cradle/
├── src/
│   ├── gateway/          # 现有 Gateway API 路由
│   ├── llm/              # LLM 配置管理
│   ├── organization/     # 组织架构
│   ├── system/           # 系统管理
│   └── store/            # 数据库连接
├── design/gateway/       # 设计文档
└── migrations/           # 数据库迁移
```

## 实现步骤

### Step 0: OpenClaw 代码提取（前置任务）
**状态**: ⏳ 待开始
**预计时间**: 2-3 小时

**任务**:
1. 提取 `normalize/` 目录代码到 `src/gateway/channels/_shared/normalize/`
   - `telegram.ts` - Telegram ID 格式标准化
   - `discord.ts` - Discord ID 格式标准化
   - `slack.ts` - Slack ID 格式标准化
   - `whatsapp.ts` - WhatsApp ID 格式标准化
   
2. 提取 `outbound/` 目录代码到 `src/gateway/channels/_shared/outbound/`
   - `telegram.ts` - Telegram 发送逻辑
   - `discord.ts` - Discord 发送逻辑
   - `slack.ts` - Slack 发送逻辑
   
3. 参考 `types.core.ts` 设计我们的消息类型
   - 提取 `MsgContext` 关键字段
   - 提取 `ChatType` 定义

**输出文件**:
- `src/gateway/channels/_shared/normalize/index.ts`
- `src/gateway/channels/_shared/outbound/index.ts`
- `src/gateway/channels/types.ts`（参考设计）

**依赖**: 无
**说明**: 从 OpenClaw 提取可复用代码，适配到我们的架构

---

### Step 1: 数据库表实现
**状态**: ⏳ 待开始
**预计时间**: 1-2 小时

**任务**:
1. 创建 `t_channels` 表 - 通道配置表
2. 创建 `r_channel_contact` 表 - Contact 通道绑定
3. 创建 `r_channel_agent` 表 - Agent 通道绑定
4. 编写数据库迁移脚本

**输出文件**:
- `migrations/20260223_channels_v1.0.sql`

**依赖**: 无

---

### Step 2: 核心类型定义
**状态**: ⏳ 待开始
**预计时间**: 1-2 小时

**任务**:
1. 定义统一消息格式 `UnifiedMessage`
2. 定义 Channel 插件接口 `ChannelPlugin`
3. 定义 Agent 调用接口 `AgentClient`
4. 定义进程间通信类型

**输出文件**:
- `src/gateway/channels/types.ts` - 通道相关类型
- `src/gateway/messages/types.ts` - 消息相关类型
- `src/gateway/agents/types.ts` - Agent 相关类型

**依赖**: Step 1

---

### Step 3: Channel 插件基类（简化版）
**状态**: ⏳ 待开始
**预计时间**: 2-3 小时

**任务**:
1. 创建简化版 `BaseChannel` 抽象类
   - 对比 OpenClaw 的 84 个适配器，精简为核心方法
   - 只保留必要方法：`parse()`, `format()`, `send()`
   
2. 实现消息解析方法 `parse()`
   - 将平台特定格式转换为 `UnifiedMessage`
   - 参考 OpenClaw `normalize/` 逻辑
   
3. 实现消息格式化方法 `format()`
   - 将 `UnifiedMessage` 转换为平台特定格式
   
4. 实现发送消息方法 `send()`
   - 调用平台 API 发送消息
   - 复用 OpenClaw `outbound/` 发送逻辑
   
5. 创建 Channel 管理器 `ChannelManager`
   - 加载和管理 Channel 插件
   - 根据 `channel_type` 路由到对应插件

**输出文件**:
- `src/gateway/channels/base.ts` - 简化基类实现
- `src/gateway/channels/manager.ts` - 管理器
- `src/gateway/channels/README.md` - 与 OpenClaw 的差异说明

**依赖**: Step 0, Step 2
**说明**: 相比 OpenClaw 的复杂插件系统，我们采用简化设计

---

### Step 4: WebUI Channel 实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 实现 `WebUIChannel` 类继承 `BaseChannel`
2. 集成 Fastify WebSocket 插件 `@fastify/websocket`
3. 实现 WebSocket 连接管理
4. 实现消息收发逻辑
5. 添加身份验证中间件

**输出文件**:
- `src/gateway/channels/webui/index.ts`
- `src/gateway/channels/webui/connection.ts`
- `src/gateway/routes/websocket.ts`

**依赖**: Step 3

---

### Step 5: DingTalk Channel 实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 实现 `DingTalkChannel` 类继承 `BaseChannel`
2. 实现 Webhook 接收端点 `/webhook/dingtalk`
3. 实现消息签名验证
4. 实现钉钉 API 调用封装
5. 处理加密消息解密

**输出文件**:
- `src/gateway/channels/dingtalk/index.ts`
- `src/gateway/channels/dingtalk/crypto.ts`
- `src/gateway/channels/dingtalk/api.ts`
- `src/gateway/routes/webhook.ts`

**依赖**: Step 3

---

### Step 6: Master 进程实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 创建 `Master` 类作为主进程入口
2. 集成消息队列（BullMQ / 内存队列）
3. 管理 Worker 进程生命周期
4. 实现 HTTP 服务器路由注册
5. 集成 Channel 插件加载

**输出文件**:
- `src/gateway/master/index.ts`
- `src/gateway/master/queue.ts`
- `src/gateway/master/worker-pool.ts`

**依赖**: Step 4, Step 5

---

### Step 7: Worker 进程实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 创建 `Worker` 类处理消息
2. 实现身份识别服务（sender → contact_id）
3. 实现路由查找服务（recipient → agent_id）
4. 实现权限校验逻辑
5. 实现 Agent 进程调用

**输出文件**:
- `src/gateway/worker/index.ts`
- `src/gateway/worker/identity.ts`
- `src/gateway/worker/routing.ts`

**依赖**: Step 6

---

### Step 8: Agent 进程实现
**状态**: ⏳ 待开始
**预计时间**: 4-5 小时

**任务**:
1. 创建 `AgentProcess` 类
2. 实现状态管理（提示词、配置）
3. 实现记忆加载和管理
4. 集成 LLM 连接池调用
5. 实现流式输出支持

**输出文件**:
- `src/gateway/agents/process.ts`
- `src/gateway/agents/memory.ts`
- `src/gateway/agents/prompt.ts`

**依赖**: Step 7

---

### Step 9: LLM 连接池实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 创建 `LLMPool` 类管理连接
2. 实现连接负载均衡
3. 实现流式生成接口
4. 支持多提供商（OpenAI/Claude/本地）
5. 实现故障转移机制

**输出文件**:
- `src/gateway/llm/pool.ts`
- `src/gateway/llm/connection.ts`
- `src/gateway/llm/stream.ts`

**依赖**: Step 8

---

### Step 10: 进程间通信实现
**状态**: ⏳ 待开始
**预计时间**: 3-4 小时

**任务**:
1. 选择 IPC 方案（Node.js cluster / gRPC / Unix Socket）
2. 实现 Worker ↔ Agent 通信
3. 实现 Agent ↔ LLM Pool 通信
4. 实现流式数据传输
5. 添加错误处理和重连机制

**输出文件**:
- `src/gateway/ipc/index.ts`
- `src/gateway/ipc/client.ts`
- `src/gateway/ipc/server.ts`

**依赖**: Step 7, Step 8, Step 9

---

### Step 11: 集成测试
**状态**: ⏳ 待开始
**预计时间**: 2-3 小时

**任务**:
1. 编写端到端测试用例
2. 测试 WebUI 消息流程
3. 测试 DingTalk Webhook 流程
4. 测试陌生人处理流程
5. 性能测试（并发、流式输出）

**输出文件**:
- `tests/gateway/integration.test.ts`
- `tests/gateway/channels/webui.test.ts`
- `tests/gateway/channels/dingtalk.test.ts`

**依赖**: Step 10

---

## 文件结构规划

```
src/gateway/
├── channels/               # Channel 插件
│   ├── base.ts            # 基类
│   ├── manager.ts         # 管理器
│   ├── types.ts           # 类型定义
│   ├── webui/             # WebUI 通道
│   │   ├── index.ts
│   │   └── connection.ts
│   └── dingtalk/          # 钉钉通道
│       ├── index.ts
│       ├── crypto.ts
│       └── api.ts
├── messages/              # 消息处理
│   ├── types.ts
│   └── queue.ts
├── agents/                # Agent 进程
│   ├── types.ts
│   ├── process.ts
│   ├── memory.ts
│   └── prompt.ts
├── worker/                # Worker 进程
│   ├── index.ts
│   ├── identity.ts
│   └── routing.ts
├── master/                # Master 进程
│   ├── index.ts
│   ├── queue.ts
│   └── worker-pool.ts
├── llm/                   # LLM 连接池
│   ├── pool.ts
│   ├── connection.ts
│   └── stream.ts
├── ipc/                   # 进程间通信
│   ├── index.ts
│   ├── client.ts
│   └── server.ts
├── routes/                # HTTP 路由
│   ├── index.ts           # 现有路由整合
│   ├── websocket.ts       # WebSocket 路由
│   └── webhook.ts         # Webhook 路由
└── index.ts               # 入口文件（更新）
```

## 依赖安装

```bash
# 通道相关
npm install @fastify/websocket

# 消息队列
npm install bullmq ioredis

# 进程间通信（可选 gRPC）
npm install @grpc/grpc-js @grpc/proto-loader

# 钉钉 SDK
npm install dingtalk-jsapi
```

## 启动命令

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm run gateway:start
```

## 当前进度

| 步骤 | 状态 | 完成时间 |
|-----|------|---------|
| Step 1 | ⏳ 待开始 | - |
| Step 2 | ⏳ 待开始 | - |
| Step 3 | ⏳ 待开始 | - |
| Step 4 | ⏳ 待开始 | - |
| Step 5 | ⏳ 待开始 | - |
| Step 6 | ⏳ 待开始 | - |
| Step 7 | ⏳ 待开始 | - |
| Step 8 | ⏳ 待开始 | - |
| Step 9 | ⏳ 待开始 | - |
| Step 10 | ⏳ 待开始 | - |
| Step 11 | ⏳ 待开始 | - |

---

**最后更新**: 2026-02-23
