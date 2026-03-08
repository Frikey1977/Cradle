# 任务编排设计

## 1. 概述

### 1.1 设计目标

任务编排模块负责处理**复杂任务的分解与协调**，实现主Agent与Executor的明确职责分离。

**核心能力**：
- 主Agent专注于对话：负责与用户交互、理解意图、规划任务
- Executor负责执行：专门处理需要工具调用的任务，具备ReAct自循环能力
- 清晰的职责边界：对话与执行分离，提高系统可维护性
- 结果汇总与确认：Executor执行完成后通知主Agent确认和汇总

### 1.2 架构定位

```
用户请求
    ↓
主Agent (对话Agent)
    ├── 直接回答简单问题
    └── 复杂任务 → 创建Executor
                      ↓
              Executor (执行Agent)
                  ├── ReAct自循环
                  ├── 工具/Skill调用
                  └── 执行完成通知
                      ↓
              主Agent确认结果
                  ├── 结果汇总
                  └── 返回给用户
```

## 2. 核心概念

### 2.1 双层Agent模型

```
┌─────────────────────────────────────────────────────────────────┐
│                        主Agent (Master Agent)                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  职责：用户对话、意图理解、任务规划、结果汇总              │   │
│  │  特点：无工具调用能力，专注于自然语言交互                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ 创建Executor                     │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Executor (执行器)                            │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  职责：工具调用、Skill执行、ReAct自循环            │   │   │
│  │  │  特点：具备完整工具链，独立执行直到完成             │   │   │
│  │  │                                                  │   │   │
│  │  │  ReAct循环：                                      │   │   │
│  │  │  Thought → Action (Tool) → Observation           │   │   │
│  │  │       ↑________________________↓                  │   │   │
│  │  │                   (自循环直到完成)                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                              │                          │   │
│  │                              │ 执行完成通知              │   │
│  │                              ▼                          │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  结果：执行日志、输出数据、状态信息               │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              │ 返回结果                         │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  主Agent确认与汇总 → 生成最终响应给用户                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 角色定义

| 角色 | 职责 | 特点 | 能力 |
|------|------|------|------|
| **主Agent** | 用户对话、任务规划、结果汇总 | 全局视角，协调者 | 自然语言理解、任务分解、对话管理 |
| **Executor** | 执行具体任务 | 专业执行者 | ReAct自循环、工具调用、Skill执行 |
| **TaskMonitor** | 实时监控、事件广播 | 可观测性 | 执行追踪、状态监控 |

### 2.3 职责分离原则

```typescript
// 主Agent配置 - 无工具调用能力
const MasterAgentConfig = {
  role: '对话助手',
  description: '负责与用户进行自然语言交互',
  capabilities: ['对话', '规划', '汇总'],
  tools: [], // 主Agent不直接调用工具
  model: 'gpt-4',
};

// Executor配置 - 具备完整工具链
const ExecutorConfig = {
  role: '任务执行器',
  description: '负责执行具体任务，调用工具和Skill',
  capabilities: ['执行', '工具调用', 'ReAct'],
  tools: ['*'], // 可使用所有可用工具
  model: 'gpt-4',
  maxIterations: 20, // ReAct最大迭代次数
  timeout: 300, // 执行超时时间(秒)
};
```

## 3. 核心流程

### 3.1 任务判断与分流流程

```
用户输入
    ↓
主Agent意图分析
    ↓
需要工具执行?
    ├── 否 → 直接回答用户
    │         ↓
    │    生成自然语言响应
    │         ↓
    │    返回给用户
    │
    └── 是 → 创建任务计划
              ↓
         生成ExecutionTask
              ↓
         创建Executor实例
              ↓
         启动异步执行
              ↓
         告知用户"正在处理..."
```

### 3.2 Executor创建与执行流程

```
主Agent决定创建Executor
    ↓
构建执行上下文
    ├── 任务描述
    ├── 可用工具列表
    ├── 相关记忆/知识
    └── 约束条件
    ↓
ExecutorFactory.create()
    ↓
Executor初始化
    ├── 加载工具配置
    ├── 初始化ReAct状态
    └── 设置执行参数
    ↓
executor.execute() - ReAct自循环
    ↓
循环执行直到完成:
    ├── Step 1: Thought → Action → Observation
    ├── Step 2: Thought → Action → Observation
    ├── ...
    └── Step N: Thought → Final Answer
    ↓
执行完成
    ├── 生成执行报告
    ├── 汇总执行结果
    └── 通知主Agent
```

### 3.3 ReAct自循环详细流程

```typescript
class Executor {
  async execute(): Promise<ExecutionResult> {
    const steps: ReActStep[] = [];
    
    while (this.iteration < this.maxIterations) {
      this.iteration++;
      
      // 1. Thought: 分析当前状态，决定下一步
      const thought = await this.generateThought();
      
      // 2. Action: 执行动作（工具调用或完成）
      const action = await this.decideAction(thought);
      
      // 3. Observation: 获取执行结果
      let observation: string;
      if (action.type === 'tool_call') {
        observation = await this.executeTool(action.tool, action.parameters);
      } else if (action.type === 'complete') {
        // 任务完成，退出循环
        return this.buildResult(action.content, steps);
      }
      
      // 4. 记录步骤
      steps.push({ thought, action, observation });
      
      // 5. 上报执行步骤（用于监控）
      this.emit('step', { step: this.iteration, thought, action, observation });
    }
    
    // 达到最大迭代次数，强制结束
    return this.buildResult('执行达到最大迭代次数', steps, 'max_iterations_reached');
  }
}
```

### 3.4 结果返回与确认流程

```
Executor执行完成
    ↓
生成ExecutionResult
    ├── 执行状态 (success/failed)
    ├── 输出内容
    ├── 执行步骤记录
    ├── 工具调用详情
    └── Token使用量
    ↓
通知主Agent
    ↓
主Agent确认结果
    ├── 检查执行状态
    ├── 验证结果完整性
    └── 判断是否需要补充
    ↓
结果汇总
    ├── 整合执行输出
    ├── 生成用户友好的响应
    └── 添加执行摘要
    ↓
返回给用户
```

## 4. 核心组件

### 4.1 ExecutorFactory

```typescript
class ExecutorFactory {
  private toolRegistry: ToolRegistry;
  private skillRegistry: SkillRegistry;
  
  constructor(
    toolRegistry: ToolRegistry,
    skillRegistry: SkillRegistry,
  ) {}
  
  // 创建Executor实例
  async create(options: ExecutorOptions): Promise<Executor> {
    const executor = new Executor({
      id: generateUUID(),
      task: options.task,
      tools: this.resolveTools(options.toolNames),
      skills: this.resolveSkills(options.skillNames),
      context: options.context,
      config: {
        maxIterations: options.maxIterations || 20,
        timeout: options.timeout || 300,
        model: options.modelConfig,
      },
    });
    
    return executor;
  }
  
  // 解析工具列表
  private resolveTools(toolNames: string[]): Tool[] {
    if (toolNames.includes('*')) {
      return this.toolRegistry.getAllTools();
    }
    return toolNames.map(name => this.toolRegistry.get(name));
  }
  
  // 解析Skill列表
  private resolveSkills(skillNames: string[]): Skill[] {
    return skillNames.map(name => this.skillRegistry.get(name));
  }
}

interface ExecutorOptions {
  task: string;                    // 任务描述
  toolNames: string[];             // 可用工具名称列表，['*']表示全部
  skillNames: string[];            // 可用Skill名称列表
  context: ExecutionContext;       // 执行上下文
  maxIterations?: number;          // 最大ReAct迭代次数
  timeout?: number;                // 超时时间(秒)
  modelConfig: ModelConfig;        // 模型配置
}
```

### 4.2 Executor

```typescript
class Executor extends EventEmitter {
  readonly id: string;
  readonly task: string;
  private tools: Map<string, Tool>;
  private skills: Map<string, Skill>;
  private context: ExecutionContext;
  private config: ExecutorConfig;
  
  // 执行状态
  private state: ExecutorState = {
    status: 'idle',
    iteration: 0,
    steps: [],
    startTime: null,
    endTime: null,
  };
  
  constructor(options: ExecutorConstructorOptions) {
    super();
    this.id = options.id;
    this.task = options.task;
    this.tools = new Map(options.tools.map(t => [t.name, t]));
    this.skills = new Map(options.skills.map(s => [s.name, s]));
    this.context = options.context;
    this.config = options.config;
  }
  
  // 主执行方法 - ReAct自循环
  async execute(): Promise<ExecutionResult> {
    this.state.status = 'running';
    this.state.startTime = Date.now();
    
    try {
      // 设置超时控制
      const timeoutPromise = this.createTimeout();
      const executionPromise = this.runReActLoop();
      
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      this.state.status = 'completed';
      this.state.endTime = Date.now();
      
      // 触发完成事件
      this.emit('completed', result);
      
      return result;
      
    } catch (error) {
      this.state.status = 'failed';
      this.state.endTime = Date.now();
      
      const errorResult: ExecutionResult = {
        success: false,
        output: '',
        error: {
          code: error.code || 'EXECUTION_FAILED',
          message: error.message,
        },
        steps: this.state.steps,
        metadata: this.buildMetadata(),
      };
      
      this.emit('failed', errorResult);
      return errorResult;
    }
  }
  
  // ReAct核心循环
  private async runReActLoop(): Promise<ExecutionResult> {
    const messages: Message[] = this.buildInitialMessages();
    
    while (this.state.iteration < this.config.maxIterations) {
      this.state.iteration++;
      
      // 调用LLM生成Thought和Action
      const response = await this.callLLM(messages);
      
      // 解析Thought
      const thought = this.extractThought(response);
      
      // 解析Action
      const action = this.parseAction(response);
      
      let observation: string;
      
      switch (action.type) {
        case 'tool_call':
          observation = await this.executeTool(action.tool, action.parameters);
          break;
          
        case 'skill_call':
          observation = await this.executeSkill(action.skill, action.parameters);
          break;
          
        case 'complete':
          // 任务完成
          return this.buildSuccessResult(action.content);
          
        case 'ask_user':
          // 需要用户澄清，暂停执行
          return this.buildPauseResult(action.question);
          
        default:
          observation = '未知动作类型，请重新思考';
      }
      
      // 记录步骤
      const step: ReActStep = {
        iteration: this.state.iteration,
        thought,
        action,
        observation,
        timestamp: Date.now(),
      };
      this.state.steps.push(step);
      
      // 更新消息历史
      messages.push(
        { role: 'assistant', content: response },
        { role: 'user', content: `Observation: ${observation}` }
      );
      
      // 上报步骤事件
      this.emit('step', step);
    }
    
    // 达到最大迭代次数
    return this.buildMaxIterationsResult();
  }
  
  // 执行工具
  private async executeTool(toolName: string, parameters: any): Promise<string> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return `错误: 工具 '${toolName}' 不存在`;
    }
    
    try {
      const result = await tool.execute(parameters);
      return JSON.stringify(result);
    } catch (error) {
      return `错误: ${error.message}`;
    }
  }
  
  // 执行Skill
  private async executeSkill(skillName: string, parameters: any): Promise<string> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      return `错误: Skill '${skillName}' 不存在`;
    }
    
    try {
      const result = await skill.execute(parameters);
      return JSON.stringify(result);
    } catch (error) {
      return `错误: ${error.message}`;
    }
  }
  
  // 取消执行
  cancel(): void {
    this.state.status = 'cancelled';
    this.emit('cancelled');
  }
  
  // 获取当前状态
  getState(): ExecutorState {
    return { ...this.state };
  }
}
```

### 4.3 MasterAgent (主Agent)

```typescript
class MasterAgent {
  private executorFactory: ExecutorFactory;
  private contextManager: ContextManager;
  private llmService: LLMService;
  
  constructor(
    executorFactory: ExecutorFactory,
    contextManager: ContextManager,
    llmService: LLMService,
  ) {
    this.executorFactory = executorFactory;
    this.contextManager = contextManager;
    this.llmService = llmService;
  }
  
  // 处理用户消息
  async handleMessage(message: UserMessage): Promise<AgentResponse> {
    // 1. 分析用户意图
    const intent = await this.analyzeIntent(message);
    
    // 2. 判断是否需要工具执行
    if (!intent.requiresExecution) {
      // 直接回答
      return this.generateDirectResponse(message, intent);
    }
    
    // 3. 需要执行，创建Executor
    const executor = await this.createExecutor(intent, message);
    
    // 4. 启动异步执行
    const executionPromise = this.runExecutor(executor);
    
    // 5. 立即返回"正在处理"响应
    return {
      type: 'processing',
      message: '我正在为您处理，请稍候...',
      executionId: executor.id,
    };
  }
  
  // 创建Executor
  private async createExecutor(
    intent: IntentAnalysis,
    message: UserMessage
  ): Promise<Executor> {
    // 构建执行上下文
    const context = await this.buildExecutionContext(message);
    
    // 确定需要的工具和Skill
    const toolNames = intent.requiredTools || ['*'];
    const skillNames = intent.requiredSkills || [];
    
    return this.executorFactory.create({
      task: intent.taskDescription,
      toolNames,
      skillNames,
      context,
      maxIterations: intent.estimatedComplexity > 5 ? 30 : 20,
      timeout: intent.estimatedComplexity > 5 ? 600 : 300,
      modelConfig: this.getModelConfig(),
    });
  }
  
  // 运行Executor并处理结果
  private async runExecutor(executor: Executor): Promise<void> {
    // 监听执行事件
    executor.on('step', (step) => {
      this.emit('execution:step', {
        executionId: executor.id,
        step,
      });
    });
    
    executor.on('completed', (result) => {
      // 执行完成，汇总结果
      this.handleExecutionComplete(executor.id, result);
    });
    
    executor.on('failed', (result) => {
      // 执行失败，处理错误
      this.handleExecutionFailed(executor.id, result);
    });
    
    // 开始执行
    const result = await executor.execute();
    
    // 保存执行记录
    await this.saveExecutionRecord(executor.id, result);
  }
  
  // 处理执行完成
  private async handleExecutionComplete(
    executionId: string,
    result: ExecutionResult
  ): Promise<void> {
    // 1. 验证结果
    const validatedResult = await this.validateResult(result);
    
    // 2. 汇总生成最终响应
    const summary = await this.summarizeResult(validatedResult);
    
    // 3. 通知用户
    this.emit('response', {
      executionId,
      type: 'completed',
      message: summary,
      details: result,
    });
  }
  
  // 汇总执行结果
  private async summarizeResult(result: ExecutionResult): Promise<string> {
    const prompt = `
请基于以下执行结果，生成一个简洁、用户友好的响应：

执行输出：
${result.output}

执行步骤摘要：
${result.steps.map(s => `- ${s.thought}`).join('\n')}

请用自然的语言总结执行结果，突出关键信息。
`;
    
    const response = await this.llmService.generate(prompt);
    return response.content;
  }
  
  // 分析用户意图
  private async analyzeIntent(message: UserMessage): Promise<IntentAnalysis> {
    const prompt = `
分析用户输入，判断是否需要工具执行：

用户输入：${message.content}

可用工具：${this.getAvailableToolsDescription()}

请输出JSON格式：
{
  "requiresExecution": boolean,      // 是否需要工具执行
  "taskDescription": string,         // 任务描述
  "requiredTools": string[],         // 需要的工具
  "requiredSkills": string[],        // 需要的Skill
  "estimatedComplexity": number,     // 预估复杂度 1-10
  "reasoning": string                // 判断理由
}
`;
    
    const response = await this.llmService.generate(prompt);
    return JSON.parse(response.content);
  }
}
```

## 5. 数据模型

### 5.1 ExecutionTask

```typescript
interface ExecutionTask {
  id: string;                      // 任务ID
  description: string;             // 任务描述
  status: ExecutionStatus;         // 执行状态
  
  // 关联信息
  masterAgentId: string;           // 主Agent ID
  executorId?: string;             // Executor ID
  conversationId: string;          // 对话ID
  
  // 执行配置
  config: {
    maxIterations: number;         // 最大ReAct迭代次数
    timeout: number;               // 超时时间(秒)
    tools: string[];               // 可用工具
    skills: string[];              // 可用Skill
  };
  
  // 执行结果
  result?: ExecutionResult;
  
  // 时间戳
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

type ExecutionStatus = 
  | 'pending'      // 待执行
  | 'running'      // 执行中
  | 'paused'       // 暂停（等待用户输入）
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'cancelled';   // 已取消
```

### 5.2 ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;                // 是否成功
  output: string;                  // 输出内容
  
  // 错误信息（失败时）
  error?: {
    code: string;                  // 错误码
    message: string;               // 错误信息
    stack?: string;                // 堆栈
  };
  
  // ReAct执行步骤
  steps: ReActStep[];
  
  // 元数据
  metadata: {
    totalIterations: number;       // 总迭代次数
    totalDuration: number;         // 总耗时(ms)
    toolCalls: number;             // 工具调用次数
    skillCalls: number;            // Skill调用次数
    tokenUsage: {                  // Token使用量
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

interface ReActStep {
  iteration: number;               // 迭代序号
  thought: string;                 // 思考过程
  action: {                        // 执行动作
    type: 'tool_call' | 'skill_call' | 'complete' | 'ask_user';
    tool?: string;                 // 工具名称
    skill?: string;                // Skill名称
    parameters?: any;              // 参数
    content?: string;              // 完成内容/问题
  };
  observation: string;             // 观察结果
  timestamp: number;               // 时间戳
}
```

### 5.3 ExecutorState

```typescript
interface ExecutorState {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
  iteration: number;               // 当前迭代次数
  steps: ReActStep[];              // 执行步骤记录
  startTime: number | null;        // 开始时间
  endTime: number | null;          // 结束时间
  currentTool?: string;            // 当前正在调用的工具
}
```

## 6. 执行监控与可观测性

### 6.1 事件流

```typescript
type ExecutorEvent =
  | { type: 'executor:created'; executorId: string; task: string }
  | { type: 'executor:started'; executorId: string; timestamp: number }
  | { type: 'executor:step'; executorId: string; step: ReActStep }
  | { type: 'executor:tool:call'; executorId: string; tool: string; parameters: any }
  | { type: 'executor:tool:result'; executorId: string; tool: string; result: any }
  | { type: 'executor:completed'; executorId: string; result: ExecutionResult }
  | { type: 'executor:failed'; executorId: string; error: Error }
  | { type: 'executor:cancelled'; executorId: string }
  | { type: 'master:result:received'; executorId: string; executionTime: number }
  | { type: 'master:result:summarized'; executorId: string; summary: string };
```

### 6.2 监控指标

```typescript
interface ExecutionMetrics {
  // 执行统计
  totalExecutions: number;         // 总执行次数
  successfulExecutions: number;    // 成功次数
  failedExecutions: number;        // 失败次数
  cancelledExecutions: number;     // 取消次数
  
  // 性能指标
  averageExecutionTime: number;    // 平均执行时间
  averageIterations: number;       // 平均迭代次数
  maxIterationsReached: number;    // 达到最大迭代次数的次数
  
  // 工具使用
  toolUsage: Map<string, number>;  // 各工具使用次数
  skillUsage: Map<string, number>; // 各Skill使用次数
  
  // Token使用
  totalTokenUsage: number;         // 总Token使用量
  averageTokenPerExecution: number;// 平均每次执行Token量
}
```

## 7. 错误处理与恢复

### 7.1 错误类型

```typescript
enum ExecutionErrorType {
  // 执行错误
  TIMEOUT = 'timeout',                    // 执行超时
  MAX_ITERATIONS = 'max_iterations',      // 达到最大迭代次数
  TOOL_NOT_FOUND = 'tool_not_found',      // 工具不存在
  TOOL_EXECUTION_FAILED = 'tool_failed',  // 工具执行失败
  SKILL_EXECUTION_FAILED = 'skill_failed',// Skill执行失败
  
  // LLM错误
  LLM_ERROR = 'llm_error',                // LLM调用错误
  INVALID_RESPONSE = 'invalid_response',  // 无效响应格式
  
  // 系统错误
  SYSTEM_ERROR = 'system_error',          // 系统错误
  CANCELLED = 'cancelled',                // 用户取消
}
```

### 7.2 恢复策略

```typescript
interface ErrorRecoveryStrategy {
  // 判断是否可以恢复
  canRecover(error: ExecutionError): boolean;
  
  // 执行恢复
  async recover(executor: Executor, error: ExecutionError): Promise<ExecutionResult>;
}

// 工具错误恢复策略
class ToolErrorRecovery implements ErrorRecoveryStrategy {
  canRecover(error: ExecutionError): boolean {
    return error.type === ExecutionErrorType.TOOL_EXECUTION_FAILED;
  }
  
  async recover(executor: Executor, error: ExecutionError): Promise<ExecutionResult> {
    // 1. 记录错误工具
    const failedTool = error.toolName;
    
    // 2. 尝试使用替代工具
    const alternativeTool = this.findAlternativeTool(failedTool);
    if (alternativeTool) {
      executor.replaceTool(failedTool, alternativeTool);
      return executor.execute();
    }
    
    // 3. 无法恢复，返回错误
    throw error;
  }
}

// 超时恢复策略
class TimeoutRecovery implements ErrorRecoveryStrategy {
  canRecover(error: ExecutionError): boolean {
    return error.type === ExecutionErrorType.TIMEOUT;
  }
  
  async recover(executor: Executor, error: ExecutionError): Promise<ExecutionResult> {
    // 增加超时时间后重试
    executor.extendTimeout(300);
    return executor.execute();
  }
}
```

## 8. 使用示例

### 8.1 基本任务执行

```typescript
// 初始化
const executorFactory = new ExecutorFactory(toolRegistry, skillRegistry);
const masterAgent = new MasterAgent(executorFactory, contextManager, llmService);

// 处理用户消息
const response = await masterAgent.handleMessage({
  content: '帮我查询一下最近一周的销售数据',
});

// 如果是处理中，等待最终结果
if (response.type === 'processing') {
  masterAgent.on('response', (result) => {
    console.log('执行完成:', result.message);
  });
}
```

### 8.2 监控执行过程

```typescript
// 监听执行步骤
masterAgent.on('execution:step', (event) => {
  console.log(`执行步骤 ${event.step.iteration}:`);
  console.log(`  Thought: ${event.step.thought}`);
  console.log(`  Action: ${JSON.stringify(event.step.action)}`);
  console.log(`  Observation: ${event.step.observation}`);
});

// 监听执行完成
masterAgent.on('execution:completed', (event) => {
  console.log('执行完成:', event.result.output);
  console.log('执行步骤数:', event.result.metadata.totalIterations);
  console.log('Token使用:', event.result.metadata.tokenUsage.total);
});
```

### 8.3 自定义Executor配置

```typescript
// 创建特定场景的Executor
const executor = await executorFactory.create({
  task: '分析用户行为数据',
  toolNames: ['sql_query', 'data_analyzer', 'chart_generator'],
  skillNames: ['data_analysis'],
  context: {
    database: 'analytics_db',
    dateRange: 'last_30_days',
  },
  maxIterations: 50,    // 复杂分析允许更多迭代
  timeout: 900,         // 15分钟超时
  modelConfig: {
    model: 'gpt-4',
    temperature: 0.2,   // 数据分析需要确定性
  },
});
```

## 9. 关联文档

- [Agent 运行时设计](./runtime.md)
- [上下文管理设计](../core/context.md)
- [运行时监控接口](./monitoring-api.md)
- [三层监控架构](./monitor.md)
