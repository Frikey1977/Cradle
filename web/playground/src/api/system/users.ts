/**
 * 用户管理 API 接口
 */
import { requestClient } from "#/api/request";

export namespace SystemUserApi {
  /** 用户信息 */
  export interface User {
    sid: string;
    username: string;
    name: string;
    avatar?: string;
    status: 'enabled' | 'disabled';
    homePath?: string;
    lastLoginTime?: string;
    lastLoginIp?: string;
    createTime: string;
    deleted: number;
    employeeId?: string;
    employeeNo?: string;
    departmentsName?: string;
    positionName?: string;
  }

  /** 用户列表查询参数 */
  export interface UserQuery {
    page?: number;
    pageSize?: number;
    keyword?: string;
  }

  /** 用户列表结果 */
  export interface UserListResult {
    list: User[];
    total: number;
  }

  /** 重置密码参数 */
  export interface ResetPasswordDto {
    newPassword: string;
  }

  /** 更新状态参数 */
  export interface UpdateStatusDto {
    status: 'enabled' | 'disabled';
  }

  /** 分配角色参数 */
  export interface AssignRolesDto {
    roleIds: string[];
  }

  /** 角色信息 */
  export interface UserRole {
    id: string;
    name: string;
    status: 'enabled' | 'disabled';
    permissions?: string[];
  }

  /** 用户角色结果 */
  export interface UserRolesResult {
    userId: string;
    username: string;
    roles: UserRole[];
  }
}

/**
 * 获取用户列表
 */
export async function getUserList(params?: SystemUserApi.UserQuery) {
  return requestClient.get<SystemUserApi.UserListResult>("/system/users", {
    params,
  });
}

/**
 * 获取用户详情
 */
export async function getUserDetail(id: string) {
  return requestClient.get<SystemUserApi.User>(`/system/users/${id}`);
}

/**
 * 重置密码
 */
export async function resetPassword(id: string, data: SystemUserApi.ResetPasswordDto) {
  return requestClient.post(`/system/users/${id}/reset-password`, data);
}

/**
 * 更新用户状态
 */
export async function updateUserStatus(id: string, data: SystemUserApi.UpdateStatusDto) {
  return requestClient.put<SystemUserApi.User>(`/system/users/${id}/status`, data);
}

/**
 * 删除用户
 */
export async function deleteUser(id: string) {
  return requestClient.delete(`/system/users/${id}`);
}

/**
 * 获取用户角色
 */
export async function getUserRoles(id: string) {
  return requestClient.get<SystemUserApi.UserRolesResult>(`/system/users/${id}/roles`);
}

/**
 * 分配用户角色
 */
export async function assignUserRoles(id: string, data: SystemUserApi.AssignRolesDto) {
  return requestClient.put<{ userId: string; assignedRoles: string[] }>(
    `/system/users/${id}/roles`,
    data,
  );
}

/**
 * 获取所有可用角色
 */
export async function getAllRoles() {
  return requestClient.get<SystemUserApi.UserRole[]>("/system/users/roles/all");
}
