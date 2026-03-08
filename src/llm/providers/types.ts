/**
 * LLM提供商管理类型定义
 */

export interface LlmProvider {
  sid: string;
  name: string;
  title?: string;
  ename: string;
  description?: string;
  icon?: string;
  color?: string;
  sort: number;
  status: string;
  createTime?: Date;
  deleted: number;
}

export interface CreateProviderDto {
  name: string;
  title?: string;
  ename: string;
  description?: string;
  icon?: string;
  color?: string;
  sort?: number;
  status?: string;
}

export interface UpdateProviderDto {
  name?: string;
  title?: string;
  ename?: string;
  description?: string;
  icon?: string;
  color?: string;
  sort?: number;
  status?: string;
}

export interface ProviderQuery {
  status?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}

export interface NameExistsQuery {
  id?: string;
  name: string;
}
