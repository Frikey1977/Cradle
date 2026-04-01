import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { successResponse, errorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";
import { query, run } from "../../store/database.js";
import type { Role } from "../../store/types.js";
import { generateUUID } from "../../shared/utils.js";

// 权限JSON结构
interface PermissionJson {
  modules?: string[];
  actions?: string[];
  permissions?: string[];
}

// 前端角色数据结构
interface RoleResponse {
  id: string;
  name: string;
  e_name?: string;
  title?: string;
  description?: string;
  permission?: PermissionJson;
  status: string;
  sort?: number;
  createTime?: Date;
}

interface CreateRoleDto {
  name: string;
  e_name?: string;
  title?: string;
  description?: string;
  permission?: PermissionJson;
  status?: 'enabled' | 'disabled';
  sort?: number;
}

interface UpdateRoleDto {
  name?: string;
  e_name?: string;
  title?: string;
  description?: string;
  permission?: PermissionJson;
  status?: 'enabled' | 'disabled';
  sort?: number;
}

// 将数据库Role转换为前端响应格式
function toRoleResponse(role: Role): RoleResponse {
  let permission: PermissionJson | undefined;
  if (role.permission) {
    try {
      permission = JSON.parse(role.permission);
    } catch {
      permission = undefined;
    }
  }

  return {
    id: role.sid,
    name: role.name,
    e_name: role.e_name,
    title: role.title,
    description: role.description,
    permission,
    status: role.status,
    sort: role.sort,
    createTime: role.create_time,
  };
}

export default async function roleRoutes(fastify: FastifyInstance) {
  // 获取角色列表
  fastify.get("/list", async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await query<Role[]>(
      `SELECT sid, name, e_name, title, description, permission, status, sort, create_time
       FROM t_roles 
       WHERE deleted = 0 
       ORDER BY sort ASC, create_time DESC`,
    );

    const roles = rows.map(toRoleResponse);
    return successResponse(reply, roles, "获取成功");
  });

  // 获取角色详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      
      const rows = await query<Role[]>(
        `SELECT * FROM t_roles WHERE sid = ? AND deleted = 0`,
        [id],
      );

      if (rows.length === 0) {
        return notFoundResponse(reply, "角色不存在");
      }

      return successResponse(reply, toRoleResponse(rows[0]), "获取成功");
    },
  );

  // 创建角色
  fastify.post<{ Body: CreateRoleDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateRoleDto }>, reply: FastifyReply) => {
      const { name, e_name, title, description, permission, status, sort } = request.body;
      
      if (!name) {
        return errorResponse(reply, 400, "角色名称不能为空");
      }

      const sid = generateUUID();
      const permissionJson = permission ? JSON.stringify(permission) : null;
      
      await run(
        `INSERT INTO t_roles (sid, name, e_name, title, description, permission, status, sort, deleted, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
        [sid, name, e_name || null, title || null, description || null, permissionJson, status || 'enabled', sort || 0],
      );

      return successResponse(reply, { id: sid }, "创建成功");
    },
  );

  // 更新角色
  fastify.put<{ Params: { id: string }; Body: UpdateRoleDto }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateRoleDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { name, e_name, title, description, permission, status, sort } = request.body;

      // 检查角色是否存在
      const existing = await query<Role[]>(
        `SELECT sid FROM t_roles WHERE sid = ? AND deleted = 0`,
        [id],
      );
      if (existing.length === 0) {
        return notFoundResponse(reply, "角色不存在");
      }

      // 构建更新字段
      const updates: string[] = [];
      const params: any[] = [];

      if (name !== undefined) {
        updates.push("name = ?");
        params.push(name);
      }
      if (e_name !== undefined) {
        updates.push("e_name = ?");
        params.push(e_name);
      }
      if (title !== undefined) {
        updates.push("title = ?");
        params.push(title);
      }
      if (description !== undefined) {
        updates.push("description = ?");
        params.push(description);
      }
      if (permission !== undefined) {
        updates.push("permission = ?");
        params.push(JSON.stringify(permission));
      }
      if (status !== undefined) {
        updates.push("status = ?");
        params.push(status);
      }
      if (sort !== undefined) {
        updates.push("sort = ?");
        params.push(sort);
      }

      if (updates.length > 0) {
        params.push(id);
        await run(
          `UPDATE t_roles SET ${updates.join(", ")} WHERE sid = ?`,
          params,
        );
      }

      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除角色
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查角色是否存在
      const existing = await query<Role[]>(
        `SELECT sid FROM t_roles WHERE sid = ? AND deleted = 0`,
        [id],
      );
      if (existing.length === 0) {
        return notFoundResponse(reply, "角色不存在");
      }

      // 软删除角色
      await run(
        `UPDATE t_roles SET deleted = 1 WHERE sid = ?`,
        [id],
      );

      return successResponse(reply, null, "删除成功");
    },
  );

  // 修改角色状态
  fastify.put<{ Params: { id: string }; Body: { status: string } }>(
    "/:id/status",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { status: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { status } = request.body;

      // 检查角色是否存在
      const existing = await query<Role[]>(
        `SELECT sid FROM t_roles WHERE sid = ? AND deleted = 0`,
        [id],
      );
      if (existing.length === 0) {
        return notFoundResponse(reply, "角色不存在");
      }

      await run(
        `UPDATE t_roles SET status = ? WHERE sid = ?`,
        [status, id],
      );

      return successResponse(reply, null, "状态更新成功");
    },
  );
}
