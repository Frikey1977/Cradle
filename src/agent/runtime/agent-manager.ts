/**
 * Agent 管理器
 *
 * 每个 Worker 进程有一个 AgentManager 实例
 * 管理该 Worker 中的单个 Agent
 */

import type { AgentMessage, AgentResponse, AgentData, HeartbeatConfig } from "../types/index.js";
import { Agent } from "./agent.js";
import { ContextManager } from "../context/context-manager.js";
import { LLMClient } from "./llm-client.js";
import { query } from "../../store/database.js";
import {
  DatabaseProfileRepository,
  DatabaseLLMInstanceRepository,
} from "../context/repositories/index.js";

/**
 * Agent 管理器配置
 */
export interface AgentManagerConfig {
  agentId: string;
  // IPC 发送函数（用于与 Master 通信）
  sendToMaster?: (message: any) => void;
}

/**
 * Agent 管理器
 */
export class AgentManager {
  private config: AgentManagerConfig;
  private agent?: Agent;
  llmClient: LLMClient;  // 暴露给 Worker 使用

  constructor(config: AgentManagerConfig) {
    this.config = config;
    // 创建 LLMClient，通过 IPC 与 Master 通信
    this.llmClient = new LLMClient(
      `worker-${config.agentId}`,
      config.agentId,
      config.sendToMaster || (() => {
        console.warn("[AgentManager] sendToMaster not provided");
      })
    );
  }

  /**
   * 初始化 AgentManager
   */
  async initialize(): Promise<void> {
    console.log(
      `[AgentManager] Initializing for agent: ${this.config.agentId}`,
    );

    // 1. 初始化 LLMClient（不需要本地初始化，通过 IPC 与 Master 通信）
    console.log("[AgentManager] LLMClient ready (IPC mode)");

    // 2. 从数据库加载 Agent 数据
    const agentData = await this.loadAgentData(this.config.agentId);

    if (!agentData) {
      throw new Error(`Agent ${this.config.agentId} not found in database`);
    }

    console.log(
      `[AgentManager] Loaded agent: ${agentData.name} (${agentData.sid})`,
    );

    // 3. 创建 Repository 实例
    const profileRepo = new DatabaseProfileRepository(query);
    const llmInstanceRepo = new DatabaseLLMInstanceRepository(query);

    // 4. 创建 ContextManager（传入 Repository 实例）
    const contextModule = new ContextManager(this.config.agentId, profileRepo, llmInstanceRepo);

    // 5. 创建 Agent（传入 LLMClient 作为 LLMService 接口）
    this.agent = new Agent(agentData, contextModule, this.llmClient as any);

    // 6. 初始化 Agent
    await this.agent.initialize();

    console.log(`[AgentManager] Agent ${this.config.agentId} ready`);
  }

  /**
   * 处理消息
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    console.error(`[AgentManager] handleMessage called for agent ${this.config.agentId}`);
    
    if (!this.agent) {
      throw new Error("Agent not initialized");
    }

    // 验证消息是否发给本 Agent
    if (message.agentId !== this.config.agentId) {
      throw new Error(
        `Message agentId ${message.agentId} does not match ${this.config.agentId}`,
      );
    }

    // 交给 Agent 处理
    console.error(`[AgentManager] Delegating to Agent.handleMessage`);
    const response = await this.agent.handleMessage(message);

    return response;
  }

  /**
   * 获取处理信息（用于系统消息）
   */
  getProcessingInfo(message: AgentMessage): string {
    if (!this.agent) {
      return "Agent not initialized";
    }
    
    const config = this.agent.getConfig();
    return this.agent.getProcessingInfo(message, config.model);
  }

  /**
   * 保存助手消息到短期记忆（供流式响应完成后调用）
   */
  async saveAssistantMessage(content: string, contactId: string, channel?: string, isVoice?: boolean): Promise<void> {
    if (!this.agent) {
      throw new Error("Agent not initialized");
    }
    
    await this.agent.saveAssistantMessage(content, contactId, channel, isVoice);
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus() {
    if (!this.agent) {
      return null;
    }

    const runtimeState = this.agent.getRuntimeState();
    const config = this.agent.getConfig();

    return {
      agentId: this.config.agentId,
      status: runtimeState.status,
      consecutiveErrors: runtimeState.consecutiveErrors,
      model: config.model.model,
    };
  }

  /**
   * 获取 Agent 名称
   */
  getAgentName(): string {
    if (!this.agent) {
      console.log(`[AgentManager] getAgentName: agent is null, returning ""`);
      return "";
    }
    const config = this.agent.getConfig();
    const name = config.runtime?.identity?.displayName || "";
    console.log(`[AgentManager] getAgentName: identity.displayName=${config.runtime?.identity?.displayName}, returning "${name}"`);
    return name;
  }

  /**
   * 获取 Agent e_name（英文标识名）
   */
  getAgentEName(): string {
    if (!this.agent) {
      console.log(`[AgentManager] getAgentEName: agent is null, returning ""`);
      return "";
    }
    // 从 AgentData 中获取 eName
    const agentData = (this.agent as any).agentData;
    const eName = agentData?.eName || agentData?.name || "";
    console.log(`[AgentManager] getAgentEName: eName=${agentData?.eName}, name=${agentData?.name}, returning "${eName}"`);
    return eName;
  }

  /**
   * 获取 LLM 服务（用于语音合成等）
   */
  getLLMService(): LLMClient {
    return this.llmClient;
  }

  getSkills() {
    return this.agent?.getSkills() || [];
  }

  /**
   * 获取 Agent 实例
   */
  getAgent() {
    return this.agent;
  }

  /**
   * 启动心跳
   */
  async startHeartbeat(): Promise<void> {
    if (this.agent) {
      await this.agent.startHeartbeat();
    } else {
      console.warn(`[AgentManager] Cannot start heartbeat: agent not initialized`);
    }
  }

  /**
   * 停止心跳
   */
  async stopHeartbeat(): Promise<void> {
    if (this.agent) {
      await this.agent.stopHeartbeat();
      console.log(`[AgentManager] Heartbeat stopped for agent ${this.config.agentId}`);
    } else {
      console.warn(`[AgentManager] Cannot stop heartbeat: agent not initialized`);
    }
  }

  /**
   * 触发心跳（立即执行）
   */
  triggerHeartbeat(): void {
    if (this.agent) {
      this.agent.triggerHeartbeat();
      console.log(`[AgentManager] Heartbeat triggered for agent ${this.config.agentId}`);
    } else {
      console.warn(`[AgentManager] Cannot trigger heartbeat: agent not initialized`);
    }
  }

  /**
   * 更新心跳配置
   */
  updateHeartbeatConfig(config: HeartbeatConfig): void {
    if (this.agent) {
      this.agent.updateHeartbeatConfig(config);
      console.log(`[AgentManager] Heartbeat config updated for agent ${this.config.agentId}`);
    } else {
      console.warn(`[AgentManager] Cannot update heartbeat config: agent not initialized`);
    }
  }

  /**
   * 获取心跳状态
   */
  getHeartbeatState() {
    if (this.agent) {
      return this.agent.getHeartbeatState();
    }
    return null;
  }

  /**
   * 设置心跳消息推送回调
   */
  setHeartbeatPushMessageCallback(
    callback: (data: { contactId: string; content: string; agentId: string; agentName: string }) => void
  ): void {
    if (this.agent) {
      this.agent.setHeartbeatPushMessageCallback(callback);
    } else {
      console.warn(`[AgentManager] Cannot set heartbeat push callback: agent not initialized`);
    }
  }

  /**
   * 注册活跃客户端
   * 前端连接后调用，用于接收心跳消息等推送
   */
  registerActiveClient(contactId: string): void {
    if (this.agent) {
      this.agent.registerActiveClient(contactId);
    } else {
      console.warn(`[AgentManager] Cannot register client: agent not initialized`);
    }
  }

  /**
   * 注销活跃客户端
   * 前端断开连接时调用
   */
  unregisterActiveClient(contactId: string): void {
    if (this.agent) {
      this.agent.unregisterActiveClient(contactId);
    } else {
      console.warn(`[AgentManager] Cannot unregister client: agent not initialized`);
    }
  }

  /**
   * 获取活跃客户端列表
   */
  getActiveClients(): string[] {
    if (this.agent) {
      return this.agent.getActiveClients();
    }
    console.warn(`[AgentManager] Cannot get active clients: agent not initialized`);
    return [];
  }

  /**
   * 获取原始上下文（由 ContextManager 构建的完整上下文）
   */
  async getRawContext(params: {
    agentId: string;
    contactId: string;
    conversationId?: string;
  }): Promise<any> {
    const { contactId, conversationId } = params;

    console.log(`[AgentManager] Getting raw context for contact ${contactId}`);

    if (!this.agent) {
      throw new Error("Agent not initialized");
    }

    // 通过 Agent 获取 ContextManager 并构建上下文
    const context = await this.agent.buildRawContext({
      contactId,
      conversationId,
    });

    return context;
  }

  /**
   * 停止 AgentManager
   */
  async stop(): Promise<void> {
    console.log(`[AgentManager] Stopping agent ${this.config.agentId}`);

    if (this.agent) {
      await this.agent.stop();
      this.agent = undefined;
    }

    // 停止 LLMClient（清理 pending requests）
    this.llmClient.stop();

    console.log(`[AgentManager] Agent ${this.config.agentId} stopped`);
  }

  /**
   * 解析 JSON 字段
   */
  private parseJsonField(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "object") {
      return value;
    }
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }
    return value;
  }

  /**
   * 从数据库加载 Agent 数据
   */
  private async loadAgentData(agentId: string): Promise<AgentData | null> {
    console.log(`[AgentManager] Loading agent data for ${agentId}`);

    try {
      const rows = await query<
        Array<{
          sid: string;
          name: string;
          e_name: string | null;
          mode: string | null;
          pattern: string | null;
          config: any;
          profile: any;
          heartbeat: any;
          status: number;
        }>
      >(
        `SELECT
          sid,
          name,
          e_name,
          mode,
          pattern,
          config,
          profile,
          heartbeat,
          status
        FROM t_agents
        WHERE sid = ? AND deleted = 0`,
        [agentId],
      );

      if (rows.length === 0) {
        console.error(`[AgentManager] Agent ${agentId} not found in database`);
        return null;
      }

      const row = rows[0];

      // 解析 JSON 字段
      const config = this.parseJsonField(row.config) || {};
      const profile = this.parseJsonField(row.profile) || {};
      const heartbeat = this.parseJsonField(row.heartbeat) || undefined;
      
      console.log(`[AgentManager] Raw config from DB:`, JSON.stringify(config, null, 2));
      console.log(`[AgentManager] multiModelCollaboration:`, config.multiModelCollaboration);
      console.log(`[AgentManager] heartbeat config:`, JSON.stringify(heartbeat, null, 2));

      // 从 profile 中提取 facts 和 preferences（如果存在）
      const facts = profile.facts || [];
      const preferences = profile.preferences || {};

      // 构建 AgentData
      const agentData: AgentData = {
        sid: row.sid,
        name: row.name,
        eName: row.e_name || undefined,
        mode: row.mode || undefined,
        pattern: row.pattern || undefined,
        config: {
          model: {
            instanceId: config.model?.instanceId,
            provider: config.model?.provider || "openai",
            model: config.model?.model || "gpt-4",
            temperature: config.model?.temperature ?? 0.7,
            maxTokens: config.model?.maxTokens ?? 4096,
            systemPrompt: config.model?.systemPrompt,
          },
          runtime: {
            identity: {
              emoji: config.runtime?.identity?.emoji || "🤖",
              displayName:
                config.runtime?.identity?.displayName || row.name,
            },
            behavior: {
              humanDelay: {
                enabled: config.runtime?.behavior?.humanDelay?.enabled ?? true,
                minMs: config.runtime?.behavior?.humanDelay?.minMs ?? 500,
                maxMs: config.runtime?.behavior?.humanDelay?.maxMs ?? 2000,
              },
            },
          },
          multiModelCollaboration: config.multiModelCollaboration,
        },
        profile: {
          facts: Array.isArray(facts) ? facts : [],
          preferences: {
            language: preferences.language || "zh-CN",
            tone: preferences.tone || "professional",
            responseStyle: preferences.responseStyle || "concise",
          },
          welcomeMessage:
            profile.welcomeMessage || `你好，我是 ${row.name}，有什么可以帮你的？`,
        },
        heartbeat: heartbeat,
      };

      return agentData;
    } catch (error) {
      console.error(
        `[AgentManager] Failed to load agent data for ${agentId}:`,
        error,
      );
      return null;
    }
  }

  /**
   * 更新联系人语言设置
   */
  updateContactLanguage(contactId: string, language: string): void {
    console.log(`[AgentManager] Updating contact ${contactId} language to ${language}`);
    
    if (this.agent) {
      // 通知 AgentRuntime 更新联系人语言
      this.agent.updateContactLanguage(contactId, language);
    }
  }
}
