# t_llm_providers 大模型提供商表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_providers |
| 中文名 | 大模型提供商表 |
| 说明 | 存储LLM提供商的基本信息 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，提供商唯一标识 |
| 2 | name | VARCHAR | 100 | 是 | - | 提供商标识名，如openai、anthropic |
| 3 | title | VARCHAR | 200 | 否 | NULL | 多语言翻译标签，如llm.provider.openai |
| 4 | ename | VARCHAR | 200 | 是 | - | 英文名，如OpenAI、Anthropic |
| 5 | description | TEXT | - | 否 | NULL | 提供商描述 |
| 6 | icon | VARCHAR | 100 | 否 | NULL | 图标，如carbon:machine-learning |
| 7 | color | VARCHAR | 20 | 否 | NULL | 主题颜色，如#10A37F |
| 8 | sort | INT | - | 否 | 0 | 显示顺序 |
| 9 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 10 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记 |
| 11 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 12 | status | VARCHAR | 20 | 是 | enabled | 状态: enabled=启用, disabled=停用 |

## SQL建表语句

```sql
CREATE TABLE t_llm_providers (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，提供商唯一标识',
    name VARCHAR(100) NOT NULL COMMENT '提供商标识名，如openai、anthropic',
    title VARCHAR(200) COMMENT '多语言翻译标签，如llm.provider.openai',
    ename VARCHAR(200) NOT NULL COMMENT '英文名，如OpenAI、Anthropic',
    description TEXT COMMENT '提供商描述',
    icon VARCHAR(100) COMMENT '图标，如carbon:machine-learning',
    color VARCHAR(20) COMMENT '主题颜色，如#10A37F',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    UNIQUE INDEX idx_providers_name (name),
    INDEX idx_providers_status (status),
    INDEX idx_providers_deleted (deleted),
    INDEX idx_providers_sort (sort)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型提供商表';
```

## 预设数据

```sql
INSERT INTO t_llm_providers (sid, name, title, ename, sort) VALUES
(UUID(), 'openai', 'llm.provider.openai', 'OpenAI', 1),
(UUID(), 'anthropic', 'llm.provider.anthropic', 'Anthropic', 2),
(UUID(), 'google', 'llm.provider.google', 'Google Gemini', 3),
(UUID(), 'alibaba', 'llm.provider.alibaba', 'Ali Qwen', 4),
(UUID(), 'bedrock', 'llm.provider.bedrock', 'AWS Bedrock', 5),
(UUID(), 'ollama', 'llm.provider.ollama', 'Ollama', 6);
```
