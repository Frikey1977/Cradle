/**
 * 用户管理验证Schema
 */

import { z } from "zod";

// 重置密码Schema
export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(6, "密码长度不能少于6位")
    .max(50, "密码长度不能超过50位"),
});

// 更新状态Schema
export const updateStatusSchema = z.object({
  status: z.enum(['enabled', 'disabled'], {
    message: "状态值必须是 'enabled' 或 'disabled'",
  }),
});

// 分配角色Schema
export const assignRolesSchema = z.object({
  roleIds: z.array(z.string()),
});

// 创建用户Schema
export const createUserSchema = z.object({
  username: z
    .string()
    .min(1, "用户名不能为空")
    .max(50, "用户名不能超过50字符"),
  name: z.string().min(1, "姓名不能为空").max(100, "姓名不能超过100字符"),
  password: z
    .string()
    .min(6, "密码长度不能少于6位")
    .max(50, "密码长度不能超过50位"),
  employeeId: z.string().optional(),
  avatar: z.string().optional(),
  status: z.enum(['enabled', 'disabled']).default('enabled'),
  homePath: z.string().optional(),
});

// 更新用户Schema
export const updateUserSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100, "姓名不能超过100字符").optional(),
  avatar: z.string().optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
  homePath: z.string().optional(),
});
