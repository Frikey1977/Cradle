# t_llm_pricing 大模型计费模式表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_pricing |
| 中文名 | 大模型计费模式表 |
| 说明 | 存储模型的详细计费模式和价格策略 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，计费记录唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 计费模式名称 |
| 3 | description | TEXT | - | 否 | NULL | 计费模式描述 |
| 4 | model_id | VARCHAR | 36 | 是 | - | 关联模型ID |
| 5 | pricing_type | VARCHAR | 20 | 是 | token | 计费类型 |
| 4 | input_price | DECIMAL | 15,8 | 否 | 0 | 输入价格（$/单位） |
| 5 | output_price | DECIMAL | 15,8 | 否 | 0 | 输出价格（$/单位） |
| 6 | cache_read_price | DECIMAL | 15,8 | 否 | 0 | 缓存读取价格 |
| 7 | cache_write_price | DECIMAL | 15,8 | 否 | 0 | 缓存写入价格 |
| 8 | unit_type | VARCHAR | 20 | 否 | 1M_tokens | 计费单位 |
| 9 | currency | VARCHAR | 3 | 否 | USD | 货币代码 |
| 10 | effective_date | DATE | - | 否 | NULL | 生效日期 |
| 11 | expiry_date | DATE | - | 否 | NULL | 失效日期 |
| 12 | region | VARCHAR | 50 | 否 | global | 适用地区 |
| 13 | tier | VARCHAR | 20 | 否 | default | 价格层级 |
| 14 | is_active | TINYINT | 1 | 否 | 1 | 是否生效 |
| 15 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 16 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记 |
| 17 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 18 | status | VARCHAR | 20 | 是 | enabled | 状态: enabled=启用, disabled=停用 |

## 字段详细说明

### pricing_type 计费类型

| 值 | 说明 |
|---|------|
| token | 按Token计费（最常见） |
| request | 按请求次数计费 |
| character | 按字符数计费 |
| minute | 按分钟计费（语音类） |
| image | 按图片数量计费 |
| hybrid | 混合计费模式 |

### unit_type 计费单位

| 值 | 说明 |
|---|------|
| 1M_tokens | 每百万Token |
| 1K_tokens | 每千Token |
| per_request | 每次请求 |
| per_character | 每字符 |
| per_minute | 每分钟 |
| per_image | 每张图片 |

### tier 价格层级

| 值 | 说明 |
|---|------|
| default | 默认价格 |
| standard | 标准层级 |
| pro | 专业层级 |
| enterprise | 企业层级 |
| batch | 批量处理价格 |
| cached | 缓存命中价格 |

### region 适用地区

| 值 | 说明 |
|---|------|
| global | 全球统一价格 |
| cn | 中国大陆 |
| us | 美国 |
| eu | 欧洲 |
| asia | 亚洲 |

## SQL建表语句

```sql
CREATE TABLE t_llm_pricing (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，计费记录唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '计费模式名称',
    description TEXT COMMENT '计费模式描述',
    model_id VARCHAR(36) NOT NULL COMMENT '关联模型ID',
    pricing_type VARCHAR(20) DEFAULT 'token' COMMENT '计费类型: token/request/character/minute/image/hybrid',
    input_price DECIMAL(15,8) DEFAULT 0 COMMENT '输入价格（$/单位）',
    output_price DECIMAL(15,8) DEFAULT 0 COMMENT '输出价格（$/单位）',
    cache_read_price DECIMAL(15,8) DEFAULT 0 COMMENT '缓存读取价格',
    cache_write_price DECIMAL(15,8) DEFAULT 0 COMMENT '缓存写入价格',
    unit_type VARCHAR(20) DEFAULT '1M_tokens' COMMENT '计费单位',
    currency VARCHAR(3) DEFAULT 'USD' COMMENT '货币代码',
    effective_date DATE COMMENT '生效日期',
    expiry_date DATE COMMENT '失效日期',
    region VARCHAR(50) DEFAULT 'global' COMMENT '适用地区',
    tier VARCHAR(20) DEFAULT 'default' COMMENT '价格层级: default/standard/pro/enterprise/batch/cached',
    is_active TINYINT DEFAULT 1 COMMENT '是否生效',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    INDEX idx_pricing_model (model_id),
    INDEX idx_pricing_type (pricing_type),
    INDEX idx_pricing_region (region),
    INDEX idx_pricing_tier (tier),
    INDEX idx_pricing_active (is_active),
    INDEX idx_pricing_effective (effective_date, expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型计费模式表';
```

## 示例数据

```sql
-- OpenAI GPT-4o 标准价格
INSERT INTO t_llm_pricing (sid, model_id, pricing_type, input_price, output_price, cache_read_price, cache_write_price, unit_type, currency, region, tier, effective_date) VALUES
(UUID(), '{gpt-4o-model-id}', 'token', 5.00, 15.00, 1.25, 5.00, '1M_tokens', 'USD', 'global', 'default', '2024-01-01');

-- OpenAI GPT-4o 批量处理价格（更便宜）
INSERT INTO t_llm_pricing (sid, model_id, pricing_type, input_price, output_price, unit_type, currency, region, tier, effective_date) VALUES
(UUID(), '{gpt-4o-model-id}', 'token', 2.50, 7.50, '1M_tokens', 'USD', 'global', 'batch', '2024-01-01');

-- Anthropic Claude 3.5 Sonnet
INSERT INTO t_llm_pricing (sid, model_id, pricing_type, input_price, output_price, cache_read_price, cache_write_price, unit_type, currency, region, tier, effective_date) VALUES
(UUID(), '{claude-sonnet-model-id}', 'token', 3.00, 15.00, 0.30, 3.75, '1M_tokens', 'USD', 'global', 'default', '2024-01-01');

-- 阿里千问-Max 中国区域价格
INSERT INTO t_llm_pricing (sid, model_id, pricing_type, input_price, output_price, unit_type, currency, region, tier, effective_date) VALUES
(UUID(), '{qwen-max-model-id}', 'token', 0.1429, 0.4286, '1M_tokens', 'CNY', 'cn', 'default', '2024-01-01');

-- 阿里千问-Max 国际区域价格（美元）
INSERT INTO t_llm_pricing (sid, model_id, pricing_type, input_price, output_price, unit_type, currency, region, tier, effective_date) VALUES
(UUID(), '{qwen-max-model-id}', 'token', 0.02, 0.06, '1M_tokens', 'USD', 'global', 'default', '2024-01-01');
```

## 关联表

| 关联表 | 关联字段 | 关系 |
|--------|---------|------|
| t_llm_model | model_id | 多对一 |

## 使用场景

### 1. 获取模型当前有效价格
```sql
SELECT * FROM t_llm_pricing 
WHERE model_id = '{model-id}' 
  AND is_active = 1 
  AND (effective_date IS NULL OR effective_date <= CURDATE())
  AND (expiry_date IS NULL OR expiry_date >= CURDATE())
  AND region = 'global'
ORDER BY tier, create_time DESC
LIMIT 1;
```

### 2. 计算请求成本
```sql
-- 根据实际token使用量计算成本
SELECT 
  p.input_price * (input_tokens / 1000000) as input_cost,
  p.output_price * (output_tokens / 1000000) as output_cost,
  p.cache_read_price * (cache_read_tokens / 1000000) as cache_read_cost,
  p.cache_write_price * (cache_write_tokens / 1000000) as cache_write_cost
FROM t_llm_pricing p
WHERE p.model_id = '{model-id}' AND p.is_active = 1;
```

### 3. 价格历史追踪
```sql
-- 查看某模型的价格变更历史
SELECT * FROM t_llm_pricing 
WHERE model_id = '{model-id}' 
ORDER BY effective_date DESC;
```
