# Gateway 协议设计

## 1. 协议概述

Gateway 支持两种通信协议：
- **HTTP REST API**：用于常规请求-响应模式
- **WebSocket**：用于实时双向通信

## 2. HTTP 协议

### 2.1 请求规范

**请求头**：
```http
Content-Type: application/json
Authorization: Bearer {accessToken}
X-Request-Id: {uuid}  // 可选，用于链路追踪
```

**请求体**：
```json
{
  "field1": "value1",
  "field2": "value2"
}
```

### 2.2 响应规范

**成功响应**：
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "code": 200,
  "data": { ... },
  "message": "success"
}
```

**错误响应**：
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "code": 400,
  "data": null,
  "message": "请求参数错误"
}
```

### 2.3 状态码

| HTTP 状态码 | 业务码 | 说明 |
|------------|--------|------|
| 200 | 200 | 成功 |
| 400 | 400 | 请求参数错误 |
| 401 | 401 | 未认证或 Token 过期 |
| 403 | 403 | 无权限访问 |
| 404 | 404 | 资源不存在 |
| 500 | 500 | 服务器内部错误 |

## 3. WebSocket 协议

### 3.1 连接建立

**握手请求**：
```http
GET /ws HTTP/1.1
Host: api.example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
Authorization: Bearer {accessToken}
```

**握手响应**：
```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### 3.2 消息帧格式

#### 请求帧

```typescript
interface RequestFrame {
  id: string;        // 请求唯一标识（UUID）
  method: string;    // 方法名，如 "agent.chat"
  params: unknown;   // 请求参数
}
```

**示例**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "method": "agent.chat",
  "params": {
    "agentId": "agent-001",
    "message": "你好",
    "sessionId": "session-001"
  }
}
```

#### 响应帧

```typescript
interface ResponseFrame {
  id: string;        // 对应请求ID
  result?: unknown;  // 成功结果
  error?: {          // 错误信息
    code: number;
    message: string;
    details?: unknown;
  };
}
```

**成功示例**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "messageId": "msg-001",
    "content": "你好！有什么可以帮助你的吗？",
    "timestamp": 1700000000000
  }
}
```

**错误示例**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": 404,
    "message": "Agent 不存在"
  }
}
```

#### 事件帧（服务端推送）

```typescript
interface EventFrame {
  event: string;     // 事件名
  payload: unknown;  // 事件数据
}
```

**示例**：
```json
{
  "event": "agent.message",
  "payload": {
    "sessionId": "session-001",
    "messageId": "msg-002",
    "content": "这是推送的消息",
    "timestamp": 1700000000000
  }
}
```

### 3.3 消息类型

#### 客户端发送

| 方法 | 说明 | 参数 |
|------|------|------|
| `agent.chat` | 发送对话消息 | `{ agentId, message, sessionId }` |
| `agent.chat.audio` | 发送语音消息 | `{ agentId, audioStream, sessionId, format }` |
| `agent.subscribe` | 订阅 Agent 事件 | `{ agentId }` |
| `agent.unsubscribe` | 取消订阅 | `{ agentId }` |
| `session.create` | 创建会话 | `{ agentId }` |
| `session.close` | 关闭会话 | `{ sessionId }` |
| `ping` | 心跳检测 | `{}` |

#### 服务端推送

| 事件 | 说明 | 数据 |
|------|------|------|
| `agent.message` | Agent 回复消息 | `{ sessionId, messageId, content }` |
| `agent.message.audio` | Agent 语音回复 | `{ sessionId, messageId, audioStream, format }` |
| `agent.typing` | Agent 正在输入 | `{ sessionId, isTyping }` |
| `agent.error` | Agent 错误 | `{ sessionId, error }` |
| `session.update` | 会话状态更新 | `{ sessionId, status }` |
| `pong` | 心跳响应 | `{ timestamp }` |

### 3.4 语音流协议

#### 3.4.1 语音流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      语音交互流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   客户端                    WebSocket                    服务端  │
│      │                        │                           │     │
│      │  1. 开始语音输入        │                           │     │
│      │ ─────────────────────→ │                           │     │
│      │                        │                           │     │
│      │  2. 音频流分片传输      │                           │     │
│      │ ═════════════════════→ │  3. 实时语音识别(ASR)      │     │
│      │ (binary/opus chunks)   │ ───────────────────────→  │     │
│      │                        │                           │     │
│      │  4. 语音结束标记        │                           │     │
│      │ ─────────────────────→ │  5. 文本送入LLM            │     │
│      │                        │ ───────────────────────→  │     │
│      │  8. 播放语音回复        │  7. TTS生成音频流          │     │
│      │ ←═════════════════════ │ ←───────────────────────  │     │
│      │ (binary/opus stream)   │                           │     │
│      │                        │                           │     │
└─────────────────────────────────────────────────────────────────┘
```

#### 3.4.2 音频格式支持

| 格式 | 编码 | 采样率 | 用途 | 优先级 |
|-----|------|-------|------|-------|
| Opus | OPUS | 48kHz | 实时通话 | 高 |
| AAC | AAC-LC | 44.1kHz | 高质量音频 | 中 |
| PCM | PCM-S16LE | 16kHz | 语音识别 | 高 |
| MP3 | MP3 | 44.1kHz | 兼容性 | 低 |

#### 3.4.3 语音流帧格式

**音频数据帧（客户端 → 服务端）**：

```typescript
interface AudioStreamFrame extends BaseFrame {
  msgType: 'stream';
  streamType: 'audio_input';
  payload: {
    sessionId: string;        // 会话ID
    streamId: string;         // 音频流ID
    sequence: number;         // 序列号（用于排序和丢包检测）
    timestamp: number;        // 时间戳（毫秒）
    format: AudioFormat;      // 音频格式
    data: ArrayBuffer;        // 音频数据（二进制）
    isLast: boolean;          // 是否为最后一片
  };
}

interface AudioFormat {
  codec: 'opus' | 'aac' | 'pcm' | 'mp3';
  sampleRate: number;         // 采样率
  channels: number;           // 声道数
  bitrate?: number;           // 比特率
}

// 示例：Opus音频流帧
{
  "msgId": "audio-001",
  "msgType": "stream",
  "timestamp": 1704067200000,
  "version": "1.0",
  "streamType": "audio_input",
  "payload": {
    "sessionId": "session-001",
    "streamId": "stream-001",
    "sequence": 1,
    "timestamp": 1704067200000,
    "format": {
      "codec": "opus",
      "sampleRate": 48000,
      "channels": 1,
      "bitrate": 24000
    },
    "data": "<base64-encoded-opus-data>",
    "isLast": false
  }
}
```

**音频输出帧（服务端 → 客户端）**：

```typescript
interface AudioOutputFrame extends BaseFrame {
  msgType: 'stream';
  streamType: 'audio_output';
  payload: {
    sessionId: string;
    messageId: string;        // 关联的消息ID
    streamId: string;
    sequence: number;
    timestamp: number;
    format: AudioFormat;
    data: ArrayBuffer;
    isLast: boolean;
    text?: string;            // 对应的文本内容（可选）
  };
}

// 示例：TTS音频输出帧
{
  "msgId": "tts-001",
  "msgType": "stream",
  "timestamp": 1704067201000,
  "version": "1.0",
  "streamType": "audio_output",
  "payload": {
    "sessionId": "session-001",
    "messageId": "msg-001",
    "streamId": "tts-stream-001",
    "sequence": 1,
    "timestamp": 1704067201000,
    "format": {
      "codec": "opus",
      "sampleRate": 48000,
      "channels": 1,
      "bitrate": 24000
    },
    "data": "<base64-encoded-opus-data>",
    "isLast": false,
    "text": "你好，有什么可以帮助你的吗？"
  }
}
```

#### 3.4.4 语音控制帧

**开始语音输入**：

```typescript
interface StartAudioInputFrame extends BaseFrame {
  msgType: 'request';
  method: 'audio.start_input';
  params: {
    sessionId: string;
    config: {
      format: AudioFormat;      // 音频格式
      language?: string;        // 语言（如 'zh-CN', 'en-US'）
      vad?: boolean;            // 是否启用语音活动检测
      interimResults?: boolean; // 是否返回中间识别结果
    };
  };
}

// 示例
{
  "msgId": "start-audio-001",
  "msgType": "request",
  "timestamp": 1704067200000,
  "version": "1.0",
  "method": "audio.start_input",
  "params": {
    "sessionId": "session-001",
    "config": {
      "format": {
        "codec": "opus",
        "sampleRate": 48000,
        "channels": 1
      },
      "language": "zh-CN",
      "vad": true,
      "interimResults": true
    }
  }
}
```

**停止语音输入**：

```typescript
interface StopAudioInputFrame extends BaseFrame {
  msgType: 'request';
  method: 'audio.stop_input';
  params: {
    sessionId: string;
    streamId: string;
  };
}
```

**语音识别结果（服务端推送）**：

```typescript
interface SpeechRecognitionResult extends BaseFrame {
  msgType: 'event';
  event: 'audio.recognition_result';
  payload: {
    sessionId: string;
    streamId: string;
    isFinal: boolean;         // 是否为最终结果
    text: string;             // 识别文本
    confidence?: number;      // 置信度
    alternatives?: string[];  // 备选文本
  };
}

// 示例：中间结果
{
  "msgId": "asr-001",
  "msgType": "event",
  "timestamp": 1704067200500,
  "version": "1.0",
  "event": "audio.recognition_result",
  "payload": {
    "sessionId": "session-001",
    "streamId": "stream-001",
    "isFinal": false,
    "text": "你好",
    "confidence": 0.85
  }
}

// 示例：最终结果
{
  "msgId": "asr-002",
  "msgType": "event",
  "timestamp": 1704067201000,
  "version": "1.0",
  "event": "audio.recognition_result",
  "payload": {
    "sessionId": "session-001",
    "streamId": "stream-001",
    "isFinal": true,
    "text": "你好，请帮我查一下今天的天气",
    "confidence": 0.92,
    "alternatives": ["你好，请帮我查一下今天的天气情况"]
  }
}
```

#### 3.4.5 语音流控制

**流控制帧**：

```typescript
// 暂停音频输出
interface PauseAudioFrame extends BaseFrame {
  msgType: 'request';
  method: 'audio.pause';
  params: {
    sessionId: string;
    streamId: string;
  };
}

// 恢复音频输出
interface ResumeAudioFrame extends BaseFrame {
  msgType: 'request';
  method: 'audio.resume';
  params: {
    sessionId: string;
    streamId: string;
  };
}

// 停止音频输出
interface StopAudioFrame extends BaseFrame {
  msgType: 'request';
  method: 'audio.stop';
  params: {
    sessionId: string;
    streamId: string;
  };
}
```

#### 3.4.6 语音流性能优化

| 优化策略 | 说明 | 实现方式 |
|---------|------|---------|
| 分片传输 | 音频数据分片发送 | 每片20-40ms音频 |
| 自适应码率 | 根据网络状况调整 | 动态调整Opus码率 |
| 抖动缓冲 | 平滑网络抖动 | 客户端缓冲100-200ms |
| 丢包恢复 | 处理网络丢包 | FEC前向纠错 |
| 回声消除 | 消除扬声器回声 | AEC算法 |
| 降噪处理 | 消除背景噪音 | NS降噪算法 |

**音频流参数推荐**：

| 场景 | 编码 | 采样率 | 分片大小 | 延迟 |
|-----|------|-------|---------|------|
| 实时对话 | Opus | 48kHz | 20ms | <200ms |
| 语音识别 | PCM | 16kHz | 100ms | <300ms |
| 高质量播放 | AAC | 44.1kHz | 40ms | <500ms |

### 3.4 心跳机制

**客户端心跳**：
```json
{
  "id": "ping-001",
  "method": "ping",
  "params": {}
}
```

**服务端响应**：
```json
{
  "event": "pong",
  "payload": {
    "timestamp": 1700000000000
  }
}
```

**心跳间隔**：30秒
**超时时间**：60秒（未收到心跳则断开连接）

### 3.5 消息帧完整格式定义

#### 消息帧基础结构

所有WebSocket消息都使用JSON格式，包含以下基础字段：

```typescript
// 消息类型枚举
type MessageType = 'request' | 'response' | 'event' | 'ack' | 'ping' | 'pong';

// 基础消息帧
interface BaseFrame {
  msgId: string;           // 消息唯一标识（UUID v4）
  msgType: MessageType;    // 消息类型
  timestamp: number;       // 发送时间戳（毫秒）
  version: string;         // 协议版本，默认 "1.0"
}
```

#### 请求帧（RequestFrame）

客户端发送的请求消息：

```typescript
interface RequestFrame extends BaseFrame {
  msgType: 'request';
  method: string;          // 请求方法，格式："service.action"
  params: RequestParams;   // 请求参数
  headers?: {              // 可选请求头
    'X-Request-Id'?: string;
    'X-Idempotency-Key'?: string;  // 幂等性键
  };
  timeout?: number;        // 超时时间（毫秒），默认30000
}

// 请求参数类型
interface RequestParams {
  [key: string]: unknown;
}

// 示例：Agent对话请求
{
  "msgId": "550e8400-e29b-41d4-a716-446655440000",
  "msgType": "request",
  "timestamp": 1704067200000,
  "version": "1.0",
  "method": "agent.chat",
  "params": {
    "agentId": "agent-001",
    "message": "你好",
    "sessionId": "session-001",
    "context": {
      "messageId": "msg-prev-001"
    }
  },
  "headers": {
    "X-Idempotency-Key": "idem-001"
  },
  "timeout": 60000
}
```

#### 响应帧（ResponseFrame）

服务端返回的响应消息：

```typescript
interface ResponseFrame extends BaseFrame {
  msgType: 'response';
  requestId: string;       // 对应请求的msgId
  status: 'success' | 'error' | 'timeout';
  data?: unknown;          // 成功时返回的数据
  error?: ErrorInfo;       // 错误时返回的错误信息
  metadata?: {             // 响应元数据
    processingTime?: number;  // 处理耗时（毫秒）
    model?: string;           // 使用的模型
    tokens?: TokenUsage;      // Token使用情况
  };
}

// 错误信息
interface ErrorInfo {
  code: number;            // 错误码
  message: string;         // 错误消息
  details?: unknown;       // 详细错误信息
  stack?: string;          // 错误堆栈（仅开发环境）
}

// Token使用统计
interface TokenUsage {
  input: number;
  output: number;
  cache?: number;
}

// 示例：成功响应
{
  "msgId": "660e8400-e29b-41d4-a716-446655440001",
  "msgType": "response",
  "timestamp": 1704067200500,
  "version": "1.0",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "success",
  "data": {
    "messageId": "msg-001",
    "content": "你好！有什么可以帮助你的吗？",
    "contentType": "text",
    "timestamp": 1704067200500
  },
  "metadata": {
    "processingTime": 500,
    "model": "gpt-4",
    "tokens": {
      "input": 50,
      "output": 20
    }
  }
}

// 示例：错误响应
{
  "msgId": "660e8400-e29b-41d4-a716-446655440002",
  "msgType": "response",
  "timestamp": 1704067200500,
  "version": "1.0",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "error",
  "error": {
    "code": 404,
    "message": "Agent不存在",
    "details": {
      "agentId": "agent-001"
    }
  }
}
```

#### 事件帧（EventFrame）

服务端主动推送的事件消息：

```typescript
interface EventFrame extends BaseFrame {
  msgType: 'event';
  event: string;           // 事件类型
  payload: EventPayload;   // 事件数据
  target?: {               // 事件目标（用于过滤）
    userId?: string;
    sessionId?: string;
    agentId?: string;
  };
}

// 事件数据类型
interface EventPayload {
  [key: string]: unknown;
}

// 示例：Agent消息事件
{
  "msgId": "770e8400-e29b-41d4-a716-446655440003",
  "msgType": "event",
  "timestamp": 1704067201000,
  "version": "1.0",
  "event": "agent.message",
  "payload": {
    "sessionId": "session-001",
    "messageId": "msg-002",
    "content": "这是推送的消息",
    "contentType": "text",
    "timestamp": 1704067201000
  },
  "target": {
    "sessionId": "session-001"
  }
}

// 示例：Agent打字中事件
{
  "msgId": "880e8400-e29b-41d4-a716-446655440004",
  "msgType": "event",
  "timestamp": 1704067201500,
  "version": "1.0",
  "event": "agent.typing",
  "payload": {
    "sessionId": "session-001",
    "isTyping": true,
    "timestamp": 1704067201500
  }
}
```

#### 确认帧（AckFrame）

用于消息确认和幂等性控制：

```typescript
interface AckFrame extends BaseFrame {
  msgType: 'ack';
  originalMsgId: string;   // 被确认的消息ID
  status: 'received' | 'processed' | 'failed';
  retryCount?: number;     // 重试次数
}

// 示例：消息确认
{
  "msgId": "990e8400-e29b-41d4-a716-446655440005",
  "msgType": "ack",
  "timestamp": 1704067202000,
  "version": "1.0",
  "originalMsgId": "770e8400-e29b-41d4-a716-446655440003",
  "status": "received"
}
```

### 3.6 心跳机制详细设计

#### 心跳帧格式

```typescript
// 客户端心跳（ping）
interface PingFrame extends BaseFrame {
  msgType: 'ping';
  payload?: {
    lastEventId?: string;  // 最后接收到的事件ID（用于断线重连）
  };
}

// 服务端响应（pong）
interface PongFrame extends BaseFrame {
  msgType: 'pong';
  payload: {
    serverTime: number;    // 服务端时间戳
    connectionId: string;  // 连接ID
    missedEvents?: EventFrame[];  // 断线期间遗漏的事件
  };
}

// 示例：心跳请求
{
  "msgId": "ping-001",
  "msgType": "ping",
  "timestamp": 1704067230000,
  "version": "1.0",
  "payload": {
    "lastEventId": "770e8400-e29b-41d4-a716-446655440003"
  }
}

// 示例：心跳响应
{
  "msgId": "pong-001",
  "msgType": "pong",
  "timestamp": 1704067230100,
  "version": "1.0",
  "payload": {
    "serverTime": 1704067230100,
    "connectionId": "conn-001",
    "missedEvents": []
  }
}
```

#### 心跳策略

| 参数 | 值 | 说明 |
|-----|---|------|
| 心跳间隔 | 30秒 | 客户端每30秒发送一次ping |
| 心跳超时 | 60秒 | 服务端60秒未收到ping则断开 |
| 重试间隔 | 5秒 | 心跳失败后的重试间隔 |
| 最大重试 | 3次 | 连续3次失败触发重连 |

```
心跳流程：
┌──────────┐      ping       ┌──────────┐
│  客户端   │ ─────────────→ │  服务端   │
│          │                │          │
│  启动定时器│                │  重置超时 │
│  (30s)   │                │  (60s)   │
│          │                │          │
│          │ ←───────────── │          │
│  收到pong │     pong       │  发送pong │
│  继续等待 │                │          │
└──────────┘                └──────────┘
      ↓
  超时未收到pong
      ↓
  重试（最多3次）
      ↓
  触发重连
```

### 3.7 重连策略

#### 重连触发条件

1. **心跳超时**：连续3次心跳失败
2. **连接异常**：网络断开、服务器关闭连接
3. **错误响应**：收到特定错误码（如1001-服务器重启）

#### 重连流程

```
连接断开
    ↓
触发重连策略
    ↓
┌─────────────────────────────────────────┐
│ 1. 指数退避重试                          │
│    - 第1次：立即重连                     │
│    - 第2次：等待1秒后重连                │
│    - 第3次：等待2秒后重连                │
│    - 第4次：等待4秒后重连                │
│    - 第5次：等待8秒后重连                │
│    - 最大间隔：30秒                      │
└─────────────────────────────────────────┘
    ↓
重连成功？
    ↓
是 → 发送重连请求（携带lastEventId）
    ↓
否 → 达到最大重试次数（10次）→ 通知用户手动刷新
```

#### 重连请求

```typescript
interface ReconnectRequest extends BaseFrame {
  msgType: 'request';
  method: 'connection.reconnect';
  params: {
    lastEventId: string;      // 最后接收到的事件ID
    connectionId?: string;    // 之前的连接ID（可选）
    subscriptions: string[];  // 需要重新订阅的Agent列表
  };
}

// 示例：重连请求
{
  "msgId": "reconn-001",
  "msgType": "request",
  "timestamp": 1704067300000,
  "version": "1.0",
  "method": "connection.reconnect",
  "params": {
    "lastEventId": "770e8400-e29b-41d4-a716-446655440003",
    "connectionId": "conn-001",
    "subscriptions": ["agent-001", "agent-002"]
  }
}
```

#### 重连响应

```typescript
interface ReconnectResponse extends ResponseFrame {
  data: {
    connectionId: string;           // 新连接ID
    missedEvents: EventFrame[];     // 断线期间遗漏的事件
    currentSubscriptions: string[]; // 当前订阅列表
    serverTime: number;             // 服务端时间
  };
}

// 示例：重连响应
{
  "msgId": "reconn-resp-001",
  "msgType": "response",
  "timestamp": 1704067300100,
  "version": "1.0",
  "requestId": "reconn-001",
  "status": "success",
  "data": {
    "connectionId": "conn-002",
    "missedEvents": [
      {
        "msgId": "880e8400-e29b-41d4-a716-446655440004",
        "msgType": "event",
        "timestamp": 1704067250000,
        "version": "1.0",
        "event": "agent.message",
        "payload": {
          "sessionId": "session-001",
          "messageId": "msg-003",
          "content": "断线期间的消息"
        }
      }
    ],
    "currentSubscriptions": ["agent-001", "agent-002"],
    "serverTime": 1704067300100
  }
}
```

### 3.8 消息确认和幂等性处理

#### 消息确认机制

**确认级别**：

| 级别 | 说明 | 使用场景 |
|-----|------|---------|
| at-most-once | 最多一次，不保证送达 | 日志、监控数据 |
| at-least-once | 至少一次，可能重复 | 普通消息 |
| exactly-once | 恰好一次，保证幂等 | 金融交易、状态变更 |

**确认流程**：

```
客户端发送消息
    ↓
服务端接收 → 发送ack(received)
    ↓
服务端处理 → 发送ack(processed)
    ↓
客户端收到ack
```

#### 幂等性保证

**幂等性键（Idempotency Key）**：

```typescript
// 客户端生成幂等性键
const idempotencyKey = `${userId}-${method}-${timestamp}-${sequence}`;

// 请求头中携带
{
  "msgId": "req-001",
  "msgType": "request",
  "method": "agent.chat",
  "headers": {
    "X-Idempotency-Key": "user-001-agent.chat-1704067200000-001"
  }
}
```

**服务端幂等性处理**：

```typescript
// 幂等性检查
async function handleRequest(frame: RequestFrame): Promise<ResponseFrame> {
  const idempotencyKey = frame.headers?.['X-Idempotency-Key'];
  
  if (idempotencyKey) {
    // 检查是否已处理
    const cached = await idempotencyCache.get(idempotencyKey);
    if (cached) {
      // 返回缓存的结果
      return cached.response;
    }
  }
  
  // 执行业务逻辑
  const response = await executeBusinessLogic(frame);
  
  // 缓存结果（24小时）
  if (idempotencyKey) {
    await idempotencyCache.set(idempotencyKey, {
      request: frame,
      response: response
    }, 24 * 60 * 60);
  }
  
  return response;
}
```

**幂等性键存储**：

```sql
CREATE TABLE t_idempotency_key (
    key_hash VARCHAR(64) PRIMARY KEY COMMENT '幂等性键哈希（SHA-256）',
    key_value VARCHAR(255) NOT NULL COMMENT '原始键值',
    request_id VARCHAR(36) NOT NULL COMMENT '请求ID',
    response_data JSON COMMENT '响应数据',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    expire_at DATETIME NOT NULL COMMENT '过期时间',
    
    INDEX idx_expire_at (expire_at)
) ENGINE=InnoDB COMMENT='幂等性键存储';
```

### 3.9 广播/多播机制

#### 广播类型

| 类型 | 目标 | 示例 |
|-----|------|------|
| 单播（Unicast） | 单个连接 | 用户A的消息回复 |
| 多播（Multicast） | 指定用户的所有连接 | 多端同步 |
| 广播（Broadcast） | 所有在线用户 | 系统公告 |
| 组播（Groupcast） | 订阅特定Agent的用户 | Agent消息推送 |

#### 广播帧格式

```typescript
interface BroadcastFrame extends EventFrame {
  msgType: 'event';
  broadcast: {
    type: 'unicast' | 'multicast' | 'broadcast' | 'groupcast';
    targets: string[];       // 目标ID列表
    exclude?: string[];      // 排除的连接ID
  };
}

// 示例：组播（Agent消息推送给所有订阅者）
{
  "msgId": "bc-001",
  "msgType": "event",
  "timestamp": 1704067400000,
  "version": "1.0",
  "event": "agent.message",
  "payload": {
    "agentId": "agent-001",
    "message": "广播消息"
  },
  "broadcast": {
    "type": "groupcast",
    "targets": ["agent-001"],  // 订阅了agent-001的用户
    "exclude": []              // 不排除任何人
  }
}
```

#### 广播实现

```typescript
class BroadcastManager {
  // 单播
  unicast(connectionId: string, event: EventFrame): void {
    const conn = connectionPool.get(connectionId);
    if (conn && conn.status === 'active') {
      conn.send(event);
    }
  }
  
  // 多播（给指定用户的所有连接）
  multicast(userId: string, event: EventFrame): void {
    const connectionIds = userConnectionMap.get(userId);
    if (!connectionIds) return;
    
    for (const connId of connectionIds) {
      this.unicast(connId, event);
    }
  }
  
  // 广播（所有在线用户）
  broadcast(event: EventFrame, exclude?: string[]): void {
    for (const [connId, conn] of connectionPool.connections) {
      if (exclude?.includes(connId)) continue;
      if (conn.status === 'active') {
        conn.send(event);
      }
    }
  }
  
  // 组播（订阅特定Agent的用户）
  groupcast(agentId: string, event: EventFrame): void {
    const subscriberIds = agentSubscriberMap.get(agentId);
    if (!subscriberIds) return;
    
    for (const userId of subscriberIds) {
      this.multicast(userId, event);
    }
  }
}
```

### 3.10 连接管理

#### 3.5.1 连接池管理

```
┌─────────────────────────────────────────────────────────────────┐
│                     WebSocket 连接池                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ 连接池管理器 │    │  连接对象    │    │  会话管理    │         │
│  │ ConnPool    │───→│ Connection  │───→│  Session    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                  │                  │                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ 用户连接映射 │    │ 心跳检测器   │    │ 消息队列     │         │
│  │ userConnMap │    │ Heartbeat   │    │ MsgQueue    │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**连接池结构**：
```typescript
interface ConnectionPool {
  // 连接存储
  connections: Map<string, WebSocketConnection>;
  
  // 用户连接映射（一个用户可能有多个连接）
  userConnections: Map<string, Set<string>>;
  
  // Agent订阅映射
  agentSubscribers: Map<string, Set<string>>;
  
  // 统计信息
  stats: PoolStats;
}

interface WebSocketConnection {
  id: string;                    // 连接唯一ID
  socket: WebSocket;             // WebSocket实例
  userId: string;                // 关联用户ID
  sessionId: string;             // 会话ID
  connectedAt: number;           // 连接时间
  lastPingAt: number;            // 最后心跳时间
  subscribedAgents: Set<string>; // 订阅的Agent列表
  status: 'active' | 'closing' | 'closed';
}
```

#### 3.5.2 最大连接数限制

| 限制类型 | 默认值 | 说明 |
|---------|-------|------|
| 全局最大连接数 | 10000 | 单实例最大并发连接 |
| 单用户最大连接数 | 5 | 防止单个用户占用过多资源 |
| 单IP最大连接数 | 10 | 防止DDoS攻击 |
| 单Agent最大订阅数 | 100 | 防止单个Agent消息风暴 |

**连接数超限处理**：
```typescript
// 连接数检查
function checkConnectionLimit(userId: string, clientIp: string): boolean {
  // 检查全局连接数
  if (pool.connections.size >= MAX_GLOBAL_CONNECTIONS) {
    throw new Error('服务器连接数已满，请稍后重试');
  }
  
  // 检查单用户连接数
  const userConnCount = pool.userConnections.get(userId)?.size || 0;
  if (userConnCount >= MAX_USER_CONNECTIONS) {
    // 关闭最早的连接（LRU策略）
    closeOldestConnection(userId);
  }
  
  // 检查单IP连接数
  const ipConnCount = getIpConnectionCount(clientIp);
  if (ipConnCount >= MAX_IP_CONNECTIONS) {
    throw new Error('该IP连接数过多，请稍后重试');
  }
  
  return true;
}
```

#### 3.5.3 连接超时处理

**超时类型**：

| 超时类型 | 时间 | 处理方式 |
|---------|------|---------|
| 握手超时 | 10秒 | 关闭连接 |
| 心跳超时 | 60秒 | 发送ping，无响应则关闭 |
| 空闲超时 | 300秒 | 关闭空闲连接 |
| 消息发送超时 | 30秒 | 重试或关闭 |

**超时处理流程**：
```
连接建立
    ↓
启动握手超时计时器（10s）
    ↓
握手成功 → 启动心跳检测
    ↓
每30秒发送ping
    ↓
60秒内未收到pong → 标记为超时
    ↓
尝试重连（最多3次）
    ↓
重连失败 → 清理连接资源
```

#### 3.5.4 消息队列（离线消息）

**消息队列架构**：
```
┌─────────────────────────────────────────────────────────────┐
│                     消息队列系统                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   在线消息                    离线消息                       │
│      │                          │                          │
│      ▼                          ▼                          │
│  ┌─────────┐              ┌─────────┐                      │
│  │ 直接推送 │              │ 消息队列 │                      │
│  └─────────┘              └────┬────┘                      │
│                                │                           │
│                                ▼                           │
│                         ┌─────────────┐                    │
│                         │  Redis/RabbitMQ                 │
│                         └──────┬──────┘                    │
│                                │                           │
│                                ▼                           │
│                         ┌─────────────┐                    │
│                         │  用户重连时  │                    │
│                         │  拉取离线消息│                    │
│                         └─────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**离线消息存储**：
```typescript
interface OfflineMessage {
  id: string;              // 消息ID
  userId: string;          // 目标用户ID
  event: string;           // 事件类型
  payload: unknown;        // 消息内容
  createdAt: number;       // 创建时间
  expireAt: number;        // 过期时间（默认7天）
  retryCount: number;      // 重试次数
}

// 存储策略
const OFFLINE_MESSAGE_CONFIG = {
  maxQueueSize: 100,        // 单个用户最大离线消息数
  ttl: 7 * 24 * 60 * 60,    // 离线消息保留7天
  batchSize: 50,            // 批量拉取数量
  priority: ['agent.message', 'session.update', 'agent.error']
};
```

**离线消息处理流程**：
```
用户连接断开
    ↓
标记用户为离线状态
    ↓
新消息到达
    ↓
检查用户在线状态
    ↓
离线 → 存入离线消息队列
    ↓
用户重新连接
    ↓
拉取离线消息（按时间排序）
    ↓
推送至客户端
    ↓
客户端确认接收 → 删除离线消息
```

#### 3.5.5 广播机制实现

**广播类型**：

| 广播类型 | 说明 | 使用场景 |
|---------|------|---------|
| 全局广播 | 所有在线用户 | 系统通知 |
| 用户广播 | 指定用户的所有连接 | 多端同步 |
| Agent广播 | 订阅该Agent的所有用户 | Agent消息推送 |
| 会话广播 | 会话中的所有参与者 | 群聊消息 |

**广播实现**：
```typescript
interface BroadcastService {
  // 全局广播
  broadcastAll(event: string, payload: unknown): void;
  
  // 向指定用户广播（多端同步）
  broadcastToUser(userId: string, event: string, payload: unknown): void;
  
  // 向Agent订阅者广播
  broadcastToAgent(agentId: string, event: string, payload: unknown): void;
  
  // 向会话参与者广播
  broadcastToSession(sessionId: string, event: string, payload: unknown): void;
}

// 广播实现示例
class BroadcastServiceImpl implements BroadcastService {
  broadcastToAgent(agentId: string, event: string, payload: unknown): void {
    const subscriberIds = pool.agentSubscribers.get(agentId);
    if (!subscriberIds) return;
    
    const message = JSON.stringify({ event, payload });
    
    for (const connId of subscriberIds) {
      const conn = pool.connections.get(connId);
      if (conn && conn.status === 'active') {
        try {
          conn.socket.send(message);
        } catch (error) {
          // 发送失败，转为离线消息
          this.saveOfflineMessage(conn.userId, event, payload);
        }
      } else {
        // 连接不可用，转为离线消息
        this.saveOfflineMessage(conn?.userId, event, payload);
      }
    }
  }
}
```

**广播性能优化**：
```
┌─────────────────────────────────────────────────────────────┐
│                    广播优化策略                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 消息合并                                                │
│     - 短时间内相同类型的消息合并发送                          │
│     - 减少网络开销                                          │
│                                                             │
│  2. 批量发送                                                │
│     - 使用WebSocket二进制帧批量发送                          │
│     - 减少帧头开销                                          │
│                                                             │
│  3. 优先级队列                                              │
│     - 高优先级消息优先发送                                   │
│     - 避免重要消息被阻塞                                     │
│                                                             │
│  4. 限流控制                                                │
│     - 单连接每秒最多100条消息                                │
│     - 防止消息风暴                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 4. 数据类型定义

### 4.1 基础类型

```typescript
// 分页参数
interface PaginationParams {
  page?: number;      // 页码，默认1
  pageSize?: number;  // 每页条数，默认10
}

// 分页结果
interface PaginationResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 时间范围
interface TimeRange {
  startTime?: string;  // ISO 8601 格式
  endTime?: string;
}
```

### 4.2 业务类型

```typescript
// 用户信息
interface UserInfo {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  status: number;
}

// Agent 信息
interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  status: 'active' | 'inactive';
}

// 消息
interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}
```

## 5. 错误码定义

### 5.1 通用错误码

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 401001 | Token 已过期 |
| 401002 | Token 无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |
| 503 | 服务不可用 |

### 5.2 业务错误码

| 错误码 | 说明 |
|--------|------|
| 400001 | 用户名或密码错误 |
| 400002 | 账号已停用 |
| 400003 | 验证码错误 |
| 404001 | 用户不存在 |
| 404002 | Agent 不存在 |
| 404003 | 会话不存在 |

## 6. 安全规范

### 6.1 认证要求

| 接口类型 | 认证要求 |
|---------|---------|
| `/api/auth/*` | 无需认证（除 logout） |
| `/api/*` | 需要 AccessToken |
| `/ws` | 需要 AccessToken（通过 Header 或 Query） |

### 6.2 传输安全

- 强制使用 HTTPS/WSS
- Token 不存储在 URL 中
- 敏感信息加密传输

## 7. 关联文档

- [架构设计](./architecture.md)
- [路由设计](./routing.md)
- [认证授权](./auth.md)
