/**
 * 基于 ai SDK 的 LLM 服务
 * 
 * 这是重构后的 LLM 服务层，使用 Vercel AI SDK 的 streamText
 * 提供流式工具调用、自动参数验证和错误处理
 */

import { streamText, type ModelMessage, type Tool } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { z } from "zod";
import type { ToolDefinition } from "../../agent/tools/tool-definitions.js";
import { toAISDKTool } from "../../agent/tools/tool-definitions.js";
import { getLLMLogger } from "../../utils/llm-logger.js";

export interface AISDKServiceConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  modelName: string;
  instanceId: string;
}

import type { LLMCallSource } from "../../utils/llm-logger.js";

export interface StreamRequest {
  messages: ModelMessage[];
  tools: ToolDefinition[];
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  source?: LLMCallSource;
  agentName?: string;
  worktaskId?: string;
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

/**
 * 使用 ai SDK 进行流式对话
 */
export async function* streamWithTools(
  config: AISDKServiceConfig,
  request: StreamRequest
): AsyncGenerator<StreamEvent, void, unknown> {
  const logger = getLLMLogger();
  const startTime = Date.now();
  
  // 创建 OpenAI 兼容 provider
  const provider = createOpenAICompatible({
    name: config.provider,
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
  
  // 转换工具为 ai SDK 格式
  const tools: Record<string, Tool> = {};
  for (const toolDef of request.tools) {
    tools[toolDef.id] = toAISDKTool(toolDef);
  }
  
  // 记录请求 - 包含完整的工具定义（但截断过长的内容）
  const MAX_LOG_LENGTH = 10000; // 最大日志长度
  const truncate = (str: string, maxLen: number): string => {
    if (!str || str.length <= maxLen) return str;
    return str.substring(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
  };
  
  logger.logRequest({
    model: config.modelName,
    provider: config.provider,
    instanceId: config.instanceId,
    requestBody: {
      messages: request.messages?.map(m => ({
        ...m,
        content: typeof m.content === 'string' ? truncate(m.content, MAX_LOG_LENGTH) : m.content,
      })),
      tools: request.tools.map(t => ({
        id: t.id,
        description: t.description,
        parameters: t.parameters instanceof z.ZodType ? 'ZodSchema' : t.parameters,
      })),
      system: request.system ? truncate(request.system, MAX_LOG_LENGTH) : undefined,
      temperature: request.temperature,
      maxOutputTokens: request.maxOutputTokens,
    },
    source: request.source,
    agentName: request.agentName,
    worktaskId: request.worktaskId,
  });
  
  let fullText = "";
  let fullReasoning = "";
  let hasError = false;
  let errorMessage = "";
  const toolCalls: Map<string, { name: string; args: unknown }> = new Map();
  let requestMetadataLogged = false;
  
  try {
    const result = streamText({
      model: provider.chatModel(config.modelName),
      messages: request.messages,
      tools,
      system: request.system,
      temperature: request.temperature ?? 0.7,
      maxOutputTokens: request.maxOutputTokens ?? 4096,
      toolChoice: "auto",
    });
    
    for await (const chunk of result.fullStream) {
      // 在第一次迭代时获取请求体
      if (!requestMetadataLogged) {
        requestMetadataLogged = true;
        Promise.resolve(result.request).then(meta => {
          if (meta && meta.body) {
            console.log(`[AISDKService] ACTUAL API REQUEST BODY:`);
            console.log(JSON.stringify(meta.body, null, 2));
          }
        }).catch((err: Error) => {
          console.error(`[AISDKService] Failed to get request metadata:`, err);
        });
      }
      
      switch (chunk.type) {
        case "text-delta":
          fullText += chunk.text;
          yield {
            type: "text" as const,
            content: chunk.text,
          };
          break;
          
        case "reasoning-delta":
          fullReasoning += chunk.text;
          yield {
            type: "reasoning" as const,
            reasoning: chunk.text,
          };
          break;
          
        case "tool-call":
          console.log(`[AISDKService] Received tool-call event: ${chunk.toolName} (${chunk.toolCallId})`);
          toolCalls.set(chunk.toolCallId, {
            name: chunk.toolName,
            args: chunk.input,
          });
          yield {
            type: "tool-call" as const,
            toolCall: {
              id: chunk.toolCallId,
              name: chunk.toolName,
              args: chunk.input,
            },
          };
          break;
          
        case "tool-call-delta":
          console.log(`[AISDKService] Received tool-call-delta event: ${chunk.toolName} (${chunk.toolCallId}), delta: ${chunk.argsTextDelta?.substring(0, 50)}`);
          break;
          
        case "finish":
          {
            const MAX_LOG_LENGTH = 10000;
            const TOOL_ARGS_MAX_LENGTH = 300;
            const truncate = (str: string, maxLen: number): string => {
              if (!str || str.length <= maxLen) return str;
              return str.substring(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
            };
            
            const usage = chunk.totalUsage;
            const promptTokens = usage?.inputTokens ?? 0;
            const completionTokens = usage?.outputTokens ?? 0;
            const totalTokens = usage?.totalTokens ?? (promptTokens + completionTokens);
            
            await logger.logResponse({
              model: config.modelName,
              provider: config.provider,
              instanceId: config.instanceId,
              responseData: {
                text: truncate(fullText, MAX_LOG_LENGTH),
                reasoningContent: fullReasoning ? truncate(fullReasoning, MAX_LOG_LENGTH) : undefined,
                toolCalls: Array.from(toolCalls.entries()).map(([id, call]) => {
                  const argsStr = JSON.stringify(call.args);
                  const truncatedArgs = argsStr.length > TOOL_ARGS_MAX_LENGTH 
                    ? argsStr.substring(0, TOOL_ARGS_MAX_LENGTH) + `...[truncated ${argsStr.length - TOOL_ARGS_MAX_LENGTH} chars]`
                    : argsStr;
                  return {
                    id,
                    name: call.name,
                    args: truncatedArgs,
                  };
                }),
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
            
            console.log(`[AISDKService] Stream completed: text=${fullText.length}chars, reasoning=${fullReasoning.length}chars, usage=${usage ? JSON.stringify({ prompt: promptTokens, completion: completionTokens, total: totalTokens }) : 'N/A'}`);
            
            if (hasError && errorMessage) {
              await logger.logError({
                model: config.modelName,
                provider: config.provider,
                instanceId: config.instanceId,
                error: errorMessage,
                duration: Date.now() - startTime,
                source: request.source,
                agentName: request.agentName,
                worktaskId: request.worktaskId,
              });
            }
            
            yield {
              type: "finish" as const,
              finishReason: chunk.finishReason,
              usage: usage ? {
                prompt: promptTokens,
                completion: completionTokens,
                total: totalTokens,
              } : undefined,
            };
          }
          break;
          
        case "error":
          hasError = true;
          errorMessage = chunk.error instanceof Error ? chunk.error.message : String(chunk.error);
          // 创建标准化的 Error 对象，避免不可序列化的属性
          const standardizedError = new Error(errorMessage);
          if (chunk.error instanceof Error && chunk.error.stack) {
            standardizedError.stack = chunk.error.stack;
          }
          yield {
            type: "error" as const,
            error: standardizedError,
          };
          break;
      }
    }
  } catch (error) {
    if (fullText || toolCalls.size > 0 || fullReasoning) {
      const MAX_LOG_LENGTH = 10000;
      const TOOL_ARGS_MAX_LENGTH = 300;
      const truncate = (str: string, maxLen: number): string => {
        if (!str || str.length <= maxLen) return str;
        return str.substring(0, maxLen) + `...[truncated ${str.length - maxLen} chars]`;
      };
      
      logger.logResponse({
        model: config.modelName,
        provider: config.provider,
        instanceId: config.instanceId,
        responseData: {
          text: truncate(fullText, MAX_LOG_LENGTH),
          reasoningContent: fullReasoning ? truncate(fullReasoning, MAX_LOG_LENGTH) : undefined,
          toolCalls: Array.from(toolCalls.entries()).map(([id, call]) => {
            const argsStr = JSON.stringify(call.args);
            const truncatedArgs = argsStr.length > TOOL_ARGS_MAX_LENGTH 
              ? argsStr.substring(0, TOOL_ARGS_MAX_LENGTH) + `...[truncated ${argsStr.length - TOOL_ARGS_MAX_LENGTH} chars]`
              : argsStr;
            return {
              id,
              name: call.name,
              args: truncatedArgs,
            };
          }),
        },
        duration: Date.now() - startTime,
        source: request.source,
        agentName: request.agentName,
        worktaskId: request.worktaskId,
      });
    }
    
    logger.logError({
      model: config.modelName,
      provider: config.provider,
      instanceId: config.instanceId,
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - startTime,
      source: request.source,
      agentName: request.agentName,
      worktaskId: request.worktaskId,
    });
    
    yield {
      type: "error" as const,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}
