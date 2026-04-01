/**
 * LLM配置管理 Zod 验证 Schema
 */

import { z } from "zod";

// 模型参数 schema
const modelParametersSchema = z.object({
  maxTokens: z.number().min(1).max(128000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
}).catchall(z.unknown()).optional();

export const createConfigSchema = z.object({
  name: z.string().min(1, "配置名称不能为空").max(200, "配置名称不能超过200个字符"),
  description: z.string().max(1000, "描述不能超过1000个字符").optional(),
  providerId: z.string().min(1, "提供商ID不能为空"),
  baseUrl: z.string().min(1, "API基础地址不能为空").max(512, "API基础地址不能超过512个字符"),
  subscribeType: z.string().max(50).default("usage"),
  icon: z.string().max(255, "图标不能超过255个字符").optional(),
  modelName: z.string().min(1, "模型名称不能为空").max(200, "模型名称不能超过200个字符"),
  modelType: z.string().max(50).default("text"),
  contextSize: z.number().min(1024, "上下文窗口不能小于1024").max(2000000, "上下文窗口不能超过2000000").default(8192),
  parameters: modelParametersSchema,
  enableThinking: z.string().max(20).default("disabled"),
  stream: z.string().max(20).default("enabled"),
  authMethod: z.string().max(50).default("api_key"),
  providerName: z.string().max(100, "提供商名称不能超过100个字符").optional(),
  modelAbility: z.array(z.string()).optional(),
  timeout: z.number().min(1000, "超时时间不能小于1000毫秒").max(300000, "超时时间不能超过300000毫秒").default(30000),
  retries: z.number().min(0, "重试次数不能小于0").max(10, "重试次数不能超过10").default(3),
  sort: z.number().min(0, "排序不能小于0").max(9999, "排序不能超过9999").default(0),
  status: z.string().max(20).default("enabled"),
});

export const updateConfigSchema = z.object({
  name: z.string().min(1, "配置名称不能为空").max(200, "配置名称不能超过200个字符").optional(),
  description: z.string().max(1000, "描述不能超过1000个字符").optional(),
  providerId: z.string().min(1, "提供商ID不能为空").optional(),
  baseUrl: z.string().min(1, "API基础地址不能为空").max(512, "API基础地址不能超过512个字符").optional(),
  subscribeType: z.string().max(50).optional(),
  icon: z.string().max(255, "图标不能超过255个字符").optional(),
  modelName: z.string().min(1, "模型名称不能为空").max(200, "模型名称不能超过200个字符").optional(),
  modelType: z.string().max(50).optional(),
  contextSize: z.number().min(1024, "上下文窗口不能小于1024").max(2000000, "上下文窗口不能超过2000000").optional(),
  parameters: modelParametersSchema,
  enableThinking: z.string().max(20).optional(),
  stream: z.string().max(20).optional(),
  authMethod: z.string().max(50).optional(),
  providerName: z.string().max(100, "提供商名称不能超过100个字符").optional(),
  modelAbility: z.array(z.string()).optional(),
  timeout: z.number().min(1000, "超时时间不能小于1000毫秒").max(300000, "超时时间不能超过300000毫秒").optional(),
  retries: z.number().min(0, "重试次数不能小于0").max(10, "重试次数不能超过10").optional(),
  sort: z.number().min(0, "排序不能小于0").max(9999, "排序不能超过9999").optional(),
  status: z.string().max(20).optional(),
});

export const configQuerySchema = z.object({
  providerId: z.string().optional(),
  status: z.string().optional(),
  keyword: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});
