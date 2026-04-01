/**
 * 模块管理服务层
 */

import type {
  SystemModule,
  CreateModuleDto,
  UpdateModuleDto,
  UpdateStatusDto,
  ModuleQuery,
} from "./types.js";
import { generateUUID, buildTree } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";

/**
 * 解析 meta 字段
 */
function parseMeta(row: any): any {
  if (row.meta && typeof row.meta === "string") {
    try {
      return JSON.parse(row.meta);
    } catch {
      return {};
    }
  }
  return row.meta || {};
}

/**
 * 处理模块数据，解析 meta 字段
 */
function processModuleData(rows: any[]): SystemModule[] {
  return rows.map((row) => ({
    ...row,
    id: row.sid,
    meta: parseMeta(row),
  }));
}

/**
 * 获取模块列表
 */
export async function getModuleList(queryParams: ModuleQuery): Promise<SystemModule[]> {
  const { status, type, keyword } = queryParams;

  let sql = `SELECT * FROM t_modules WHERE deleted = 0`;
  const params: any[] = [];

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR title LIKE ? OR auth_code LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  const rows = await query<SystemModule[]>(sql, params);
  const processedRows = processModuleData(rows);
  return buildTree(processedRows, {
    idField: "sid",
    pidField: "pid",
    childrenField: "children",
  });
}

/**
 * 获取模块树
 */
export async function getModuleTree(): Promise<SystemModule[]> {
  const rows = await query<SystemModule[]>(
    `SELECT * FROM t_modules WHERE deleted = 0 ORDER BY sort ASC, create_time DESC`,
  );
  const processedRows = processModuleData(rows);
  return buildModuleTree(processedRows);
}

/**
 * 根据ID获取模块
 */
export async function getModuleById(id: string): Promise<SystemModule | null> {
  const rows = await query<SystemModule[]>(`SELECT * FROM t_modules WHERE sid = ? AND deleted = 0`, [
    id,
  ]);
  if (rows.length === 0) {
    return null;
  }
  const processedRows = processModuleData(rows);
  return processedRows[0];
}

/**
 * 检查模块名称是否存在
 */
export async function isModuleNameExists(name: string, excludeId?: string): Promise<boolean> {
  let sql = `SELECT sid FROM t_modules WHERE name = ? AND deleted = 0`;
  const params: any[] = [name];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 检查模块路径是否存在
 */
export async function isModulePathExists(path: string, excludeId?: string): Promise<boolean> {
  if (!path) return false;

  let sql = `SELECT sid FROM t_modules WHERE path = ? AND deleted = 0`;
  const params: any[] = [path];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建模块
 */
export async function createModule(data: CreateModuleDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_modules (sid, name, title, type, path, component, pid, status, sort, meta, auth_code, icon, deleted, create_time, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.title || data.name,
      data.type || "function",
      data.path || "",
      data.component || "",
      data.pid || "0",
      data.status ?? "enabled",
      data.sort ?? 0,
      data.meta ? JSON.stringify(data.meta) : null,
      data.auth_code || "",
      data.icon || "",
    ],
  );

  return sid;
}

/**
 * 更新模块
 */
export async function updateModule(id: string, data: UpdateModuleDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.path !== undefined) {
    updates.push("path = ?");
    params.push(data.path);
  }
  if (data.component !== undefined) {
    updates.push("component = ?");
    params.push(data.component);
  }
  if (data.pid !== undefined) {
    updates.push("pid = ?");
    params.push(data.pid || "0");
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.sort !== undefined) {
    updates.push("sort = ?");
    params.push(data.sort);
  }
  if (data.meta !== undefined) {
    updates.push("meta = ?");
    params.push(JSON.stringify(data.meta));
  }
  if (data.auth_code !== undefined) {
    updates.push("auth_code = ?");
    params.push(data.auth_code);
  }
  if (data.icon !== undefined) {
    updates.push("icon = ?");
    params.push(data.icon);
  }

  if (updates.length === 0) {
    throw new Error("没有需要更新的字段");
  }

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(`UPDATE t_modules SET ${updates.join(", ")} WHERE sid = ?`, params);
}

/**
 * 更新模块状态
 */
export async function updateModuleStatus(id: string, data: UpdateStatusDto): Promise<void> {
  const { status, cascade } = data;

  if (cascade) {
    await updateChildrenStatus(id, status);
  } else {
    await run(`UPDATE t_modules SET status = ?, timestamp = NOW() WHERE sid = ?`, [status, id]);
  }
}

/**
 * 删除模块
 */
export async function deleteModule(id: string): Promise<void> {
  await run(`UPDATE t_modules SET deleted = 1, timestamp = NOW() WHERE sid = ?`, [id]);
}

/**
 * 获取子模块列表
 */
export async function getModuleChildren(id: string): Promise<SystemModule[]> {
  const rows = await query<SystemModule[]>(
    `SELECT * FROM t_modules WHERE pid = ? AND deleted = 0 ORDER BY sort ASC`,
    [id],
  );
  return processModuleData(rows);
}

/**
 * 检查模块是否有子模块
 */
export async function hasChildren(id: string): Promise<boolean> {
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM t_modules WHERE pid = ? AND deleted = 0`,
    [id],
  );
  return rows[0].count > 0;
}

/**
 * 递归更新子模块状态
 */
async function updateChildrenStatus(parentId: string, status: string): Promise<void> {
  const children = await query<SystemModule[]>(
    `SELECT sid FROM t_modules WHERE pid = ? AND deleted = 0`,
    [parentId],
  );

  for (const child of children) {
    await run(`UPDATE t_modules SET status = ?, timestamp = NOW() WHERE sid = ?`, [
      status,
      child.sid,
    ]);
    await updateChildrenStatus(child.sid, status);
  }
}

/**
 * 构建模块树
 */
function buildModuleTree(items: SystemModule[]): SystemModule[] {
  const map = new Map<string, SystemModule>();
  const roots: SystemModule[] = [];

  for (const item of items) {
    map.set(item.sid, { ...item, children: [] });
  }

  for (const item of items) {
    const node = map.get(item.sid)!;
    if (item.pid === "0" || !item.pid) {
      roots.push(node);
    } else {
      const parent = map.get(item.pid);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}
