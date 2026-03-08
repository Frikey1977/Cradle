/**
 * 系统技能 Zod 验证 Schema
 * 对应设计文档: design/system/database/t_skills.md
 */

import { z } from "zod";

export const createSkillSchema = z.object({
  name: z.string().min(1, "技能名称不能为空").max(200, "技能名称不能超过200个字符"),
  title: z.string().max(200, "翻译标签不能超过200个字符").optional(),
  slug: z
    .string()
    .min(1, "技能标识符不能为空")
    .max(100, "技能标识符不能超过100个字符")
    .regex(/^[a-z0-9_-]+$/, "标识符只能包含小写字母、数字、下划线和横线"),
  version: z.string().max(20, "版本号不能超过20个字符").default("1.0.0"),
  description: z.string().optional(),
  sourceType: z.string().max(50, "来源类型不能超过50个字符").default("builtin"),
  sourceUrl: z.string().max(500, "来源地址不能超过500个字符").optional(),
  metadata: z.record(z.unknown()).optional(),
  configSchema: z.record(z.unknown()).optional(),
  defaultConfig: z.record(z.unknown()).optional(),
  type: z.enum(["catalog", "skill"]).default("skill"),
  parentId: z.string().uuid("父节点ID必须是有效的UUID").nullable().optional(),
  sort: z.number().int().min(0).default(0),
  status: z.string().max(50, "状态不能超过50个字符").default("enabled"),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1, "技能名称不能为空").max(200, "技能名称不能超过200个字符").optional(),
  title: z.string().max(200, "翻译标签不能超过200个字符").optional(),
  slug: z
    .string()
    .min(1, "技能标识符不能为空")
    .max(100, "技能标识符不能超过100个字符")
    .regex(/^[a-z0-9_-]+$/, "标识符只能包含小写字母、数字、下划线和横线")
    .optional(),
  version: z.string().max(20, "版本号不能超过20个字符").optional(),
  description: z.string().optional(),
  sourceType: z.string().max(50, "来源类型不能超过50个字符").optional(),
  sourceUrl: z.string().max(500, "来源地址不能超过500个字符").optional(),
  metadata: z.record(z.unknown()).optional(),
  configSchema: z.record(z.unknown()).optional(),
  defaultConfig: z.record(z.unknown()).optional(),
  type: z.enum(["catalog", "skill"]).optional(),
  parentId: z.string().uuid("父节点ID必须是有效的UUID").nullable().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.string().max(50, "状态不能超过50个字符").optional(),
});

export const skillQuerySchema = z.object({
  keyword: z.string().optional(),
  sourceType: z.string().optional(),
  status: z.string().optional(),
  type: z.enum(["catalog", "skill"]).optional(),
  parentId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const skillTreeQuerySchema = z.object({
  keyword: z.string().optional(),
  sourceType: z.string().optional(),
  status: z.string().optional(),
});

export const slugExistsSchema = z.object({
  slug: z.string().min(1, "标识符不能为空"),
  sid: z.string().optional(),
});
