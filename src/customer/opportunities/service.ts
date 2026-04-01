/**
 * 商机管理服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Opportunity,
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityQuery,
  PaginatedOpportunityResult,
  STAGE_PROBABILITY_MAP,
} from "./types.js";

/**
 * 生成商机编号
 * 格式：O + 年月日 + 4位序号
 */
async function generateOpportunityNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.getFullYear().toString() +
    String(today.getMonth() + 1).padStart(2, "0") +
    String(today.getDate()).padStart(2, "0");

  const prefix = `O${dateStr}`;

  // 查询当天最大序号
  const rows = await query<[{ maxNo: string | null }]>(
    `SELECT MAX(opportunity_no) as maxNo FROM t_opportunities
     WHERE opportunity_no LIKE ? AND deleted = 0`,
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
 * 计算预计加权金额
 */
function calculateExpectedAmount(amount: number, probability: number): number {
  return Math.round(amount * probability) / 100;
}

/**
 * 获取商机列表（分页）
 */
export async function getOpportunityList(
  queryParams: OpportunityQuery
): Promise<PaginatedOpportunityResult> {
  const { keyword, customerId, stage, source, ownerId, status, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE o.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (o.name LIKE ? OR o.opportunity_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND o.customer_id = ?";
    params.push(customerId);
  }

  if (stage) {
    whereClause += " AND o.stage = ?";
    params.push(stage);
  }

  if (source) {
    whereClause += " AND o.source = ?";
    params.push(source);
  }

  if (ownerId) {
    whereClause += " AND o.owner_id = ?";
    params.push(ownerId);
  }

  if (status) {
    whereClause += " AND o.status = ?";
    params.push(status);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_opportunities o ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // 获取列表
  const offset = (page - 1) * pageSize;
  const rows = await query<Opportunity[]>(
    `SELECT
      o.sid,
      o.opportunity_no as opportunityNo,
      o.customer_id as customerId,
      c.name as customerName,
      o.name,
      o.source,
      o.stage,
      o.probability,
      o.amount,
      o.expected_amount as expectedAmount,
      o.actual_amount as actualAmount,
      o.expected_close_date as expectedCloseDate,
      o.actual_close_date as actualCloseDate,
      o.close_reason as closeReason,
      o.description,
      o.owner_id as ownerId,
      e.name as ownerName,
      o.status,
      o.create_time as createTime,
      o.timestamp,
      o.deleted
    FROM t_opportunities o
    LEFT JOIN t_customers c ON o.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_employees e ON o.owner_id = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY o.create_time DESC
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
 * 获取所有商机（不分页）
 */
export async function getAllOpportunities(
  queryParams: Omit<OpportunityQuery, "page" | "pageSize">
): Promise<Opportunity[]> {
  const { keyword, customerId, stage, source, ownerId, status } = queryParams;

  let whereClause = "WHERE o.deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (o.name LIKE ? OR o.opportunity_no LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword);
  }

  if (customerId) {
    whereClause += " AND o.customer_id = ?";
    params.push(customerId);
  }

  if (stage) {
    whereClause += " AND o.stage = ?";
    params.push(stage);
  }

  if (source) {
    whereClause += " AND o.source = ?";
    params.push(source);
  }

  if (ownerId) {
    whereClause += " AND o.owner_id = ?";
    params.push(ownerId);
  }

  if (status) {
    whereClause += " AND o.status = ?";
    params.push(status);
  }

  return await query<Opportunity[]>(
    `SELECT
      o.sid,
      o.opportunity_no as opportunityNo,
      o.customer_id as customerId,
      c.name as customerName,
      o.name,
      o.source,
      o.stage,
      o.probability,
      o.amount,
      o.expected_amount as expectedAmount,
      o.actual_amount as actualAmount,
      o.expected_close_date as expectedCloseDate,
      o.actual_close_date as actualCloseDate,
      o.close_reason as closeReason,
      o.description,
      o.owner_id as ownerId,
      e.name as ownerName,
      o.status,
      o.create_time as createTime,
      o.timestamp,
      o.deleted
    FROM t_opportunities o
    LEFT JOIN t_customers c ON o.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_employees e ON o.owner_id = e.sid AND e.deleted = 0
    ${whereClause}
    ORDER BY o.create_time DESC`,
    params
  );
}

/**
 * 根据ID获取商机
 */
export async function getOpportunityById(sid: string): Promise<Opportunity | null> {
  const rows = await query<Opportunity[]>(
    `SELECT
      o.sid,
      o.opportunity_no as opportunityNo,
      o.customer_id as customerId,
      c.name as customerName,
      o.name,
      o.source,
      o.stage,
      o.probability,
      o.amount,
      o.expected_amount as expectedAmount,
      o.actual_amount as actualAmount,
      o.expected_close_date as expectedCloseDate,
      o.actual_close_date as actualCloseDate,
      o.close_reason as closeReason,
      o.description,
      o.owner_id as ownerId,
      e.name as ownerName,
      o.status,
      o.create_time as createTime,
      o.timestamp,
      o.deleted
    FROM t_opportunities o
    LEFT JOIN t_customers c ON o.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_employees e ON o.owner_id = e.sid AND e.deleted = 0
    WHERE o.sid = ? AND o.deleted = 0`,
    [sid]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查商机是否存在
 */
export async function isOpportunityExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_opportunities WHERE sid = ? AND deleted = 0",
    [sid]
  );
  return result[0].count > 0;
}

/**
 * 创建商机
 */
export async function createOpportunity(data: CreateOpportunityDto): Promise<string> {
  const sid = generateUUID();
  const opportunityNo = await generateOpportunityNo();

  // 计算预计加权金额
  const probability = data.probability ?? 10;
  const amount = data.amount ?? 0;
  const expectedAmount = calculateExpectedAmount(amount, probability);

  // 根据阶段自动设置状态
  const stage = data.stage || "initial";
  const status = stage === "won" || stage === "lost" ? "closed" : "open";

  await run(
    `INSERT INTO t_opportunities (
      sid, opportunity_no, customer_id, name, source, stage, probability,
      amount, expected_amount, actual_amount, expected_close_date,
      description, owner_id, status, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      opportunityNo,
      data.customerId,
      data.name,
      data.source || null,
      stage,
      probability,
      amount,
      expectedAmount,
      data.expectedCloseDate || null,
      data.description || null,
      data.ownerId || null,
      status,
    ]
  );

  return sid;
}

/**
 * 更新商机
 */
export async function updateOpportunity(sid: string, data: UpdateOpportunityDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.customerId !== undefined) {
    updates.push("customer_id = ?");
    params.push(data.customerId);
  }
  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.source !== undefined) {
    updates.push("source = ?");
    params.push(data.source || null);
  }
  if (data.stage !== undefined) {
    updates.push("stage = ?");
    params.push(data.stage);
    // 根据阶段自动更新状态和赢率
    if (data.stage === "won" || data.stage === "lost") {
      updates.push("status = ?");
      params.push("closed");
    }
    // 自动更新赢率
    const stageProbability: Record<string, number> = {
      initial: 10,
      needs: 30,
      proposal: 60,
      negotiation: 80,
      won: 100,
      lost: 0,
    };
    if (stageProbability[data.stage] !== undefined) {
      updates.push("probability = ?");
      params.push(stageProbability[data.stage]);
    }
  }
  if (data.probability !== undefined) {
    updates.push("probability = ?");
    params.push(data.probability);
  }
  if (data.amount !== undefined) {
    updates.push("amount = ?");
    params.push(data.amount);
  }
  if (data.expectedCloseDate !== undefined) {
    updates.push("expected_close_date = ?");
    params.push(data.expectedCloseDate || null);
  }
  if (data.actualCloseDate !== undefined) {
    updates.push("actual_close_date = ?");
    params.push(data.actualCloseDate || null);
  }
  if (data.closeReason !== undefined) {
    updates.push("close_reason = ?");
    params.push(data.closeReason || null);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.ownerId !== undefined) {
    updates.push("owner_id = ?");
    params.push(data.ownerId || null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) {
    return;
  }

  params.push(sid);

  await run(
    `UPDATE t_opportunities SET ${updates.join(", ")}, timestamp = NOW() WHERE sid = ?`,
    params
  );

  // 更新预计加权金额
  await run(
    `UPDATE t_opportunities
     SET expected_amount = amount * probability / 100
     WHERE sid = ?`,
    [sid]
  );
}

/**
 * 删除商机（逻辑删除）
 */
export async function deleteOpportunity(sid: string): Promise<void> {
  await run(
    "UPDATE t_opportunities SET deleted = 1, status = 'closed', timestamp = NOW() WHERE sid = ?",
    [sid]
  );
}

/**
 * 获取客户的商机列表
 */
export async function getOpportunitiesByCustomer(customerId: string): Promise<Opportunity[]> {
  return await query<Opportunity[]>(
    `SELECT
      o.sid,
      o.opportunity_no as opportunityNo,
      o.customer_id as customerId,
      c.name as customerName,
      o.name,
      o.source,
      o.stage,
      o.probability,
      o.amount,
      o.expected_amount as expectedAmount,
      o.actual_amount as actualAmount,
      o.expected_close_date as expectedCloseDate,
      o.actual_close_date as actualCloseDate,
      o.close_reason as closeReason,
      o.description,
      o.owner_id as ownerId,
      e.name as ownerName,
      o.status,
      o.create_time as createTime,
      o.timestamp,
      o.deleted
    FROM t_opportunities o
    LEFT JOIN t_customers c ON o.customer_id = c.sid AND c.deleted = 0
    LEFT JOIN t_employees e ON o.owner_id = e.sid AND e.deleted = 0
    WHERE o.customer_id = ? AND o.deleted = 0
    ORDER BY o.create_time DESC`,
    [customerId]
  );
}
