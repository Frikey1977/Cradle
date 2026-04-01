/**
 * 模块管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createModuleSchema = z.object({
  name: z.string().min(1, "模块名称不能为空"),
  title: z.string().optional(),
  type: z.string().default("function"),
  path: z.string().default(""),
  component: z.string().default(""),
  pid: z.string().default("0"),
  status: z.string().default("enabled"),
  sort: z.number().default(0),
  meta: z.object({}).optional(),
  auth_code: z.string().optional(),
  icon: z.string().optional(),
});

export const updateModuleSchema = z.object({
  name: z.string().min(1, "模块名称不能为空").optional(),
  title: z.string().optional(),
  type: z.string().optional(),
  path: z.string().optional(),
  component: z.string().optional(),
  pid: z.string().optional(),
  status: z.string().optional(),
  sort: z.number().optional(),
  meta: z.object({}).optional(),
  auth_code: z.string().optional(),
  icon: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.string(),
  cascade: z.boolean().default(false),
});
