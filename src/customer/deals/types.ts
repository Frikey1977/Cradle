/**
 * 成交管理类型定义
 */

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

export interface PaginatedDealResult {
  list: Deal[];
  total: number;
  page: number;
  pageSize: number;
}
