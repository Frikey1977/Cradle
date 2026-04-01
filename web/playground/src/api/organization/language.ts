/**
 * 语言设置 API
 * 用于通知 Master 服务切换语言
 */

import { requestClient } from "#/api/request";

/**
 * 更新 contact 的语言设置
 * 通过 Web 后台转发到 Gateway Master
 * @param contactId 联系人ID
 * @param agentId Agent ID
 * @param language 语言代码，如 zh-CN, en-US
 */
export async function updateContactLanguage(
  contactId: string,
  agentId: string,
  language: string,
): Promise<{
  success: boolean;
  contactId: string;
  agentId: string;
  language: string;
  timestamp: number;
}> {
  const response = await requestClient.post(`/organization/contacts/${contactId}/language`, {
    language,
    agentId,
  });

  return response as any;
}

/**
 * 更新 contact profile 中的语言设置（持久化到数据库）
 * @param contactId 联系人ID
 * @param language 语言代码
 */
export async function updateContactProfileLanguage(
  contactId: string,
  language: string,
): Promise<void> {
  const currentProfile = await requestClient.get(`/organization/contacts/profile/${contactId}`);
  
  const updatedProfile = {
    ...currentProfile,
    preferredLanguage: language,
  };
  
  await requestClient.put(`/organization/contacts/profile/${contactId}`, {
    profile: updatedProfile,
  });
}