/**
 * AI 智能表单辅助 API
 * 提供表单字段的智能补全功能
 */

import { requestClient } from "#/api/request";

export interface SmartFormRequest {
  /** 模块标识 */
  module: string;
  /** 表单类型 */
  formType: string;
  /** 当前表单数据 */
  formData: Record<string, any>;
  /** 目标字段名 */
  targetField: string;
  /** 提示词 */
  prompt?: string;
  /** 字段验证规则 */
  validation?: {
    maxLength?: number;
    minLength?: number;
    required?: boolean;
  };
}

export interface SmartFormResponse {
  /** 建议值 */
  suggestion: string;
  /** 备选建议 */
  alternatives?: string[];
  /** 建议说明 */
  reasoning?: string;
  /** 置信度 0-1 */
  confidence?: number;
}

/**
 * 获取表单字段智能建议
 */
export async function getSmartFormSuggestion(
  data: SmartFormRequest
): Promise<SmartFormResponse> {
  return requestClient.post("/ai/smart-form", data, {
    timeout: 60000, // 60秒超时，AI生成可能需要较长时间
  });
}
