/**
 * 商机管理类型定义
 */

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

export interface PaginatedOpportunityResult {
  list: Opportunity[];
  total: number;
  page: number;
  pageSize: number;
}

// 商机阶段与赢率映射
export const STAGE_PROBABILITY_MAP: Record<string, number> = {
  initial: 10,
  needs: 30,
  proposal: 60,
  negotiation: 80,
  won: 100,
  lost: 0,
};
