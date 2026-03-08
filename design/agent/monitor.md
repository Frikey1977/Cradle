# Agent 执行监控设计（三层架构版）

## 概述

执行监控与三层知识库架构对齐，分别监控 **Action层**、**Resource层**、**Task层** 的执行情况，支持故障排查、性能优化和知识沉淀。

> **监控目标**：为三层知识库提供数据输入，实现"监控-评价-沉淀"闭环。

## 三层监控架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        三层执行监控架构                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Task层监控（任务链）                                                    │
│  ├── 任务规划合理性                                                      │
│  ├── 步骤依赖正确性                                                      │
│  ├── 整体成功率/耗时                                                     │
│  └── 用户评价收集                                                        │
│                              ↓ 聚合                                     │
│  Action层监控（原子动作）                                                 │
│  ├── Skill命令执行                                                       │
│  ├── 参数正确性                                                          │
│  ├── LLM评价结果                                                         │
│  └── 错误类型统计                                                        │
│                              ↓ 依赖                                     │
│  Resource层监控（资源健康）                                               │
│  ├── API/数据库可用性                                                    │
│  ├── 响应时间/错误率                                                     │
│  ├── 自动故障检测                                                        │
│  └── 切换事件记录                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 存储策略

| 层级 | 数据类型 | 存储方式 | 保留期 | 说明 |
|-----|---------|---------|-------|------|
| **Task** | 任务执行记录 | MySQL | 30天 | 整体任务状态 |
| **Action** | 动作执行记录 | MySQL + 日志 | 14天 | 详细执行日志 |
| **Resource** | 资源健康状态 | MySQL | 90天 | 持续监控数据 |
| **审计** | 关键操作 | MySQL | 90天 | 合规必需 |

## 核心数据模型

### Task层 - 任务执行记录

```typescript
interface TaskExecution {
  sid: string;                // 任务执行ID
  agent_id: string;           // Agent ID
  user_id: string;           // 用户ID
  input_text: string;        // 用户输入
  
  // 规划信息
  plan: {
    step_count: number;      // 步骤数
    expected_duration: number; // 预期耗时
  };
  
  // 执行状态
  status: 'planning' | 'running' | 'completed' | 'failed' | 'partial';
  
  // 时间
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  
  // 结果统计
  result: {
    success: boolean;
    completed_steps: number;  // 完成步骤数
    failed_steps: number;     // 失败步骤数
    output?: string;
  };
  
  // 用户评价（Task层特有）
  user_feedback?: {
    rating: number;          // 1-5评分
    satisfaction: string;    // satisfied/neutral/dissatisfied
    comments?: string;
  };
  
  // 关联
  action_ids: string[];      // 关联的Action执行ID
  resource_ids: string[];    // 使用的资源ID
}
```

### Action层 - 动作执行记录

```typescript
interface ActionExecution {
  sid: string;               // 动作执行ID
  task_id: string;          // 所属任务ID
  sequence: number;         // 执行序号
  
  // 动作定义
  action_type: 'skill_invoke' | 'llm_call' | 'tool_call' | 'condition';
  skill_id?: string;        // Skill标识
  command?: string;         // 执行的命令
  parameters?: object;      // 参数
  
  // 依赖资源
  resource_id?: string;     // 使用的资源
  
  // 执行状态
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  
  // 时间
  started_at: Date;
  completed_at?: Date;
  duration_ms?: number;
  
  // 执行结果
  result: {
    success: boolean;
    output?: object;
    error_code?: string;
    error_message?: string;
  };
  
  // LLM评价（Action层特有）
  llm_evaluation?: {
    correctness: number;     // 正确性 0-1
    efficiency: number;      // 效率 0-1
    safety: number;          // 安全性 0-1
    overall: number;         // 综合评分
    issues?: string[];       // 问题列表
    suggestions?: string[];  // 改进建议
  };
  
  // 详细日志（存储在日志文件）
  log_file: string;         // 日志文件路径
}
```

### Resource层 - 资源调用记录

```typescript
interface ResourceExecution {
  sid: string;              // 记录ID
  resource_id: string;      // 资源ID
  action_id: string;        // 关联的Action ID
  
  // 调用信息
  method: string;           // 调用方法
  endpoint?: string;        // 端点
  request_size?: number;    // 请求大小
  
  // 响应信息
  status_code?: number;     // HTTP状态码
  response_size?: number;   // 响应大小
  
  // 性能
  duration_ms: number;      // 耗时
  connect_time?: number;    // 连接时间
  wait_time?: number;       // 等待时间
  
  // 结果
  success: boolean;
  error_type?: 'timeout' | 'connection' | 'rate_limit' | 'server_error' | 'client_error';
  
  // 切换记录（Resource层特有）
  failover?: {
    original_resource: string;    // 原资源
    switched_to: string;          // 切换到
    reason: string;               // 切换原因
  };
}
```

## 监控界面

### 三层监控总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│  执行监控 - 三层总览                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Task层（任务链）                                                        │
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │ 时间        │ Agent    │ 步骤     │ 状态     │ 用户评分 │           │
│  ├─────────────┼──────────┼──────────┼──────────┼──────────┤           │
│  │ 10:23:45    │ HR助手   │ 4/4      │ ✅ 成功  │ ⭐⭐⭐⭐⭐ │           │
│  │ 10:20:12    │ 开发助手 │ 2/5      │ ⚠️ 部分  │ ⭐⭐⭐    │           │
│  │ 10:15:33    │ 销售助手 │ 1/3      │ ❌ 失败  │ ⭐⭐      │           │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┘           │
│                                                                         │
│  Action层（原子动作）                                                     │
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │ 所属任务    │ 类型     │ Skill    │ LLM评分  │ 耗时     │           │
│  ├─────────────┼──────────┼──────────┼──────────┼──────────┤           │
│  │ task-001    │ skill    │ db-query │ 0.85     │ 120ms    │           │
│  │ task-001    │ llm      │ -        │ 0.92     │ 800ms    │           │
│  │ task-002    │ skill    │ api-call │ 0.45 ⚠️  │ 5000ms   │           │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┘           │
│                                                                         │
│  Resource层（资源健康）                                                   │
│  ┌─────────────┬──────────┬──────────┬──────────┬──────────┐           │
│  │ 资源名称    │ 类型     │ 健康状态 │ 可用率   │ 平均耗时 │           │
│  ├─────────────┼──────────┼──────────┼──────────┼──────────┤           │
│  │ sales-api   │ API      │ 🟢 健康  │ 99.5%    │ 120ms    │           │
│  │ hr-db       │ Database │ 🟡 降级  │ 95.2%    │ 500ms ⚠️ │           │
│  │ legacy-api  │ API      │ 🔴 不可用│ 45.0%    │ -        │           │
│  └─────────────┴──────────┴──────────┴──────────┴──────────┘           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Task层详情

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Task详情 - task-001                                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  基本信息                                                                │
│  ├── Agent: HR助手                                                       │
│  ├── 用户: 张三                                                          │
│  ├── 输入: 查询上季度销售数据                                             │
│  ├── 状态: ✅ 成功                                                       │
│  └── 耗时: 3.2s (预期: 2.5s)                                             │
│                                                                         │
│  执行步骤                                                                │
│  ┌─────┬─────────────────┬────────┬─────────┬──────────┐               │
│  │ 序号│ 步骤            │ 类型   │ 状态    │ 耗时     │               │
│  ├─────┼─────────────────┼────────┼─────────┼──────────┤               │
│  │ 1   │ 权限检查        │ check  │ ✅ 成功 │ 50ms     │               │
│  │ 2   │ 查询销售API     │ skill  │ ✅ 成功 │ 800ms    │               │
│  │ 3   │ 数据聚合        │ code   │ ✅ 成功 │ 200ms    │               │
│  │ 4   │ 生成报告        │ llm    │ ✅ 成功 │ 1200ms   │               │
│  └─────┴─────────────────┴────────┴─────────┴──────────┘               │
│                                                                         │
│  用户评价                                                                │
│  ├── 评分: ⭐⭐⭐⭐⭐ (5/5)                                              │
│  ├── 满意度: 满意                                                        │
│  └── 反馈: "结果准确，响应快速"                                          │
│                                                                         │
│  资源使用                                                                │
│  ├── sales-api (API) - 调用1次 - 平均120ms                               │
│  └── report-cache (Redis) - 命中1次                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Action层详情

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Action详情 - action-002                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  基本信息                                                                │
│  ├── 所属任务: task-001                                                  │
│  ├── 类型: skill_invoke                                                  │
│  ├── Skill: db-query                                                     │
│  ├── 命令: SELECT * FROM sales WHERE quarter='Q4'                        │
│  └── 耗时: 890ms                                                         │
│                                                                         │
│  LLM评价                                                                 │
│  ┌─────────────┬────────┬─────────────────────────────────┐             │
│  │ 维度        │ 评分   │ 评价                            │             │
│  ├─────────────┼────────┼─────────────────────────────────┤             │
│  │ Correctness │ 0.90   │ 语法正确，逻辑清晰              │             │
│  │ Efficiency  │ 0.60 ⚠️│ 建议使用索引字段，避免SELECT *  │             │
│  │ Safety      │ 0.95   │ 无SQL注入风险                   │             │
│  │ Overall     │ 0.82   │ 整体良好，有优化空间            │             │
│  └─────────────┴────────┴─────────────────────────────────┘             │
│                                                                         │
│  问题与建议                                                              │
│  ⚠️ 使用了SELECT *，建议只查询需要的字段                                  │
│  💡 建议添加LIMIT防止大数据量查询                                         │
│                                                                         │
│  执行日志                                                                │
│  ├── [10:23:45.123] 开始执行                                             │
│  ├── [10:23:45.234] 连接数据库                                           │
│  ├── [10:23:45.678] 执行查询                                             │
│  ├── [10:23:46.012] 返回15条记录                                         │
│  └── [10:23:46.013] 执行完成                                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Resource层详情

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Resource详情 - sales-api                                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  基本信息                                                                │
│  ├── 名称: 销售数据API                                                   │
│  ├── 类型: API                                                           │
│  ├── 地址: https://api.company.com/sales                                 │
│  └── 健康状态: 🟢 健康                                                   │
│                                                                         │
│  性能指标（近24小时）                                                     │
│  ┌─────────────┬──────────┬──────────┬──────────┐                       │
│  │ 指标        │ 平均值   │ P95      │ P99      │                       │
│  ├─────────────┼──────────┼──────────┼──────────┤                       │
│  │ 响应时间    │ 120ms    │ 200ms    │ 350ms    │                       │
│  │ 可用率      │ 99.5%    │ -        │ -        │                       │
│  │ 错误率      │ 0.1%     │ -        │ -        │                       │
│  │ QPS         │ 45       │ 80       │ 120      │                       │
│  └─────────────┴──────────┴──────────┴──────────┘                       │
│                                                                         │
│  替代资源                                                                │
│  ├── 主资源: sales-api (当前使用中)                                       │
│  └── 备用: sales-db-direct (上次切换: 2026-02-10)                        │
│                                                                         │
│  切换历史                                                                │
│  ├── 2026-02-10 14:23: sales-api → sales-db-direct (原因: 超时)          │
│  └── 2026-02-10 14:45: sales-db-direct → sales-api (原因: 恢复)          │
│                                                                         │
│  最近调用                                                                │
│  ┌─────────────┬──────────┬──────────┬──────────┐                       │
│  │ 时间        │ Action   │ 耗时     │ 结果     │                       │
│  ├─────────────┼──────────┼──────────┼──────────┤                       │
│  │ 10:23:45    │ act-002  │ 120ms    │ 成功     │                       │
│  │ 10:20:12    │ act-015  │ 150ms    │ 成功     │                       │
│  │ 10:15:33    │ act-023  │ 5000ms ⚠️│ 超时     │                       │
│  └─────────────┴──────────┴──────────┴──────────┘                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 日志文件格式

### Task层日志

```
logs/execution/task/
├── 2026-02-14/
│   ├── task-001.json       # Task执行详情
│   └── ...
```

### Action层日志

```
logs/execution/action/
├── 2026-02-14/
│   ├── action-001.jsonl    # Action执行日志
│   └── ...
```

**Action日志格式（JSON Lines）**:
```json
{"ts":"2026-02-14T10:23:45.123Z","level":"INFO","type":"action_start","action_id":"act-001","task_id":"task-001","skill_id":"db-query"}
{"ts":"2026-02-14T10:23:45.234Z","level":"DEBUG","type":"resource_connect","resource_id":"hr-db","duration_ms":111}
{"ts":"2026-02-14T10:23:45.678Z","level":"DEBUG","type":"query_execute","sql":"SELECT...","duration_ms":444}
{"ts":"2026-02-14T10:23:46.013Z","level":"INFO","type":"action_end","action_id":"act-001","duration_ms":890,"success":true}
```

### Resource层日志

```
logs/execution/resource/
├── 2026-02-14/
│   └── resource-calls.jsonl
```

## 数据库设计

- [任务执行记录表](./database/t_task_execution.md) - Task层
- [动作执行记录表](./database/t_action_execution.md) - Action层
- [资源调用记录表](./database/t_resource_execution.md) - Resource层
- [资源健康状态表](./database/t_resource_health.md) - Resource健康
- [审计日志表](./database/t_audit_log.md) - 审计

## 三层数据关联

```
Task (t_task_execution)
    ├── 1:N → Action (t_action_execution)
    │           └── N:1 → Resource (t_resource_execution)
    └── 使用 Resource (t_resource_health)
```

## 与知识库的集成

| 监控层 | 知识库层 | 数据流向 |
|-------|---------|---------|
| Task监控 | Task知识 | 用户评价 → 最佳实践沉淀 |
| Action监控 | Action知识 | LLM评价 → 命令优化建议 |
| Resource监控 | Resource知识 | 健康状态 → 资源可靠性评分 |

## 关联文档

- [执行知识库设计（三层架构）](./execution-knowledge-v2.md)
- [Agent 运行时层](./runtime.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
