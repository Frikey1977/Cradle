import { Environment, type EnvironmentConfig } from "../context/environment.js";
import {
  ExecutorSystemPromptBuilder,
  type ExecutorSystemMessageBlock,
  type ExecutorPromptConfig,
} from "./executor-system-prompt-builder.js";

export interface ExecutorContextConfig {
  executorId: string;
  environment?: Environment;
  skills?: Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }>;
  task: {
    description: string;
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ExecutorContext {
  systemMessages: ExecutorSystemMessageBlock[];
  systemPrompt: string;
  metadata: {
    executorId: string;
    blockCount: number;
    skillCount: number;
  };
}

export class ExecutorContextManager {
  private executorId: string;
  private environment?: Environment;
  private skills?: Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }>;
  private task: {
    description: string;
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  };
  private promptBuilder: ExecutorSystemPromptBuilder;

  constructor(config: ExecutorContextConfig) {
    this.executorId = config.executorId;
    this.environment = config.environment;
    this.skills = config.skills;
    this.task = config.task;
    this.promptBuilder = new ExecutorSystemPromptBuilder();
  }

  async build(): Promise<ExecutorContext> {
    console.log(`[ExecutorContextManager:${this.executorId}] Building context`);

    const promptConfig: ExecutorPromptConfig = {
      environment: this.environment,
      skills: this.skills,
      task: this.task,
    };

    const promptBlocks = await this.promptBuilder.build(promptConfig);

    const systemPrompt = promptBlocks.systemMessages.map((m) => m.content).join("\n\n");

    console.log(
      `[ExecutorContextManager:${this.executorId}] Context built with ${promptBlocks.blockCount} blocks`
    );

    return {
      systemMessages: promptBlocks.systemMessages,
      systemPrompt,
      metadata: {
        executorId: this.executorId,
        blockCount: promptBlocks.blockCount,
        skillCount: this.skills?.length || 0,
      },
    };
  }

  updateEnvironment(environment: Environment): void {
    this.environment = environment;
  }

  updateSkills(skills: Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }>): void {
    this.skills = skills;
  }

  updateTask(task: {
    description: string;
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  }): void {
    this.task = task;
  }

  getSkills(): Array<{
    name: string;
    description?: string;
    filePath?: string;
    location?: string;
  }> | undefined {
    return this.skills;
  }

  getTask(): {
    description: string;
    skillSlug?: string;
    toolName?: string;
    parameters?: Record<string, unknown>;
  } {
    return this.task;
  }

  getEnvironment(): Environment | undefined {
    return this.environment;
  }

  async compressContext(
    messages: ExecutorSystemMessageBlock[]
  ): Promise<ExecutorSystemMessageBlock[]> {
    console.log(
      `[ExecutorContextManager:${this.executorId}] Context compression not implemented yet`
    );
    return messages;
  }

  async trimContext(
    messages: ExecutorSystemMessageBlock[],
    maxTokens: number
  ): Promise<ExecutorSystemMessageBlock[]> {
    console.log(
      `[ExecutorContextManager:${this.executorId}] Context trimming not implemented yet (maxTokens: ${maxTokens})`
    );
    return messages;
  }
}
