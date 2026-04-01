/**
 * 用户管理类型定义
 */

// 基础用户接口
export interface SystemUser {
  sid: string;
  username: string;
  password: string;
  name: string;
  avatar?: string;
  status: 'enabled' | 'disabled';
  homePath?: string;
  lastLoginTime?: Date;
  lastLoginIp?: string;
  createTime: Date;
  deleted: number;
}

// 关联员工信息的用户
export interface UserWithEmployee extends SystemUser {
  employeeId?: string;
  employeeNo?: string;
  departmentsName?: string;
  positionName?: string;
}

// 用户列表查询结果
export interface UserListResult {
  list: UserWithEmployee[];
  total: number;
}

// 用户列表查询参数
export interface UserQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
}

// 重置密码DTO
export interface ResetPasswordDto {
  newPassword: string;
}

// 更新状态DTO
export interface UpdateStatusDto {
  status: 'enabled' | 'disabled';
}

// 分配角色DTO
export interface AssignRolesDto {
  roleIds: string[];
}

// 角色信息
export interface UserRole {
  id: string;
  name: string;
  status: 'enabled' | 'disabled';
  permissions?: string[];
}

// 用户角色查询结果
export interface UserRolesResult {
  userId: string;
  username: string;
  roles: UserRole[];
}

// 创建用户DTO
export interface CreateUserDto {
  username: string;
  name: string;
  password: string;
  employeeId?: string;
  avatar?: string;
  status?: 'enabled' | 'disabled';
  homePath?: string;
}

// 更新用户DTO
export interface UpdateUserDto {
  name?: string;
  avatar?: string;
  status?: 'enabled' | 'disabled';
  homePath?: string;
}
