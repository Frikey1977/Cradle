/**
 * 代码管理服务层
 */

import type { SystemCode, CreateCodeDto, UpdateCodeDto, CodeQuery } from "./types.js";
import { generateUUID, buildTree } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";
import { syncTranslation } from "../translation/service.js";

// 代码路径缓存: Map<完整路径, sid>
const codePathCache = new Map<string, string>();

/**
 * 构建代码路径缓存
 * 一次性加载所有代码，构建完整路径映射
 */
async function buildCodePathCache(): Promise<void> {
  const rows = await query<{ sid: string; value: string; parentId: string | null }[]>(
    `SELECT sid, value, parent_id as parentId FROM t_codes WHERE deleted = 0 AND status = 'enabled'`,
  );

  console.log("[buildCodePathCache] Loaded rows:", rows.length);

  // 构建id到节点的映射
  const nodeMap = new Map<string, { sid: string; value: string; parentId: string | null }>();
  for (const row of rows) {
    nodeMap.set(row.sid, row);
  }

  // 构建完整路径
  codePathCache.clear();
  for (const row of rows) {
    const path = buildFullPath(row.sid, nodeMap);
    if (path) {
      codePathCache.set(path, row.sid);
    }
  }

  console.log("[buildCodePathCache] Cached paths:", Array.from(codePathCache.keys()));
}

/**
 * 递归构建节点的完整路径
 * @param visited - 用于检测循环引用的已访问节点集合
 */
function buildFullPath(
  sid: string,
  nodeMap: Map<string, { sid: string; value: string; parentId: string | null }>,
  visited: Set<string> = new Set(),
): string | null {
  // 检测循环引用
  if (visited.has(sid)) {
    console.warn(`[buildFullPath] 检测到循环引用，sid: ${sid}`);
    return null;
  }

  const node = nodeMap.get(sid);
  if (!node) return null;

  if (!node.parentId) {
    return node.value;
  }

  // 标记当前节点为已访问
  visited.add(sid);

  const parentPath = buildFullPath(node.parentId, nodeMap, visited);
  if (!parentPath) return node.value;

  return `${parentPath}.${node.value}`;
}

/**
 * 根据完整路径查找代码sid（使用缓存）
 */
async function findCodeByPath(path: string): Promise<string | null> {
  // 如果缓存为空，先构建缓存
  if (codePathCache.size === 0) {
    await buildCodePathCache();
  }

  return codePathCache.get(path) || null;
}

/**
 * 清除代码路径缓存
 * 在代码增删改时调用
 */
function clearCodePathCache(): void {
  codePathCache.clear();
}

/**
 * 获取代码列表
 */
export async function getCodeList(queryParams: CodeQuery): Promise<SystemCode[]> {
  const { status, type, keyword, parentId } = queryParams;

  let sql = `SELECT
    sid,
    name,
    title,
    description,
    icon,
    color,
    parent_id as parentId,
    type,
    value,
    status,
    sort,
    create_time as createTime,
    deleted,
    metadata
  FROM t_codes
  WHERE deleted = 0`;
  const params: any[] = [];

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (type) {
    sql += ` AND type = ?`;
    params.push(type);
  }

  if (parentId !== undefined) {
    if (parentId === "") {
      sql += ` AND parent_id IS NULL`;
    } else {
      sql += ` AND parent_id = ?`;
      params.push(parentId);
    }
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR value LIKE ? OR type LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  const rows = await query<SystemCode[]>(sql, params);
  return rows;
}

/**
 * 获取代码树
 */
export async function getCodeTree(): Promise<SystemCode[]> {
  const rows = await query<SystemCode[]>(
    `SELECT
      sid,
      name,
      title,
      description,
      icon,
      color,
      parent_id as parentId,
      type,
      value,
      status,
      sort,
      create_time as createTime,
      deleted,
      metadata
    FROM t_codes
    WHERE deleted = 0 AND status = 'enabled'
    ORDER BY sort ASC, create_time DESC`,
  );
  return buildTree(rows, {
    idField: "sid",
    pidField: "parentId",
    childrenField: "children",
  });
}

/**
 * 根据类型获取代码列表
 */
export async function getCodeListByType(type: string): Promise<SystemCode[]> {
  const rows = await query<SystemCode[]>(
    `SELECT * FROM t_codes WHERE type = ? AND deleted = 0 AND status = 'enabled' ORDER BY sort ASC`,
    [type],
  );
  return rows;
}

/**
 * 根据类型获取代码选项（用于下拉选择）
 * 返回简化格式的选项列表
 */
export async function getCodeOptionsByType(
  type: string,
): Promise<{ value: string; label: string; title?: string }[]> {
  const rows = await query<{ value: string; name: string; title?: string }[]>(
    `SELECT value, name, title 
     FROM t_codes 
     WHERE type = ? AND deleted = 0 AND status = 'enabled' 
     ORDER BY sort ASC`,
    [type],
  );
  return rows.map((row) => ({
    value: row.value,
    label: row.name,
    title: row.title,
  }));
}

/**
 * 根据父级代码值获取子代码选项（用于下拉选择）
 * 通过父级代码的value查找，返回其子节点
 * 支持层级路径，如 "system.code.type"
 */
export async function getCodeOptionsByParentValue(
  parentValue: string,
): Promise<{ value: string; label: string; title?: string; icon?: string; color?: string; metadata?: any }[]> {
  try {
    console.log("[getCodeOptionsByParentValue] parentValue:", parentValue);

    // 直接查询所有启用的代码数据
    const allRows = await query<
      {
        sid: string;
        value: string;
        parentId: string | null;
        name: string;
        title?: string;
        icon?: string;
        color?: string;
        metadata?: string;
        sort?: number;
      }[]
    >(
      `SELECT sid, value, parent_id as parentId, name, title, icon, color, metadata, sort
       FROM t_codes
       WHERE deleted = 0 AND status = 'enabled'`,
    );
    console.log("[getCodeOptionsByParentValue] allRows count:", allRows.length);

    // 构建id到节点的映射
    const nodeMap = new Map<
      string,
      { sid: string; value: string; parentId: string | null; name: string; title?: string; icon?: string; color?: string; metadata?: string }
    >();
    for (const row of allRows) {
      nodeMap.set(row.sid, row);
    }

    // 根据路径查找父级节点
    // 分割路径，如 "system.code.type" -> ["system", "code", "type"]
    const pathParts = parentValue.split(".");
    console.log("[getCodeOptionsByParentValue] pathParts:", pathParts);

    // 查找根节点（没有parentId且value匹配路径第一部分的节点）
    let currentNode = allRows.find((row) => !row.parentId && row.value === pathParts[0]);
    console.log("[getCodeOptionsByParentValue] root node:", currentNode);

    if (!currentNode) {
      console.log("[getCodeOptionsByParentValue] 未找到根节点");
      return [];
    }

    // 逐级查找路径中的节点
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];
      // 查找当前节点的子节点中value匹配的节点
      const childNode = allRows.find(
        (row) => row.parentId === currentNode?.sid && row.value === part,
      );
      console.log(`[getCodeOptionsByParentValue] 查找第${i}级 "${part}":`, childNode);
      if (!childNode) {
        console.log("[getCodeOptionsByParentValue] 未找到节点");
        return [];
      }
      currentNode = childNode;
    }

    console.log("[getCodeOptionsByParentValue] found parent node:", currentNode);

    // 获取子节点并按 sort 排序
    const childRows = allRows
      .filter((row) => row.parentId === currentNode?.sid)
      .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
    console.log("[getCodeOptionsByParentValue] childRows count:", childRows.length);

    return childRows.map((row) => {
      let parsedMetadata: any = undefined;
      if (row.metadata) {
        // MySQL JSON 字段返回的可能是对象或字符串
        if (typeof row.metadata === 'string') {
          try {
            parsedMetadata = JSON.parse(row.metadata);
          } catch (e) {
            console.error("[getCodeOptionsByParentValue] 解析 metadata 失败:", row.metadata, e);
            parsedMetadata = undefined;
          }
        } else {
          // 已经是对象
          parsedMetadata = row.metadata;
        }
      }
      return {
        value: row.value,
        label: row.name,
        title: row.title,
        icon: row.icon,
        color: row.color,
        metadata: parsedMetadata,
      };
    });
  } catch (error) {
    console.error("[getCodeOptionsByParentValue] Error:", error);
    throw error;
  }
}

/**
 * 根据ID获取代码
 */
export async function getCodeById(id: string): Promise<SystemCode | null> {
  const rows = await query<SystemCode[]>(
    `SELECT
      sid,
      name,
      title,
      description,
      icon,
      color,
      parent_id as parentId,
      type,
      value,
      status,
      sort,
      create_time as createTime,
      deleted,
      metadata
    FROM t_codes
    WHERE sid = ? AND deleted = 0`,
    [id],
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查代码名称是否存在（同一父级下）
 */
export async function isCodeNameExists(
  name: string,
  parentId: string | null | undefined,
  excludeId?: string,
): Promise<boolean> {
  let sql = `SELECT sid FROM t_codes WHERE name = ? AND deleted = 0 AND status = 'enabled'`;
  const params: any[] = [name];

  if (parentId) {
    sql += ` AND parent_id = ?`;
    params.push(parentId);
  } else {
    sql += ` AND parent_id IS NULL`;
  }

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 检查代码值是否存在（同一父级下）
 */
export async function isCodeValueExists(
  value: string,
  parentId: string | null | undefined,
  excludeId?: string,
): Promise<boolean> {
  if (!value) return false;

  let sql = `SELECT sid FROM t_codes WHERE value = ? AND deleted = 0 AND status = 'enabled'`;
  const params: any[] = [value];

  if (parentId) {
    sql += ` AND parent_id = ?`;
    params.push(parentId);
  } else {
    sql += ` AND parent_id IS NULL`;
  }

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建代码
 */
/**
 * 检查并同步翻译
 * 如果 title 是翻译键格式（如 system.xxx.yyy），自动同步到翻译文件
 * @param name 代码名称，作为中文翻译值
 * @param value 码值，作为英文翻译值（首字母大写）
 * @returns 同步结果，失败时抛出错误
 */
function checkAndSyncTranslation(
  title: string | null | undefined,
  name?: string,
  value?: string,
): { success: boolean; message: string } {
  console.log(
    "[checkAndSyncTranslation] Called with title:",
    title,
    "name:",
    name,
    "value:",
    value,
  );
  if (!title) {
    console.log("[checkAndSyncTranslation] Title is empty, skipping");
    return { success: true, message: "Title is empty, skipping" };
  }

  // 检查是否是翻译键格式（包含点号，且以常见命名空间开头）
  const validNamespaces = ["system", "organization", "codes"];
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
      // 同步翻译：中文用 name，英文用 value（首字母大写）
      const customValues = {
        zh: name || "",
        en: value ? value.charAt(0).toUpperCase() + value.slice(1) : "",
      };
      const result = syncTranslation(title, customValues);
      console.log("[checkAndSyncTranslation] syncTranslation result:", result);
      if (!result.success) {
        throw new Error(`翻译同步失败: ${result.message}`);
      }
      return result;
    } catch (error) {
      console.error("[checkAndSyncTranslation] Failed to sync translation:", error);
      throw error;
    }
  } else {
    const message = `无效的翻译键格式: ${title}，必须以 ${validNamespaces.join(", ")} 开头`;
    console.log("[checkAndSyncTranslation]", message);
    throw new Error(message);
  }
}

export async function createCode(data: CreateCodeDto): Promise<SystemCode> {
  const sid = generateUUID();
  const { name, title, description, icon, color, parentId, type, value, status = "enabled", sort = 0 } = data;

  await run(
    `INSERT INTO t_codes (sid, name, title, description, icon, color, parent_id, type, value, status, sort, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      sid,
      name,
      title || null,
      description || null,
      icon || null,
      color || null,
      parentId || null,
      type || null,
      value || null,
      status,
      sort,
    ],
  );

  // 同步翻译：中文用 name，英文用 value（首字母大写）
  checkAndSyncTranslation(title, name, value);

  // 清除缓存
  clearCodePathCache();

  const code = await getCodeById(sid);
  if (!code) {
    throw new Error("创建代码失败");
  }
  return code;
}

/**
 * 更新代码
 */
export async function updateCode(id: string, data: UpdateCodeDto): Promise<SystemCode> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title || null);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.icon !== undefined) {
    updates.push("icon = ?");
    params.push(data.icon || null);
  }
  if (data.color !== undefined) {
    updates.push("color = ?");
    params.push(data.color || null);
  }
  if (data.parentId !== undefined) {
    updates.push("parent_id = ?");
    params.push(data.parentId || null);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type || null);
  }
  if (data.value !== undefined) {
    updates.push("value = ?");
    params.push(data.value || null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.sort !== undefined) {
    updates.push("sort = ?");
    params.push(data.sort);
  }
  if (data.metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }

  if (updates.length === 0) {
    const code = await getCodeById(id);
    if (!code) {
      throw new Error("代码不存在");
    }
    return code;
  }

  params.push(id);
  await run(`UPDATE t_codes SET ${updates.join(", ")} WHERE sid = ?`, params);

  // 如果更新了 title，同步翻译
  if (data.title !== undefined) {
    // 获取 name 和 value：优先使用传入的值，否则从数据库获取
    const code = await getCodeById(id);
    const name = data.name ?? code?.name ?? "";
    const value = data.value ?? code?.value ?? "";
    checkAndSyncTranslation(data.title, name, value);
  }

  // 如果更新了 value 或 parentId，清除缓存
  if (data.value !== undefined || data.parentId !== undefined) {
    clearCodePathCache();
  }

  const code = await getCodeById(id);
  if (!code) {
    throw new Error("代码不存在");
  }
  return code;
}

/**
 * 更新代码状态
 */
export async function updateCodeStatus(id: string, status: number): Promise<SystemCode> {
  await run(`UPDATE t_codes SET status = ? WHERE sid = ?`, [status, id]);

  const code = await getCodeById(id);
  if (!code) {
    throw new Error("代码不存在");
  }
  return code;
}

/**
 * 删除代码（软删除）
 */
export async function deleteCode(id: string): Promise<void> {
  // 检查是否有子节点
  const children = await query<{ sid: string }[]>(
    `SELECT sid FROM t_codes WHERE parent_id = ? AND deleted = 0 AND status = 'enabled'`,
    [id],
  );

  if (children.length > 0) {
    throw new Error("该代码下有子节点，不能删除");
  }

  await run(`UPDATE t_codes SET deleted = 1 WHERE sid = ?`, [id]);

  // 清除缓存
  clearCodePathCache();
}

/**
 * 获取所有代码类型（用于下拉选择）
 */
export async function getCodeTypes(): Promise<string[]> {
  const rows = await query<{ type: string }[]>(
    `SELECT DISTINCT type FROM t_codes WHERE deleted = 0 AND status = 'enabled' AND type IS NOT NULL AND type != ''`,
  );
  return rows.map((r) => r.type).filter(Boolean);
}
