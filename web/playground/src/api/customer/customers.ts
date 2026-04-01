import { requestClient } from "#/api/request";

export namespace CustomerApi {
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

  export interface PaginatedResult {
    list: Customer[];
    total: number;
    page: number;
    pageSize: number;
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
}

// 获取客户列表（分页）
export function getCustomerList(params?: CustomerApi.CustomerQuery) {
  return requestClient.get<CustomerApi.PaginatedResult>("/customer/customers", {
    params,
  });
}

// 获取所有客户（不分页）
export function getAllCustomers(
  params?: Omit<CustomerApi.CustomerQuery, "page" | "pageSize">,
) {
  return requestClient.get<CustomerApi.Customer[]>("/customer/customers/all", {
    params,
  });
}

// 获取客户详情
export function getCustomerById(sid: string) {
  return requestClient.get<CustomerApi.Customer>(`/customer/customers/${sid}`);
}

// 创建客户
export function createCustomer(data: CustomerApi.CreateCustomerDto) {
  return requestClient.post<{ sid: string }>("/customer/customers", data);
}

// 更新客户
export function updateCustomer(
  sid: string,
  data: CustomerApi.UpdateCustomerDto,
) {
  return requestClient.put<void>(`/customer/customers/${sid}`, data);
}

// 删除客户
export function deleteCustomer(sid: string) {
  return requestClient.delete<void>(`/customer/customers/${sid}`);
}
