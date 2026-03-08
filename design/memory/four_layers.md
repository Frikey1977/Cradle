# 四层记忆系统设计

## 1. 模块概述

### 1.1 功能定位
四层记忆系统是 Cradle 记忆模块的核心架构，通过分层存储实现从原始对话到精炼知识的全生命周期管理。

### 1.2 核心价值
- **完整追溯**: 原始对话日志支持审计和数据恢复
- **知识沉淀**: 长期记忆存储精炼后的知识和经验
- **快速检索**: 记忆索引支持高效的主题检索
- **实时响应**: 短期记忆保证对话连贯性

### 1.3 四层架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: 对话日志层 (Conversation Logs)                 │
│  • 存储: 平格式文本文件                                   │
│  • 路径: workspace/{agent_id}/{user_id}/conversation/    │
│  • 格式: 按日期存储 (YYYY-MM-DD.log)                     │
│  • 内容: 原始对话完整记录                                │
│  • 生命周期: 永久保存，自动归档压缩                      │
└─────────────────────────────────────────────────────────┘
                              │ (大模型主题归集)
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2: 长期记忆层 (Long-term Memory)                  │
│  • 存储: Markdown 文件 + 向量索引                        │
│  • 路径: workspace/{agent_id}/{user_id}/memory/          │
│  • 内容: 主题摘要 + 关键对话                             │
│  • 索引: topic-summary 向量化存入 SQLite-vec            │
│  • 生命周期: 永久保存，持续更新                          │
└─────────────────────────────────────────────────────────┘
                              │ (主题关联)
                              ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3: 记忆索引层 (Memory Index)                      │
│  • 存储: SQLite 关系表                                   │
│  • 内容: 主题 → 记忆ID 映射                              │
│  • 生命周期: 随记忆更新                                  │
└─────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────┐
│  Layer 4: 短期记忆层 (Short-term Memory)                 │
│  • 存储: 内存 / Redis                                    │
│  • 内容: 当前会话窗口 (最近 N 轮对话)                     │
│  • 生命周期: 会话期间                                    │
└─────────────────────────────────────────────────────────┘
```

## 2. 数据流转

### 2.1 写入流程

```
用户对话
    ↓
[Layer 4] 短期记忆 ← 实时更新
    ↓ (异步写入)
[Layer 1] 对话日志 ← 原始记录保存
    ↓ (每日定时归集)
[Layer 2] 长期记忆 ← 大模型主题提取与归集
    ↓ (向量索引)
[Layer 3] 记忆索引 ← 主题关联建立
```

### 2.2 读取流程

```
Agent 需要回忆
    ↓
[Layer 4] 检查短期记忆 ← 最近对话上下文
    ↓ (未命中)
[Layer 3] 查询记忆索引 ← 主题定位
    ↓
[Layer 2] 检索长期记忆 ← 向量相似度搜索
    ↓ (需要详情)
[Layer 1] 查询对话日志 ← 原始记录追溯
```

## 3. 功能设计

### 3.1 对话日志层 (Layer 1)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 日志写入 | 实时写入对话记录到文本文件 |
| 索引管理 | 维护对话元数据索引，支持快速定位 |
| 日志归档 | 按日期归档，支持压缩存储 |
| 日志检索 | 支持按时间、会话、用户检索 |

#### 存储路径（按年分层，位置不变）

```
workspace/{agent_id}/{user_id}/conversation/
├── 2026/                        # 2026年目录
│   ├── 2026-01-15.log           # 日志文件
│   ├── 2026-01-16.log.gz        # 已压缩日志
│   └── ...
├── 2025/                        # 2025年目录
│   └── ...
├── 2024/                        # 2024年目录
└── archive/                     # 长期归档（超过3年）
    └── 2023_all.tar.gz
```

**核心原则**：文件创建时直接根据年份放入对应目录，位置永不改变。

**存储策略**：
- **写入**：根据当前时间年份，直接写入 `conversation/{year}/YYYY-MM-DD.log`
- **压缩**：超过30天的日志压缩为 `.log.gz`（原地压缩）
- **归档**：超过3年的年份目录打包为 `archive/{year}_all.tar.gz`

**多用户场景**：Agent 可与多个用户对话，每个用户的对话独立存储：

```
workspace/agent_001/
├── user_001/conversation/      # 用户1的对话日志
├── user_002/conversation/      # 用户2的对话日志
└── user_003/conversation/      # 用户3的对话日志
```

#### 日志文件格式

**文件名**: `YYYY-MM-DD.log`

**内容格式** (平格式文本):
```
[2026-01-15T09:30:00.123Z] [INFO] [sess_abc123] [user_xyz789] [USER] {"message_id":"msg_001","content":"帮我查询上个月的销售数据","content_type":"text"}
[2026-01-15T09:30:02.789Z] [DEBUG] [sess_abc123] [user_xyz789] [SKILL] {"message_id":"msg_003","content":"调用 database.query","content_type":"skill_call","metadata":{"skill":"database.query","params":{"sql":"SELECT * FROM sales WHERE month = '2025-12'"}}}
[2026-01-15T09:30:05.012Z] [INFO] [sess_abc123] [user_xyz789] [AGENT] {"message_id":"msg_004","content":"查询完成，上个月销售额为 1,234,567 元","content_type":"text","metadata":{"tokens_used":150,"latency_ms":3200}}
```

> 详细设计请参考 [对话日志存储设计](./conversation_storage.md)

### 3.2 长期记忆层 (Layer 2)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 主题归集 | 大模型根据对话记录提取主题和关键信息 |
| 内容过滤 | 排除事务性无意义的对话内容 |
| 记忆存储 | 存储主题摘要和关键对话到文件 |
| 向量索引 | 对 topic-summary 向量化存入索引 |

#### 存储路径

```
workspace/{agent_id}/{user_id}/memory/
├── long_term/                    # 长期记忆文件目录
│   ├── 2026/                     # 按年份组织
│   │   ├── 2026-01-15.md         # 当日归集的记忆文件
│   │   ├── 2026-01-16.md
│   │   └── ...
│   └── 2025/
│       └── ...
└── index/                        # 向量索引目录
    └── long_term_index.db        # 向量索引数据库
```

#### 长期记忆文件格式

```markdown
# Subject: {当日主要主题}

## {topic-summary-1}

**关键对话**:
- [09:30] 用户: 帮我查询上个月的销售数据
- [09:32] Agent: 查询完成，上个月销售额为 1,234,567 元

## {topic-summary-2}

**关键对话**:
- [14:00] 用户: 下周的项目会议安排在什么时候？
- [14:02] Agent: 已安排在下周三下午2点，会议室A301
```

> 详细设计请参考 [长期记忆层设计](./layer_long_term.md)

### 3.3 记忆索引层 (Layer 3)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 主题管理 | 维护主题分类体系 |
| 索引建立 | 为记忆建立主题索引 |
| 索引查询 | 支持按主题检索记忆 |
| 索引更新 | 动态更新索引关系 |

#### 主题分类

```
工作相关
├── 项目管理
├── 会议记录
├── 决策记录
└── 业务知识

个人相关
├── 个人信息
├── 工作偏好
├── 沟通风格
└── 人际关系
```

### 3.4 短期记忆层 (Layer 4)

#### 功能列表

| 功能 | 说明 |
|------|------|
| 会话维护 | 维护当前会话的对话历史 |
| 上下文管理 | 管理对话上下文窗口 |
| 快速访问 | 提供毫秒级访问速度 |
| 自动清理 | 会话结束后自动清理 |

#### 窗口管理

```typescript
interface ShortTermMemory {
  sessionId: string;
  messages: Message[];
  maxWindowSize: number;  // 默认 20 轮
  
  // 添加消息
  addMessage(message: Message): void;
  
  // 获取上下文
  getContext(): Message[];
  
  // 清理过期会话
  cleanup(): void;
}
```

## 4. 接口设计

### 4.1 记忆服务接口

```typescript
interface MemoryService {
  writeConversation(conversation: Conversation): Promise<void>;
  
  addToShortTerm(sessionId: string, message: Message): void;
  
  searchLongTermMemory(
    query: string,
    filters?: MemoryFilter
  ): Promise<Memory[]>;
  
  searchByTopic(topicId: string): Promise<Memory[]>;
  
  getConversationHistory(
    sessionId: string,
    options?: HistoryOptions
  ): Promise<Conversation[]>;
  
  aggregateMemory(date: Date): Promise<void>;
}
```

## 5. 存储设计

### 5.1 对话日志层 (文件存储)

- [对话日志存储设计](./conversation_storage.md) - 平格式文件存储方案

**存储结构**:
- **日志文件**：`workspace/{agent_id}/{user_id}/conversation/{year}/YYYY-MM-DD.log`
- **压缩日志**：`workspace/{agent_id}/{user_id}/conversation/{year}/YYYY-MM-DD.log.gz`（超过30天）
- **归档文件**：`workspace/{agent_id}/{user_id}/conversation/archive/{year}_all.tar.gz`（超过3年）

### 5.2 长期记忆层 (文件存储 + 向量索引)

- [长期记忆层设计](./layer_long_term.md) - 主题归集与向量索引

**存储结构**:
- **记忆文件**：`workspace/{agent_id}/{user_id}/memory/long_term/{year}/YYYY-MM-DD.md`
- **向量索引**：`workspace/{agent_id}/{user_id}/memory/index/long_term_index.db`

### 5.3 记忆索引层

- [记忆索引表](./database/t_memory_index.md)
- [记忆-主题关联表](./database/r_memory_topic.md)

## 6. 关联文档

- [记忆系统模块索引](./README.md)
- [五重画像记忆引擎](./five_profiles.md)
- [Agent 运行时设计](../agents/runtime.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
