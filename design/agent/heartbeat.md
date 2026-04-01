# Agent 心跳设计

## 1. 设计概述

### 1.1 什么是Agent心跳

Agent心跳是一种**周期性执行机制**，让Agent在后台定期"醒来"检查需要关注的事项，而无需用户主动触发。

**与传统健康检查的区别**：
- ❌ 传统心跳：发送ping检查服务是否存活
- ✅ Agent心跳：在主会话中运行Agent回合，主动检查和处理事务

### 1.2 核心价值

| 价值 | 说明 |
|------|------|
| **主动服务** | Agent主动发现问题，而非被动等待用户询问 |
| **批量处理** | 一次心跳可检查多个事项（邮件、日历、任务等） |
| **上下文感知** | 在主会话执行，Agent了解完整对话历史 |
| **减少打扰** | 智能抑制：无事时静默，有事时提醒 |

### 1.3 典型应用场景

**场景1：个人助理**
```
每30分钟检查：
- 收件箱是否有紧急邮件
- 日历中2小时内是否有会议
- 是否有待办任务到期
→ 发现问题主动提醒用户
```

**场景2：运营监控**
```
每15分钟检查：
- 网站流量是否异常
- 订单量是否低于预期
- 是否有客户投诉
→ 异常时立即通知运营人员
```

**场景3：数据同步**
```
每小时检查：
- 是否有新数据需要同步
- 上次同步任务是否完成
- 同步结果是否需要汇总
→ 自动触发同步并汇报结果
```

## 2. 心跳机制设计（借鉴OpenClaw）

### 2.1 核心架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Heartbeat System                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Scheduler  │  │   Wake      │  │  Executor   │         │
│  │ (setTimeout)│  │  (Event)    │  │  (Agent)    │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                │
│         └────────────────┴────────────────┘                │
│                          ▼                                 │
│              ┌─────────────────────┐                      │
│              │  Heartbeat Manager   │                      │
│              │  - 调度管理          │                      │
│              │  - 状态维护          │                      │
│              │  - 防抖动处理        │                      │
│              └─────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 调度机制

**使用`setTimeout`链而非`setInterval`**：

```
优势：
1. 避免累积误差
2. 支持动态调整间隔
3. 精确控制下次执行时间

执行流程：
10:00:00 执行完成 → 计算下次 10:30:00
                    ↓
              setTimeout(30分钟)
                    ↓
10:30:00 触发执行 → 计算下次 11:00:00
                    ↓
              setTimeout(30分钟)
                    ↓
11:00:00 触发执行 → ...
```

### 2.3 多Agent独立调度

每个Agent维护自己的心跳状态：

| 字段 | 说明 | 示例 |
|------|------|------|
| `intervalMs` | 心跳间隔（毫秒） | 1800000（30分钟） |
| `lastRunMs` | 上次执行时间戳 | 1704067200000 |
| `nextDueMs` | 下次执行时间戳 | 1704069000000 |

**调度策略**：
- 每个Agent可配置不同间隔
- 独立计算各自的下次执行时间
- 批量执行：一次唤醒可执行多个到期的Agent

### 2.4 唤醒机制

支持两种触发方式：

| 触发方式 | 实现 | 用途 |
|---------|------|------|
| **定时触发** | `setTimeout`到期 | 常规周期性执行 |
| **立即触发** | `requestHeartbeatNow()` | 异步事件完成通知 |

**防抖动设计**：
```
DEFAULT_COALESCE_MS = 250ms  // 合并250ms内的多次请求
DEFAULT_RETRY_MS = 1000ms    // 忙时1秒后重试
```

### 2.5 执行流程

```
┌──────────────┐
│   触发执行    │
└──────┬───────┘
       ▼
┌──────────────────┐
│ 1. 检查是否启用   │ ← 心跳功能是否开启？
└──────┬───────────┘
       ▼
┌──────────────────┐
│ 2. 检查活跃时间窗 │ ← 是否在activeHours内？
│   (isWithinActiveHours)   │
└──────┬───────────┘
       ▼
┌──────────────────┐
│ 3. 检查主通道是否忙│ ← 用户是否正在对话？
│   (requests-in-flight)    │
└──────┬───────────┘
       ▼
┌──────────────────┐
│ 4. 检查心跳清单   │ ← HEARTBEAT.md是否存在且有效？
│   (empty-heartbeat-file)  │
└──────┬───────────┘
       ▼
┌──────────────────┐
│ 5. 在主会话运行Agent│ ← 发送心跳提示词
│   (isHeartbeat: true)     │
└──────┬───────────┘
       ▼
┌──────────────────┐
│ 6. 处理响应       │
│    - HEARTBEAT_OK → 静默丢弃
│    - 有内容 → 投递给用户
└──────────────────┘
```

### 2.6 HEARTBEAT_OK 智能抑制

**响应处理规则**：

| Agent回复 | 处理方式 | 说明 |
|-----------|---------|------|
| `HEARTBEAT_OK` | 完全丢弃 | 无事发生，不打扰用户 |
| `HEARTBEAT_OK` + 内容 ≤ 300字符 | 丢弃内容 | 视为确认消息 |
| `HEARTBEAT_OK` + 内容 > 300字符 | 投递内容 | 视为实际消息 |
| 实际内容（不含HEARTBEAT_OK） | 投递给用户 | 有需要关注的事项 |

**位置敏感**：
- HEARTBEAT_OK在**开头或结尾** → 特殊处理
- HEARTBEAT_OK在**中间** → 普通文本处理

### 2.7 忙时处理策略

```
场景：用户正在与Agent对话，心跳时间到了

处理：
1. 检测到主通道有请求在处理
2. 跳过本次心跳执行
3. 记录原因：requests-in-flight
4. 等待下次周期（不补执行）

可选：
- 忙时重试：1秒后再次尝试
- 仍失败则放弃，等下次周期
```

## 3. 配置设计

### 3.1 Agent级心跳配置

存储在 `t_agent` 表的 `heartbeat_config` 字段（JSON）：

```json
{
  "enabled": true,
  "interval": "30m",
  "activeHours": {
    "start": "09:00",
    "end": "22:00",
    "timezone": "Asia/Shanghai"
  },
  "prompt": "检查收件箱、日历和待办事项",
  "target": "last",
  "model": "anthropic/claude-sonnet-4-20250514",
  "includeReasoning": false,
  "ackMaxChars": 300
}
```

### 3.2 配置字段说明

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | boolean | true | 是否启用心跳 |
| `interval` | string | "30m" | 心跳间隔（支持：m/h/d） |
| `activeHours.start` | string | - | 活跃开始时间（HH:MM） |
| `activeHours.end` | string | - | 活跃结束时间（HH:MM） |
| `activeHours.timezone` | string | "users" | 时区（IANA格式或"users"/"local"） |
| `prompt` | string | 系统默认 | 心跳提示词 |
| `target` | string | "last" | 消息投递目标（last/none/频道ID） |
| `model` | string | - | 可选模型覆盖 |
| `includeReasoning` | boolean | false | 是否包含推理过程 |
| `ackMaxChars` | number | 300 | HEARTBEAT_OK后允许的最大字符数 |

### 3.3 全局默认配置

存储在系统配置表，可被Agent级配置覆盖：

```json
{
  "agents": {
    "defaults": {
      "heartbeat": {
        "enabled": true,
        "interval": "30m",
        "target": "last",
        "prompt": "Read HEARTBEAT.md if it exists...",
        "ackMaxChars": 300
      }
    }
  }
}
```

## 4. HEARTBEAT.md 检查清单

### 4.1 文件位置

存储在Agent工作空间根目录：
```
/data/agents/{agent_id}/
├── HEARTBEAT.md      ← 心跳检查清单
├── AGENTS.md         ← Agent角色定义
├── SOUL.md           ← 人格定义
└── memory/           ← 记忆目录
```

### 4.2 文件格式

```markdown
# Heartbeat Checklist

## 检查项

- [ ] 检查收件箱是否有紧急邮件
- [ ] 查看日历中2小时内是否有会议
- [ ] 检查是否有待办任务即将到期
- [ ] 检查上次同步任务是否完成

## 响应规则

1. 如果以上检查都没有异常，回复：HEARTBEAT_OK
2. 如果有需要关注的事项，简要说明并给出建议
3. 不要重复之前已经提醒过的内容
```

### 4.3 设计原则

- **保持简短**：避免token浪费
- **具体可执行**：每项检查都有明确动作
- **结果导向**：明确什么情况下回复HEARTBEAT_OK

## 5. 心跳与Cron的职责边界

### 5.1 核心定位差异

| 维度 | Heartbeat（心跳） | Cron（定时任务） |
|------|-------------------|------------------|
| **本质** | 周期性Agent执行机制 | 精确时间调度系统 |
| **设计目标** | 让Agent主动"醒来"检查事务 | 在指定时间触发特定任务 |
| **时间精度** | 近似（允许漂移） | 精确（按秒级执行） |
| **执行模式** | 持续运行，循环检查 | 离散触发，单次或周期 |
| **适用对象** | Agent实例 | Agent/工作流/Skill/系统事件 |

### 5.2 职责边界清晰划分

#### Heartbeat的职责

**做什么**：
- ✅ 在主会话中周期性运行Agent回合
- ✅ 批量检查多个事项（邮件、日历、任务等）
- ✅ 利用上下文做智能决策
- ✅ 无事时静默（HEARTBEAT_OK），有事时提醒

**不做什么**：
- ❌ 不保证精确执行时间
- ❌ 不处理一次性定时任务
- ❌ 不在独立会话中执行
- ❌ 不用于生成报告等确定性任务

#### Cron的职责

**做什么**：
- ✅ 在精确时间点触发任务
- ✅ 支持多种执行目标（Agent/工作流/Skill/系统事件）
- ✅ 支持独立会话执行（不污染主会话）
- ✅ 支持一次性、周期性、Cron表达式调度

**不做什么**：
- ❌ 不维护Agent的持续性上下文
- ❌ 不用于高频检查（最小粒度通常是分钟级）
- ❌ 不主动感知Agent状态

### 5.3 决策树：选择Heartbeat还是Cron

```
需要让Agent定期"感知"环境并主动响应？
    ├── YES → 使用 Heartbeat
    │         └── 例：每30分钟检查收件箱、监控数据异常
    │
    └── NO → 需要在精确时间点执行特定任务？
              ├── YES → 使用 Cron
              │         ├── 一次性任务？
              │         │   └── 例：20分钟后提醒我开会
              │         ├── 周期性任务？
              │         │   └── 例：每天9点生成日报
              │         └── Cron表达式？
              │             └── 例：工作日每2小时同步一次
              │
              └── NO → 不需要定时机制
```

### 5.4 典型场景对照表

| 场景 | 推荐方案 | 原因分析 |
|------|---------|---------|
| **每30分钟检查收件箱** | **Heartbeat** | 需要上下文感知，批量检查，不严格要求精确时间 |
| **每天9:00发送日报** | **Cron** | 需要精确时间，独立执行，不污染主会话 |
| **20分钟后提醒开会** | **Cron** | 一次性精确时间任务，Heartbeat无法处理 |
| **监控服务器CPU使用率** | **Heartbeat** | 持续监控，上下文累积趋势数据 |
| **每周一9:00生成周报** | **Cron** | 精确时间，可用更强模型独立执行 |
| **用户 idle 8小时后发送问候** | **Heartbeat** | 需要感知用户状态，上下文决定何时发送 |
| **每小时整点同步数据** | **Cron** | 精确到整点，独立会话避免干扰 |
| **检查多个数据源状态** | **Heartbeat** | 批量检查，一次心跳处理多个来源 |

### 5.5 技术实现差异

| 特性 | Heartbeat | Cron |
|------|-----------|------|
| **调度器** | `setTimeout`链 | Cron表达式解析器 |
| **存储** | 内存状态（lastRunMs/nextDueMs） | 数据库表（t_cron_job） |
| **精度** | 近似（会漂移±几秒到几分钟） | 精确（按配置时间执行） |
| **执行会话** | 主会话（main） | 可选：主会话或独立会话（isolated） |
| **上下文继承** | 完整继承 | 主会话继承，独立会话干净 |
| **忙时处理** | 跳过，等下次周期 | 通常排队或强制触发 |
| **失败补偿** | 不补执行 | 可配置是否补执行 |
| **批量能力** | 支持多Agent批量检查 | 单个任务独立触发 |

### 5.6 协作模式

**最佳实践：两者结合使用**

```
Heartbeat（每30分钟）：
├── 检查收件箱紧急邮件
├── 监控数据异常
├── 检查待办任务
└── 感知用户状态

Cron（精确时间点）：
├── 每天9:00生成日报
├── 每周一9:00生成周报
├── 每月1号0:00数据归档
└── 一次性提醒任务
```

**协作示例**：

```
场景：运营监控系统

Heartbeat（每15分钟）：
- 检查网站流量是否异常
- 检查订单量是否低于阈值
- 检查是否有新投诉
→ 发现问题立即提醒

Cron（每天9:00）：
- 生成昨日运营报告
- 汇总昨日关键指标
- 发送给运营负责人
→ 精确时间送达日报
```

### 5.7 常见误区

| 误区 | 正确理解 |
|------|---------|
| "Heartbeat可以替代Cron" | ❌ 错误。Heartbeat不保证精确时间，不能替代定时任务 |
| "Cron可以替代Heartbeat" | ❌ 错误。Cron无法感知上下文，不适合持续监控场景 |
| "Heartbeat是健康检查" | ❌ 错误。Heartbeat是Agent执行机制，不是ping检查 |
| "Cron只能触发工作流" | ❌ 错误。Cron可以触发Agent、Skill、系统事件等多种目标 |

## 6. 数据库设计

### 6.1 扩展 t_agent 表

在现有 `t_agent` 表基础上增加心跳配置字段：

```sql
ALTER TABLE t_agent ADD COLUMN heartbeat_config JSON COMMENT '心跳配置（JSON格式）';
ALTER TABLE t_agent ADD COLUMN heartbeat_enabled TINYINT DEFAULT 1 COMMENT '心跳是否启用：0=停用, 1=启用';
ALTER TABLE t_agent ADD COLUMN heartbeat_interval VARCHAR(20) DEFAULT '30m' COMMENT '心跳间隔';
ALTER TABLE t_agent ADD COLUMN heartbeat_last_run DATETIME COMMENT '上次心跳执行时间';
ALTER TABLE t_agent ADD COLUMN heartbeat_next_run DATETIME COMMENT '下次心跳计划时间';
ALTER TABLE t_agent ADD COLUMN heartbeat_run_count INT DEFAULT 0 COMMENT '心跳执行次数统计';
ALTER TABLE t_agent ADD COLUMN heartbeat_fail_count INT DEFAULT 0 COMMENT '心跳连续失败次数';
```

### 6.2 新增 t_agent_heartbeat_log 表

记录心跳执行历史：

```sql
CREATE TABLE t_agent_heartbeat_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID',
    started_at DATETIME NOT NULL COMMENT '开始时间',
    completed_at DATETIME COMMENT '完成时间',
    duration_ms INT COMMENT '执行时长（毫秒）',
    status VARCHAR(20) COMMENT '状态：ok/empty/error/skipped',
    skip_reason VARCHAR(50) COMMENT '跳过原因',
    prompt TEXT COMMENT '使用的提示词',
    response_preview TEXT COMMENT '响应预览（前200字符）',
    has_media TINYINT DEFAULT 0 COMMENT '是否包含媒体',
    target_channel VARCHAR(50) COMMENT '投递频道',
    delivered TINYINT DEFAULT 0 COMMENT '是否已投递',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    INDEX idx_heartbeat_log_agent (agent_id),
    INDEX idx_heartbeat_log_started (started_at),
    INDEX idx_heartbeat_log_status (status)
) ENGINE=InnoDB COMMENT='Agent心跳执行日志';
```

## 7. 接口设计

### 7.1 管理接口

#### 获取Agent心跳状态

```http
GET /api/agents/{agentId}/heartbeat
```

响应：
```json
{
  "enabled": true,
  "interval": "30m",
  "intervalMs": 1800000,
  "prompt": "检查收件箱、日历和待办事项",
  "target": "last",
  "lastRunAt": "2026-01-15T10:00:00Z",
  "nextRunAt": "2026-01-15T10:30:00Z",
  "runCount": 150,
  "failCount": 0,
  "isWithinActiveHours": true
}
```

#### 更新Agent心跳配置

```http
PUT /api/agents/{agentId}/heartbeat
```

请求体：
```json
{
  "enabled": true,
  "interval": "15m",
  "activeHours": {
    "start": "09:00",
    "end": "18:00",
    "timezone": "Asia/Shanghai"
  },
  "prompt": "检查运营数据异常",
  "target": "dingtalk"
}
```

#### 立即触发心跳

```http
POST /api/agents/{agentId}/heartbeat/trigger
```

请求体：
```json
{
  "reason": "manual-test"
}
```

#### 获取心跳执行历史

```http
GET /api/agents/{agentId}/heartbeat/logs?page=1&size=20
```

### 7.2 内部接口

#### 请求立即执行心跳

```typescript
// 由Cron或其他模块调用
requestHeartbeatNow({
  agentId: "agent-001",
  reason: "exec-event",  // 异步事件完成
  coalesceMs: 250
});
```

## 8. 实现参考

### 8.1 参考文档

- [OpenClaw Heartbeat Design](https://github.com/OpenClaw/docs/blob/main/gateway/heartbeat.md)
- [Cron vs Heartbeat](https://github.com/OpenClaw/docs/blob/main/automation/cron-vs-heartbeat.md)
- [Heartbeat Runner Implementation](https://github.com/OpenClaw/openclaw/blob/main/src/infra/heartbeat-runner.ts)
- [Heartbeat Wake Handler](https://github.com/OpenClaw/openclaw/blob/main/src/infra/heartbeat-wake.ts)

### 8.2 关键实现文件

| 文件 | 说明 |
|------|------|
| `heartbeat-runner.ts` | 心跳执行器核心 |
| `heartbeat-wake.ts` | 唤醒机制实现 |
| `heartbeat-events.ts` | 事件发射 |
| `heartbeat-visibility.ts` | 可见性控制 |

## 9. 注意事项

### 9.1 性能考虑

- **心跳间隔不要太短**：建议最短5分钟，避免API调用过多
- **批量检查**：利用一次心跳检查多个事项
- **智能抑制**：无事时HEARTBEAT_OK不消耗token

### 9.2 可靠性考虑

- **失败重试**：连续失败时告警，避免静默失败
- **超时控制**：设置单次心跳最大执行时间
- **资源隔离**：心跳执行不影响用户正常对话

### 9.3 用户体验

- **活跃时间窗**：避免夜间打扰用户
- **投递目标**：支持按场景投递到不同频道
- **渐进披露**：先显示摘要，用户需要时再展开详情
