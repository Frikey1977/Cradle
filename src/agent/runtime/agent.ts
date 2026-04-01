/**
 * Agent 核心类
 *
 * 每个 Agent 对应一个 Agent 实例
 * 运行在独立的 Worker 进程中
 */

import type {
  AgentData,
  AgentConfig,
  AgentProfile,
  RuntimeState,
  AgentMessage,
  AgentResponse,
  LLMResponse,
  ConversationMessage,
  HeartbeatConfig,
} from "../types/index.js";
import type { ToolCall } from "../../llm/runtime/types.js";
import type { ContextManager } from "../context/context-manager.js";
import type { LLMServiceInterface } from "./llm-service-interface.js";
import { loadAgentSkillEntries } from "../context/skills.js";
import type { SkillEntry } from "../skills/types.js";
import { MessageRouter } from "./message-router.js";
import { MultimodalProcessor } from "./multimodal-processor.js";
import { Environment } from "../context/environment.js";
import { ReActLoop } from "../react/react-loop.js";
import { HeartbeatManager } from "../heartbeat/index.js";

/**
 * Agent 运行时核心
 */
export class Agent {
  readonly id: string;
  readonly name: string;
  readonly eName: string;
  readonly mode?: string;
  readonly pattern?: string;
  private config: AgentConfig;
  private profile: AgentProfile;
  private runtime: RuntimeState;
  private contextModule: ContextManager;
  private llmService: LLMServiceInterface;
  private cache: { skills?: SkillEntry[]; tools?: any[] } = {};

  // 子模块
  private router: MessageRouter;
  private multimodalProcessor: MultimodalProcessor;
  private heartbeatManager: HeartbeatManager | null = null;
  private heartbeatConfigData?: HeartbeatConfig;
  
  // 最后一次心跳执行的上下文信息（用于消息推送）
  private lastHeartbeatContext?: { contactId: string; content: string };
  
  // 心跳消息推送回调（Worker 注册这个回调来向前端推送消息）
  private onHeartbeatPushMessage?: (data: { contactId: string; content: string; agentId: string; agentName: string }) => void;
  
  // 活跃客户端列表（用于心跳消息推送给所有在线用户）
  private activeClients = new Set<string>();
  
  // 客户端注册时间戳（用于清理过期客户端）
  private clientLastSeen = new Map<string, number>();

  constructor(data: AgentData, contextModule: ContextManager, llmService: LLMServiceInterface) {
    this.id = data.sid;
    this.name = data.name;
    this.eName = data.eName || data.name;
    this.mode = data.mode;
    this.pattern = data.pattern;
    this.config = data.config;
    this.profile = data.profile;
    this.heartbeatConfigData = data.heartbeat;
    this.contextModule = contextModule;
    this.llmService = llmService;
    this.runtime = {
      status: "idle",
      consecutiveErrors: 0,
    };

    // 初始化子模块
    this.router = new MessageRouter(llmService, this.config, this.name, this.id);
    this.multimodalProcessor = new MultimodalProcessor(
      llmService,
      contextModule,
      this.router,
      this.name,
      this.id
    );
  }

  /**
   * 初始化 Agent
   */
  async initialize(): Promise<void> {
    console.log(`[Agent:${this.id}] Initializing...`);
    this.cache.skills = await loadAgentSkillEntries(this.id);
    console.log(`[Agent:${this.id}] Initialized with ${this.cache.skills?.length || 0} skills`);

    // 初始化心跳管理器
    await this.initializeHeartbeat();
  }

  /**
   * 初始化心跳管理器
   */
  private async initializeHeartbeat(): Promise<void> {
    const heartbeatConfig = this.getHeartbeatConfig();
    
    this.heartbeatManager = new HeartbeatManager({
      agentId: this.id,
      config: heartbeatConfig,
      onExecute: async (prompt: string) => {
        return await this.executeHeartbeat(prompt);
      },
      onEvent: async (event) => {
        console.log(`[Agent:${this.id}] Heartbeat event:`, event.type, event.data || "");
        
        // 当心跳完成且有内容时，调用推送回调
        if (event.type === "completed" && this.lastHeartbeatContext) {
          const { contactId, content } = this.lastHeartbeatContext;
          console.log(`[Agent:${this.id}] Heartbeat completed, pushing message to contact ${contactId}`);
          
          // 调用推送回调（Worker 注册了这个回调来向前端推送消息）
          if (this.onHeartbeatPushMessage) {
            // 获取所有活跃客户端
            const activeClients = this.getActiveClients();
            console.log(`[Agent:${this.id}] Active clients for heartbeat push:`, activeClients);
            
            // 发送给所有活跃客户端
            for (const clientContactId of activeClients) {
              console.log(`[Agent:${this.id}] Pushing heartbeat message to client: ${clientContactId}`);
              this.onHeartbeatPushMessage({
                contactId: clientContactId,
                content,
                agentId: this.id,
                agentName: this.name,
              });
            }
            
            // 如果没有活跃客户端，也发送给owner（兼容原有逻辑）
            if (activeClients.length === 0) {
              console.log(`[Agent:${this.id}] No active clients, sending to owner: ${contactId}`);
              this.onHeartbeatPushMessage({
                contactId,
                content,
                agentId: this.id,
                agentName: this.name,
              });
            }
          }
          
          // 清空上下文
          this.lastHeartbeatContext = undefined;
        }
        
        await this.logHeartbeatEvent(event);
      },
    });

    // 只有当 enabled 为 true 且 isRunning 为 true 时才启动心跳
    if (heartbeatConfig.enabled && heartbeatConfig.isRunning) {
      console.log(`[Agent:${this.id}] Auto-starting heartbeat (enabled=${heartbeatConfig.enabled}, isRunning=${heartbeatConfig.isRunning})`);
      this.heartbeatManager.start();
    } else {
      console.log(`[Agent:${this.id}] Heartbeat not auto-started (enabled=${heartbeatConfig.enabled}, isRunning=${heartbeatConfig.isRunning})`);
    }
  }

  /**
   * 记录心跳事件到数据库
   */
  private async logHeartbeatEvent(event: { type: string; agentId: string; timestamp: number; data?: any }): Promise<void> {
    try {
      const { getHeartbeatLogRepository } = await import("../../store/repositories/heartbeat-logs.js");
      const repo = await getHeartbeatLogRepository();
      await repo.log({
        agentId: event.agentId,
        agentName: this.name,
        type: event.type as any,
        timestamp: new Date(event.timestamp),
        prompt: event.data?.prompt || undefined,
        result: event.data?.result || undefined,
        error: event.data?.error || undefined,
        nextDueAt: event.data?.nextDueAt || undefined,
      });
    } catch (error) {
      console.error(`[Agent:${this.id}] Failed to log heartbeat event:`, error);
    }
  }

  /**
   * 获取心跳配置
   */
  private getHeartbeatConfig(): HeartbeatConfig {
    const defaultConfig: HeartbeatConfig = {
      enabled: false,
      intervalSeconds: 1800,
      activeHours: {
        start: "09:00",
        end: "18:00",
        timezone: "Asia/Shanghai",
      },
      prompt: "检查当前事项，如有异常请报告",
    };

    if (this.heartbeatConfigData) {
      return {
        ...defaultConfig,
        ...this.heartbeatConfigData,
        activeHours: {
          ...defaultConfig.activeHours,
          ...this.heartbeatConfigData.activeHours,
        },
      };
    }

    return defaultConfig;
  }

  /**
   * 获取 Agent 的 owner contact ID
   */
  private async getOwnerContactId(): Promise<string | null> {
    try {
      const { getAgentContacts } = await import("../../organization/relationships/service.js");
      const contacts = await getAgentContacts(this.id);
      console.log(`[Agent:${this.id}] getOwnerContactId - found ${contacts.length} contacts:`, contacts.map(c => ({ contactId: c.contactId, employeeId: c.employeeId, owner: c.owner })));
      const owner = contacts.find(c => c.owner === true);
      console.log(`[Agent:${this.id}] getOwnerContactId - owner:`, owner);
      return owner?.contactId || null;
    } catch (error) {
      console.error(`[Agent:${this.id}] Failed to get owner contact:`, error);
      return null;
    }
  }

  /**
   * 执行心跳任务
   * 像正常对话一样记录到短期记忆，并显示在前端
   */
  private async executeHeartbeat(prompt: string): Promise<string> {
    console.log(`[Agent:${this.id}] Executing heartbeat with prompt: ${prompt}`);

    // 获取 owner contact ID
    const ownerContactId = await this.getOwnerContactId();
    if (!ownerContactId) {
      console.warn(`[Agent:${this.id}] No owner found for heartbeat, falling back to simple execution`);
      return this.executeHeartbeatSimple(prompt);
    }

    console.log(`[Agent:${this.id}] Heartbeat executing with owner contact: ${ownerContactId}`);

    try {
      // 1. 初始化记忆管理器（像正常对话一样）
      await this.contextModule.initializeMemoryManager(ownerContactId, undefined);

      // 2. 构建消息（像正常对话一样）
      const message: AgentMessage = {
        agentId: this.id,
        contactId: ownerContactId,
        content: prompt,
        channelName: "heartbeat",
        timestamp: Date.now(),
        metadata: { source: "heartbeat" },
      };

      // 3. 使用正常消息处理流程
      const response = await this.handleMessage(message);

      // 4. 保存上下文信息（用于后续消息推送）
      if (response.content) {
        this.lastHeartbeatContext = {
          contactId: ownerContactId,
          content: response.content,
        };
      }

      // 5. 返回结果
      return response.content || "HEARTBEAT_OK";
    } catch (error) {
      console.error(`[Agent:${this.id}] Heartbeat execution failed:`, error);
      throw error;
    }
  }

  /**
   * 简化版心跳执行（无 owner 时回退使用）
   */
  private async executeHeartbeatSimple(prompt: string): Promise<string> {
    console.log(`[Agent:${this.id}] Executing simple heartbeat with prompt: ${prompt}`);

    try {
      const context = await this.contextModule.build({
        agentId: this.id,
        contactId: "",
        content: prompt,
      });

      context.modelConfig = { ...context.modelConfig, ...this.config.model };

      const messages: ConversationMessage[] = context.systemMessages
        ? context.systemMessages.map((block: any) => ({ role: "system" as const, content: block.content }))
        : [{ role: "system" as const, content: context.systemPrompt }];

      messages.push({ role: "user", content: prompt });

      const routeInfo = context.modelConfig.instanceId
        ? await this.getInstanceRouteInfo(context.modelConfig.instanceId)
        : await this.llmService.getRouteInfo({ capability: "textGeneration" });

      const response = await this.llmService.generate({
        model: {
          ...(context.modelConfig.instanceId
            ? { instanceId: context.modelConfig.instanceId }
            : { provider: context.modelConfig.provider, model: context.modelConfig.model }),
          parameters: {
            temperature: context.modelConfig.parameters?.temperature ?? 0.7,
            maxTokens: context.modelConfig.parameters?.maxTokens ?? 4096,
          },
        },
        messages,
        source: "heartbeat",
        agentName: this.name,
      });

      return response.content || "HEARTBEAT_OK";
    } catch (error) {
      console.error(`[Agent:${this.id}] Simple heartbeat execution failed:`, error);
      throw error;
    }
  }

  /**
   * 启动心跳（带配置重载）
   */
  async startHeartbeat(): Promise<void> {
    if (this.heartbeatManager) {
      // 重新加载最新的心跳配置
      try {
        console.log(`[Agent:${this.id}] Reloading heartbeat config from database`);
        const { getHeartbeatConfig } = await import("../../organization/agents/service.js");
        const latestConfig = await getHeartbeatConfig(this.id);
        console.log(`[Agent:${this.id}] Loaded config from DB:`, JSON.stringify(latestConfig, null, 2));
        if (latestConfig) {
          console.log(`[Agent:${this.id}] Updating heartbeat config with intervalSeconds=${latestConfig.intervalSeconds}`);
          this.updateHeartbeatConfig(latestConfig);
        }
      } catch (error) {
        console.warn(`[Agent:${this.id}] Failed to reload heartbeat config:`, error);
      }
      
      this.heartbeatManager.start();
      console.log(`[Agent:${this.id}] Heartbeat started`);
      
      // 同步运行状态到数据库
      await this.saveHeartbeatState();
    }
  }

  /**
   * 停止心跳
   */
  async stopHeartbeat(): Promise<void> {
    if (this.heartbeatManager) {
      this.heartbeatManager.stop();
      // 同步运行状态到数据库
      await this.saveHeartbeatState();
    }
  }

  /**
   * 保存心跳状态到数据库
   */
  private async saveHeartbeatState(): Promise<void> {
    try {
      const state = this.heartbeatManager?.getState();
      const config = this.getHeartbeatConfig();
      
      const heartbeatData = {
        ...config,
        isRunning: state?.isRunning || false,
        lastRunAt: state?.lastRunAt || null,
        nextDueAt: state?.nextDueAt || null,
        status: state?.status || "idle",
      };
      
      const { updateHeartbeatConfig } = await import("../../organization/agents/service.js");
      await updateHeartbeatConfig(this.id, heartbeatData);
      console.log(`[Agent:${this.id}] Heartbeat state saved to database:`, { isRunning: heartbeatData.isRunning });
    } catch (error) {
      console.error(`[Agent:${this.id}] Failed to save heartbeat state:`, error);
    }
  }

  /**
   * 触发心跳（立即执行）
   */
  triggerHeartbeat(): void {
    if (this.heartbeatManager) {
      this.heartbeatManager.triggerNow();
    }
  }

  /**
   * 更新心跳配置
   */
  updateHeartbeatConfig(config: HeartbeatConfig): void {
    // 更新本地配置数据
    this.heartbeatConfigData = {
      ...this.heartbeatConfigData,
      ...config,
    };
    console.log(`[Agent:${this.id}] heartbeatConfigData updated:`, this.heartbeatConfigData);
    
    if (this.heartbeatManager) {
      this.heartbeatManager.updateConfig(config);
    }
  }

  /**
   * 获取心跳状态
   */
  getHeartbeatState() {
    return this.heartbeatManager?.getState() || null;
  }

  /**
   * 设置心跳消息推送回调
   * Worker 通过这个方法注册回调，在心跳执行完成后向前端推送消息
   */
  setHeartbeatPushMessageCallback(
    callback: (data: { contactId: string; content: string; agentId: string; agentName: string }) => void
  ): void {
    this.onHeartbeatPushMessage = callback;
    console.log(`[Agent:${this.id}] Heartbeat push message callback registered`);
  }

  /**
   * 注册活跃客户端
   * 前端连接后调用，用于接收心跳消息等推送
   */
  registerActiveClient(contactId: string): void {
    this.activeClients.add(contactId);
    this.clientLastSeen.set(contactId, Date.now());
    console.log(`[Agent:${this.id}] Registered active client: ${contactId}, total: ${this.activeClients.size}`);
  }

  /**
   * 注销活跃客户端
   * 前端断开连接时调用
   */
  unregisterActiveClient(contactId: string): void {
    this.activeClients.delete(contactId);
    this.clientLastSeen.delete(contactId);
    console.log(`[Agent:${this.id}] Unregistered active client: ${contactId}, total: ${this.activeClients.size}`);
  }

  /**
   * 获取所有活跃客户端
   */
  getActiveClients(): string[] {
    // 清理超过5分钟未活跃的客户端
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5分钟
    for (const [contactId, lastSeen] of this.clientLastSeen.entries()) {
      if (now - lastSeen > timeout) {
        this.activeClients.delete(contactId);
        this.clientLastSeen.delete(contactId);
        console.log(`[Agent:${this.id}] Removed inactive client: ${contactId}`);
      }
    }
    return Array.from(this.activeClients);
  }

  /**
   * 构建原始上下文（用于调试和查看）
   */
  async buildRawContext(params: {
    contactId: string;
    conversationId?: string;
  }): Promise<any> {
    const { contactId, conversationId } = params;

    console.log(`[Agent:${this.id}] Building raw context for contact ${contactId}`);

    // 1. 初始化记忆管理器
    if (contactId) {
      await this.contextModule.initializeMemoryManager(contactId, conversationId);
    }

    // 2. 构建上下文（使用空内容，仅获取基础上下文）
    const context = await this.contextModule.build({
      agentId: this.id,
      contactId,
      content: "",
      conversationId,
    });

    // 3. 合并模型配置
    context.modelConfig = { ...context.modelConfig, ...this.config.model };

    if (this.config.multiModelCollaboration?.enabled && this.config.multiModelCollaboration.mainModelInstanceId) {
      context.modelConfig.instanceId = this.config.multiModelCollaboration.mainModelInstanceId;
    }

    // 4. 返回可序列化的上下文数据
    return {
      systemPrompt: context.systemPrompt,
      systemMessages: context.systemMessages,
      modelConfig: context.modelConfig,
      conversationHistory: context.conversationHistory,
      memories: context.memories,
      availableTools: context.availableTools,
      metadata: context.metadata,
      contactName: context.contactName,
      environment: context.environment,
    };
  }

  /**
   * 处理消息入口
   */
  async handleMessage(message: AgentMessage): Promise<AgentResponse> {
    console.error(`[Agent:${this.id}] ========== handleMessage CALLED ==========`);
    console.error(`[Agent:${this.id}] Message from: ${message.contactId}, content: ${message.content?.substring(0, 100)}`);
    console.log(`[Agent:${this.id}] Handling message from ${message.contactId}`);

    this.runtime.status = "running";

    try {
      // 1. 初始化记忆管理器
      if (message.contactId) {
        await this.contextModule.initializeMemoryManager(message.contactId, message.conversationId);
      }

      // 2. 构建上下文
      const context = await this.buildContext(message);

      // 3. 根据消息类型路由处理
      let response: AgentResponse;
      const route = this.router.classify(message);

      if (route.type === "audio") {
        response = await this.multimodalProcessor.processAudio(message, context);
      } else if (route.type === "image") {
        response = await this.multimodalProcessor.processImages(message, context);
      } else {
        response = await this.processTextMessage(message, context);
      }

      // 4. 保存助手回复（非流式）
      if (response.content && !response.stream) {
        await this.saveAssistantMessage(response.content, message.contactId, message.channelName, !!response.audio);
      }

      // 5. 更新状态
      this.runtime.status = "idle";
      this.runtime.consecutiveErrors = 0;

      console.log(`[Agent:${this.id}] Message processed successfully`);
      return response;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * 构建上下文
   */
  private async buildContext(message: AgentMessage): Promise<any> {
    const context = await this.contextModule.build({
      agentId: this.id,
      contactId: message.contactId,
      content: message.content,
      conversationId: message.conversationId,
      metadata: message.metadata,
    });

    context.modelConfig = { ...context.modelConfig, ...this.config.model };

    if (this.config.multiModelCollaboration?.enabled && this.config.multiModelCollaboration.mainModelInstanceId) {
      context.modelConfig.instanceId = this.config.multiModelCollaboration.mainModelInstanceId;
      console.log(`[Agent:${this.id}] Using mainModelInstanceId from multiModelCollaboration: ${context.modelConfig.instanceId}`);
    }

    return context;
  }

  /**
   * 处理文本消息
   */
  private async processTextMessage(
    message: AgentMessage,
    context: any
  ): Promise<AgentResponse> {
    const messages = this.buildMessages(context, message);
    const availableTools = context.availableTools;

    if (message.content) {
      await this.contextModule.addUserMessage(message.content, {
        type: "text",
        channel: message.channelName || message.metadata?.channelType || "web",
      });
    }

    const routeInfo = context.modelConfig.instanceId
      ? await this.getInstanceRouteInfo(context.modelConfig.instanceId)
      : await this.llmService.getRouteInfo({ capability: "textGeneration" });

    const thinkingMessage = this.router.buildThinkingMessage("text", routeInfo);
    if (message.onThinkingMessage) {
      message.onThinkingMessage(thinkingMessage);
    }

    // 调用 LLM
    let llmResponse: LLMResponse;

    if (message.stream) {
      const streamGenerator = this.llmService.streamGenerate({
        model: {
          ...(context.modelConfig.instanceId
            ? { instanceId: context.modelConfig.instanceId }
            : { provider: context.modelConfig.provider, model: context.modelConfig.model }),
          parameters: {
            temperature: context.modelConfig.parameters?.temperature ?? 0.7,
            maxTokens: context.modelConfig.parameters?.maxTokens ?? 4096,
          },
        },
        messages,
        tools: availableTools,
        source: "agent",
        agentName: this.name,
        contactName: context.contactName,
      });

      // 包装流以记录 tool calls
      const wrappedStreamGenerator = this.wrapStreamWithLogging(streamGenerator);

      return {
        content: "",
        stream: true,
        contentEventStream: wrappedStreamGenerator,
        metadata: { 
          agentName: this.name, 
          timestamp: Date.now(), 
          environment: context.environment,
          availableTools,
          availableSkills: this.cache.skills || [],
        },
        thinkingMessage,
      };
    } else {
      llmResponse = await this.llmService.generate({
        model: {
          ...(context.modelConfig.instanceId
            ? { instanceId: context.modelConfig.instanceId }
            : { provider: context.modelConfig.provider, model: context.modelConfig.model }),
          parameters: {
            temperature: context.modelConfig.parameters?.temperature ?? 0.7,
            maxTokens: context.modelConfig.parameters?.maxTokens ?? 4096,
          },
        },
        messages,
        tools: availableTools,
        source: "agent",
        agentName: this.name,
        contactName: context.contactName,
      });

      return this.processResponse(
        llmResponse,
        thinkingMessage,
        messages,
        availableTools,
        5,
        message.contactId,
        message.conversationId,
        context.environment
      );
    }
  }

  /**
   * 构建消息列表
   */
  private buildMessages(context: any, message: AgentMessage): ConversationMessage[] {
    const systemMessages: ConversationMessage[] = context.systemMessages
      ? context.systemMessages.map((block: any) => ({ role: "system" as const, content: block.content }))
      : [{ role: "system" as const, content: context.systemPrompt }];

    const messages: ConversationMessage[] = [...systemMessages, ...context.conversationHistory];

    // 构建用户消息
    const userContent: any[] = [];
    if (message.content) userContent.push({ type: "text", text: message.content });
    if (message.images?.length) {
      for (const imageBase64 of message.images) {
        userContent.push({
          type: "image_url",
          image_url: { url: imageBase64.startsWith("data:") ? imageBase64 : `data:image/jpeg;base64,${imageBase64}` },
        });
      }
    }

    if (userContent.length === 1 && userContent[0].type === "text") {
      messages.push({ role: "user", content: message.content || "" });
    } else if (userContent.length > 0) {
      messages.push({ role: "user", content: userContent as any });
    }

    return messages;
  }

  /**
   * 包装流以记录 tool calls
   */
  private async *wrapStreamWithLogging(
    stream: AsyncGenerator<import("./llm-service-interface.js").StreamEvent>
  ): AsyncGenerator<import("./llm-service-interface.js").StreamEvent> {
    const toolCallsDetected: Array<{ name: string; args: any }> = [];
    let textContent = "";
    let finishReason = "";
    
    for await (const event of stream) {
      if (event.type === "tool-call" && event.toolCall) {
        toolCallsDetected.push({
          name: event.toolCall.name,
          args: event.toolCall.args,
        });
      } else if (event.type === "text" && event.content) {
        textContent += event.content;
      } else if (event.type === "finish") {
        finishReason = event.finishReason || "unknown";
      }
      yield event;
    }

    // 记录完整的 response 信息
    console.log(`[Agent:${this.id}] ========== Stream Response Summary ==========`);
    console.log(`[Agent:${this.id}] Finish Reason: ${finishReason}`);
    console.log(`[Agent:${this.id}] Text Content Length: ${textContent.length}`);
    if (textContent.length > 0 && textContent.length < 200) {
      console.log(`[Agent:${this.id}] Text Content: ${textContent}`);
    }
    if (toolCallsDetected.length > 0) {
      console.log(`[Agent:${this.id}] Tool Calls (${toolCallsDetected.length}):`);
      toolCallsDetected.forEach((tc, idx) => {
        console.log(`[Agent:${this.id}]   [${idx + 1}] ${tc.name}`);
        console.log(`[Agent:${this.id}]       Args: ${JSON.stringify(tc.args).substring(0, 200)}`);
      });
    } else {
      console.log(`[Agent:${this.id}] Tool Calls: None`);
    }
    console.log(`[Agent:${this.id}] ==============================================`);
  }

  /**
   * 处理 LLM 响应
   */
  private async processResponse(
    llmResponse: LLMResponse,
    thinkingMessage?: string,
    messages?: any[],
    availableTools?: any[],
    maxIterations: number = 5,
    contactId?: string,
    conversationId?: string,
    environment?: Environment
  ): Promise<AgentResponse> {
    if (llmResponse.toolCalls?.length) {
      return this.processToolCalls(
        llmResponse,
        thinkingMessage,
        messages,
        availableTools,
        maxIterations,
        contactId,
        conversationId,
        environment
      );
    }

    return {
      content: llmResponse.content || "",
      metadata: { agentName: this.name, timestamp: Date.now() },
      thinkingMessage,
    };
  }

  /**
   * 处理工具调用
   * 当 mode=agent 时，使用 ReAct 循环执行
   * 否则使用传统的 orchestrator/executor 模式
   */
  private async processToolCalls(
    llmResponse: LLMResponse,
    thinkingMessage?: string,
    messages?: any[],
    availableTools?: any[],
    maxIterations: number = 5,
    contactId?: string,
    conversationId?: string,
    environment?: Environment
  ): Promise<AgentResponse> {
    const toolCall = llmResponse.toolCalls![0];
    const toolName = toolCall.function?.name;
    const args = JSON.parse(toolCall.function?.arguments || "{}");

    console.log(`[Agent:${this.id}] Tool call: ${toolName}, mode: ${this.mode}`);

    if (!environment) {
      throw new Error("Environment is required for tool calls");
    }

    // 当 mode=agent 时，使用 ReAct 循环执行
    if (this.mode === "agent") {
      return this.processReActLoop(
        args.taskDescription || args.task || "Execute task",
        thinkingMessage,
        maxIterations,
        contactId,
        conversationId,
        environment
      );
    }

    try {
      const { OrchestratorFactory } = await import("../orchestrator/index.js");
      const { WorktaskManager } = await import("../worktask/worktask-manager.js");

      const worktaskManager = new WorktaskManager();
      const orchestratorFactory = new OrchestratorFactory(this.llmService, worktaskManager);

      if (toolName === "orchestrator") {
        const selectedSkills = this.cache.skills?.filter((s) => args.skills?.includes(s.name)) || [];

        const orchestrator = await orchestratorFactory.create({
          task: args.taskDescription,
          tools: [],
          skills: selectedSkills,
          context: {
            constraints: {
              timeout: 300,
              maxExecutors: 5,
            },
          },
          config: {
            agentId: this.id,
            contactId: contactId || "",
            conversationId: conversationId || "",
            maxIterations: maxIterations,
            timeout: 300,
            modelConfig: this.config.model,
            environment: environment,
          },
        });

        const result = await orchestrator.orchestrate();

        return {
          content: result.output,
          metadata: {
            agentName: this.name,
            timestamp: Date.now(),
            toolCalls: [{ name: toolName, result }],
          },
          thinkingMessage,
        };
      } else if (toolName === "executor") {
        const { createExecutor } = await import("../executor/index.js");

        const selectedSkill = this.cache.skills?.find((s) => s.name === args.skillName);
        if (!selectedSkill) {
          throw new Error(`Skill not found: ${args.skillName}`);
        }

        let instanceConfig: { modelName: string; provider: string; baseUrl: string; apiKey: string; instanceId: string };
        
        // 获取实例配置，底层会自动处理实例不存在的情况
        const targetInstanceId = this.config.model.instanceId || "auto";
        const config = await this.llmService.getInstanceConfig(targetInstanceId);
        if (!config) {
          throw new Error(`No available LLM instance found`);
        }
        instanceConfig = config;

        const executor = await createExecutor({
          modelConfig: {
            provider: instanceConfig.provider,
            baseUrl: instanceConfig.baseUrl,
            apiKey: instanceConfig.apiKey,
            modelName: instanceConfig.modelName,
            instanceId: instanceConfig.instanceId,
          },
          task: {
            description: args.taskDescription,
            skillSlug: args.skillName,
          },
          skills: [selectedSkill].map((s) => ({
            name: s.name,
            description: s.description,
            filePath: s.filePath,
            location: s.location,
          })),
          tools: [],
          maxSteps: maxIterations,
          environment: environment,
        });

        const result = await executor.execute();

        return {
          content: result.output,
          metadata: {
            agentName: this.name,
            timestamp: Date.now(),
            toolCalls: [{ name: toolName, result }],
          },
          thinkingMessage,
        };
      } else {
        // 其他工具调用 - 直接返回工具调用信息
        return {
          content: `工具调用: ${toolName}\n参数: ${JSON.stringify(args, null, 2)}`,
          metadata: {
            agentName: this.name,
            timestamp: Date.now(),
            toolCalls: [{ name: toolName, args }],
          },
          thinkingMessage,
        };
      }
    } catch (error) {
      console.error(`[Agent:${this.id}] Tool execution failed:`, error);
      return {
        content: `执行工具 ${toolName} 失败: ${(error as Error).message}`,
        metadata: { agentName: this.name, timestamp: Date.now() },
        thinkingMessage,
      };
    }
  }

  /**
   * 处理 ReAct 循环
   * 当 mode=agent 时执行完整的 ReAct 循环
   */
  private async processReActLoop(
    task: string,
    thinkingMessage?: string,
    maxIterations: number = 5,
    contactId?: string,
    conversationId?: string,
    environment?: Environment
  ): Promise<AgentResponse> {
    console.log(`[Agent:${this.id}] Starting ReAct loop for task: ${task}`);

    try {
      const reactLoop = new ReActLoop(this.llmService, {
        maxIterations,
        modelConfig: this.config.model,
        availableTools: this.cache.skills?.map((s) => ({
          name: s.name,
          description: s.description || s.name,
          parameters: s.frontmatter || {},
        })),
      });

      const result = await reactLoop.execute(task, {
        contactId,
        conversationId,
        environment,
        agentName: this.name,
      });

      // 保存 ReAct 步骤到记忆
      if (contactId) {
        const reactSummary = result.steps
          .map(
            (step, idx) =>
              `Step ${idx + 1}:\nThought: ${step.thought}\n${
                step.action ? `Action: ${step.action.name}\nObservation: ${step.observation}` : "Final Answer"
              }`
          )
          .join("\n\n");

        await this.contextModule.addAssistantMessage(
          `[ReAct Execution]\n${reactSummary}\n\nFinal Answer: ${result.finalAnswer}`,
          {
            type: "system",
            channel: "react",
          }
        );
      }

      return {
        content: result.finalAnswer,
        metadata: {
          agentName: this.name,
          timestamp: Date.now(),
          reactSteps: result.steps.length,
        },
        thinkingMessage,
      };
    } catch (error) {
      console.error(`[Agent:${this.id}] ReAct loop failed:`, error);
      return {
        content: `ReAct execution failed: ${(error as Error).message}`,
        metadata: {
          agentName: this.name,
          timestamp: Date.now(),
          error: (error as Error).message,
        },
        thinkingMessage,
      };
    }
  }

  /**
   * 获取实例路由信息
   */
  private async getInstanceRouteInfo(instanceId: string) {
    const instanceInfo = this.llmService.getInstanceInfo(instanceId);
    return {
      instanceId,
      instanceName: instanceId,
      modelName: instanceInfo?.modelName || "unknown",
      provider: instanceInfo?.provider || "unknown",
    };
  }

  /**
   * 保存助手消息
   */
  async saveAssistantMessage(content: string, contactId: string, channel?: string, isVoice?: boolean): Promise<void> {
    try {
      if (!this.contextModule.getMemoryManager()) {
        await this.contextModule.initializeMemoryManager(contactId);
      }
      await this.contextModule.addAssistantMessage(content, {
        type: isVoice ? "voice" : "text",
        channel: channel || "web",
      });
    } catch (error) {
      console.error(`[Agent:${this.id}] Failed to save assistant message:`, error);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: Error): void {
    this.runtime.consecutiveErrors++;
    console.error(`[Agent:${this.id}] Error:`, error.message);
  }

  /**
   * 获取处理信息（用于系统消息）
   */
  getProcessingInfo(message: AgentMessage, modelConfig: any): string {
    const parts: string[] = [];

    if (message.audio) {
      parts.push(`📢 消息类型: 语音输入 (${message.audio.format}, ${message.audio.data.length} chars)`);
    } else if (message.images && message.images.length > 0) {
      parts.push(`📷 消息类型: 图片输入 (${message.images.length} 张)`);
    } else {
      parts.push(`💬 消息类型: 文本输入`);
    }

    parts.push(`🤖 Agent: ${this.name} (${this.id})`);
    parts.push(`🎯 模型: ${modelConfig.model || "unknown"}`);
    parts.push(`📡 提供商: ${modelConfig.provider || "unknown"}`);

    return parts.join("\n");
  }

  /**
   * 获取状态
   */
  getRuntimeState(): RuntimeState {
    return { ...this.runtime };
  }

  getConfig(): AgentConfig {
    return { ...this.config };
  }

  getSkills(): SkillEntry[] {
    return this.cache.skills || [];
  }

  /**
   * 更新联系人语言
   */
  updateContactLanguage(contactId: string, language: string): void {
    console.log(`[Agent:${this.id}] Updating contact ${contactId} language to ${language}`);
  }

  /**
   * 停止 Agent
   */
  async stop(): Promise<void> {
    console.log(`[Agent:${this.id}] Stopping...`);
    
    // 停止心跳管理器
    if (this.heartbeatManager) {
      this.heartbeatManager.destroy();
      this.heartbeatManager = null;
    }
    
    this.runtime.status = "idle";
    console.log(`[Agent:${this.id}] Stopped`);
  }
}
