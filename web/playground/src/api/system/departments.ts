import { requestClient } from "#/api/request";

export namespace SystemDeptApi {
  export interface SystemDept {
    [key: string]: any;
    id: string;
    name: string;
    pid?: string;
    status: string;
    remark?: string;
    children?: SystemDept[];
  }
}

/**
 * 获取部门列表（树形结构）
 */
async function getDeptList() {
  return requestClient.get<SystemDeptApi.SystemDept[]>("/system/departments");
}

/**
 * 创建部门
 * @param data 部门数据
 */
async function createDept(data: Omit<SystemDeptApi.SystemDept, "id" | "children">) {
  return requestClient.post("/system/departments", data);
}

/**
 * 更新部门
 * @param id 部门 ID
 * @param data 部门数据
 */
async function updateDept(id: string, data: Omit<SystemDeptApi.SystemDept, "id" | "children">) {
  return requestClient.put(`/system/departments/${id}`, data);
}

/**
 * 删除部门
 * @param id 部门 ID
 */
async function deleteDept(id: string) {
  return requestClient.delete(`/system/departments/${id}`);
}

export { createDept, deleteDept, getDeptList, updateDept };
