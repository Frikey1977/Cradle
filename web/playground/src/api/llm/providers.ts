import type { Recordable } from "@vben/types";
import { requestClient } from "#/api/request";

export namespace LlmProviderApi {
  export interface LlmProvider {
    sid: string;
    name: string;
    title?: string;
    ename: string;
    description?: string;
    icon?: string;
    color?: string;
    sort: number;
    status: string;
    createTime?: string;
    deleted: number;
  }

  export interface CreateProviderDto {
    name: string;
    title?: string;
    ename: string;
    description?: string;
    icon?: string;
    color?: string;
    sort?: number;
    status?: string;
  }

  export interface UpdateProviderDto {
    name?: string;
    title?: string;
    ename?: string;
    description?: string;
    icon?: string;
    color?: string;
    sort?: number;
    status?: string;
  }
}

async function getProviderList(params?: Recordable<any>) {
  return requestClient.get<{ list: LlmProviderApi.LlmProvider[]; total: number }>("/llm/providers", {
    params,
  });
}

async function getAllProviders() {
  return requestClient.get<LlmProviderApi.LlmProvider[]>("/llm/providers/all");
}

async function getProviderById(sid: string) {
  return requestClient.get<LlmProviderApi.LlmProvider>(`/llm/providers/${sid}`);
}

async function isProviderNameExists(name: string, sid?: string) {
  return requestClient.get<boolean>("/llm/providers/name-exists", {
    params: { id: sid, name },
  });
}

async function createProvider(data: LlmProviderApi.CreateProviderDto) {
  return requestClient.post("/llm/providers", data);
}

async function updateProvider(sid: string, data: LlmProviderApi.UpdateProviderDto) {
  return requestClient.put(`/llm/providers/${sid}`, data);
}

async function deleteProvider(sid: string) {
  return requestClient.delete(`/llm/providers/${sid}`);
}

export {
  createProvider,
  deleteProvider,
  getAllProviders,
  getProviderById,
  getProviderList,
  isProviderNameExists,
  updateProvider,
};
