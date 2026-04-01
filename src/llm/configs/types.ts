/**
 * LLM配置管理类型定义
 */

// 模型调用参数
export interface ModelParameters {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  [key: string]: unknown;
}

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
  createTime?: Date;
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

export interface ConfigQuery {
  providerId?: string;
  status?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}

export interface ConfigListResult {
  list: LlmConfig[];
  total: number;
}

// 认证方式选项
export const AuthMethodOptions = [
  { value: "api_key", label: "API Key" },
  { value: "api_token", label: "API Token" },
] as const;

// 订阅类型选项
export const SubscribeTypeOptions = [
  { value: "free", label: "免费" },
  { value: "privatization", label: "私有部署" },
  { value: "dedicated", label: "独占托管" },
  { value: "prepaid", label: "预付费" },
  { value: "subscription", label: "订阅" },
  { value: "usage", label: "用量" },
] as const;

// 默认配置模板
export const DefaultConfigTemplates: Record<string, { baseUrl: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1" },
  alibaba: { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  zhipu: { baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  anthropic: { baseUrl: "https://api.anthropic.com" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  baidu: { baseUrl: "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop" },
  minimax: { baseUrl: "https://api.minimax.chat/v1" },
};
