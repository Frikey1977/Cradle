# Cron CLI 设计

## 1. 模块概述

### 1.1 功能定位

Cron CLI 提供命令行方式管理定时任务，支持多种调度策略（at/every/cron），可触发 Agent、工作流或 Skill 执行。

### 1.2 核心价值

- **灵活调度**：支持一次性、周期性、Cron表达式多种调度方式
- **多目标执行**：可触发 Agent、工作流或 Skill
- **执行可追溯**：完整的执行历史记录

### 1.3 使用场景

- **场景1**：定时生成日报/周报
- **场景2**：定时数据同步
- **场景3**：定时巡检和监控
- **场景4**：定时触发工作流

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 任务列表 | 查看所有定时任务 |
| 创建任务 | 添加新的定时任务 |
| 删除任务 | 删除定时任务 |
| 启用/禁用 | 控制任务状态 |
| 查看详情 | 查看任务配置和执行历史 |
| 调度器状态 | 查看调度器运行状态 |

### 2.2 调度类型

| 类型 | 参数 | 说明 | 示例 |
|------|------|------|------|
| **at** | `--at <time>` | 指定时间执行一次 | `--at "2026-02-20T09:00:00Z"` |
| **every** | `--every <duration>` | 按间隔重复执行 | `--every "1h"`（每小时） |
| **cron** | `--cron <expr>` | Cron 表达式 | `--cron "0 9 * * 1-5"`（工作日9点） |

### 2.3 执行目标

| 目标类型 | 说明 | 参数 |
|---------|------|------|
| **Agent** | 向 Agent 发送消息 | `--agent <id> --message <text>` |
| **Workflow** | 触发工作流执行 | `--workflow <id>` |
| **Skill** | 直接调用 Skill | `--skill <id> --input <json>` |
| **System Event** | 发送系统事件 | `--system-event <text>` |

## 3. CLI 命令

### 3.1 命令列表

```bash
# 列出定时任务
cradle cron list [--all] [--json]

# 添加定时任务
cradle cron add \
  --name <name> \
  [--description <text>] \
  [--at <iso-time> | --every <duration> | --cron <expression>] \
  [--tz <timezone>] \
  [--agent <id> --message <text> | --workflow <id> | --skill <id> | --system-event <text>] \
  [--disabled]

# 删除定时任务
cradle cron remove <job-id>

# 启用/禁用任务
cradle cron enable <job-id>
cradle cron disable <job-id>

# 查看任务详情
cradle cron info <job-id> [--json]

# 查看调度器状态
cradle cron status [--json]

# 手动触发任务（立即执行一次）
cradle cron trigger <job-id>
```

### 3.2 使用示例

**创建一次性任务**：
```bash
cradle cron add \
  --name "数据备份" \
  --description "执行数据库备份" \
  --at "2026-02-20T02:00:00Z" \
  --agent "backup-agent" \
  --message "执行今日数据备份"
```

**创建周期性任务**：
```bash
cradle cron add \
  --name "每小时同步" \
  --every "1h" \
  --agent "sync-agent" \
  --message "同步外部数据"
```

**创建 Cron 任务**：
```bash
cradle cron add \
  --name "工作日日报" \
  --cron "0 9 * * 1-5" \
  --tz "Asia/Shanghai" \
  --workflow "daily-report-workflow"
```

**触发工作流**：
```bash
cradle cron add \
  --name "竞品价格跟踪" \
  --cron "0 9 * * *" \
  --tz "Asia/Shanghai" \
  --workflow "competitor-price-tracker"
```

**调用 Skill**：
```bash
cradle cron add \
  --name "定时邮件" \
  --every "30m" \
  --skill "email-sender" \
  --input '{"template":"reminder"}'
```

## 4. 任务执行流程

```
定时触发
    ↓
加载任务配置
    ↓
根据 target_type 选择执行方式：
    ├── agent → 创建会话，发送消息
    ├── workflow → 加载工作流配置，执行
    ├── skill → 直接调用 Skill
    └── system_event → 发送系统事件
    ↓
记录执行结果到历史表
```

## 5. 接口设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/cron/jobs | GET | 列出定时任务 |
| /api/cron/jobs | POST | 创建定时任务 |
| /api/cron/jobs/:id | GET | 获取任务详情 |
| /api/cron/jobs/:id | DELETE | 删除任务 |
| /api/cron/jobs/:id/enable | POST | 启用任务 |
| /api/cron/jobs/:id/disable | POST | 禁用任务 |
| /api/cron/jobs/:id/trigger | POST | 手动触发 |
| /api/cron/status | GET | 调度器状态 |

## 6. 与 Heartbeat 的职责边界

Cron 和 Heartbeat 都是定时执行机制，但设计目标和适用场景完全不同。

### 6.1 核心定位

| 维度 | Cron（定时任务） | Heartbeat（心跳） |
|------|------------------|-------------------|
| **本质** | 精确时间调度系统 | 周期性 Agent 执行机制 |
| **设计目标** | 在指定时间触发特定任务 | 让 Agent 主动"醒来"检查事务 |
| **时间精度** | 精确（按秒级执行） | 近似（允许漂移） |
| **执行模式** | 离散触发，单次或周期 | 持续运行，循环检查 |

### 6.2 Cron 的职责

**Cron 做什么**：
- ✅ 在精确时间点触发任务（每天 9:00、20 分钟后、每周一等）
- ✅ 支持多种执行目标（Agent/工作流/Skill/系统事件）
- ✅ 支持独立会话执行（不污染主会话上下文）
- ✅ 支持一次性、周期性、Cron 表达式调度

**Cron 不做什么**：
- ❌ 不维护 Agent 的持续性上下文
- ❌ 不用于高频检查（最小粒度通常是分钟级）
- ❌ 不主动感知 Agent 状态或用户行为

### 6.3 选择 Cron 的场景

| 场景 | 原因 |
|------|------|
| **每天 9:00 发送日报** | 需要精确时间，独立执行 |
| **20 分钟后提醒我** | 一次性精确时间任务 |
| **每周一 9:00 生成周报** | 周期性精确时间，可用更强模型 |
| **每小时整点同步数据** | 精确到整点，独立会话避免干扰 |
| **每月 1 号数据归档** | 复杂 Cron 表达式调度 |

### 6.4 与 Heartbeat 的对比

| 特性 | Cron | Heartbeat |
|------|------|-----------|
| **调度器** | Cron 表达式解析器 | `setTimeout`链 |
| **存储** | 数据库表（t_cron_job） | 内存状态 |
| **精度** | 精确 | 近似（会漂移） |
| **执行会话** | 可选主会话或独立会话 | 仅主会话 |
| **上下文** | 独立会话干净，主会话继承 | 完整继承 |
| **适用场景** | 定时任务、报告、提醒 | 监控、检查、感知 |

### 6.5 协作关系

```
Cron：精确时间点触发任务
├── 每天 9:00 生成日报
├── 每周一 9:00 生成周报
└── 20 分钟后提醒开会

Heartbeat：周期性检查感知
├── 每 30 分钟检查收件箱
├── 每 15 分钟监控数据异常
└── 感知用户 idle 状态
```

**协作示例**：
```
运营监控系统：

Cron（每天 9:00）：
- 生成昨日运营报告
- 汇总关键指标
- 发送给负责人

Heartbeat（每 15 分钟）：
- 检查网站流量异常
- 检查订单量阈值
- 发现问题立即提醒
```

详细对比参考：[Agent 心跳设计 - 职责边界](../agents/agent-heartbeat.md#5-心跳与cron的职责边界)

## 7. 数据库设计

- [定时任务表](./database/t_cron_job.md)
- [定时任务历史表](./database/t_cron_job_history.md)

## 8. 关联文档

- [定时任务模块](./README.md)
- [Agent 管理模块](../agents/README.md)
- [Agent 心跳设计](../agents/agent-heartbeat.md)
- [工作流编排模块](../workflow/README.md)
- [CLI 基础设施](../system/cli.md)
