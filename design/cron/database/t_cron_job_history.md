# t_cron_job_history 定时任务执行历史表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_cron_job_history |
| 中文名 | 定时任务执行历史表 |
| 说明 | 记录定时任务的每次执行历史，借鉴OpenClaw的Run Log设计 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，历史记录唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 记录显示名称 |
| 3 | description | TEXT | - | 否 | NULL | 记录描述 |
| 4 | job_id | VARCHAR | 36 | 是 | - | 关联的任务ID |
| 5 | agent_id | VARCHAR | 36 | 否 | NULL | 执行的Agent ID |
| 6 | user_id | VARCHAR | 36 | 否 | NULL | 创建者用户ID |
| 7 | oid | VARCHAR | 36 | 否 | NULL | 组织ID |
| 8 | session_id | VARCHAR | 64 | 否 | NULL | 执行会话ID（isolated任务为cron:<jobId>） |
| 9 | session_target | VARCHAR | 20 | 是 | - | 会话目标：main/isolated |
| 10 | payload_type | VARCHAR | 20 | 是 | - | 负载类型 |
| 11 | action | VARCHAR | 20 | 是 | 'finished' | 动作类型：finished |
| 12 | execution_status | VARCHAR | 20 | 是 | - | 执行状态：ok/error/skipped |
| 13 | error | TEXT | - | 否 | NULL | 错误信息 |
| 14 | summary | TEXT | - | 否 | NULL | 执行结果摘要 |
| 15 | output | LONGTEXT | - | 否 | NULL | 完整执行输出（最大4MB，超过则截断） |
| 16 | started_at | DATETIME | 是 | - | 开始执行时间 |
| 17 | completed_at | DATETIME | 否 | NULL | 完成时间 |
| 18 | duration_ms | INT | 否 | NULL | 执行时长（毫秒） |
| 19 | next_run_at | DATETIME | 否 | NULL | 下次计划执行时间（写入时计算） |
| 20 | delivery_status | VARCHAR | 20 | 否 | NULL | 投递状态：success/failed/skipped |
| 21 | delivery_error | TEXT | - | 否 | NULL | 投递错误信息 |
| 22 | create_time | DATETIME | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 23 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 24 | timestamp | TIMESTAMP | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 25 | status | TINYINT | 1 | 是 | 1 | 状态：0=停用, 1=启用 |

## 字段详细说明

### action 动作类型

| 取值 | 说明 |
|------|------|
| finished | 执行完成（目前仅支持此类型） |

### execution_status 执行状态（借鉴OpenClaw）

| 取值 | 说明 |
|------|------|
| ok | 执行成功 |
| error | 执行失败 |
| skipped | 被跳过（如任务被禁用或条件不满足） |

### session_target 会话目标

记录实际执行时使用的会话目标：

| 取值 | 说明 |
|------|------|
| main | 主会话执行 |
| isolated | 独立会话执行 |

### delivery_status 投递状态

仅当任务配置了delivery时有效：

| 取值 | 说明 |
|------|------|
| success | 投递成功 |
| failed | 投递失败 |
| skipped | 未投递（如delivery_mode=none） |

## 借鉴OpenClaw的设计

### Run Log 格式对比

**OpenClaw（JSONL文件）**：
```json
{"ts":1704067200000,"jobId":"job-xxx","action":"finished","status":"ok","durationMs":1500,"nextRunAtMs":1704153600000}
```

**本设计（数据库表）**：
- 将JSONL的字段映射为表字段
- 增加关系型字段（job_id, agent_id, user_id, oid）
- 增加投递相关字段（delivery_status, delivery_error）
- 支持更灵活的查询和统计

### 自动清理策略（借鉴OpenClaw）

OpenClaw的Run Log自动清理策略：
- 最大文件大小：2MB
- 最大保留行数：2000行

本设计建议的清理策略：
- 按时间清理：保留最近90天的记录
- 按数量清理：每个任务保留最近500次执行记录
- 可配置：支持自定义保留策略

### output 字段存储策略

| 策略 | 说明 |
|-----|------|
| 大小限制 | 最大4MB，超过则截断并标记 |
| 压缩存储 | 可选Gzip压缩（节省约70%空间） |
| 大输出处理 | 超过4MB时，存储前2000字符+对象存储引用 |
| 对象存储 | 大输出可存储到S3/OSS，表中存URL引用 |

**推荐方案**：
- MVP阶段：直接存储到LONGTEXT，限制4MB
- 生产阶段：>100KB的输出存储到对象存储，表中存引用URL

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_cron_job_history | 主键索引 | sid | 主键索引 |
| idx_cron_history_job | 普通索引 | job_id | 任务查询索引 |
| idx_cron_history_agent | 普通索引 | agent_id | Agent查询索引 |
| idx_cron_history_user | 普通索引 | user_id | 创建者查询索引 |
| idx_cron_history_org | 普通索引 | oid | 组织查询索引 |
| idx_cron_history_status | 普通索引 | status | 状态筛选索引 |
| idx_cron_history_started | 普通索引 | started_at | 开始时间索引 |
| idx_cron_history_completed | 普通索引 | completed_at | 完成时间索引 |
| idx_cron_history_job_started | 联合索引 | job_id, started_at | 任务执行历史查询 |
| idx_cron_history_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_cron_job_history (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，历史记录唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '记录显示名称',
    description TEXT COMMENT '记录描述',
    job_id VARCHAR(36) NOT NULL COMMENT '关联的任务ID',
    agent_id VARCHAR(36) COMMENT '执行的Agent ID',
    user_id VARCHAR(36) COMMENT '创建者用户ID',
    oid VARCHAR(36) COMMENT '组织ID',
    session_id VARCHAR(64) COMMENT '执行会话ID（isolated任务为cron:<jobId>）',
    session_target VARCHAR(20) NOT NULL COMMENT '会话目标：main/isolated',
    payload_type VARCHAR(20) NOT NULL COMMENT '负载类型',
    action VARCHAR(20) NOT NULL DEFAULT 'finished' COMMENT '动作类型：finished',
    execution_status VARCHAR(20) NOT NULL COMMENT '执行状态：ok/error/skipped',
    error TEXT COMMENT '错误信息',
    summary TEXT COMMENT '执行结果摘要',
    output LONGTEXT COMMENT '完整执行输出',
    started_at DATETIME NOT NULL COMMENT '开始执行时间',
    completed_at DATETIME COMMENT '完成时间',
    duration_ms INT COMMENT '执行时长（毫秒）',
    next_run_at DATETIME COMMENT '下次计划执行时间（写入时计算）',
    delivery_status VARCHAR(20) COMMENT '投递状态：success/failed/skipped',
    delivery_error TEXT COMMENT '投递错误信息',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态：0=停用, 1=启用',
    
    INDEX idx_cron_history_job (job_id),
    INDEX idx_cron_history_agent (agent_id),
    INDEX idx_cron_history_user (user_id),
    INDEX idx_cron_history_org (org_id),
    INDEX idx_cron_history_started (started_at),
    INDEX idx_cron_history_completed (completed_at),
    INDEX idx_cron_history_job_started (job_id, started_at),
    INDEX idx_cron_history_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='定时任务执行历史表';
```

## 与OpenClaw Run Log的对比

| 特性 | OpenClaw Run Log | 本设计 |
|------|-----------------|--------|
| **存储格式** | JSONL文件 | 结构化数据库表 |
| **文件路径** | `~/.openclaw/cron/runs/<jobId>.jsonl` | 数据库表 |
| **记录标识** | ts + jobId | sid（UUID） |
| **关联关系** | 仅jobId | 支持agent/users/org多维度 |
| **查询能力** | 顺序读取，需遍历 | SQL灵活查询 |
| **自动清理** | 2MB/2000行限制 | 可配置策略（时间/数量） |
| **投递记录** | 包含在summary中 | 独立字段（delivery_status） |
| **分布式** | 单实例 | 支持分布式 |

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_cron_job | job_id | 多对一 |
| t_agent | agent_id | 多对一 |
| t_users | user_id | 多对一 |

## 参考文档

- [OpenClaw Cron Jobs - Storage & History](https://github.com/OpenClaw/docs/blob/main/automation/cron-jobs.md#storage--history)
- [Cron CLI 设计](../cron-cli.md)
- [定时任务表](./t_cron_job.md)
