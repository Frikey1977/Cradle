# t_worktask_progress 进度事件表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_worktask_progress |
| 中文名 | 进度事件表 |
| 说明 | 存储任务执行过程中的进度事件，用于实时监控和历史回放。 |

## 核心设计原则

**事件溯源**：
- 记录所有状态变更事件
- 支持事件回放和状态重建

**实时监控**：
- 通过事件流实时展示进度
- 支持进度百分比计算

**审计追踪**：
- 完整记录执行过程
- 支持问题排查和分析

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 进度事件名称 |
| 3 | description | TEXT | - | NO | NULL | 进度事件描述 |
| 4 | worktask_id | VARCHAR | 36 | YES | - | 关联的 Worktask ID |
| 5 | event_type | VARCHAR | 50 | YES | - | 事件类型 |
| 6 | message | TEXT | - | NO | NULL | 事件消息 |
| 7 | details | JSON | - | NO | NULL | 事件详情 |
| 8 | current_step | VARCHAR | 100 | NO | NULL | 当前步骤 ID |
| 9 | current_executor | VARCHAR | 36 | NO | NULL | 当前执行器 ID |
| 10 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 11 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 12 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 13 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_worktask_progress | 主键索引 | sid | 主键索引 |
| idx_progress_worktask | 普通索引 | worktask_id | Worktask查询索引 |
| idx_progress_event_type | 普通索引 | event_type | 事件类型索引 |
| idx_progress_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_progress_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_worktask_progress (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，进度事件唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '进度事件名称',
    description TEXT COMMENT '进度事件描述',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联的 Worktask ID',
    event_type VARCHAR(50) NOT NULL COMMENT '事件类型',
    message TEXT COMMENT '事件消息',
    details JSON COMMENT '事件详情',
    current_step VARCHAR(100) COMMENT '当前步骤 ID',
    current_executor VARCHAR(36) COMMENT '当前执行器 ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_progress_worktask (worktask_id),
    INDEX idx_progress_event_type (event_type),
    INDEX idx_progress_deleted (deleted),
    INDEX idx_progress_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='进度事件表';
```

## event_type 事件类型说明

| 事件类型 | 说明 |
|---------|------|
| created | 任务创建 |
| planning_started | 开始规划 |
| planning_completed | 规划完成 |
| step_started | 步骤开始 |
| step_completed | 步骤完成 |
| step_failed | 步骤失败 |
| executor_spawned | 执行器启动 |
| executor_completed | 执行器完成 |
| executor_failed | 执行器失败 |
| paused | 任务暂停 |
| resumed | 任务恢复 |
| completed | 任务完成 |
| failed | 任务失败 |
| cancelled | 任务取消 |

## details 字段结构示例

```json
{
  "step": {
    "id": "step-1",
    "name": "获取用户信息",
    "type": "executor"
  },
  "progress": {
    "total": 5,
    "completed": 2,
    "percentage": 40
  },
  "duration": 1500
}
```

## 关联表

- [t_worktask](./t_worktask.md) - 任务主表
- [t_worktask_executor](./t_worktask_executor.md) - 执行记录表
