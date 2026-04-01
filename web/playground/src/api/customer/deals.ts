import { requestClient } from "#/api/request";

export namespace DealApi {
  export interface Deal {
    sid: string;
    dealNo: string;
    customerId: string;
    customerName?: string;
    opportunityId?: string;
    opportunityName?: string;
    name: string;
    amount: number;
    paidAmount: number;
    unpaidAmount: number;
    paymentMethod?: string;
    signDate?: string;
    expectedDeliveryDate?: string;
    actualDeliveryDate?: string;
    status: string;
    contractFiles?: string;
    remark?: string;
    ownerId?: string;
    ownerName?: string;
    createTime?: string;
    timestamp?: string;
    deleted: number;
  }

  export interface PaginatedResult {
    list: Deal[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface CreateDealDto {
    customerId: string;
    opportunityId?: string;
    name: string;
    amount: number;
    paymentMethod?: string;
    signDate?: string;
    expectedDeliveryDate?: string;
    status?: string;
    remark?: string;
    ownerId?: string;
  }

  export interface UpdateDealDto {
    customerId?: string;
    opportunityId?: string;
    name?: string;
    amount?: number;
    paidAmount?: number;
    paymentMethod?: string;
    signDate?: string;
    expectedDeliveryDate?: string;
    actualDeliveryDate?: string;
    status?: string;
    contractFiles?: string;
    remark?: string;
    ownerId?: string;
  }

  export interface DealQuery {
    keyword?: string;
    customerId?: string;
    opportunityId?: string;
    status?: string;
    ownerId?: string;
    page?: number;
    pageSize?: number;
  }
}

// 获取成交列表（分页）
export function getDealList(params?: DealApi.DealQuery) {
  return requestClient.get<DealApi.PaginatedResult>("/customer/deals", {
    params,
  });
}

// 获取所有成交（不分页）
export function getAllDeals(
  params?: Omit<DealApi.DealQuery, "page" | "pageSize">,
) {
  return requestClient.get<DealApi.Deal[]>("/customer/deals/all", {
    params,
  });
}

// 获取成交详情
export function getDealById(sid: string) {
  return requestClient.get<DealApi.Deal>(`/customer/deals/${sid}`);
}

// 获取客户的成交列表
export function getDealsByCustomer(customerId: string) {
  return requestClient.get<DealApi.Deal[]>(
    `/customer/deals/customer/${customerId}`,
  );
}

// 创建成交
export function createDeal(data: DealApi.CreateDealDto) {
  return requestClient.post<{ sid: string }>("/customer/deals", data);
}

// 更新成交
export function updateDeal(sid: string, data: DealApi.UpdateDealDto) {
  return requestClient.put<void>(`/customer/deals/${sid}`, data);
}

// 删除成交
export function deleteDeal(sid: string) {
  return requestClient.delete<void>(`/customer/deals/${sid}`);
}
