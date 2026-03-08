/**
 * LLM提供商管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createProviderSchema = z.object({
  name: z.string().min(1, "提供商名称不能为空"),
  title: z.string().optional(),
  ename: z.string().min(1, "英文名不能为空"),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sort: z.number().default(0),
  status: z.string().default("enabled"),
});

export const updateProviderSchema = z.object({
  name: z.string().min(1, "提供商名称不能为空").optional(),
  title: z.string().optional(),
  ename: z.string().min(1, "英文名不能为空").optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  sort: z.number().optional(),
  status: z.string().optional(),
});
