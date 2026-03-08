# t_agent_heartbeat_log Agent心跳执行日志表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_agent_heartbeat_log |
| 中文名 | Agent心跳执行日志表 |
| 说明 | 记录Agent周期性心跳任务的执行历史和结果 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | agent_id | VARCHAR | 36 | YES | - | Agent ID（关联t_agent） |
| 3 | started_at | DATETIME | - | YES | - | 开始时间 |
| 4 | completed_at | DATETIME | - | NO | NULL | 完成时间 |
| 5 | duration_ms | INT | - | NO | NULL | 执行时长（毫秒） |
| 6 | status | VARCHAR | 20 | NO | - | 状态：ok/empty/error/skipped |
| 7 | skip_reason | VARCHAR | 50 | NO | NULL | 跳过原因 |
| 8 | prompt | TEXT | - | NO | NULL | 使用的提示词 |
| 9 | response_preview | TEXT | - | NO | NULL | 响应预览（前200字符） |
| 10 | has_media | TINYINT | 1 | NO | 0 | 是否包含媒体：0=否, 1=是 |
| 11 | target_channel | VARCHAR | 50 | NO | NULL | 投递频道 |
| 12 | delivered | TINYINT | 1 | NO | 0 | 是否已投递：0=否, 1=是 |
| 13 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 14 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### status 执行状态

| 值 | 说明 |
|-----|------|
| ok | 执行成功，有内容投递 |
| empty | 执行成功，但无内容需要投递 |
| error | 执行出错 |
| skipped | 被跳过（非活跃时段等） |

### skip_reason 跳过原因

| 值 | 说明 |
|-----|------|
| inactive_hours | 非活跃时段 |
| agent_paused | Agent已暂停 |
| heartbeat_disabled | 心跳已停用 |
| concurrent_limit | 并发限制 |

### target_channel 投递频道

| 值 | 说明 |
|-----|------|
| last | 最后活跃频道 |
| dingtalk | 钉钉 |
| wechat | 企业微信 |
| email | 邮件 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_heartbeat_log | 主键 | sid | 主键索引 |
| idx_heartbeat_log_agent | 普通 | agent_id | Agent查询 |
| idx_heartbeat_log_started | 普通 | started_at | 时间范围查询 |
| idx_heartbeat_log_status | 普通 | status | 状态筛选 |

## SQL建表语句

```sql
CREATE TABLE t_agent_heartbeat_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID',
    started_at DATETIME NOT NULL COMMENT '开始时间',
    completed_at DATETIME COMMENT '完成时间',
    duration_ms INT COMMENT '执行时长（毫秒）',
    status VARCHAR(20) COMMENT '状态：ok/empty/error/skipped',
    skip_reason VARCHAR(50) COMMENT '跳过原因',
    prompt TEXT COMMENT '使用的提示词',
    response_preview TEXT COMMENT '响应预览（前200字符）',
    has_media TINYINT DEFAULT 0 COMMENT '是否包含媒体',
    target_channel VARCHAR(50) COMMENT '投递频道',
    delivered TINYINT DEFAULT 0 COMMENT '是否已投递',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    INDEX idx_heartbeat_log_agent (agent_id),
    INDEX idx_heartbeat_log_started (started_at),
    INDEX idx_heartbeat_log_status (status),
    
    FOREIGN KEY (agent_id) REFERENCES t_agent(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Agent心跳执行日志';
```

## 关联文档

- [Agent心跳机制](../agent-heartbeat.md)
- [Agent定义表](t_agent.md)
