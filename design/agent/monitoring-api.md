# 运行时监控接口设计

## 1. 概述

### 1.1 设计目标

为企业环境提供**透明、可控、可观测**的 Agent 运行监控能力，支持：

- **实时可视化**：任务分解、执行流程、资源使用实时展示
- **审计追踪**：完整的执行记录和操作日志
- **性能分析**：识别瓶颈、优化资源使用
- **故障排查**：快速定位问题、分析根因
- **合规报告**：满足企业审计和合规要求

### 1.2 架构定位

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端监控面板                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 任务分解视图 │  │ 执行流程图   │  │ 实时日志    │             │
│  │  (树形)     │  │  (流程图)   │  │  (时间轴)   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 性能指标    │  │ 资源监控    │  │ 审计日志    │             │
│  │  (图表)     │  │  (仪表盘)   │  │  (表格)     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ WebSocket / SSE / HTTP
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TaskMonitor (监控中心)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 事件收集器   │  │ 状态聚合器   │  │ 历史记录器   │             │
│  │ (EventBus)  │  │ (Aggregator)│  │ (Recorder)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 告警处理器   │  │ 数据导出器   │  │ 查询引擎    │             │
│  │ (Alerter)   │  │ (Exporter)  │  │ (Query)     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ 订阅事件
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Agent 运行时层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ContextManager│  │ SubAgent    │  │ LLMService  │             │
│  │ (产生事件)  │  │ (产生事件)  │  │ (产生事件)  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 核心组件

### 2.1 TaskMonitor 监控中心

```typescript
class TaskMonitor {
  private eventBus: EventEmitter;
  private subscribers: Map<string, Set<WebSocket>> = new Map();
  private historyStore: HistoryStore;
  private metricsCollector: MetricsCollector;
  private alertManager: AlertManager;
  
  // ========== 事件处理 ==========
  
  // 接收事件
  emit(event: MonitorEvent): void;
  
  // 订阅实时事件
  subscribe(sessionId: string, ws: WebSocket): void;
  unsubscribe(sessionId: string, ws: WebSocket): void;
  
  // ========== 查询接口 ==========
  
  // 获取会话追踪
  getSessionTrace(sessionId: string): Promise<SessionTrace>;
  
  // 获取任务详情
  getTaskDetail(taskId: string): Promise<TaskExecutionDetail>;
  
  // 获取执行流程图
  getFlowchart(sessionId: string): Promise<FlowchartData>;
  
  // 获取甘特图
  getGanttChart(sessionId: string): Promise<GanttData>;
  
  // 获取时间线
  getTimeline(sessionId: string): Promise<TimelineData>;
  
  // 获取性能指标
  getMetrics(sessionId: string): Promise<SessionMetrics>;
  
  // ========== 数据导出 ==========
  
  // 导出会话记录
  exportSession(sessionId: string, format: 'json' | 'markdown' | 'pdf'): Promise<Buffer>;
  
  // 批量导出
  exportSessions(filter: SessionFilter, format: string): Promise<Buffer>;
}
```

### 2.2 事件类型定义

```typescript
// 基础事件
interface MonitorEvent {
  id: string;                    // 事件唯一ID
  timestamp: number;             // 事件发生时间
  type: EventType;               // 事件类型
  
  // 关联信息
  sessionId: string;             // 会话ID
  agentId: string;               // Agent ID
  taskId?: string;               // 任务ID（可选）
  stepId?: string;               // 步骤ID（可选）
  
  // 事件数据
  data: EventData;
  
  // 元数据
  metadata: {
    userId?: string;
    organizationId?: string;
    source: 'master' | 'sub' | 'system';
    severity: 'info' | 'warn' | 'error' | 'critical';
  };
}

// 事件类型枚举
type EventType =
  // 会话生命周期
  | 'session:started'
  | 'session:ended'
  | 'session:paused'
  | 'session:resumed'
  
  // 任务编排
  | 'orchestration:started'
  | 'orchestration:task:created'
  | 'orchestration:task:assigned'
  | 'orchestration:task:started'
  | 'orchestration:task:step'
  | 'orchestration:task:completed'
  | 'orchestration:task:failed'
  | 'orchestration:task:retried'
  | 'orchestration:completed'
  | 'orchestration:failed'
  
  // ReAct 循环
  | 'react:thought'
  | 'react:action'
  | 'react:observation'
  | 'react:step:completed'
  
  // 工具调用
  | 'tool:called'
  | 'tool:completed'
  | 'tool:failed'
  | 'tool:timeout'
  
  // LLM 调用
  | 'llm:called'
  | 'llm:stream:start'
  | 'llm:stream:chunk'
  | 'llm:stream:end'
  | 'llm:completed'
  | 'llm:failed'
  | 'llm:timeout'
  
  // 上下文管理
  | 'context:built'
  | 'context:compressed'
  | 'context:memory:retrieved'
  | 'context:memory:stored'
  
  // 子 Agent
  | 'subagent:spawned'
  | 'subagent:started'
  | 'subagent:step'
  | 'subagent:completed'
  | 'subagent:terminated'
  | 'subagent:failed'
  
  // 系统事件
  | 'system:error'
  | 'system:warning'
  | 'system:resource:low'
  | 'system:config:changed';
```

## 3. 查询接口

### 3.1 会话追踪

```typescript
// GET /api/monitoring/sessions/:sessionId/trace
interface SessionTrace {
  sessionId: string;
  agentId: string;
  userId?: string;
  
  // 时间信息
  startTime: number;
  endTime?: number;
  duration?: number;
  
  // 状态
  status: 'running' | 'completed' | 'failed' | 'paused';
  
  // 任务树
  rootTask: TaskTreeNode;
  
  // 统计信息
  statistics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalSteps: number;
    totalToolCalls: number;
    totalLLMCalls: number;
  };
  
  // 资源使用
  resourceUsage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
    executionTime: number;
  };
  
  // 事件时间线
  timeline: TimelineEvent[];
  
  // 错误汇总
  errors?: ErrorSummary[];
}

interface TaskTreeNode {
  id: string;
  title: string;
  description: string;
  type: string;                  // 任务类型
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // 执行信息
  agentType: string;             // 执行的 Agent 类型
  agentId?: string;              // Agent 实例ID
  
  // 时间
  startTime?: number;
  endTime?: number;
  duration?: number;
  
  // 资源
  tokenUsage: {
    prompt: number;
    completion: number;
    total: number;
  };
  
  // 子任务
  children: TaskTreeNode[];
  
  // 步骤
  steps?: ReActStepDetail[];
}
```

### 3.2 任务执行详情

```typescript
// GET /api/monitoring/tasks/:taskId/detail
interface TaskExecutionDetail {
  taskId: string;
  sessionId: string;
  
  // 基本信息
  description: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // Agent 信息
  agentType: string;
  agentId?: string;
  agentConfig?: AgentConfigSnapshot;
  
  // 执行时间线
  timeline: {
    created: number;
    assigned?: number;
    started?: number;
    completed?: number;
    failed?: number;
    retried?: number[];
  };
  
  // ReAct 步骤详情
  steps: ReActStepDetail[];
  
  // 上下文快照
  contextSnapshots: ContextSnapshot[];
  
  // 工具调用记录
  toolCalls: ToolCallRecord[];
  
  // LLM 调用记录
  llmCalls: LLMCallRecord[];
  
  // 结果
  result?: TaskResultDetail;
  error?: TaskErrorDetail;
  
  // 性能指标
  performance: {
    totalDuration: number;
    llmLatency: number;
    toolLatency: number;
    tokenThroughput: number;
  };
}

interface ReActStepDetail {
  stepNumber: number;
  timestamp: number;
  duration: number;
  
  // ReAct 三要素
  thought: string;
  action: {
    type: string;
    tool?: string;
    parameters?: any;
    content?: string;
  };
  observation?: string;
  
  // 执行结果
  status: 'completed' | 'failed';
  error?: string;
  
  // Token 使用
  tokenUsage?: {
    prompt: number;
    completion: number;
  };
}
```

### 3.3 可视化数据

```typescript
// GET /api/monitoring/sessions/:sessionId/flowchart
interface FlowchartData {
  nodes: FlowchartNode[];
  edges: FlowchartEdge[];
  layout: {
    direction: 'TB' | 'LR';      // 布局方向
    rankSep: number;              // 层间距
    nodeSep: number;              // 节点间距
  };
}

interface FlowchartNode {
  id: string;
  type: 'master' | 'sub' | 'tool' | 'llm' | 'decision';
  label: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // 位置
  x?: number;
  y?: number;
  
  // 样式
  style?: {
    color?: string;
    background?: string;
    border?: string;
  };
  
  // 数据
  data?: {
    duration?: number;
    tokenUsage?: number;
    toolName?: string;
  };
}

interface FlowchartEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'sequence' | 'dependency' | 'retry';
}

// GET /api/monitoring/sessions/:sessionId/gantt
interface GanttData {
  tasks: GanttTask[];
  timeRange: {
    start: number;
    end: number;
  };
}

interface GanttTask {
  id: string;
  name: string;
  agentType: string;
  
  // 时间
  start: number;
  end: number;
  duration: number;
  
  // 进度
  progress: number;              // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  
  // 依赖
  dependencies: string[];
  
  // 样式
  color?: string;
}

// GET /api/monitoring/sessions/:sessionId/timeline
interface TimelineData {
  events: TimelineEvent[];
  timeRange: {
    start: number;
    end: number;
  };
  groups: string[];              // 事件分组
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  group: string;                 // 所属分组
  type: string;
  title: string;
  description?: string;
  
  // 样式
  color?: string;
  icon?: string;
  
  // 关联数据
  data?: any;
}
```

## 4. 实时事件流

### 4.1 WebSocket 接口

```typescript
// WS /ws/monitoring/:sessionId

// 客户端连接
const ws = new WebSocket('ws://api.example.com/ws/monitoring/session_123');

// 连接后自动接收：
// 1. 历史事件（最近100条）
// 2. 实时事件流

// 事件格式
interface WebSocketMessage {
  type: 'history' | 'event' | 'error' | 'ping';
  timestamp: number;
  data: any;
}

// 历史事件
{
  type: 'history',
  data: {
    events: MonitorEvent[];
    count: number;
  }
}

// 实时事件
{
  type: 'event',
  data: MonitorEvent
}
```

### 4.2 SSE 接口

```typescript
// GET /api/monitoring/sessions/:sessionId/events/stream

const eventSource = new EventSource(
  '/api/monitoring/sessions/session_123/events/stream'
);

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('New event:', data);
};

// 事件流格式
event: task:started
data: {"taskId": "task_1", "timestamp": 1234567890, ...}

event: react:step
data: {"stepNumber": 1, "thought": "...", ...}

event: tool:called
data: {"tool": "search", "parameters": {...}, ...}
```

## 5. 前端监控面板

### 5.1 组件设计

```typescript
// 监控面板主组件
interface MonitoringDashboardProps {
  sessionId: string;
  refreshInterval?: number;      // 刷新间隔(ms)
  layout?: 'default' | 'compact' | 'full';
}

// 任务树组件
interface TaskTreeProps {
  tasks: TaskTreeNode[];
  selectedTaskId?: string;
  onTaskSelect: (taskId: string) => void;
  expandedTaskIds?: string[];
  onTaskExpand: (taskId: string) => void;
}

// 执行流程图组件
interface ExecutionFlowProps {
  flowchart: FlowchartData;
  selectedNodeId?: string;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string) => void;
  autoLayout?: boolean;
}

// 实时日志组件
interface LiveLogProps {
  events: MonitorEvent[];
  filter?: LogFilter;
  onFilterChange: (filter: LogFilter) => void;
  autoScroll?: boolean;
  maxLines?: number;
}

// 性能指标组件
interface PerformanceMetricsProps {
  metrics: SessionMetrics;
  comparison?: SessionMetrics;   // 对比数据
  charts: ('token' | 'latency' | 'timeline')[];
}
```

### 5.2 状态管理

```typescript
// 监控面板状态
interface MonitoringState {
  // 会话信息
  session: SessionTrace | null;
  loading: boolean;
  error: Error | null;
  
  // 实时事件
  events: MonitorEvent[];
  isConnected: boolean;
  
  // 选中的任务
  selectedTaskId: string | null;
  selectedTaskDetail: TaskExecutionDetail | null;
  
  // 视图状态
  view: {
    activeTab: 'overview' | 'tasks' | 'logs' | 'metrics';
    taskTreeExpanded: string[];
    logFilter: LogFilter;
    timeRange: { start: number; end: number };
  };
  
  // 性能数据
  metrics: SessionMetrics | null;
}

// 日志过滤器
interface LogFilter {
  levels: ('info' | 'warn' | 'error' | 'debug')[];
  types: EventType[];
  taskId?: string;
  agentId?: string;
  searchText?: string;
  timeRange?: { start: number; end: number };
}
```

## 6. 数据导出

### 6.1 导出格式

```typescript
// POST /api/monitoring/sessions/:sessionId/export
interface ExportRequest {
  format: 'json' | 'markdown' | 'pdf' | 'csv';
  include: {
    events: boolean;
    contextSnapshots: boolean;
    toolCalls: boolean;
    llmCalls: boolean;
  };
  timeRange?: { start: number; end: number };
}

// 导出响应
interface ExportResponse {
  downloadUrl: string;
  expiresAt: number;
  size: number;
  format: string;
}
```

### 6.2 导出内容示例

**Markdown 格式**
```markdown
# 会话执行报告

## 基本信息
- 会话ID: session_123
- Agent: sales_assistant
- 用户: user_456
- 开始时间: 2024-01-15 10:00:00
- 执行时长: 12.5s

## 任务执行

### Task 1: 查询销售数据
- 状态: ✅ 完成
- 耗时: 3.2s
- Token: 1,234

#### 执行步骤
1. **Thought**: 需要查询Q4销售数据
2. **Action**: 调用 sql_query 工具
3. **Observation**: 查询成功，返回 1,234 条记录

## 资源使用
- 总Token: 3,456
- 预估成本: $0.12
```

## 7. 告警与通知

### 7.1 告警规则

```typescript
interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  
  // 触发条件
  condition: {
    metric: string;                // 指标名称
    operator: '>' | '<' | '==' | '!=' | 'contains';
    threshold: number | string;
    duration: number;              // 持续时间(秒)
  };
  
  // 通知方式
  notifications: {
    email?: string[];
    webhook?: string[];
    sms?: string[];
  };
  
  // 告警级别
  severity: 'warning' | 'error' | 'critical';
  
  // 抑制规则
  suppression?: {
    cooldown: number;              // 冷却时间(秒)
    maxAlertsPerHour: number;
  };
}

// 预定义告警规则
const DefaultAlertRules: AlertRule[] = [
  {
    id: 'high_latency',
    name: '高延迟告警',
    condition: {
      metric: 'llm.latency',
      operator: '>',
      threshold: 10000,            // 10秒
      duration: 60,
    },
    severity: 'warning',
  },
  {
    id: 'task_failure',
    name: '任务失败告警',
    condition: {
      metric: 'task.failure_rate',
      operator: '>',
      threshold: 0.5,              // 50%
      duration: 300,
    },
    severity: 'error',
  },
  {
    id: 'high_cost',
    name: '高成本告警',
    condition: {
      metric: 'session.estimated_cost',
      operator: '>',
      threshold: 1.0,              // $1
      duration: 0,
    },
    severity: 'warning',
  },
];
```

### 7.2 告警事件

```typescript
interface AlertEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'error' | 'critical';
  
  // 触发信息
  triggeredAt: number;
  metric: string;
  currentValue: number;
  threshold: number;
  
  // 上下文
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  
  // 状态
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: number;
  resolvedAt?: number;
}
```

## 8. 性能指标

### 8.1 会话级指标

```typescript
interface SessionMetrics {
  // 执行指标
  execution: {
    totalDuration: number;         // 总执行时间
    llmLatency: number;            // LLM 调用平均延迟
    toolLatency: number;           // 工具调用平均延迟
    throughput: number;            // Token/秒
  };
  
  // Token 使用
  tokens: {
    total: number;
    prompt: number;
    completion: number;
    byModel: Record<string, number>;
  };
  
  // 成本估算
  cost: {
    estimated: number;             // 预估成本($)
    byModel: Record<string, number>;
  };
  
  // 任务统计
  tasks: {
    total: number;
    completed: number;
    failed: number;
    retried: number;
    averageDuration: number;
  };
  
  // 资源使用
  resources: {
    peakSubAgents: number;
    totalToolCalls: number;
    totalLLMCalls: number;
  };
}
```

### 8.2 聚合指标

```typescript
// GET /api/monitoring/metrics/aggregate
interface AggregateMetrics {
  timeRange: { start: number; end: number };
  
  // 会话统计
  sessions: {
    total: number;
    completed: number;
    failed: number;
    averageDuration: number;
  };
  
  // Token 统计
  tokens: {
    total: number;
    byDay: Array<{ date: string; count: number }>;
    byAgent: Record<string, number>;
  };
  
  // 成本统计
  costs: {
    total: number;
    byDay: Array<{ date: string; amount: number }>;
    byAgent: Record<string, number>;
  };
  
  // 性能趋势
  performance: {
    latencyTrend: Array<{ timestamp: number; value: number }>;
    throughputTrend: Array<{ timestamp: number; value: number }>;
  };
}
```

## 9. 审计与合规

### 9.1 审计日志

```typescript
interface AuditLog {
  id: string;
  timestamp: number;
  
  // 操作信息
  action: string;
  resource: string;
  resourceId: string;
  
  // 操作人
  userId: string;
  userName: string;
  userRole: string;
  
  // 操作结果
  result: 'success' | 'failure';
  errorMessage?: string;
  
  // 变更详情
  changes?: {
    before: any;
    after: any;
  };
  
  // 上下文
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
}

// 审计操作类型
type AuditAction =
  | 'session:view'
  | 'session:export'
  | 'session:delete'
  | 'task:retry'
  | 'task:cancel'
  | 'config:update'
  | 'alert:acknowledge';
```

### 9.2 合规检查

```typescript
interface ComplianceCheck {
  // 数据保留
  dataRetention: {
    enabled: boolean;
    retentionDays: number;
    autoPurge: boolean;
  };
  
  // 敏感数据
  sensitiveData: {
    maskingEnabled: boolean;
    maskedFields: string[];
  };
  
  // 访问控制
  accessControl: {
    authentication: boolean;
    authorization: boolean;
    auditLogging: boolean;
  };
  
  // 审计追踪
  auditTrail: {
    enabled: boolean;
    immutable: boolean;
    retentionDays: number;
  };
}
```

## 10. 关联文档

- [Agent 运行时设计](./runtime.md)
- [任务编排设计](./task-orchestration.md)
- [上下文管理设计](../core/context.md)
- [三层监控架构](./monitor.md)
