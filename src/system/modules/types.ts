/**
 * 模块管理类型定义
 */

export interface SystemModule {
  sid: string;
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid: string;
  status: string;
  sort: number;
  meta?: string;
  auth_code?: string;
  icon?: string;
  createTime?: Date;
  deleted: number;
  children?: SystemModule[];
}

export interface CreateModuleDto {
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid?: string;
  status?: string;
  sort?: number;
  meta?: object;
  auth_code?: string;
  icon?: string;
}

export interface UpdateModuleDto {
  name?: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid?: string;
  status?: string;
  sort?: number;
  meta?: object;
  auth_code?: string;
  icon?: string;
}

export interface UpdateStatusDto {
  status: string;
  cascade?: boolean;
}

export interface ModuleQuery {
  status?: string;
  type?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}

export interface NameExistsQuery {
  id?: string;
  name: string;
}

export interface PathExistsQuery {
  id?: string;
  path: string;
}
