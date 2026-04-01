import { Environment, type EnvironmentConfig } from "../context/environment.js";
import type { SkillEntry } from "../skills/types.js";
import type { ToolDefinition } from "../tools/index.js";
import {
  OrchestratorSystemPromptBuilder,
  type OrchestratorSystemMessageBlock,
  type OrchestratorPromptConfig,
} from "./orchestrator-system-prompt-builder.js";

export interface OrchestratorContextConfig {
  orchestratorId: string;
  environment?: Environment;
  skills: SkillEntry[];
  tools: ToolDefinition[];
}

export interface OrchestratorContext {
  systemMessages: OrchestratorSystemMessageBlock[];
  systemPrompt: string;
  metadata: {
    orchestratorId: string;
    blockCount: number;
    skillCount: number;
    toolCount: number;
  };
}

export class OrchestratorContextManager {
  private orchestratorId: string;
  private environment?: Environment;
  private skills: SkillEntry[];
  private tools: ToolDefinition[];
  private promptBuilder: OrchestratorSystemPromptBuilder;

  constructor(config: OrchestratorContextConfig) {
    this.orchestratorId = config.orchestratorId;
    this.environment = config.environment;
    this.skills = config.skills;
    this.tools = config.tools;
    this.promptBuilder = new OrchestratorSystemPromptBuilder();
  }

  async buildAnalysisContext(): Promise<OrchestratorContext> {
    console.log(`[OrchestratorContextManager:${this.orchestratorId}] Building analysis context`);

    const promptConfig: OrchestratorPromptConfig = {
      environment: this.environment,
      skills: this.skills,
      tools: this.tools,
    };

    const promptBlocks = await this.promptBuilder.buildAnalysisPrompt(promptConfig);

    const systemPrompt = promptBlocks.systemMessages.map((m) => m.content).join("\n\n");

    console.log(
      `[OrchestratorContextManager:${this.orchestratorId}] Context built with ${promptBlocks.blockCount} blocks`
    );

    return {
      systemMessages: promptBlocks.systemMessages,
      systemPrompt,
      metadata: {
        orchestratorId: this.orchestratorId,
        blockCount: promptBlocks.blockCount,
        skillCount: this.skills.length,
        toolCount: this.tools.length,
      },
    };
  }

  updateEnvironment(environment: Environment): void {
    this.environment = environment;
  }

  updateSkills(skills: SkillEntry[]): void {
    this.skills = skills;
  }

  updateTools(tools: ToolDefinition[]): void {
    this.tools = tools;
  }

  getSkills(): SkillEntry[] {
    return this.skills;
  }

  getTools(): ToolDefinition[] {
    return this.tools;
  }

  getEnvironment(): Environment | undefined {
    return this.environment;
  }

  async compressContext(
    messages: OrchestratorSystemMessageBlock[]
  ): Promise<OrchestratorSystemMessageBlock[]> {
    console.log(
      `[OrchestratorContextManager:${this.orchestratorId}] Context compression not implemented yet`
    );
    return messages;
  }

  async trimContext(
    messages: OrchestratorSystemMessageBlock[],
    maxTokens: number
  ): Promise<OrchestratorSystemMessageBlock[]> {
    console.log(
      `[OrchestratorContextManager:${this.orchestratorId}] Context trimming not implemented yet (maxTokens: ${maxTokens})`
    );
    return messages;
  }
}
