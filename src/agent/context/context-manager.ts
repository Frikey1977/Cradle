/**
 * 上下文管理器 (ContextManager)
 *
 * 负责构建、优化和管理 Agent 运行时的完整上下文
 * 包括：多维度画像、对话历史、相关记忆、可用技能
 *
 * 支持渐进式披露模式：
 * - full: 加载所有 Skills 和 tools（原有模式）
 * - metadata: 只加载 Skill Metadata，不加载 tools（用于主 Agent 意图识别）
 * - intent: 根据意图匹配加载指定 Skills 的 tools（用于 Executor）
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
} from "../types/index.js";
import type { ToolDefinition } from "../../llm/runtime/types.js";
import { ProfileLoader } from "./profile-loader.js";
import { SystemPromptBuilder } from "./system-prompt-builder.js";
import { MemoryManager, type MemoryManagerConfig } from "../memory/index.js";
import {
  loadAgentSkills,
  buildAgentSystemPrompt,
  buildMetadataSystemPrompt,
  getToolsForIntent,
  initializeDisclosureManager,
  getDisclosureManager,
  convertSkillsToTools,
  type IntentMatchResult,
} from "./skills.js";
import type { ParsedSkill } from "../skills/types.js";

export type ContextBuildMode = "full" | "metadata" | "intent";

// 数据库查询接口
interface DatabaseQuery {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
}

/**
 * 上下文管理器
 */
export class ContextManager {
  private agentId: string;
  private db: DatabaseQuery;
  private profileLoader: ProfileLoader;
  private promptBuilder: SystemPromptBuilder;
  private memoryManager: MemoryManager | null = null;

  constructor(agentId: string, db?: DatabaseQuery) {
    this.agentId = agentId;
    this.db = db || ({} as DatabaseQuery);
    this.profileLoader = new ProfileLoader(this.db);
    this.promptBuilder = new SystemPromptBuilder();
  }

  /**
   * 初始化记忆管理器
   */
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

    // 初始化记忆管理器各层
    await this.memoryManager.initialize();
    console.log(`[ContextManager:${this.agentId}] Memory manager initialized successfully`);
  }

  /**
   * 获取记忆管理器
   */
  getMemoryManager(): MemoryManager | null {
    return this.memoryManager;
  }

  /**
   * 构建完整上下文
   * @param params 上下文参数
   * @param mode 构建模式：
   *   - "full": 加载所有 Skills 和 tools（默认，原有模式）
   *   - "metadata": 只加载 Skill Metadata，不加载 tools（用于主 Agent 意图识别）
   *   - "intent": 根据意图匹配加载指定 Skills 的 tools（用于 Executor）
   */
  async build(params: ContextParams, mode: ContextBuildMode = "full"): Promise<EnhancedContext> {
    // 根据模式选择不同的构建策略
    if (mode === "metadata") {
      return this.buildMetadataContext(params);
    } else if (mode === "intent" && params.content) {
      return this.buildIntentContext(params);
    }

    // 默认：完整模式（原有逻辑）
    return this.buildFullContext(params);
  }

  /**
   * 构建完整上下文（原有模式：加载所有 Skills 和 tools）
   */
  private async buildFullContext(params: ContextParams): Promise<EnhancedContext> {
    // 1. 加载 Skills（包含 Position-Skill 关联）
    const skills = await loadAgentSkills(this.agentId);

    // 2. 构建包含 Skills 的系统提示词
    const basePrompt = await buildAgentSystemPrompt(this.agentId);
    console.log(`[ContextManager:${this.agentId}] Built system prompt with skills, length: ${basePrompt.length}`);

    // 3. 并行获取其他数据
    const [profiles, history, memories, modelConfig] = await Promise.all([
      this.loadProfiles({
        agentId: params.agentId,
        contactId: params.contactId,
        conversationId: params.conversationId,
      }),
      this.getConversationHistory(params.conversationId, params.contactId),
      this.retrieveMemories(params.content),
      this.getModelConfig(),
    ]);

    // 4. 构建完整的系统提示词（画像 + Skills）
    const profilePrompt = this.promptBuilder.build(profiles);
    const systemPrompt = basePrompt 
      ? `${basePrompt}\n\n${profilePrompt}`
      : profilePrompt;

    // 转换 skills 为 tools
    const availableTools = this.convertSkillsToTools(skills);
    
    if (skills.length > 0) {
      console.log(`[ContextManager:${this.agentId}] [FULL MODE] Loaded ${skills.length} skills, ${availableTools.length} tools`);
    }

    return {
      systemPrompt,
      modelConfig,
      conversationHistory: history,
      memories,
      availableTools,
      metadata: {
        agentId: this.agentId,
        contactId: params.contactId,
        isHeartbeat: params.isHeartbeat,
      },
    };
  }

  /**
   * 构建 Metadata 级上下文（渐进式披露：只加载 Skill Metadata，不加载 tools）
   * 用于主 Agent 的意图识别
   */
  private async buildMetadataContext(params: ContextParams): Promise<EnhancedContext> {
    // 1. 初始化披露管理器
    await initializeDisclosureManager(this.agentId);

    // 2. 构建 Metadata 级系统提示词
    const basePrompt = await buildMetadataSystemPrompt(this.agentId);
    console.log(`[ContextManager:${this.agentId}] Built metadata system prompt, length: ${basePrompt.length}`);

    // 3. 并行获取其他数据
    const [profiles, history, memories, modelConfig] = await Promise.all([
      this.loadProfiles({
        agentId: params.agentId,
        contactId: params.contactId,
        conversationId: params.conversationId,
      }),
      this.getConversationHistory(params.conversationId, params.contactId),
      this.retrieveMemories(params.content),
      this.getModelConfig(),
    ]);

    // 4. 构建完整的系统提示词
    const profilePrompt = this.promptBuilder.build(profiles);
    const systemPrompt = basePrompt 
      ? `${basePrompt}\n\n${profilePrompt}`
      : profilePrompt;

    // Metadata 模式：不加载 tools
    console.log(`[ContextManager:${this.agentId}] [METADATA MODE] No tools loaded (progressive disclosure)`);

    return {
      systemPrompt,
      modelConfig,
      conversationHistory: history,
      memories,
      availableTools: [], // 不加载 tools
      metadata: {
        agentId: this.agentId,
        contactId: params.contactId,
        isHeartbeat: params.isHeartbeat,
        disclosureMode: "metadata",
      },
    };
  }

  /**
   * 构建意图匹配上下文（渐进式披露：根据意图加载指定 Skills 的 tools）
   * 用于 Executor 执行
   */
  private async buildIntentContext(params: ContextParams): Promise<EnhancedContext> {
    // 1. 构建 Metadata 级系统提示词（不包含所有 Skills 的完整信息）
    const basePrompt = await buildMetadataSystemPrompt(this.agentId);

    // 2. 并行获取其他数据
    const [profiles, history, memories, modelConfig] = await Promise.all([
      this.loadProfiles({
        agentId: params.agentId,
        contactId: params.contactId,
        conversationId: params.conversationId,
      }),
      this.getConversationHistory(params.conversationId, params.contactId),
      this.retrieveMemories(params.content),
      this.getModelConfig(),
    ]);

    // 3. 获取意图匹配的 tools
    const { tools, matchedSkills, intentResult } = await getToolsForIntent(
      this.agentId,
      params.content || ""
    );

    console.log(`[ContextManager:${this.agentId}] [INTENT MODE] Matched skills: ${matchedSkills.join(", ") || "none"}, tools: ${tools.length}`);

    // 4. 构建完整的系统提示词
    const profilePrompt = this.promptBuilder.build(profiles);
    const systemPrompt = basePrompt 
      ? `${basePrompt}\n\n${profilePrompt}`
      : profilePrompt;

    return {
      systemPrompt,
      modelConfig,
      conversationHistory: history,
      memories,
      availableTools: tools, // 只加载匹配的 tools
      metadata: {
        agentId: this.agentId,
        contactId: params.contactId,
        isHeartbeat: params.isHeartbeat,
        disclosureMode: "intent",
        matchedSkills,
        intentConfidence: intentResult.confidence,
        intentReason: intentResult.reason,
      },
    };
  }

  /**
   * 根据意图获取 Tools（用于 Executor 动态加载）
   */
  async getToolsForUserMessage(userMessage: string): Promise<{
    tools: ToolDefinition[];
    matchedSkills: string[];
    intentResult: IntentMatchResult;
  }> {
    return getToolsForIntent(this.agentId, userMessage);
  }

  /**
   * 将 Skills 转换为 Tool 定义
   * 每个 command 作为一个独立的 tool
   */
  private convertSkillsToTools(skills: ParsedSkill[]): Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    const tools: Array<{
      type: "function";
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }> = [];
    
    for (const skill of skills) {
      for (const cmd of skill.commands) {
        tools.push({
          type: "function",
          function: {
            name: `skill_${skill.slug}_${cmd.name}`,
            description: `${skill.description}\n\nCommand: ${cmd.description || cmd.name}`,
            parameters: {
              type: "object",
              properties: cmd.parameters.reduce((acc, param) => {
                acc[param.name] = {
                  type: param.type,
                  description: param.description || `Parameter: ${param.name}`,
                };
                return acc;
              }, {} as Record<string, unknown>),
              required: cmd.parameters.filter(p => p.required).map(p => p.name),
            },
          },
        });
      }
    }
    
    return tools;
  }

  /**
   * 加载多维度画像
   */
  async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection> {
    return this.profileLoader.loadProfiles(params);
  }

  /**
   * 获取对话历史
   */
  private async getConversationHistory(
    conversationId: string | undefined,
    contactId: string,
  ): Promise<ConversationMessage[]> {
    if (!conversationId || !contactId) {
      return [];
    }

    try {
      // 确保记忆管理器已初始化
      if (!this.memoryManager || this.memoryManager.contactId !== contactId) {
        await this.initializeMemoryManager(contactId, conversationId);
      }

      // 从短期记忆中获取对话历史
      const history = await this.memoryManager!.getConversationHistory(50);

      // 转换为 ConversationMessage 格式
      return history.map((msg) => ({
        role: msg.role as "system" | "user" | "assistant",
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
      }));
    } catch (error) {
      console.error(`[ContextManager:${this.agentId}] Failed to get conversation history:`, error);
      return [];
    }
  }

  /**
   * 添加用户消息到记忆
   */
  async addUserMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.memoryManager) {
      console.warn(`[ContextManager:${this.agentId}] Memory manager not initialized`);
      return;
    }

    try {
      await this.memoryManager.addUserMessage(content, metadata);
    } catch (error) {
      console.error(`[ContextManager:${this.agentId}] Failed to add user message:`, error);
    }
  }

  /**
   * 添加助手消息到记忆
   */
  async addAssistantMessage(content: string, metadata?: Record<string, any>): Promise<void> {
    console.log(`[ContextManager:${this.agentId}] [DEBUG] addAssistantMessage called: contentLength=${content?.length || 0}, hasMemoryManager=${!!this.memoryManager}`);
    
    if (!this.memoryManager) {
      console.warn(`[ContextManager:${this.agentId}] Memory manager not initialized`);
      return;
    }

    try {
      console.log(`[ContextManager:${this.agentId}] [DEBUG] Calling memoryManager.addAssistantMessage...`);
      const result = await this.memoryManager.addAssistantMessage(content, metadata);
      console.log(`[ContextManager:${this.agentId}] [DEBUG] memoryManager.addAssistantMessage completed:`, result);
    } catch (error) {
      console.error(`[ContextManager:${this.agentId}] Failed to add assistant message:`, error);
    }
  }

  /**
   * 检索相关记忆
   */
  private async retrieveMemories(_content: string): Promise<Memory[]> {
    // TODO: 使用向量检索获取相关记忆
    return [];
  }



  /**
   * 获取模型配置
   */
  private async getModelConfig(): Promise<ModelConfig> {
    // TODO: 从数据库加载 Agent 的模型配置
    return {
      provider: "openai",
      model: "gpt-4",
      temperature: 0.7,
      maxTokens: 4096,
      systemPrompt: "",
    };
  }

  /**
   * 获取 LLM 实例信息
   */
  async getLLMInstanceInfo(instanceId: string): Promise<{ modelName: string; provider: string } | undefined> {
    try {
      const rows = await this.db.query<
        { model_name: string; provider_name: string }
      >(
        `SELECT c.model_name, c.provider_name
         FROM t_llm_instances i
         JOIN t_llm_configs c ON i.config_id = c.sid
         WHERE i.sid = ? AND i.deleted = 0 AND c.deleted = 0`,
        [instanceId],
      );

      if (rows.length === 0) {
        console.warn(`[ContextManager] LLM instance not found: ${instanceId}`);
        return undefined;
      }

      return {
        modelName: rows[0].model_name,
        provider: rows[0].provider_name,
      };
    } catch (error) {
      console.error(`[ContextManager] Failed to get LLM instance info for ${instanceId}:`, error);
      return undefined;
    }
  }
}

// 导出兼容旧代码的别名
/** @deprecated 使用 ContextManager 替代 */
export const ContextModule = ContextManager;
