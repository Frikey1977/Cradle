/**
 * 通道管理服务层
 */

import type { Channel, CreateChannelDto, UpdateChannelDto, ChannelQuery, ChannelStatus } from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";

/**
 * 解析配置字段
 * 处理数据库返回的 JSON 数据（可能是字符串或已解析的对象）
 */
function parseConfig(config: any): Record<string, any> {
  if (!config) {
    return {};
  }
  // 如果已经是对象，直接返回
  if (typeof config === "object" && !Array.isArray(config)) {
    return config;
  }
  // 如果是字符串，尝试解析
  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * 解析客户端配置字段
 */
function parseClientConfig(config: any): Record<string, any> | undefined {
  if (!config) {
    return undefined;
  }
  // 如果已经是对象，直接返回
  if (typeof config === "object" && !Array.isArray(config)) {
    return config;
  }
  // 如果是字符串，尝试解析
  if (typeof config === "string") {
    try {
      return JSON.parse(config);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * 获取通道列表
 */
export async function getChannelList(queryParams: ChannelQuery): Promise<Channel[]> {
  const { status, keyword } = queryParams;

  let sql = `SELECT
    sid,
    name,
    description,
    config,
    client_config as clientConfig,
    status,
    last_error as lastError,
    last_connected_at as lastConnectedAt,
    create_time as createTime,
    update_time as updateTime
  FROM t_channels
  WHERE 1=1`;
  const params: any[] = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR description LIKE ? OR sid LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY create_time DESC`;

  const rows = await query<Channel[]>(sql, params);
  return rows.map((row) => ({
    ...row,
    config: parseConfig(row.config),
    clientConfig: parseClientConfig(row.clientConfig),
  }));
}

/**
 * 根据ID获取通道
 */
export async function getChannelById(id: string): Promise<Channel | null> {
  const rows = await query<Channel[]>(
    `SELECT
      sid,
      name,
      description,
      config,
      client_config as clientConfig,
      status,
      last_error as lastError,
      last_connected_at as lastConnectedAt,
      create_time as createTime,
      update_time as updateTime
    FROM t_channels
    WHERE sid = ?`,
    [id],
  );

  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  return {
    ...row,
    config: parseConfig(row.config),
    clientConfig: parseClientConfig(row.clientConfig),
  };
}

/**
 * 根据通道名称获取通道ID
 */
export async function getChannelIdByName(name: string): Promise<string | null> {
  const rows = await query<{ sid: string }[]>(
    `SELECT sid FROM t_channels WHERE name = ?`,
    [name],
  );
  return rows.length > 0 ? rows[0].sid : null;
}

/**
 * 检查通道名称是否存在
 */
export async function isChannelNameExists(
  name: string,
  excludeId?: string,
): Promise<boolean> {
  let sql = `SELECT sid FROM t_channels WHERE name = ?`;
  const params: any[] = [name];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建通道
 */
export async function createChannel(data: CreateChannelDto): Promise<Channel> {
  const sid = generateUUID();
  const { name, description, config, clientConfig, status = "disabled" } = data;

  await run(
    `INSERT INTO t_channels (sid, name, description, config, client_config, status, create_time, update_time)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [sid, name, description || null, JSON.stringify(config), clientConfig ? JSON.stringify(clientConfig) : null, status],
  );

  const channel = await getChannelById(sid);
  if (!channel) {
    throw new Error("创建通道失败");
  }
  return channel;
}

/**
 * 更新通道
 */
export async function updateChannel(id: string, data: UpdateChannelDto): Promise<Channel> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.config !== undefined) {
    updates.push("config = ?");
    params.push(JSON.stringify(data.config));
  }
  if (data.clientConfig !== undefined) {
    updates.push("client_config = ?");
    params.push(data.clientConfig ? JSON.stringify(data.clientConfig) : null);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.lastError !== undefined) {
    updates.push("last_error = ?");
    params.push(data.lastError || null);
  }
  if (data.lastConnectedAt !== undefined) {
    updates.push("last_connected_at = ?");
    params.push(data.lastConnectedAt);
  }

  if (updates.length === 0) {
    const channel = await getChannelById(id);
    if (!channel) {
      throw new Error("通道不存在");
    }
    return channel;
  }

  updates.push("update_time = CURRENT_TIMESTAMP");
  params.push(id);

  await run(`UPDATE t_channels SET ${updates.join(", ")} WHERE sid = ?`, params);

  const channel = await getChannelById(id);
  if (!channel) {
    throw new Error("通道不存在");
  }
  return channel;
}

/**
 * 更新通道状态
 */
export async function updateChannelStatus(id: string, status: ChannelStatus): Promise<Channel> {
  await run(
    `UPDATE t_channels SET status = ?, update_time = CURRENT_TIMESTAMP WHERE sid = ?`,
    [status, id],
  );

  const channel = await getChannelById(id);
  if (!channel) {
    throw new Error("通道不存在");
  }
  return channel;
}

/**
 * 删除通道
 */
export async function deleteChannel(id: string): Promise<void> {
  await run(`DELETE FROM t_channels WHERE sid = ?`, [id]);
}
