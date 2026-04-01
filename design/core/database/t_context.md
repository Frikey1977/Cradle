# t_context 上下文表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_context |
| 中文名 | 上下文表 |
| 说明 | 存储LLM会话中的上下文消息记录，按LLM API格式组织 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，上下文项唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 上下文项显示名称（可选） |
| 3 | description | TEXT | - | 否 | NULL | 上下文项描述 |
| 4 | session_id | VARCHAR | 36 | 是 | - | 关联会话ID |
| 5 | role | VARCHAR | 20 | 是 | - | 角色: system/users/assistant/tool |
| 6 | content | JSON | - | 是 | - | 内容块，JSON数组格式 |
| 7 | tokens | INT | - | 否 | NULL | Token数量 |
| 8 | model | VARCHAR | 100 | 否 | NULL | 使用的模型 |
| 9 | provider | VARCHAR | 50 | 否 | NULL | 模型提供商 |
| 10 | latency_ms | INT | - | 否 | NULL | 响应延迟（毫秒） |
| 11 | context_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 上下文时间戳 |
| 12 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 13 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |
| 14 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 15 | status | TINYINT | 1 | 是 | 1 | 状态: 0=停用, 1=启用 |

## 字段详细说明

### sid 主键

上下文项唯一标识，使用UUID生成。

### session_id 关联会话ID

关联的会话标识，外键关联到t_session表的sid字段。

### role 角色

| 值 | 角色 | 说明 |
|---|------|------|
| system | 系统消息 | 系统提示、摘要等 |
| user | 用户消息 | 用户输入 |
| assistant | 助手消息 | AI助手回复 |
| tool | 工具消息 | 工具调用结果 |

### content 内容

JSON数组格式，存储内容块。每个内容块包含type字段标识类型。

#### JSON Schema 定义

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "array",
  "description": "内容块数组",
  "items": {
    "oneOf": [
      {
        "$ref": "#/definitions/TextContent"
      },
      {
        "$ref": "#/definitions/ImageContent"
      },
      {
        "$ref": "#/definitions/ToolCallContent"
      },
      {
        "$ref": "#/definitions/ToolResultContent"
      },
      {
        "$ref": "#/definitions/ThinkingContent"
      }
    ]
  },
  "definitions": {
    "TextContent": {
      "type": "object",
      "required": ["type", "text"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["text"]
        },
        "text": {
          "type": "string",
          "description": "文本内容"
        }
      }
    },
    "ImageContent": {
      "type": "object",
      "required": ["type", "source", "data", "mimeType"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["image"]
        },
        "source": {
          "type": "string",
          "enum": ["base64", "url"],
          "description": "图片来源类型"
        },
        "data": {
          "type": "string",
          "description": "Base64编码的图片数据或URL"
        },
        "mimeType": {
          "type": "string",
          "enum": ["image/png", "image/jpeg", "image/gif", "image/webp"],
          "description": "图片MIME类型"
        }
      }
    },
    "ToolCallContent": {
      "type": "object",
      "required": ["type", "toolCallId", "toolName", "arguments"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["tool_call"]
        },
        "toolCallId": {
          "type": "string",
          "description": "工具调用唯一标识"
        },
        "toolName": {
          "type": "string",
          "description": "工具名称"
        },
        "arguments": {
          "type": "object",
          "description": "工具调用参数"
        }
      }
    },
    "ToolResultContent": {
      "type": "object",
      "required": ["type", "toolCallId", "result"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["tool_result"]
        },
        "toolCallId": {
          "type": "string",
          "description": "对应的工具调用ID"
        },
        "result": {
          "description": "工具执行结果（任意类型）"
        },
        "isError": {
          "type": "boolean",
          "description": "是否为错误结果",
          "default": false
        }
      }
    },
    "ThinkingContent": {
      "type": "object",
      "required": ["type", "thinking"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["thinking"]
        },
        "thinking": {
          "type": "string",
          "description": "思考过程内容"
        },
        "signature": {
          "type": "string",
          "description": "签名（用于验证思考内容完整性）"
        }
      }
    }
  }
}
```

#### 示例

```json
[
  {"type": "text", "text": "文本内容"},
  {"type": "image", "source": "base64", "data": "...", "mimeType": "image/png"},
  {"type": "tool_call", "toolCallId": "call-001", "toolName": "get_weather", "arguments": {"city": "北京"}},
  {"type": "tool_result", "toolCallId": "call-001", "result": {"temperature": 25, "condition": "晴"}},
  {"type": "thinking", "thinking": "我需要分析用户的需求...", "signature": "..."}
]
```

#### 版本兼容性

| 版本 | 说明 |
|-----|------|
| v1.0 | 初始版本，支持text/image/tool_call/tool_result/thinking |
| v1.1 | 新增isError字段到tool_result（可选，默认false） |

### tokens Token数量

该上下文项估算或实际的token数量。

### latency_ms 响应延迟

对于assistant角色，记录从请求到响应的延迟时间（毫秒）。

### context_time 上下文时间戳

上下文项实际产生的时间，用于排序和历史查询。

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_context | 主键索引 | sid | 主键索引 |
| idx_context_session | 普通索引 | session_id | 会话查询索引 |
| idx_context_roles | 普通索引 | role | 角色筛选索引 |
| idx_context_time | 普通索引 | context_time | 时间排序索引 |
| idx_context_status | 普通索引 | status | 状态筛选索引 |
| idx_context_deleted | 普通索引 | deleted | 删除标记索引 |
| idx_context_session_time | 联合索引 | session_id, context_time | 会话上下文时间查询 |

## SQL建表语句

```sql
CREATE TABLE t_context (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，上下文项唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '上下文项显示名称',
    description TEXT COMMENT '上下文项描述',
    session_id VARCHAR(36) NOT NULL COMMENT '关联会话ID',
    role VARCHAR(20) NOT NULL COMMENT '角色: system/users/assistant/tool',
    content JSON NOT NULL COMMENT '内容块，JSON数组格式',
    tokens INT COMMENT 'Token数量',
    model VARCHAR(100) COMMENT '使用的模型',
    provider VARCHAR(50) COMMENT '模型提供商',
    latency_ms INT COMMENT '响应延迟（毫秒）',
    context_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '上下文时间戳',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status TINYINT DEFAULT 1 COMMENT '状态: 0=停用, 1=启用',
    
    INDEX idx_context_session (session_id),
    INDEX idx_context_roles (role),
    INDEX idx_context_time (context_time),
    INDEX idx_context_status (status),
    INDEX idx_context_deleted (deleted),
    INDEX idx_context_session_time (session_id, context_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='上下文表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_session | session_id | 多对一 |

## 与Message的区别

| 维度 | t_context (本表) | t_short_term_memory (Message) |
|------|------------------|-------------------------------|
| **定位** | LLM交互层 | 业务记忆层 |
| **格式** | LLM API标准格式 | 业务消息格式 |
| **角色** | system/users/assistant/tool | USER/AGENT/SKILL/SYSTEM |
| **用途** | 直接发送给LLM | 用户展示、历史检索 |
| **消费者** | LLM模型 | 用户界面、记忆系统 |
