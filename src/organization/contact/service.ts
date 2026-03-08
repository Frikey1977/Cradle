/**
 * 联系人管理服务层
 * 对应设计文档: design/organization/database/t_contacts.md
 */

import type { PoolConnection } from "mysql2/promise";
import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Contact,
  CreateContactDto,
  UpdateContactDto,
  ContactQuery,
  ContactListResult,
  ContactType,
} from "./types.js";

/**
 * 获取联系人列表（支持分页和筛选）
 */
export async function getContactList(queryParams: ContactQuery): Promise<ContactListResult> {
  const { type, keyword, status, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE c.deleted = 0";
  const params: any[] = [];

  if (type) {
    whereClause += " AND c.type = ?";
    params.push(type);
  }

  if (status) {
    whereClause += " AND c.status = ?";
    params.push(status);
  }

  if (keyword) {
    whereClause += " AND (c.type LIKE ? OR c.description LIKE ? OR c.source_id LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_contacts c ${whereClause}`,
    params,
  );
  const total = countResult[0].total;

  // 获取列表数据
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const rows = await query<Contact[]>(
    `SELECT
      c.sid,
      c.type,
      c.source_id as sourceId,
      c.profile,
      c.status,
      c.description,
      c.create_time as createTime,
      c.timestamp,
      CASE WHEN c.type = 'employee' THEN e.name ELSE NULL END as sourceName
    FROM t_contacts c
    LEFT JOIN t_employees e ON c.type = 'employee' AND c.source_id = e.sid
    ${whereClause}
    ORDER BY c.create_time DESC
    LIMIT ${pageSizeNum} OFFSET ${offset}`,
    params,
  );

  return {
    items: rows,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
  };
}

/**
 * 根据ID获取联系人
 */
export async function getContactById(sid: string): Promise<Contact | null> {
  const rows = await query<Contact[]>(
    `SELECT
      sid,
      type,
      source_id as sourceId,
      profile,
      status,
      description,
      create_time as createTime,
      timestamp
    FROM t_contacts
    WHERE sid = ? AND deleted = 0`,
    [sid],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 根据source_id获取联系人
 */
export async function getContactBySourceId(
  sourceId: string,
  type?: string,
): Promise<Contact | null> {
  let sql = `SELECT
      sid,
      type,
      source_id as sourceId,
      profile,
      status,
      description,
      create_time as createTime,
      timestamp
    FROM t_contacts
    WHERE source_id = ? AND deleted = 0`;
  const params: any[] = [sourceId];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }

  const rows = await query<Contact[]>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * 根据用户ID获取联系人
 * 通过 user -> employee -> contact 的关联链查找
 */
export async function getContactByUserId(userId: string): Promise<Contact | null> {
  // 1. 先查找用户对应的员工
  const employeeRows = await query<Array<{ sid: string }>>(
    `SELECT sid FROM t_employees WHERE user_id = ? AND deleted = 0`,
    [userId],
  );

  if (!employeeRows || employeeRows.length === 0) {
    return null;
  }

  const employeeId = employeeRows[0].sid;

  // 2. 再查找员工对应的联系人
  return getContactBySourceId(employeeId, "employee");
}

/**
 * 检查联系人是否存在（基于 type + source_id）
 */
export async function isContactExists(
  type: ContactType,
  sourceId?: string,
  excludeSid?: string,
): Promise<boolean> {
  // 访客类型允许重复（source_id 为 NULL）
  if (type === "visitor" && !sourceId) {
    return false;
  }

  let sql = "SELECT COUNT(*) as count FROM t_contacts WHERE type = ? AND deleted = 0";
  const params: any[] = [type];

  if (sourceId) {
    sql += " AND source_id = ?";
    params.push(sourceId);
  } else {
    sql += " AND source_id IS NULL";
  }

  if (excludeSid) {
    sql += " AND sid != ?";
    params.push(excludeSid);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 创建联系人
 * @param data 联系人数据
 * @param connection 可选的数据库连接（用于事务）
 */
export async function createContact(
  data: CreateContactDto,
  connection?: PoolConnection,
): Promise<string> {
  const sid = generateUUID();

  const sql = `INSERT INTO t_contacts (
    sid, type, source_id, profile,
    status, description, deleted, create_time, timestamp
  ) VALUES (?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`;
  const params = [
    sid,
    data.type,
    data.sourceId || null,
    data.profile ? JSON.stringify(data.profile) : null,
    data.status ?? "enabled",
    data.description || null,
  ];

  if (connection) {
    await connection.execute(sql, params);
  } else {
    await run(sql, params);
  }

  return sid;
}

/**
 * 更新联系人
 */
export async function updateContact(sid: string, data: UpdateContactDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.sourceId !== undefined) {
    updates.push("source_id = ?");
    params.push(data.sourceId || null);
  }
  if (data.profile !== undefined) {
    updates.push("profile = ?");
    params.push(data.profile ? JSON.stringify(data.profile) : null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(sid);
  await run(
    `UPDATE t_contacts SET ${updates.join(", ")}, timestamp = NOW() WHERE sid = ?`,
    params,
  );
}

/**
 * 删除联系人（逻辑删除）
 */
export async function deleteContact(sid: string): Promise<void> {
  await run(
    `UPDATE t_contacts SET deleted = 1, timestamp = NOW() WHERE sid = ?`,
    [sid],
  );
}
