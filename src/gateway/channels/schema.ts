/**
 * 通道管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createChannelSchema = z.object({
  name: z.string().min(1, "通道名称不能为空").max(100, "通道名称不能超过100字符"),
  description: z.string().max(500, "描述不能超过500字符").optional(),
  config: z.record(z.any()).default({}),
  clientConfig: z.record(z.any()).optional(),
  status: z.string().default("disabled"),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1, "通道名称不能为空").max(100, "通道名称不能超过100字符").optional(),
  description: z.string().max(500, "描述不能超过500字符").optional(),
  config: z.record(z.any()).optional(),
  clientConfig: z.record(z.any()).optional(),
  status: z.string().optional(),
  lastError: z.string().max(500, "错误信息不能超过500字符").nullable().optional(),
  lastConnectedAt: z.date().optional(),
});

export const updateStatusSchema = z.object({
  status: z.string(),
});
