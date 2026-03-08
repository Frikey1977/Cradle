/**
 * Agent 管理 Zod 验证 Schema
 */

import { z } from "zod";

export const serviceModeEnum = z.enum(["exclusive", "shared", "public", "department"]);

export const agentConfigSchema = z.object({
  model: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    systemPrompt: z.string().optional(),
  }).optional(),
  runtime: z.object({
    identity: z.object({
      emoji: z.string().optional(),
      displayName: z.string().optional(),
    }).optional(),
    behavior: z.object({
      humanDelay: z.object({
        enabled: z.boolean().optional(),
        minSeconds: z.number().optional(),
        maxSeconds: z.number().optional(),
      }).optional(),
    }).optional(),
  }).optional(),
}).optional();

export const agentHeartbeatSchema = z.object({
  enabled: z.boolean().optional(),
  interval: z.string().optional(),
  lastRun: z.string().optional(),
  config: z.record(z.any()).optional(),
}).optional();

export const agentProfileSchema = z.record(z.any()).optional();

export const createAgentSchema = z.object({
  name: z.string().min(1, "Agent 名称不能为空").max(200, "Agent 名称不能超过200字符"),
  eName: z.string().max(200, "Agent 英文名称不能超过200字符").optional(),
  title: z.string().max(200, "多语言标签不能超过200字符").optional(),
  agentNo: z.string().min(1, "Agent 编号不能为空").max(100, "Agent 编号不能超过100字符"),
  description: z.string().optional(),
  oid: z.string().min(1, "所属组织不能为空"),
  positionId: z.string().optional(),
  mode: serviceModeEnum.default("exclusive"),
  avatar: z.string().max(500, "头像URL不能超过500字符").optional(),
  config: agentConfigSchema,
  profile: agentProfileSchema,
  soul: z.string().optional(), // 灵魂/人格描述，纯文本字段
  heartbeat: agentHeartbeatSchema,
  status: z.string().default("enabled"),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1, "Agent 名称不能为空").max(200, "Agent 名称不能超过200字符").optional(),
  eName: z.string().max(200, "Agent 英文名称不能超过200字符").optional(),
  title: z.string().max(200, "多语言标签不能超过200字符").optional(),
  agentNo: z.string().min(1, "Agent 编号不能为空").max(100, "Agent 编号不能超过100字符").optional(),
  description: z.string().optional(),
  oid: z.string().optional(),
  positionId: z.string().optional(),
  mode: serviceModeEnum.optional(),
  avatar: z.string().max(500, "头像URL不能超过500字符").optional(),
  config: agentConfigSchema,
  profile: agentProfileSchema,
  soul: z.string().optional(), // 灵魂/人格描述，纯文本字段
  heartbeat: agentHeartbeatSchema,
  status: z.string().optional(),
});

export const bindUserSchema = z.object({
  agentId: z.string().min(1, "Agent ID 不能为空"),
  userId: z.string().min(1, "用户 ID 不能为空"),
});
