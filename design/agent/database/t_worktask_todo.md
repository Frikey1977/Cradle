# t_worktask_todo Todo列表表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_worktask_todo |
| 中文名 | Todo列表表 |
| 说明 | 存储任务的 Todo 项，跟踪任务进度。Todo 与 Plan Step 可以是一对多关系。 |

## 核心设计原则

**Todo 与 Step 关系**：
- 一个 Step 可以对应多个 Todo
- Todo 状态变化触发 Step 状态更新
- Todo 完成度决定 Step 完成度

**排序机制**：
- 使用 `todo_order` 字段维护顺序
- 支持动态插入和重新排序

**状态同步**：
- Todo 状态变更时同步更新 Step 状态
- 支持批量状态更新

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | Todo 名称 |
| 3 | description | TEXT | - | NO | NULL | Todo 描述 |
| 4 | worktask_id | VARCHAR | 36 | YES | - | 关联的 Worktask ID |
| 5 | content | TEXT | - | YES | - | Todo 内容 |
| 6 | todo_order | INT | - | YES | 0 | 排序顺序 |
| 7 | status | VARCHAR | 20 | YES | 'pending' | 状态：pending/in_progress/completed/failed/skipped |
| 8 | step_id | VARCHAR | 100 | NO | NULL | 关联的步骤 ID |
| 9 | executor_id | VARCHAR | 36 | NO | NULL | 关联的执行器 ID |
| 10 | result | TEXT | - | NO | NULL | 执行结果 |
| 11 | error_message | TEXT | - | NO | NULL | 错误信息 |
| 12 | start_time | DATETIME | - | NO | NULL | 开始时间 |
| 13 | complete_time | DATETIME | - | NO | NULL | 完成时间 |
| 14 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 15 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 16 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 17 | status_field | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_worktask_todo | 主键索引 | sid | 主键索引 |
| idx_todo_worktask | 普通索引 | worktask_id | Worktask查询索引 |
| idx_todo_step | 普通索引 | step_id | 步骤查询索引 |
| idx_todo_executor | 普通索引 | executor_id | 执行器查询索引 |
| idx_todo_status | 普通索引 | status | 状态筛选索引 |
| idx_todo_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_worktask_todo (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，Todo 唯一标识',
    name VARCHAR(200) NOT NULL COMMENT 'Todo 名称',
    description TEXT COMMENT 'Todo 描述',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联的 Worktask ID',
    content TEXT NOT NULL COMMENT 'Todo 内容',
    todo_order INT DEFAULT 0 COMMENT '排序顺序',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending/in_progress/completed/failed/skipped',
    step_id VARCHAR(100) COMMENT '关联的步骤 ID',
    executor_id VARCHAR(36) COMMENT '关联的执行器 ID',
    result TEXT COMMENT '执行结果',
    error_message TEXT COMMENT '错误信息',
    start_time DATETIME COMMENT '开始时间',
    complete_time DATETIME COMMENT '完成时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status_field VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_todo_worktask (worktask_id),
    INDEX idx_todo_step (step_id),
    INDEX idx_todo_executor (executor_id),
    INDEX idx_todo_status (status),
    INDEX idx_todo_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Todo列表表';
```

## status 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| in_progress | 处理中 |
| completed | 已完成 |
| failed | 已失败 |
| skipped | 已跳过 |

## 关联表

- [t_worktask](./t_worktask.md) - 任务主表
- [t_worktask_executor](./t_worktask_executor.md) - 执行记录表
