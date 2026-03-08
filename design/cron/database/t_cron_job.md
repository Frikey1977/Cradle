# t_cron_job 定时任务表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_cron_job |
| 中文名 | 定时任务表 |
| 说明 | 存储定时调度的任务配置，借鉴OpenClaw的Cron设计 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，任务唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 任务显示名称 |
| 3 | description | TEXT | - | 否 | NULL | 任务描述 |
| 4 | agent_id | VARCHAR | 36 | 否 | NULL | 绑定执行的Agent ID |
| 5 | user_id | VARCHAR | 36 | 否 | NULL | 创建者用户ID |
| 6 | oid | VARCHAR | 36 | 否 | NULL | 组织ID |
| 7 | schedule_type | VARCHAR | 20 | 是 | - | 调度类型：at/every/cron |
| 8 | schedule_at | DATETIME | - | 否 | NULL | 指定执行时间（at类型，ISO 8601） |
| 9 | schedule_interval | BIGINT | - | 否 | NULL | 执行间隔毫秒（every类型） |
| 10 | schedule_expression | VARCHAR | 255 | 否 | NULL | Cron表达式（cron类型） |
| 11 | schedule_timezone | VARCHAR | 50 | 是 | 'UTC' | 时区（IANA格式，如Asia/Shanghai） |
| 12 | session_target | VARCHAR | 20 | 是 | 'isolated' | 会话目标：main/isolated |
| 13 | wake_mode | VARCHAR | 20 | 是 | 'next-heartbeat' | 唤醒模式：next-heartbeat/now |
| 14 | payload_type | VARCHAR | 20 | 是 | - | 负载类型：systemEvent/agentTurn/skill/workflow |
| 15 | payload_content | JSON | - | 是 | - | 负载内容（JSON格式） |
| 16 | delivery_mode | VARCHAR | 20 | 否 | NULL | 投递模式：none/announce |
| 17 | delivery_channel | VARCHAR | 50 | 否 | NULL | 投递通道：dingtalk/wechat/slack等 |
| 18 | delivery_target | VARCHAR | 255 | 否 | NULL | 投递目标（手机号/频道ID等） |
| 19 | delivery_best_effort | TINYINT | 1 | 否 | 0 | 投递失败是否忽略：0=否, 1=是 |
| 20 | delete_after_run | TINYINT | 1 | 否 | 0 | 执行后删除：0=保留, 1=删除（at类型默认1） |
| 21 | state_next_run_at | DATETIME | - | 否 | NULL | 状态：下次执行时间 |
| 22 | state_last_run_at | DATETIME | - | 否 | NULL | 状态：上次执行时间 |
| 23 | state_last_status | VARCHAR | 20 | 否 | NULL | 状态：上次执行状态 ok/error/skipped |
| 24 | state_last_error | TEXT | - | 否 | NULL | 状态：上次错误信息 |
| 25 | state_last_duration_ms | INT | - | 否 | NULL | 状态：上次执行时长（毫秒） |
| 26 | state_run_count | INT | 是 | 0 | 状态：总执行次数 |
| 27 | state_fail_count | INT | 是 | 0 | 状态：连续失败次数 |
| 28 | create_time | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 29 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 30 | timestamp | TIMESTAMP | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 31 | status | TINYINT | 1 | 是 | 1 | 状态：0=停用, 1=启用 |

## 字段详细说明

### schedule_type 调度类型（借鉴OpenClaw）

| 取值 | 说明 | 示例 |
|------|------|------|
| at | 指定时间执行一次 | `2026-02-01T16:00:00Z` |
| every | 按固定间隔重复执行 | 间隔毫秒数，如3600000（1小时） |
| cron | Cron表达式调度 | `0 7 * * *`（每天7点） |

### session_target 会话目标（借鉴OpenClaw）

| 取值 | 说明 | 适用场景 |
|------|------|---------|
| main | 主会话执行 | 需要延续对话上下文，如提醒 |
| isolated | 独立会话执行（默认） | 后台任务，干净上下文，如批量处理 |

**Main Session特点**：
- 复用主会话ID，继承历史上下文
- Payload类型必须是 `systemEvent`
- 适合需要对话连续性的场景

**Isolated Session特点**：
- 每次执行新建会话 `cron:<jobId>`
- 无历史上下文，干净执行环境
- Payload类型通常是 `agentTurn`
- 支持结果投递（delivery）

### wake_mode 唤醒模式（借鉴OpenClaw）

| 取值 | 说明 |
|------|------|
| next-heartbeat | 等待下次心跳周期执行（默认） |
| now | 立即唤醒执行 |

### payload_type 负载类型

| 取值 | 说明 | session_target要求 |
|------|------|-------------------|
| systemEvent | 系统事件 | main |
| agentTurn | Agent执行回合 | isolated |
| skill | 直接调用Skill | isolated |
| workflow | 触发工作流 | isolated |

### payload_content 负载内容（JSON格式）

根据payload_type不同，内容格式不同：

**systemEvent类型**：
```json
{
  "text": "提醒：检查今日待办事项"
}
```

**agentTurn类型**：
```json
{
  "message": "总结昨晚的更新",
  "model": "anthropic/claude-sonnet-4-20250514",
  "thinking": "medium",
  "timeoutSeconds": 60
}
```

**skill类型**：
```json
{
  "skillId": "data-sync",
  "action": "sync",
  "params": {"table": "orders"}
}
```

**workflow类型**：
```json
{
  "workflowId": "daily-report",
  "variables": {"date": "2026-01-15"}
}
```

### delivery_mode 投递模式（借鉴OpenClaw）

仅适用于 `session_target=isolated` 的任务：

| 取值 | 说明 |
|------|------|
| none | 不投递结果 |
| announce | 投递执行结果摘要到指定通道 |

### state_* 状态字段（借鉴OpenClaw）

运行时状态，由调度器自动更新：

| 字段 | 说明 |
|------|------|
| state_next_run_at | 下次计划执行时间 |
| state_last_run_at | 上次实际执行时间 |
| state_last_status | 上次执行状态：ok/error/skipped |
| state_last_error | 上次错误信息（如果有） |
| state_last_duration_ms | 上次执行耗时 |
| state_run_count | 累计执行次数 |
| state_fail_count | 连续失败次数（成功时重置为0） |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_cron_job | 主键索引 | sid | 主键索引 |
| idx_cron_job_agent | 普通索引 | agent_id | Agent查询索引 |
| idx_cron_job_user | 普通索引 | user_id | 创建者查询索引 |
| idx_cron_job_org | 普通索引 |oid | 组织查询索引 |
| idx_cron_job_schedule | 普通索引 | schedule_type | 调度类型索引 |
| idx_cron_job_session | 普通索引 | session_target | 会话目标索引 |
| idx_cron_job_next_run | 普通索引 | state_next_run_at | 下次执行时间索引（调度器使用） |
| idx_cron_job_last_run | 普通索引 | state_last_run_at | 上次执行时间索引 |
| idx_cron_job_status | 普通索引 | status | 状态筛选索引 |
| idx_cron_job_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_cron_job (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，任务唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '任务显示名称',
    description TEXT COMMENT '任务描述',
    agent_id VARCHAR(36) COMMENT '绑定执行的Agent ID',
    user_id VARCHAR(36) COMMENT '创建者用户ID',
   oid VARCHAR(36) COMMENT '组织ID',
    schedule_type VARCHAR(20) NOT NULL COMMENT '调度类型：at/every/cron',
    schedule_at DATETIME COMMENT '指定执行时间（at类型，ISO 8601）',
    schedule_interval BIGINT COMMENT '执行间隔毫秒（every类型）',
    schedule_expression VARCHAR(255) COMMENT 'Cron表达式（cron类型）',
    schedule_timezone VARCHAR(50) NOT NULL DEFAULT 'UTC' COMMENT '时区（IANA格式）',
    session_target VARCHAR(20) NOT NULL DEFAULT 'isolated' COMMENT '会话目标：main/isolated',
    wake_mode VARCHAR(20) NOT NULL DEFAULT 'next-heartbeat' COMMENT '唤醒模式：next-heartbeat/now',
    payload_type VARCHAR(20) NOT NULL COMMENT '负载类型：systemEvent/agentTurn/skill/workflow',
    payload_content JSON NOT NULL COMMENT '负载内容（JSON格式）',
    delivery_mode VARCHAR(20) COMMENT '投递模式：none/announce',
    delivery_channel VARCHAR(50) COMMENT '投递通道：dingtalk/wechat/slack等',
    delivery_target VARCHAR(255) COMMENT '投递目标（手机号/频道ID等）',
    delivery_best_effort TINYINT DEFAULT 0 COMMENT '投递失败是否忽略：0=否, 1=是',
    delete_after_run TINYINT DEFAULT 0 COMMENT '执行后删除：0=保留, 1=删除（at类型默认1）',
    state_next_run_at DATETIME COMMENT '状态：下次执行时间',
    state_last_run_at DATETIME COMMENT '状态：上次执行时间',
    state_last_status VARCHAR(20) COMMENT '状态：上次执行状态 ok/error/skipped',
    state_last_error TEXT COMMENT '状态：上次错误信息',
    state_last_duration_ms INT COMMENT '状态：上次执行时长（毫秒）',
    state_run_count INT NOT NULL DEFAULT 0 COMMENT '状态：总执行次数',
    state_fail_count INT NOT NULL DEFAULT 0 COMMENT '状态：连续失败次数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态：0=停用, 1=启用',
    
    INDEX idx_cron_job_agent (agent_id),
    INDEX idx_cron_job_user (user_id),
    INDEX idx_cron_job_org (org_id),
    INDEX idx_cron_job_schedule (schedule_type),
    INDEX idx_cron_job_session (session_target),
    INDEX idx_cron_job_next_run (state_next_run_at),
    INDEX idx_cron_job_last_run (state_last_run_at),
    INDEX idx_cron_job_status (status),
    INDEX idx_cron_job_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务表';
```

## 与OpenClaw的对比

| 特性 | OpenClaw | 本设计 |
|------|---------|--------|
| **存储方式** | 文件系统（JSON） | 结构化数据库 |
| **调度类型** | at/every/cron | 相同 |
| **会话目标** | main/isolated | 相同 |
| **唤醒模式** | next-heartbeat/now | 相同 |
| **负载类型** | systemEvent/agentTurn | 扩展为4种类型 |
| **投递机制** | announce/none | 相同 |
| **状态管理** | 内存+文件 | 数据库字段 |
| **多租户** | 单用户 | 支持org_id |
| **分布式** | 单实例 | 支持分布式调度 |

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_agent | agent_id | 多对一 |
| t_users | user_id | 多对一 |
| t_cron_job_history | job_id | 一对多 |

## 参考文档

- [OpenClaw Cron Jobs](https://github.com/OpenClaw/docs/blob/main/automation/cron-jobs.md)
- [Cron CLI 设计](../cron-cli.md)
- [定时任务历史表](./t_cron_job_history.md)
