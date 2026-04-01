/**
 * 用户管理服务层
 */

import bcrypt from "bcryptjs";
import type {
  SystemUser,
  UserWithEmployee,
  UserListResult,
  UserQuery,
  CreateUserDto,
  UpdateUserDto,
  UserRole,
  UserRolesResult,
} from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";

const SALT_ROUNDS = 10;

/**
 * 获取用户列表（关联员工信息）
 */
export async function getUserList(queryParams: UserQuery): Promise<UserListResult> {
  const page = Number(queryParams.page) || 1;
  const pageSize = Number(queryParams.pageSize) || 10;
  const { keyword } = queryParams;
  const offset = (page - 1) * pageSize;

  let whereClause = "WHERE u.deleted = 0";
  const params: (string | number)[] = [];

  if (keyword) {
    whereClause += " AND (u.username LIKE ? OR u.name LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  // 获取总数
  const countResult = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM t_users u ${whereClause}`,
    params,
  );
  const total = countResult[0]?.count || 0;

  // 获取列表数据
  const list = await query<UserWithEmployee[]>(
    `SELECT
      u.sid,
      u.username,
      u.password,
      u.name,
      u.avatar,
      u.status,
      u.home_path as homePath,
      u.last_login_time as lastLoginTime,
      u.last_login_ip as lastLoginIp,
      u.create_time as createTime,
      u.deleted,
      e.sid as employeeId,
      e.employee_no as employeeNo,
      d.name as departmentsName,
      p.name as positionName
    FROM t_users u
    LEFT JOIN t_employees e ON e.user_id = u.sid AND e.deleted = 0
    LEFT JOIN t_departments d ON d.sid = e.oid AND d.deleted = 0
    LEFT JOIN t_positions p ON p.sid = e.position_id AND p.deleted = 0
    ${whereClause}
    ORDER BY u.create_time DESC
    LIMIT ${pageSize} OFFSET ${offset}`,
    params,
  );

  return { list, total };
}

/**
 * 根据ID获取用户
 */
export async function getUserById(id: string): Promise<SystemUser | null> {
  const rows = await query<SystemUser[]>(
    `SELECT
      sid,
      username,
      password,
      name,
      avatar,
      status,
      home_path as homePath,
      last_login_time as lastLoginTime,
      last_login_ip as lastLoginIp,
      create_time as createTime,
      deleted
    FROM t_users
    WHERE sid = ? AND deleted = 0`,
    [id],
  );
  return rows[0] || null;
}

/**
 * 根据用户名获取用户
 */
export async function getUserByUsername(username: string): Promise<SystemUser | null> {
  const rows = await query<SystemUser[]>(
    `SELECT
      sid,
      username,
      password,
      name,
      avatar,
      status,
      home_path as homePath,
      last_login_time as lastLoginTime,
      last_login_ip as lastLoginIp,
      create_time as createTime,
      deleted
    FROM t_users
    WHERE username = ? AND deleted = 0`,
    [username],
  );
  return rows[0] || null;
}

/**
 * 检查用户名是否存在
 */
export async function isUsernameExists(username: string, excludeId?: string): Promise<boolean> {
  let sql = `SELECT COUNT(*) as count FROM t_users WHERE username = ? AND deleted = 0`;
  const params: string[] = [username];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const result = await query<{ count: number }[]>(sql, params);
  return result[0]?.count > 0;
}

/**
 * 创建用户
 */
export async function createUser(data: CreateUserDto): Promise<SystemUser> {
  const sid = generateUUID();
  const { username, name, password, employeeId, avatar, status = 'enabled', homePath } = data;

  // 加密密码
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  await run(
    `INSERT INTO t_users (sid, username, password, name, avatar, status, home_path, create_time, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
    [sid, username, hashedPassword, name, avatar || null, status, homePath || null],
  );

  // 如果有关联员工，更新员工的user_id
  if (employeeId) {
    await run(`UPDATE t_employees SET user_id = ? WHERE sid = ?`, [sid, employeeId]);
  }

  const user = await getUserById(sid);
  if (!user) {
    throw new Error("创建用户失败");
  }
  return user;
}

/**
 * 更新用户
 */
export async function updateUser(id: string, data: UpdateUserDto): Promise<SystemUser> {
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    values.push(data.name);
  }
  if (data.avatar !== undefined) {
    updates.push("avatar = ?");
    values.push(data.avatar);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    values.push(data.status);
  }
  if (data.homePath !== undefined) {
    updates.push("home_path = ?");
    values.push(data.homePath);
  }

  if (updates.length === 0) {
    const user = await getUserById(id);
    if (!user) {
      throw new Error("用户不存在");
    }
    return user;
  }

  values.push(id);
  await run(`UPDATE t_users SET ${updates.join(", ")} WHERE sid = ?`, values);

  const user = await getUserById(id);
  if (!user) {
    throw new Error("用户不存在");
  }
  return user;
}

/**
 * 重置密码
 */
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await run(`UPDATE t_users SET password = ? WHERE sid = ?`, [hashedPassword, id]);
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(id: string, status: 'enabled' | 'disabled'): Promise<SystemUser> {
  await run(`UPDATE t_users SET status = ? WHERE sid = ?`, [status, id]);

  const user = await getUserById(id);
  if (!user) {
    throw new Error("用户不存在");
  }
  return user;
}

/**
 * 删除用户（软删除）
 */
export async function deleteUser(id: string): Promise<void> {
  await run(`UPDATE t_users SET deleted = 1 WHERE sid = ?`, [id]);
}

/**
 * 获取用户的角色列表
 */
export async function getUserRoles(userId: string): Promise<UserRolesResult | null> {
  // 先获取用户信息
  const user = await getUserById(userId);
  if (!user) {
    return null;
  }

  // 获取角色列表
  const roles = await query<UserRole[]>(
    `SELECT
      r.sid as id,
      r.name,
      r.status,
      r.permissions
    FROM r_user_role ur
    JOIN t_roles r ON r.sid = ur.role_id AND r.deleted = 0
    WHERE ur.user_id = ?`,
    [userId],
  );

  return {
    userId,
    username: user.username,
    roles: roles.map((role) => ({
      ...role,
      permissions: role.permissions ? JSON.parse(role.permissions as unknown as string) : [],
    })),
  };
}

/**
 * 分配用户角色
 */
export async function assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
  // 删除现有角色关联
  await run(`DELETE FROM r_user_role WHERE user_id = ?`, [userId]);

  // 插入新角色关联
  for (const roleId of roleIds) {
    await run(`INSERT INTO r_user_role (user_id, role_id) VALUES (?, ?)`, [userId, roleId]);
  }
}

/**
 * 获取所有可用角色
 */
export async function getAllRoles(): Promise<UserRole[]> {
  const roles = await query<UserRole[]>(
    `SELECT
      sid as id,
      name,
      status,
      permissions
    FROM t_roles
    WHERE deleted = 0 AND status = 1
    ORDER BY create_time DESC`,
  );

  return roles.map((role) => ({
    ...role,
    permissions: role.permissions ? JSON.parse(role.permissions as unknown as string) : [],
  }));
}

/**
 * 检查角色是否存在且启用
 */
export async function validateRoles(
  roleIds: string[],
): Promise<{ valid: boolean; message?: string }> {
  for (const roleId of roleIds) {
    const rows = await query<{ sid: string; name: string; status: number }[]>(
      `SELECT sid, name, status FROM t_roles WHERE sid = ? AND deleted = 0`,
      [roleId],
    );

    if (rows.length === 0) {
      return { valid: false, message: `角色${roleId}不存在` };
    }

    if (rows[0].status === 0) {
      return { valid: false, message: `角色${rows[0].name}已停用，无法分配` };
    }
  }

  return { valid: true };
}
