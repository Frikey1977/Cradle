/**
 * 代码管理类型定义
 */

export interface SystemCode {
  sid: string;
  name: string;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  createTime?: Date;
  deleted: number;
  status: string;
  parentId?: string;
  type?: string;
  value?: string;
  sort: number;
  metadata?: Record<string, any>;
  children?: SystemCode[];
}

export interface CreateCodeDto {
  name: string;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  type?: string;
  value?: string;
  status?: string;
  sort?: number;
  metadata?: Record<string, any>;
}

export interface UpdateCodeDto {
  name?: string;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  type?: string;
  value?: string;
  status?: string;
  sort?: number;
  metadata?: Record<string, any>;
}

export interface CodeQuery {
  type?: string;
  status?: string;
  keyword?: string;
  parentId?: string;
}

export interface UpdateStatusDto {
  status: string;
}
