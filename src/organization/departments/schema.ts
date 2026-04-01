/**
 * 组织架构 Zod 验证 Schema
 */

import { z } from "zod";

export const createOrgSchema = z.object({
  name: z.string().min(1, "组织名称不能为空"),
  eName: z.string().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
  code: z.string().min(1, "组织编码不能为空"),
  type: z.string().min(1, "组织类型不能为空"),
  parentId: z.string().optional(),
  sort: z.number().default(0),
  leaderId: z.string().optional(),
  description: z.string().optional(),
  culture: z.string().optional(), // 企业文化描述，纯文本字段
  status: z.string().default("enabled"),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1, "组织名称不能为空").optional(),
  eName: z.string().optional(),
  title: z.string().optional(),
  icon: z.string().optional(),
  code: z.string().min(1, "组织编码不能为空").optional(),
  type: z.string().optional(),
  parentId: z.string().optional(),
  sort: z.number().optional(),
  leaderId: z.string().optional(),
  description: z.string().optional(),
  culture: z.string().optional(), // 企业文化描述，纯文本字段
  status: z.string().optional(),
});

export const moveOrgSchema = z.object({
  parentId: z.string(),
});
