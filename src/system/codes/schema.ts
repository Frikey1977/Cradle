/**
 * 代码管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createCodeSchema = z.object({
  name: z.string().min(1, "代码名称不能为空").max(200, "代码名称不能超过200字符"),
  title: z.string().max(200, "标题不能超过200字符").optional(),
  description: z.string().max(500, "描述不能超过500字符").optional(),
  icon: z.string().max(100, "图标不能超过100字符").optional(),
  color: z.string().max(20, "颜色不能超过20字符").nullable().optional(),
  parentId: z.string().optional(),
  type: z.string().max(50, "代码类型不能超过50字符").optional(),
  value: z.string().max(100, "代码值不能超过100字符").optional(),
  status: z.string().default("enabled"),
  sort: z.number().default(0),
  metadata: z.record(z.any()).optional(),
});

export const updateCodeSchema = z.object({
  name: z.string().min(1, "代码名称不能为空").max(200, "代码名称不能超过200字符").optional(),
  title: z.string().max(200, "标题不能超过200字符").optional(),
  description: z.string().max(500, "描述不能超过500字符").optional(),
  icon: z.string().max(100, "图标不能超过100字符").optional(),
  color: z.string().max(20, "颜色不能超过20字符").nullable().optional(),
  parentId: z.string().optional(),
  type: z.string().max(50, "代码类型不能超过50字符").optional(),
  value: z.string().max(100, "代码值不能超过100字符").optional(),
  status: z.string().optional(),
  sort: z.union([z.number(), z.string()]).transform((val) => (val ? Number(val) : 0)).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateStatusSchema = z.object({
  status: z.string(),
});
