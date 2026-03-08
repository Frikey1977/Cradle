# 工作流编排模块设计

> **模块状态：概念设计阶段**
> 
> 本模块目前处于概念设计阶段，详细设计待后续迭代完成。当前文档主要描述核心理念、使用场景和架构方向，具体的数据模型、接口设计和数据库表结构将在后续版本中补充完善。

## 1. 功能定位

**工作流编排**是连接人类员工与 Agent 的桥梁，允许员工通过自然语言描述业务需求，Agent 辅助设计并固化个性化的自动化工作流程。

### 1.1 核心理念

```
┌─────────────────────────────────────────────────────────────┐
│                    人机协作工作流编排                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  人类员工                          Agent                     │
│  ─────────                        ──────                     │
│  描述业务场景  ───────────────→   分析需求                    │
│       ↑                           ↓                         │
│  确认/调整   ←────────────────  生成配置                     │
│       ↑                           ↓                         │
│  使用工作流  ←────────────────  自动执行                     │
│       │                           ↓                         │
│  反馈优化   ────────────────→   持续改进                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键原则**：
- **Skill = 原始能力**（系统提供的基础操作）
- **工作流 = Skill 的动态组合**（由大模型根据需求实时编排）
- **确定性配置**：目标、触发条件、输入输出必须明确
- **灵活执行**：具体实现方式可由大模型自适应调整

### 1.2 与相关模块的关系

```
system-skills（系统级原始能力）
    ├── 定时任务、网络搜索、数据查询、消息通知...
    └── 本模块依赖的基础能力
            ↓
workflow（工作流编排）
    ├── 编排 Skill 的执行顺序和逻辑
    ├── 定义触发条件和约束规则
    └── 固化有效的业务流程
            ↓
agent（Agent 执行层）
    ├── 加载工作流配置
    ├── 运行时动态调度 Skill
    └── 处理异常和自适应调整
```

## 2. 使用场景

### 场景1：竞品价格跟踪

```
员工："我每天需要查看竞品价格，发现降价就通知我"

Agent 分析需求：
├── 识别所需 Skill：
│   ├── [定时任务] 定时执行
│   ├── [网络搜索] 查询竞品价格
│   ├── [数据对比] 对比历史价格
│   └── [消息通知] 发送降价提醒
│
Agent 生成工作流配置：
{
  "name": "竞品价格跟踪",
  "trigger": {
    "type": "scheduled",
    "cron": "0 9 * * *"
  },
  "steps": [
    {
      "skill": "web-search",
      "action": "搜索竞品A当前价格",
      "output": "price_a"
    },
    {
      "skill": "web-search", 
      "action": "搜索竞品B当前价格",
      "output": "price_b"
    },
    {
      "skill": "data-compare",
      "action": "对比昨日价格",
      "condition": "price < yesterday_price",
      "output": "price_drops"
    },
    {
      "skill": "notify",
      "action": "发送降价通知",
      "condition": "price_drops.length > 0",
      "config": {
        "channel": "app",
        "title": "竞品降价提醒",
        "content": "发现 {{price_drops.length}} 个竞品降价"
      }
    }
  ]
}

员工确认 → 保存到个人工作流 → 每天自动执行
```

### 场景2：日报自动生成

```
员工："帮我每天早上自动生成本组昨日工作日报"

Agent 生成工作流：
- 触发：每天9点
- 步骤：
  1. 查询项目管理系统昨日完成任务
  2. 查询代码仓库昨日提交记录
  3. 生成 Markdown 格式日报
  4. 发送到团队群
```

### 场景3：客户跟进提醒

```
员工："客户超过3天没联系就提醒我"

Agent 生成工作流：
- 触发：每天10点
- 步骤：
  1. 查询 CRM 中我负责的客户
  2. 筛选最后联系时间 > 3天的客户
  3. 生成跟进任务列表
  4. 发送提醒通知
```

## 3. 编排流程

```
Step 1: 需求描述（人类员工）
└── 用自然语言描述想要自动化的工作场景

Step 2: 需求分析（Agent）
└── 分析需求，识别需要哪些 Skill
    └── 示例：定时任务 + 数据获取 + 条件判断 + 通知

Step 3: 配置生成（Agent）
└── 生成工作流配置（JSON 格式）
    ├── 触发条件：定时/手动/事件
    ├── 执行步骤：Skill 调用序列
    └── 参数映射：输入输出传递

Step 4: 确认调整（人机协作）
├── 员工查看生成的配置
├── 提出调整："把早上9点改成下午3点"
├── Agent 更新配置
└── 反复迭代直到满意

Step 5: 测试验证
├── 立即执行一次测试
├── 查看执行结果
└── 微调优化

Step 6: 保存启用
├── 保存到个人工作流库
├── 设置启用状态
└── 开始自动执行
```

## 4. 工作流配置模型

### 4.1 三层配置结构

```typescript
interface Workflow {
  // 第一层：确定性配置（用户固化）
  definition: {
    name: string;              // 工作流名称
    goal: string;              // 明确的目标描述
    trigger: TriggerConfig;    // 触发条件（固定）
    inputs: InputConfig[];     // 输入参数（固定）
    outputs: OutputConfig[];   // 输出要求（固定）
    constraints: Constraint[]; // 约束条件（必须遵守）
  };
  
  // 第二层：执行策略（大模型生成，用户可调整）
  strategy: {
    steps: StrategyStep[];     // 执行步骤策略
    fallback: FallbackConfig;  // 异常处理策略
    adaptation: AdaptRule[];   // 自适应规则
  };
  
  // 第三层：运行时实例（每次执行动态生成）
  runtime: {
    executionLog: ExecutionStep[]; // 实际执行记录
    decisions: Decision[];         // 大模型的决策点
    exceptions: Exception[];       // 异常情况
  };
}
```

### 4.2 竞品价格跟踪配置示例

**确定性配置（用户明确指定）**：

```typescript
const workflowDefinition = {
  name: "竞品价格跟踪",
  
  // 明确的目标
  goal: "每天跟踪竞品A、B、C的价格，发现降价时通知我",
  
  // 固定的触发
  trigger: {
    type: "scheduled",
    cron: "0 9 * * *",
    timezone: "Asia/Shanghai"
  },
  
  // 固定的输入
  inputs: [
    {
      name: "competitors",
      type: "array",
      value: [
        { name: "竞品A", url: "https://competitor-a.com/product", selector: ".price" },
        { name: "竞品B", url: "https://competitor-b.com/item", selector: "[data-price]" },
        { name: "竞品C", url: "https://competitor-c.com/goods", selector: ".current-price" }
      ],
      mutable: false
    }
  ],
  
  // 固定的输出要求
  outputs: [
    {
      name: "price_report",
      format: "structured",
      fields: ["competitor", "current_price", "previous_price", "change_percent"]
    }
  ],
  
  // 必须遵守的约束
  constraints: [
    { type: "must_notify_on_drop", threshold: 0 },
    { type: "max_execution_time", value: 300 },
    { type: "retry_on_failure", max_attempts: 3 },
    { type: "human_approval_on_error", when: "all_sources_failed" }
  ]
};
```

**执行策略（灵活但可控）**：

```typescript
const executionStrategy = {
  steps: [
    {
      order: 1,
      action: "fetch_prices",
      description: "访问竞品网站获取价格",
      // 策略：如何获取（大模型决定具体实现）
      implementation: "使用 web-search skill 访问每个 URL，提取价格元素",
      // 自适应：网页结构变化时的处理
      adaptation: {
        enabled: true,
        rule: "如果 selector 找不到元素，尝试智能识别价格区域"
      }
    }
  ],
  
  // 异常处理策略
  fallback: {
    partial_failure: {
      action: "continue",
      notify: true,
      message: "部分竞品价格获取失败：{{failed_sources}}"
    },
    total_failure: {
      action: "escalate",
      notify: true,
      create_task: true,
      assign_to: "owner"
    },
    structure_changed: {
      action: "adapt_and_confirm",
      attempt_auto_fix: true,
      require_approval: true
    }
  }
};
```

## 5. 固化有效流程的方式

### 5.1 从对话中保存

```
员工：帮我跟踪竞品价格

Agent：请告诉我：
       1. 要跟踪哪些竞品？
       2. 从哪些网站获取价格？
       3. 什么时候通知你？
       
员工：跟踪A、B、C三个竞品，从他们的官网获取，每天早上9点通知我

Agent：已理解您的需求。我将：
       - 每天9点查询三个竞品的价格
       - 对比昨日价格
       - 发现降价时通过App通知您
       
       [查看配置] [立即测试] [确认保存]
       
员工：确认

Agent：配置已保存！工作流"竞品价格跟踪"已创建。
       首次执行：明天早上9点
       
       执行过程中如果遇到问题，我会按照预设策略处理，
       并在需要时请您介入。
```

### 5.2 执行后优化

```
Agent：已完成今日竞品价格跟踪：
       ✅ 竞品A：¥199（无变化）
       ⚠️ 竞品B：获取失败（网站访问超时）
       ✅ 竞品C：¥299 → ¥279（降价6.7%）

员工：竞品B经常失败，如果失败就跳过吧

Agent：已记录您的偏好。是否更新工作流配置？
       - 添加规则：单个来源失败时继续执行
       
员工：是的

Agent：配置已更新。下次执行时将应用新规则。
```

## 6. 异常升级机制

```
Level 1: 自动处理（无需通知）
├── 单个来源失败 → 重试 → 跳过
├── 网络波动 → 延迟后重试
└── 临时性错误 → 自动恢复

Level 2: 通知用户（无需介入）
├── 部分失败 → 发送摘要
├── 自适应调整 → 告知调整内容
└── 性能下降 → 提示优化建议

Level 3: 需要用户确认
├── 结构变化 → 自适应后请确认
├── 配置可能过时 → 建议更新
└── 连续多次失败 → 请检查配置

Level 4: 人工介入
├── 全部失败 → 创建任务
├── 安全相关异常 → 立即停止
└── 预算超限 → 暂停执行
```

## 7. 自我优化与自主探索（未来演进）

### 7.1 愿景

**终极目标**：工作流能够自主发现问题、规划改进方案、探索更优解决路径，实现真正的自我进化。

```
人类员工：提出目标和方向
      ↓
工作流：自主规划 → 探索尝试 → 学习优化 → 持续改进
      ↓
人类员工：确认关键决策，授权重大变更
```

### 7.2 自我优化循环

```
┌─────────────────────────────────────────────────────────────┐
│                    工作流自我优化循环                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   观察感知   │ → │   问题识别   │ → │   目标设定   │     │
│  │  (Perceive) │    │  (Identify) │    │   (Goal)    │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         ↑                                    │              │
│         └────────────────────────────────────┘              │
│                      执行与验证                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   效果评估   │ ← │   方案执行   │ ← │   方案规划   │     │
│  │  (Evaluate) │    │  (Execute)  │    │  (Plan)     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 问题收集机制

```typescript
interface ObservationData {
  // 执行数据
  execution: {
    success_rate: number;        // 成功率
    avg_duration: number;        // 平均执行时间
    error_patterns: ErrorPattern[]; // 错误模式
    resource_usage: ResourceMetrics; // 资源使用
  };
  
  // 用户反馈
  user_feedback: {
    explicit_feedback: Feedback[];    // 明确反馈（评分、评论）
    implicit_signals: ImplicitSignal[]; // 隐式信号（重试、修改、放弃）
    satisfaction_trend: Trend;        // 满意度趋势
  };
  
  // 环境变化
  environment: {
    external_api_changes: APIChange[]; // 外部API变更
    data_schema_changes: SchemaChange[]; // 数据结构变更
    business_rule_changes: RuleChange[]; // 业务规则变更
  };
  
  // 对比基准
  benchmark: {
    similar_workflows: Comparison[]; // 相似工作流对比
    industry_best_practices: Practice[]; // 行业最佳实践
    theoretical_optimal: Optimal;    // 理论最优解
  };
}
```

### 7.4 自主规划与探索

```typescript
interface ImprovementPlanner {
  // 基于问题生成改进方案
  generateImprovementPlans(problems: Problem[]): ImprovementPlan[];
  
  // 评估方案可行性
  evaluateFeasibility(plan: ImprovementPlan): FeasibilityScore;
  
  // 预测改进效果
  predictImpact(plan: ImprovementPlan): ImpactPrediction;
}

// 示例：针对"竞品B经常获取失败"生成改进方案
function generateImprovementPlans(problem: Problem): ImprovementPlan[] {
  return [
    {
      id: 'plan-1',
      name: '增加备用数据源',
      description: '为竞品B增加一个备用价格查询源',
      actions: [
        '搜索竞品B的其他价格信息来源',
        '验证备用源的可靠性',
        '修改工作流，添加备用源逻辑'
      ],
      expected_benefit: '将失败率从30%降低到5%',
      risk: 'low',
      requires_approval: false
    },
    {
      id: 'plan-2',
      name: '优化重试策略',
      description: '增加指数退避重试机制',
      actions: [
        '分析失败时间分布',
        '实现智能重试逻辑',
        '测试新策略效果'
      ],
      expected_benefit: '减少临时性失败',
      risk: 'low',
      requires_approval: false
    },
    {
      id: 'plan-3',
      name: '更换数据获取方式',
      description: '从网页抓取改为API调用',
      actions: [
        '调研竞品B是否提供API',
        '申请API访问权限',
        '重构数据获取逻辑'
      ],
      expected_benefit: '从根本上解决稳定性问题',
      risk: 'medium',
      requires_approval: true  // 需要用户批准，涉及架构变更
    }
  ];
}
```

### 7.5 用户交互模式

**主动报告与建议**：

```
Agent：我注意到最近一周"竞品价格跟踪"工作流的成功率有所下降：

       📊 数据分析：
       - 总体成功率：85% → 72%
       - 主要问题：竞品B的网站经常超时（失败率30%）
       - 影响：有3天未能及时发现竞品B的降价

       🔍 原因分析：
       - 竞品B网站响应时间从2秒增加到8秒
       - 可能是对方增加了反爬虫机制

       💡 改进建议：
       方案A：增加备用数据源（预计成功率提升至95%）
       方案B：调整请求频率和重试策略（预计成功率提升至88%）
       方案C：尝试使用竞品B的公开API（需要申请权限）

       [查看详情] [批准方案A] [批准方案B] [自定义方案] [暂时忽略]

员工：批准方案A

Agent：收到！我将：
       1. 搜索竞品B的备用价格信息源
       2. 验证备用源的可靠性
       3. 在一周内进行小规模试点
       4. 试点成功后自动推广
       
       试点期间，我会持续监控效果并及时汇报。
```

### 7.6 演进路线

```
Phase 1: 基础工作流（当前）
├── 人类员工描述需求
├── Agent 生成配置
└── 人类员工确认保存

Phase 2: 智能优化建议（3个月后）
├── 自动收集执行数据
├── 识别性能瓶颈
└── 主动提出优化建议

Phase 3: 自主试点验证（6个月后）
├── 生成多个改进方案
├── 小规模A/B测试
└── 自动验证效果

Phase 4: 半自主优化（12个月后）
├── 低风险变更自动执行
├── 中风险变更试点后自动推广
└── 高风险变更等待人工确认

Phase 5: 全自主进化（远期）
├── 自主发现问题
├── 自主规划方案
├── 自主探索验证
└── 重大决策前征求人类意见
```

## 8. 与定时任务模块的关系

工作流可以通过定时任务模块实现自动触发：

```
定时任务模块（Cron）
    ├── 定时触发
    ├── 调度管理
    └── 执行历史
            ↓
工作流模块（Workflow）
    ├── 加载工作流配置
    ├── 编排 Skill 执行
    └── 异常处理
            ↓
Agent 模块
    └── 实际执行工作流
```

**使用方式**：
```bash
# 通过 cron 模块定时触发工作流
cradle cron add \
  --name "定时工作流" \
  --cron "0 9 * * *" \
  --workflow "daily-report-workflow"
```

详见 [定时任务模块](../cron/README.md)。

## 9. 数据存储

工作流配置存储在独立的数据表中：

```json
{
  "workflow_id": "wf-001",
  "name": "竞品价格跟踪",
  "owner_id": "user-xxx",
  "agent_id": "agent-xxx",
  "definition": {...},
  "strategy": {...},
  "status": "active",
  "version": "1.0.0",
  "create_time": "2026-02-13T10:00:00Z",
  "update_time": "2026-02-13T10:00:00Z"
}
```

## 10. 数据模型（待完善）

> **状态：待详细设计**
> 
> 工作流模块的数据模型将在后续迭代中详细设计。预计包含以下核心实体：
> 
> | 实体 | 说明 | 状态 |
> |-----|------|------|
> | t_workflow | 工作流定义表 | 待设计 |
> | t_workflow_version | 工作流版本表 | 待设计 |
> | t_workflow_execution | 工作流执行记录表 | 待设计 |
> | t_workflow_step | 工作流步骤定义表 | 待设计 |
> | t_workflow_trigger | 工作流触发器表 | 待设计 |

## 11. 接口设计（待完善）

> **状态：待详细设计**
> 
> 工作流模块的接口设计将在后续迭代中补充。预计包含以下功能接口：
> 
> | 功能 | 说明 | 状态 |
> |-----|------|------|
> | 工作流创建 | 基于自然语言描述创建工作流 | 待设计 |
> | 工作流编辑 | 修改工作流配置 | 待设计 |
> | 工作流执行 | 手动触发工作流执行 | 待设计 |
> | 工作流列表 | 查询用户的工作流列表 | 待设计 |
> | 执行历史 | 查询工作流执行记录 | 待设计 |

## 12. 关联文档

- [Agent 管理设计](../agents/agents.md)
- [Agent 运行时](../agents/runtime.md)
- [系统 Skill 管理](../system/skills.md)
- [CLI 基础设施](../system/cli.md)
- [定时任务模块](../cron/README.md)
- [组织 Skill 定义](../organization/skills.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
- [系统设计规范](../DESIGN_SPECIFICATION.md)
