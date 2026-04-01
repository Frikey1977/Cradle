/**
 * 跟进记录类型定义
 */

export interface Followup {
  sid: string;
  followupNo: string;
  customerId: string;
  customerName?: string;
  opportunityId?: string;
  opportunityName?: string;
  method: string;
  followTime: string;
  content: string;
  feedback?: string;
  nextFollowDate?: string;
  nextFollowContent?: string;
  reminder: number;
  reminderTime?: string;
  attachments?: string;
  createBy?: string;
  createByName?: string;
  createTime?: string;
  timestamp?: string;
  deleted: number;
}

export interface CreateFollowupDto {
  customerId: string;
  opportunityId?: string;
  method: string;
  followTime?: string;
  content: string;
  feedback?: string;
  nextFollowDate?: string;
  nextFollowContent?: string;
  reminder?: number;
  reminderTime?: string;
  attachments?: string;
}

export interface UpdateFollowupDto {
  customerId?: string;
  opportunityId?: string;
  method?: string;
  followTime?: string;
  content?: string;
  feedback?: string;
  nextFollowDate?: string;
  nextFollowContent?: string;
  reminder?: number;
  reminderTime?: string;
  attachments?: string;
}

export interface FollowupQuery {
  keyword?: string;
  customerId?: string;
  opportunityId?: string;
  method?: string;
  createBy?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedFollowupResult {
  list: Followup[];
  total: number;
  page: number;
  pageSize: number;
}
