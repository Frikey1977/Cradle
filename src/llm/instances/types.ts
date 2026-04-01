/**
 * LLM实例管理类型定义
 * 对应表: t_llm_instances
 */

// 计费类型
export type BillingType = "free" | "privatization" | "dedicated" | "prepaid" | "subscription" | "usage";

// 实例状态
export type InstanceStatus = "enabled" | "disabled";

// 自定义请求头
export interface CustomHeaders {
  [key: string]: string;
}

export interface LlmInstance {
  sid: string;
  name: string;
  description?: string;
  providerName: string;
  configId: string;
  apiKey: string;
  apiKeyHash: string;
  headers?: CustomHeaders;
  billingType: BillingType;
  weight: number;
  dailyQuota?: number;
  dailyUsed: number;
  failCount: number;
  cooldownUntil?: Date;
  lastUsedAt?: Date;
  sort: number;
  createTime?: Date;
  deleted: number;
  status: InstanceStatus;
}

export interface CreateInstanceDto {
  name: string;
  description?: string;
  providerName: string;
  configId: string;
  apiKey: string;
  headers?: CustomHeaders;
  billingType?: BillingType;
  weight?: number;
  dailyQuota?: number;
  sort?: number;
  status?: InstanceStatus;
}

export interface UpdateInstanceDto {
  name?: string;
  description?: string;
  providerName?: string;
  configId?: string;
  apiKey?: string;
  headers?: CustomHeaders;
  billingType?: BillingType;
  weight?: number;
  dailyQuota?: number;
  sort?: number;
  status?: InstanceStatus;
}

export interface InstanceQuery {
  configId?: string;
  status?: string;
  billingType?: string;
  keyword?: string;
  page?: string;
  pageSize?: string;
}

export interface InstanceListResult {
  list: LlmInstance[];
  total: number;
}

// 计费类型选项
export const BillingTypeOptions = [
  { value: "free", label: "llm.instances.billingTypes.free" },
  { value: "privatization", label: "llm.instances.billingTypes.privatization" },
  { value: "dedicated", label: "llm.instances.billingTypes.dedicated" },
  { value: "prepaid", label: "llm.instances.billingTypes.prepaid" },
  { value: "subscription", label: "llm.instances.billingTypes.subscription" },
  { value: "usage", label: "llm.instances.billingTypes.usage" },
] as const;

// 状态选项
export const InstanceStatusOptions = [
  { value: "enabled", label: "common.enabled" },
  { value: "disabled", label: "common.disabled" },
] as const;
