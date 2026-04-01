/**
 * LLM提供商管理服务层
 */

import type {
  LlmProvider,
  CreateProviderDto,
  UpdateProviderDto,
  ProviderQuery,
} from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";

/**
 * 获取提供商列表
 */
export async function getProviderList(queryParams: ProviderQuery): Promise<LlmProvider[]> {
  const { status, keyword, page, pageSize } = queryParams;

  let sql = `SELECT * FROM t_llm_providers WHERE deleted = 0`;
  const params: any[] = [];

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR ename LIKE ? OR title LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  // 分页 - 使用字符串拼接而不是参数绑定（MySQL LIMIT 不支持参数绑定）
  if (page && pageSize) {
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * sizeNum;
    sql += ` LIMIT ${sizeNum} OFFSET ${offset}`;
  }

  const rows = await query<LlmProvider[]>(sql, params);
  return rows;
}

/**
 * 获取所有提供商（不分页）
 */
export async function getAllProviders(): Promise<LlmProvider[]> {
  const rows = await query<LlmProvider[]>(
    `SELECT * FROM t_llm_providers WHERE deleted = 0 ORDER BY sort ASC, create_time DESC`
  );
  return rows;
}

/**
 * 根据ID获取提供商
 */
export async function getProviderById(id: string): Promise<LlmProvider | null> {
  const rows = await query<LlmProvider[]>(
    `SELECT * FROM t_llm_providers WHERE sid = ? AND deleted = 0`,
    [id]
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0];
}

/**
 * 检查提供商名称是否存在
 */
export async function isProviderNameExists(name: string, excludeId?: string): Promise<boolean> {
  let sql = `SELECT sid FROM t_llm_providers WHERE name = ? AND deleted = 0`;
  const params: any[] = [name];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建提供商
 */
export async function createProvider(data: CreateProviderDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_llm_providers (sid, name, title, ename, description, icon, color, sort, status, deleted, create_time, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.title || data.name,
      data.ename,
      data.description || null,
      data.icon || null,
      data.color || null,
      data.sort ?? 0,
      data.status ?? "enabled",
      0, // deleted
    ]
  );

  return sid;
}

/**
 * 更新提供商
 */
export async function updateProvider(id: string, data: UpdateProviderDto): Promise<void> {
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
  if (data.ename !== undefined) {
    updates.push("ename = ?");
    params.push(data.ename);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.icon !== undefined) {
    updates.push("icon = ?");
    params.push(data.icon);
  }
  if (data.color !== undefined) {
    updates.push("color = ?");
    params.push(data.color);
  }
  if (data.sort !== undefined) {
    updates.push("sort = ?");
    params.push(data.sort);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) {
    throw new Error("没有需要更新的字段");
  }

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(`UPDATE t_llm_providers SET ${updates.join(", ")} WHERE sid = ?`, params);
}

/**
 * 删除提供商
 */
export async function deleteProvider(id: string): Promise<void> {
  await run(`UPDATE t_llm_providers SET deleted = 1, timestamp = NOW() WHERE sid = ?`, [id]);
}

/**
 * 获取提供商总数
 */
export async function getProviderCount(queryParams: ProviderQuery): Promise<number> {
  const { status, keyword } = queryParams;

  let sql = `SELECT COUNT(*) as count FROM t_llm_providers WHERE deleted = 0`;
  const params: any[] = [];

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR ename LIKE ? OR title LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const rows = await query<{ count: number }[]>(sql, params);
  return rows[0]?.count || 0;
}
