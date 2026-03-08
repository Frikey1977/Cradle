# t_short_term_memory - 短期记忆表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_short_term_memory |
| 中文名 | 短期记忆表 |
| 说明 | 存储会话的近期消息（默认15条），支持快速恢复上下文 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 消息标识 |
| 3 | description | TEXT | - | NO | NULL | 消息描述 |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 5 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 6 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 7 | status | TINYINT | - | YES | 1 | 状态: 0=已归档, 1=活跃 |
| 8 | session_id | VARCHAR | 36 | YES | - | 会话ID |
| 9 | agent_id | VARCHAR | 36 | YES | - | Agent ID |
| 10 | speaker_type | VARCHAR | 20 | YES | - | 发言者类型: USER/AGENT/SKILL/SYSTEM |
| 11 | speaker_user_id | VARCHAR | 36 | NO | - | 发言用户ID（USER类型时） |
| 12 | speaker_user_name | VARCHAR | 100 | NO | - | 发言用户名称 |
| 13 | speaker_agent_id | VARCHAR | 36 | NO | - | 发言Agent ID（AGENT类型时） |
| 14 | message_id | VARCHAR | 36 | YES | - | 消息唯一标识 |
| 15 | content | TEXT | - | YES | - | 消息内容 |
| 16 | content_type | VARCHAR | 20 | YES | 'text' | 内容类型: text/image/file/markdown |
| 17 | channel | VARCHAR | 20 | YES | - | 通道: dingtalk/wechat/web/api |
| 18 | message_time | DATETIME | - | YES | - | 消息发送时间 |
| 19 | metadata | JSON | - | NO | - | 扩展元数据 |
| 20 | sequence | INT | - | YES | 0 | 会话内消息序号 |

## 字段详细说明

### speaker_type 发言者类型

| 值 | 说明 |
|----|------|
| USER | 用户消息 |
| AGENT | Agent消息 |
| SKILL | 技能调用 |
| SYSTEM | 系统消息 |

### content_type 内容类型

| 值 | 说明 |
|----|------|
| text | 纯文本 |
| image | 图片 |
| file | 文件 |
| markdown | Markdown格式 |

### status 状态

| 值 | 说明 |
|----|------|
| 0 | 已归档（已转入长期记忆） |
| 1 | 活跃 |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_short_term_memory | sid | 主键 |
| uk_short_term_message | message_id | 唯一索引 |
| idx_short_term_session | session_id | 普通索引 |
| idx_short_term_agent | agent_id | 普通索引 |
| idx_short_term_speaker_user | speaker_user_id | 普通索引 |
| idx_short_term_status | status | 普通索引 |
| idx_short_term_deleted | deleted | 普通索引 |
| idx_short_term_time | message_time | 普通索引 |
| idx_short_term_sequence | session_id, sequence | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_short_term_memory (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT '消息标识',
    description TEXT COMMENT '消息描述',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=已归档, 1=活跃',
    session_id VARCHAR(36) NOT NULL COMMENT '会话ID',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID',
    speaker_type VARCHAR(20) NOT NULL COMMENT '发言者类型: USER/AGENT/SKILL/SYSTEM',
    speaker_user_id VARCHAR(36) COMMENT '发言用户ID（USER类型时）',
    speaker_user_name VARCHAR(100) COMMENT '发言用户名称',
    speaker_agent_id VARCHAR(36) COMMENT '发言Agent ID（AGENT类型时）',
    message_id VARCHAR(36) NOT NULL COMMENT '消息唯一标识',
    content TEXT NOT NULL COMMENT '消息内容',
    content_type VARCHAR(20) DEFAULT 'text' COMMENT '内容类型: text/image/file/markdown',
    channel VARCHAR(20) NOT NULL COMMENT '通道: dingtalk/wechat/web/api',
    message_time DATETIME NOT NULL COMMENT '消息发送时间',
    metadata JSON COMMENT '扩展元数据',
    sequence INT DEFAULT 0 COMMENT '会话内消息序号',
    
    UNIQUE KEY uk_short_term_message (message_id),
    INDEX idx_short_term_session (session_id),
    INDEX idx_short_term_agent (agent_id),
    INDEX idx_short_term_speaker_user (speaker_user_id),
    INDEX idx_short_term_status (status),
    INDEX idx_short_term_deleted (deleted),
    INDEX idx_short_term_time (message_time),
    INDEX idx_short_term_sequence (session_id, sequence),
    
    FOREIGN KEY (agent_id) REFERENCES t_agent(sid),
    FOREIGN KEY (session_id) REFERENCES t_conversation_session(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='短期记忆表';
```

## 数据管理策略

### 保留策略

| 项目 | 说明 |
|------|------|
| 单会话保留数量 | 最多15条消息 |
| 过期时间 | 会话结束后保留7天 |
| 归档方向 | 过期后转入长期记忆层 |

### 清理策略

```sql
-- 清理超过15条的消息（保留最新的15条）
DELETE FROM t_short_term_memory 
WHERE sid NOT IN (
    SELECT sid FROM (
        SELECT sid FROM t_short_term_memory 
        WHERE session_id = ? AND deleted = 0
        ORDER BY sequence DESC 
        LIMIT 15
    ) AS tmp
);

-- 清理过期的已归档消息
DELETE FROM t_short_term_memory 
WHERE status = 0 AND message_time < DATE_SUB(NOW(), INTERVAL 7 DAY);
```

## 关联文档

- [短期记忆层设计](../layer_short_term.md)
- [对话日志层设计](../layer_conversation.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
