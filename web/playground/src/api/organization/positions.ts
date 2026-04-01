import { requestClient } from "#/api/request";

export namespace OrganizationPositionApi {
  export interface PositionSkill {
    skillId: string;
    skillName?: string;
    skillSlug?: string;
    config?: Record<string, any>;
    invocation?: "auto" | "user_only" | "disabled";
    priority?: number;
  }

  export interface Position {
    [key: string]: any;
    id: string;
    name: string;
    eName?: string;
    title?: string;
    code: string;
    type?: string;
    oid: string;
    description?: string;
    level?: string;
    dataScope: string;
    status: string;
    createTime?: string;
    organization?: {
      name: string;
      title?: string;
    };
    skills?: PositionSkill[];
  }

  export interface PositionListResult {
    items: Position[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface PositionQuery {
    oid?: string;
    keyword?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
}

/**
 * 获取岗位列表
 * @param params 查询参数
 */
async function getPositionList(params?: OrganizationPositionApi.PositionQuery) {
  return requestClient.get<OrganizationPositionApi.PositionListResult>("/positions", {
    params,
  });
}

/**
 * 获取岗位详情
 * @param id 岗位ID
 */
async function getPositionDetail(id: string) {
  return requestClient.get<OrganizationPositionApi.Position>(`/positions/${id}`);
}

/**
 * 创建岗位
 * @param data 岗位数据
 */
async function createPosition(
  data: Omit<OrganizationPositionApi.Position, "id" | "createTime" | "orgName" | "profile">,
) {
  return requestClient.post("/positions", data);
}

/**
 * 更新岗位
 * @param id 岗位ID
 * @param data 岗位数据
 */
async function updatePosition(
  id: string,
  data: Partial<Omit<OrganizationPositionApi.Position, "id" | "createTime" | "orgName" | "profile">>,
) {
  return requestClient.put(`/positions/${id}`, data);
}

/**
 * 删除岗位
 * @param id 岗位ID
 */
async function deletePosition(id: string) {
  return requestClient.delete(`/positions/${id}`);
}

/**
 * 检查岗位编码是否存在
 * @param code 岗位编码
 * @param id 排除的岗位ID（编辑时使用）
 */
async function isPositionCodeExists(code: string, id?: string) {
  return requestClient.get<boolean>("/positions/code-exists", {
    params: { code, id },
  });
}

/**
 * 获取岗位关联的技能列表
 * @param id 岗位ID
 */
async function getPositionSkills(id: string) {
  return requestClient.get<OrganizationPositionApi.PositionSkill[]>(`/positions/${id}/skills`);
}

/**
 * 保存岗位关联的技能
 * @param id 岗位ID
 * @param skills 技能列表
 */
async function savePositionSkills(id: string, skills: OrganizationPositionApi.PositionSkill[]) {
  return requestClient.put(`/positions/${id}/skills`, { skills });
}

export {
  createPosition,
  deletePosition,
  getPositionDetail,
  getPositionList,
  isPositionCodeExists,
  updatePosition,
  getPositionSkills,
  savePositionSkills,
};
