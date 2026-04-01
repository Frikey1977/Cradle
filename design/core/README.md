# Core 核心模块

## 模块概述

Core 模块是 Cradle 的核心基础模块，提供系统运行所需的基础能力，包括：

- **上下文管理**：会话上下文、状态管理
- **大模型对接**：多提供商 LLM 统一接入
- **事件系统**：内部事件发布/订阅
- **配置管理**：核心配置定义和加载

## 子模块列表

| 子模块 | 说明 | 文档 |
|--------|------|------|
| 上下文管理 | 会话上下文和状态管理 | [context.md](./context.md) |
| 大模型对接 | LLM 多提供商对接设计 | [llm-adapter.md](./llm-adapter.md) |

## 数据库设计（简化版）

### 核心表

| 表名 | 核心字段 | 说明 | 文档 |
|------|---------|------|------|
| t_llm_provider | `name` | 提供商定义 | [t_llm_provider.md](./database/t_llm_provider.md) |
| t_llm_config | `base_url` | 配置信息（地址） | [t_llm_config.md](./database/t_llm_config.md) |
| t_llm_instance | `api_key` | API Key池 | [t_llm_instance.md](./database/t_llm_instance.md) |
| t_llm_model | `modname` | 模型定义 | [t_llm_model.md](./database/t_llm_model.md) |

### 计费表

| 表名 | 核心字段 | 说明 | 文档 |
|------|---------|------|------|
| t_llm_pricing | `pricing_type` | 计费模式管理 | [t_llm_pricing.md](./database/t_llm_pricing.md) |
| t_llm_billing | `request_id` | 计费记录跟踪 | [t_llm_billing.md](./database/t_llm_billing.md) |

### 审计表

| 表名 | 核心字段 | 说明 | 文档 |
|------|---------|------|------|
| t_llm_audit | `ttfb_ms` | 响应效率审计 | [t_llm_audit.md](./database/t_llm_audit.md) |

### 表关系

```
t_llm_provider (1) ────< (N) t_llm_config
                              │
                              ├──< (N) t_llm_instance (Key池)
                              │         │
                              │         └──< (N) t_llm_audit (效率审计)
                              │
                              ├──< (N) t_llm_model (模型)
                              │         │
                              │         └──< (N) t_llm_pricing (计费模式)
                              │
                              └──< (N) t_llm_billing (计费记录)
```

## 设计原则

1. **平台无关**：核心模块不依赖具体平台实现
2. **可扩展**：支持通过插件扩展功能
3. **高性能**：关键路径优化，减少性能开销
4. **可测试**：模块间松耦合，便于单元测试

## 关联文档

- [系统设计总览](../overall.md)
- [Agent 模块](../agents/README.md)
- [Gateway 模块](../gateway/README.md)
