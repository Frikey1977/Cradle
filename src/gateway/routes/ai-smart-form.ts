import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, errorResponse } from "../shared/response.js";
import { LLMServiceManager } from "../../llm/service/llm-service-manager.js";

interface SmartFormRequest {
  module: string;
  formType: string;
  formData: Record<string, any>;
  targetField: string;
  prompt?: string;
  validation?: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
  };
}

interface SmartFormResponse {
  suggestion: string;
  alternatives?: string[];
  reasoning?: string;
  confidence?: number;
}

/**
 * 构建提示词
 */
function buildPrompt(request: SmartFormRequest): string {
  const { formType, formData, targetField, prompt } = request;
  
  // 基础提示词
  let basePrompt = prompt || "";
  
  // 添加表单上下文
  const context = Object.entries(formData)
    .filter(([key, value]) => value && key !== targetField)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
  
  if (context) {
    basePrompt += `\n\n已知信息:\n${context}`;
  }
  
  basePrompt += `\n\n请为 "${targetField}" 字段生成合适的内容。`;
  
  // 添加验证约束
  if (request.validation?.maxLength) {
    basePrompt += ` 长度限制在 ${request.validation.maxLength} 字符以内。`;
  }
  
  basePrompt += "\n\n直接返回内容，不要包含其他解释。";
  
  return basePrompt;
}

/**
 * 解析模型响应
 */
function parseResponse(content: string): SmartFormResponse {
  // 清理响应内容
  const suggestion = content.trim();
  
  return {
    suggestion,
    confidence: 0.9,
  };
}

// 全局 LLMServiceManager 实例
let llmManager: LLMServiceManager | null = null;

/**
 * 获取或初始化 LLMServiceManager
 */
async function getLLMManager(): Promise<LLMServiceManager> {
  if (!llmManager) {
    llmManager = new LLMServiceManager();
    await llmManager.initialize();
  }
  return llmManager;
}

export default async function (fastify: FastifyInstance) {
  // POST /api/ai/smart-form - 获取智能表单建议
  fastify.post("/smart-form", async (
    request: FastifyRequest<{ Body: SmartFormRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { module, formType, targetField } = request.body;
      
      if (!module || !formType || !targetField) {
        return errorResponse(reply, 400, "缺少必要参数: module, formType, targetField");
      }
      
      // 构建提示词
      const prompt = buildPrompt(request.body);
      
      // 获取 LLM 服务管理器
      const manager = await getLLMManager();
      
      const response = await manager.chatCompletion(
        { capability: "textGeneration" },
        [
          {
            role: "system",
            content: "你是一个专业的表单填写助手，帮助用户生成高质量的表单内容。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        {
          temperature: 0.7,
          maxTokens: 1000,
        }
      );
      
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        return errorResponse(reply, 500, "AI 生成失败，无响应内容");
      }
      
      // 解析响应
      const result = parseResponse(content);
      
      return successResponse(reply, result, "生成成功");
    } catch (error) {
      console.error("Smart form assist error:", error);
      return errorResponse(reply, 500, "AI 生成失败: " + (error as Error).message);
    }
  });
}
