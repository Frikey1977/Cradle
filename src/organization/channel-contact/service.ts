/**
 * 通道联系人绑定服务层
 *
 * 提供通道联系人绑定的业务逻辑处理
 */

import { getPool } from "../../store/database.js";
import { getContactBySourceId } from "../contact/service.js";
import type {
  ChannelContact,
  ChannelContactQuery,
  CreateChannelContactDto,
  UpdateChannelContactDto,
} from "./types.js";

/**
 * 获取通道联系人绑定列表
 */
export async function getChannelContactList(
  query: ChannelContactQuery,
): Promise<ChannelContact[]> {
  const pool = await getPool();

  // 如果提供了 sourceId，先查询对应的 contactId
  let contactId = query.contactId;
  if (!contactId && query.sourceId) {
    const contact = await getContactBySourceId(query.sourceId, query.sourceType);
    if (!contact) {
      // 如果没有找到对应的联系人，返回空数组
      return [];
    }
    contactId = contact.sid;
  }

  let sql = `
    SELECT
      r.channel_id as channelId,
      r.contact_id as contactId,
      r.sender,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_contact r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE 1=1
  `;

  const params: any[] = [];

  if (contactId) {
    sql += " AND r.contact_id = ?";
    params.push(contactId);
  }

  if (query.channelId) {
    sql += " AND r.channel_id = ?";
    params.push(query.channelId);
  }

  sql += " ORDER BY r.create_time DESC";

  const [rows] = await pool.execute(sql, params);
  return rows as ChannelContact[];
}

/**
 * 创建通道联系人绑定
 * @param id Contact ID 或 Source ID
 * @param dto 创建数据
 * @param isSourceId 是否为 Source ID（默认为 false）
 */
export async function createChannelContact(
  id: string,
  dto: CreateChannelContactDto,
  isSourceId: boolean = false,
): Promise<ChannelContact> {
  const pool = await getPool();

  // 如果传入的是 sourceId，先查询对应的 contactId
  let contactId = id;
  if (isSourceId) {
    const contact = await getContactBySourceId(id);
    if (!contact) {
      throw new Error("未找到对应的联系人");
    }
    contactId = contact.sid;
  }

  // 检查是否已存在相同的绑定
  const [existing] = await pool.execute(
    `SELECT channel_id FROM r_channel_contact
     WHERE contact_id = ? AND channel_id = ?`,
    [contactId, dto.channelId],
  );

  if ((existing as any[]).length > 0) {
    throw new Error("该通道已绑定到此联系人");
  }

  // 检查 sender 是否已被其他联系人使用
  const [senderExists] = await pool.execute(
    `SELECT contact_id FROM r_channel_contact
     WHERE channel_id = ? AND sender = ? AND contact_id != ?`,
    [dto.channelId, dto.sender, contactId],
  );

  if ((senderExists as any[]).length > 0) {
    throw new Error("该发送者标识已被其他联系人使用");
  }

  await pool.execute(
    `INSERT INTO r_channel_contact (
      channel_id, contact_id, sender, create_time
    ) VALUES (?, ?, ?, NOW())`,
    [dto.channelId, contactId, dto.sender],
  );

  // 获取创建的记录
  const [rows] = await pool.execute(
    `SELECT
      r.channel_id as channelId,
      r.contact_id as contactId,
      r.sender,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_contact r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE r.channel_id = ? AND r.contact_id = ?`,
    [dto.channelId, contactId],
  );

  return (rows as ChannelContact[])[0];
}

/**
 * 更新通道联系人绑定
 */
export async function updateChannelContact(
  channelId: string,
  contactId: string,
  dto: UpdateChannelContactDto,
): Promise<ChannelContact | null> {
  const pool = await getPool();

  // 检查 sender 是否已被其他联系人使用
  const [senderExists] = await pool.execute(
    `SELECT contact_id FROM r_channel_contact
     WHERE channel_id = ? AND sender = ? AND contact_id != ?`,
    [channelId, dto.sender, contactId],
  );

  if ((senderExists as any[]).length > 0) {
    throw new Error("该发送者标识已被其他联系人使用");
  }

  const [result] = await pool.execute(
    `UPDATE r_channel_contact
     SET sender = ?
     WHERE channel_id = ? AND contact_id = ?`,
    [dto.sender, channelId, contactId],
  );

  if ((result as any).affectedRows === 0) {
    return null;
  }

  // 获取更新后的记录
  const [rows] = await pool.execute(
    `SELECT
      r.channel_id as channelId,
      r.contact_id as contactId,
      r.sender,
      c.name as channelName,
      r.create_time as createTime
    FROM r_channel_contact r
    JOIN t_channels c ON r.channel_id = c.sid
    WHERE r.channel_id = ? AND r.contact_id = ?`,
    [channelId, contactId],
  );

  return (rows as ChannelContact[])[0] || null;
}

/**
 * 删除通道联系人绑定
 */
export async function deleteChannelContact(
  channelId: string,
  contactId: string,
): Promise<boolean> {
  const pool = await getPool();

  const [result] = await pool.execute(
    `DELETE FROM r_channel_contact
     WHERE channel_id = ? AND contact_id = ?`,
    [channelId, contactId],
  );

  return (result as any).affectedRows > 0;
}

/**
 * 检查 sender 是否已存在
 */
export async function isSenderExists(
  channelId: string,
  sender: string,
  excludeContactId?: string,
): Promise<boolean> {
  const pool = await getPool();

  let sql = `
    SELECT 1 FROM r_channel_contact
    WHERE channel_id = ? AND sender = ?
  `;
  const params: any[] = [channelId, sender];

  if (excludeContactId) {
    sql += " AND contact_id != ?";
    params.push(excludeContactId);
  }

  const [rows] = await pool.execute(sql, params);
  return (rows as any[]).length > 0;
}
