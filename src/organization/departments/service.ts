/**
 * 组织架构服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID, buildTree } from "../../shared/utils.js";
import { syncTranslation } from "../../system/translation/service.js";
import type {
  Organization,
  CreateOrgDto,
  UpdateOrgDto,
  MoveOrgDto,
  OrgQuery,
} from "./types.js";

/**
 * 检查并同步翻译
 * @param title 翻译键
 * @param name 中文翻译值
 * @param eName 英文翻译值（e_name字段）
 */
function checkAndSyncTranslation(
  title: string | null | undefined,
  name?: string,
  eName?: string,
): void {
  console.log(
    "[checkAndSyncTranslation] Called with title:",
    title,
    "name:",
    name,
    "eName:",
    eName,
  );
  if (!title) {
    console.log("[checkAndSyncTranslation] Title is empty, skipping");
    return;
  }

  // 检查是否是翻译键格式（包含点号，且以常见命名空间开头）
  const validNamespaces = ["system", "organization", "page", "ui", "demos", "examples", "code"];
  const parts = title.split(".");
  console.log(
    "[checkAndSyncTranslation] Parts:",
    parts,
    "First part:",
    parts[0],
    "Valid:",
    validNamespaces.includes(parts[0]),
  );
  if (parts.length >= 2 && validNamespaces.includes(parts[0])) {
    console.log("[checkAndSyncTranslation] Calling syncTranslation...");
    try {
      // 同步翻译：中文用 name，英文用 e_name
      const customValues = {
        zh: name || "",
        en: eName || "",
      };
      const result = syncTranslation(title, customValues);
      console.log("[checkAndSyncTranslation] syncTranslation result:", result);
    } catch (error) {
      console.error("[checkAndSyncTranslation] Failed to sync translation:", error);
    }
  } else {
    console.log("[checkAndSyncTranslation] Not a valid translation key format");
  }
}

/**
 * 获取组织架构树
 */
export async function getOrgTree(queryParams: OrgQuery): Promise<Organization[]> {
  const { type, status } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }

  if (status !== undefined) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  const rows = await query<Organization[]>(
    `SELECT
      sid,
      name,
      e_name as eName,
      title,
      icon,
      code,
      type,
      parent_id as parentId,
      path,
      sort,
      leader_id as leaderId,
      description,
      culture,
      status,
      create_time as createTime
    FROM t_departments
    ${whereClause}
    ORDER BY sort ASC, create_time ASC`,
    params,
  );

  return buildTree(rows, {
    idField: "sid",
    pidField: "parentId",
    childrenField: "children",
  });
}

/**
 * 获取组织架构列表（扁平结构）
 */
export async function getOrgList(queryParams: OrgQuery): Promise<Organization[]> {
  const { type, status } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }

  if (status !== undefined) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  return await query<Organization[]>(
    `SELECT
      sid,
      name,
      e_name as eName,
      title,
      icon,
      code,
      type,
      parent_id as parentId,
      path,
      sort,
      leader_id as leaderId,
      description,
      culture,
      status,
      create_time as createTime
    FROM t_departments
    ${whereClause}
    ORDER BY sort ASC, create_time ASC`,
    params,
  );
}

/**
 * 根据ID获取组织架构
 */
export async function getOrgById(sid: string): Promise<Organization | null> {
  const rows = await query<Organization[]>(
    `SELECT
      sid,
      name,
      e_name as eName,
      title,
      icon,
      code,
      type,
      parent_id as parentId,
      path,
      sort,
      leader_id as leaderId,
      description,
      culture,
      status,
      create_time as createTime
    FROM t_departments
    WHERE sid = ? AND deleted = 0`,
    [sid],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查组织编码是否存在
 */
export async function isOrgCodeExists(code: string, excludeSid?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_departments WHERE code = ? AND deleted = 0";
  const params: any[] = [code];

  if (excludeSid) {
    sql += " AND sid != ?";
    params.push(excludeSid);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 创建组织架构
 */
export async function createOrg(data: CreateOrgDto): Promise<string> {
  const sid = generateUUID();

  // 计算 path
  let path = "/";

  if (data.parentId) {
    const parentRows = await query<[{ path: string }]>(
      "SELECT path FROM t_departments WHERE sid = ? AND deleted = 0",
      [data.parentId],
    );
    if (parentRows.length > 0) {
      const parent = parentRows[0];
      path = `${parent.path}${data.parentId}/`;
    }
  }

  await run(
    `INSERT INTO t_departments (
      sid, name, e_name, title, icon, code, type, parent_id, path, sort,
      leader_id, description, culture, status, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.eName || null,
      data.title || null,
      data.icon || null,
      data.code,
      data.type,
      data.parentId || null,
      path,
      data.sort ?? 0,
      data.leaderId || null,
      data.description || null,
      data.culture || null,
      data.status ?? "enabled",
    ],
  );

  // 同步翻译：中文用 name，英文用 e_name
  checkAndSyncTranslation(data.title, data.name, data.eName);

  return sid;
}

/**
 * 更新组织架构
 */
export async function updateOrg(sid: string, data: UpdateOrgDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.eName !== undefined) {
    updates.push("e_name = ?");
    params.push(data.eName || null);
  }
  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title || null);
  }
  if (data.icon !== undefined) {
    updates.push("icon = ?");
    params.push(data.icon || null);
  }
  if (data.code !== undefined) {
    updates.push("code = ?");
    params.push(data.code);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.parentId !== undefined) {
    updates.push("parent_id = ?");
    params.push(data.parentId || null);
  }
  if (data.sort !== undefined) {
    updates.push("sort = ?");
    params.push(data.sort);
  }
  if (data.leaderId !== undefined) {
    updates.push("leader_id = ?");
    params.push(data.leaderId || null);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.culture !== undefined) {
    updates.push("culture = ?");
    params.push(data.culture || null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) {
    throw new Error("没有需要更新的字段");
  }

  updates.push("timestamp = NOW()");
  params.push(sid);

  await run(`UPDATE t_departments SET ${updates.join(", ")} WHERE sid = ?`, params);

  // 如果更新了 title，同步翻译
  if (data.title !== undefined) {
    // 获取 name 和 e_name：优先使用传入的值，否则从数据库获取
    const org = await getOrgById(sid);
    const name = data.name ?? org?.name ?? "";
    const eName = data.eName ?? org?.eName ?? "";
    checkAndSyncTranslation(data.title, name, eName);
  }
}

/**
 * 删除组织架构（逻辑删除）
 */
export async function deleteOrg(sid: string): Promise<void> {
  await run("UPDATE t_departments SET deleted = 1, timestamp = NOW() WHERE sid = ?", [sid]);
}

/**
 * 移动组织架构
 */
export async function moveOrg(sid: string, data: MoveOrgDto): Promise<void> {
  const { parentId } = data;

  // 计算新的 path
  let path = "/";

  if (parentId) {
    const parentRows = await query<[{ path: string }]>(
      "SELECT path FROM t_departments WHERE sid = ? AND deleted = 0",
      [parentId],
    );
    if (parentRows.length > 0) {
      const parent = parentRows[0];
      path = `${parent.path}${parentId}/`;
    }
  }

  await run("UPDATE t_departments SET parent_id = ?, path = ?, timestamp = NOW() WHERE sid = ?", [
    parentId || null,
    path,
    sid,
  ]);
}

/**
 * 检查组织是否有子组织
 */
export async function hasChildren(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_departments WHERE parent_id = ? AND deleted = 0",
    [sid],
  );
  return result[0].count > 0;
}

/**
 * 检查组织是否存在
 */
export async function isOrgExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_departments WHERE sid = ? AND deleted = 0",
    [sid],
  );
  return result[0].count > 0;
}
