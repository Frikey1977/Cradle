import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getUserList,
  getUserById,
  resetPassword,
  updateUserStatus,
  deleteUser,
  getUserRoles,
  assignUserRoles,
  getAllRoles,
  validateRoles,
} from "../../system/users/service.js";
import {
  resetPasswordSchema,
  updateStatusSchema,
  assignRolesSchema,
} from "../../system/users/schema.js";
import type {
  UserQuery,
  ResetPasswordDto,
  UpdateStatusDto,
  AssignRolesDto,
} from "../../system/users/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function userRoutes(fastify: FastifyInstance) {
  // 获取当前登录用户信息
  fastify.get(
    "/info",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const payload = request.user as { sub: string; username: string };
      const user = await getUserById(payload.sub);

      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      return successResponse(reply, user);
    },
  );

  // 获取用户列表
  fastify.get<{ Querystring: UserQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: UserQuery }>, reply: FastifyReply) => {
      const result = await getUserList(request.query);
      return successResponse(reply, result);
    },
  );

  // 获取用户详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const user = await getUserById(id);

      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      return successResponse(reply, user);
    },
  );

  // 重置密码
  fastify.post<{ Params: { id: string }; Body: ResetPasswordDto }>(
    "/:id/reset-password",
    async (request: FastifyRequest<{ Params: { id: string }; Body: ResetPasswordDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { newPassword } = request.body;

      // 验证数据
      const result = resetPasswordSchema.safeParse({ newPassword });
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查用户是否存在
      const user = await getUserById(id);
      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      await resetPassword(id, newPassword);
      return successResponse(reply, null, "密码重置成功");
    },
  );

  // 更新用户状态
  fastify.put<{ Params: { id: string }; Body: UpdateStatusDto }>(
    "/:id/status",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateStatusDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { status } = request.body;

      // 验证数据
      const result = updateStatusSchema.safeParse({ status });
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查用户是否存在
      const user = await getUserById(id);
      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      const updatedUser = await updateUserStatus(id, status);
      return successResponse(reply, updatedUser, "状态更新成功");
    },
  );

  // 删除用户
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查用户是否存在
      const user = await getUserById(id);
      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      await deleteUser(id);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 获取用户角色
  fastify.get<{ Params: { id: string } }>(
    "/:id/roles",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查用户是否存在
      const user = await getUserById(id);
      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      const result = await getUserRoles(id);
      return successResponse(reply, result);
    },
  );

  // 分配用户角色
  fastify.put<{ Params: { id: string }; Body: AssignRolesDto }>(
    "/:id/roles",
    async (request: FastifyRequest<{ Params: { id: string }; Body: AssignRolesDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { roleIds } = request.body;

      // 验证数据
      const result = assignRolesSchema.safeParse({ roleIds });
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查用户是否存在
      const user = await getUserById(id);
      if (!user) {
        return notFoundResponse(reply, "用户不存在");
      }

      // 去重
      const uniqueRoleIds = [...new Set(roleIds)];

      // 验证角色有效性
      if (uniqueRoleIds.length > 0) {
        const validation = await validateRoles(uniqueRoleIds);
        if (!validation.valid) {
          return validationErrorResponse(reply, validation.message || "角色验证失败");
        }
      }

      await assignUserRoles(id, uniqueRoleIds);
      return successResponse(reply, { userId: id, assignedRoles: uniqueRoleIds }, "角色分配成功");
    },
  );

  // 获取所有可用角色（用于分配角色时选择）
  fastify.get(
    "/roles/all",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const roles = await getAllRoles();
      return successResponse(reply, roles);
    },
  );
}
