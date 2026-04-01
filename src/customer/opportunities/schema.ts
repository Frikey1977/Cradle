/**
 * 商机管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createOpportunitySchema = z.object({
  customerId: z.string().min(1, "客户不能为空"),
  name: z.string().min(1, "商机名称不能为空").max(200, "商机名称不能超过200字符"),
  source: z.string().optional(),
  stage: z.string().default("initial"),
  probability: z.number().min(0).max(100).default(10),
  amount: z.number().min(0).default(0),
  expectedCloseDate: z.string().optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.string().default("open"),
});

export const updateOpportunitySchema = z.object({
  customerId: z.string().optional(),
  name: z.string().min(1, "商机名称不能为空").max(200, "商机名称不能超过200字符").optional(),
  source: z.string().optional(),
  stage: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  amount: z.number().min(0).optional(),
  expectedCloseDate: z.string().optional(),
  actualCloseDate: z.string().optional(),
  closeReason: z.string().max(500, "关闭原因不能超过500字符").optional(),
  description: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.string().optional(),
});

export const opportunityQuerySchema = z.object({
  keyword: z.string().optional(),
  customerId: z.string().optional(),
  stage: z.string().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
  status: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});
