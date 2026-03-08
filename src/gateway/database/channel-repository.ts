/**
 * 通道数据访问层 (Repository)
 * 
 * 提供通道相关的数据库操作
 */

import type {
  ChannelEntity,
  ChannelContactEntity,
  ChannelAgentEntity,
  ContactChannelIdentity,
  AgentChannelIdentity,
} from "./types.js";

/**
 * 数据库连接接口
 * 简化版，实际项目中应使用具体的数据库驱动
 */
export interface DatabaseConnection {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<{ insertId: string; affectedRows: number }>;
  transaction<T>(fn: (conn: DatabaseConnection) => Promise<T>): Promise<T>;
}

/**
 * 通道 Repository
 */
export class ChannelRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * 根据ID获取通道
   */
  async findById(id: string): Promise<ChannelEntity | null> {
    const sql = `
      SELECT * FROM t_channels 
      WHERE sid = ? AND enabled = 1
    `;
    const results = await this.db.query<ChannelEntity>(sql, [id]);
    return results[0] ?? null;
  }

  /**
   * 根据通道类型获取通道
   */
  async findByType(
    channelType: string,
    enterpriseId?: string,
  ): Promise<ChannelEntity | null> {
    const sql = `
      SELECT * FROM t_channels 
      WHERE channel_type = ? 
      AND (enterprise_id = ? OR enterprise_id IS NULL)
      AND enabled = 1
      ORDER BY enterprise_id IS NULL ASC
      LIMIT 1
    `;
    const results = await this.db.query<ChannelEntity>(sql, [
      channelType,
      enterpriseId ?? null,
    ]);
    return results[0] ?? null;
  }

  /**
   * 获取所有启用的通道
   */
  async findAllEnabled(enterpriseId?: string): Promise<ChannelEntity[]> {
    const sql = `
      SELECT * FROM t_channels 
      WHERE enabled = 1
      AND (enterprise_id = ? OR enterprise_id IS NULL)
      ORDER BY create_time DESC
    `;
    return this.db.query<ChannelEntity>(sql, [enterpriseId ?? null]);
  }

  /**
   * 创建通道
   */
  async create(entity: Omit<ChannelEntity, "create_time" | "update_time">): Promise<string> {
    const sql = `
      INSERT INTO t_channels (
        sid, channel_type, channel_name, config, credentials,
        enabled, status, last_error, last_connected_at, enterprise_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.execute(sql, [
      entity.sid,
      entity.channel_type,
      entity.channel_name,
      entity.config ? JSON.stringify(entity.config) : null,
      entity.credentials,
      entity.enabled,
      entity.status,
      entity.last_error,
      entity.last_connected_at,
      entity.enterprise_id,
    ]);
    return result.insertId;
  }

  /**
   * 更新通道
   */
  async update(
    id: string,
    updates: Partial<Omit<ChannelEntity, "sid" | "create_time" | "update_time">>,
  ): Promise<boolean> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.channel_name !== undefined) {
      fields.push("channel_name = ?");
      values.push(updates.channel_name);
    }
    if (updates.config !== undefined) {
      fields.push("config = ?");
      values.push(updates.config ? JSON.stringify(updates.config) : null);
    }
    if (updates.credentials !== undefined) {
      fields.push("credentials = ?");
      values.push(updates.credentials);
    }
    if (updates.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(updates.enabled);
    }
    if (updates.status !== undefined) {
      fields.push("status = ?");
      values.push(updates.status);
    }
    if (updates.last_error !== undefined) {
      fields.push("last_error = ?");
      values.push(updates.last_error);
    }
    if (updates.last_connected_at !== undefined) {
      fields.push("last_connected_at = ?");
      values.push(updates.last_connected_at);
    }

    if (fields.length === 0) {
      return false;
    }

    const sql = `UPDATE t_channels SET ${fields.join(", ")} WHERE sid = ?`;
    values.push(id);

    const result = await this.db.execute(sql, values);
    return result.affectedRows > 0;
  }

  /**
   * 删除通道
   */
  async delete(id: string): Promise<boolean> {
    const sql = "DELETE FROM t_channels WHERE sid = ?";
    const result = await this.db.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * 更新最后连接时间
   */
  async updateLastConnected(id: string): Promise<void> {
    const sql = `
      UPDATE t_channels 
      SET last_connected_at = NOW(), status = 'active', last_error = NULL
      WHERE sid = ?
    `;
    await this.db.execute(sql, [id]);
  }

  /**
   * 更新错误信息
   */
  async updateError(id: string, error: string): Promise<void> {
    const sql = `
      UPDATE t_channels 
      SET status = 'error', last_error = ?
      WHERE sid = ?
    `;
    await this.db.execute(sql, [error, id]);
  }
}

/**
 * Contact 通道绑定 Repository
 */
export class ChannelContactRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * 根据通道和发送者查询 Contact
   */
  async findByChannelAndSender(
    channelId: string,
    sender: string,
  ): Promise<ContactChannelIdentity | null> {
    const sql = `
      SELECT 
        r.contact_id as contactId,
        r.channel_id as channelId,
        c.channel_type as channelType,
        r.sender,
        r.verified = 1 as verified,
        r.status
      FROM r_channel_contact r
      JOIN t_channels c ON r.channel_id = c.sid
      WHERE r.channel_id = ? AND r.sender = ? AND r.status = 'active'
    `;
    const results = await this.db.query<ContactChannelIdentity>(sql, [channelId, sender]);
    return results[0] ?? null;
  }

  /**
   * 根据 Contact ID 查询所有通道身份
   */
  async findByContactId(contactId: string): Promise<ContactChannelIdentity[]> {
    const sql = `
      SELECT 
        r.contact_id as contactId,
        r.channel_id as channelId,
        c.channel_type as channelType,
        r.sender,
        r.verified = 1 as verified,
        r.status
      FROM r_channel_contact r
      JOIN t_channels c ON r.channel_id = c.sid
      WHERE r.contact_id = ? AND r.status = 'active'
    `;
    return this.db.query<ContactChannelIdentity>(sql, [contactId]);
  }

  /**
   * 创建绑定
   */
  async create(
    entity: Omit<ChannelContactEntity, "create_time" | "update_time">,
  ): Promise<string> {
    const sql = `
      INSERT INTO r_channel_contact (
        sid, channel_id, sender, contact_id, bind_source, verified, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.execute(sql, [
      entity.sid,
      entity.channel_id,
      entity.sender,
      entity.contact_id,
      entity.bind_source,
      entity.verified,
      entity.status,
    ]);
    return result.insertId;
  }

  /**
   * 更新绑定状态
   */
  async updateStatus(id: string, status: string): Promise<boolean> {
    const sql = "UPDATE r_channel_contact SET status = ? WHERE sid = ?";
    const result = await this.db.execute(sql, [status, id]);
    return result.affectedRows > 0;
  }

  /**
   * 删除绑定
   */
  async delete(id: string): Promise<boolean> {
    const sql = "DELETE FROM r_channel_contact WHERE sid = ?";
    const result = await this.db.execute(sql, [id]);
    return result.affectedRows > 0;
  }

  /**
   * 根据通道和发送者删除绑定
   */
  async deleteByChannelAndSender(channelId: string, sender: string): Promise<boolean> {
    const sql = "DELETE FROM r_channel_contact WHERE channel_id = ? AND sender = ?";
    const result = await this.db.execute(sql, [channelId, sender]);
    return result.affectedRows > 0;
  }
}

/**
 * Agent 通道绑定 Repository
 */
export class ChannelAgentRepository {
  private db: DatabaseConnection;

  constructor(db: DatabaseConnection) {
    this.db = db;
  }

  /**
   * 根据通道和标识查询 Agent
   */
  async findByChannelAndIdentity(
    channelId: string,
    identity: string,
  ): Promise<AgentChannelIdentity | null> {
    const sql = `
      SELECT 
        r.agent_id as agentId,
        r.channel_id as channelId,
        c.channel_type as channelType,
        r.identity,
        r.config,
        r.status
      FROM r_channel_agent r
      JOIN t_channels c ON r.channel_id = c.sid
      WHERE r.channel_id = ? AND r.identity = ? AND r.status = 'active'
    `;
    const results = await this.db.query<AgentChannelIdentity>(sql, [channelId, identity]);
    return results[0] ?? null;
  }

  /**
   * 根据 Agent ID 查询所有通道身份
   */
  async findByAgentId(agentId: string): Promise<AgentChannelIdentity[]> {
    const sql = `
      SELECT 
        r.agent_id as agentId,
        r.channel_id as channelId,
        c.channel_type as channelType,
        r.identity,
        r.config,
        r.status
      FROM r_channel_agent r
      JOIN t_channels c ON r.channel_id = c.sid
      WHERE r.agent_id = ? AND r.status = 'active'
    `;
    return this.db.query<AgentChannelIdentity>(sql, [agentId]);
  }

  /**
   * 创建绑定
   */
  async create(
    entity: Omit<ChannelAgentEntity, "create_time" | "update_time">,
  ): Promise<string> {
    const sql = `
      INSERT INTO r_channel_agent (
        sid, channel_id, identity, agent_id, config, status
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await this.db.execute(sql, [
      entity.sid,
      entity.channel_id,
      entity.identity,
      entity.agent_id,
      entity.config ? JSON.stringify(entity.config) : null,
      entity.status,
    ]);
    return result.insertId;
  }

  /**
   * 更新配置
   */
  async updateConfig(id: string, config: Record<string, unknown>): Promise<boolean> {
    const sql = "UPDATE r_channel_agent SET config = ? WHERE sid = ?";
    const result = await this.db.execute(sql, [JSON.stringify(config), id]);
    return result.affectedRows > 0;
  }

  /**
   * 更新状态
   */
  async updateStatus(id: string, status: string): Promise<boolean> {
    const sql = "UPDATE r_channel_agent SET status = ? WHERE sid = ?";
    const result = await this.db.execute(sql, [status, id]);
    return result.affectedRows > 0;
  }

  /**
   * 删除绑定
   */
  async delete(id: string): Promise<boolean> {
    const sql = "DELETE FROM r_channel_agent WHERE sid = ?";
    const result = await this.db.execute(sql, [id]);
    return result.affectedRows > 0;
  }
}
