# JSON 任务定义规范

## 1. 概述

### 1.1 设计目标

JSON 任务定义是一种轻量级的任务编排描述语言，用于描述复杂任务的执行流程。相比 BPMN XML，它更易于 LLM 生成和人类理解。

**核心特性**：
- **LLM 友好**：JSON 格式是 LLM 原生支持的输出格式
- **轻量级**：无需引入复杂的流程引擎
- **可扩展**：支持自定义步骤类型和条件表达式
- **可恢复**：内置检查点机制，支持暂停/恢复

### 1.2 适用场景

| 场景 | 说明 |
|------|------|
| 长程循环任务 | 直播间监控、定时巡检等需要持续执行的任务 |
| 条件分支任务 | 根据运行时状态选择不同执行路径 |
| 并行执行任务 | 多平台发布、批量处理等需要并行执行的任务 |
| 人机交互任务 | 需要用户确认或输入的任务 |
| 定时触发任务 | 通过 Cron 或轮询驱动的任务 |

### 1.3 与现有架构的关系

```
Agent 层
    │
    │ 意图识别 → 启动 Orchestrator
    ▼
Orchestrator 层
    │
    │ 1. LLM 生成 TaskDefinition (JSON)
    │ 2. TaskDefinitionExecutor 解析执行
    │ 3. 步骤执行 → 启动 Executor
    ▼
Executor 层
    │
    │ 执行具体动作 (Skill/Tool/LLM)
    ▼
结果返回
```

## 2. 数据模型

### 2.1 TaskDefinition 完整结构

```typescript
interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  
  driver: DriverConfig;
  variables?: Record<string, unknown>;
  steps: StepDefinition[];
  exitCondition?: ConditionExpression;
}
```

### 2.2 DriverConfig 驱动配置

```typescript
interface DriverConfig {
  type: 'once' | 'loop' | 'polling' | 'event' | 'cron';
  config?: {
    interval?: number;        // 轮询间隔（毫秒）
    cron?: string;            // cron 表达式
    maxIterations?: number;   // 最大循环次数
    event?: string;           // 等待的事件类型
  };
}
```

| 驱动类型 | 说明 | 适用场景 |
|---------|------|---------|
| `once` | 单次执行 | 一次性任务 |
| `loop` | 循环执行 | 需要重复执行直到条件满足 |
| `polling` | 轮询执行 | 定时检查状态变化 |
| `event` | 事件驱动 | 等待外部事件触发 |
| `cron` | 定时触发 | 精确时间点执行 |

### 2.3 StepDefinition 步骤类型

#### 2.3.1 ActionStep - 执行动作

```typescript
interface ActionStep {
  type: 'action';
  id: string;
  name: string;
  action: {
    type: 'skill' | 'tool' | 'llm';
    target: string;
    params?: Record<string, unknown>;
    paramsFromVariables?: Record<string, string>;
  };
  saveTo?: string;
  onError?: 'continue' | 'abort' | 'retry';
  retryCount?: number;
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | string | 是 | 固定值 `action` |
| `id` | string | 是 | 步骤唯一标识 |
| `name` | string | 是 | 步骤名称 |
| `action.type` | string | 是 | 动作类型：`skill`/`tool`/`llm` |
| `action.target` | string | 是 | 目标名称（skill名/tool名/LLM指令） |
| `action.params` | object | 否 | 直接参数 |
| `action.paramsFromVariables` | object | 否 | 从变量取值的参数映射 |
| `saveTo` | string | 否 | 结果保存到的变量名 |
| `onError` | string | 否 | 错误处理策略，默认 `abort` |
| `retryCount` | number | 否 | 重试次数，配合 `onError: 'retry'` |

**示例**：

```json
{
  "type": "action",
  "id": "check-status",
  "name": "检查直播间状态",
  "action": {
    "type": "skill",
    "target": "douyin",
    "params": { "action": "getLiveStatus" },
    "paramsFromVariables": { "url": "${liveUrl}" }
  },
  "saveTo": "liveStatus",
  "onError": "retry",
  "retryCount": 3
}
```

#### 2.3.2 ConditionStep - 条件分支

```typescript
interface ConditionStep {
  type: 'condition';
  id: string;
  name: string;
  branches: Array<{
    condition: ConditionExpression;
    steps: StepDefinition[];
  }>;
  default?: StepDefinition[];
}
```

**示例**：

```json
{
  "type": "condition",
  "id": "status-branch",
  "name": "根据状态分支",
  "branches": [
    {
      "condition": { "op": "eq", "left": "${status}", "right": "live" },
      "steps": [
        { "type": "action", "id": "handle-live", "name": "处理直播", "action": {...} }
      ]
    },
    {
      "condition": { "op": "eq", "left": "${status}", "right": "ended" },
      "steps": [
        { "type": "action", "id": "handle-end", "name": "处理结束", "action": {...} }
      ]
    }
  ],
  "default": [
    { "type": "action", "id": "default-action", "name": "默认处理", "action": {...} }
  ]
}
```

#### 2.3.3 LoopStep - 循环

```typescript
interface LoopStep {
  type: 'loop';
  id: string;
  name: string;
  loopType: 'while' | 'forEach';
  condition?: ConditionExpression;
  iterateOver?: string;
  itemVar?: string;
  steps: StepDefinition[];
  maxIterations?: number;
}
```

**循环类型**：

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `while` | `condition` | 条件为真时继续循环 |
| `forEach` | `iterateOver`, `itemVar` | 遍历数组元素 |

**示例 - while 循环**：

```json
{
  "type": "loop",
  "id": "poll-loop",
  "name": "轮询检查",
  "loopType": "while",
  "condition": { "op": "eq", "left": "${continue}", "right": true },
  "steps": [
    { "type": "action", "id": "check", "name": "检查状态", "action": {...} }
  ],
  "maxIterations": 100
}
```

**示例 - forEach 循环**：

```json
{
  "type": "loop",
  "id": "process-items",
  "name": "处理列表项",
  "loopType": "forEach",
  "iterateOver": "${comments}",
  "itemVar": "comment",
  "steps": [
    {
      "type": "action",
      "id": "reply",
      "name": "回复评论",
      "action": {
        "type": "skill",
        "target": "douyin",
        "params": { "commentId": "${comment.id}" }
      }
    }
  ]
}
```

#### 2.3.4 ParallelStep - 并行执行

```typescript
interface ParallelStep {
  type: 'parallel';
  id: string;
  name: string;
  branches: Array<{
    id: string;
    name: string;
    steps: StepDefinition[];
  }>;
  mode: 'all' | 'race' | 'any';
}
```

**执行模式**：

| 模式 | 说明 |
|------|------|
| `all` | 等待所有分支完成 |
| `race` | 任一分支完成即返回 |
| `any` | 任一分支成功即返回（忽略失败） |

**示例**：

```json
{
  "type": "parallel",
  "id": "multi-publish",
  "name": "多平台发布",
  "mode": "all",
  "branches": [
    {
      "id": "xiaohongshu",
      "name": "发布到小红书",
      "steps": [
        { "type": "action", "id": "to-xhs", "action": { "type": "skill", "target": "redbook", "params": {...} } }
      ]
    },
    {
      "id": "toutiao",
      "name": "发布到头条",
      "steps": [
        { "type": "action", "id": "to-tt", "action": { "type": "skill", "target": "toutiao", "params": {...} } }
      ]
    }
  ]
}
```

#### 2.3.5 WaitStep - 等待

```typescript
interface WaitStep {
  type: 'wait';
  id: string;
  name: string;
  waitType: 'timer' | 'event' | 'user';
  config: {
    duration?: number;
    event?: string;
    timeout?: number;
    message?: string;
  };
  saveTo?: string;
}
```

**等待类型**：

| 类型 | 必填字段 | 说明 |
|------|---------|------|
| `timer` | `duration` | 等待指定时长（毫秒） |
| `event` | `event` | 等待指定事件触发 |
| `user` | `message` | 等待用户确认/输入 |

**示例 - 等待用户确认**：

```json
{
  "type": "wait",
  "id": "wait-confirm",
  "name": "等待用户确认",
  "waitType": "user",
  "config": {
    "message": "请确认内容是否正确：${content}",
    "timeout": 600000
  },
  "saveTo": "userConfirmed"
}
```

### 2.4 ConditionExpression 条件表达式

#### 2.4.1 比较操作

```typescript
type CompareOp = 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte';

interface CompareCondition {
  op: CompareOp;
  left: string;    // 变量路径，如 "${status}"
  right: unknown;  // 比较值
}
```

| 操作符 | 说明 | 示例 |
|--------|------|------|
| `eq` | 等于 | `{ "op": "eq", "left": "${status}", "right": "live" }` |
| `ne` | 不等于 | `{ "op": "ne", "left": "${count}", "right": 0 }` |
| `gt` | 大于 | `{ "op": "gt", "left": "${score}", "right": 80 }` |
| `lt` | 小于 | `{ "op": "lt", "left": "${count}", "right": 10 }` |
| `gte` | 大于等于 | `{ "op": "gte", "left": "${level}", "right": 5 }` |
| `lte` | 小于等于 | `{ "op": "lte", "left": "${retryCount}", "right": 3 }` |

#### 2.4.2 包含判断

```typescript
interface ContainsCondition {
  op: 'contains' | 'notContains';
  left: string;
  right: unknown;
}
```

**示例**：

```json
{ "op": "contains", "left": "${message}", "right": "购买" }
```

#### 2.4.3 存在判断

```typescript
interface ExistsCondition {
  op: 'exists' | 'notExists';
  var: string;
}
```

**示例**：

```json
{ "op": "exists", "var": "userEmail" }
```

#### 2.4.4 逻辑组合

```typescript
interface LogicalCondition {
  op: 'and' | 'or';
  conditions: ConditionExpression[];
}

interface NotCondition {
  op: 'not';
  condition: ConditionExpression;
}
```

**示例 - AND 组合**：

```json
{
  "op": "and",
  "conditions": [
    { "op": "eq", "left": "${status}", "right": "live" },
    { "op": "gt", "left": "${viewerCount}", "right": 100 }
  ]
}
```

**示例 - OR 组合**：

```json
{
  "op": "or",
  "conditions": [
    { "op": "contains", "left": "${message}", "right": "价格" },
    { "op": "contains", "left": "${message}", "right": "多少钱" }
  ]
}
```

#### 2.4.5 自定义表达式

```typescript
interface CustomCondition {
  op: 'custom';
  expression: string;
}
```

自定义表达式由 LLM 在运行时判断，适用于复杂语义判断场景。

**示例**：

```json
{ "op": "custom", "expression": "用户表达了购买意向" }
```

## 3. 变量系统

### 3.1 变量定义

```typescript
interface TaskDefinition {
  variables?: Record<string, unknown>;
}
```

**示例**：

```json
{
  "variables": {
    "liveUrl": "${input.liveUrl}",
    "liveStatus": null,
    "continue": true,
    "maxRetry": 3
  }
}
```

### 3.2 变量引用

使用 `${varName}` 语法引用变量：

```json
{
  "action": {
    "params": {
      "url": "${liveUrl}",
      "status": "${liveStatus.status}"
    }
  }
}
```

### 3.3 特殊变量

| 变量 | 说明 |
|------|------|
| `${input.*}` | 任务输入参数 |
| `${env.*}` | 环境变量 |
| `${now}` | 当前时间戳 |
| `${worktaskId}` | 当前任务ID |
| `${iteration}` | 当前迭代次数（循环中） |

### 3.4 变量赋值

通过 `saveTo` 字段将结果保存到变量：

```json
{
  "type": "action",
  "id": "check",
  "action": { "type": "skill", "target": "douyin", "params": {...} },
  "saveTo": "liveStatus"
}
```

## 4. 执行引擎

### 4.1 执行流程

```
TaskDefinitionExecutor.execute()
    │
    ├── 1. 初始化变量
    │
    ├── 2. 根据驱动模式选择执行策略
    │   ├── once: executeOnce()
    │   ├── loop: executeLoop()
    │   ├── polling: executePolling()
    │   ├── event: executeEventDriven()
    │   └── cron: executeCron()
    │
    ├── 3. 执行步骤序列
    │   ├── executeStep(action)
    │   ├── executeStep(condition)
    │   ├── executeStep(loop)
    │   ├── executeStep(parallel)
    │   └── executeStep(wait)
    │
    ├── 4. 检查退出条件
    │
    └── 5. 返回结果
```

### 4.2 检查点机制

```typescript
interface Checkpoint {
  worktaskId: string;
  variables: Record<string, unknown>;
  currentStepId?: string;
  executionLog: ExecutionLogEntry[];
  iteration?: number;
  timestamp: Date;
}
```

**保存时机**：
- 每个步骤执行完成后
- 循环每次迭代后
- 暂停时
- 等待用户输入前

**恢复流程**：
```
1. 加载 checkpoint.json
2. 恢复变量状态
3. 从 currentStepId 继续执行
```

### 4.3 暂停/恢复

```typescript
interface TaskDefinitionExecutor {
  pause(): Promise<void>;
  resume(): Promise<void>;
  loadCheckpoint(): Promise<void>;
}
```

**暂停触发**：
- 遇到 `wait` 步骤（等待用户/事件）
- 显式调用 `pause()`
- 达到 `maxIterations`

**恢复触发**：
- 用户确认/输入
- 事件到达
- Cron 定时触发

## 5. 与其他模块的集成

### 5.1 与 Orchestrator 集成

```typescript
class Orchestrator {
  async orchestrate(): Promise<WorktaskResult> {
    // 1. LLM 生成 TaskDefinition
    const definition = await this.generateTaskDefinition();
    
    // 2. 创建执行器
    const executor = new TaskDefinitionExecutor(
      definition,
      this.llmService,
      this.executorFactory,
      this.storage,
      this.worktask.id
    );
    
    // 3. 执行
    return executor.execute();
  }
}
```

### 5.2 与 Cron 集成

```typescript
// Cron 任务触发时恢复执行
async function onCronTrigger(job: CronJob) {
  if (job.target.type === 'worktask') {
    const executor = await TaskDefinitionExecutor.fromCheckpoint(job.target.worktaskId);
    await executor.resume();
  }
}
```

### 5.3 与事件总线集成

```typescript
// 等待事件
async executeWaitStep(step: WaitStep) {
  if (step.waitType === 'event') {
    await this.pause();
    this.eventBus.once(step.config.event, (payload) => {
      this.variables.set(step.saveTo, payload);
      this.resume();
    });
  }
}
```

## 6. LLM 生成 Prompt

### 6.1 Prompt 模板

```
你是一个任务规划专家。根据用户任务描述，生成 JSON 格式的任务定义。

## 任务定义结构

{
  "id": "任务ID",
  "name": "任务名称",
  "driver": { "type": "once|loop|polling|event|cron", "config": {...} },
  "variables": { "变量名": "初始值" },
  "steps": [...],
  "exitCondition": {...}
}

## 步骤类型

1. action - 执行动作
2. condition - 条件分支
3. loop - 循环
4. parallel - 并行执行
5. wait - 等待

## 可用的 Skills

${skills.map(s => `- ${s.name}: ${s.description}`).join('\n')}

## 输出要求

1. 只输出 JSON，不要有其他内容
2. 确保格式正确
3. 变量引用使用 ${varName} 格式
```

### 6.2 结构化输出配置

```typescript
const generationConfig = {
  response_format: { type: 'json_object' },
  temperature: 0.3,
};
```

## 7. 完整示例

### 7.1 场景一：直播间助理

```json
{
  "id": "live-room-assistant",
  "name": "抖音直播间助理",
  "description": "监控直播间，自动回复评论，收集商机",
  
  "driver": {
    "type": "polling",
    "config": {
      "interval": 30000,
      "maxIterations": 1000
    }
  },
  
  "variables": {
    "liveUrl": "${input.liveUrl}",
    "liveStatus": null,
    "continue": true
  },
  
  "steps": [
    {
      "type": "action",
      "id": "check-status",
      "name": "检查直播间状态",
      "action": {
        "type": "skill",
        "target": "douyin",
        "params": { "action": "getLiveStatus" },
        "paramsFromVariables": { "url": "${liveUrl}" }
      },
      "saveTo": "liveStatus"
    },
    {
      "type": "condition",
      "id": "status-branch",
      "name": "根据状态分支",
      "branches": [
        {
          "condition": { "op": "eq", "left": "${liveStatus.status}", "right": "not_started" },
          "steps": [
            {
              "type": "action",
              "id": "schedule-next",
              "name": "设置下次检查",
              "action": {
                "type": "tool",
                "target": "cron.updateNextRun",
                "params": { "interval": 300000 }
              }
            }
          ]
        },
        {
          "condition": { "op": "eq", "left": "${liveStatus.status}", "right": "live" },
          "steps": [
            {
              "type": "parallel",
              "id": "live-tasks",
              "name": "并行处理",
              "mode": "all",
              "branches": [
                {
                  "id": "handle-comments",
                  "name": "处理评论",
                  "steps": [
                    {
                      "type": "action",
                      "id": "read-comments",
                      "name": "读取评论",
                      "action": { "type": "skill", "target": "douyin", "params": { "action": "readComments" } },
                      "saveTo": "comments"
                    },
                    {
                      "type": "loop",
                      "id": "reply-loop",
                      "name": "回复评论",
                      "loopType": "forEach",
                      "iterateOver": "${comments}",
                      "itemVar": "comment",
                      "steps": [
                        {
                          "type": "action",
                          "id": "reply",
                          "name": "回复",
                          "action": { "type": "skill", "target": "douyin", "params": { "action": "reply", "commentId": "${comment.id}" } }
                        }
                      ]
                    }
                  ]
                },
                {
                  "id": "detect-opportunity",
                  "name": "检测商机",
                  "steps": [
                    {
                      "type": "action",
                      "id": "analyze",
                      "name": "分析意向",
                      "action": { "type": "llm", "target": "analyzeIntent", "paramsFromVariables": { "comments": "${comments}" } },
                      "saveTo": "opportunities"
                    },
                    {
                      "type": "loop",
                      "id": "save-loop",
                      "name": "保存商机",
                      "loopType": "forEach",
                      "iterateOver": "${opportunities}",
                      "itemVar": "opp",
                      "steps": [
                        {
                          "type": "action",
                          "id": "save-crm",
                          "name": "写入CRM",
                          "action": { "type": "skill", "target": "crm", "params": { "action": "save", "data": "${opp}" } }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "condition": { "op": "eq", "left": "${liveStatus.status}", "right": "ended" },
          "steps": [
            {
              "type": "action",
              "id": "summarize",
              "name": "汇总数据",
              "action": { "type": "llm", "target": "summarize" },
              "saveTo": "summary"
            },
            {
              "type": "action",
              "id": "notify",
              "name": "通知Agent",
              "action": { "type": "tool", "target": "agent.notify", "paramsFromVariables": { "message": "${summary}" } }
            },
            {
              "type": "action",
              "id": "stop",
              "name": "停止定时",
              "action": { "type": "tool", "target": "cron.disable" }
            },
            {
              "type": "action",
              "id": "set-exit",
              "name": "设置退出",
              "action": { "type": "tool", "target": "variable.set", "params": { "name": "continue", "value": false } }
            }
          ]
        }
      ]
    }
  ],
  
  "exitCondition": { "op": "eq", "left": "${continue}", "right": false }
}
```

### 7.2 场景二：自媒体发布

```json
{
  "id": "multi-platform-publish",
  "name": "自媒体全网发布",
  
  "driver": { "type": "once" },
  
  "variables": {
    "content": null,
    "images": [],
    "userConfirmed": false
  },
  
  "steps": [
    {
      "type": "action",
      "id": "extract",
      "name": "提取文案",
      "action": { "type": "skill", "target": "browser", "params": { "action": "extractText", "url": "${input.url}" } },
      "saveTo": "content"
    },
    {
      "type": "action",
      "id": "rebuild",
      "name": "重构文案",
      "action": { "type": "skill", "target": "rebuild", "paramsFromVariables": { "content": "${content}" } },
      "saveTo": "content"
    },
    {
      "type": "wait",
      "id": "wait-confirm",
      "name": "等待用户确认",
      "waitType": "user",
      "config": {
        "message": "请确认内容：${content}",
        "timeout": 600000
      },
      "saveTo": "userConfirmed"
    },
    {
      "type": "condition",
      "id": "confirm-branch",
      "name": "根据确认结果分支",
      "branches": [
        {
          "condition": { "op": "eq", "left": "${userConfirmed}", "right": true },
          "steps": [
            {
              "type": "action",
              "id": "gen-image",
              "name": "生成图片",
              "action": { "type": "skill", "target": "dream", "paramsFromVariables": { "prompt": "${content}" } },
              "saveTo": "images"
            },
            {
              "type": "parallel",
              "id": "publish-all",
              "name": "并行发布",
              "mode": "all",
              "branches": [
                {
                  "id": "xhs",
                  "name": "小红书",
                  "steps": [
                    {
                      "type": "action",
                      "id": "to-xhs",
                      "action": { "type": "skill", "target": "redbook", "params": { "action": "publish" }, "paramsFromVariables": { "content": "${content}", "images": "${images}" } }
                    }
                  ]
                },
                {
                  "id": "tt",
                  "name": "头条",
                  "steps": [
                    {
                      "type": "action",
                      "id": "to-tt",
                      "action": { "type": "skill", "target": "toutiao", "params": { "action": "publish" }, "paramsFromVariables": { "content": "${content}", "images": "${images}" } }
                    }
                  ]
                },
                {
                  "id": "zh",
                  "name": "知乎",
                  "steps": [
                    {
                      "type": "action",
                      "id": "to-zh",
                      "action": { "type": "skill", "target": "zhihu", "params": { "action": "publish" }, "paramsFromVariables": { "content": "${content}", "images": "${images}" } }
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "condition": { "op": "eq", "left": "${userConfirmed}", "right": false },
          "steps": [
            {
              "type": "action",
              "id": "get-feedback",
              "name": "获取修改意见",
              "action": { "type": "tool", "target": "user.getFeedback" },
              "saveTo": "feedback"
            },
            {
              "type": "action",
              "id": "revise",
              "name": "修改内容",
              "action": { "type": "llm", "target": "revise", "paramsFromVariables": { "content": "${content}", "feedback": "${feedback}" } },
              "saveTo": "content"
            }
          ]
        }
      ]
    }
  ]
}
```

## 8. 数据库表设计

数据库表设计详见 [database 目录](./database/)：

- [t_task_definition.md](./database/t_task_definition.md) - 任务定义表
- [t_task_checkpoint.md](./database/t_task_checkpoint.md) - 任务检查点表
- [t_task_execution_log.md](./database/t_task_execution_log.md) - 任务执行日志表

## 9. 与 BPMN 的对比

| 维度 | JSON 任务定义 | BPMN XML |
|------|--------------|----------|
| **LLM 生成可靠性** | ✅ 高（JSON 原生支持） | ⚠️ 低（XML 语法复杂） |
| **可读性** | ✅ 直观易懂 | ⚠️ 需要理解 BPMN 规范 |
| **表达能力** | ⚠️ 自定义子集 | ✅ 完整 BPMN 2.0 规范 |
| **可视化** | ⚠️ 需要自己实现 | ✅ 标准工具支持 |
| **执行引擎** | ⚠️ 需要自己实现 | ✅ 成熟引擎可用 |
| **调试难度** | ✅ 较低 | ⚠️ 较高 |
| **扩展性** | ✅ 灵活扩展 | ✅ 标准扩展点 |
| **学习成本** | ✅ 低 | ⚠️ 高 |

## 10. 关联文档

- [Orchestrator 设计](./orchestrator.md)
- [Worktask 设计](./worktask.md)
- [Executor 设计](./executor.md)
- [定时任务设计](../cron/README.md)
- [数据库设计规范](../DATABASE_SPECIFICATION.md)
