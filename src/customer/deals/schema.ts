/**
 * 成交管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createDealSchema = z.object({
  customerId: z.string().min(1, "客户不能为空"),
  opportunityId: z.string().optional(),
  name: z.string().min(1, "成交名称不能为空").max(200, "成交名称不能超过200字符"),
  amount: z.number().min(0, "成交金额不能为负数").default(0),
  paymentMethod: z.string().optional(),
  signDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  status: z.string().default("pending"),
  remark: z.string().optional(),
  ownerId: z.string().optional(),
});

export const updateDealSchema = z.object({
  customerId: z.string().optional(),
  opportunityId: z.string().optional(),
  name: z.string().min(1, "成交名称不能为空").max(200, "成交名称不能超过200字符").optional(),
  amount: z.number().min(0, "成交金额不能为负数").optional(),
  paidAmount: z.number().min(0, "已回款金额不能为负数").optional(),
  paymentMethod: z.string().optional(),
  signDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  status: z.string().optional(),
  contractFiles: z.string().optional(),
  remark: z.string().optional(),
  ownerId: z.string().optional(),
});

export const dealQuerySchema = z.object({
  keyword: z.string().optional(),
  customerId: z.string().optional(),
  opportunityId: z.string().optional(),
  status: z.string().optional(),
  ownerId: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});
