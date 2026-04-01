# 短期记忆层设计

## 1. 功能定位

短期记忆层是四层记忆系统的第四层，负责存储和提供当前会话的近期消息上下文，支持会话快速恢复和上下文延续。

## 2. 核心作用

| 维度 | 说明 |
|------|------|
| 上下文存储 | 存储当前会话的近期消息（默认15条） |
| 快速恢复 | 支持会话中断后快速恢复上下文 |
| 工作交接 | 支持不同员工间的工作交接，共享上下文 |

## 3. 存储设计

### 3.1 存储方式

短期记忆存储在关系数据库中，按会话独立存储：

| 属性 | 说明 |
|------|------|
| 存储位置 | 关系数据库 |
| 存储粒度 | 按会话（session）存储 |
| 保留数量 | 每个会话保留最近 15 条消息 |
| 过期策略 | 会话结束后保留 7 天，然后归档到长期记忆 |

### 3.2 数据流向

```
对话进行中
    ↓
实时写入短期记忆表
    ↓
会话结束 → 保留7天 → 归档到长期记忆 → 删除短期记录
```

## 4. 数据模型

### 4.1 消息结构

```typescript
interface ShortTermMessage {
  messageId: string;           // 消息唯一标识
  sessionId: string;           // 所属会话
  agentId: string;             // Agent 标识
  speaker: {
    type: 'USER' | 'AGENT' | 'SKILL' | 'SYSTEM';
    userId?: string;           // USER 类型时必填
    userName?: string;         // 用户显示名
    agentId?: string;          // AGENT 类型时必填
  };
  content: string;             // 消息内容
  contentType: string;         // text/image/file/markdown
  channel: string;             // dingtalk/wechat/web/api
  timestamp: Date;             // 消息时间
  metadata?: Record<string, any>;  // 扩展元数据
}
```

## 5. 工作流程

### 5.1 写入流程

```
新消息产生
    ↓
写入对话日志（文件）
    ↓
写入短期记忆（数据库）
    ↓
超过15条时，删除最旧的消息
```

### 5.2 读取流程（会话恢复）

```
用户发起会话
    ↓
查询短期记忆表
    ↓
┌─────────────────────────┐
│ 存在活跃会话记录       │
│ → 加载最近15条消息     │
│ → 恢复上下文           │
└─────────────────────────┘
    ↓
┌─────────────────────────┐
│ 无活跃会话记录         │
│ → 从长期记忆加载主题   │
│ → 开始新会话           │
└─────────────────────────┘
```

### 5.3 员工交接场景

```
员工A离职，员工B接手
    ↓
员工B与Agent开始会话
    ↓
Agent查询短期记忆（按session）
    ↓
返回最近15条消息（含员工A的对话）
    ↓
员工B了解上下文，继续工作
```

## 6. 接口设计

### 6.1 存储接口

```typescript
interface ShortTermMemoryStore {
  // 保存消息
  save(message: ShortTermMessage): Promise<void>;
  
  // 批量保存
  saveBatch(messages: ShortTermMessage[]): Promise<void>;
  
  // 获取会话的近期消息
  getRecentMessages(sessionId: string, limit?: number): Promise<ShortTermMessage[]>;
  
  // 获取Agent的所有活跃会话
  getActiveSessions(agentId: string): Promise<SessionInfo[]>;
  
  // 清理过期消息
  cleanupExpired(sessionId: string): Promise<void>;
  
  // 删除会话的所有短期记忆
  deleteBySession(sessionId: string): Promise<void>;
}

interface SessionInfo {
  sessionId: string;
  agentId: string;
  lastMessageTime: Date;
  messageCount: number;
}
```

## 7. 关联文档

- [四层记忆系统](./four_layers.md)
- [记忆系统模块索引](./README.md)
- [短期记忆表](./database/t_short_term_memory.md)
- [长期记忆层](./layer_long_term.md)
- [对话日志层](./layer_conversation.md)
