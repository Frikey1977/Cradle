# t_session 会话表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_session |
| 中文名 | 会话表 |
| 说明 | 存储Agent会话的基本信息和状态 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，会话唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 会话显示名称 |
| 3 | description | TEXT | - | 否 | NULL | 会话描述 |
| 4 | session_key | VARCHAR | 255 | 是 | - | 会话键，用于路由 |
| 5 | agent_id | VARCHAR | 36 | 是 | - | 关联Agent ID |
| 6 | user_id | VARCHAR | 36 | 否 | NULL | 关联用户ID |
| 7 | cwd | VARCHAR | 512 | 是 | - | 工作目录 |
| 8 | status | TINYINT | 1 | 是 | 1 | 状态: 1=空闲, 2=运行中, 3=暂停, 4=错误, 5=关闭 |
| 9 | context_window | INT | - | 否 | NULL | 当前上下文窗口大小 |
| 10 | message_count | INT | - | 否 | 0 | 消息数量 |
| 11 | total_tokens | INT | - | 否 | 0 | 总token数 |
| 12 | compression_count | INT | - | 否 | 0 | 压缩次数 |
| 13 | last_summary | TEXT | - | 否 | NULL | 上次摘要内容 |
| 14 | last_activity_at | DATETIME | - | 否 | NULL | 最后活动时间 |
| 15 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 16 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |
| 17 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |

## 字段详细说明

### sid 主键

会话唯一标识，使用UUID生成。

### session_key 会话键

用于路由和查找会话的键值，格式通常为：`agent:{agent_id}:{provider}:{type}:{id}`

### agent_id 关联Agent ID

关联的Agent标识，外键关联到t_agent表的sid字段。

### status 状态

| 值 | 状态 | 说明 | 对应业务状态 |
|---|------|------|-------------|
| 1 | idle | 空闲 | 会话已创建，等待任务 |
| 2 | running | 运行中 | 会话正在执行任务 |
| 3 | paused | 暂停 | 会话被暂停 |
| 4 | error | 错误 | 会话发生错误 |
| 5 | closed | 关闭 | 会话已关闭 |

> **注意**：会话的管理状态（启用/停用）通过 `status` 字段控制。当会话被停用时，设置为 `closed` 状态。

### context_window 上下文窗口

当前会话使用的上下文窗口大小，单位token。

### total_tokens 总token数

当前会话累计使用的token数量。

### compression_count 压缩次数

会话上下文被压缩的次数，用于统计和优化。

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_session | 主键索引 | sid | 主键索引 |
| idx_session_key | 唯一索引 | session_key | 会话键唯一索引 |
| idx_session_agent | 普通索引 | agent_id | Agent查询索引 |
| idx_session_user | 普通索引 | user_id | 用户查询索引 |
| idx_session_status | 普通索引 | status | 状态筛选索引 |
| idx_session_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_session_activity | 普通索引 | last_activity_at | 活动时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_session (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，会话唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '会话显示名称',
    description TEXT COMMENT '会话描述',
    session_key VARCHAR(255) NOT NULL COMMENT '会话键，用于路由',
    agent_id VARCHAR(36) NOT NULL COMMENT '关联Agent ID',
    user_id VARCHAR(36) COMMENT '关联用户ID',
    cwd VARCHAR(512) NOT NULL COMMENT '工作目录',
    status TINYINT DEFAULT 1 COMMENT '状态: 1=idle空闲, 2=running运行中, 3=paused暂停, 4=error错误, 5=closed关闭',
    context_window INT COMMENT '当前上下文窗口大小',
    message_count INT DEFAULT 0 COMMENT '消息数量',
    total_tokens INT DEFAULT 0 COMMENT '总token数',
    compression_count INT DEFAULT 0 COMMENT '压缩次数',
    last_summary TEXT COMMENT '上次摘要内容',
    last_activity_at DATETIME COMMENT '最后活动时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_session_key (session_key),
    INDEX idx_session_agent (agent_id),
    INDEX idx_session_user (user_id),
    INDEX idx_session_status (status),
    INDEX idx_session_deleted (deleted),
    INDEX idx_session_activity (last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_agent | agent_id | 多对一 |
| t_users | user_id | 多对一 |
| t_message | session_id | 一对多 |
| t_compaction_history | session_id | 一对多 |
