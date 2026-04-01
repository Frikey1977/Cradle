import { Environment, type EnvironmentConfig } from "../context/environment.js";
import {
  HandlerSystemPromptBuilder,
  type HandlerSystemMessageBlock,
  type HandlerPromptConfig,
} from "./handler-system-prompt-builder.js";

export interface HandlerContextConfig {
  handlerId: string;
  environment?: Environment;
}

export interface HandlerContext {
  systemMessages: HandlerSystemMessageBlock[];
  systemPrompt: string;
  metadata: {
    handlerId: string;
    blockCount: number;
  };
}

export class HandlerContextManager {
  private handlerId: string;
  private environment?: Environment;
  private promptBuilder: HandlerSystemPromptBuilder;

  constructor(config: HandlerContextConfig) {
    this.handlerId = config.handlerId;
    this.environment = config.environment;
    this.promptBuilder = new HandlerSystemPromptBuilder();
  }

  async build(): Promise<HandlerContext> {
    console.log(`[HandlerContextManager:${this.handlerId}] Building context`);

    const promptConfig: HandlerPromptConfig = {
      environment: this.environment,
    };

    const promptBlocks = await this.promptBuilder.build(promptConfig);

    const systemPrompt = promptBlocks.systemMessages.map((m) => m.content).join("\n\n");

    console.log(
      `[HandlerContextManager:${this.handlerId}] Context built with ${promptBlocks.blockCount} blocks`
    );

    return {
      systemMessages: promptBlocks.systemMessages,
      systemPrompt,
      metadata: {
        handlerId: this.handlerId,
        blockCount: promptBlocks.blockCount,
      },
    };
  }

  updateEnvironment(environment: Environment): void {
    this.environment = environment;
  }

  getEnvironment(): Environment | undefined {
    return this.environment;
  }

  async compressContext(messages: HandlerSystemMessageBlock[]): Promise<HandlerSystemMessageBlock[]> {
    console.log(`[HandlerContextManager:${this.handlerId}] Context compression not implemented yet`);
    return messages;
  }

  async trimContext(
    messages: HandlerSystemMessageBlock[],
    maxTokens: number
  ): Promise<HandlerSystemMessageBlock[]> {
    console.log(
      `[HandlerContextManager:${this.handlerId}] Context trimming not implemented yet (maxTokens: ${maxTokens})`
    );
    return messages;
  }
}
