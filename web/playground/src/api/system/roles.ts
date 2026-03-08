import type { Recordable } from '@vben/types';

import { requestClient } from '#/api/request';

export namespace SystemRoleApi {
  export interface PermissionJson {
    modules?: string[];
    actions?: string[];
    permissions?: string[];
  }

  export interface SystemRole {
    [key: string]: any;
    id: string;
    name: string;
    e_name?: string;
    title?: string;
    description?: string;
    permission?: PermissionJson;
    status: 'enabled' | 'disabled';
    sort?: number;
    createTime?: string;
  }
}

/**
 * 获取角色列表数据
 */
async function getRoleList(params?: Recordable<any>) {
  return requestClient.get<SystemRoleApi.SystemRole[]>(
    '/system/roles/list',
    { params },
  );
}

/**
 * 获取角色详情
 * @param id 角色 ID
 */
async function getRoleDetail(id: string) {
  return requestClient.get<SystemRoleApi.SystemRole>(`/system/roles/${id}`);
}

/**
 * 创建角色
 * @param data 角色数据
 */
async function createRole(data: Omit<SystemRoleApi.SystemRole, 'id' | 'createTime'>) {
  return requestClient.post('/system/role', data);
}

/**
 * 更新角色
 *
 * @param id 角色 ID
 * @param data 角色数据
 */
async function updateRole(
  id: string,
  data: Omit<SystemRoleApi.SystemRole, 'id' | 'createTime'>,
) {
  return requestClient.put(`/system/roles/${id}`, data);
}

/**
 * 删除角色
 * @param id 角色 ID
 */
async function deleteRole(id: string) {
  return requestClient.delete(`/system/roles/${id}`);
}

/**
 * 更新角色状态
 * @param id 角色 ID
 * @param status 状态
 */
async function updateRoleStatus(id: string, status: 'enabled' | 'disabled') {
  return requestClient.put(`/system/roles/${id}/status`, { status });
}

export {
  createRole,
  deleteRole,
  getRoleDetail,
  getRoleList,
  updateRole,
  updateRoleStatus,
};
