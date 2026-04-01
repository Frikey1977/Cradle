/**
 * 上下文管理器 (ContextManager)
 *
 * 负责构建、优化和管理 Agent 运行时的完整上下文
 * 包括：多维度画像、对话历史、相关记忆、可用技能
 *
 * Skill 系统采用 LLM 理解执行模式：
 * - 只注入 Skill 列表（name + description + location）
 * - LLM 通过 read 工具读取完整 SKILL.md
 * - LLM 理解后自主决定如何执行
 */

import type {
  ContextParams,
  EnhancedContext,
  ProfileCollection,
  ProfileLoadParams,
  ConversationMessage,
  Memory,
  ContextMetadata,
  ModelConfig,
  SystemMessageBlock,
} from "../types/index.js";
import type { ToolDefinition } from "../../llm/runtime/types.js";
import { ProfileLoader } from "./profile-loader.js";
import { SystemPromptBuilder } from "./system-prompt-builder.js";
import { MemoryManager, type MemoryManagerConfig } from "../memory/index.js";
import {
  loadAgentSkillEntries,
  buildAgentSkillsSection,
  type SkillEntry,
} from "./skills.js";
import { buildAgentTools } from "../tools/agent-tools.js";
import { Environment } from "./environment.js";
import type {
  ProfileRepository,
  LLMInstanceRepository,
} from "./repositories/index.js";

export class ContextManager {
  private agentId: string;
  private profileLoader: ProfileLoader;
  private promptBuilder: SystemPromptBuilder;
  private memoryManager: MemoryManager | null = null;
  private cachedSkills: SkillEntry[] | null = null;

  constructor(
    agentId: string,
    private profileRepo: ProfileRepository,
    private llmInstanceRepo: LLMInstanceRepository
  ) {
    this.agentId = agentId;
    this.profileLoader = new ProfileLoader(profileRepo);
    this.promptBuilder = new SystemPromptBuilder();
  }

  async initializeMemoryManager(contactId: string, conversationId?: string, config?: Partial<MemoryManagerConfig>): Promise<void> {
    console.log(`[ContextManager:${this.agentId}] Initializing memory manager for contact: ${contactId}`);

    this.memoryManager = new MemoryManager({
      agentId: this.agentId,
      contactId,
      conversationId,
      layers: {
        shortTermMaxEntries: 50,
        enableConversationLog: false,
        enableLongTermMemory: false,
        ...config?.layers,
      },
      ...config,
    });

    await this.memoryManager.initialize();
    console.log(`[ContextManager:${this.agentId}] Memory manager initialized successfully`);
  }

  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }

  async build(params: ContextParams): Promise<EnhancedContext> {
    console.log(`[ContextManager:${this.agentId}] Building context for agent ${params.agentId}`);

    const [profiles, history, memories, modelConfig, skillEntries] = await Promise.all([
      this.loadProfiles({
        agentId: params.agentId,
        contactId: params.contactId,
        conversationId: params.conversationId,
      }),
      this.getConversationHistory(params.conversationId, params.contactId),
      this.retrieveMemories(params.content),
      this.getModelConfig(),
      this.loadSkills(),
    ]);

    console.log(`[ContextManager:${this.agentId}] skillEntries from loadSkills:`, skillEntries.map(e => e.name));

    // 构建多个 system 消息块
    const promptBlocksResult = await this.promptBuilder.build(profiles);
    const promptBlocks = promptBlocksResult.systemMessages;
    const skillsSection = await buildAgentSkillsSection(this.agentId);

    // 调试：打印 skillsSection 的前 500 个字符
    console.log(`[ContextManager:${this.agentId}] skillsSection (first 500 chars):`, skillsSection?.substring(0, 500));

    // 构建工具定义
    const availableTools = buildAgentTools(skillEntries);

    console.log(`[ContextManager:${this.agentId}] Available tools:`, availableTools.map(t => t.function.name));

    // 构建环境上下文
    const environment = Environment.fromProfiles(profiles);

    // 组装最终上下文
    const systemMessages = this.buildSystemMessages(promptBlocks, skillsSection, profiles);

    // 获取系统提示词（用于兼容旧版本）
    const systemPrompt = this.buildLegacySystemPrompt(promptBlocks, skillsSection, profiles);

    const result: EnhancedContext = {
      systemPrompt,
      systemMessages,
      conversationHistory: history,
      memories,
      modelConfig,
      availableTools,
      metadata: this.buildMetadata(params, profiles),
      environment,
      contactName: profiles.contact?.name,
    };

    console.log(`[ContextManager:${this.agentId}] Context built successfully`);
    return result;
  }

  private async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection> {
    return this.profileLoader.loadProfiles(params);
  }

  private async getConversationHistory(
    conversationId?: string,
    contactId?: string
  ): Promise<ConversationMessage[]> {
    // 短期记忆存储在 relationship 表中，通过 agentId + contactId 查询
    // 不需要 conversationId，只需要 memoryManager 已初始化
    if (!this.memoryManager) {
      return [];
    }

    try {
      const history = await this.memoryManager.getConversationHistory(50);
      return history.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        timestamp: msg.timestamp,
      }));
    } catch (error) {
      console.error(`[ContextManager] Failed to get conversation history:`, error);
      return [];
    }
  }

  private async retrieveMemories(content: string): Promise<Memory[]> {
    if (!this.memoryManager) {
      return [];
    }

    try {
      const entries = await this.memoryManager.retrieveLongTerm(content);
      return entries.map(entry => ({
        id: entry.id,
        content: String(entry),
        type: "long_term",
        relevance: 1.0,
      }));
    } catch (error) {
      console.error(`[ContextManager] Failed to retrieve memories:`, error);
      return [];
    }
  }

  private async getModelConfig(): Promise<ModelConfig> {
    // 默认配置
    const defaultConfig: ModelConfig = {
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4000,
    };

    try {
      // 从 Agent 配置中获取模型配置
      const agentProfile = await this.profileRepo.loadAgentProfile(this.agentId);
      if (agentProfile?.profile?.model) {
        const modelConfig = agentProfile.profile.model as Partial<ModelConfig>;
        return {
          ...defaultConfig,
          ...modelConfig,
        };
      }
    } catch (error) {
      console.error(`[ContextManager] Failed to get model config:`, error);
    }

    return defaultConfig;
  }

  private async loadSkills(): Promise<SkillEntry[]> {
    if (this.cachedSkills) {
      return this.cachedSkills;
    }

    try {
      const skills = await loadAgentSkillEntries(this.agentId);
      this.cachedSkills = skills;
      return skills;
    } catch (error) {
      console.error(`[ContextManager] Failed to load skills:`, error);
      return [];
    }
  }

  private buildSystemMessages(
    promptBlocks: SystemMessageBlock[],
    skillsSection: string | null,
    profiles: ProfileCollection
  ): SystemMessageBlock[] {
    const messages: SystemMessageBlock[] = [...promptBlocks];

    // 添加技能信息
    if (skillsSection) {
      messages.push({
        role: "system",
        category: "skills",
        content: skillsSection,
      });
    }

    return messages;
  }

  private buildLegacySystemPrompt(
    promptBlocks: SystemMessageBlock[],
    skillsSection: string | null,
    profiles: ProfileCollection
  ): string {
    const parts: string[] = [];

    // 添加 Agent 基础信息
    if (profiles.agent) {
      parts.push(`你是 ${profiles.agent.name}，`);
      if (profiles.agent.soul) {
        parts.push(`你的核心特质是：${profiles.agent.soul}。`);
      }
    }

    // 添加用户画像信息
    if (profiles.contact) {
      parts.push(`\n当前用户是 ${profiles.contact.name}。`);
      if (profiles.contact.organization) {
        const org = profiles.contact.organization;
        if (org.company) {
          parts.push(`来自 ${org.company.name}`);
        }
        if (org.department) {
          parts.push(` ${org.department.name}`);
        }
        if (org.position) {
          parts.push(`，职位是 ${org.position.name}`);
        }
        parts.push(`。`);
      }
    }

    // 添加关系信息
    if (profiles.relationship) {
      const rel = profiles.relationship;
      parts.push(`\n你们已建立联系。`);
      if (rel.contactToAgent) {
        parts.push(`用户偏好：${JSON.stringify(rel.contactToAgent)}。`);
      }
      if (rel.agentToContact) {
        parts.push(`Agent偏好：${JSON.stringify(rel.agentToContact)}。`);
      }
    }

    // 添加其他系统消息块的内容
    const otherBlocks = promptBlocks.filter(b => !b.category);
    if (otherBlocks.length > 0) {
      parts.push(`\n${otherBlocks.map(b => b.content).join("\n")}`);
    }

    // 添加技能信息
    if (skillsSection) {
      parts.push(`\n\n${skillsSection}`);
    }

    return parts.join("");
  }

  private buildMetadata(params: ContextParams, profiles: ProfileCollection): ContextMetadata {
    return {
      agentId: params.agentId,
      contactId: params.contactId,
    };
  }

  async addUserMessage(content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.memoryManager) {
      await this.memoryManager.addUserMessage(content, metadata);
    }
  }

  async addAssistantMessage(content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.memoryManager) {
      await this.memoryManager.addAssistantMessage(content, metadata);
    }
  }
}
