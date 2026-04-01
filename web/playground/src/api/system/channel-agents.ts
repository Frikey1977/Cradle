import { requestClient } from "#/api/request";

export namespace ChannelAgentApi {
  export interface ChannelAgent {
    channelId: string;
    agentId: string;
    identity: string;
    config?: Record<string, any>;
    channelName?: string;
    createTime?: string;
  }

  export interface ChannelAgentQuery {
    agentId?: string;
    channelId?: string;
  }

  export interface CreateChannelAgentDto {
    channelId: string;
    identity: string;
    config?: Record<string, any>;
  }

  export interface UpdateChannelAgentDto {
    identity: string;
    config?: Record<string, any>;
  }
}

/**
 * 获取通道Agent绑定列表
 */
export async function getChannelAgentList(params?: ChannelAgentApi.ChannelAgentQuery) {
  return requestClient.get<ChannelAgentApi.ChannelAgent[]>("/system/channel-agents", {
    params,
  });
}

/**
 * 创建通道Agent绑定
 */
export async function createChannelAgent(
  agentId: string,
  data: ChannelAgentApi.CreateChannelAgentDto,
) {
  return requestClient.post<ChannelAgentApi.ChannelAgent>(
    `/system/channel-agents/${agentId}`,
    data,
  );
}

/**
 * 更新通道Agent绑定
 */
export async function updateChannelAgent(
  channelId: string,
  agentId: string,
  data: ChannelAgentApi.UpdateChannelAgentDto,
) {
  return requestClient.put<ChannelAgentApi.ChannelAgent>(
    `/system/channel-agents/${channelId}/${agentId}`,
    data,
  );
}

/**
 * 删除通道Agent绑定
 */
export async function deleteChannelAgent(channelId: string, agentId: string) {
  return requestClient.delete<void>(`/system/channel-agents/${channelId}/${agentId}`);
}

/**
 * 检查身份标识是否已存在
 */
export async function checkIdentityExists(
  channelId: string,
  identity: string,
  excludeAgentId?: string,
) {
  return requestClient.get<{ exists: boolean }>("/system/channel-agents/check-identity", {
    params: { channelId, identity, excludeAgentId },
  });
}
