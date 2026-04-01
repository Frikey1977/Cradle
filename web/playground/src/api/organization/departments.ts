import { requestClient } from "#/api/request";

export namespace OrganizationApi {
  export const OrgTypes = ["company", "branch", "department", "group"] as const;

  export interface Organization {
    [key: string]: any;
    sid: string;
    name: string;
    eName?: string;
    title: string;
    icon?: string;
    code: string;
    type: (typeof OrgTypes)[number];
    parentId?: string;
    path: string;
    sort: number;
    leaderId?: string;
    description?: string;
    culture?: string; // 企业文化描述，纯文本字段
    status: string;
    createTime?: string;
    children?: Organization[];
  }
}

/**
 * 获取组织架构列表（树形结构）
 */
async function getOrgTree() {
  return requestClient.get<OrganizationApi.Organization[]>("/departments/tree");
}

/**
 * 获取组织架构列表（扁平结构）
 */
async function getOrgList() {
  return requestClient.get<OrganizationApi.Organization[]>("/departments");
}

/**
 * 获取组织架构详情
 * @param sid 组织ID
 */
async function getOrgDetail(sid: string) {
  return requestClient.get<OrganizationApi.Organization>(`/departments/${sid}`);
}

/**
 * 创建组织架构
 * @param data 组织数据
 */
async function createOrg(
  data: Omit<OrganizationApi.Organization, "sid" | "children" | "path" | "level" | "createTime">
) {
  return requestClient.post("/departments", data);
}

/**
 * 更新组织架构
 * @param sid 组织ID
 * @param data 组织数据
 */
async function updateOrg(
  sid: string,
  data: Omit<OrganizationApi.Organization, "sid" | "children" | "path" | "level" | "createTime">
) {
  return requestClient.put(`/departments/${sid}`, data);
}

/**
 * 删除组织架构
 * @param sid 组织ID
 */
async function deleteOrg(sid: string) {
  return requestClient.delete(`/departments/${sid}`);
}

/**
 * 移动组织架构
 * @param sid 组织ID
 * @param parentId 新的父组织ID
 */
async function moveOrg(sid: string, parentId: string) {
  return requestClient.put(`/departments/${sid}/move`, { parentId });
}

/**
 * 检查组织编码是否存在
 * @param code 组织编码
 * @param sid 排除的组织ID（编辑时使用）
 */
async function isOrgCodeExists(code: string, sid?: string) {
  return requestClient.get<boolean>("/departments/code-exists", {
    params: { code, sid },
  });
}

export {
  createOrg,
  deleteOrg,
  getOrgDetail,
  getOrgList,
  getOrgTree,
  isOrgCodeExists,
  moveOrg,
  updateOrg,
};
