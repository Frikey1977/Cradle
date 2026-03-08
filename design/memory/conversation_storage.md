# 对话日志存储设计

## 1. 存储架构

### 1.1 存储路径规划（按年分层，位置不变）

```
workspace/
└── {agent_id}/                              # Agent 工作目录
    ├── config/                              # Agent 配置文件
    ├── knowledge/                           # 知识库文件
    └── {user_id}/                           # 用户目录（支持多用户）
        └── conversation/                    # 对话日志根目录
            ├── 2026/                        # 2026年目录
            │   ├── index.db                 # 2026年索引
            │   ├── 2026-01-15.log           # 日志文件
            │   ├── 2026-01-16.log
            │   └── ...                      # 最多365个文件
            ├── 2025/                        # 2025年目录
            │   ├── index.db                 # 2025年索引
            │   ├── 2025-01-01.log.gz        # 已压缩日志
            │   └── ...
            ├── 2024/                        # 2024年目录
            └── archive/                     # 长期归档（超过3年）
                └── 2023_all.tar.gz          # 整年打包归档
```

### 1.2 核心设计原则

**文件位置不变**：日志文件创建时直接根据年份放入对应目录，位置永不改变。

```
写入流程：
1. 获取当前时间 → 提取年份
2. 检查 conversation/{year}/ 目录是否存在
3. 不存在则创建目录和索引
4. 直接写入 conversation/{year}/YYYY-MM-DD.log
```

**优势**：
- 无需判断"当年"或"历史"
- 文件位置从创建就确定，永不移动
- 索引中的文件路径始终有效
- 逻辑简单，无特殊条件

### 1.3 存储策略

| 阶段 | 存储方式 | 触发条件 | 说明 |
|------|---------|---------|------|
| 写入 | 原始文本 | 实时写入 | `conversation/{year}/YYYY-MM-DD.log` |
| 压缩 | gzip压缩 | 超过30天 | `conversation/{year}/YYYY-MM-DD.log.gz` |
| 归档 | tar.gz打包 | 超过3年 | `conversation/archive/{year}_all.tar.gz` |

### 1.4 多用户场景示例

```
workspace/
└── agent_001/                               # Agent: agent_001
    ├── config/
    ├── knowledge/
    ├── user_001/                            # 用户1
    │   └── conversation/
    │       ├── 2026/                        # 2026年
    │       │   ├── index.db
    │       │   ├── 2026-01-15.log
    │       │   └── ...
    │       ├── 2025/                        # 2025年
    │       └── archive/
    ├── user_002/                            # 用户2
    │   └── conversation/
    │       └── 2026/
    └── user_003/                            # 用户3
        └── conversation/
            └── 2026/
```

## 2. 文件格式设计

### 2.1 日志文件命名

```
{YYYY-MM-DD}.log          # 原始文件
{YYYY-MM-DD}.log.gz       # 压缩后
```

### 2.2 日志文件格式

采用平格式文本存储，每行一条记录，便于追加写入和顺序读取。

#### 格式规范

```
[{timestamp}] [{level}] [{session_id}] [{message_type}] {content}
```

#### 字段说明

| 字段 | 说明 | 示例 |
|------|------|------|
| timestamp | ISO 8601 格式时间戳 | 2026-01-15T09:30:00.123Z |
| level | 日志级别 | INFO, DEBUG, ERROR |
| session_id | 会话唯一标识 | sess_abc123def456 |
| message_type | 消息类型 | USER, AGENT, SYSTEM, SKILL |
| content | JSON 格式的消息内容 | 见下文 |

#### 内容格式 (JSON)

```json
{
  "message_id": "msg_xxx",
  "content": "消息内容",
  "content_type": "text",
  "metadata": {
    "tokens_used": 150,
    "latency_ms": 1200,
    "model": "gpt-4"
  }
}
```

### 2.3 日志示例

```log
[2026-01-15T09:30:00.123Z] [INFO] [sess_abc123] [USER] {"message_id":"msg_001","content":"帮我查询上个月的销售数据","content_type":"text"}
[2026-01-15T09:30:02.789Z] [DEBUG] [sess_abc123] [SKILL] {"message_id":"msg_003","content":"调用 database.query","content_type":"skill_call","metadata":{"skill":"database.query","params":{"sql":"SELECT * FROM sales WHERE month = '2025-12'"}}}
[2026-01-15T09:30:05.012Z] [INFO] [sess_abc123] [AGENT] {"message_id":"msg_004","content":"查询完成，上个月销售额为 1,234,567 元，同比增长 15%","content_type":"text","metadata":{"tokens_used":150,"latency_ms":3200}}
```

## 3. 索引数据库设计

### 3.1 索引表结构

每个年份目录下有独立的索引数据库：

```sql
CREATE TABLE conversation_index (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id VARCHAR(64) NOT NULL,
    log_date DATE NOT NULL,
    file_name VARCHAR(50) NOT NULL,         -- 文件名：2026-01-15.log
    file_offset BIGINT NOT NULL,            -- 记录在文件中的偏移位置
    line_number INTEGER NOT NULL,           -- 行号
    timestamp DATETIME NOT NULL,
    message_type VARCHAR(20) NOT NULL,
    message_id VARCHAR(64),
    
    INDEX idx_session (session_id),
    INDEX idx_date (log_date),
    INDEX idx_timestamp (timestamp)
);
```

### 3.2 会话元数据表

```sql
CREATE TABLE session_meta (
    session_id VARCHAR(64) PRIMARY KEY,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    message_count INTEGER DEFAULT 0,
    first_log_file VARCHAR(50),
    last_log_file VARCHAR(50),
    status INTEGER DEFAULT 1,
    
    INDEX idx_start_time (start_time),
    INDEX idx_status (status)
);
```

### 3.3 索引管理

| 索引位置 | 说明 |
|---------|------|
| `conversation/{year}/index.db` | 每年独立索引 |
| 内存缓存 | 当前年份索引常驻内存 |

**关键设计**：文件位置不变，索引中的 `file_name` 始终有效

## 4. 文件操作接口

### 4.1 日志写入接口

```typescript
interface ConversationLogger {
  write(agentId: string, userId: string, message: LogMessage): Promise<void>;
  writeBatch(agentId: string, userId: string, messages: LogMessage[]): Promise<void>;
  flush(): Promise<void>;
}

interface LogMessage {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'ERROR';
  session_id: string;
  message_type: 'USER' | 'AGENT' | 'SYSTEM' | 'SKILL';
  content: {
    message_id: string;
    content: string;
    content_type: string;
    metadata?: Record<string, any>;
  };
}
```

### 4.2 日志读取接口

```typescript
interface ConversationReader {
  readBySession(agentId: string, userId: string, sessionId: string): AsyncGenerator<LogMessage>;
  readByDateRange(agentId: string, userId: string, startDate: string, endDate: string): AsyncGenerator<LogMessage>;
  readByTimeRange(agentId: string, userId: string, startTime: string, endTime: string): AsyncGenerator<LogMessage>;
}
```

## 5. 压缩与归档策略

### 5.1 压缩策略（超过30天）

```
定期任务（每天凌晨 2:00）
    ↓
遍历所有年份目录
    ↓
查找超过30天的 .log 文件
    ↓
压缩为 .log.gz
    ↓
删除原始 .log 文件
    ↓
更新索引中的文件名
```

### 5.2 归档策略（超过3年）

```
定期任务（每月1日）
    ↓
检查 conversation/ 下的年份目录
    ↓
识别超过3年的目录
    ↓
打包为 archive/{year}_all.tar.gz
    ↓
删除原始年份目录
    ↓
记录归档日志
```

## 6. 性能优化

### 6.1 写入优化

- **按日分文件**：每天一个文件，避免单文件过大
- **缓冲写入**：批量写入，减少 IO 次数
- **文件句柄缓存**：缓存当前写入的文件句柄
- **索引缓存**：当前年份索引常驻内存

### 6.2 读取优化

- **索引加速**：通过索引快速定位日志位置
- **按需加载**：历史年份索引按需加载
- **预读取**：预加载相邻日期的日志文件
- **缓存策略**：缓存最近访问的日志内容

### 6.3 存储优化

- **定期压缩**：超过30天的日志自动压缩
- **年度归档**：超过3年的数据打包存储
- **自动清理**：归档后自动删除原始文件

## 7. 存储空间估算

### 7.1 单用户日均数据量

| 数据类型 | 日均量 | 存储方式 | 占用空间 |
|---------|--------|---------|---------|
| 对话日志 | 100条/天 | 文本 | ~50KB/天 |
| 索引数据 | 100条/天 | SQLite | ~10KB/天 |
| **合计** | - | - | **~60KB/天** |

### 7.2 年度存储估算

| 时间 | 原始大小 | 压缩后 | 说明 |
|------|---------|--------|------|
| 1年 | ~22MB | ~22MB | 近期不压缩 |
| 2年 | ~44MB | ~30MB | 前一年已压缩 |
| 3年 | ~66MB | ~38MB | 前两年已压缩 |
| 5年 | ~110MB | ~50MB | 历史层已打包 |

### 7.3 企业级估算（1000用户）

| 时间 | 总存储空间 | 说明 |
|------|-----------|------|
| 1年 | ~22GB | 近期数据 |
| 3年 | ~38GB | 历史数据压缩 |
| 5年 | ~50GB | 长期归档打包 |

## 8. 备份与恢复

### 8.1 备份策略

| 数据类型 | 备份频率 | 保留时间 | 备份方式 |
|---------|---------|---------|---------|
| 年度日志 | 每周增量 | 30天 | 文件复制 |
| 年度索引 | 每周全量 | 30天 | 数据库备份 |
| 归档文件 | 每月全量 | 永久 | 压缩备份 |

### 8.2 恢复接口

```typescript
interface LogRecovery {
  restoreDate(agentId: string, userId: string, date: string): Promise<void>;
  restoreYear(agentId: string, userId: string, year: number): Promise<void>;
  rebuildIndex(agentId: string, userId: string, year: number): Promise<void>;
}
```

## 9. 存储路径汇总

### 9.1 完整路径结构

```
workspace/
└── {agent_id}/
    ├── config/
    │   ├── agent.json
    │   └── model.json
    ├── knowledge/
    │   ├── docs/
    │   └── vectors/
    └── {user_id}/
        └── conversation/
            ├── 2026/                        # 2026年目录
            │   ├── index.db                 # 2026年索引
            │   ├── 2026-01-15.log           # 日志文件
            │   ├── 2026-01-16.log.gz        # 已压缩日志
            │   └── ...
            ├── 2025/                        # 2025年目录
            │   ├── index.db
            │   └── ...
            └── archive/                     # 长期归档（超过3年）
                └── 2023_all.tar.gz
```

### 9.2 路径说明

| 路径 | 说明 | 保留时间 |
|------|------|---------|
| `conversation/{year}/YYYY-MM-DD.log` | 原始日志 | 30天 |
| `conversation/{year}/YYYY-MM-DD.log.gz` | 压缩日志 | 3年 |
| `conversation/{year}/index.db` | 年度索引 | 3年 |
| `conversation/archive/{year}_all.tar.gz` | 长期归档 | 永久 |

## 10. 关联文档

- [四层记忆系统](./four_layers.md)
- [会话主表（元数据）](./database/t_conversation.md)
- [记忆系统模块索引](../README.md)
