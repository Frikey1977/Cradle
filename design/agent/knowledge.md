# 执行历史知识库设计

## 概述

执行历史知识库采用三层架构，构建完整的业务工作逻辑链：

| 层级 | 评价对象 | 评价方式 | 作用 |
|-----|---------|---------|------|
| **Action** | Skill命令执行 | LLM自动评价 | 确保单个动作质量 |
| **Resource** | 数据源/网址 | LLM自动评价 | 确保资源可用性 |
| **Task** | 任务规划链 | 用户评价 | 确保整体方案质量 |

> **核心思想**：从原子动作到资源依赖，再到任务组合，逐层构建可信赖的业务逻辑。

## 三层架构详解

### 第一层：Action层（原子动作）

#### 定义
Action层记录单个Skill命令的执行质量，包括：
- 命令本身是否正确
- 参数是否合理
- 执行结果是否符合预期
- 错误类型和修复建议

#### 评价维度

```typescript
interface ActionQuality {
  actionId: string;           // 动作ID
  skillId: string;            // Skill标识
  command: string;            // 执行的命令
  parameters: object;         // 参数
  
  // LLM评价结果
  evaluation: {
    correctness: number;      // 正确性 0-1
    efficiency: number;       // 效率 0-1
    safety: number;           // 安全性 0-1
    overall: number;          // 综合评分
  };
  
  // 问题诊断
  issues: {
    type: 'syntax' | 'logic' | 'permission' | 'resource';
    description: string;
    suggestion: string;
  }[];
  
  // 执行结果
  execution: {
    success: boolean;
    duration: number;
    retryCount: number;
    errorCode?: string;
  };
}
```

#### 示例

```json
{
  "actionId": "act-001",
  "skillId": "db-query",
  "command": "SELECT * FROM sales WHERE date > '2025-01-01'",
  "evaluation": {
    "correctness": 0.9,
    "efficiency": 0.6,
    "safety": 0.95,
    "overall": 0.82
  },
  "issues": [
    {
      "type": "efficiency",
      "description": "使用了SELECT *，建议只查询需要的字段",
      "suggestion": "改为 SELECT id, amount, date FROM sales"
    }
  ]
}
```

---

### 第二层：Resource层（资源依赖）

#### 定义
Resource层记录外部资源（API、数据库、网址等）的质量和可用性：
- 资源是否可访问
- 响应时间和稳定性
- 数据质量和准确性
- 临时不可用时的替代方案

#### 资源状态模型

```typescript
interface ResourceQuality {
  resourceId: string;         // 资源ID
  resourceType: 'api' | 'database' | 'url' | 'file';
  identifier: string;         // 资源标识（URL、连接串等）
  
  // 健康状态
  health: {
    status: 'healthy' | 'degraded' | 'unavailable' | 'unknown';
    lastCheck: Date;
    checkMethod: 'ping' | 'probe' | 'synthetic';
  };
  
  // 质量指标
  metrics: {
    availability: number;     // 可用率 0-1
    avgResponseTime: number;  // 平均响应时间(ms)
    errorRate: number;        // 错误率
    dataFreshness: number;    // 数据新鲜度(小时)
  };
  
  // LLM评价
  evaluation: {
    reliability: number;      // 可靠性
    dataQuality: number;      // 数据质量
    overall: number;
  };
  
  // 替代资源
  alternatives: {
    resourceId: string;
    switchCondition: string;  // 切换条件
    priority: number;
  }[];
  
  // 恢复机制
  recovery: {
    autoRetry: boolean;
    maxRetries: number;
    retryInterval: number;    // 重试间隔(秒)
    fallbackAction?: string;  // 降级动作
  };
}
```

#### 健康检查机制

```
┌─────────────────────────────────────────────────────────────┐
│                    资源健康检查机制                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 主动探测（Proactive）                                    │
│     ├── 定时Ping检测                                         │
│     ├── 模拟请求测试                                         │
│     └── 响应时间监控                                         │
│                                                             │
│  2. 被动监控（Reactive）                                     │
│     ├── 记录每次调用的结果                                   │
│     ├── 统计错误率                                           │
│     └── 检测异常模式                                         │
│                                                             │
│  3. 状态流转                                                 │
│     Healthy → Degraded → Unavailable                        │
│        ↑________________________↓                           │
│                    (自动恢复检测)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 示例

```json
{
  "resourceId": "res-sales-api",
  "resourceType": "api",
  "identifier": "https://api.company.com/sales",
  "health": {
    "status": "healthy",
    "lastCheck": "2026-02-14T10:00:00Z",
    "checkMethod": "probe"
  },
  "metrics": {
    "availability": 0.995,
    "avgResponseTime": 120,
    "errorRate": 0.001,
    "dataFreshness": 0.5
  },
  "alternatives": [
    {
      "resourceId": "res-sales-db-direct",
      "switchCondition": "api.error_rate > 0.05",
      "priority": 1
    }
  ],
  "recovery": {
    "autoRetry": true,
    "maxRetries": 3,
    "retryInterval": 5,
    "fallbackAction": "use_cached_data"
  }
}
```

---

### 第三层：Task层（任务规划）

#### 定义
Task层记录完整的任务规划链，由用户评价整体质量：
- 规划是否合理
- 步骤是否完整
- 结果是否满足需求
- 改进建议

#### 评价模型

```typescript
interface TaskQuality {
  taskId: string;             // 任务ID
  executionId: string;        // 关联执行记录
  
  // 规划信息
  plan: {
    steps: TaskStep[];        // 任务步骤
    expectedOutcome: string;  // 预期结果
    resources: string[];      // 依赖资源
  };
  
  // 用户评价
  userFeedback: {
    rating: number;           // 评分 1-5
    satisfaction: 'satisfied' | 'neutral' | 'dissatisfied';
    comments: string;         // 文字评价
    tags: string[];           // 标签
  };
  
  // 效果评估
  outcome: {
    success: boolean;         // 是否达成目标
    accuracy: number;         // 准确性
    completeness: number;     // 完整性
    efficiency: number;       // 效率
  };
  
  // 改进建议（LLM生成）
  improvements: {
    issue: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  
  // 知识沉淀
  knowledge: {
    isValuable: boolean;      // 是否有价值
    patternType: 'best_practice' | 'lesson_learned';
    shareScope: 'private' | 'team' | 'org' | 'global';
  };
}

interface TaskStep {
  stepId: string;
  actionId: string;           // 关联Action
  resourceId?: string;        // 关联Resource
  description: string;
  dependencies: string[];     // 依赖步骤
}
```

#### 用户评价时机

| 时机 | 触发方式 | 评价内容 |
|-----|---------|---------|
| **即时评价** | 任务完成后弹出 | 快速评分 + 标签 |
| **延迟评价** | 24小时后邮件 | 详细反馈 |
| **主动评价** | 用户主动打开 | 完整评价 |

#### 示例

```json
{
  "taskId": "task-001",
  "executionId": "exec-001",
  "plan": {
    "steps": [
      { "stepId": "s1", "actionId": "act-001", "description": "查询销售数据" },
      { "stepId": "s2", "actionId": "act-002", "description": "生成报表" }
    ],
    "expectedOutcome": "提供上季度销售报表"
  },
  "userFeedback": {
    "rating": 4,
    "satisfaction": "satisfied",
    "comments": "结果正确，但希望能提供图表",
    "tags": ["准确", "缺少可视化"]
  },
  "improvements": [
    {
      "issue": "缺少数据可视化",
      "suggestion": "增加图表生成步骤",
      "priority": "medium"
    }
  ],
  "knowledge": {
    "isValuable": true,
    "patternType": "best_practice",
    "shareScope": "org"
  }
}
```

---

## 三层协作机制

### 数据流转

```
┌─────────────────────────────────────────────────────────────────────┐
│                        三层知识协作流程                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户请求                                                            │
│     │                                                               │
│     ▼                                                               │
│  Task层：规划任务链                                                   │
│     ├── 查询历史Task评价 → 选择优秀规划模式                            │
│     │                                                               │
│     ▼                                                               │
│  Resource层：检查资源可用性                                            │
│     ├── 检查依赖资源健康状态                                           │
│     ├── 如有问题 → 切换到替代资源                                      │
│     └── 标记资源使用                                                  │
│     │                                                               │
│     ▼                                                               │
│  Action层：执行Skill命令                                               │
│     ├── 查询历史Action评价 → 优化命令                                  │
│     ├── 执行命令                                                     │
│     └── LLM评价执行质量                                               │
│     │                                                               │
│     ▼                                                               │
│  结果返回 → 用户评价Task层                                            │
│     │                                                               │
│     ▼                                                               │
│  知识更新                                                            │
│     ├── Action层：更新命令质量评分                                     │
│     ├── Resource层：更新资源健康状态                                   │
│     └── Task层：记录用户评价                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 质量传播

```typescript
// 三层质量相互影响
interface QualityPropagation {
  // Action质量影响Task评价
  actionToTask: {
    // 如果Action评分低，Task整体评分受影响
    weight: 0.3,
    rule: "avg(actionScores) * 0.3 + userRating * 0.7"
  };
  
  // Resource质量影响Action执行
  resourceToAction: {
    // 如果资源不可用，Action自动失败
    rule: "if resource.health != 'healthy' then action.success = false"
  };
  
  // Task评价反馈优化Action和Resource
  taskToLower: {
    // 用户差评时，分析是哪个Action或Resource导致
    analysis: "identifyWeakSteps(taskFeedback)",
    action: "flagForReview(actionId | resourceId)"
  };
}
```

---

## 检测与恢复机制

### 资源不可用检测

```typescript
interface UnavailabilityDetection {
  // 检测策略
  strategies: {
    // 1. 错误率突增
    errorSpike: {
      window: '5m',           // 5分钟窗口
      threshold: 0.1,         // 错误率>10%
      action: 'mark_degraded'
    };
    
    // 2. 响应时间异常
    latencySpike: {
      baseline: 'p99',        // 基于P99基准
      multiplier: 3,          // 超过3倍
      action: 'mark_degraded'
    };
    
    // 3. 完全不可达
    unreachable: {
      consecutiveFailures: 3,
      action: 'mark_unavailable'
    };
  };
  
  // 恢复检测
  recovery: {
    // 降级状态持续检测
    degradedCheck: {
      interval: '30s',
      successThreshold: 0.95,  // 95%成功率恢复
      duration: '2m'           // 持续2分钟
    };
    
    // 不可用状态检测
    unavailableCheck: {
      interval: '5m',
      probeCount: 3,           // 连续3次成功
      action: 'mark_healthy'
    };
  };
}
```

### 自动恢复流程

```
┌─────────────────────────────────────────────────────────────┐
│                    资源自动恢复流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  检测到资源不可用                                             │
│     │                                                       │
│     ▼                                                       │
│  1. 立即切换                                                  │
│     ├── 查找替代资源                                          │
│     ├── 更新路由配置                                          │
│     └── 记录切换事件                                          │
│     │                                                       │
│     ▼                                                       │
│  2. 后台恢复检测                                              │
│     ├── 定时探测原资源                                        │
│     ├── 记录探测结果                                          │
│     └── 计算恢复置信度                                        │
│     │                                                       │
│     ▼                                                       │
│  3. 渐进式切回（可选）                                         │
│     ├── 小流量试探                                            │
│     ├── 监控错误率                                            │
│     └── 逐步增加流量                                          │
│     │                                                       │
│     ▼                                                       │
│  4. 知识更新                                                  │
│     ├── 记录资源不稳定历史                                    │
│     ├── 更新资源可靠性评分                                    │
│     └── 优化替代资源选择策略                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 临时不可用处理

```typescript
interface TemporaryUnavailability {
  // 识别临时不可用
  identify: {
    patterns: [
      'rate_limit_exceeded',    // 限流
      'service_temporarily_unavailable',  // 服务临时不可用
      'timeout',                // 超时（可能是网络抖动）
      'connection_reset'        // 连接重置
    ];
    
    // 临时vs永久判断
    decision: {
      temporary: "errorCode in patterns && retrySuccess",
      permanent: "errorCode not in patterns || retryFailed"
    };
  };
  
  // 处理策略
  handle: {
    // 临时不可用：快速重试
    temporary: {
      strategy: 'immediate_retry',
      maxRetries: 3,
      backoff: 'exponential'    // 指数退避
    };
    
    // 疑似永久不可用：切换资源
    permanent: {
      strategy: 'failover',
      action: 'switch_to_alternative'
    };
  };
}
```

---

## 数据库设计

### 表结构

| 表名 | 说明 | 对应层级 |
|-----|------|---------|
| t_execution_knowledge | 执行知识表（统一存储三层知识） | Action/Resource/Task层 |
| t_knowledge_usage | 知识使用记录表 | 三层共用 |
| t_resource_health | 资源健康状态表（待设计） | Resource层 |

详见：
- [执行知识表](./database/t_execution_knowledge.md)
- [知识使用记录表](./database/t_knowledge_usage.md)

> **说明**：MVP阶段采用统一表结构存储三层知识，通过`knowledge_type`字段区分类型。后续根据数据量可考虑分表。

---

## 实施路线图

### Phase 1：Action层（MVP）
- 实现Skill命令执行记录
- LLM自动评价执行质量
- 沉淀常用命令模式

### Phase 2：Resource层
- 实现资源健康检查
- 构建替代资源机制
- 自动故障切换

### Phase 3：Task层
- 实现任务规划评价
- 用户评价收集
- 最佳实践沉淀

### Phase 4：智能优化
- 三层知识联动优化
- 预测性资源调度
- 主动式问题预防

---

## 关联文档

- [执行监控设计](./execution-monitor.md)
- [Agent 运行时层](./runtime.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
