/**
 * 主流 LLM 模型预置配置
 * 用户创建 config 时可选择，自动填充模型参数
 */

export interface PresetModel {
  id: string;                    // 模型唯一标识
  name: string;                  // 显示名称
  provider: string;              // 提供商
  contextWindow: number;         // 上下文窗口
  maxTokens?: number;            // 最大输出 token
  capabilities: {
    vision?: boolean;
    functionCall?: boolean;
    jsonMode?: boolean;
    streaming?: boolean;
    embeddings?: boolean;
    audio?: boolean;
    code?: boolean;
  };
  pricing?: {
    input: number;
    output: number;
    unit: string;
    currency: string;
  };
  description?: string;
}

// 阿里云 DashScope 模型
export const DASHSCOPE_MODELS: PresetModel[] = [
  {
    id: 'qwen-max',
    name: '通义千问-Max',
    provider: 'alibaba',
    contextWindow: 32768,
    maxTokens: 8192,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.02,
      output: 0.06,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '通义千问系列最强模型，适合复杂任务',
  },
  {
    id: 'qwen-plus',
    name: '通义千问-Plus',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.0008,
      output: 0.002,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '效果与速度平衡，适合大多数场景',
  },
  {
    id: 'qwen-turbo',
    name: '通义千问-Turbo',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.0003,
      output: 0.0006,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '速度快、成本低，适合简单任务',
  },
  {
    id: 'qwen-vl-max',
    name: '通义千问VL-Max',
    provider: 'alibaba',
    contextWindow: 32768,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.02,
      output: 0.02,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '视觉理解模型，支持图像输入',
  },
  {
    id: 'qwen-vl-plus',
    name: '通义千问VL-Plus',
    provider: 'alibaba',
    contextWindow: 8192,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: false,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.008,
      output: 0.008,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '视觉理解模型，性价比高',
  },
  {
    id: 'qwen-coder-plus',
    name: '通义千问Coder-Plus',
    provider: 'alibaba',
    contextWindow: 131072,
    maxTokens: 8192,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
      code: true,
    },
    pricing: {
      input: 0.0008,
      output: 0.002,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '代码专用模型，支持多种编程语言',
  },
  {
    id: 'text-embedding-v3',
    name: '文本嵌入-v3',
    provider: 'alibaba',
    contextWindow: 8192,
    capabilities: {
      vision: false,
      functionCall: false,
      jsonMode: false,
      streaming: false,
      embeddings: true,
    },
    pricing: {
      input: 0.0005,
      output: 0,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '文本向量嵌入模型',
  },
];

// OpenAI 模型
export const OPENAI_MODELS: PresetModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.005,
      output: 0.015,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: 'OpenAI 最强多模态模型',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 16384,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.00015,
      output: 0.0006,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '高性价比多模态模型',
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.01,
      output: 0.03,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: 'GPT-4 系列，128K 上下文',
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    contextWindow: 16385,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.0005,
      output: 0.0015,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '速度快、成本低',
  },
  {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    provider: 'openai',
    contextWindow: 8191,
    capabilities: {
      vision: false,
      functionCall: false,
      jsonMode: false,
      streaming: false,
      embeddings: true,
    },
    pricing: {
      input: 0.00013,
      output: 0,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '高性能文本嵌入模型',
  },
];

// Anthropic 模型
export const ANTHROPIC_MODELS: PresetModel[] = [
  {
    id: 'claude-3-opus-20240229',
    name: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.015,
      output: 0.075,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: 'Anthropic 最强模型，200K 上下文',
  },
  {
    id: 'claude-3-sonnet-20240229',
    name: 'Claude 3 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.003,
      output: 0.015,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '性能与效率平衡',
  },
  {
    id: 'claude-3-haiku-20240307',
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.00025,
      output: 0.00125,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '最快、最轻量',
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.003,
      output: 0.015,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: 'Claude 3.5 版本，更强的推理能力',
  },
];

// 智谱 AI 模型
export const ZHIPUAI_MODELS: PresetModel[] = [
  {
    id: 'glm-4',
    name: 'GLM-4',
    provider: 'zhipuai',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.1,
      output: 0.1,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '智谱最强模型，128K 上下文',
  },
  {
    id: 'glm-4v',
    name: 'GLM-4V',
    provider: 'zhipuai',
    contextWindow: 8192,
    maxTokens: 4096,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.1,
      output: 0.1,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '视觉理解模型',
  },
  {
    id: 'glm-3-turbo',
    name: 'GLM-3-Turbo',
    provider: 'zhipuai',
    contextWindow: 32768,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.005,
      output: 0.005,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '高性价比，适合大多数场景',
  },
  {
    id: 'glm-3-turbo-128k',
    name: 'GLM-3-Turbo-128K',
    provider: 'zhipuai',
    contextWindow: 128000,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.01,
      output: 0.01,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '128K 长上下文版本',
  },
];

// MiniMax 模型
export const MINIMAX_MODELS: PresetModel[] = [
  {
    id: 'abab6.5s-chat',
    name: 'MiniMax 6.5s',
    provider: 'minimax',
    contextWindow: 8192,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.01,
      output: 0.01,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '速度快、成本低',
  },
  {
    id: 'abab6.5-chat',
    name: 'MiniMax 6.5',
    provider: 'minimax',
    contextWindow: 8192,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.03,
      output: 0.03,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '效果与速度平衡',
  },
  {
    id: 'abab6-chat',
    name: 'MiniMax 6',
    provider: 'minimax',
    contextWindow: 8192,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.1,
      output: 0.1,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '效果最佳',
  },
  {
    id: 'abab5.5-chat',
    name: 'MiniMax 5.5',
    provider: 'minimax',
    contextWindow: 16384,
    maxTokens: 4096,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.015,
      output: 0.015,
      unit: '1K tokens',
      currency: 'CNY',
    },
    description: '16K 长上下文',
  },
];

// Google 模型
export const GOOGLE_MODELS: PresetModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2097152,  // 2M
    maxTokens: 8192,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.0035,
      output: 0.0105,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: 'Google 最强模型，2M 上下文',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1048576,  // 1M
    maxTokens: 8192,
    capabilities: {
      vision: true,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.00035,
      output: 0.00105,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '速度快、性价比高',
  },
  {
    id: 'gemini-1.0-pro',
    name: 'Gemini 1.0 Pro',
    provider: 'google',
    contextWindow: 32768,
    maxTokens: 2048,
    capabilities: {
      vision: false,
      functionCall: true,
      jsonMode: true,
      streaming: true,
    },
    pricing: {
      input: 0.0005,
      output: 0.0015,
      unit: '1K tokens',
      currency: 'USD',
    },
    description: '稳定版本',
  },
];

// 所有预置模型
export const ALL_PRESET_MODELS: PresetModel[] = [
  ...DASHSCOPE_MODELS,
  ...OPENAI_MODELS,
  ...ANTHROPIC_MODELS,
  ...ZHIPUAI_MODELS,
  ...MINIMAX_MODELS,
  ...GOOGLE_MODELS,
];

// 按提供商获取模型
export function getModelsByProvider(provider: string): PresetModel[] {
  return ALL_PRESET_MODELS.filter(m => m.provider === provider);
}

// 获取单个模型
export function getModelById(id: string): PresetModel | undefined {
  return ALL_PRESET_MODELS.find(m => m.id === id);
}
