/**
 * 组织架构类型定义
 */

export interface Organization {
  sid: string;
  name: string;
  eName?: string;
  title?: string;
  icon?: string;
  code: string;
  type: string;
  parentId: string | null;
  path: string;
  sort: number;
  leaderId?: string;
  description?: string;
  culture?: string; // 企业文化描述，纯文本字段
  status: string;
  createTime?: string;
  children?: Organization[];
}

export interface CreateOrgDto {
  name: string;
  eName?: string;
  title?: string;
  icon?: string;
  code: string;
  type: string;
  parentId?: string;
  sort?: number;
  leaderId?: string;
  description?: string;
  culture?: string; // 企业文化描述，纯文本字段
  status?: string;
}

export interface UpdateOrgDto {
  name?: string;
  eName?: string;
  title?: string;
  icon?: string;
  code?: string;
  type?: string;
  parentId?: string;
  sort?: number;
  leaderId?: string;
  description?: string;
  culture?: string; // 企业文化描述，纯文本字段
  status?: string;
}

export interface MoveOrgDto {
  parentId: string;
}

export interface OrgQuery {
  type?: string;
  status?: number;
}

export interface CodeExistsQuery {
  code: string;
  sid?: string;
}
