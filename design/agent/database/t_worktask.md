# t_worktask 任务主表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_worktask |
| 中文名 | 任务主表 |
| 说明 | 存储运行时任务实例，由 Orchestrator 创建和维护。每个 Worktask 代表一个独立的任务执行单元。 |

## 核心设计原则

**任务定义与实例分离**：
- **任务定义**：静态配置，存储在 `t_task_definition`
- **Worktask 实例**：运行时状态，存储在本表

**生命周期管理**：
- `created` → `planning` → `running` → `completed/failed/cancelled`
- 支持暂停/恢复：`running` ↔ `paused`

**性能指标**：
- Token 使用统计
- 执行耗时统计
- 错误/重试计数

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 任务名称 |
| 3 | description | TEXT | - | NO | NULL | 任务描述 |
| 4 | agent_id | VARCHAR | 36 | YES | - | 关联的 Agent ID |
| 5 | contact_id | VARCHAR | 36 | YES | - | 关联的联系人 ID |
| 6 | conversation_id | VARCHAR | 36 | NO | NULL | 关联的会话 ID |
| 7 | task_def_id | VARCHAR | 36 | NO | NULL | 关联的任务定义 ID |
| 8 | task | TEXT | - | YES | - | 任务描述文本 |
| 9 | status | VARCHAR | 20 | YES | 'created' | 任务状态：created/planning/running/paused/completed/failed/cancelled |
| 10 | plan | JSON | - | NO | NULL | 任务计划（steps/strategy/dependencies） |
| 11 | context | JSON | - | NO | NULL | 任务上下文 |
| 12 | result | JSON | - | NO | NULL | 执行结果 |
| 13 | start_time | DATETIME | - | NO | NULL | 开始时间 |
| 14 | complete_time | DATETIME | - | NO | NULL | 完成时间 |
| 15 | total_duration | INT | - | NO | NULL | 总耗时（毫秒） |
| 16 | token_input | INT | - | NO | NULL | 输入 Token 数 |
| 17 | token_output | INT | - | NO | NULL | 输出 Token 数 |
| 18 | error_count | INT | - | YES | 0 | 错误次数 |
| 19 | retry_count | INT | - | YES | 0 | 重试次数 |
| 20 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 21 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 22 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 23 | status_field | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_worktask | 主键索引 | sid | 主键索引 |
| idx_worktask_agent | 普通索引 | agent_id | Agent查询索引 |
| idx_worktask_contact | 普通索引 | contact_id | 联系人查询索引 |
| idx_worktask_conversation | 普通索引 | conversation_id | 会话查询索引 |
| idx_worktask_def | 普通索引 | task_def_id | 任务定义查询索引 |
| idx_worktask_status | 普通索引 | status | 状态筛选索引 |
| idx_worktask_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_worktask_create_time | 普通索引 | create_time | 创建时间索引 |

## SQL建表语句

```sql
CREATE TABLE t_worktask (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，任务唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '任务名称',
    description TEXT COMMENT '任务描述',
    agent_id VARCHAR(36) NOT NULL COMMENT '关联的 Agent ID',
    contact_id VARCHAR(36) NOT NULL COMMENT '关联的联系人 ID',
    conversation_id VARCHAR(36) COMMENT '关联的会话 ID',
    task_def_id VARCHAR(36) COMMENT '关联的任务定义 ID',
    task TEXT NOT NULL COMMENT '任务描述文本',
    status VARCHAR(20) DEFAULT 'created' COMMENT '任务状态：created/planning/running/paused/completed/failed/cancelled',
    plan JSON COMMENT '任务计划',
    context JSON COMMENT '任务上下文',
    result JSON COMMENT '执行结果',
    start_time DATETIME COMMENT '开始时间',
    complete_time DATETIME COMMENT '完成时间',
    total_duration INT COMMENT '总耗时（毫秒）',
    token_input INT COMMENT '输入 Token 数',
    token_output INT COMMENT '输出 Token 数',
    error_count INT DEFAULT 0 COMMENT '错误次数',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status_field VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_worktask_agent (agent_id),
    INDEX idx_worktask_contact (contact_id),
    INDEX idx_worktask_conversation (conversation_id),
    INDEX idx_worktask_def (task_def_id),
    INDEX idx_worktask_status (status),
    INDEX idx_worktask_deleted (deleted),
    INDEX idx_worktask_create_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务主表';
```

## status 状态说明

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| created | 已创建 | Agent 启动 Orchestrator |
| planning | 规划中 | Orchestrator 拆解任务 |
| running | 执行中 | 启动 Executor |
| paused | 已暂停 | 等待资源/用户输入 |
| completed | 已完成 | 所有步骤执行成功 |
| failed | 已失败 | 执行过程中出错 |
| cancelled | 已取消 | 用户主动取消 |

## plan 字段结构示例

```json
{
  "steps": [
    {
      "id": "step-1",
      "description": "获取用户信息",
      "type": "executor",
      "status": "completed"
    },
    {
      "id": "step-2",
      "description": "分析数据",
      "type": "executor",
      "status": "running"
    }
  ],
  "strategy": "serial",
  "dependencies": {
    "nodes": ["step-1", "step-2"],
    "edges": [{ "from": "step-1", "to": "step-2" }]
  }
}
```

## 关联表

- [t_task_definition](./t_task_definition.md) - 任务定义表
- [t_worktask_todo](./t_worktask_todo.md) - Todo列表表
- [t_worktask_executor](./t_worktask_executor.md) - 执行记录表
- [t_worktask_progress](./t_worktask_progress.md) - 进度事件表
- [t_task_checkpoint](./t_task_checkpoint.md) - 任务检查点表
