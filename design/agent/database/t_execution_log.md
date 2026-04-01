# t_execution_log 执行记录表（MVP简化版）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_execution_log |
| 中文名 | 执行记录表 |
| 说明 | 记录 Agent 任务执行的核心信息，支持列表查询和基本监控 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，执行记录ID |
| 2 | agent_id | VARCHAR | 36 | 是 | - | Agent ID |
| 3 | user_id | VARCHAR | 36 | 是 | - | 用户ID |
| 4 | input_text | VARCHAR | 2000 | 是 | - | 用户输入文本 |
| 5 | exec_status | VARCHAR | 20 | 是 | 'running' | 执行状态 |
| 6 | started_at | DATETIME | - | 是 | CURRENT_TIMESTAMP | 开始时间 |
| 7 | completed_at | DATETIME | - | 否 | NULL | 完成时间 |
| 8 | duration_ms | INT | - | 否 | NULL | 耗时（毫秒） |
| 9 | result_output | TEXT | - | 否 | NULL | 输出结果 |
| 10 | error_message | TEXT | - | 否 | NULL | 错误信息 |
| 11 | total_tokens | INT | - | 是 | 0 | Token消耗 |
| 12 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### exec_status 执行状态

| 取值 | 说明 |
|-----|------|
| running | 执行中 |
| completed | 成功完成 |
| failed | 执行失败 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_execution_log | 主键索引 | sid | 主键索引 |
| idx_exec_agent | 普通索引 | agent_id | Agent筛选 |
| idx_exec_user | 普通索引 | user_id | 用户筛选 |
| idx_exec_status | 普通索引 | exec_status | 状态筛选 |
| idx_exec_started | 普通索引 | started_at | 时间排序 |

## SQL建表语句

```sql
CREATE TABLE t_execution_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，执行记录ID',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID',
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    input_text VARCHAR(2000) NOT NULL COMMENT '用户输入文本',
    exec_status VARCHAR(20) NOT NULL DEFAULT 'running' COMMENT '执行状态',
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    completed_at DATETIME COMMENT '完成时间',
    duration_ms INT COMMENT '耗时（毫秒）',
    result_output TEXT COMMENT '输出结果',
    error_message TEXT COMMENT '错误信息',
    total_tokens INT NOT NULL DEFAULT 0 COMMENT 'Token消耗',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_exec_agent (agent_id),
    INDEX idx_exec_user (user_id),
    INDEX idx_exec_status (exec_status),
    INDEX idx_exec_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行记录表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_agent | agent_id | 多对一 |
| t_users | user_id | 多对一 |

## 日志文件关联

执行步骤详情存储在日志文件中：
- 路径：`logs/execution/{date}/{execution_id}.jsonl`
- 格式：JSON Lines
- 保留期：7天（通过日志轮转清理）

## 参考文档

- [执行监控设计](../execution-monitor.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
