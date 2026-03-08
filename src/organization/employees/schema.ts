/**
 * 员工管理 Zod 验证 Schema
 */

import { z } from "zod";

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "员工姓名不能为空"),
  employeeNo: z.string().optional(),
  orgId: z.string().optional(),
  positionId: z.string().optional(),
  type: z.string().default("full-time"),
  location: z.string().optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  phone: z.string().optional(),
  hireDate: z.string().optional(),
  status: z.string().default("active"),
  description: z.string().optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1, "员工姓名不能为空").optional(),
  employeeNo: z.string().optional(),
  orgId: z.string().optional(),
  positionId: z.string().optional(),
  type: z.string().optional(),
  location: z.string().optional(),
  email: z.string().email("邮箱格式不正确").optional(),
  phone: z.string().optional(),
  hireDate: z.string().optional(),
  status: z.string().optional(),
  description: z.string().optional(),
});
