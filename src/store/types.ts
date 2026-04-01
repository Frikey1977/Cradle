// 数据库表类型定义

export interface User {
  sid: string;
  username: string;
  password: string;
  name: string;
  avatar?: string;
  status: 'enabled' | 'disabled';
  home_path?: string;
  employee_id?: string;
  last_login_time?: Date;
  create_time: Date;
  deleted: number;
}

export interface Role {
  sid: string;
  name: string;
  e_name?: string;
  title?: string;
  description?: string;
  permission?: string;
  status: 'enabled' | 'disabled';
  sort?: number;
  create_time: Date;
  deleted: number;
}

export interface Dept {
  sid: string;
  name: string;
  pid: string;
  status: number;
  sort: number;
  remark?: string;
  create_time: Date;
  deleted: number;
}

export interface Module {
  sid: string;
  name: string;
  title?: string;
  type?: string;
  path?: string;
  component?: string;
  pid: string;
  status: number;
  sort: number;
  meta?: string;
  auth_code?: string;
  icon?: string;
  create_time?: Date;
  deleted: number;
}

export interface Permission {
  sid: string;
  name: string;
  code: string;
  description?: string;
  status: number;
  create_time: Date;
  deleted: number;
}

export interface UserRole {
  user_id: string;
  role_id: string;
  create_time: Date;
}

export interface RolePermission {
  role_id: string;
  permission_id: string;
  create_time: Date;
}
