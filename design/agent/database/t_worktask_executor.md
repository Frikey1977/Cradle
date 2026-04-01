# t_worktask_executor 执行记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_worktask_executor |
| 中文名 | 执行记录表 |
| 说明 | 存储任务的执行器记录，跟踪执行过程。每个 Executor 代表一个独立的执行单元。 |

## 核心设计原则

**执行器生命周期**：
- `pending` → `running` → `completed/failed/timeout`
- 记录完整的执行过程

**工具调用记录**：
- 通过 `tool_calls` JSON 字段记录所有工具调用
- 包含参数、结果、耗时等详细信息

**错误追踪**：
- 记录错误代码、消息、堆栈
- 支持问题排查和调试

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 执行记录名称 |
| 3 | description | TEXT | - | NO | NULL | 执行记录描述 |
| 4 | worktask_id | VARCHAR | 36 | YES | - | 关联的 Worktask ID |
| 5 | step_id | VARCHAR | 100 | NO | NULL | 关联的步骤 ID |
| 6 | task | TEXT | - | YES | - | 执行任务描述 |
| 7 | status | VARCHAR | 20 | YES | 'pending' | 状态：pending/running/completed/failed/timeout |
| 8 | result | JSON | - | NO | NULL | 执行结果 |
| 9 | error_code | VARCHAR | 50 | NO | NULL | 错误代码 |
| 10 | error_message | TEXT | - | NO | NULL | 错误信息 |
| 11 | error_stack | TEXT | - | NO | NULL | 错误堆栈 |
| 12 | tool_calls | JSON | - | NO | NULL | 工具调用记录 |
| 13 | token_input | INT | - | NO | NULL | 输入 Token 数 |
| 14 | token_output | INT | - | NO | NULL | 输出 Token 数 |
| 15 | start_time | DATETIME | - | NO | NULL | 开始时间 |
| 16 | complete_time | DATETIME | - | NO | NULL | 完成时间 |
| 17 | duration | INT | - | NO | NULL | 执行耗时（毫秒） |
| 18 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 19 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 20 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 21 | status_field | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_worktask_executor | 主键索引 | sid | 主键索引 |
| idx_executor_worktask | 普通索引 | worktask_id | Worktask查询索引 |
| idx_executor_step | 普通索引 | step_id | 步骤查询索引 |
| idx_executor_status | 普通索引 | status | 状态筛选索引 |
| idx_executor_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_worktask_executor (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，执行记录唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '执行记录名称',
    description TEXT COMMENT '执行记录描述',
    worktask_id VARCHAR(36) NOT NULL COMMENT '关联的 Worktask ID',
    step_id VARCHAR(100) COMMENT '关联的步骤 ID',
    task TEXT NOT NULL COMMENT '执行任务描述',
    status VARCHAR(20) DEFAULT 'pending' COMMENT '状态：pending/running/completed/failed/timeout',
    result JSON COMMENT '执行结果',
    error_code VARCHAR(50) COMMENT '错误代码',
    error_message TEXT COMMENT '错误信息',
    error_stack TEXT COMMENT '错误堆栈',
    tool_calls JSON COMMENT '工具调用记录',
    token_input INT COMMENT '输入 Token 数',
    token_output INT COMMENT '输出 Token 数',
    start_time DATETIME COMMENT '开始时间',
    complete_time DATETIME COMMENT '完成时间',
    duration INT COMMENT '执行耗时（毫秒）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status_field VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_executor_worktask (worktask_id),
    INDEX idx_executor_step (step_id),
    INDEX idx_executor_status (status),
    INDEX idx_executor_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行记录表';
```

## status 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待执行 |
| running | 执行中 |
| completed | 已完成 |
| failed | 已失败 |
| timeout | 已超时 |

## tool_calls 字段结构示例

```json
[
  {
    "toolName": "browser_navigate",
    "parameters": { "url": "https://example.com" },
    "result": "页面加载成功",
    "duration": 1500,
    "success": true
  },
  {
    "toolName": "browser_click",
    "parameters": { "selector": "#submit-btn" },
    "result": "点击成功",
    "duration": 200,
    "success": true
  }
]
```

## 关联表

- [t_worktask](./t_worktask.md) - 任务主表
- [t_worktask_todo](./t_worktask_todo.md) - Todo列表表
