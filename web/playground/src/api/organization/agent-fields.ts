import { requestClient } from "#/api/request";

/**
 * 更新 Agent 偏好（使用 profile 字段）
 * @param id Agent ID
 * @param profile 偏好数据
 */
export async function updateAgentProfile(
  id: string,
  profile: Record<string, any>,
) {
  return requestClient.put(`/organization/agents/profile/${id}`, profile);
}
