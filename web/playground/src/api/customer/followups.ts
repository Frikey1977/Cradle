import { requestClient } from "#/api/request";

export namespace FollowupApi {
  export interface Followup {
    sid: string;
    followupNo: string;
    customerId: string;
    customerName?: string;
    opportunityId?: string;
    opportunityName?: string;
    method: string;
    followTime: string;
    content: string;
    feedback?: string;
    nextFollowDate?: string;
    nextFollowContent?: string;
    reminder: number;
    reminderTime?: string;
    attachments?: string;
    createBy?: string;
    createByName?: string;
    createTime?: string;
    timestamp?: string;
    deleted: number;
  }

  export interface PaginatedResult {
    list: Followup[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface CreateFollowupDto {
    customerId: string;
    opportunityId?: string;
    method: string;
    followTime?: string;
    content: string;
    feedback?: string;
    nextFollowDate?: string;
    nextFollowContent?: string;
    reminder?: number;
    reminderTime?: string;
    attachments?: string;
  }

  export interface UpdateFollowupDto {
    customerId?: string;
    opportunityId?: string;
    method?: string;
    followTime?: string;
    content?: string;
    feedback?: string;
    nextFollowDate?: string;
    nextFollowContent?: string;
    reminder?: number;
    reminderTime?: string;
    attachments?: string;
  }

  export interface FollowupQuery {
    keyword?: string;
    customerId?: string;
    opportunityId?: string;
    method?: string;
    createBy?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
}

// 获取跟进记录列表（分页）
export function getFollowupList(params?: FollowupApi.FollowupQuery) {
  return requestClient.get<FollowupApi.PaginatedResult>("/customer/followups", {
    params,
  });
}

// 获取所有跟进记录（不分页）
export function getAllFollowups(
  params?: Omit<FollowupApi.FollowupQuery, "page" | "pageSize">,
) {
  return requestClient.get<FollowupApi.Followup[]>("/customer/followups/all", {
    params,
  });
}

// 获取跟进记录详情
export function getFollowupById(sid: string) {
  return requestClient.get<FollowupApi.Followup>(`/customer/followups/${sid}`);
}

// 获取客户的跟进记录列表
export function getFollowupsByCustomer(customerId: string) {
  return requestClient.get<FollowupApi.Followup[]>(
    `/customer/followups/customer/${customerId}`,
  );
}

// 获取商机的跟进记录列表
export function getFollowupsByOpportunity(opportunityId: string) {
  return requestClient.get<FollowupApi.Followup[]>(
    `/customer/followups/opportunity/${opportunityId}`,
  );
}

// 创建跟进记录
export function createFollowup(data: FollowupApi.CreateFollowupDto) {
  return requestClient.post<{ sid: string }>("/customer/followups", data);
}

// 更新跟进记录
export function updateFollowup(
  sid: string,
  data: FollowupApi.UpdateFollowupDto,
) {
  return requestClient.put<void>(`/customer/followups/${sid}`, data);
}

// 删除跟进记录
export function deleteFollowup(sid: string) {
  return requestClient.delete<void>(`/customer/followups/${sid}`);
}
