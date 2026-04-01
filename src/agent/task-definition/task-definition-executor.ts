/**
 * 任务定义执行器
 *
 * 执行 JSON 格式定义的任务，支持：
 * - 串行/并行执行
 * - 条件分支
 * - 循环
 * - 用户确认
 * - Skill 调用
 */

import { EventEmitter } from "events";
import type { LLMServiceInterface } from "../runtime/llm-service-interface.js";
import type {
  TaskDefinition,
  TaskStep,
  TaskExecutionContext,
  TaskStepResult,
  TaskExecutionResult,
  TaskCondition,
  TaskBranch,
} from "./types.js";
import { validateTaskDefinition } from "./types.js";
import type { Worktask } from "../worktask/types.js";
import { CheckpointManager } from "../worktask/checkpoint-manager.js";
import { WorktaskManager } from "../worktask/worktask-manager.js";

export interface TaskExecutorConfig {
  agentId: string;
  contactId: string;
  conversationId?: string;
  modelConfig: {
    provider?: string;
    baseUrl: string;
    apiKey: string;
    modelName: string;
    instanceId?: string;
  };
  userHome?: string;
  defaultTimeout?: number;
  maxRetries?: number;
}

export interface SkillExecutor {
  execute(skillId: string, action: string | undefined, params: Record<string, unknown>): Promise<unknown>;
}

export class TaskDefinitionExecutor extends EventEmitter {
  private config: TaskExecutorConfig;
  private llmService: LLMServiceInterface;
  private worktaskManager: WorktaskManager;
  private checkpointManager: CheckpointManager;
  private skillExecutor: SkillExecutor | null = null;

  constructor(
    config: TaskExecutorConfig,
    llmService: LLMServiceInterface,
    worktaskManager?: WorktaskManager
  ) {
    super();
    this.config = config;
    this.llmService = llmService;
    this.worktaskManager = worktaskManager || new WorktaskManager({ mode: "database" });
    this.checkpointManager = new CheckpointManager(
      this.worktaskManager,
      config.userHome
    );
  }

  setSkillExecutor(executor: SkillExecutor): void {
    this.skillExecutor = executor;
  }

  async execute(
    definition: TaskDefinition,
    worktaskId: string,
    inputs: Record<string, unknown> = {}
  ): Promise<TaskExecutionResult> {
    const validation = validateTaskDefinition(definition);
    if (!validation.valid) {
      throw new Error(`Invalid task definition: ${validation.errors.join(", ")}`);
    }

    const startTime = Date.now();
    const context: TaskExecutionContext = {
      worktaskId,
      agentId: this.config.agentId,
      contactId: this.config.contactId,
      conversationId: this.config.conversationId,
      inputs: this.resolveInputs(definition, inputs),
      variables: { ...definition.variables },
      results: new Map(),
      currentStepIndex: 0,
      iterationCount: 0,
      userConfirmRequired: false,
      startTime: new Date(),
      lastActivityTime: new Date(),
    };

    this.emit("execution:started", { worktaskId, definitionId: definition.id });

    try {
      await this.executeSteps(definition.steps, context, worktaskId);

      const outputs = this.resolveOutputs(definition, context);
      const stepResults = Array.from(context.results.values());

      const result: TaskExecutionResult = {
        success: stepResults.every(
          (r) => r.status === "completed" || r.status === "skipped"
        ),
        outputs,
        stepResults,
        duration: Date.now() - startTime,
        userConfirmRequired: context.userConfirmRequired,
        userConfirmData: context.userConfirmData,
      };

      this.emit("execution:completed", { worktaskId, result });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      const result: TaskExecutionResult = {
        success: false,
        outputs: {},
        stepResults: Array.from(context.results.values()),
        error: errorMessage,
        duration: Date.now() - startTime,
      };

      this.emit("execution:failed", { worktaskId, error: errorMessage });

      return result;
    }
  }

  async resume(
    definition: TaskDefinition,
    worktaskId: string,
    userChoice: string
  ): Promise<TaskExecutionResult> {
    const worktask = await this.worktaskManager.get(worktaskId);
    if (!worktask) {
      throw new Error(`Worktask ${worktaskId} not found`);
    }

    const savedContext = await this.checkpointManager.loadIntermediateData(
      worktaskId,
      "taskExecutionContext"
    );

    if (!savedContext) {
      throw new Error("No saved execution context found");
    }

    const context = this.restoreContext(savedContext as Partial<TaskExecutionContext>, worktaskId);
    context.userChoice = userChoice;
    context.userConfirmRequired = false;
    context.lastActivityTime = new Date();

    const startTime = Date.now();

    try {
      await this.executeSteps(definition.steps, context, worktaskId);

      const outputs = this.resolveOutputs(definition, context);
      const stepResults = Array.from(context.results.values());

      return {
        success: stepResults.every(
          (r) => r.status === "completed" || r.status === "skipped"
        ),
        outputs,
        stepResults,
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        outputs: {},
        stepResults: Array.from(context.results.values()),
        error: errorMessage,
        duration: Date.now() - startTime,
      };
    }
  }

  private async executeSteps(
    steps: TaskStep[],
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<void> {
    for (let i = 0; i < steps.length; i++) {
      if (context.userConfirmRequired) {
        return;
      }

      const step = steps[i];
      context.currentStepIndex = i;
      context.lastActivityTime = new Date();

      if (step.dependsOn && !this.checkDependencies(step.dependsOn, context)) {
        this.recordResult(context, step.id, {
          stepId: step.id,
          status: "skipped",
          output: "Dependencies not met",
        });
        continue;
      }

      await this.executeStep(step, context, worktaskId);
    }
  }

  private async executeStep(
    step: TaskStep,
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<void> {
    this.emit("step:started", { stepId: step.id, stepName: step.name });

    const startTime = Date.now();
    let result: TaskStepResult = {
      stepId: step.id,
      status: "running",
      startTime: new Date(),
    };

    this.recordResult(context, step.id, result);

    try {
      let output: unknown;

      switch (step.type) {
        case "skill":
          output = await this.executeSkillStep(step, context);
          break;

        case "action":
          output = await this.executeActionStep(step, context);
          break;

        case "serial":
          output = await this.executeSerialSteps(step.steps!, context, worktaskId);
          break;

        case "parallel":
          output = await this.executeParallelSteps(step.steps!, context, worktaskId);
          break;

        case "conditional":
          output = await this.executeConditionalStep(step, context, worktaskId);
          break;

        case "loop":
          output = await this.executeLoopStep(step, context, worktaskId);
          break;

        case "confirm":
          output = await this.executeConfirmStep(step, context);
          break;

        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      result = {
        ...result,
        status: "completed",
        output,
        endTime: new Date(),
        duration: Date.now() - startTime,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (step.continueOnError || step.skipIfFailed) {
        result = {
          ...result,
          status: step.skipIfFailed ? "skipped" : "completed",
          error: errorMessage,
          endTime: new Date(),
          duration: Date.now() - startTime,
        };
      } else {
        result = {
          ...result,
          status: "failed",
          error: errorMessage,
          endTime: new Date(),
          duration: Date.now() - startTime,
        };
        this.recordResult(context, step.id, result);
        throw error;
      }
    }

    this.recordResult(context, step.id, result);
    this.emit("step:completed", { stepId: step.id, status: result.status });

    if (step.outputMapping) {
      this.applyOutputMapping(step.outputMapping, result.output, context);
    }
  }

  private async executeSkillStep(
    step: TaskStep,
    context: TaskExecutionContext
  ): Promise<unknown> {
    if (!this.skillExecutor) {
      throw new Error("Skill executor not configured");
    }

    const params = this.resolveParams(step.skill?.params || {}, context);
    
    return this.skillExecutor.execute(
      step.skill!.id,
      step.skill!.action,
      params
    );
  }

  private async executeActionStep(
    step: TaskStep,
    context: TaskExecutionContext
  ): Promise<unknown> {
    const params = this.resolveParams(step.action?.params || {}, context);

    switch (step.action!.type) {
      case "setVariable":
        const varName = params.name as string;
        const varValue = params.value;
        context.variables[varName] = varValue;
        return { [varName]: varValue };

      case "httpRequest":
        return this.executeHttpRequest(params);

      case "log":
        console.log("[TaskExecutor]", params.message);
        return { logged: true };

      case "emit":
        this.emit(params.event as string, params.data);
        return { emitted: true };

      default:
        throw new Error(`Unknown action type: ${step.action!.type}`);
    }
  }

  private async executeHttpRequest(params: Record<string, unknown>): Promise<unknown> {
    const url = params.url as string;
    const method = (params.method as string) || "GET";
    const headers = params.headers as Record<string, string> || {};
    const body = params.body;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json();
    }
    return response.text();
  }

  private async executeSerialSteps(
    steps: TaskStep[],
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<unknown> {
    const results: unknown[] = [];

    for (const step of steps) {
      if (context.userConfirmRequired) break;
      
      await this.executeStep(step, context, worktaskId);
      const result = context.results.get(step.id);
      if (result) {
        results.push(result.output);
      }
    }

    return results;
  }

  private async executeParallelSteps(
    steps: TaskStep[],
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<unknown> {
    const promises = steps.map((step) =>
      this.executeStep(step, context, worktaskId).then(() => {
        const result = context.results.get(step.id);
        return result?.output;
      }).catch((error) => {
        if (step.continueOnError) {
          return { error: error.message };
        }
        throw error;
      })
    );

    const results = await Promise.all(promises);
    return results;
  }

  private async executeConditionalStep(
    step: TaskStep,
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<unknown> {
    for (const branch of step.branches || []) {
      if (this.evaluateCondition(branch.condition, context)) {
        if (branch.steps) {
          await this.executeSteps(branch.steps, context, worktaskId);
        }
        return { branch: branch.label || "matched" };
      }
    }

    if (step.defaultBranch) {
      await this.executeSteps(step.defaultBranch, context, worktaskId);
      return { branch: "default" };
    }

    return { branch: "none" };
  }

  private async executeLoopStep(
    step: TaskStep,
    context: TaskExecutionContext,
    worktaskId: string
  ): Promise<unknown> {
    const maxIterations = step.maxIterations || 10;
    const results: unknown[] = [];

    for (let i = 0; i < maxIterations; i++) {
      context.iterationCount = i;

      if (step.exitCondition && this.evaluateCondition(step.exitCondition, context)) {
        break;
      }

      if (context.userConfirmRequired) break;

      if (step.steps) {
        await this.executeSteps(step.steps, context, worktaskId);
      }

      const iterationResults = step.steps?.map((s) => context.results.get(s.id)?.output);
      results.push(iterationResults);
    }

    return { iterations: context.iterationCount, results };
  }

  private async executeConfirmStep(
    step: TaskStep,
    context: TaskExecutionContext
  ): Promise<unknown> {
    if (context.userChoice !== undefined) {
      return { choice: context.userChoice };
    }

    context.userConfirmRequired = true;
    context.userConfirmData = {
      stepId: step.id,
      message: step.confirmMessage || "Please confirm",
      options: step.confirmOptions || [
        { label: "确认", value: "confirm" },
        { label: "取消", value: "cancel" },
      ],
    };

    await this.checkpointManager.saveIntermediateData(
      context.worktaskId,
      "taskExecutionContext",
      this.serializeContext(context)
    );

    return { waitingForConfirm: true };
  }

  private evaluateCondition(condition: TaskCondition, context: TaskExecutionContext): boolean {
    const value = this.getConditionValue(condition, context);
    const target = condition.value;

    switch (condition.type) {
      case "equals":
        return value === target;

      case "not_equals":
        return value !== target;

      case "contains":
        return String(value).includes(String(target));

      case "not_contains":
        return !String(value).includes(String(target));

      case "exists":
        return value !== undefined && value !== null;

      case "not_exists":
        return value === undefined || value === null;

      case "greater_than":
        return Number(value) > Number(target);

      case "less_than":
        return Number(value) < Number(target);

      case "regex":
        const regex = new RegExp(String(target));
        return regex.test(String(value));

      default:
        return false;
    }
  }

  private getConditionValue(condition: TaskCondition, context: TaskExecutionContext): unknown {
    const source = condition.source || "context";
    const field = condition.field;

    switch (source) {
      case "context":
        return this.getNestedValue(context, field);
      case "result":
        const stepResult = context.results.get(field);
        return stepResult?.output;
      case "env":
        return process.env[field];
      default:
        return undefined;
    }
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private checkDependencies(dependsOn: string[], context: TaskExecutionContext): boolean {
    return dependsOn.every((depId) => {
      const result = context.results.get(depId);
      return result?.status === "completed";
    });
  }

  private resolveInputs(
    definition: TaskDefinition,
    inputs: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const inputDef of definition.inputs || []) {
      if (inputs[inputDef.name] !== undefined) {
        resolved[inputDef.name] = inputs[inputDef.name];
      } else if (inputDef.default !== undefined) {
        resolved[inputDef.name] = inputDef.default;
      } else if (inputDef.required) {
        throw new Error(`Missing required input: ${inputDef.name}`);
      }
    }

    return resolved;
  }

  private resolveParams(
    params: Record<string, unknown>,
    context: TaskExecutionContext
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value.startsWith("${") && value.endsWith("}")) {
        const path = value.slice(2, -1);
        resolved[key] = this.getNestedValue(context, path);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private resolveOutputs(
    definition: TaskDefinition,
    context: TaskExecutionContext
  ): Record<string, unknown> {
    const outputs: Record<string, unknown> = {};

    for (const outputDef of definition.outputs || []) {
      const value = this.getNestedValue(context, outputDef.source);
      outputs[outputDef.name] = value;
    }

    return outputs;
  }

  private applyOutputMapping(
    mapping: Record<string, string>,
    output: unknown,
    context: TaskExecutionContext
  ): void {
    for (const [targetPath, sourcePath] of Object.entries(mapping)) {
      const value = this.getNestedValue(output, sourcePath);
      const parts = targetPath.split(".");
      let current: Record<string, unknown> = context.variables;

      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]] as Record<string, unknown>;
      }

      current[parts[parts.length - 1]] = value;
    }
  }

  private recordResult(
    context: TaskExecutionContext,
    stepId: string,
    result: TaskStepResult
  ): void {
    context.results.set(stepId, result);
  }

  private serializeContext(context: TaskExecutionContext): Record<string, unknown> {
    return {
      worktaskId: context.worktaskId,
      agentId: context.agentId,
      contactId: context.contactId,
      conversationId: context.conversationId,
      inputs: context.inputs,
      variables: context.variables,
      results: Object.fromEntries(context.results),
      currentStepIndex: context.currentStepIndex,
      iterationCount: context.iterationCount,
      userConfirmRequired: context.userConfirmRequired,
      userConfirmData: context.userConfirmData,
      startTime: context.startTime.toISOString(),
      lastActivityTime: context.lastActivityTime.toISOString(),
    };
  }

  private restoreContext(
    saved: Partial<TaskExecutionContext>,
    worktaskId: string
  ): TaskExecutionContext {
    const results = new Map<string, TaskStepResult>();
    if (saved.results) {
      const record = saved.results as unknown as Record<string, TaskStepResult>;
      for (const [key, value] of Object.entries(record)) {
        results.set(key, value);
      }
    }

    return {
      worktaskId,
      agentId: saved.agentId || this.config.agentId,
      contactId: saved.contactId || this.config.contactId,
      conversationId: saved.conversationId,
      inputs: saved.inputs || {},
      variables: saved.variables || {},
      results,
      currentStepIndex: saved.currentStepIndex || 0,
      iterationCount: saved.iterationCount || 0,
      userConfirmRequired: false,
      startTime: saved.startTime ? new Date(saved.startTime) : new Date(),
      lastActivityTime: new Date(),
    };
  }
}

export function createTaskDefinitionExecutor(
  config: TaskExecutorConfig,
  llmService: LLMServiceInterface,
  worktaskManager?: WorktaskManager
): TaskDefinitionExecutor {
  return new TaskDefinitionExecutor(config, llmService, worktaskManager);
}
