import { requestClient } from "#/api/request";

import type { OrganizationContactApi } from "./contacts";

/**
 * 短期记忆条目（精简版）
 * 只保留核心字段：timestamp, channel, role, content, type
 */
export interface ShortTermMemoryEntry {
  /** 时间戳 */
  timestamp: number;
  /** 通道标识：cradle, wechat 等 */
  channel: string;
  /** 角色：user, agent */
  role: "user" | "agent";
  /** 消息内容 */
  content: string;
  /** 消息类型：text, audio 等 */
  type: "text" | "audio" | "image" | "file";
}

/**
 * 获取联系人偏好管理
 * @param sid 联系人SID
 */
export async function getContactProfile(sid: string) {
  return requestClient.get<OrganizationContactApi.ContactProfile>(
    `/organization/contacts/profile/${sid}`,
  );
}

/**
 * 更新联系人偏好管理
 * @param sid 联系人SID
 * @param profile 偏好管理数据
 */
export async function updateContactProfile(
  sid: string,
  profile: OrganizationContactApi.ContactProfile,
) {
  return requestClient.put<{ profile: OrganizationContactApi.ContactProfile }>(
    `/organization/contacts/profile/${sid}`,
    { profile },
  );
}

/**
 * 获取联系人短期记忆（对话历史）
 * @param sid 联系人SID
 */
export async function getContactShortTermMemory(sid: string) {
  return requestClient.get<ShortTermMemoryEntry[]>(
    `/organization/contacts/${sid}/short-term-memory`,
  );
}

/**
 * 更新联系人短期记忆（对话历史）
 * @param sid 联系人SID
 * @param shortTermMemory 短期记忆数据
 */
export async function updateContactShortTermMemory(
  sid: string,
  shortTermMemory: ShortTermMemoryEntry[],
) {
  return requestClient.put<{ shortTermMemory: ShortTermMemoryEntry[] }>(
    `/organization/contacts/${sid}/short-term-memory`,
    { shortTermMemory },
  );
}

/**
 * 获取联系人 facts
 * @param sid 联系人SID
 */
export async function getContactFacts(sid: string) {
  return requestClient.get<Record<string, any>>(
    `/organization/contacts/${sid}/facts`,
  );
}

/**
 * 更新联系人 facts
 * @param sid 联系人SID
 * @param facts 基本事实数据
 */
export async function updateContactFacts(
  sid: string,
  facts: Record<string, any>,
) {
  return requestClient.put<{ facts: Record<string, any> }>(
    `/organization/contacts/${sid}/facts`,
    { facts },
  );
}

/**
 * 获取联系人 preferences
 * @param sid 联系人SID
 */
export async function getContactPreferences(sid: string) {
  return requestClient.get<Record<string, any>>(
    `/organization/contacts/${sid}/preferences`,
  );
}

/**
 * 更新联系人 preferences
 * @param sid 联系人SID
 * @param preferences 个人偏好数据
 */
export async function updateContactPreferences(
  sid: string,
  preferences: Record<string, any>,
) {
  return requestClient.put<{ preferences: Record<string, any> }>(
    `/organization/contacts/${sid}/preferences`,
    { preferences },
  );
}
