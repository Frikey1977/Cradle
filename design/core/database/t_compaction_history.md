# t_compaction_history 压缩历史表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_compaction_history |
| 中文名 | 压缩历史表 |
| 说明 | 记录会话上下文压缩的历史记录 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，压缩记录唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 压缩记录名称（可选） |
| 3 | description | TEXT | - | 否 | NULL | 压缩描述 |
| 4 | session_id | VARCHAR | 36 | 是 | - | 关联会话ID |
| 5 | token_before | INT | - | 是 | - | 压缩前token数 |
| 6 | token_after | INT | - | 是 | - | 压缩后token数 |
| 7 | summary | TEXT | - | 否 | NULL | 生成的摘要内容 |
| 8 | removed_count | INT | - | 是 | - | 移除的消息数量 |
| 9 | strategy | VARCHAR | 50 | 否 | NULL | 压缩策略 |
| 10 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 11 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |
| 12 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 13 | status | TINYINT | 1 | 是 | 1 | 状态: 0=停用, 1=启用 |

## 字段详细说明

### sid 主键

压缩记录唯一标识，使用UUID生成。

### session_id 关联会话ID

关联的会话标识，外键关联到t_session表的sid字段。

### token_before 压缩前token数

执行压缩操作前的上下文总token数量。

### token_after 压缩后token数

执行压缩操作后的上下文总token数量。

### summary 摘要内容

压缩过程中生成的摘要文本，用于替换被压缩的历史消息。

### removed_count 移除消息数

本次压缩操作移除的消息数量。

### strategy 压缩策略

使用的压缩策略标识，如：
- `adaptive` - 自适应分块
- `turn_limit` - 回合限制
- `manual` - 手动触发

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_compaction_history | 主键索引 | sid | 主键索引 |
| idx_compaction_session | 普通索引 | session_id | 会话查询索引 |
| idx_compaction_create | 普通索引 | create_time | 时间排序索引 |
| idx_compaction_status | 普通索引 | status | 状态筛选索引 |
| idx_compaction_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_compaction_session_create | 联合索引 | session_id, create_time | 会话压缩历史查询 |

## SQL建表语句

```sql
CREATE TABLE t_compaction_history (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，压缩记录唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '压缩记录名称',
    description TEXT COMMENT '压缩描述',
    session_id VARCHAR(36) NOT NULL COMMENT '关联会话ID',
    token_before INT NOT NULL COMMENT '压缩前token数',
    token_after INT NOT NULL COMMENT '压缩后token数',
    summary TEXT COMMENT '生成的摘要内容',
    removed_count INT NOT NULL COMMENT '移除的消息数量',
    strategy VARCHAR(50) COMMENT '压缩策略',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    
    INDEX idx_compaction_session (session_id),
    INDEX idx_compaction_create (create_time),
    INDEX idx_compaction_status (status),
    INDEX idx_compaction_deleted (deleted),
    INDEX idx_compaction_session_create (session_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='压缩历史表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_session | session_id | 多对一 |
