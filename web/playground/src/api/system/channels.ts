import { requestClient } from "#/api/request";

export namespace ChannelApi {
  export interface Channel {
    sid: string;
    name: string;
    description?: string;
    config: Record<string, any>;
    clientConfig?: Record<string, any>;
    status: ChannelStatus;
    lastError?: string;
    lastConnectedAt?: string;
    createTime: string;
    updateTime: string;
  }

  export type ChannelStatus = "active" | "error" | "disabled";

  export interface CreateChannelDto {
    name: string;
    description?: string;
    config: Record<string, any>;
    clientConfig?: Record<string, any>;
    status?: ChannelStatus;
  }

  export interface UpdateChannelDto {
    name?: string;
    description?: string;
    config?: Record<string, any>;
    clientConfig?: Record<string, any>;
    status?: ChannelStatus;
  }

  export interface ChannelQuery {
    status?: ChannelStatus;
    keyword?: string;
  }

  export const StatusOptions = [
    { label: "system.channels.status.active", value: "active" },
    { label: "system.channels.status.error", value: "error" },
    { label: "system.channels.status.disabled", value: "disabled" },
  ];
}

/**
 * 获取通道列表
 */
export async function getChannelList(params?: ChannelApi.ChannelQuery) {
  return requestClient.get<ChannelApi.Channel[]>("/system/channels", {
    params,
  });
}

/**
 * 获取通道详情
 */
export async function getChannelDetail(id: string) {
  return requestClient.get<ChannelApi.Channel>(`/system/channels/${id}`);
}

/**
 * 检查通道名称是否存在
 */
export async function isChannelNameExists(name: string, excludeId?: string) {
  return requestClient.get<boolean>("/system/channels/name-exists", {
    params: { name, excludeId },
  });
}

/**
 * 创建通道
 */
export async function createChannel(data: ChannelApi.CreateChannelDto) {
  return requestClient.post<ChannelApi.Channel>("/system/channels", data);
}

/**
 * 更新通道
 */
export async function updateChannel(id: string, data: ChannelApi.UpdateChannelDto) {
  return requestClient.put<ChannelApi.Channel>(`/system/channels/${id}`, data);
}

/**
 * 更新通道状态
 */
export async function updateChannelStatus(id: string, status: ChannelApi.ChannelStatus) {
  return requestClient.put<ChannelApi.Channel>(`/system/channels/${id}/status`, { status });
}

/**
 * 删除通道
 */
export async function deleteChannel(id: string) {
  return requestClient.delete(`/system/channels/${id}`);
}

/**
 * 状态选项
 */
export const StatusOptions = [
  { label: "system.channels.status.active", value: "active" },
  { label: "system.channels.status.error", value: "error" },
  { label: "system.channels.status.disabled", value: "disabled" },
];
