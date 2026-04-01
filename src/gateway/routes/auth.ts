import type { FastifyInstance, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";

import {
  successResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
} from "../shared/response.js";
import type { JwtPayload } from "../shared/types.js";
import "../shared/types.js";
import { query, run } from "../../store/database.js";
import type { User, Role } from "../../store/types.js";

interface UserWithPermissions {
  permissions: string[];
}

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{
    Body: { username: string; password: string };
  }>("/login", async (request, reply) => {
    const { username, password } = request.body;

    if (!username || !password) {
      return validationErrorResponse(reply, "用户名和密码不能为空");
    }

    const users = await query<User[]>(
      "SELECT * FROM t_users WHERE username = ? AND deleted = 0",
      [username],
    );

    if (users.length === 0) {
      return errorResponse(reply, 401, "用户名或密码错误");
    }

    const user = users[0];
    if (user.status !== 'enabled') {
      return forbiddenResponse(reply, "用户已被禁用");
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return errorResponse(reply, 401, "用户名或密码错误");
    }

    await run("UPDATE t_users SET last_login_time = NOW() WHERE sid = ?", [
      user.sid,
    ]);

    // 直接从 user 中获取 employee_id
    const payload: JwtPayload = {
      sub: user.sid,
      username: user.username,
      employeeId: user.employee_id,
    };

    const token = fastify.jwt.sign(payload);

    return successResponse(reply, { accessToken: token }, "登录成功");
  });

  fastify.post(
    "/logout",
    { preHandler: [fastify.authenticate] },
    async (_request, reply) => {
      return successResponse(reply, null, "退出登录成功");
    },
  );

  fastify.post(
    "/refresh",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const payload = request.user as JwtPayload;
      const newToken = fastify.jwt.sign({
        sub: payload.sub,
        username: payload.username,
        employeeId: payload.employeeId,
      });

      return successResponse(reply, { accessToken: newToken }, "刷新成功");
    },
  );

  fastify.get(
    "/codes",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const payload = request.user as JwtPayload;
      const userWithRoles = await getUserWithRoles(payload.sub);

      if (!userWithRoles) {
        return errorResponse(reply, 404, "用户不存在");
      }

      return successResponse(reply, userWithRoles.permissions, "获取成功");
    },
  );

}

async function getUserWithRoles(
  sid: string,
): Promise<UserWithPermissions | null> {
  const users = await query<User[]>(
    "SELECT * FROM t_users WHERE sid = ? AND deleted = 0",
    [sid],
  );
  if (users.length === 0) return null;

  const roles = await query<Role[]>(
    `SELECT r.* FROM t_roles r 
     JOIN r_user_role ur ON r.sid = ur.role_id 
     WHERE ur.user_id = ?`,
    [sid],
  );

  // 从角色的 permission 字段获取权限 codes
  const permissions: string[] = [];
  for (const role of roles) {
    if (role.permission) {
      try {
        const permJson = JSON.parse(role.permission);
        if (permJson.actions && Array.isArray(permJson.actions)) {
          permissions.push(...permJson.actions);
        }
      } catch (e) {
        // 解析失败，跳过
      }
    }
  }

  // 去重
  const uniquePermissions = [...new Set(permissions)];

  return { permissions: uniquePermissions };
}
