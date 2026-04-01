/**
 * 客户管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createCustomerSchema = z.object({
  name: z.string().min(1, "客户名称不能为空").max(200, "客户名称不能超过200字符"),
  type: z.string().min(1, "客户类型不能为空"),
  level: z.string().optional(),
  industry: z.string().max(100, "行业不能超过100字符").optional(),
  scale: z.string().max(50, "规模不能超过50字符").optional(),
  region: z.string().max(100, "地区不能超过100字符").optional(),
  address: z.string().max(500, "地址不能超过500字符").optional(),
  primaryContactName: z.string().max(100, "联系人姓名不能超过100字符").optional(),
  primaryContactPhone: z.string().max(50, "联系人电话不能超过50字符").optional(),
  primaryContactEmail: z.string().max(200, "联系人邮箱不能超过200字符").optional(),
  website: z.string().max(255, "网站不能超过255字符").optional(),
  ownerId: z.string().optional(),
  remark: z.string().optional(),
  description: z.string().max(500, "描述不能超过500字符").optional(),
  status: z.string().default("enabled"),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const customerQuerySchema = z.object({
  keyword: z.string().optional(),
  type: z.string().optional(),
  level: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});
