/**
 * 跟进记录 Zod 验证 Schema
 */

import { z } from "zod";

export const createFollowupSchema = z.object({
  customerId: z.string().min(1, "客户不能为空"),
  opportunityId: z.string().optional(),
  method: z.string().min(1, "跟进方式不能为空"),
  followTime: z.string().optional(),
  content: z.string().min(1, "跟进内容不能为空").max(2000, "跟进内容不能超过2000字符"),
  feedback: z.string().max(1000, "客户反馈不能超过1000字符").optional(),
  nextFollowDate: z.string().optional(),
  nextFollowContent: z.string().max(500, "下次跟进要点不能超过500字符").optional(),
  reminder: z.number().default(0),
  reminderTime: z.string().optional(),
  attachments: z.string().optional(),
});

export const updateFollowupSchema = z.object({
  customerId: z.string().optional(),
  opportunityId: z.string().optional(),
  method: z.string().optional(),
  followTime: z.string().optional(),
  content: z.string().min(1, "跟进内容不能为空").max(2000, "跟进内容不能超过2000字符").optional(),
  feedback: z.string().max(1000, "客户反馈不能超过1000字符").optional(),
  nextFollowDate: z.string().optional(),
  nextFollowContent: z.string().max(500, "下次跟进要点不能超过500字符").optional(),
  reminder: z.number().optional(),
  reminderTime: z.string().optional(),
  attachments: z.string().optional(),
});

export const followupQuerySchema = z.object({
  keyword: z.string().optional(),
  customerId: z.string().optional(),
  opportunityId: z.string().optional(),
  method: z.string().optional(),
  createBy: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(20),
});
