import type { Recordable } from "@vben/types";
import { requestClient } from "#/api/request";

// 计费类型选项
export const BillingTypeOptions = [
  { value: "free", label: "llm.instances.billingTypes.free", color: "green" },
  { value: "privatization", label: "llm.instances.billingTypes.privatization", color: "blue" },
  { value: "dedicated", label: "llm.instances.billingTypes.dedicated", color: "purple" },
  { value: "prepaid", label: "llm.instances.billingTypes.prepaid", color: "orange" },
  { value: "subscription", label: "llm.instances.billingTypes.subscription", color: "cyan" },
  { value: "usage", label: "llm.instances.billingTypes.usage", color: "default" },
] as const;

// 自定义请求头
export interface CustomHeaders {
  [key: string]: string;
}

export namespace LlmInstanceApi {
  export interface LlmInstance {
    sid: string;
    name: string;
    description?: string;
    providerName: string;
    configId: string;
    apiKey: string;
    apiKeyHash: string;
    headers?: CustomHeaders;
    billingType: string;
    weight: number;
    dailyQuota?: number;
    dailyUsed: number;
    failCount: number;
    cooldownUntil?: string;
    lastUsedAt?: string;
    sort: number;
    createTime?: string;
    deleted: number;
    status: string;
  }

  export interface CreateInstanceDto {
    name: string;
    description?: string;
    providerName: string;
    configId: string;
    apiKey: string;
    headers?: CustomHeaders;
    billingType?: string;
    weight?: number;
    dailyQuota?: number;
    sort?: number;
    status?: string;
  }

  export interface UpdateInstanceDto {
    name?: string;
    description?: string;
    providerName?: string;
    configId?: string;
    apiKey?: string;
    headers?: CustomHeaders;
    billingType?: string;
    weight?: number;
    dailyQuota?: number;
    sort?: number;
    status?: string;
  }

  export interface InstanceListResult {
    list: LlmInstance[];
    total: number;
  }
}

async function getInstanceList(params?: Recordable<any>) {
  return requestClient.get<LlmInstanceApi.InstanceListResult>("/llm/instances", {
    params,
  });
}

async function getAllInstances(configId?: string) {
  return requestClient.get<LlmInstanceApi.LlmInstance[]>("/llm/instances/all", {
    params: { configId },
  });
}

async function getInstanceById(sid: string) {
  return requestClient.get<LlmInstanceApi.LlmInstance>(`/llm/instances/${sid}`);
}

async function isInstanceNameExists(name: string, configId: string, sid?: string) {
  return requestClient.get<boolean>("/llm/instances/name-exists", {
    params: { id: sid, name, configId },
  });
}

async function isApiKeyExists(apiKey: string, configId: string, sid?: string) {
  return requestClient.get<boolean>("/llm/instances/apikey-exists", {
    params: { id: sid, apiKey, configId },
  });
}

async function getInstanceCountByConfig(configId: string) {
  return requestClient.get<{ count: number }>(`/llm/instances/count/${configId}`);
}

async function createInstance(data: LlmInstanceApi.CreateInstanceDto) {
  return requestClient.post("/llm/instances", data);
}

async function updateInstance(sid: string, data: LlmInstanceApi.UpdateInstanceDto) {
  return requestClient.put(`/llm/instances/${sid}`, data);
}

async function deleteInstance(sid: string) {
  return requestClient.delete(`/llm/instances/${sid}`);
}

export {
  createInstance,
  deleteInstance,
  getAllInstances,
  getInstanceById,
  getInstanceCountByConfig,
  getInstanceList,
  isApiKeyExists,
  isInstanceNameExists,
  updateInstance,
};
