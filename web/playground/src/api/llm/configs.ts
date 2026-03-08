import type { Recordable } from "@vben/types";
import { requestClient } from "#/api/request";

export const AuthMethodOptions = [
  { value: "api_key", label: "API Key" },
  { value: "api_token", label: "API Token" },
] as const;

export const DefaultConfigTemplates: Record<string, { baseUrl?: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  alibaba: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  anthropic: { baseUrl: "https://api.anthropic.com" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  baidu: { baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop" },
  minimax: { baseUrl: "https://api.minimax.chat/v1" },
};

// 模型参数
export interface ModelParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  [key: string]: unknown;
}

export namespace LlmConfigApi {
  export interface LlmConfig {
    sid: string;
    name: string;
    description?: string;
    providerId: string;
    baseUrl: string;
    subscribeType: string;
    icon?: string;
    modelName: string;
    modelType: string;
    contextSize: number;
    parameters?: ModelParameters;
    enableThinking: string;
    stream: string;
    authMethod: string;
    providerName?: string;
    modelAbility?: string[];
    timeout: number;
    retries: number;
    sort: number;
    status: string;
    createTime?: string;
    deleted: number;
  }

  export interface CreateConfigDto {
    name: string;
    description?: string;
    providerId: string;
    baseUrl: string;
    subscribeType?: string;
    icon?: string;
    modelName: string;
    modelType?: string;
    contextSize?: number;
    parameters?: ModelParameters;
    enableThinking?: string;
    stream?: string;
    authMethod?: string;
    providerName?: string;
    modelAbility?: string[];
    timeout?: number;
    retries?: number;
    sort?: number;
    status?: string;
  }

  export interface UpdateConfigDto {
    name?: string;
    description?: string;
    providerId?: string;
    baseUrl?: string;
    subscribeType?: string;
    icon?: string;
    modelName?: string;
    modelType?: string;
    contextSize?: number;
    parameters?: ModelParameters;
    enableThinking?: string;
    stream?: string;
    authMethod?: string;
    providerName?: string;
    modelAbility?: string[];
    timeout?: number;
    retries?: number;
    sort?: number;
    status?: string;
  }

  export interface ConfigListResult {
    list: LlmConfig[];
    total: number;
  }
}

async function getConfigList(params?: Recordable<any>) {
  return requestClient.get<LlmConfigApi.ConfigListResult>("/llm/configs", {
    params,
  });
}

async function getAllConfigs(providerId?: string) {
  return requestClient.get<LlmConfigApi.LlmConfig[]>("/llm/configs/all", {
    params: { providerId },
  });
}

async function getConfigById(sid: string) {
  return requestClient.get<LlmConfigApi.LlmConfig>(`/llm/configs/${sid}`);
}

async function isConfigNameExists(name: string, providerId: string, sid?: string) {
  return requestClient.get<boolean>("/llm/configs/name-exists", {
    params: { id: sid, name, providerId },
  });
}

async function getConfigCountByProvider(providerId: string) {
  return requestClient.get<{ count: number }>(`/llm/configs/count/${providerId}`);
}

async function createConfig(data: LlmConfigApi.CreateConfigDto) {
  return requestClient.post("/llm/configs", data);
}

async function updateConfig(sid: string, data: LlmConfigApi.UpdateConfigDto) {
  return requestClient.put(`/llm/configs/${sid}`, data);
}

async function deleteConfig(sid: string) {
  return requestClient.delete(`/llm/configs/${sid}`);
}

export {
  createConfig,
  deleteConfig,
  getAllConfigs,
  getConfigById,
  getConfigCountByProvider,
  getConfigList,
  isConfigNameExists,
  updateConfig,
};
