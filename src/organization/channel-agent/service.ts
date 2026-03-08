/**
 * 通道Agent绑定服务层
 * 对应表: r_channel_agent
 */

import { getPool } from "../../store/database.js";
import type {
  ChannelAgent,
  ChannelAgentQuery,
  CreateChannelAgentDto,
  UpdateChannelAgentDto,
} from "./types.js";

/**
 * 获取通道Agent绑定列表
 */
export async function getChannelAgentList(
  query: ChannelAgentQuery,
): Promise<ChannelAgent[]> {
  const pool = await getPool();

  let sql = `
    SELECT
      r.channel_id as channelId,
      r.agent_id as agentId,
      r.identity,
      r.config,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_agent r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE 1=1
  `;

  const params: any[] = [];

  if (query.agentId) {
    sql += " AND r.agent_id = ?";
    params.push(query.agentId);
  }

  if (query.channelId) {
    sql += " AND r.channel_id = ?";
    params.push(query.channelId);
  }

  sql += " ORDER BY r.create_time DESC";

  const [rows] = await pool.execute(sql, params);
  return rows as ChannelAgent[];
}

/**
 * 创建通道Agent绑定
 */
export async function createChannelAgent(
  agentId: string,
  dto: CreateChannelAgentDto,
): Promise<ChannelAgent> {
  const pool = await getPool();

  // 检查 identity 是否已被该通道下的其他Agent使用
  const [identityExists] = await pool.execute(
    `SELECT agent_id FROM r_channel_agent
     WHERE channel_id = ? AND identity = ?`,
    [dto.channelId, dto.identity],
  );

  if ((identityExists as any[]).length > 0) {
    throw new Error("该身份标识在此通道下已被使用");
  }

  await pool.execute(
    `INSERT INTO r_channel_agent (
      channel_id, agent_id, identity, config, create_time
    ) VALUES (?, ?, ?, ?, NOW())`,
    [dto.channelId, agentId, dto.identity, dto.config ? JSON.stringify(dto.config) : null],
  );

  // 获取创建的记录
  const [rows] = await pool.execute(
    `SELECT
      r.channel_id as channelId,
      r.agent_id as agentId,
      r.identity,
      r.config,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_agent r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE r.channel_id = ? AND r.agent_id = ?`,
    [dto.channelId, agentId],
  );

  return (rows as ChannelAgent[])[0];
}

/**
 * 更新通道Agent绑定
 */
export async function updateChannelAgent(
  channelId: string,
  agentId: string,
  dto: UpdateChannelAgentDto,
): Promise<ChannelAgent | null> {
  const pool = await getPool();

  // 检查 identity 是否已被该通道下的其他Agent使用（排除当前Agent自己）
  const [identityExists] = await pool.execute(
    `SELECT agent_id FROM r_channel_agent
     WHERE channel_id = ? AND identity = ? AND agent_id != ?`,
    [channelId, dto.identity, agentId],
  );

  if ((identityExists as any[]).length > 0) {
    throw new Error("该身份标识在此通道下已被使用");
  }

  const [result] = await pool.execute(
    `UPDATE r_channel_agent
     SET identity = ?, config = ?
     WHERE channel_id = ? AND agent_id = ?`,
    [dto.identity, dto.config ? JSON.stringify(dto.config) : null, channelId, agentId],
  );

  if ((result as any).affectedRows === 0) {
    return null;
  }

  // 获取更新后的记录
  const [rows] = await pool.execute(
    `SELECT
      r.channel_id as channelId,
      r.agent_id as agentId,
      r.identity,
      r.config,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_agent r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE r.channel_id = ? AND r.agent_id = ?`,
    [channelId, agentId],
  );

  return (rows as ChannelAgent[])[0] || null;
}

/**
 * 删除通道Agent绑定
 */
export async function deleteChannelAgent(
  channelId: string,
  agentId: string,
): Promise<boolean> {
  const pool = await getPool();

  const [result] = await pool.execute(
    `DELETE FROM r_channel_agent
     WHERE channel_id = ? AND agent_id = ?`,
    [channelId, agentId],
  );

  return (result as any).affectedRows > 0;
}

/**
 * 检查 identity 是否已存在
 */
export async function isIdentityExists(
  channelId: string,
  identity: string,
  excludeAgentId?: string,
): Promise<boolean> {
  const pool = await getPool();

  let sql = `
    SELECT 1 FROM r_channel_agent
    WHERE channel_id = ? AND identity = ?
  `;
  const params: any[] = [channelId, identity];

  if (excludeAgentId) {
    sql += " AND agent_id != ?";
    params.push(excludeAgentId);
  }

  const [rows] = await pool.execute(sql, params);
  return (rows as any[]).length > 0;
}
