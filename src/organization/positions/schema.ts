/**
 * 岗位管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createPositionSchema = z.object({
  name: z.string().min(1, "岗位名称不能为空").max(200, "岗位名称最多200个字符"),
  eName: z.string().max(200, "岗位英文名称最多200个字符").optional(),
  title: z.string().max(200, "标题最多200个字符").optional(),
  code: z.string().min(1, "岗位编码不能为空").max(100, "岗位编码最多100个字符"),
  type: z.string().min(1, "类型不能为空").max(50, "类型最多50个字符"),
  oid: z.string().min(1, "所属组织不能为空"),
  level: z.string().min(1, "层级不能为空"),
  description: z.string().max(500, "描述最多500个字符").optional(),
  dataScope: z.string().optional(),
  status: z.string().optional(),
});

export const updatePositionSchema = z.object({
  name: z.string().min(1, "岗位名称不能为空").max(200, "岗位名称最多200个字符").optional(),
  eName: z.string().max(200, "岗位英文名称最多200个字符").optional(),
  title: z.string().max(200, "标题最多200个字符").optional(),
  code: z.string().min(1, "岗位编码不能为空").max(100, "岗位编码最多100个字符").optional(),
  type: z.string().max(50, "类型最多50个字符").optional(),
  oid: z.string().min(1, "所属组织不能为空").optional(),
  level: z.string().optional(),
  description: z.string().max(500, "描述最多500个字符").optional(),
  dataScope: z.string().optional(),
  status: z.string().optional(),
});
