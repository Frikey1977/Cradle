# 对话日志层设计

## 1. 功能定位

对话日志层是四层记忆系统的第一层，负责存储原始对话完整记录。它支持审计、数据恢复和对话追溯，是所有记忆数据的基础来源。

## 2. 核心作用

| 维度 | 说明 |
|------|------|
| 完整记录 | 保存原始对话的完整内容 |
| 审计支持 | 支持对话审计和合规检查 |
| 数据恢复 | 支持从原始数据恢复记忆 |
| 对话追溯 | 支持按时间、会话检索对话 |

## 3. 存储设计

### 3.1 存储路径

所有对话统一按 Agent 存储，不再按用户隔离：

```
workspace/{agent_id}/conversation/
├── 2026/                        # 2026年目录
│   ├── 2026-01-15.log           # 日志文件
│   ├── 2026-01-16.log
│   └── ...
├── 2025/                        # 2025年目录
│   └── ...
└── 2024/                        # 2024年目录
    └── ...
```

**核心原则**：
- 文件创建时直接根据年份放入对应目录
- 所有用户（包括不同员工）的对话统一存储
- 位置永不改变

### 3.2 存储策略

| 阶段 | 存储方式 | 说明 |
|------|---------|------|
| 写入 | 原始文本 | 按日期直接写入日志文件 |

## 4. 日志格式

### 4.1 文件命名

**格式**: `YYYY-MM-DD.log`

**示例**: `2026-01-15.log`

### 4.2 内容格式

每行一条 JSON 记录：

```json
{
  "timestamp": "2026-01-15T09:30:00.123Z",
  "session_id": "sess_abc123",
  "channel": "dingtalk",
  "speaker": {
    "type": "USER",
    "user_id": "user_001",
    "user_name": "张三"
  },
  "message": {
    "message_id": "msg_001",
    "content": "帮我查询上个月的销售数据",
    "content_type": "text"
  },
  "metadata": {
    "client_info": {}
  }
}
```

### 4.3 Schema 定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| timestamp | string | 是 | ISO 8601 时间戳 |
| session_id | string | 是 | 会话标识 |
| channel | string | 是 | 通道：dingtalk/wechat/web/api |
| speaker | object | 是 | 发言人信息 |
| speaker.type | string | 是 | 类型：USER/AGENT/SKILL/SYSTEM |
| speaker.user_id | string | 条件 | USER 类型时必填 |
| speaker.user_name | string | 否 | 用户显示名 |
| speaker.agent_id | string | 条件 | AGENT 类型时必填 |
| message | object | 是 | 消息内容 |
| message.message_id | string | 是 | 消息唯一标识 |
| message.content | string | 是 | 消息内容 |
| message.content_type | string | 是 | 类型：text/image/file/markdown |
| metadata | object | 否 | 扩展元数据 |

### 4.4 消息类型说明

| speaker.type | 说明 | 示例 |
|--------------|------|------|
| USER | 用户消息 | 员工发送的文本 |
| AGENT | Agent消息 | Agent 发出的内容 |
| SKILL | 技能调用 | 调用外部工具或API |
| SYSTEM | 系统消息 | 会话开始、结束等 |

### 4.5 日志示例

```json
{"timestamp":"2026-01-15T09:30:00.123Z","session_id":"sess_abc123","channel":"dingtalk","speaker":{"type":"USER","user_id":"user_001","user_name":"张三"},"message":{"message_id":"msg_001","content":"帮我查询上个月的销售数据","content_type":"text"},"metadata":{}}
{"timestamp":"2026-01-15T09:30:02.789Z","session_id":"sess_abc123","channel":"dingtalk","speaker":{"type":"SKILL"},"message":{"message_id":"msg_003","content":"调用 database.query","content_type":"skill_call","metadata":{"skill":"database.query","params":{"sql":"SELECT * FROM sales WHERE month = '2025-12'"}}},"metadata":{}}
{"timestamp":"2026-01-15T09:30:05.012Z","session_id":"sess_abc123","channel":"dingtalk","speaker":{"type":"AGENT","agent_id":"agent_001"},"message":{"message_id":"msg_004","content":"查询完成，上个月销售额为 1,234,567 元","content_type":"text","metadata":{"tokens_used":150,"latency_ms":3200}},"metadata":{}}
{"timestamp":"2026-01-15T14:20:00.456Z","session_id":"sess_def456","channel":"wechat","speaker":{"type":"USER","user_id":"user_002","user_name":"李四"},"message":{"message_id":"msg_010","content":"帮我生成周报","content_type":"text"},"metadata":{}}
{"timestamp":"2026-01-15T14:20:15.789Z","session_id":"sess_def456","channel":"wechat","speaker":{"type":"AGENT","agent_id":"agent_001"},"message":{"message_id":"msg_011","content":"好的，正在为您生成本周工作周报...","content_type":"text"},"metadata":{}}
```

## 5. 接口设计

### 5.1 日志写入接口

```typescript
interface ConversationLogger {
  write(agentId: string, entry: LogEntry): Promise<void>;
  flush(): Promise<void>;
}

interface LogEntry {
  timestamp: string;
  sessionId: string;
  channel: 'dingtalk' | 'wechat' | 'web' | 'api';
  speaker: {
    type: 'USER' | 'AGENT' | 'SKILL' | 'SYSTEM';
    userId?: string;
    userName?: string;
    agentId?: string;
  };
  message: {
    messageId: string;
    content: string;
    contentType: string;
    metadata?: Record<string, any>;
  };
  metadata?: Record<string, any>;
}
```

### 5.2 日志读取接口

```typescript
interface ConversationReader {
  // 按日期读取
  byDate(agentId: string, date: string): Promise<LogEntry[]>;
  
  // 按日期范围读取
  byDateRange(agentId: string, startDate: string, endDate: string): Promise<LogEntry[]>;
  
  // 按会话读取
  bySession(agentId: string, sessionId: string): Promise<LogEntry[]>;
}
```

## 6. 员工交接场景

### 6.1 场景说明

当员工 A 离职，员工 B 接手工作时：

1. 所有历史对话仍保存在同一日志文件中
2. 通过 `speaker.user_id` 可区分不同员工的对话
3. 通过 `session_id` 可追踪完整会话上下文
4. 新员工可查看与 Agent 的所有历史交互

### 6.2 查询示例

```typescript
// 查询某员工的所有历史对话
const userHistory = await reader.filter(agentId, (entry) => 
  entry.speaker.type === 'USER' && entry.speaker.userId === 'user_001'
);

// 查询某会话的所有参与者
const sessionParticipants = await reader.bySession(agentId, 'sess_abc123');
```

## 7. 关联文档

- [四层记忆系统](./four_layers.md)
- [记忆系统模块索引](./README.md)
- [短期记忆层](./layer_short_term.md)
- [长期记忆层](./layer_long_term.md)
