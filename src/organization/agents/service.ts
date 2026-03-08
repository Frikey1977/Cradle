/**
 * Agent 管理服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Agent,
  CreateAgentDto,
  UpdateAgentDto,
  AgentQuery,
  AgentListResult,
  AgentConfig,
  AgentHeartbeat,
  AgentProfile,
} from "./types.js";

/**
 * 解析 JSON 字段
 * MySQL JSON 字段返回的可能是对象或字符串，统一处理
 */
function parseJsonField(value: any): any {
  if (value === null || value === undefined) {
    return undefined;
  }
  // 如果已经是对象，直接返回
  if (typeof value === "object") {
    return value;
  }
  // 如果是字符串，尝试解析
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * 获取 Agent 列表（支持分页和筛选）
 */
export async function getAgentList(queryParams: AgentQuery): Promise<AgentListResult> {
  const { oid, mode, keyword, status, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE a.deleted = 0";
  const params: any[] = [];

  if (oid) {
    whereClause += " AND a.oid = ?";
    params.push(oid);
  }

  if (mode) {
    whereClause += " AND a.mode = ?";
    params.push(mode);
  }

  if (keyword) {
    whereClause += " AND (a.name LIKE ? OR a.agent_no LIKE ? OR a.e_name LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (status !== undefined) {
    whereClause += " AND a.status = ?";
    params.push(status);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_agents a ${whereClause}`,
    params,
  );
  const total = countResult[0].total;

  // 获取列表数据
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const rows = await query<Agent[]>(
    `SELECT
      a.sid as id,
      a.name,
      a.e_name as eName,
      a.title,
      a.agent_no as agentNo,
      a.description,
      a.oid,
      o.name as orgName,
      a.position_id as positionId,
      p.title as positionTitle,
      a.mode,
      a.avatar,
      a.config,
      a.profile,
      a.soul,
      a.heartbeat,
      a.status,
      a.create_time as createTime,
      a.timestamp
    FROM t_agents a
    LEFT JOIN t_departments o ON a.oid = o.sid AND o.deleted = 0
    LEFT JOIN t_positions p ON a.position_id = p.sid AND p.deleted = 0
    ${whereClause}
    ORDER BY a.create_time DESC
    LIMIT ${pageSizeNum} OFFSET ${offset}`,
    params,
  );

  return {
    items: rows.map((row) => ({
      ...row,
      config: parseJsonField(row.config),
      profile: parseJsonField(row.profile),
      heartbeat: parseJsonField(row.heartbeat),
    })),
    total,
    page: pageNum,
    pageSize: pageSizeNum,
  };
}

/**
 * 根据 ID 获取 Agent
 */
export async function getAgentById(id: string): Promise<Agent | null> {
  const rows = await query<Agent[]>(
    `SELECT
      a.sid as id,
      a.name,
      a.e_name as eName,
      a.title,
      a.agent_no as agentNo,
      a.description,
      a.oid,
      o.name as orgName,
      a.position_id as positionId,
      p.title as positionTitle,
      a.mode,
      a.avatar,
      a.config,
      a.profile,
      a.soul,
      a.heartbeat,
      a.status,
      a.create_time as createTime,
      a.timestamp
    FROM t_agents a
    LEFT JOIN t_departments o ON a.oid = o.sid AND o.deleted = 0
    LEFT JOIN t_positions p ON a.position_id = p.sid AND p.deleted = 0
    WHERE a.sid = ? AND a.deleted = 0`,
    [id],
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...row,
    config: parseJsonField(row.config),
    profile: parseJsonField(row.profile),
    heartbeat: parseJsonField(row.heartbeat),
  };
}

/**
 * 检查 Agent 编号是否存在
 */
export async function isAgentNoExists(agentNo: string, excludeId?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_agents WHERE agent_no = ? AND deleted = 0";
  const params: any[] = [agentNo];

  if (excludeId) {
    sql += " AND sid != ?";
    params.push(excludeId);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 创建 Agent
 */
export async function createAgent(data: CreateAgentDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_agents (
      sid, name, e_name, title, agent_no, description, oid, position_id, mode,
      avatar, config, profile, soul, heartbeat,
      status, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.eName || null,
      data.title || null,
      data.agentNo,
      data.description || null,
      data.oid,
      data.positionId || null,
      data.mode || "exclusive",
      data.avatar || null,
      data.config ? JSON.stringify(data.config) : null,
      data.profile ? JSON.stringify(data.profile) : null,
      data.soul || null,
      data.heartbeat ? JSON.stringify(data.heartbeat) : null,
      data.status ?? "enabled",
    ],
  );

  return sid;
}

/**
 * 更新 Agent
 */
export async function updateAgent(id: string, data: UpdateAgentDto): Promise<void> {
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
  if (data.agentNo !== undefined) {
    updates.push("agent_no = ?");
    params.push(data.agentNo);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.oid !== undefined) {
    updates.push("oid = ?");
    params.push(data.oid);
  }
  if (data.positionId !== undefined) {
    updates.push("position_id = ?");
    params.push(data.positionId || null);
  }
  if (data.mode !== undefined) {
    updates.push("mode = ?");
    params.push(data.mode);
  }
  if (data.avatar !== undefined) {
    updates.push("avatar = ?");
    params.push(data.avatar || null);
  }
  if (data.config !== undefined) {
    updates.push("config = ?");
    params.push(data.config ? JSON.stringify(data.config) : null);
  }
  if (data.profile !== undefined) {
    updates.push("profile = ?");
    params.push(data.profile ? JSON.stringify(data.profile) : null);
  }
  if (data.heartbeat !== undefined) {
    updates.push("heartbeat = ?");
    params.push(data.heartbeat ? JSON.stringify(data.heartbeat) : null);
  }
  if (data.soul !== undefined) {
    updates.push("soul = ?");
    params.push(data.soul || null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) {
    return;
  }

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(
    `UPDATE t_agents SET ${updates.join(", ")} WHERE sid = ? AND deleted = 0`,
    params,
  );
}

/**
 * 删除 Agent（逻辑删除）
 */
export async function deleteAgent(id: string): Promise<void> {
  await run(
    "UPDATE t_agents SET deleted = 1, timestamp = NOW() WHERE sid = ? AND deleted = 0",
    [id],
  );
}

/**
 * 绑定用户（专属模式）
 * 注意：用户绑定关系现在通过 r_agents_users 表管理
 */
export async function bindUser(agentId: string, userId: string): Promise<void> {
  // 检查是否已存在绑定关系
  interface ExistingBinding {
    sid: string;
  }
  const existing = await query<ExistingBinding[]>(
    "SELECT sid FROM r_agents_users WHERE agent_id = ? AND user_id = ? AND deleted = 0",
    [agentId, userId],
  );

  if (existing.length === 0) {
    // 创建新绑定关系
    const sid = generateUUID();
    await run(
      `INSERT INTO r_agents_users (sid, agent_id, user_id, deleted, create_time, timestamp)
       VALUES (?, ?, ?, 0, NOW(), NOW())`,
      [sid, agentId, userId],
    );
  }
}

/**
 * 解绑用户
 * 注意：用户绑定关系现在通过 r_agents_users 表管理
 */
export async function unbindUser(agentId: string, userId?: string): Promise<void> {
  if (userId) {
    // 解绑特定用户
    await run(
      "UPDATE r_agents_users SET deleted = 1, timestamp = NOW() WHERE agent_id = ? AND user_id = ? AND deleted = 0",
      [agentId, userId],
    );
  } else {
    // 解绑所有用户
    await run(
      "UPDATE r_agents_users SET deleted = 1, timestamp = NOW() WHERE agent_id = ? AND deleted = 0",
      [agentId],
    );
  }
}
