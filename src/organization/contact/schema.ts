/**
 * 联系人管理 Zod 验证 Schema
 * 对应设计文档: design/organization/database/t_contacts.md
 */

import { z } from "zod";

export const ContactTypeEnum = z.enum(["employee", "customer", "partner", "visitor"]);
export const ContactStatusEnum = z.enum(["enabled", "disabled"]);

export const createContactSchema = z.object({
  type: ContactTypeEnum,
  sourceId: z.string().optional(),
  profile: z.record(z.any()).optional(),
  status: ContactStatusEnum.default("enabled"),
  description: z.string().max(500, "描述不能超过500字符").optional(),
});

export const updateContactSchema = z.object({
  type: ContactTypeEnum.optional(),
  sourceId: z.string().optional(),
  profile: z.record(z.any()).optional(),
  status: ContactStatusEnum.optional(),
  description: z.string().max(500, "描述不能超过500字符").optional(),
});
