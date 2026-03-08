/**
 * 联系人管理类型定义
 * 对应设计文档: design/organization/database/t_contacts.md
 */

export interface Contact {
  sid: string;
  type: ContactType;
  sourceId?: string;
  sourceName?: string;  // 关联源的名称（如员工姓名）
  profile?: ContactProfile;
  status: ContactStatus;
  description?: string;
  createTime?: string;
  timestamp?: string;
}

export type ContactType = "employee" | "customer" | "partner" | "visitor";

export type ContactStatus = "enabled" | "disabled";

export interface ContactProfile {
  [key: string]: any;
}

export interface CreateContactDto {
  type: ContactType;
  sourceId?: string;
  profile?: ContactProfile;
  status?: ContactStatus;
  description?: string;
}

export interface UpdateContactDto {
  type?: ContactType;
  sourceId?: string;
  profile?: ContactProfile;
  status?: ContactStatus;
  description?: string;
}

export interface ContactQuery {
  type?: ContactType;
  keyword?: string;
  status?: ContactStatus;
  page?: number;
  pageSize?: number;
}

export interface ContactListResult {
  items: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContactExistsQuery {
  type: ContactType;
  sourceId?: string;
  sid?: string;
}
