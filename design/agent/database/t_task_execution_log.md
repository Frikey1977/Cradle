# t_task_execution_log 任务执行日志表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_task_execution_log |
| 中文名 | 任务执行日志表 |
| 说明 | 记录任务执行过程中的详细日志，用于调试、审计和问题排查。 |

## 核心设计原则

**日志分级**：
- `info`：正常执行信息
- `warn`：警告信息（可恢复）
- `error`：错误信息（影响执行）
- `debug`：调试信息

**日志内容**：
- 记录每个步骤的执行状态
- 记录变量变化
- 记录错误详情

**查询优化**：
- 按 worktask_id 查询完整执行链
- 按 step_id 查询特定步骤日志
- 按时间范围查询

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 日志名称 |
| 3 | description | TEXT | - | NO | NULL | 日志描述 |
| 4 | worktask_id | VARCHAR | 36 | YES | - | 关联的 Worktask ID |
| 5 | task_def_id | VARCHAR | 36 | NO | NULL | 关联的任务定义ID |
| 6 | step_id | VARCHAR | 100 | NO | NULL | 步骤ID |
| 7 | step_type | VARCHAR | 20 | NO | NULL | 步骤类型：action/condition/loop/parallel/wait |
| 8 | log_type | VARCHAR | 20 | YES | - | 日志类型：info/warn/error/debug |
| 9 | message | TEXT | - | YES | - | 日志消息 |
| 10 | details | JSON | - | NO | NULL | 详细信息（JSON格式） |
| 11 | duration_ms | INT | - | NO | NULL | 执行耗时（毫秒） |
| 12 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 13 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 14 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 15 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_task_exec_log | 主键索引 | sid | 主键索引 |
| idx_task_log_worktask | 普通索引 | worktask_id | Worktask查询索引 |
| idx_task_log_def | 普通索引 | task_def_id | 任务定义查询索引 |
| idx_task_log_step | 普通索引 | step_id | 步骤查询索引 |
| idx_task_log_type | 普通索引 | log_type | 日志类型索引 |
| idx_task_log_status | 普通索引 | status | 状态筛选索引 |
| idx_task_log_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_task_log_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_task_execution_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，日志唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '日志名称',
    description TEXT COMMENT '日志描述',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联的 Worktask ID',
    task_def_id VARCHAR(36) COMMENT '关联的任务定义ID',
    step_id VARCHAR(100) COMMENT '步骤ID',
    step_type VARCHAR(20) COMMENT '步骤类型：action/condition/loop/parallel/wait',
    log_type VARCHAR(20) NOT NULL COMMENT '日志类型：info/warn/error/debug',
    message TEXT NOT NULL COMMENT '日志消息',
    details JSON COMMENT '详细信息',
    duration_ms INT COMMENT '执行耗时（毫秒）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_task_log_worktask (worktask_id),
    INDEX idx_task_log_def (task_def_id),
    INDEX idx_task_log_step (step_id),
    INDEX idx_task_log_type (log_type),
    INDEX idx_task_log_status (status),
    INDEX idx_task_log_deleted (deleted),
    INDEX idx_task_log_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务执行日志表';
```

## log_type 日志类型说明

| 类型 | 说明 | 使用场景 |
|------|------|---------|
| info | 信息日志 | 步骤开始/完成、变量更新 |
| warn | 警告日志 | 重试、降级、非预期但可恢复的情况 |
| error | 错误日志 | 步骤失败、异常、需要关注的问题 |
| debug | 调试日志 | 详细执行过程、变量值、中间结果 |

## step_type 步骤类型说明

| 类型 | 说明 |
|------|------|
| action | 执行动作步骤 |
| condition | 条件分支步骤 |
| loop | 循环步骤 |
| parallel | 并行执行步骤 |
| wait | 等待步骤 |

## details 字段结构示例

```json
{
  "action": {
    "type": "skill",
    "target": "douyin",
    "params": { "action": "getLiveStatus" }
  },
  "result": {
    "status": "live",
    "viewerCount": 1234
  },
  "error": null,
  "retryCount": 0
}
```

## 关联表

- [t_worktask](./t_worktask.md) - 任务实例表
- [t_task_definition](./t_task_definition.md) - 任务定义表
- [t_task_checkpoint](./t_task_checkpoint.md) - 任务检查点表
