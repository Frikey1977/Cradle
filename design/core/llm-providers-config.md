# 大模型供应商配置参考手册

本文档汇总主流大模型供应商的完整配置参数，包括API地址、认证方式、模型列表和计费标准。

---

## 目录

1. [Zhipu AI (智谱AI)](#1-zhipu-ai-智谱ai)
2. [Ali Qwen (阿里千问)](#2-ali-qwen-阿里千问)
3. [Anthropic (Claude)](#3-anthropic-claude)
4. [OpenAI](#4-openai)
5. [Google Gemini](#5-google-gemini)
6. [MiniMax](#6-minimax)

---

## 1. Zhipu AI (智谱AI)

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | zhipu | 唯一标识 |
| 显示名称 | Zhipu AI | 界面显示 |
| 官网 | https://www.zhipuai.cn | - |
| API文档 | https://open.bigmodel.cn/dev/api | - |
| 认证方式 | api-key | Bearer Token |

### API配置

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://open.bigmodel.cn/api/paas/v4 |
| apiType | openai |
| authMode | api-key |
| authHeader | Authorization: Bearer {apiKey} |
| 请求格式 | OpenAI兼容 |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### 模型列表

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| glm-4-plus | GLM-4 Plus | 128K | 4K | ✅ | ✅ | ¥0.05/1K | ¥0.05/1K |
| glm-4 | GLM-4 | 128K | 4K | ✅ | ✅ | ¥0.10/1K | ¥0.10/1K |
| glm-4-air | GLM-4 Air | 128K | 4K | ❌ | ✅ | ¥0.001/1K | ¥0.001/1K |
| glm-4-airx | GLM-4 AirX | 8K | 4K | ❌ | ✅ | ¥0.01/1K | ¥0.01/1K |
| glm-4-flash | GLM-4 Flash | 128K | 4K | ❌ | ✅ | 免费 | 免费 |
| glm-4v-plus | GLM-4V Plus | 8K | 2K | ✅ | ✅ | ¥0.01/1K | ¥0.01/1K |
| glm-4v | GLM-4V | 2K | 1K | ✅ | ❌ | ¥0.05/1K | ¥0.05/1K |
| glm-4-alltools | GLM-4 All Tools | 128K | 4K | ✅ | ✅ | ¥0.10/1K | ¥0.10/1K |
| glm-4-codegeex | CodeGeeX-4 | 128K | 4K | ❌ | ❌ | ¥0.001/1K | ¥0.001/1K |
| embedding-3 | Embedding-3 | 8K | - | ❌ | ❌ | ¥0.0005/1K | - |

---

## 2. Ali Qwen (阿里千问)

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | alibaba | 唯一标识 |
| 显示名称 | Ali Qwen | 界面显示 |
| 官网 | https://bailian.aliyun.com | - |
| API文档 | https://help.aliyun.com/document_detail/611472.html | - |
| SDK文档 | https://help.aliyun.com/document_detail/2586399.html | - |
| 认证方式 | api-key | Bearer Token |
| SDK包名 | @alicloud/dashscope | npm install @alicloud/dashscope |

### 连接模式

| 模式 | 推荐度 | 说明 |
|------|--------|------|
| **SDK模式** | ⭐⭐⭐⭐⭐ | 推荐，支持模型自动发现、批量推理、用量统计 |
| HTTP模式 | ⭐⭐⭐ | 标准OpenAI兼容接口 |

### API配置 (HTTP模式)

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| apiType | openai |
| authMode | api-key |
| authHeader | Authorization: Bearer {apiKey} |
| 请求格式 | OpenAI兼容 |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### SDK配置 (推荐)

```typescript
import * as dashscope from '@alicloud/dashscope';

const client = new dashscope.DashScopeClient({
  apiKey: 'sk-xxxxxxxxxxxxxxxx',
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
});

// 1. 自动获取模型列表（包含完整能力信息）
const models = await client.models.list();

// 2. 批量推理
const batchJob = await client.batch.create({
  model: 'qwen-max',
  requests: [...],
});

// 3. 获取用量统计
const usage = await client.usage.get({
  startDate: '2024-01-01',
  endDate: '2024-01-31',
});
```

### 模型列表 (中国区域价格)

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| qwen-max | 千问-Max | 32K | 8K | ❌ | ✅ | ¥0.04/1K | ¥0.12/1K |
| qwen-max-longcontext | 千问-Max-长文本 | 128K | 8K | ❌ | ✅ | ¥0.04/1K | ¥0.12/1K |
| qwen-plus | 千问-Plus | 128K | 8K | ❌ | ✅ | ¥0.004/1K | ¥0.012/1K |
| qwen-turbo | 千问-Turbo | 128K | 2K | ❌ | ✅ | ¥0.002/1K | ¥0.006/1K |
| qwen-vl-max | 千问-VL-Max | 32K | 2K | ✅ | ✅ | ¥0.08/1K | ¥0.08/1K |
| qwen-vl-plus | 千问-VL-Plus | 8K | 2K | ✅ | ✅ | ¥0.016/1K | ¥0.016/1K |
| qwen-coder-plus | 千问-Coder-Plus | 128K | 8K | ❌ | ✅ | ¥0.004/1K | ¥0.012/1K |
| text-embedding-v3 | 文本嵌入-V3 | 8K | - | ❌ | ❌ | ¥0.001/1K | - |
| qwen-audio-turbo | 千问-Audio | - | - | ❌ | ❌ | ¥0.006/分钟 | - |

### 国际区域价格 (USD)

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| qwen-max | $0.02/M | $0.06/M |
| qwen-plus | $0.002/M | $0.006/M |
| qwen-turbo | $0.001/M | $0.003/M |

### 批量推理价格

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| qwen-max | ¥0.024/1K | ¥0.072/1K |
| qwen-plus | ¥0.0024/1K | ¥0.0072/1K |

---

## 3. Anthropic (Claude)

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | anthropic | 唯一标识 |
| 显示名称 | Anthropic | 界面显示 |
| 官网 | https://anthropic.com | - |
| API文档 | https://docs.anthropic.com | - |
| 认证方式 | api-key | x-api-key Header |

### API配置

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://api.anthropic.com |
| apiType | anthropic |
| authMode | api-key |
| authHeader | x-api-key: {apiKey} |
| 请求格式 | Anthropic Messages API |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### 模型列表

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| claude-3-5-sonnet-20241022 | Claude 3.5 Sonnet | 200K | 8K | ✅ | ✅ | $3.00/M | $15.00/M |
| claude-3-opus-20240229 | Claude 3 Opus | 200K | 4K | ✅ | ✅ | $15.00/M | $75.00/M |
| claude-3-haiku-20240307 | Claude 3 Haiku | 200K | 4K | ✅ | ✅ | $0.25/M | $1.25/M |
| claude-3-5-haiku-20241022 | Claude 3.5 Haiku | 200K | 8K | ❌ | ✅ | $1.00/M | $5.00/M |

### 缓存价格 (Prompt Caching)

| 类型 | 价格 |
|------|------|
| 缓存写入 | $3.75/M |
| 缓存读取 | $0.30/M |

### 扩展思考 (Extended Thinking)

| 模型 | 思考Token价格 |
|------|--------------|
| Claude 3.5 Sonnet | 包含在输出价格中 |

---

## 4. OpenAI

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | openai | 唯一标识 |
| 显示名称 | OpenAI | 界面显示 |
| 官网 | https://openai.com | - |
| API文档 | https://platform.openai.com/docs | - |
| 认证方式 | api-key | Bearer Token |

### API配置

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://api.openai.com/v1 |
| apiType | openai |
| authMode | api-key |
| authHeader | Authorization: Bearer {apiKey} |
| 请求格式 | OpenAI兼容 |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### 模型列表

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| gpt-4o | GPT-4o | 128K | 4K | ✅ | ✅ | $5.00/M | $15.00/M |
| gpt-4o-mini | GPT-4o Mini | 128K | 4K | ✅ | ✅ | $0.15/M | $0.60/M |
| o1-preview | o1 Preview | 128K | 32K | ❌ | ❌ | $15.00/M | $60.00/M |
| o1-mini | o1 Mini | 128K | 65K | ❌ | ❌ | $3.00/M | $12.00/M |
| gpt-4-turbo | GPT-4 Turbo | 128K | 4K | ✅ | ✅ | $10.00/M | $30.00/M |
| gpt-3.5-turbo | GPT-3.5 Turbo | 16K | 4K | ❌ | ✅ | $0.50/M | $1.50/M |
| text-embedding-3-large | Embedding Large | 8K | - | ❌ | ❌ | $0.13/M | - |
| text-embedding-3-small | Embedding Small | 8K | - | ❌ | ❌ | $0.02/M | - |
| dall-e-3 | DALL-E 3 | - | - | ✅ | ❌ | $0.04/张 | - |
| tts-1 | TTS | - | - | ❌ | ❌ | $15.00/M | - |
| whisper-1 | Whisper | - | - | ❌ | ❌ | $0.006/分钟 | - |

### 缓存价格 (Prompt Caching)

| 类型 | 价格 |
|------|------|
| 缓存写入 | 输入价格的 100% |
| 缓存读取 | 输入价格的 50% |

### 批量API价格 (Batch API)

| 模型 | 输入价格 | 输出价格 |
|------|---------|---------|
| gpt-4o | $2.50/M | $7.50/M |
| gpt-4o-mini | $0.075/M | $0.30/M |

---

## 5. Google Gemini

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | google | 唯一标识 |
| 显示名称 | Google Gemini | 界面显示 |
| 官网 | https://ai.google.dev | - |
| API文档 | https://ai.google.dev/docs | - |
| 认证方式 | api-key | URL参数或Header |

### API配置

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://generativelanguage.googleapis.com/v1beta |
| apiType | gemini |
| authMode | api-key |
| authHeader | ?key={apiKey} 或 x-goog-api-key |
| 请求格式 | Google Generative AI |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### 模型列表

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| gemini-2.0-flash-exp | Gemini 2.0 Flash | 1M | 8K | ✅ | ✅ | 免费 | 免费 |
| gemini-1.5-pro | Gemini 1.5 Pro | 2M | 8K | ✅ | ✅ | $3.50/M | $10.50/M |
| gemini-1.5-flash | Gemini 1.5 Flash | 1M | 8K | ✅ | ✅ | $0.075/M | $0.30/M |
| gemini-1.0-pro | Gemini 1.0 Pro | 32K | 2K | ❌ | ✅ | $0.50/M | $1.50/M |
| text-embedding-004 | Embedding | 2K | - | ❌ | ❌ | 免费 | - |

### 上下文缓存价格

| 模型 | 存储价格/小时 | 读取价格 |
|------|--------------|---------|
| Gemini 1.5 Pro | $4.50/1M tokens | $0.35/M |
| Gemini 1.5 Flash | $1.00/1M tokens | $0.10/M |

---

## 6. MiniMax

### 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 提供商名称 | minimax | 唯一标识 |
| 显示名称 | MiniMax | 界面显示 |
| 官网 | https://www.minimaxi.com | - |
| API文档 | https://www.minimaxi.com/document | - |
| 认证方式 | api-key | Bearer Token |

### API配置

| 配置项 | 值 |
|--------|-----|
| baseUrl | https://api.minimax.chat/v1 |
| apiType | openai |
| authMode | api-key |
| authHeader | Authorization: Bearer {apiKey} |
| 请求格式 | OpenAI兼容 |
| 流式支持 | ✅ |
| 函数调用 | ✅ |
| 视觉输入 | ✅ |

### 模型列表

| 模型ID | 显示名称 | 上下文窗口 | 最大输出 | 视觉 | 函数调用 | 输入价格 | 输出价格 |
|--------|---------|-----------|---------|------|---------|---------|---------|
| abab6.5s-chat | MiniMax 6.5s | 8K | 8K | ❌ | ✅ | ¥0.010/1K | ¥0.010/1K |
| abab6.5-chat | MiniMax 6.5 | 8K | 8K | ❌ | ✅ | ¥0.030/1K | ¥0.030/1K |
| abab6-chat | MiniMax 6 | 8K | 8K | ❌ | ✅ | ¥0.100/1K | ¥0.100/1K |
| abab5.5-chat | MiniMax 5.5 | 16K | 16K | ❌ | ✅ | ¥0.015/1K | ¥0.015/1K |

---

## 配置汇总表

### 认证方式对比

| 提供商 | 认证方式 | Header格式 |
|--------|---------|-----------|
| Zhipu AI | api-key | Authorization: Bearer {key} |
| Ali Qwen | api-key | Authorization: Bearer {key} |
| Anthropic | api-key | x-api-key: {key} |
| OpenAI | api-key | Authorization: Bearer {key} |
| Google Gemini | api-key | ?key={key} 或 x-goog-api-key |
| MiniMax | api-key | Authorization: Bearer {key} |

### API类型对比

| 提供商 | API类型 | OpenAI兼容 |
|--------|---------|-----------|
| Zhipu AI | openai | ✅ |
| Ali Qwen | openai | ✅ |
| Anthropic | anthropic | ❌ |
| OpenAI | openai | ✅ |
| Google Gemini | gemini | ❌ |
| MiniMax | openai | ✅ |

### 价格区间对比

| 提供商 | 最低输入价格 | 最高输出价格 | 货币 |
|--------|-------------|-------------|------|
| Zhipu AI | 免费 (GLM-4 Flash) | ¥0.10/1K (GLM-4) | CNY |
| Ali Qwen | 免费 (Turbo) | ¥0.12/1K (Max) | CNY |
| Anthropic | $0.25/M (Haiku) | $75.00/M (Opus) | USD |
| OpenAI | $0.15/M (gpt-4o-mini) | $60.00/M (o1-preview) | USD |
| Google Gemini | 免费 (Flash Exp) | $10.50/M (Pro) | USD |
| MiniMax | ¥0.010/1K (6.5s) | ¥0.100/1K (6) | CNY |

---

## 快速配置示例

### Zhipu AI 完整配置

```json
{
  "provider": {
    "name": "zhipu",
    "displayName": "Zhipu AI",
    "isBuiltin": true
  },
  "config": {
    "name": "默认配置",
    "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
    "apiType": "openai",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "glm-4-plus",
    "name": "GLM-4 Plus",
    "contextWindow": 128000,
    "maxTokens": 4096,
    "supportsVision": true,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1K_tokens",
    "inputPrice": 0.05,
    "outputPrice": 0.05,
    "currency": "CNY",
    "region": "cn",
    "tier": "default"
  }
}
```

### Ali Qwen 完整配置

```json
{
  "provider": {
    "name": "alibaba",
    "displayName": "Ali Qwen",
    "isBuiltin": true
  },
  "config": {
    "name": "国内配置",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "apiType": "openai",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "sk-xxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "qwen-max",
    "name": "千问-Max",
    "contextWindow": 32768,
    "maxTokens": 8192,
    "supportsVision": false,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1K_tokens",
    "inputPrice": 0.04,
    "outputPrice": 0.12,
    "currency": "CNY",
    "region": "cn",
    "tier": "default"
  }
}
```

### Anthropic 完整配置

```json
{
  "provider": {
    "name": "anthropic",
    "displayName": "Anthropic",
    "isBuiltin": true
  },
  "config": {
    "name": "默认配置",
    "baseUrl": "https://api.anthropic.com",
    "apiType": "anthropic",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "sk-ant-xxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "claude-3-5-sonnet-20241022",
    "name": "Claude 3.5 Sonnet",
    "contextWindow": 200000,
    "maxTokens": 8192,
    "supportsVision": true,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1M_tokens",
    "inputPrice": 3.00,
    "outputPrice": 15.00,
    "cacheReadPrice": 0.30,
    "cacheWritePrice": 3.75,
    "currency": "USD",
    "region": "global",
    "tier": "default"
  }
}
```

### OpenAI 完整配置

```json
{
  "provider": {
    "name": "openai",
    "displayName": "OpenAI",
    "isBuiltin": true
  },
  "config": {
    "name": "默认配置",
    "baseUrl": "https://api.openai.com/v1",
    "apiType": "openai",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "gpt-4o",
    "name": "GPT-4o",
    "contextWindow": 128000,
    "maxTokens": 4096,
    "supportsVision": true,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1M_tokens",
    "inputPrice": 5.00,
    "outputPrice": 15.00,
    "cacheReadPrice": 2.50,
    "cacheWritePrice": 5.00,
    "currency": "USD",
    "region": "global",
    "tier": "default"
  }
}
```

### Google Gemini 完整配置

```json
{
  "provider": {
    "name": "google",
    "displayName": "Google Gemini",
    "isBuiltin": true
  },
  "config": {
    "name": "默认配置",
    "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
    "apiType": "gemini",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "AIxxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "gemini-1.5-pro",
    "name": "Gemini 1.5 Pro",
    "contextWindow": 2000000,
    "maxTokens": 8192,
    "supportsVision": true,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1M_tokens",
    "inputPrice": 3.50,
    "outputPrice": 10.50,
    "currency": "USD",
    "region": "global",
    "tier": "default"
  }
}
```

### MiniMax 完整配置

```json
{
  "provider": {
    "name": "minimax",
    "displayName": "MiniMax",
    "isBuiltin": true
  },
  "config": {
    "name": "默认配置",
    "baseUrl": "https://api.minimax.chat/v1",
    "apiType": "openai",
    "authMode": "api-key",
    "timeout": 30000,
    "retries": 3
  },
  "instance": {
    "name": "主Key",
    "apiKey": "xxxxxxxxxxxxxxxxxxxxxxxx",
    "weight": 1,
    "rpmLimit": 60,
    "tpmLimit": 60000
  },
  "model": {
    "modname": "abab6.5s-chat",
    "name": "MiniMax 6.5s",
    "contextWindow": 8192,
    "maxTokens": 8192,
    "supportsVision": false,
    "supportsFunction": true,
    "supportsJson": true
  },
  "pricing": {
    "pricingType": "token",
    "unitType": "1K_tokens",
    "inputPrice": 0.01,
    "outputPrice": 0.01,
    "currency": "CNY",
    "region": "cn",
    "tier": "default"
  }
}
```
