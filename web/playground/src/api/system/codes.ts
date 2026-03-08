import { requestClient } from "#/api/request";

export namespace SystemCodeApi {
  export interface Code {
    sid: string;
    name: string;
    title?: string;
    description?: string;
    icon?: string;
    color?: string;
    createTime?: string;
    deleted: number;
    status: string;
    parentId?: string;
    type?: string;
    value?: string;
    sort: number;
    metadata?: Record<string, any>;
    children?: Code[];
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
}

/**
 * 获取代码列表
 */
export async function getCodeList(params?: SystemCodeApi.CodeQuery) {
  return requestClient.get<SystemCodeApi.Code[]>("/system/codes", {
    params,
  });
}

/**
 * 获取代码树
 */
export async function getCodeTree() {
  return requestClient.get<SystemCodeApi.Code[]>("/system/codes/tree");
}

/**
 * 根据类型获取代码列表
 */
export async function getCodeListByType(type: string) {
  return requestClient.get<SystemCodeApi.Code[]>(`/system/codes/type/${type}`);
}

/**
 * 根据类型获取代码选项（用于下拉选择）
 */
export async function getCodeOptionsByType(type: string) {
  return requestClient.get<{ value: string; label: string; title?: string }[]>(
    `/system/codes/options/${type}`,
  );
}

/**
 * 根据父级代码值获取子代码选项（用于下拉选择）
 * 例如：传入 "system.codes.type" 获取该节点下的所有子代码
 */
export async function getCodeOptionsByParentValue(parentValue: string) {
  return requestClient.get<{ value: string; label: string; title?: string; icon?: string; metadata?: any }[]>(
    `/system/codes/options-by-parent/${parentValue}`,
  );
}

/**
 * 获取代码类型列表
 */
export async function getCodeTypes() {
  return requestClient.get<string[]>("/system/codes/types");
}

/**
 * 获取代码详情
 */
export async function getCodeDetail(id: string) {
  return requestClient.get<SystemCodeApi.Code>(`/system/codes/${id}`);
}

/**
 * 创建代码
 */
export async function createCode(data: SystemCodeApi.CreateCodeDto) {
  return requestClient.post<SystemCodeApi.Code>("/system/codes", data);
}

/**
 * 更新代码
 */
export async function updateCode(id: string, data: SystemCodeApi.UpdateCodeDto) {
  return requestClient.put<SystemCodeApi.Code>(`/system/codes/${id}`, data);
}

/**
 * 更新代码状态
 */
export async function updateCodeStatus(id: string, status: string) {
  return requestClient.put<SystemCodeApi.Code>(`/system/codes/${id}/status`, { status });
}

/**
 * 删除代码
 */
export async function deleteCode(id: string) {
  return requestClient.delete(`/system/codes/${id}`);
}

/**
 * 检查代码值是否存在（同一父级下）
 */
export async function isCodeValueExists(value: string, parentId?: string, excludeId?: string) {
  return requestClient.get<boolean>("/system/codes/value-exists", {
    params: { value, parentId, excludeId },
  });
}
