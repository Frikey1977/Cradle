/**
 * Orchestrator 层 - 三层架构的编排层
 *
 * 职责：
 * - 任务编排、ReAct 循环、Worktask 管理
 * - 最小上下文原则（画像、记忆按需传入）
 * - Skill 列表传递给 Executor
 * - 任务目标拆解、创建临时 Worktask
 * - 制定串行/并行任务计划
 * - 启动 Executor 执行
 * - 跟踪执行状态、处理超时、任务重排
 * - IPC 通信向 Agent 汇报进度
 *
 * 架构：
 * - OrchestratorContextManager: 上下文管理（系统提示词构建、环境信息）
 * - OrchestratorSystemPromptBuilder: 系统提示词分块构建
 * - ExecutorSystemPromptBuilder: Executor 系统提示词构建
 */

import { EventEmitter } from "events";
import { ALL_TOOLS, type ToolDefinition } from "../tools/index.js";
import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type { SkillEntry } from "../skills/types.js";
import type {
  Worktask,
  WorktaskStatus,
  PlanStep,
  TaskPlan,
  ExecutorRecord,
  ExecutorResult,
  WorktaskResult,
  TokenUsage,
} from "../worktask/types.js";
import { WorktaskManager, generateId } from "../worktask/worktask-manager.js";
import { createExecutor, type ExecutorOptions } from "../executor/index.js";
import { Environment, type EnvironmentConfig } from "../context/environment.js";
import {
  OrchestratorContextManager,
  type OrchestratorContext as OrchestratorRuntimeContext,
} from "./orchestrator-context-manager.js";

export interface OrchestratorConfig {
  agentId: string;
  contactId: string;
  conversationId: string;
  maxIterations: number;
  timeout: number;
  modelConfig: {
    instanceId?: string;
    provider?: string;
    model?: string;
    parameters?: Record<string, unknown>;
  };
  environment?: Environment;
}

export interface OrchestratorContext {
  profiles?: {
    contact?: Partial<ContactProfileBrief>;
    agent?: Partial<AgentProfileBrief>;
    relationship?: Partial<RelationshipProfileBrief>;
  };
  memoryFragments?: MemoryFragmentBrief[];
  skillBody?: SkillBodyBrief[];
  constraints?: {
    timeout?: number;
    maxExecutors?: number;
    allowedTools?: string[];
  };
}

export interface ContactProfileBrief {
  id: string;
  name: string;
}

export interface AgentProfileBrief {
  id: string;
  name: string;
}

export interface RelationshipProfileBrief {
  trustLevel?: number;
}

export interface MemoryFragmentBrief {
  id: string;
  content: string;
  type: string;
  relevance?: number;
  timestamp?: Date;
}

export interface SkillBodyBrief {
  name: string;
  description: string;
  location: string;
}

export interface OrchestratorOptions {
  task: string;
  tools: ToolDefinition[];
  skills: SkillEntry[];
  context: OrchestratorContext;
  config: OrchestratorConfig;
  onProgress?: (event: OrchestratorProgressEvent) => void;
}

export interface OrchestratorProgressEvent {
  worktaskId: string;
  type: OrchestratorEventType;
  status: WorktaskStatus;
  step?: string;
  executor?: string;
  message?: string;
  details?: Record<string, unknown>;
}

export type OrchestratorEventType =
  | "worktask:created"
  | "worktask:planning"
  | "worktask:running"
  | "worktask:step_started"
  | "worktask:step_completed"
  | "worktask:step_failed"
  | "worktask:executor_spawned"
  | "worktask:executor_completed"
  | "worktask:executor_failed"
  | "worktask:completed"
  | "worktask:failed";

export interface OrchestratorIPCMessage {
  type: OrchestratorMessageType;
  worktaskId: string;
  agentId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export type OrchestratorMessageType =
  | "worktask:created"
  | "worktask:status_changed"
  | "worktask:progress_updated"
  | "worktask:executor_spawned"
  | "worktask:executor_completed"
  | "worktask:executor_failed"
  | "worktask:completed"
  | "worktask:failed";

export type ExecutionStrategyType = "serial" | "parallel" | "hybrid";

export interface ExecutionStrategy {
  type: ExecutionStrategyType;
  steps: PlanStep[];
  dependencies?: Array<{ from: string; to: string }>;
  reason: string;
}

export interface TaskAnalysis {
  steps: PlanStep[];
  canParallelize: boolean;
  hasSequentialDependency: boolean;
  dependencies: Array<{ from: string; to: string }>;
}

export type OrchestratorAction =
  | { type: "spawn_executor"; task: string; skillSlugs: string[]; stepId: string }
  | { type: "load_skill_body"; skillSlug: string }
  | { type: "update_plan"; plan: TaskPlan }
  | { type: "ask_agent"; question: string }
  | { type: "complete"; content: string };

export interface IPCChannel {
  send(message: OrchestratorIPCMessage): void;
}

export class Orchestrator extends EventEmitter {
  readonly id: string;
  readonly agentId: string;

  private task: string;
  private tools: ToolDefinition[];
  private skills: Map<string, SkillEntry>;
  private context: OrchestratorContext;
  private config: OrchestratorConfig;
  private llmService: LLMServiceInterface;
  private worktaskManager: WorktaskManager;
  private ipc?: IPCChannel;
  private contextManager: OrchestratorContextManager;

  private worktask?: Worktask;
  private iteration = 0;
  private steps: Array<{ thought: string; action: OrchestratorAction; observation: string }> = [];

  private onProgress?: OrchestratorOptions["onProgress"];

  constructor(
    options: OrchestratorOptions,
    llmService: LLMServiceInterface,
    worktaskManager?: WorktaskManager,
    ipc?: IPCChannel
  ) {
    super();
    this.id = `orchestrator-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    this.agentId = options.config.agentId;
    this.task = options.task;
    
    this.tools = [...ALL_TOOLS, ...options.tools];
    this.skills = new Map(options.skills.map((s) => [s.name, s]));
    this.context = options.context;
    this.config = options.config;
    this.llmService = llmService;
    this.worktaskManager = worktaskManager || new WorktaskManager();
    this.ipc = ipc;
    this.onProgress = options.onProgress;

    this.contextManager = new OrchestratorContextManager({
      orchestratorId: this.id,
      environment: this.config.environment,
      skills: options.skills,
      tools: this.tools,
    });
  }

  async orchestrate(): Promise<WorktaskResult> {
    console.log(`[Orchestrator:${this.id}] Starting orchestration: ${this.task}`);

    try {
      this.worktask = await this.worktaskManager.create({
        agentId: this.config.agentId,
        contactId: this.config.contactId,
        conversationId: this.config.conversationId,
        task: this.task,
        context: this.context,
      });

      this.reportProgress("worktask:created", "created", { worktaskId: this.worktask.id });

      await this.worktaskManager.updateStatus(this.worktask.id, "planning");
      this.reportProgress("worktask:planning", "planning");

      const analysis = await this.analyzeTask();
      const plan = this.buildPlan(analysis);

      console.log(`[Orchestrator:${this.id}] Task plan created: ${plan.steps.length} steps`);
      console.log(`[Orchestrator:${this.id}] Steps:`, plan.steps.map(s => ({ id: s.id, description: s.description })));

      await this.worktaskManager.setPlan(this.worktask.id, plan.steps);
      await this.worktaskManager.updateStatus(this.worktask.id, "running");
      this.reportProgress("worktask:running", "running");

      const results = await this.executePlan(plan);

      const result = this.buildWorktaskResult(results);

      await this.worktaskManager.complete(this.worktask.id, result);
      this.reportProgress("worktask:completed", "completed", { result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Orchestrator:${this.id}] Orchestration failed:`, errorMessage);

      if (this.worktask) {
        await this.worktaskManager.fail(this.worktask.id, error as Error);
        this.reportProgress("worktask:failed", "failed", { error: errorMessage });
      }

      throw error;
    }
  }

  private async analyzeTask(): Promise<TaskAnalysis> {
    const runtimeContext = await this.contextManager.buildAnalysisContext();

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    for (const block of runtimeContext.systemMessages) {
      messages.push({
        role: "system",
        content: block.content,
      });
    }

    messages.push({
      role: "user",
      content: `请分析以下任务，确定执行策略：

任务：${this.task}`,
    });

    const response = await this.llmService.generate({
      model: this.config.modelConfig,
      messages,
      source: "orchestrator",
      agentName: this.agentId,
      worktaskId: this.worktask?.id,
      contactName: this.config.contactId,
    });

    try {
      const content = response.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn("[Orchestrator] Failed to parse task analysis, using default");
    }

    return {
      steps: [
        {
          id: generateId(),
          order: 1,
          description: this.task,
          type: "executor",
          dependencies: [],
          config: {},
          status: "pending",
        },
      ],
      canParallelize: false,
      hasSequentialDependency: false,
      dependencies: [],
    };
  }

  private buildPlan(analysis: TaskAnalysis): TaskPlan {
    const steps: PlanStep[] = analysis.steps.map((s, index) => ({
      id: s.id || generateId(),
      order: index + 1,
      description: s.description,
      type: s.type || "executor",
      dependencies: s.dependencies || [],
      config: s.config || {},
      status: "pending" as const,
    }));

    let strategy: ExecutionStrategyType = "serial";
    if (analysis.canParallelize && !analysis.hasSequentialDependency) {
      strategy = "parallel";
    } else if (analysis.dependencies && analysis.dependencies.length > 0) {
      strategy = "hybrid";
    }

    return {
      steps,
      strategy,
      dependencies: {
        nodes: steps.map((s) => s.id),
        edges: analysis.dependencies || [],
      },
    };
  }

  private async executePlan(plan: TaskPlan): Promise<ExecutorResult[]> {
    switch (plan.strategy) {
      case "parallel":
        return this.executeParallel(plan.steps);
      case "hybrid":
        return this.executeHybrid(plan);
      case "serial":
      default:
        return this.executeSerial(plan.steps);
    }
  }

  private async executeSerial(steps: PlanStep[]): Promise<ExecutorResult[]> {
    const results: ExecutorResult[] = [];

    for (const step of steps) {
      this.reportProgress("worktask:step_started", "running", { step: step.id });

      await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
        status: "in_progress",
      });

      try {
        const result = await this.spawnExecutor(step);
        results.push(result);

        if (result.success) {
          await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
            status: "completed",
            result: result.output,
          });
          this.reportProgress("worktask:step_completed", "running", { step: step.id });
        } else {
          await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
            status: "failed",
            error: result.error?.message,
          });
          this.reportProgress("worktask:step_failed", "running", {
            step: step.id,
            error: result.error?.message,
          });

          if (step.critical) {
            throw new Error(`关键步骤失败: ${step.description}`);
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
          status: "failed",
          error: errorMessage,
        });

        if (step.critical) {
          throw error;
        }
      }
    }

    return results;
  }

  private async executeParallel(steps: PlanStep[]): Promise<ExecutorResult[]> {
    const promises = steps.map(async (step) => {
      this.reportProgress("worktask:executor_spawned", "running", {
        step: step.id,
        description: step.description,
      });

      await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
        status: "in_progress",
      });

      try {
        const result = await this.spawnExecutor(step);

        await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
          status: result.success ? "completed" : "failed",
          result: result.success ? result.output : undefined,
          error: result.success ? undefined : result.error?.message,
        });

        this.reportProgress(
          result.success ? "worktask:executor_completed" : "worktask:executor_failed",
          "running",
          { step: step.id }
        );

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await this.worktaskManager.updateTodo(this.worktask!.id, step.id, {
          status: "failed",
          error: errorMessage,
        });

        return {
          success: false,
          output: "",
          steps: [],
          error: new Error(errorMessage),
        };
      }
    });

    return Promise.all(promises);
  }

  private async executeHybrid(plan: TaskPlan): Promise<ExecutorResult[]> {
    const results: ExecutorResult[] = [];
    const completed = new Set<string>();
    const failed = new Set<string>();

    while (completed.size + failed.size < plan.steps.length) {
      const readySteps = plan.steps.filter(
        (step) =>
          !completed.has(step.id) &&
          !failed.has(step.id) &&
          step.dependencies.every((d) => completed.has(d))
      );

      if (readySteps.length === 0) {
        const blockedSteps = plan.steps.filter(
          (step) => !completed.has(step.id) && !failed.has(step.id)
        );
        throw new Error(
          `检测到循环依赖或无法继续执行，阻塞任务: ${blockedSteps.map((s) => s.id).join(", ")}`
        );
      }

      this.reportProgress("worktask:running", "running", {
        steps: readySteps.map((s) => s.id),
        parallel: readySteps.length > 1,
      });

      const stepResults = await this.executeParallel(readySteps);
      results.push(...stepResults);

      readySteps.forEach((step, i) => {
        if (stepResults[i].success) {
          completed.add(step.id);
        } else {
          failed.add(step.id);
          if (step.critical) {
            throw new Error(`关键步骤 ${step.id} 失败，终止执行`);
          }
        }
      });
    }

    return results;
  }

  private async spawnExecutor(step: PlanStep): Promise<ExecutorResult> {
    // 获取实例配置，底层会自动处理实例不存在的情况
    const targetInstanceId = this.config.modelConfig.instanceId || "auto";
    const instanceConfig = await this.llmService.getInstanceConfig(targetInstanceId);
    if (!instanceConfig) {
      throw new Error(`No available LLM instance found`);
    }

    const skillsArray = Array.from(this.skills.values()).map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      location: s.location,
    }));

    const executor = await createExecutor({
      modelConfig: {
        provider: instanceConfig.provider,
        baseUrl: instanceConfig.baseUrl,
        apiKey: instanceConfig.apiKey,
        modelName: instanceConfig.modelName,
        instanceId: instanceConfig.instanceId,
      },
      task: {
        description: step.description,
        skillSlug: step.config.skillSlug,
        toolName: step.config.toolName,
        parameters: step.config.parameters,
      },
      skills: skillsArray,
      tools: this.tools,
      maxSteps: this.config.maxIterations,
      environment: this.config.environment,
    });

    const record: Omit<ExecutorRecord, "id"> = {
      worktaskId: this.worktask!.id,
      stepId: step.id,
      task: step.description,
      status: "running",
      startedAt: new Date(),
      metadata: { toolCalls: [] },
    };

    await this.worktaskManager.addExecutor(this.worktask!.id, record);

    return executor.execute();
  }

  private buildWorktaskResult(executorResults: ExecutorResult[]): WorktaskResult {
    const success = executorResults.every((r) => r.success);
    const output = executorResults.map((r) => r.output).filter(Boolean).join("\n\n");

    const totalDuration = 0;
    const totalSteps = executorResults.reduce((sum, r) => sum + r.steps.length, 0);
    const successCount = executorResults.filter((r) => r.success).length;

    const tokenUsage: TokenUsage = {
      input: executorResults.reduce((sum, r) => sum + (r.usage?.prompt || 0), 0),
      output: executorResults.reduce((sum, r) => sum + (r.usage?.completion || 0), 0),
      total: executorResults.reduce((sum, r) => sum + (r.usage?.total || 0), 0),
    };

    const worktaskId = this.worktask?.id || "";

    return {
      success,
      output,
      steps: executorResults.flatMap((r, i) =>
        r.steps.map((s) => ({
          stepId: `step_${i}`,
          description: s.content || "",
          success: s.type === "text",
          output: s.toolResult?.output || "",
          duration: 0,
        }))
      ),
      executors: executorResults.map((r, i): import("../worktask/types.js").ExecutorRecord => ({
        id: `executor_${i}`,
        worktaskId,
        stepId: `step_${i}`,
        task: r.output.substring(0, 100),
        status: r.success ? "completed" : "failed",
        result: r,
        metadata: {
          toolCalls: [],
          tokenUsage: r.usage ? {
            input: r.usage.prompt,
            output: r.usage.completion,
            total: r.usage.total,
          } : undefined,
        },
      })),
      metrics: {
        totalDuration,
        totalSteps,
        totalExecutors: executorResults.length,
        successRate: executorResults.length > 0 ? successCount / executorResults.length : 0,
        tokenUsage,
      },
    };
  }

  private reportProgress(
    type: OrchestratorEventType,
    status: WorktaskStatus,
    details?: Record<string, unknown>
  ): void {
    const event: OrchestratorProgressEvent = {
      worktaskId: this.worktask?.id || "",
      type,
      status,
      ...details,
    };

    this.onProgress?.(event);
    this.emit("progress", event);

    this.ipc?.send({
      type: "worktask:progress_updated" as any,
      worktaskId: this.worktask?.id || "",
      agentId: this.agentId,
      timestamp: new Date(),
      payload: { ...event },
    });
  }
}

export class OrchestratorFactory {
  private llmService: LLMServiceInterface;
  private worktaskManager?: WorktaskManager;
  private ipc?: IPCChannel;

  constructor(
    llmService: LLMServiceInterface,
    worktaskManager?: WorktaskManager,
    ipc?: IPCChannel
  ) {
    this.llmService = llmService;
    this.worktaskManager = worktaskManager;
    this.ipc = ipc;
  }

  async create(options: OrchestratorOptions): Promise<Orchestrator> {
    console.log(`[OrchestratorFactory] Creating orchestrator`);
    console.log(`[OrchestratorFactory] Task: ${options.task}`);
    console.log(`[OrchestratorFactory] Tools: ${options.tools.length}`);
    console.log(`[OrchestratorFactory] Skills: ${options.skills.length}`);

    return new Orchestrator(
      options,
      this.llmService,
      this.worktaskManager,
      this.ipc
    );
  }
}
