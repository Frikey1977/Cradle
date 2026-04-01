import { requestClient } from "#/api/request";

export namespace ChannelContactApi {
  export interface ChannelContact {
    channelId: string;
    contactId: string;
    sender: string;
    channelName?: string;
    createTime?: string;
  }

  export interface ChannelContactQuery {
    contactId?: string;
    sourceId?: string;
    sourceType?: string;
    channelId?: string;
  }

  export interface CreateChannelContactDto {
    channelId: string;
    sender: string;
  }

  export interface UpdateChannelContactDto {
    sender: string;
  }
}

/**
 * 获取通道联系人绑定列表
 */
export async function getChannelContactList(params?: ChannelContactApi.ChannelContactQuery) {
  return requestClient.get<ChannelContactApi.ChannelContact[]>("/system/channel-contacts", {
    params,
  });
}

/**
 * 创建通道联系人绑定（通过 Contact ID）
 */
export async function createChannelContact(
  contactId: string,
  data: ChannelContactApi.CreateChannelContactDto,
) {
  return requestClient.post<ChannelContactApi.ChannelContact>(
    `/system/channel-contacts/${contactId}`,
    data,
  );
}

/**
 * 创建通道联系人绑定（通过 Source ID，如员工ID）
 */
export async function createChannelContactBySource(
  sourceId: string,
  data: ChannelContactApi.CreateChannelContactDto,
) {
  return requestClient.post<ChannelContactApi.ChannelContact>(
    `/system/channel-contacts/by-source/${sourceId}`,
    data,
  );
}

/**
 * 更新通道联系人绑定
 */
export async function updateChannelContact(
  channelId: string,
  contactId: string,
  data: ChannelContactApi.UpdateChannelContactDto,
) {
  return requestClient.put<ChannelContactApi.ChannelContact>(
    `/system/channel-contacts/${channelId}/${contactId}`,
    data,
  );
}

/**
 * 删除通道联系人绑定
 */
export async function deleteChannelContact(channelId: string, contactId: string) {
  return requestClient.delete(`/system/channel-contacts/${channelId}/${contactId}`);
}

/**
 * 检查 sender 是否已存在
 */
export async function isSenderExists(channelId: string, sender: string, excludeContactId?: string) {
  return requestClient.get<boolean>("/system/channel-contacts/sender-exists", {
    params: { channelId, sender, excludeContactId },
  });
}
