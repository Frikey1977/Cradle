import { requestClient } from "#/api/request";

export namespace OpportunityApi {
  export interface Opportunity {
    sid: string;
    opportunityNo: string;
    customerId: string;
    customerName?: string;
    name: string;
    source?: string;
    stage: string;
    probability: number;
    amount: number;
    expectedAmount: number;
    actualAmount: number;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    closeReason?: string;
    description?: string;
    ownerId?: string;
    ownerName?: string;
    status: string;
    createTime?: string;
    timestamp?: string;
    deleted: number;
  }

  export interface PaginatedResult {
    list: Opportunity[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface CreateOpportunityDto {
    customerId: string;
    name: string;
    source?: string;
    stage?: string;
    probability?: number;
    amount?: number;
    expectedCloseDate?: string;
    description?: string;
    ownerId?: string;
    status?: string;
  }

  export interface UpdateOpportunityDto {
    customerId?: string;
    name?: string;
    source?: string;
    stage?: string;
    probability?: number;
    amount?: number;
    expectedCloseDate?: string;
    actualCloseDate?: string;
    closeReason?: string;
    description?: string;
    ownerId?: string;
    status?: string;
  }

  export interface OpportunityQuery {
    keyword?: string;
    customerId?: string;
    stage?: string;
    source?: string;
    ownerId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
}

// 获取商机列表（分页）
export function getOpportunityList(params?: OpportunityApi.OpportunityQuery) {
  return requestClient.get<OpportunityApi.PaginatedResult>(
    "/customer/opportunities",
    { params },
  );
}

// 获取所有商机（不分页）
export function getAllOpportunities(
  params?: Omit<OpportunityApi.OpportunityQuery, "page" | "pageSize">,
) {
  return requestClient.get<OpportunityApi.Opportunity[]>(
    "/customer/opportunities/all",
    { params },
  );
}

// 获取商机详情
export function getOpportunityById(sid: string) {
  return requestClient.get<OpportunityApi.Opportunity>(
    `/customer/opportunities/${sid}`,
  );
}

// 获取客户的商机列表
export function getOpportunitiesByCustomer(customerId: string) {
  return requestClient.get<OpportunityApi.Opportunity[]>(
    `/customer/opportunities/customer/${customerId}`,
  );
}

// 创建商机
export function createOpportunity(data: OpportunityApi.CreateOpportunityDto) {
  return requestClient.post<{ sid: string }>("/customer/opportunities", data);
}

// 更新商机
export function updateOpportunity(
  sid: string,
  data: OpportunityApi.UpdateOpportunityDto,
) {
  return requestClient.put<void>(`/customer/opportunities/${sid}`, data);
}

// 删除商机
export function deleteOpportunity(sid: string) {
  return requestClient.delete<void>(`/customer/opportunities/${sid}`);
}
