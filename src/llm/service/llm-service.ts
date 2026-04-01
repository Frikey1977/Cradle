/**
 * LLM Service
 * 基于 Vercel AI SDK 的统一 LLM 服务
 * 
 * 职责：
 * 1. 实例管理（从数据库加载）
 * 2. 路由决策（优先使用免费/优惠额度）
 * 3. 配额管理（使用实例配置中的 billingType, dailyQuota, dailyUsed 等）
 * 4. 统一调用接口（基于 Vercel AI SDK）
 * 5. 流式工具调用支持
 */

import { streamText, generateText, tool, jsonSchema, type ModelMessage, type Tool } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import { query, run } from "../../store/database.js";
import type { LlmInstance, BillingType } from "../instances/types.js";
import type { ToolDefinition } from "../../agent/tools/tool-definitions.js";
import { getLLMLogger } from "../../utils/llm-logger.js";
import type { LLMServiceInterface, RouteInfo } from "../../agent/runtime/llm-service-interface.js";
import type { LLMRequest, LLMResponse, ModelConfig, ConversationMessage } from "../../agent/types/index.js";

function decryptApiKey(encryptedApiKey: string): string {
  return Buffer.from(encryptedApiKey, "base64").toString("utf-8");
}

export type LLMCapability =
  | "textGeneration"
  | "textEmbedding"
  | "deepThinking"
  | "visualComprehension"
  | "speechSynthesis"
  | "speechRecognition"
  | "realtimeSpeech"
  | "imageGeneration";

export type LLMCallSource = "agent" | "orchestrator" | "executor" | "handler" | "react" | "heartbeat";

export interface RoutingTask {
  capability: LLMCapability;
  complexity?: "low" | "medium" | "high";
  priority?: number;
  requireRealtime?: boolean;
  instanceId?: string;
  source?: LLMCallSource;
  agentName?: string;
  worktaskId?: string;
  contactName?: string;
}

export interface RoutingDecision {
  instanceId: string;
  instanceName: string;
  configId: string;
  modelName: string;
  provider: string;
  baseUrl: string;
  apiKey: string;
  billingType: BillingType;
  dailyQuota?: number;
  dailyUsed: number;
  modelParams?: Record<string, any>;
}

export interface LLMCallOptions {
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: any[];
  onThinkingMessage?: (message: string) => void;
}

interface InstanceWithQuota {
  sid: string;
  name: string;
  providerId: string;
  providerName: string;
  configId: string;
  status: string;
  billingType: BillingType;
  dailyQuota?: number;
  dailyUsed: number;
  failCount: number;
  cooldownUntil?: Date;
  lastUsedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  deleted: number;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
  capabilities: string[];
  headers?: string;
  modelParams?: string;
  sort: number;
  weight: number;
  apiKeyHash: string;
}

export interface StreamEvent {
  type: "text" | "tool-call" | "tool-result" | "error" | "finish" | "step-finish" | "reasoning";
  content?: string;
  reasoning?: string;
  toolCall?: {
    id: string;
    name: string;
    args: unknown;
  };
  toolResult?: {
    callId: string;
    output: string;
  };
  error?: Error;
  finishReason?: string;
  usage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface StreamWithToolsRequest {
  messages: ModelMessage[];
  tools: ToolDefinition[];
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  source?: LLMCallSource;
  agentName?: string;
  worktaskId?: string;
  instanceId?: string;
  capability?: LLMCapability;
}

export class LLMService implements LLMServiceInterface {
  private instances = new Map<string, InstanceWithQuota>();
  private initialized = false;
  private logger = getLLMLogger();

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log("[LLMService] Initializing...");
    await this.loadInstances();
    this.initialized = true;
    console.log(`[LLMService] Initialized with ${this.instances.size} instances`);
  }

  private async loadInstances(): Promise<void> {
    const rows = await query(`
      SELECT 
        i.sid,
        i.name,
        i.config_id,
        i.api_key,
        i.api_key_hash,
        i.status,
        i.billing_type,
        i.daily_quota,
        i.daily_used,
        i.fail_count,
        i.cooldown_until,
        i.last_used_at,
        i.create_time as created_at,
        i.timestamp as updated_at,
        i.deleted,
        i.sort,
        i.weight,
        c.model_name,
        c.model_type,
        c.base_url,
        c.timeout,
        c.retries,
        c.parameters as model_params,
        c.model_ability,
        c.provider_id,
        p.name as provider_name
      FROM t_llm_instances i
      JOIN t_llm_configs c ON i.config_id = c.sid
      JOIN t_llm_providers p ON c.provider_id = p.sid
      WHERE i.deleted = 0 AND i.status = 'enabled'
    `) as any[];

    for (const row of rows) {
      const instance: InstanceWithQuota = {
        sid: row.sid,
        name: row.name,
        providerId: row.provider_id,
        configId: row.config_id,
        status: row.status,
        billingType: row.billing_type,
        dailyQuota: row.daily_quota,
        dailyUsed: row.daily_used,
        failCount: row.fail_count,
        cooldownUntil: row.cooldown_until,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deleted: row.deleted,
        modelName: row.model_name,
        baseUrl: row.base_url,
        apiKey: decryptApiKey(row.api_key),
        timeout: row.timeout,
        retries: row.retries,
        capabilities: JSON.parse(row.model_ability || "[]"),
        modelParams: row.model_params,
        providerName: row.provider_name,
        sort: row.sort || 0,
        weight: row.weight || 1,
        apiKeyHash: row.api_key_hash || "",
      };

      this.instances.set(instance.sid, instance);
      console.log(`[LLMService] Loaded instance: ${instance.sid} (${instance.name})`);
    }

    console.log(`[LLMService] Loaded ${this.instances.size} instances from database`);
  }

  async route(task: RoutingTask): Promise<RoutingDecision> {
    this.checkInitialized();

    console.log(`[LLMService] route() called with task:`, {
      capability: task.capability,
      complexity: task.complexity,
      instanceId: task.instanceId,
    });

    if (task.instanceId) {
      console.log(`[LLMService] task.instanceId specified: ${task.instanceId}`);
      const instance = this.instances.get(task.instanceId);
      if (!instance) {
        console.warn(`[LLMService] Instance ${task.instanceId} not found, falling back to auto-routing`);
      } else {
        console.log(`[LLMService] Using specified instance: ${instance.sid} (${instance.name})`);
        return this.createRoutingDecision(instance);
      }
    }

    let candidates = Array.from(this.instances.values()).filter(inst => {
      const hasCapability = inst.capabilities.includes(task.capability);
      if (!hasCapability) return false;

      if (inst.cooldownUntil && new Date(inst.cooldownUntil) > new Date()) {
        return false;
      }
      
      if (inst.cooldownUntil && new Date(inst.cooldownUntil) <= new Date()) {
        inst.failCount = 0;
        inst.cooldownUntil = undefined;
        console.log(`[LLMService] Instance ${inst.sid} cooldown ended, reset failCount`);
      }

      if (inst.dailyQuota && inst.dailyUsed >= inst.dailyQuota) {
        console.warn(`[LLMService] Instance ${inst.sid} quota exhausted`);
        return false;
      }

      if (inst.failCount >= 5) {
        console.warn(`[LLMService] Instance ${inst.sid} has too many failures`);
        return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      throw new Error(`No available instances for capability: ${task.capability}`);
    }

    const billingTypePriority: Record<BillingType, number> = {
      "free": 1,
      "prepaid": 2,
      "subscription": 3,
      "dedicated": 4,
      "privatization": 5,
      "usage": 6,
    };

    candidates.sort((a, b) => {
      const priorityDiff = billingTypePriority[a.billingType] - billingTypePriority[b.billingType];
      if (priorityDiff !== 0) return priorityDiff;

      const remainingA = a.dailyQuota ? a.dailyQuota - a.dailyUsed : Infinity;
      const remainingB = b.dailyQuota ? b.dailyQuota - b.dailyUsed : Infinity;
      return remainingB - remainingA;
    });

    const selected = candidates[0];
    console.log(`[LLMService] Routed to instance ${selected.sid} (${selected.name}), billing: ${selected.billingType}`);

    return this.createRoutingDecision(selected);
  }

  private async createRoutingDecision(instance: InstanceWithQuota): Promise<RoutingDecision> {
    let modelParams: Record<string, any> | undefined;
    
    try {
      if (instance.modelParams && instance.modelParams !== 'null' && instance.modelParams !== '') {
        if (typeof instance.modelParams === 'object') {
          modelParams = instance.modelParams;
        } else if (instance.modelParams !== '[object Object]') {
          modelParams = JSON.parse(instance.modelParams);
        }
      }
    } catch (e) {
      console.warn(`[LLMService] Failed to parse modelParams for ${instance.sid}`);
    }

    return {
      instanceId: instance.sid,
      instanceName: instance.name,
      configId: instance.configId,
      modelName: instance.modelName,
      provider: instance.providerName,
      baseUrl: instance.baseUrl,
      apiKey: instance.apiKey,
      billingType: instance.billingType,
      dailyQuota: instance.dailyQuota,
      dailyUsed: instance.dailyUsed,
      modelParams,
    };
  }

  async generate(request: LLMRequest): Promise<LLMResponse & { routeInfo?: RouteInfo }> {
    const capability = this.inferCapability(request.model);
    const task: RoutingTask = {
      capability,
      instanceId: request.model.instanceId,
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
      contactName: request.contactName,
    };

    const decision = await this.route(task);
    const startTime = Date.now();

    // 构建与实际调用一致的请求体
    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    const actualTools = request.tools ? this.convertTools(request.tools) : undefined;
    const actualTemperature = request.model.parameters?.temperature as number;
    const actualMaxTokens = request.model.parameters?.maxTokens as number | undefined;

    // 构建实际发送的请求体（与 streamText 参数一致）
    const actualRequestBody = {
      model: decision.modelName,
      messages: request.messages as ModelMessage[],
      tools: actualTools,
      toolChoice: actualTools ? "auto" as const : undefined,
      temperature: actualTemperature,
      maxOutputTokens: actualMaxTokens,
    };

    // 记录请求日志（与实际发送的请求体一致）
    await this.logger.logRequest({
      model: decision.modelName,
      provider: decision.provider,
      instanceId: decision.instanceId,
      requestBody: {
        ...actualRequestBody,
        tools: request.tools, // 同时记录原始 tools 格式便于阅读
      },
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
      contactName: request.contactName,
    });

    try {
      const result = await generateText({
        model: provider.chatModel(decision.modelName),
        messages: request.messages as ModelMessage[],
        tools: actualTools,
        temperature: actualTemperature,
        maxOutputTokens: actualMaxTokens,
      });

      // 记录实际发送给 API 的 HTTP 请求体
      console.log(`[LLMService] ACTUAL API REQUEST BODY:`);
      console.log(JSON.stringify(result.request.body, null, 2));

      const usage = result.usage;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
      await this.recordUsage(decision.instanceId, totalTokens);

      await this.logger.logResponse({
        model: decision.modelName,
        provider: decision.provider,
        instanceId: decision.instanceId,
        responseData: {
          text: result.text,
          toolCalls: result.toolCalls?.map((tc: any) => ({
            id: tc.toolCallId,
            name: tc.toolName,
            args: JSON.stringify(tc.args || tc.input),
          })),
        },
        duration: Date.now() - startTime,
        tokenUsage: usage ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        } : undefined,
        source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
      });

      return {
        content: result.text,
        toolCalls: result.toolCalls?.map((tc: any) => ({
          id: tc.toolCallId,
          type: "function" as const,
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.args || tc.input),
          },
        })),
        usage: usage ? {
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          totalTokens: totalTokens,
        } : undefined,
        routeInfo: {
          instanceId: decision.instanceId,
          instanceName: decision.instanceName,
          modelName: decision.modelName,
          provider: decision.provider,
        },
      };
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  async *streamGenerate(request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown> {
    const capability = this.inferCapability(request.model);
    const task: RoutingTask = {
      capability,
      instanceId: request.model.instanceId,
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
      contactName: request.contactName,
    };

    const decision = await this.route(task);
    const startTime = Date.now();

    // 构建与实际调用一致的请求体
    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    const actualTools = request.tools ? this.convertTools(request.tools) : undefined;
    const actualTemperature = request.model.parameters?.temperature as number;
    const actualMaxTokens = request.model.parameters?.maxTokens as number | undefined;

    // 构建实际发送的请求体（与 streamText 参数一致）
    const actualRequestBody = {
      model: decision.modelName,
      messages: request.messages as ModelMessage[],
      tools: actualTools,
      toolChoice: actualTools ? "auto" as const : undefined,
      temperature: actualTemperature,
      maxOutputTokens: actualMaxTokens,
    };

    // 记录请求日志（与实际发送的请求体一致）
    await this.logger.logRequest({
      model: decision.modelName,
      provider: decision.provider,
      instanceId: decision.instanceId,
      requestBody: {
        ...actualRequestBody,
        tools: request.tools, // 同时记录原始 tools 格式便于阅读
      },
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
      contactName: request.contactName,
    });

    let fullText = "";
    let fullReasoning = "";
    let totalTokens = 0;
    const toolCalls: Map<string, { name: string; args: unknown }> = new Map();

    try {
      const result = streamText({
        model: provider.chatModel(decision.modelName),
        messages: request.messages as ModelMessage[],
        tools: actualTools,
        temperature: actualTemperature,
        maxOutputTokens: actualMaxTokens,
      });

      // 记录实际发送给 API 的 HTTP 请求体
      Promise.resolve(result.request).then(meta => {
        if (meta && meta.body) {
          console.log(`[LLMService.streamGenerate] ACTUAL API REQUEST BODY:`);
          console.log(JSON.stringify(meta.body, null, 2));
        }
      }).catch((err: Error) => {
        console.error(`[LLMService.streamGenerate] Failed to get request metadata:`, err);
      });

      // 使用 fullStream 来处理所有类型的事件，包括 tool calls
      for await (const chunk of result.fullStream) {
        switch (chunk.type) {
          case "text-delta":
            fullText += chunk.text;
            totalTokens += chunk.text.length;
            yield { type: "text", content: chunk.text };
            break;

          case "reasoning-delta":
            fullReasoning += chunk.text;
            yield { type: "reasoning", reasoning: chunk.text };
            break;

          case "tool-call":
            toolCalls.set(chunk.toolCallId, {
              name: chunk.toolName,
              args: chunk.input,
            });
            console.log(`[LLMService.streamGenerate] Tool call received: ${chunk.toolName}`);
            yield {
              type: "tool-call",
              toolCall: {
                id: chunk.toolCallId,
                name: chunk.toolName,
                args: chunk.input,
              },
            };
            break;

          case "finish":
            yield {
              type: "finish",
              finishReason: chunk.finishReason,
              usage: chunk.totalUsage ? {
                prompt: chunk.totalUsage.inputTokens ?? 0,
                completion: chunk.totalUsage.outputTokens ?? 0,
                total: chunk.totalUsage.totalTokens ?? 0,
              } : undefined,
            };
            break;
        }
      }

      // 检查是否有 tool calls
      if (toolCalls.size > 0) {
        console.log(`[LLMService.streamGenerate] Total tool calls: ${toolCalls.size}`);
      }

      const usage = await result.usage;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      const actualTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
      await this.recordUsage(decision.instanceId, actualTokens || totalTokens);

      await this.logger.logResponse({
        model: decision.modelName,
        provider: decision.provider,
        instanceId: decision.instanceId,
        responseData: {
          text: fullText,
          reasoningContent: fullReasoning || undefined,
          toolCalls: Array.from(toolCalls.entries()).map(([id, call]) => ({
            id,
            name: call.name,
            args: call.args,
          })),
        },
        duration: Date.now() - startTime,
        tokenUsage: usage ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: actualTokens,
        } : undefined,
        source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
      });
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  async *streamWithTools(request: StreamWithToolsRequest): AsyncGenerator<StreamEvent, void, unknown> {
    const task: RoutingTask = {
      capability: request.capability || "textGeneration",
      instanceId: request.instanceId,
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
    };

    const decision = await this.route(task);
    const startTime = Date.now();

    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    const tools: Record<string, Tool> = {};
    for (const toolDef of request.tools) {
      const inputSchema = toolDef.parameters
        ? (toolDef.parameters instanceof z.ZodType
            ? toolDef.parameters
            : jsonSchema(toolDef.parameters))
        : z.object({});

      tools[toolDef.id] = tool({
        description: toolDef.description,
        inputSchema,
        execute: async (input: unknown) => {
          return { result: "Tool execution not supported in LLMService" };
        },
      });
    }

    const actualTemperature = request.temperature ?? 0.7;
    const actualMaxTokens = request.maxOutputTokens ?? 4096;

    // 构建实际发送的请求体（与 streamText 参数一致）
    const actualRequestBody = {
      model: decision.modelName,
      messages: request.messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
      toolChoice: Object.keys(tools).length > 0 ? "auto" as const : undefined,
      system: request.system,
      temperature: actualTemperature,
      maxOutputTokens: actualMaxTokens,
    };

    // 记录请求日志（与实际发送的请求体一致）
    await this.logger.logRequest({
      model: decision.modelName,
      provider: decision.provider,
      instanceId: decision.instanceId,
      requestBody: {
        ...actualRequestBody,
        tools: request.tools, // 同时记录原始 tools 格式便于阅读
      },
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
    });

    let fullText = "";
    let fullReasoning = "";
    const toolCalls: Map<string, { name: string; args: unknown }> = new Map();

    try {
      const result = streamText({
        model: provider.chatModel(decision.modelName),
        messages: request.messages,
        tools,
        system: request.system,
        temperature: actualTemperature,
        maxOutputTokens: actualMaxTokens,
      });

      for await (const chunk of result.fullStream) {
        switch (chunk.type) {
          case "text-delta":
            fullText += chunk.text;
            yield { type: "text", content: chunk.text };
            break;

          case "reasoning-delta":
            fullReasoning += chunk.text;
            yield { type: "reasoning", reasoning: chunk.text };
            break;

          case "tool-call":
            toolCalls.set(chunk.toolCallId, {
              name: chunk.toolName,
              args: chunk.input,
            });
            yield {
              type: "tool-call",
              toolCall: {
                id: chunk.toolCallId,
                name: chunk.toolName,
                args: chunk.input,
              },
            };
            break;

          case "finish":
            const usage = chunk.totalUsage;
            const promptTokens = usage?.inputTokens ?? 0;
            const completionTokens = usage?.outputTokens ?? 0;
            const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);

            await this.recordUsage(decision.instanceId, totalTokens);

            await this.logger.logResponse({
              model: decision.modelName,
              provider: decision.provider,
              instanceId: decision.instanceId,
              responseData: {
                text: fullText,
                reasoningContent: fullReasoning || undefined,
                toolCalls: Array.from(toolCalls.entries()).map(([id, call]) => ({
                  id,
                  name: call.name,
                  args: JSON.stringify(call.args),
                })),
              },
              duration: Date.now() - startTime,
              tokenUsage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
              source: request.source,
              agentName: request.agentName,
              worktaskId: request.worktaskId,
            });

            yield {
              type: "finish",
              finishReason: chunk.finishReason,
              usage: { prompt: promptTokens, completion: completionTokens, total: totalTokens },
            };
            break;

          case "error":
            yield { type: "error", error: chunk.error instanceof Error ? chunk.error : new Error(String(chunk.error)) };
            break;
        }
      }
    } catch (error) {
      await this.recordError(decision.instanceId);
      await this.logger.logError({
        model: decision.modelName,
        provider: decision.provider,
        instanceId: decision.instanceId,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
      });
      yield { type: "error", error: error instanceof Error ? error : new Error(String(error)) };
    }
  }

  async multimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
      source?: "agent" | "orchestrator" | "executor";
      agentName?: string;
      worktaskId?: string;
      contactName?: string;
    }
  ): Promise<LLMResponse & { routeInfo?: RouteInfo }> {
    const task: RoutingTask = {
      capability: options.audio ? "speechRecognition" : "visualComprehension",
      complexity: options.complexity,
      source: options.source as LLMCallSource,
      agentName: options.agentName,
      worktaskId: options.worktaskId,
      contactName: options.contactName,
    };

    const decision = await this.route(task);
    const startTime = Date.now();

    // 构建内容（与实际调用一致）
    const content: any[] = [{ type: "text", text: prompt }];

    if (options.images) {
      for (const image of options.images) {
        content.push({
          type: "image",
          image: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
        });
      }
    }

    if (options.audio) {
      for (const audio of options.audio) {
        content.push({
          type: "audio",
          data: audio.startsWith("data:") ? audio : `data:audio/${options.audioFormat || "wav"};base64,${audio}`,
          mimeType: `audio/${options.audioFormat || "wav"}`,
        });
      }
    }

    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    // 构建实际发送的请求体（与 generateText 参数一致）
    const actualRequestBody = {
      model: decision.modelName,
      messages: [{ role: "user" as const, content }],
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    };

    // 记录请求日志（与实际发送的请求体一致）
    await this.logger.logRequest({
      model: decision.modelName,
      provider: decision.provider,
      instanceId: decision.instanceId,
      requestBody: {
        ...actualRequestBody,
        prompt,
        images: options.images?.length,
        audio: options.audio?.length,
      },
      source: options.source as LLMCallSource,
      agentName: options.agentName,
      worktaskId: options.worktaskId,
      contactName: options.contactName,
    });

    try {
      const result = await generateText({
        model: provider.chatModel(decision.modelName),
        messages: actualRequestBody.messages,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens as number | undefined,
      });

      const usage = result.usage;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
      await this.recordUsage(decision.instanceId, totalTokens);

      // 记录响应日志
      await this.logger.logResponse({
        model: decision.modelName,
        provider: decision.provider,
        instanceId: decision.instanceId,
        responseData: { text: result.text },
        duration: Date.now() - startTime,
        tokenUsage: usage ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        } : undefined,
        source: options.source as LLMCallSource,
        agentName: options.agentName,
        worktaskId: options.worktaskId,
        contactName: options.contactName,
      });

      return {
        content: result.text,
        usage: usage ? {
          promptTokens: promptTokens,
          completionTokens: completionTokens,
          totalTokens: totalTokens,
        } : undefined,
        routeInfo: {
          instanceId: decision.instanceId,
          instanceName: decision.instanceName,
          modelName: decision.modelName,
          provider: decision.provider,
        },
      };
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  async *streamMultimodalChat(
    prompt: string,
    options: {
      images?: string[];
      audio?: string[];
      audioFormat?: string;
      complexity?: "low" | "medium" | "high";
      temperature?: number;
      maxTokens?: number;
      source?: "agent" | "orchestrator" | "executor";
      agentName?: string;
      worktaskId?: string;
      contactName?: string;
    }
  ): AsyncGenerator<string, void, unknown> {
    const task: RoutingTask = {
      capability: options.audio ? "speechRecognition" : "visualComprehension",
      complexity: options.complexity,
      source: options.source as LLMCallSource,
      agentName: options.agentName,
      worktaskId: options.worktaskId,
      contactName: options.contactName,
    };

    const decision = await this.route(task);
    const startTime = Date.now();

    // 构建内容（与实际调用一致）
    const content: any[] = [{ type: "text", text: prompt }];

    if (options.images) {
      for (const image of options.images) {
        content.push({
          type: "image",
          image: image.startsWith("data:") ? image : `data:image/jpeg;base64,${image}`,
        });
      }
    }

    if (options.audio) {
      for (const audio of options.audio) {
        content.push({
          type: "audio",
          data: audio.startsWith("data:") ? audio : `data:audio/${options.audioFormat || "wav"};base64,${audio}`,
          mimeType: `audio/${options.audioFormat || "wav"}`,
        });
      }
    }

    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    // 构建实际发送的请求体（与 streamText 参数一致）
    const actualRequestBody = {
      model: decision.modelName,
      messages: [{ role: "user" as const, content }],
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    };

    // 记录请求日志（与实际发送的请求体一致）
    await this.logger.logRequest({
      model: decision.modelName,
      provider: decision.provider,
      instanceId: decision.instanceId,
      requestBody: {
        ...actualRequestBody,
        prompt,
        images: options.images?.length,
        audio: options.audio?.length,
      },
      source: options.source as LLMCallSource,
      agentName: options.agentName,
      worktaskId: options.worktaskId,
      contactName: options.contactName,
    });

    let fullText = "";
    let totalTokens = 0;

    try {
      const result = streamText({
        model: provider.chatModel(decision.modelName),
        messages: actualRequestBody.messages,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens as number | undefined,
      });

      for await (const chunk of result.textStream) {
        fullText += chunk;
        totalTokens += chunk.length;
        yield chunk;
      }

      const usage = await result.usage;
      const promptTokens = usage?.inputTokens ?? 0;
      const completionTokens = usage?.outputTokens ?? 0;
      const actualTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
      await this.recordUsage(decision.instanceId, actualTokens || totalTokens);

      // 记录响应日志
      await this.logger.logResponse({
        model: decision.modelName,
        provider: decision.provider,
        instanceId: decision.instanceId,
        responseData: { text: fullText },
        duration: Date.now() - startTime,
        tokenUsage: usage ? {
          prompt: promptTokens,
          completion: completionTokens,
          total: actualTokens,
        } : undefined,
        source: options.source as LLMCallSource,
        agentName: options.agentName,
        worktaskId: options.worktaskId,
        contactName: options.contactName,
      });
    } catch (error) {
      await this.recordError(decision.instanceId);
      throw error;
    }
  }

  async getRouteInfo(options: {
    capability: string;
    complexity?: "low" | "medium" | "high";
  }): Promise<RouteInfo> {
    const task: RoutingTask = {
      capability: options.capability as LLMCapability,
      complexity: options.complexity,
    };

    const decision = await this.route(task);

    return {
      instanceId: decision.instanceId,
      instanceName: decision.instanceName,
      modelName: decision.modelName,
      provider: decision.provider,
      billingType: decision.billingType,
    };
  }

  getInstanceInfo(instanceId: string): { modelName: string; provider: string } | undefined {
    const instance = this.instances.get(instanceId);
    if (!instance) return undefined;

    return {
      modelName: instance.modelName,
      provider: instance.providerName,
    };
  }

  async getInstanceConfig(instanceId: string): Promise<{
    modelName: string;
    provider: string;
    baseUrl: string;
    apiKey: string;
    instanceId: string;
  } | undefined> {
    let instance = this.instances.get(instanceId);

    if (!instance) {
      console.warn(`[LLMService] Instance ${instanceId} not found, auto-selecting...`);

      const candidates = Array.from(this.instances.values()).filter(inst => {
        if (!inst.capabilities.includes("textGeneration")) return false;
        if (inst.cooldownUntil && new Date(inst.cooldownUntil) > new Date()) return false;
        if (inst.cooldownUntil && new Date(inst.cooldownUntil) <= new Date()) {
          inst.failCount = 0;
          inst.cooldownUntil = undefined;
        }
        if (inst.dailyQuota && inst.dailyUsed >= inst.dailyQuota) return false;
        if (inst.failCount >= 5) return false;
        return true;
      });

      if (candidates.length === 0) {
        console.error(`[LLMService] No available instances found`);
        return undefined;
      }

      const billingTypePriority: Record<BillingType, number> = {
        "free": 1, "prepaid": 2, "subscription": 3,
        "dedicated": 4, "privatization": 5, "usage": 6,
      };

      candidates.sort((a, b) => {
        const priorityDiff = billingTypePriority[a.billingType] - billingTypePriority[b.billingType];
        if (priorityDiff !== 0) return priorityDiff;
        const remainingA = a.dailyQuota ? a.dailyQuota - a.dailyUsed : Infinity;
        const remainingB = b.dailyQuota ? b.dailyQuota - b.dailyUsed : Infinity;
        return remainingB - remainingA;
      });

      instance = candidates[0];
      console.log(`[LLMService] Auto-selected instance: ${instance.sid} (${instance.name})`);
    }

    return {
      modelName: instance.modelName,
      provider: instance.providerName,
      baseUrl: instance.baseUrl,
      apiKey: instance.apiKey,
      instanceId: instance.sid,
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const task: RoutingTask = { capability: "textEmbedding" };
    const decision = await this.route(task);

    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    const { embeddings } = await provider.textEmbeddingModel(decision.modelName).doEmbed({
      values: [text],
    });

    await this.recordUsage(decision.instanceId, text.length / 4);
    return embeddings[0];
  }

  async batchEmbed(texts: string[]): Promise<number[][]> {
    const task: RoutingTask = { capability: "textEmbedding" };
    const decision = await this.route(task);

    const provider = createOpenAICompatible({
      name: decision.provider,
      baseURL: decision.baseUrl,
      apiKey: decision.apiKey,
    });

    const { embeddings } = await provider.textEmbeddingModel(decision.modelName).doEmbed({
      values: texts,
    });

    const totalChars = texts.reduce((sum, t) => sum + t.length, 0);
    await this.recordUsage(decision.instanceId, totalChars / 4);
    return embeddings;
  }

  async analyzeImage(imageBase64: string, prompt: string): Promise<string> {
    const response = await this.multimodalChat(prompt, {
      images: [imageBase64],
    });
    return response.content;
  }

  async transcribeAudio(
    audioData: string,
    options: {
      format?: string;
      instanceId?: string;
      onThinkingMessage?: (message: string) => void;
    } = {}
  ): Promise<{ text: string; routeInfo: RouteInfo }> {
    const task: RoutingTask = {
      capability: "speechRecognition",
      instanceId: options.instanceId,
    };

    const decision = await this.route(task);

    if (options.onThinkingMessage) {
      options.onThinkingMessage([
        `🎤 语音识别`,
        `🎯 模型: ${decision.modelName} (${decision.provider})`,
      ].join('\n'));
    }

    const audioFormat = options.format || "wav";
    const audioUrl = audioData.startsWith("data:")
      ? audioData
      : `data:audio/${audioFormat};base64,${audioData}`;

    const response = await this.multimodalChat(
      "请转录这段语音，只返回转录后的文字。",
      { audio: [audioUrl], audioFormat }
    );

    return {
      text: response.content,
      routeInfo: response.routeInfo!,
    };
  }

  async synthesizeSpeech(
    text: string,
    options: {
      voice?: string;
      format?: string;
      instanceId?: string;
      onThinkingMessage?: (message: string) => void;
    } = {}
  ): Promise<{ audio: string; format: string; routeInfo: RouteInfo }> {
    throw new Error("Speech synthesis not implemented in LLMService. Use specialized TTS service.");
  }

  getStats(): { initialized: boolean; instanceCount: number } {
    return {
      initialized: this.initialized,
      instanceCount: this.instances.size,
    };
  }

  getQuotaStats(instanceId?: string): any {
    if (instanceId) {
      const instance = this.instances.get(instanceId);
      if (!instance) return null;

      return {
        instanceId: instance.sid,
        name: instance.name,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        remaining: instance.dailyQuota ? instance.dailyQuota - instance.dailyUsed : 'unlimited',
        failCount: instance.failCount,
        isCooling: instance.cooldownUntil && new Date(instance.cooldownUntil) > new Date(),
      };
    }

    const stats: any[] = [];
    for (const instance of this.instances.values()) {
      stats.push({
        instanceId: instance.sid,
        name: instance.name,
        billingType: instance.billingType,
        dailyQuota: instance.dailyQuota,
        dailyUsed: instance.dailyUsed,
        remaining: instance.dailyQuota ? instance.dailyQuota - instance.dailyUsed : 'unlimited',
        failCount: instance.failCount,
        isCooling: instance.cooldownUntil && new Date(instance.cooldownUntil) > new Date(),
      });
    }
    return stats;
  }

  async stop(): Promise<void> {
    this.initialized = false;
    this.instances.clear();
    console.log("[LLMService] Stopped");
  }

  private convertTools(tools: any[]): Record<string, Tool> {
    const result: Record<string, Tool> = {};
    for (const toolDef of tools) {
      const name = toolDef.function?.name || toolDef.id || toolDef.name;
      const description = toolDef.function?.description || toolDef.description || "";
      const parameters = toolDef.function?.parameters || toolDef.parameters;
      
      if (name) {
        const inputSchema = parameters 
          ? jsonSchema(parameters)
          : z.object({});
        
        result[name] = tool({
          description,
          inputSchema,
          execute: async (input: unknown) => {
            return { result: "Tool execution not supported in LLMService" };
          },
        });
      }
    }
    return result;
  }

  private inferCapability(model: ModelConfig): LLMCapability {
    return "textGeneration";
  }

  private async recordUsage(instanceId: string, tokens: number): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    instance.dailyUsed += Math.round(tokens);

    await run(
      `UPDATE t_llm_instances SET daily_used = daily_used + ?, last_used_at = NOW() WHERE sid = ?`,
      [Math.round(tokens), instanceId]
    );

    console.log(`[LLMService] Recorded usage for ${instanceId}: ${Math.round(tokens)} tokens`);
  }

  private async recordError(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) return;

    instance.failCount++;

    let cooldownUntil: Date | undefined;
    if (instance.failCount >= 5) {
      cooldownUntil = new Date(Date.now() + 5 * 60 * 1000);
      instance.cooldownUntil = cooldownUntil;
    }

    if (cooldownUntil) {
      await run(
        `UPDATE t_llm_instances SET fail_count = fail_count + 1, cooldown_until = ? WHERE sid = ?`,
        [cooldownUntil, instanceId]
      );
      console.warn(`[LLMService] Instance ${instanceId} entered cooldown`);
    } else {
      await run(
        `UPDATE t_llm_instances SET fail_count = fail_count + 1 WHERE sid = ?`,
        [instanceId]
      );
    }
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error("LLMService not initialized. Call initialize() first.");
    }
  }
}
