/**
 * 客户管理类型定义
 */

export interface Customer {
  sid: string;
  customerNo: string;
  name: string;
  type: string;
  level: string;
  industry?: string;
  scale?: string;
  region?: string;
  address?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  website?: string;
  ownerId?: string;
  remark?: string;
  lastFollowTime?: string;
  opportunityCount: number;
  dealCount: number;
  totalDealAmount: number;
  status: string;
  description?: string;
  createTime?: string;
  timestamp?: string;
  deleted: number;
}

export interface CreateCustomerDto {
  name: string;
  type: string;
  level?: string;
  industry?: string;
  scale?: string;
  region?: string;
  address?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  website?: string;
  ownerId?: string;
  remark?: string;
  description?: string;
  status?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  type?: string;
  level?: string;
  industry?: string;
  scale?: string;
  region?: string;
  address?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  website?: string;
  ownerId?: string;
  remark?: string;
  description?: string;
  status?: string;
}

export interface CustomerQuery {
  keyword?: string;
  type?: string;
  level?: string;
  ownerId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedCustomerResult {
  list: Customer[];
  total: number;
  page: number;
  pageSize: number;
}
