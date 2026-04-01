/**
 * 跟进记录服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Followup,
  CreateFollowupDto,
  UpdateFollowupDto,
  FollowupQuery,
  PaginatedFollowupResult,
} from "./types.js";

/**
 * 生成跟进编号
 * 格式：F + 年月日 + 4位序号
 */
async function generateFollowupNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `F${dateStr}`;

  // 查询当天最大序号
  const rows = await query<[{ maxNo: string | null }]>(
    `SELECT MAX(followup_no) as maxNo FROM t_followups
     WHERE followup_no LIKE ? AND deleted = 0`,
    [`${prefix}%`]
  );

  let seq = 1;
  if (rows[0].maxNo) {
    const match = rows[0].maxNo.match(/(\d{4})$/);
    if (match) {
      seq = parseInt(match[1], 10) + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * 获取跟进记录列表（分页）
 */
export async function getFollowupList(
  queryParams: FollowupQuery
): Promise<PaginatedFollowupResult> {
  const { keyword, customerId, opportunityId, method, createBy, startDate, endDate, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE f.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (f.content LIKE ? OR f.feedback LIKE ? OR f.followup_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND f.customer_id = ?";
    params.push(customerId);
  }

  if (opportunityId) {
    whereClause += " AND f.opportunity_id = ?";
    params.push(opportunityId);
  }

  if (method) {
    whereClause += " AND f.method = ?";
    params.push(method);
  }

  if (createBy) {
    whereClause += " AND f.create_by = ?";
    params.push(createBy);
  }

  if (startDate) {
    whereClause += " AND f.follow_time >= ?";
    params.push(startDate);
  }

  if (endDate) {
    whereClause += " AND f.follow_time <= ?";
    params.push(endDate);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_followups f ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // 获取列表
  const offset = (page - 1) * pageSize;
  const rows = await query<Followup[]>(
    `SELECT
      f.sid,
      f.followup_no as followupNo,
      f.customer_id as customerId,
      c.name as customerName,
      f.opportunity_id as opportunityId,
      o.name as opportunityName,
      f.method,
      f.follow_time as followTime,
      f.content,
      f.feedback,
      f.next_follow_date as nextFollowDate,
      f.next_follow_content as nextFollowContent,
      f.reminder,
      f.reminder_time as reminderTime,
      f.attachments,
      f.create_by as createBy,
      e.name as createByName,
      f.create_time as createTime,
      f.timestamp,
      f.deleted
    FROM t_followups f
    LEFT JOIN t_customers c ON f.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON f.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON f.create_by = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY f.follow_time DESC
    LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    list: rows,
    total,
    page,
    pageSize,
  };
}

/**
 * 获取所有跟进记录（不分页）
 */
export async function getAllFollowups(
  queryParams: Omit<FollowupQuery, "page" | "pageSize">
): Promise<Followup[]> {
  const { keyword, customerId, opportunityId, method, createBy, startDate, endDate } = queryParams;

  let whereClause = "WHERE f.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (f.content LIKE ? OR f.feedback LIKE ? OR f.followup_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND f.customer_id = ?";
    params.push(customerId);
  }

  if (opportunityId) {
    whereClause += " AND f.opportunity_id = ?";
    params.push(opportunityId);
  }

  if (method) {
    whereClause += " AND f.method = ?";
    params.push(method);
  }

  if (createBy) {
    whereClause += " AND f.create_by = ?";
    params.push(createBy);
  }

  if (startDate) {
    whereClause += " AND f.follow_time >= ?";
    params.push(startDate);
  }

  if (endDate) {
    whereClause += " AND f.follow_time <= ?";
    params.push(endDate);
  }

  return await query<Followup[]>(
    `SELECT
      f.sid,
      f.followup_no as followupNo,
      f.customer_id as customerId,
      c.name as customerName,
      f.opportunity_id as opportunityId,
      o.name as opportunityName,
      f.method,
      f.follow_time as followTime,
      f.content,
      f.feedback,
      f.next_follow_date as nextFollowDate,
      f.next_follow_content as nextFollowContent,
      f.reminder,
      f.reminder_time as reminderTime,
      f.attachments,
      f.create_by as createBy,
      e.name as createByName,
      f.create_time as createTime,
      f.timestamp,
      f.deleted
    FROM t_followups f
    LEFT JOIN t_customers c ON f.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON f.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON f.create_by = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY f.follow_time DESC`,
    params
  );
}

/**
 * 根据ID获取跟进记录
 */
export async function getFollowupById(sid: string): Promise<Followup | null> {
  const rows = await query<Followup[]>(
    `SELECT
      f.sid,
      f.followup_no as followupNo,
      f.customer_id as customerId,
      c.name as customerName,
      f.opportunity_id as opportunityId,
      o.name as opportunityName,
      f.method,
      f.follow_time as followTime,
      f.content,
      f.feedback,
      f.next_follow_date as nextFollowDate,
      f.next_follow_content as nextFollowContent,
      f.reminder,
      f.reminder_time as reminderTime,
      f.attachments,
      f.create_by as createBy,
      e.name as createByName,
      f.create_time as createTime,
      f.timestamp,
      f.deleted
    FROM t_followups f
    LEFT JOIN t_customers c ON f.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON f.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON f.create_by = e.sid AND e.deleted = 0
    WHERE f.sid = ? AND f.deleted = 0`,
    [sid]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查跟进记录是否存在
 */
export async function isFollowupExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_followups WHERE sid = ? AND deleted = 0",
    [sid]
  );
  return result[0].count > 0;
}

/**
 * 创建跟进记录
 */
export async function createFollowup(
  data: CreateFollowupDto,
  createBy?: string
): Promise<string> {
  const sid = generateUUID();
  const followupNo = await generateFollowupNo();
  const followTime = data.followTime || new Date().toISOString();

  await run(
    `INSERT INTO t_followups (
      sid, followup_no, customer_id, opportunity_id, method, follow_time,
      content, feedback, next_follow_date, next_follow_content,
      reminder, reminder_time, attachments, create_by, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      followupNo,
      data.customerId,
      data.opportunityId || null,
      data.method,
      followTime,
      data.content,
      data.feedback || null,
      data.nextFollowDate || null,
      data.nextFollowContent || null,
      data.reminder ?? 0,
      data.reminderTime || null,
      data.attachments || null,
      createBy || null,
    ]
  );

  // 更新客户最近跟进时间
  await run(
    "UPDATE t_customers SET last_follow_time = ?, timestamp = NOW() WHERE sid = ?",
    [followTime, data.customerId]
  );

  return sid;
}

/**
 * 更新跟进记录
 */
export async function updateFollowup(sid: string, data: UpdateFollowupDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.customerId !== undefined) {
    updates.push("customer_id = ?");
    params.push(data.customerId);
  }
  if (data.opportunityId !== undefined) {
    updates.push("opportunity_id = ?");
    params.push(data.opportunityId || null);
  }
  if (data.method !== undefined) {
    updates.push("method = ?");
    params.push(data.method);
  }
  if (data.followTime !== undefined) {
    updates.push("follow_time = ?");
    params.push(data.followTime);
  }
  if (data.content !== undefined) {
    updates.push("content = ?");
    params.push(data.content);
  }
  if (data.feedback !== undefined) {
    updates.push("feedback = ?");
    params.push(data.feedback || null);
  }
  if (data.nextFollowDate !== undefined) {
    updates.push("next_follow_date = ?");
    params.push(data.nextFollowDate || null);
  }
  if (data.nextFollowContent !== undefined) {
    updates.push("next_follow_content = ?");
    params.push(data.nextFollowContent || null);
  }
  if (data.reminder !== undefined) {
    updates.push("reminder = ?");
    params.push(data.reminder);
  }
  if (data.reminderTime !== undefined) {
    updates.push("reminder_time = ?");
    params.push(data.reminderTime || null);
  }
  if (data.attachments !== undefined) {
    updates.push("attachments = ?");
    params.push(data.attachments || null);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(sid);

  await run(
    `UPDATE t_followups SET ${updates.join(", ")}, timestamp = NOW() WHERE sid = ?`,
    params
  );
}

/**
 * 删除跟进记录（逻辑删除）
 */
export async function deleteFollowup(sid: string): Promise<void> {
  await run(
    "UPDATE t_followups SET deleted = 1, timestamp = NOW() WHERE sid = ?",
    [sid]
  );
}

/**
 * 获取客户的跟进记录列表
 */
export async function getFollowupsByCustomer(customerId: string): Promise<Followup[]> {
  return await query<Followup[]>(
    `SELECT
      f.sid,
      f.followup_no as followupNo,
      f.customer_id as customerId,
      c.name as customerName,
      f.opportunity_id as opportunityId,
      o.name as opportunityName,
      f.method,
      f.follow_time as followTime,
      f.content,
      f.feedback,
      f.next_follow_date as nextFollowDate,
      f.next_follow_content as nextFollowContent,
      f.reminder,
      f.reminder_time as reminderTime,
      f.attachments,
      f.create_by as createBy,
      e.name as createByName,
      f.create_time as createTime,
      f.timestamp,
      f.deleted
    FROM t_followups f
    LEFT JOIN t_customers c ON f.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON f.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON f.create_by = e.sid AND e.deleted = 0
    WHERE f.customer_id = ? AND f.deleted = 0
    ORDER BY f.follow_time DESC`,
    [customerId]
  );
}

/**
 * 获取商机的跟进记录列表
 */
export async function getFollowupsByOpportunity(opportunityId: string): Promise<Followup[]> {
  return await query<Followup[]>(
    `SELECT
      f.sid,
      f.followup_no as followupNo,
      f.customer_id as customerId,
      c.name as customerName,
      f.opportunity_id as opportunityId,
      o.name as opportunityName,
      f.method,
      f.follow_time as followTime,
      f.content,
      f.feedback,
      f.next_follow_date as nextFollowDate,
      f.next_follow_content as nextFollowContent,
      f.reminder,
      f.reminder_time as reminderTime,
      f.attachments,
      f.create_by as createBy,
      e.name as createByName,
      f.create_time as createTime,
      f.timestamp,
      f.deleted
    FROM t_followups f
    LEFT JOIN t_customers c ON f.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON f.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON f.create_by = e.sid AND e.deleted = 0
    WHERE f.opportunity_id = ? AND f.deleted = 0
    ORDER BY f.follow_time DESC`,
    [opportunityId]
  );
}
