/**
 * 客户管理服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Customer,
  CreateCustomerDto,
  UpdateCustomerDto,
  CustomerQuery,
  PaginatedCustomerResult,
} from "./types.js";

/**
 * 生成客户编号
 * 格式：C + 年月日 + 4位序号
 */
async function generateCustomerNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `C${dateStr}`;

  // 查询当天最大序号
  const rows = await query<[{ maxNo: string | null }]>(
    `SELECT MAX(customer_no) as maxNo FROM t_customers
     WHERE customer_no LIKE ? AND deleted = 0`,
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
 * 获取客户列表（分页）
 */
export async function getCustomerList(
  queryParams: CustomerQuery
): Promise<PaginatedCustomerResult> {
  const { keyword, type, level, ownerId, status, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (name LIKE ? OR customer_no LIKE ? OR primary_contact_name LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }

  if (level) {
    whereClause += " AND level = ?";
    params.push(level);
  }

  if (ownerId) {
    whereClause += " AND owner_id = ?";
    params.push(ownerId);
  }

  if (status) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_customers ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // 获取列表
  const offset = (page - 1) * pageSize;
  const rows = await query<Customer[]>(
    `SELECT
      sid,
      customer_no as customerNo,
      name,
      type,
      level,
      industry,
      scale,
      region,
      address,
      primary_contact_name as primaryContactName,
      primary_contact_phone as primaryContactPhone,
      primary_contact_email as primaryContactEmail,
      website,
      owner_id as ownerId,
      remark,
      last_follow_time as lastFollowTime,
      opportunity_count as opportunityCount,
      deal_count as dealCount,
      total_deal_amount as totalDealAmount,
      status,
      description,
      create_time as createTime,
      timestamp,
      deleted
    FROM t_customers
    ${whereClause}
    ORDER BY create_time DESC
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
 * 获取所有客户（不分页）
 */
export async function getAllCustomers(queryParams: Omit<CustomerQuery, "page" | "pageSize">): Promise<Customer[]> {
  const { keyword, type, level, ownerId, status } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (name LIKE ? OR customer_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }

  if (level) {
    whereClause += " AND level = ?";
    params.push(level);
  }

  if (ownerId) {
    whereClause += " AND owner_id = ?";
    params.push(ownerId);
  }

  if (status) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  return await query<Customer[]>(
    `SELECT
      sid,
      customer_no as customerNo,
      name,
      type,
      level,
      industry,
      scale,
      region,
      address,
      primary_contact_name as primaryContactName,
      primary_contact_phone as primaryContactPhone,
      primary_contact_email as primaryContactEmail,
      website,
      owner_id as ownerId,
      remark,
      last_follow_time as lastFollowTime,
      opportunity_count as opportunityCount,
      deal_count as dealCount,
      total_deal_amount as totalDealAmount,
      status,
      description,
      create_time as createTime,
      timestamp,
      deleted
    FROM t_customers
    ${whereClause}
    ORDER BY create_time DESC`,
    params
  );
}

/**
 * 根据ID获取客户
 */
export async function getCustomerById(sid: string): Promise<Customer | null> {
  const rows = await query<Customer[]>(
    `SELECT
      sid,
      customer_no as customerNo,
      name,
      type,
      level,
      industry,
      scale,
      region,
      address,
      primary_contact_name as primaryContactName,
      primary_contact_phone as primaryContactPhone,
      primary_contact_email as primaryContactEmail,
      website,
      owner_id as ownerId,
      remark,
      last_follow_time as lastFollowTime,
      opportunity_count as opportunityCount,
      deal_count as dealCount,
      total_deal_amount as totalDealAmount,
      status,
      description,
      create_time as createTime,
      timestamp,
      deleted
    FROM t_customers
    WHERE sid = ? AND deleted = 0`,
    [sid]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查客户是否存在
 */
export async function isCustomerExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_customers WHERE sid = ? AND deleted = 0",
    [sid]
  );
  return result[0].count > 0;
}

/**
 * 创建客户
 */
export async function createCustomer(data: CreateCustomerDto): Promise<string> {
  const sid = generateUUID();
  const customerNo = await generateCustomerNo();

  await run(
    `INSERT INTO t_customers (
      sid, customer_no, name, type, level, industry, scale, region, address,
      primary_contact_name, primary_contact_phone, primary_contact_email,
      website, owner_id, remark, status, description,
      opportunity_count, deal_count, total_deal_amount, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, NOW(), NOW())`,
    [
      sid,
      customerNo,
      data.name,
      data.type,
      data.level || "D",
      data.industry || null,
      data.scale || null,
      data.region || null,
      data.address || null,
      data.primaryContactName || null,
      data.primaryContactPhone || null,
      data.primaryContactEmail || null,
      data.website || null,
      data.ownerId || null,
      data.remark || null,
      data.status || "enabled",
      data.description || null,
    ]
  );

  return sid;
}

/**
 * 更新客户
 */
export async function updateCustomer(sid: string, data: UpdateCustomerDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.level !== undefined) {
    updates.push("level = ?");
    params.push(data.level);
  }
  if (data.industry !== undefined) {
    updates.push("industry = ?");
    params.push(data.industry || null);
  }
  if (data.scale !== undefined) {
    updates.push("scale = ?");
    params.push(data.scale || null);
  }
  if (data.region !== undefined) {
    updates.push("region = ?");
    params.push(data.region || null);
  }
  if (data.address !== undefined) {
    updates.push("address = ?");
    params.push(data.address || null);
  }
  if (data.primaryContactName !== undefined) {
    updates.push("primary_contact_name = ?");
    params.push(data.primaryContactName || null);
  }
  if (data.primaryContactPhone !== undefined) {
    updates.push("primary_contact_phone = ?");
    params.push(data.primaryContactPhone || null);
  }
  if (data.primaryContactEmail !== undefined) {
    updates.push("primary_contact_email = ?");
    params.push(data.primaryContactEmail || null);
  }
  if (data.website !== undefined) {
    updates.push("website = ?");
    params.push(data.website || null);
  }
  if (data.ownerId !== undefined) {
    updates.push("owner_id = ?");
    params.push(data.ownerId || null);
  }
  if (data.remark !== undefined) {
    updates.push("remark = ?");
    params.push(data.remark || null);
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
    `UPDATE t_customers SET ${updates.join(", ")}, timestamp = NOW() WHERE sid = ?`,
    params
  );
}

/**
 * 删除客户（逻辑删除）
 */
export async function deleteCustomer(sid: string): Promise<void> {
  await run(
    "UPDATE t_customers SET deleted = 1, status = 'disabled', timestamp = NOW() WHERE sid = ?",
    [sid]
  );
}

/**
 * 更新客户统计信息（商机数、成交数、成交金额）
 */
export async function updateCustomerStats(sid: string): Promise<void> {
  await run(
    `UPDATE t_customers SET
      opportunity_count = (SELECT COUNT(*) FROM t_opportunities WHERE customer_id = ? AND deleted = 0),
      deal_count = (SELECT COUNT(*) FROM t_deals WHERE customer_id = ? AND deleted = 0 AND status IN ('signed', 'paid', 'delivered', 'closed')),
      total_deal_amount = (SELECT COALESCE(SUM(amount), 0) FROM t_deals WHERE customer_id = ? AND deleted = 0 AND status IN ('signed', 'paid', 'delivered', 'closed')),
      timestamp = NOW()
    WHERE sid = ?`,
    [sid, sid, sid, sid]
  );
}

/**
 * 更新客户最近跟进时间
 */
export async function updateCustomerLastFollowTime(sid: string, followTime: string): Promise<void> {
  await run(
    "UPDATE t_customers SET last_follow_time = ?, timestamp = NOW() WHERE sid = ?",
    [followTime, sid]
  );
}
