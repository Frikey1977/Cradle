# t_audit_log 审计日志表（MVP简化版）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_audit_log |
| 中文名 | 审计日志表 |
| 说明 | 记录系统关键操作，满足基本合规要求 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，日志ID |
| 2 | action | VARCHAR | 50 | 是 | - | 操作类型 |
| 3 | actor_type | VARCHAR | 20 | 是 | - | 操作者类型 |
| 4 | actor_id | VARCHAR | 36 | 是 | - | 操作者ID |
| 5 | target_type | VARCHAR | 50 | 是 | - | 操作对象类型 |
| 6 | target_id | VARCHAR | 36 | 是 | - | 操作对象ID |
| 7 | details | JSON | - | 否 | NULL | 操作详情 |
| 8 | result | VARCHAR | 20 | 是 | - | 操作结果 |
| 9 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### action 操作类型

| 取值 | 说明 |
|-----|------|
| execution_start | 执行开始 |
| execution_complete | 执行完成 |
| execution_fail | 执行失败 |
| skill_invoke | Skill 调用 |
| data_access | 数据访问 |

### actor_type 操作者类型

| 取值 | 说明 |
|-----|------|
| agent | AI Agent |
| user | 人类用户 |
| system | 系统 |

### target_type 操作对象类型

| 取值 | 说明 |
|-----|------|
| execution | 执行记录 |
| skill | Skill |
| data | 数据 |

### result 操作结果

| 取值 | 说明 |
|-----|------|
| success | 成功 |
| failure | 失败 |
| blocked | 被阻断 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_audit_log | 主键索引 | sid | 主键索引 |
| idx_audit_action | 普通索引 | action | 操作类型筛选 |
| idx_audit_actor | 普通索引 | actor_type, actor_id | 操作者筛选 |
| idx_audit_time | 普通索引 | create_time | 时间排序 |

## SQL建表语句

```sql
CREATE TABLE t_audit_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，日志ID',
    action VARCHAR(50) NOT NULL COMMENT '操作类型',
    actor_type VARCHAR(20) NOT NULL COMMENT '操作者类型',
    actor_id VARCHAR(36) NOT NULL COMMENT '操作者ID',
    target_type VARCHAR(50) NOT NULL COMMENT '操作对象类型',
    target_id VARCHAR(36) NOT NULL COMMENT '操作对象ID',
    details JSON COMMENT '操作详情',
    result VARCHAR(20) NOT NULL COMMENT '操作结果',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_audit_action (action),
    INDEX idx_audit_actor (actor_type, actor_id),
    INDEX idx_audit_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='审计日志表';
```

## 数据保留策略

- **保留期**：90天
- **清理方式**：定时任务删除过期数据
- **备份**：如需长期保留，定期导出到冷存储

## 参考文档

- [执行监控设计](../execution-monitor.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
