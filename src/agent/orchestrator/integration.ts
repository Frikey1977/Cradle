/**
 * Agent 层与 Orchestrator/Executor 集成
 *
 * 职责：
 * - 接收 Agent 层的任务执行请求
 * - 根据调用类型直接路由到 Orchestrator 或 Executor
 * - 管理 Worktask 生命周期
 *
 * 注意：任务路由由 Agent 层 LLM 通过 tool_call 决定，
 * 此模块不再进行任务复杂度分析
 */

import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type { ToolDefinition } from "../tools/index.js";
import type { SkillEntry } from "../skills/types.js";
import type { ModelConfig } from "../types/index.js";
import { Orchestrator, OrchestratorFactory, type OrchestratorOptions, type OrchestratorProgressEvent } from "../orchestrator/index.js";
import { createExecutor, type ExecutorOptions } from "../executor/index.js";
import { WorktaskManager } from "../worktask/index.js";
import { Environment, type EnvironmentConfig } from "../context/environment.js";

export interface AgentOrchestratorConfig {
  agentId: string;
  contactId: string;
  conversationId: string;
  modelConfig: ModelConfig;
  maxIterations: number;
  timeout: number;
  environment?: Environment;
}

export interface AgentOrchestratorOptions {
  task: string;
  tools: ToolDefinition[];
  skills: SkillEntry[];
  systemPrompt: string;
  systemMessages?: Array<{ role: "system"; content: string; category?: string }>;
  conversationHistory?: Array<{ role: string; content: string }>;
  config: AgentOrchestratorConfig;
  onProgress?: (event: OrchestratorProgressEvent) => void;
}

export interface TaskExecutionResult {
  success: boolean;
  output: string;
  worktaskId?: string;
  steps?: number;
  executors?: number;
  duration?: number;
  error?: string;
}

export class AgentOrchestratorIntegration {
  private llmService: LLMServiceInterface;
  private orchestratorFactory: OrchestratorFactory;
  private worktaskManager: WorktaskManager;

  constructor(llmService: LLMServiceInterface) {
    this.llmService = llmService;
    this.worktaskManager = new WorktaskManager();
    this.orchestratorFactory = new OrchestratorFactory(llmService, this.worktaskManager);
  }

  async executeWithOrchestrator(options: AgentOrchestratorOptions): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    console.log(`[AgentOrchestratorIntegration] Executing with Orchestrator: ${options.task.substring(0, 100)}...`);

    const orchestratorOptions: OrchestratorOptions = {
      task: options.task,
      tools: options.tools,
      skills: options.skills,
      context: {
        constraints: {
          timeout: options.config.timeout,
          maxExecutors: 5,
        },
      },
      config: {
        agentId: options.config.agentId,
        contactId: options.config.contactId,
        conversationId: options.config.conversationId,
        maxIterations: options.config.maxIterations,
        timeout: options.config.timeout,
        modelConfig: options.config.modelConfig,
        environment: options.config.environment,
      },
      onProgress: options.onProgress,
    };

    const orchestrator = await this.orchestratorFactory.create(orchestratorOptions);
    const result = await orchestrator.orchestrate();

    return {
      success: result.success,
      output: result.output,
      worktaskId: result.steps[0]?.stepId,
      steps: result.metrics.totalSteps,
      executors: result.metrics.totalExecutors,
      duration: Date.now() - startTime,
      error: result.success ? undefined : "任务执行失败",
    };
  }

  async executeWithExecutor(options: AgentOrchestratorOptions): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    console.log(`[AgentOrchestratorIntegration] Executing with Executor: ${options.task.substring(0, 100)}...`);

    const skillsArray = options.skills.map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      location: s.location,
    }));

    // 获取实例配置，底层会自动处理实例不存在的情况
    const targetInstanceId = options.config.modelConfig.instanceId || "auto";
    const instanceConfig = await this.llmService.getInstanceConfig(targetInstanceId);
    if (!instanceConfig) {
      throw new Error(`No available LLM instance found`);
    }

    const executor = await createExecutor({
      modelConfig: {
        provider: instanceConfig.provider,
        baseUrl: instanceConfig.baseUrl,
        apiKey: instanceConfig.apiKey,
        modelName: instanceConfig.modelName,
        instanceId: instanceConfig.instanceId,
      },
      task: {
        description: options.task,
      },
      skills: skillsArray,
      tools: options.tools,
      maxSteps: options.config.maxIterations,
      environment: options.config.environment,
    });

    const result = await executor.execute();

    return {
      success: result.success,
      output: result.output,
      steps: result.steps.length,
      duration: Date.now() - startTime,
      error: result.error?.message,
    };
  }

  getWorktaskManager(): WorktaskManager {
    return this.worktaskManager;
  }

  async getActiveWorktasks(agentId: string): Promise<any[]> {
    return this.worktaskManager.getByAgent(agentId);
  }

  async cancelWorktask(worktaskId: string): Promise<void> {
    await this.worktaskManager.cancel(worktaskId);
  }

  async getWorktaskProgress(worktaskId: string): Promise<any | null> {
    return this.worktaskManager.getProgress(worktaskId);
  }
}

export function createAgentOrchestratorIntegration(
  llmService: LLMServiceInterface
): AgentOrchestratorIntegration {
  return new AgentOrchestratorIntegration(llmService);
}
