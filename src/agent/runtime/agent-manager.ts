/**
 * Agent 管理器
 *
 * 每个 Worker 进程有一个 AgentManager 实例
 * 管理该 Worker 中的单个 Agent
 */

import type { AgentMessage, AgentResponse, AgentData } from "../types/index.js";
import { AgentRuntime } from "./agent-runtime.js";
import { ContextManager } from "../context/context-manager.js";
import { LLMClient } from "./llm-client.js";
import { query } from "../../store/database.js";

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
  private agent?: AgentRuntime;
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

    // 3. 创建 ContextManager（传入数据库查询函数）
    const contextModule = new ContextManager(this.config.agentId, { query });

    // 4. 创建 AgentRuntime（传入 LLMClient 作为 LLMService 接口）
    this.agent = new AgentRuntime(agentData, contextModule, this.llmClient as any);

    // 5. 初始化 Agent
    await this.agent.initialize();

    // 6. 启动心跳
    this.agent.startHeartbeat();

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
    console.error(`[AgentManager] Delegating to AgentRuntime.handleMessage`);
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
    const heartbeatConfig = this.agent.getHeartbeatConfig();

    return {
      agentId: this.config.agentId,
      status: runtimeState.status,
      lastHeartbeat: runtimeState.lastHeartbeat,
      nextHeartbeat: runtimeState.nextHeartbeat,
      consecutiveErrors: runtimeState.consecutiveErrors,
      model: config.model.model,
      heartbeatEnabled: heartbeatConfig?.enabled || false,
    };
  }

  /**
   * 获取 LLM 服务（用于语音合成等）
   */
  getLLMService(): LLMClient {
    return this.llmClient;
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
          config: any;
          profile: any;
          heartbeat: any;
          status: number;
        }>
      >(
        `SELECT
          sid,
          name,
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
      const heartbeat = this.parseJsonField(row.heartbeat);
      
      console.log(`[AgentManager] Raw config from DB:`, JSON.stringify(config, null, 2));
      console.log(`[AgentManager] multiModelCollaboration:`, config.multiModelCollaboration);

      // 从 profile 中提取 facts 和 preferences（如果存在）
      const facts = profile.facts || [];
      const preferences = profile.preferences || {};

      // 构建 AgentData
      const agentData: AgentData = {
        sid: row.sid,
        name: row.name,
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
        heartbeat: heartbeat
          ? {
              enabled: heartbeat.enabled ?? true,
              interval: heartbeat.interval || "30m",
              activeHours: heartbeat.activeHours
                ? {
                    start: heartbeat.activeHours.start || "09:00",
                    end: heartbeat.activeHours.end || "18:00",
                    timezone: heartbeat.activeHours.timezone || "Asia/Shanghai",
                  }
                : undefined,
              prompt: heartbeat.prompt || "检查当前需要处理的事项",
            }
          : undefined,
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
}
