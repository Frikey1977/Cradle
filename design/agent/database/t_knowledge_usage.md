# t_knowledge_usage 知识使用记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_knowledge_usage |
| 中文名 | 知识使用记录表 |
| 说明 | 记录知识被应用的情况，用于追踪知识效果 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，记录ID |
| 2 | knowledge_id | VARCHAR | 36 | 是 | - | 知识ID |
| 3 | execution_id | VARCHAR | 36 | 是 | - | 执行记录ID |
| 4 | agent_id | VARCHAR | 36 | 是 | - | Agent ID |
| 5 | user_id | VARCHAR | 36 | 是 | - | 用户ID |
| 6 | match_score | DECIMAL | 3,2 | 是 | - | 匹配得分 |
| 7 | success | TINYINT | 1 | 否 | NULL | 执行是否成功 |
| 8 | duration_ms | INT | - | 否 | NULL | 执行耗时 |
| 9 | feedback | VARCHAR | 500 | 否 | NULL | 用户反馈 |
| 10 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### match_score 匹配得分

- 范围：0.00 - 1.00
- 表示该知识与当前任务的匹配程度
- 用于后续优化匹配算法

### success 执行结果

| 值 | 说明 |
|---|------|
| 1 | 执行成功 |
| 0 | 执行失败 |
| NULL | 尚未完成 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_knowledge_usage | 主键索引 | sid | 主键索引 |
| idx_usage_knowledge | 普通索引 | knowledge_id | 知识使用统计 |
| idx_usage_execution | 普通索引 | execution_id | 执行关联查询 |
| idx_usage_agent | 普通索引 | agent_id | Agent使用统计 |
| idx_usage_time | 普通索引 | create_time | 时间范围查询 |

## SQL建表语句

```sql
CREATE TABLE t_knowledge_usage (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，记录ID',
    knowledge_id VARCHAR(36) NOT NULL COMMENT '知识ID',
    execution_id VARCHAR(36) NOT NULL COMMENT '执行记录ID',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID',
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    match_score DECIMAL(3,2) NOT NULL COMMENT '匹配得分',
    success TINYINT COMMENT '执行是否成功: 1=是, 0=否',
    duration_ms INT COMMENT '执行耗时',
    feedback VARCHAR(500) COMMENT '用户反馈',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_usage_knowledge (knowledge_id),
    INDEX idx_usage_execution (execution_id),
    INDEX idx_usage_agent (agent_id),
    INDEX idx_usage_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识使用记录表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_execution_knowledge | knowledge_id | 多对一 |
| t_execution_log | execution_id | 多对一 |
| t_agent | agent_id | 多对一 |
| t_users | user_id | 多对一 |

## 使用场景

### 1. 知识效果统计

```sql
-- 统计某知识的使用情况和成功率
SELECT 
    knowledge_id,
    COUNT(*) as usage_count,
    AVG(match_score) as avg_match_score,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*) as success_rate,
    AVG(duration_ms) as avg_duration
FROM t_knowledge_usage
WHERE knowledge_id = 'xxx'
GROUP BY knowledge_id;
```

### 2. Agent知识应用分析

```sql
-- 分析某Agent最常使用的知识
SELECT 
    k.name,
    COUNT(*) as usage_count,
    AVG(u.match_score) as avg_score
FROM t_knowledge_usage u
JOIN t_execution_knowledge k ON u.knowledge_id = k.sid
WHERE u.agent_id = 'agent-xxx'
GROUP BY u.knowledge_id
ORDER BY usage_count DESC
LIMIT 10;
```

## 参考文档

- [执行知识库设计](../execution-knowledge.md)
- [执行知识表](./t_execution_knowledge.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
