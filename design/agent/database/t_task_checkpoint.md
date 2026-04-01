# t_task_checkpoint 任务检查点表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_task_checkpoint |
| 中文名 | 任务检查点表 |
| 说明 | 存储任务执行过程中的检查点，支持暂停/恢复、故障恢复。 |

## 核心设计原则

**检查点机制**：
- 定期保存任务执行状态
- 支持从任意检查点恢复执行
- 用于长程任务的容错

**检查点类型**：
- `auto`：自动保存（每步完成后）
- `manual`：手动保存
- `pause`：暂停时保存
- `wait`：等待用户/事件时保存

**状态管理**：
- `active`：有效检查点，可用于恢复
- `expired`：过期检查点，任务完成后标记

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 检查点名称 |
| 3 | description | TEXT | - | NO | NULL | 检查点描述 |
| 4 | worktask_id | VARCHAR | 36 | YES | - | 关联的 Worktask ID |
| 5 | task_def_id | VARCHAR | 36 | NO | NULL | 关联的任务定义ID |
| 6 | current_step_id | VARCHAR | 100 | NO | NULL | 当前步骤ID |
| 7 | variables | JSON | - | NO | NULL | 变量状态快照 |
| 8 | execution_log | JSON | - | NO | NULL | 执行日志快照 |
| 9 | iteration | INT | - | NO | 0 | 当前迭代次数 |
| 10 | checkpoint_type | VARCHAR | 20 | YES | - | 检查点类型：auto/manual/pause/wait |
| 11 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 12 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 13 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 14 | status | VARCHAR | 20 | YES | 'active' | 状态: active=有效, expired=过期 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_task_checkpoint | 主键索引 | sid | 主键索引 |
| idx_task_cp_worktask | 普通索引 | worktask_id | Worktask查询索引 |
| idx_task_cp_def | 普通索引 | task_def_id | 任务定义查询索引 |
| idx_task_cp_step | 普通索引 | current_step_id | 步骤查询索引 |
| idx_task_cp_type | 普通索引 | checkpoint_type | 类型筛选索引 |
| idx_task_cp_status | 普通索引 | status | 状态筛选索引 |
| idx_task_cp_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_task_cp_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_task_checkpoint (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，检查点唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '检查点名称',
    description TEXT COMMENT '检查点描述',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联的 Worktask ID',
    task_def_id VARCHAR(36) COMMENT '关联的任务定义ID',
    current_step_id VARCHAR(100) COMMENT '当前步骤ID',
    variables JSON COMMENT '变量状态快照',
    execution_log JSON COMMENT '执行日志快照',
    iteration INT DEFAULT 0 COMMENT '当前迭代次数',
    checkpoint_type VARCHAR(20) NOT NULL COMMENT '检查点类型：auto/manual/pause/wait',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态：active=有效, expired=过期',
    
    INDEX idx_task_cp_worktask (worktask_id),
    INDEX idx_task_cp_def (task_def_id),
    INDEX idx_task_cp_step (current_step_id),
    INDEX idx_task_cp_type (checkpoint_type),
    INDEX idx_task_cp_status (status),
    INDEX idx_task_cp_deleted (deleted),
    INDEX idx_task_cp_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务检查点表';
```

## checkpoint_type 检查点类型说明

| 类型 | 说明 | 触发时机 |
|------|------|---------|
| auto | 自动检查点 | 每个步骤执行完成后自动保存 |
| manual | 手动检查点 | 用户/API 显式请求保存 |
| pause | 暂停检查点 | 任务暂停时保存 |
| wait | 等待检查点 | 等待用户输入或外部事件时保存 |

## variables 字段结构示例

```json
{
  "liveUrl": "https://live.douyin.com/123456",
  "liveStatus": {
    "status": "live",
    "viewerCount": 1234
  },
  "continue": true,
  "iteration": 5
}
```

## 关联表

- [t_worktask](./t_worktask.md) - 任务实例表
- [t_task_definition](./t_task_definition.md) - 任务定义表
- [t_task_execution_log](./t_task_execution_log.md) - 任务执行日志表
