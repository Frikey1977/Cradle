/**
 * LLM实例管理 Zod 验证 Schema
 * 对应表: t_llm_instances
 */

import { z } from "zod";

// 自定义请求头 schema
const customHeadersSchema = z.record(z.string()).optional();

export const createInstanceSchema = z.object({
  name: z.string()
    .min(1, "实例名称不能为空")
    .max(200, "实例名称不能超过200个字符"),
  description: z.string()
    .max(1000, "描述不能超过1000个字符")
    .optional(),
  providerName: z.string()
    .min(1, "提供商不能为空")
    .max(100, "提供商不能超过100个字符"),
  configId: z.string()
    .min(1, "配置ID不能为空"),
  apiKey: z.string()
    .min(1, "API Key不能为空")
    .max(500, "API Key不能超过500个字符"),
  headers: customHeadersSchema,
  billingType: z.string()
    .max(50)
    .default("usage"),
  weight: z.number()
    .min(0, "权重不能小于0")
    .max(9999, "权重不能超过9999")
    .default(1),
  dailyQuota: z.number()
    .min(1, "每日配额不能小于1")
    .max(999999999999, "每日配额不能超过999999999999")
    .optional(),
  sort: z.number()
    .min(0, "排序不能小于0")
    .max(9999, "排序不能超过9999")
    .default(0),
  status: z.string()
    .max(20)
    .default("enabled"),
});

export const updateInstanceSchema = z.object({
  name: z.string()
    .min(1, "实例名称不能为空")
    .max(200, "实例名称不能超过200个字符")
    .optional(),
  description: z.string()
    .max(1000, "描述不能超过1000个字符")
    .optional(),
  providerName: z.string()
    .min(1, "提供商不能为空")
    .max(100, "提供商不能超过100个字符")
    .optional(),
  configId: z.string()
    .min(1, "配置ID不能为空")
    .optional(),
  apiKey: z.string()
    .min(1, "API Key不能为空")
    .max(500, "API Key不能超过500个字符")
    .optional(),
  headers: customHeadersSchema,
  billingType: z.string()
    .max(50)
    .optional(),
  weight: z.number()
    .min(0, "权重不能小于0")
    .max(9999, "权重不能超过9999")
    .optional(),
  dailyQuota: z.number()
    .min(1, "每日配额不能小于1")
    .max(999999999999, "每日配额不能超过999999999999")
    .optional(),
  sort: z.number()
    .min(0, "排序不能小于0")
    .max(9999, "排序不能超过9999")
    .optional(),
  status: z.string()
    .max(20)
    .optional(),
});

export const instanceQuerySchema = z.object({
  configId: z.string().optional(),
  status: z.string().optional(),
  billingType: z.string().optional(),
  keyword: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});
