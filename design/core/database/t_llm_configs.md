# t_llm_configs 大模型配置表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_configs |
| 中文名 | 大模型配置表 |
| 说明 | 存储提供商的配置信息（地址、API类型等） |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，配置唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 配置名称，如默认配置、国内节点 |
| 3 | description | TEXT | - | 否 | NULL | 配置描述 |
| 4 | provider_id | VARCHAR | 36 | 是 | - | 关联提供商ID |
| 5 | base_url | VARCHAR | 512 | 是 | - | API基础地址 |
| 6 | subscribe_type | VARCHAR | 50 | 否 | usage | 订阅类型: free/privatization/dedicated/prepaid/subscription/usage |
| 7 | icon | VARCHAR | 255 | 否 | NULL | 配置图标 |
| 8 | model_name | VARCHAR | 200 | 是 | - | 模型名称，如gpt-4o、qwen-max |
| 9 | model_type | VARCHAR | 50 | 否 | text | 模型类别: text2speech/speech2text/text/multimodal/embedding/image/code |
| 10 | context_size | INT | - | 否 | 8192 | 上下文窗口大小 |
| 10 | parameters | JSON | - | 否 | NULL | 模型调用参数，如max_tokens、temperature等 |
| 11 | enable_thinking | VARCHAR | 20 | 否 | disabled | 思考模式: enabled=启用, disabled=停用 |
| 12 | stream | VARCHAR | 20 | 否 | enabled | 流式输出: enabled=启用, disabled=停用 |
| 13 | auth_method | VARCHAR | 50 | 否 | api_key | 认证方式: api_key/api_token |
| 14 | provider_name | VARCHAR | 100 | 否 | NULL | 提供商名称，从代码配置获取 |
| 15 | model_ability | JSON | - | 否 | NULL | 模型能力，多选，如vision/tool-use/reasoning等 |
| 12 | timeout | INT | - | 否 | 30000 | 超时时间（毫秒） |
| 13 | retries | INT | - | 否 | 3 | 重试次数 |
| 14 | sort | INT | - | 否 | 0 | 显示顺序 |
| 15 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 16 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记 |
| 17 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 18 | status | VARCHAR | 20 | 是 | enabled | 状态: enabled=启用, disabled=停用 |

## 字段详细说明

### subscribe_type 订阅类型

| 值 | 说明 | 英文 |
|---|------|------|
| free | 免费额度 | free |
| privatization | 私有部署 | privatization |
| dedicated | 独占托管 | dedicated |
| prepaid | 预付费 | prepaid |
| subscription | 订阅 | subscription |
| usage | 用量计费 | usage |

### auth_method 认证方式

| 值 | 说明 |
|---|------|
| api_key | API Key 认证（Authorization: Bearer） |
| api_token | Token 认证（自定义 Header） |

### model_type 模型类别

| 值 | 说明 | 英文 |
|---|------|------|
| text2speech | 文本转语音 | text2speech |
| speech2text | 语音转文本 | speech2text |
| text | 文本模型 | text |
| multimodal | 多模态 | multimodal |
| embedding | 嵌入模型 | embedding |
| image | 图像模型 | image |
| code | 编码模型 | code |

### enable_thinking 思考模式

| 值 | 说明 |
|---|------|
| enabled | 启用思考模式 |
| disabled | 停用思考模式 |

### stream 流式输出

| 值 | 说明 |
|---|------|
| enabled | 启用流式输出 |
| disabled | 停用流式输出 |

### parameters 参数示例

```json
{
  "max_tokens": 4096,
  "temperature": 0.7,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}
```

### base_url 示例

| 提供商 | 默认地址 |
|--------|---------|
| OpenAI | https://api.openai.com/v1 |
| Anthropic | https://api.anthropic.com |
| 阿里千问 | https://dashscope.aliyuncs.com/compatible-mode/v1 |
| Ollama | http://localhost:11434/v1 |

## SQL建表语句

```sql
CREATE TABLE t_llm_configs (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，配置唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '配置名称',
    description TEXT COMMENT '配置描述',
    provider_id VARCHAR(36) NOT NULL COMMENT '关联提供商ID',
    base_url VARCHAR(512) NOT NULL COMMENT 'API基础地址',
    subscribe_type VARCHAR(50) DEFAULT 'usage' COMMENT '订阅类型: free/privatization/dedicated/prepaid/subscription/usage',
    icon VARCHAR(255) COMMENT '配置图标',
    model_name VARCHAR(200) NOT NULL COMMENT '模型名称，如gpt-4o、qwen-max',
    model_type VARCHAR(50) DEFAULT 'text' COMMENT '模型类别: text2speech/speech2text/text/multimodal/embedding/image/code',
    context_size INT DEFAULT 8192 COMMENT '上下文窗口大小',
    parameters JSON COMMENT '模型调用参数，如max_tokens、temperature等',
    enable_thinking VARCHAR(20) DEFAULT 'disabled' COMMENT '思考模式: enabled=启用, disabled=停用',
    stream VARCHAR(20) DEFAULT 'enabled' COMMENT '流式输出: enabled=启用, disabled=停用',
    auth_method VARCHAR(50) DEFAULT 'api_key' COMMENT '认证方式: api_key/api_token',
    provider_name VARCHAR(100) COMMENT '提供商名称，从代码配置获取',
    model_ability JSON COMMENT '模型能力，多选，如vision/tool-use/reasoning等',
    timeout INT DEFAULT 30000 COMMENT '超时时间（毫秒）',
    retries INT DEFAULT 3 COMMENT '重试次数',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    INDEX idx_configs_provider (provider_id),
    INDEX idx_configs_status (status),
    INDEX idx_configs_deleted (deleted),
    INDEX idx_configs_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型配置表';
```

## 示例数据

```sql
-- OpenAI 配置
INSERT INTO t_llm_configs (sid, name, provider_id, base_url, subscribe_type, icon) VALUES
(UUID(), '默认配置', '{openai-provider-sid}', 'https://api.openai.com/v1', 'usage', 'openai'),
(UUID(), '国内代理', '{openai-provider-sid}', 'https://api.gptapi.us/v1', 'usage', 'openai');

-- 阿里千问配置
INSERT INTO t_llm_configs (sid, name, provider_id, base_url, subscribe_type, icon) VALUES
(UUID(), '默认配置', '{alibaba-provider-sid}', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'usage', 'alibaba');

-- Ollama 本地配置
INSERT INTO t_llm_configs (sid, name, provider_id, base_url, subscribe_type, icon) VALUES
(UUID(), '本地节点', '{ollama-provider-sid}', 'http://localhost:11434/v1', 'privatization', 'ollama');
```
