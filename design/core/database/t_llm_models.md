# t_llm_models 大模型定义表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_models |
| 中文名 | 大模型定义表 |
| 说明 | 存储具体的模型定义，关联到配置 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，模型唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 模型名称，如GPT-4o、Claude 3 Sonnet |
| 3 | title | VARCHAR | 200 | 否 | NULL | 多语言翻译标签 |
| 4 | description | TEXT | - | 否 | NULL | 模型描述 |
| 5 | config_id | VARCHAR | 36 | 是 | - | 关联配置ID |
| 6 | type | VARCHAR | 50 | 否 | NULL | 模型类型 |
| 7 | context_size | INT | - | 否 | 8192 | 上下文窗口大小 |
| 8 | max_tokens | INT | - | 否 | 4096 | 最大输出Token数 |
| 9 | input_cost | DECIMAL | 10,6 | 否 | 0 | 输入成本($/1M tokens) |
| 10 | output_cost | DECIMAL | 10,6 | 否 | 0 | 输出成本($/1M tokens) |
| 11 | sort | INT | - | 否 | 0 | 显示顺序 |
| 12 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 13 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记 |
| 14 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 15 | status | VARCHAR | 20 | 是 | enabled | 状态: enabled=启用, disabled=停用 |

## 字段详细说明

### context_size 上下文窗口

模型支持的最大上下文长度（token数）：
- GPT-4o: 128000
- Claude 3.5 Sonnet: 200000
- 千问-Max: 32000

### input_cost / output_cost 成本

每百万token的成本（美元）：
- GPT-4o: 5.00 / 15.00
- GPT-4o-mini: 0.15 / 0.60
- Claude 3.5 Sonnet: 3.00 / 15.00

## SQL建表语句

```sql
CREATE TABLE t_llm_models (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，模型唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '模型名称，如GPT-4o、Claude 3 Sonnet',
    title VARCHAR(200) COMMENT '多语言翻译标签',
    description TEXT COMMENT '模型描述',
    config_id VARCHAR(36) NOT NULL COMMENT '关联配置ID',
    type VARCHAR(50) COMMENT '模型类型',
    context_size INT DEFAULT 8192 COMMENT '上下文窗口大小',
    max_tokens INT DEFAULT 4096 COMMENT '最大输出Token数',
    input_cost DECIMAL(10,6) DEFAULT 0 COMMENT '输入成本($/1M tokens)',
    output_cost DECIMAL(10,6) DEFAULT 0 COMMENT '输出成本($/1M tokens)',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    INDEX idx_models_config (config_id),
    INDEX idx_models_status (status),
    INDEX idx_models_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型定义表';
```

## 示例数据

```sql
-- OpenAI 模型
INSERT INTO t_llm_models (sid, name, title, config_id, context_size, max_tokens, input_cost, output_cost) VALUES
(UUID(), 'GPT-4o', 'llm.model.gpt4o', '{openai-config-sid}', 128000, 4096, 5.00, 15.00),
(UUID(), 'GPT-4o Mini', 'llm.model.gpt4o-mini', '{openai-config-sid}', 128000, 4096, 0.15, 0.60),
(UUID(), 'o1 Preview', 'llm.model.o1-preview', '{openai-config-sid}', 128000, 32768, 15.00, 60.00);

-- Anthropic 模型
INSERT INTO t_llm_models (sid, name, title, config_id, context_size, max_tokens, input_cost, output_cost) VALUES
(UUID(), 'Claude 3.5 Sonnet', 'llm.model.claude-sonnet', '{anthropic-config-sid}', 200000, 8192, 3.00, 15.00);

-- 阿里千问模型
INSERT INTO t_llm_models (sid, name, title, config_id, context_size, max_tokens, input_cost, output_cost) VALUES
(UUID(), '千问-Max', 'llm.model.qwen-max', '{alibaba-config-sid}', 32000, 8192, 2.00, 6.00),
(UUID(), '千问-Plus', 'llm.model.qwen-plus', '{alibaba-config-sid}', 32000, 8192, 0.80, 2.00);
```
