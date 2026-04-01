/**
 * 成交管理服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Deal,
  CreateDealDto,
  UpdateDealDto,
  DealQuery,
  PaginatedDealResult,
} from "./types.js";

/**
 * 生成成交编号
 * 格式：D + 年月日 + 4位序号
 */
async function generateDealNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `D${dateStr}`;

  // 查询当天最大序号
  const rows = await query<[{ maxNo: string | null }]>(
    `SELECT MAX(deal_no) as maxNo FROM t_deals
     WHERE deal_no LIKE ? AND deleted = 0`,
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
 * 获取成交列表（分页）
 */
export async function getDealList(
  queryParams: DealQuery
): Promise<PaginatedDealResult> {
  const { keyword, customerId, opportunityId, status, ownerId, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE d.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (d.name LIKE ? OR d.deal_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND d.customer_id = ?";
    params.push(customerId);
  }

  if (opportunityId) {
    whereClause += " AND d.opportunity_id = ?";
    params.push(opportunityId);
  }

  if (status) {
    whereClause += " AND d.status = ?";
    params.push(status);
  }

  if (ownerId) {
    whereClause += " AND d.owner_id = ?";
    params.push(ownerId);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_deals d ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // 获取列表
  const offset = (page - 1) * pageSize;
  const rows = await query<Deal[]>(
    `SELECT
      d.sid,
      d.deal_no as dealNo,
      d.customer_id as customerId,
      c.name as customerName,
      d.opportunity_id as opportunityId,
      o.name as opportunityName,
      d.name,
      d.amount,
      d.paid_amount as paidAmount,
      d.unpaid_amount as unpaidAmount,
      d.payment_method as paymentMethod,
      d.sign_date as signDate,
      d.expected_delivery_date as expectedDeliveryDate,
      d.actual_delivery_date as actualDeliveryDate,
      d.status,
      d.contract_files as contractFiles,
      d.remark,
      d.owner_id as ownerId,
      e.name as ownerName,
      d.create_time as createTime,
      d.timestamp,
      d.deleted
    FROM t_deals d
    LEFT JOIN t_customers c ON d.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON d.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON d.owner_id = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY d.create_time DESC
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
 * 获取所有成交（不分页）
 */
export async function getAllDeals(
  queryParams: Omit<DealQuery, "page" | "pageSize">
): Promise<Deal[]> {
  const { keyword, customerId, opportunityId, status, ownerId } = queryParams;

  let whereClause = "WHERE d.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (d.name LIKE ? OR d.deal_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND d.customer_id = ?";
    params.push(customerId);
  }

  if (opportunityId) {
    whereClause += " AND d.opportunity_id = ?";
    params.push(opportunityId);
  }

  if (status) {
    whereClause += " AND d.status = ?";
    params.push(status);
  }

  if (ownerId) {
    whereClause += " AND d.owner_id = ?";
    params.push(ownerId);
  }

  return await query<Deal[]>(
    `SELECT
      d.sid,
      d.deal_no as dealNo,
      d.customer_id as customerId,
      c.name as customerName,
      d.opportunity_id as opportunityId,
      o.name as opportunityName,
      d.name,
      d.amount,
      d.paid_amount as paidAmount,
      d.unpaid_amount as unpaidAmount,
      d.payment_method as paymentMethod,
      d.sign_date as signDate,
      d.expected_delivery_date as expectedDeliveryDate,
      d.actual_delivery_date as actualDeliveryDate,
      d.status,
      d.contract_files as contractFiles,
      d.remark,
      d.owner_id as ownerId,
      e.name as ownerName,
      d.create_time as createTime,
      d.timestamp,
      d.deleted
    FROM t_deals d
    LEFT JOIN t_customers c ON d.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON d.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON d.owner_id = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY d.create_time DESC`,
    params
  );
}

/**
 * 根据ID获取成交
 */
export async function getDealById(sid: string): Promise<Deal | null> {
  const rows = await query<Deal[]>(
    `SELECT
      d.sid,
      d.deal_no as dealNo,
      d.customer_id as customerId,
      c.name as customerName,
      d.opportunity_id as opportunityId,
      o.name as opportunityName,
      d.name,
      d.amount,
      d.paid_amount as paidAmount,
      d.unpaid_amount as unpaidAmount,
      d.payment_method as paymentMethod,
      d.sign_date as signDate,
      d.expected_delivery_date as expectedDeliveryDate,
      d.actual_delivery_date as actualDeliveryDate,
      d.status,
      d.contract_files as contractFiles,
      d.remark,
      d.owner_id as ownerId,
      e.name as ownerName,
      d.create_time as createTime,
      d.timestamp,
      d.deleted
    FROM t_deals d
    LEFT JOIN t_customers c ON d.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON d.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON d.owner_id = e.sid AND e.deleted = 0
    WHERE d.sid = ? AND d.deleted = 0`,
    [sid]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查成交是否存在
 */
export async function isDealExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_deals WHERE sid = ? AND deleted = 0",
    [sid]
  );
  return result[0].count > 0;
}

/**
 * 创建成交
 */
export async function createDeal(data: CreateDealDto): Promise<string> {
  const sid = generateUUID();
  const dealNo = await generateDealNo();
  const amount = data.amount ?? 0;

  await run(
    `INSERT INTO t_deals (
      sid, deal_no, customer_id, opportunity_id, name, amount,
      paid_amount, unpaid_amount, payment_method, sign_date,
      expected_delivery_date, status, remark, owner_id, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      dealNo,
      data.customerId,
      data.opportunityId || null,
      data.name,
      amount,
      amount, // unpaid_amount = amount - paid_amount (0)
      data.paymentMethod || null,
      data.signDate || null,
      data.expectedDeliveryDate || null,
      data.status || "pending",
      data.remark || null,
      data.ownerId || null,
    ]
  );

  return sid;
}

/**
 * 更新成交
 */
export async function updateDeal(sid: string, data: UpdateDealDto): Promise<void> {
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
  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.amount !== undefined) {
    updates.push("amount = ?");
    params.push(data.amount);
  }
  if (data.paidAmount !== undefined) {
    updates.push("paid_amount = ?");
    params.push(data.paidAmount);
  }
  if (data.paymentMethod !== undefined) {
    updates.push("payment_method = ?");
    params.push(data.paymentMethod || null);
  }
  if (data.signDate !== undefined) {
    updates.push("sign_date = ?");
    params.push(data.signDate || null);
  }
  if (data.expectedDeliveryDate !== undefined) {
    updates.push("expected_delivery_date = ?");
    params.push(data.expectedDeliveryDate || null);
  }
  if (data.actualDeliveryDate !== undefined) {
    updates.push("actual_delivery_date = ?");
    params.push(data.actualDeliveryDate || null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.contractFiles !== undefined) {
    updates.push("contract_files = ?");
    params.push(data.contractFiles || null);
  }
  if (data.remark !== undefined) {
    updates.push("remark = ?");
    params.push(data.remark || null);
  }
  if (data.ownerId !== undefined) {
    updates.push("owner_id = ?");
    params.push(data.ownerId || null);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(sid);

  await run(
    `UPDATE t_deals SET ${updates.join(", ")}, timestamp = NOW() WHERE sid = ?`,
    params
  );

  // 更新未回款金额
  await run(
    `UPDATE t_deals SET unpaid_amount = amount - paid_amount WHERE sid = ?`,
    [sid]
  );
}

/**
 * 删除成交（逻辑删除）
 */
export async function deleteDeal(sid: string): Promise<void> {
  await run(
    "UPDATE t_deals SET deleted = 1, status = 'cancelled', timestamp = NOW() WHERE sid = ?",
    [sid]
  );
}

/**
 * 获取客户的成交列表
 */
export async function getDealsByCustomer(customerId: string): Promise<Deal[]> {
  return await query<Deal[]>(
    `SELECT
      d.sid,
      d.deal_no as dealNo,
      d.customer_id as customerId,
      c.name as customerName,
      d.opportunity_id as opportunityId,
      o.name as opportunityName,
      d.name,
      d.amount,
      d.paid_amount as paidAmount,
      d.unpaid_amount as unpaidAmount,
      d.payment_method as paymentMethod,
      d.sign_date as signDate,
      d.expected_delivery_date as expectedDeliveryDate,
      d.actual_delivery_date as actualDeliveryDate,
      d.status,
      d.contract_files as contractFiles,
      d.remark,
      d.owner_id as ownerId,
      e.name as ownerName,
      d.create_time as createTime,
      d.timestamp,
      d.deleted
    FROM t_deals d
    LEFT JOIN t_customers c ON d.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_opportunities o ON d.opportunity_id = o.sid AND o.deleted = 0
    LEFT JOIN t_employees e ON d.owner_id = e.sid AND e.deleted = 0
    WHERE d.customer_id = ? AND d.deleted = 0
    ORDER BY d.create_time DESC`,
    [customerId]
  );
}
