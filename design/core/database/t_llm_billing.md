# t_llm_billing 大模型计费记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_billing |
| 中文名 | 大模型计费记录表 |
| 说明 | 存储每次API调用的详细计费记录，支持成本分析和账单生成 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，计费记录唯一标识 |
| 2 | name | VARCHAR | 200 | 否 | NULL | 计费记录名称（可选） |
| 3 | description | TEXT | - | 否 | NULL | 计费描述 |
| 4 | request_id | VARCHAR | 64 | 是 | - | 请求唯一标识（用于追踪） |
| 5 | billing_period | VARCHAR | 7 | 是 | - | 账单周期，格式YYYY-MM |
| 6 | provider_id | VARCHAR | 36 | 是 | - | 关联提供商ID |
| 5 | config_id | VARCHAR | 36 | 是 | - | 关联配置ID |
| 6 | instance_id | VARCHAR | 36 | 否 | NULL | 关联实例/Key ID |
| 7 | model_id | VARCHAR | 36 | 是 | - | 关联模型ID |
| 8 | pricing_id | VARCHAR | 36 | 否 | NULL | 关联计费模式ID |
| 9 | agent_id | VARCHAR | 36 | 否 | NULL | 关联Agent ID |
| 10 | org_id | VARCHAR | 36 | 否 | NULL | 关联组织ID |
| 11 | user_id | VARCHAR | 36 | 否 | NULL | 关联用户ID |
| 12 | session_id | VARCHAR | 36 | 否 | NULL | 关联会话ID |
| 13 | request_time | DATETIME | - | 是 | - | 请求时间 |
| 14 | input_tokens | BIGINT | - | 否 | 0 | 输入Token数 |
| 15 | output_tokens | BIGINT | - | 否 | 0 | 输出Token数 |
| 16 | cache_read_tokens | BIGINT | - | 否 | 0 | 缓存读取Token数 |
| 17 | cache_write_tokens | BIGINT | - | 否 | 0 | 缓存写入Token数 |
| 18 | total_tokens | BIGINT | - | 否 | 0 | 总Token数 |
| 19 | input_cost | DECIMAL | 15,8 | 否 | 0 | 输入成本 |
| 20 | output_cost | DECIMAL | 15,8 | 否 | 0 | 输出成本 |
| 21 | cache_read_cost | DECIMAL | 15,8 | 否 | 0 | 缓存读取成本 |
| 22 | cache_write_cost | DECIMAL | 15,8 | 否 | 0 | 缓存写入成本 |
| 23 | total_cost | DECIMAL | 15,8 | 否 | 0 | 总成本 |
| 24 | currency | VARCHAR | 3 | 否 | USD | 货币代码 |
| 25 | exchange_rate | DECIMAL | 15,8 | 否 | 1 | 汇率（转换为USD） |
| 26 | latency_ms | INT | - | 否 | 0 | 请求延迟（毫秒） |
| 27 | status | VARCHAR | 20 | 否 | success | 请求状态 |
| 28 | error_code | VARCHAR | 50 | 否 | NULL | 错误代码 |
| 29 | error_message | TEXT | - | 否 | NULL | 错误信息 |
| 30 | metadata | JSON | - | 否 | NULL | 扩展元数据 |
| 31 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 32 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |

## 字段详细说明

### billing_period 账单周期

格式为 `YYYY-MM`，用于按月汇总账单，如 `2024-01`。

### request_id 请求标识

每次API调用的唯一标识，用于：
- 与日志系统关联
- 重复请求检测（幂等性）
- 问题追踪和调试

### status 请求状态

| 值 | 说明 |
|---|------|
| success | 成功 |
| failed | 失败 |
| timeout | 超时 |
| cancelled | 取消 |
| cached | 缓存命中 |

### metadata 扩展元数据

JSON格式存储额外信息：
```json
{
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "temperature": 0.7,
  "max_tokens": 4096,
  "stream": true,
  "retry_count": 0
}
```

## SQL建表语句

```sql
CREATE TABLE t_llm_billing (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，计费记录唯一标识',
    name VARCHAR(200) COMMENT '计费记录名称（可选）',
    description TEXT COMMENT '计费描述',
    request_id VARCHAR(64) NOT NULL COMMENT '请求唯一标识（用于追踪）',
    billing_period VARCHAR(7) NOT NULL COMMENT '账单周期，格式YYYY-MM',
    provider_id VARCHAR(36) NOT NULL COMMENT '关联提供商ID',
    config_id VARCHAR(36) NOT NULL COMMENT '关联配置ID',
    instance_id VARCHAR(36) COMMENT '关联实例/Key ID',
    model_id VARCHAR(36) NOT NULL COMMENT '关联模型ID',
    pricing_id VARCHAR(36) COMMENT '关联计费模式ID',
    agent_id VARCHAR(36) COMMENT '关联Agent ID',
    org_id VARCHAR(36) COMMENT '关联组织ID',
    user_id VARCHAR(36) COMMENT '关联用户ID',
    session_id VARCHAR(36) COMMENT '关联会话ID',
    request_time DATETIME NOT NULL COMMENT '请求时间',
    input_tokens BIGINT DEFAULT 0 COMMENT '输入Token数',
    output_tokens BIGINT DEFAULT 0 COMMENT '输出Token数',
    cache_read_tokens BIGINT DEFAULT 0 COMMENT '缓存读取Token数',
    cache_write_tokens BIGINT DEFAULT 0 COMMENT '缓存写入Token数',
    total_tokens BIGINT DEFAULT 0 COMMENT '总Token数',
    input_cost DECIMAL(15,8) DEFAULT 0 COMMENT '输入成本',
    output_cost DECIMAL(15,8) DEFAULT 0 COMMENT '输出成本',
    cache_read_cost DECIMAL(15,8) DEFAULT 0 COMMENT '缓存读取成本',
    cache_write_cost DECIMAL(15,8) DEFAULT 0 COMMENT '缓存写入成本',
    total_cost DECIMAL(15,8) DEFAULT 0 COMMENT '总成本',
    currency VARCHAR(3) DEFAULT 'USD' COMMENT '货币代码',
    exchange_rate DECIMAL(15,8) DEFAULT 1 COMMENT '汇率（转换为USD）',
    latency_ms INT DEFAULT 0 COMMENT '请求延迟（毫秒）',
    status VARCHAR(20) DEFAULT 'success' COMMENT '请求状态: success/failed/timeout/cancelled/cached',
    error_code VARCHAR(50) COMMENT '错误代码',
    error_message TEXT COMMENT '错误信息',
    metadata JSON COMMENT '扩展元数据',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    UNIQUE INDEX idx_billing_request (request_id),
    INDEX idx_billing_period (billing_period),
    INDEX idx_billing_provider (provider_id),
    INDEX idx_billing_config (config_id),
    INDEX idx_billing_model (model_id),
    INDEX idx_billing_agent (agent_id),
    INDEX idx_billing_org (org_id),
    INDEX idx_billing_user (user_id),
    INDEX idx_billing_time (request_time),
    INDEX idx_billing_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型计费记录表';
```

## 示例数据

```sql
-- 成功的请求记录
INSERT INTO t_llm_billing (
  sid, request_id, billing_period, provider_id, config_id, instance_id, model_id, 
  agent_id, org_id, request_time, input_tokens, output_tokens, 
  input_cost, output_cost, total_cost, currency, latency_ms, status
) VALUES (
  UUID(), 'req-20240115-001', '2024-01', 'openai', '{config-id}', '{instance-id}', '{gpt-4o-model-id}',
  '{agent-id}', '{org-id}', '2024-01-15 10:30:00', 1000, 500,
  0.005, 0.0075, 0.0125, 'USD', 1200, 'success'
);

-- 缓存命中的记录（成本更低）
INSERT INTO t_llm_billing (
  sid, request_id, billing_period, provider_id, config_id, model_id,
  request_time, input_tokens, cache_read_tokens, cache_read_cost, total_cost, status
) VALUES (
  UUID(), 'req-20240115-002', '2024-01', 'anthropic', '{config-id}', '{claude-model-id}',
  '2024-01-15 10:35:00', 2000, 2000, 0.0006, 0.0006, 'cached'
);

-- 失败的请求记录（不计费但记录）
INSERT INTO t_llm_billing (
  sid, request_id, billing_period, provider_id, config_id, model_id,
  request_time, status, error_code, error_message
) VALUES (
  UUID(), 'req-20240115-003', '2024-01', 'openai', '{config-id}', '{gpt-4o-model-id}',
  '2024-01-15 10:40:00', 'failed', 'rate_limit_exceeded', 'Rate limit exceeded'
);
```

## 关联表

| 关联表 | 关联字段 | 关系 |
|--------|---------|------|
| t_llm_provider | provider_id | 多对一 |
| t_llm_config | config_id | 多对一 |
| t_llm_instance | instance_id | 多对一（可选） |
| t_llm_model | model_id | 多对一 |
| t_llm_pricing | pricing_id | 多对一（可选） |
| t_agents | agent_id | 多对一（可选） |
| t_org | org_id | 多对一（可选） |

## 使用场景

### 1. 按组织统计月度费用
```sql
SELECT 
  org_id,
  billing_period,
  COUNT(*) as request_count,
  SUM(total_tokens) as total_tokens,
  SUM(total_cost) as total_cost,
  AVG(latency_ms) as avg_latency
FROM t_llm_billing
WHERE billing_period = '2024-01'
GROUP BY org_id, billing_period;
```

### 2. 按模型统计使用量
```sql
SELECT 
  model_id,
  COUNT(*) as request_count,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(total_cost) as total_cost
FROM t_llm_billing
WHERE billing_period = '2024-01' AND status = 'success'
GROUP BY model_id
ORDER BY total_cost DESC;
```

### 3. 按Agent统计费用
```sql
SELECT 
  agent_id,
  COUNT(*) as request_count,
  SUM(total_cost) as total_cost,
  AVG(latency_ms) as avg_latency
FROM t_llm_billing
WHERE request_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY agent_id;
```

### 4. 生成月度账单
```sql
SELECT 
  provider_id,
  model_id,
  currency,
  COUNT(*) as request_count,
  SUM(input_tokens) as input_tokens,
  SUM(output_tokens) as output_tokens,
  SUM(total_cost) as total_cost
FROM t_llm_billing
WHERE billing_period = '2024-01' AND status = 'success'
GROUP BY provider_id, model_id, currency;
```

### 5. 成本异常检测
```sql
-- 查找平均成本异常高的请求
SELECT * FROM t_llm_billing
WHERE billing_period = '2024-01'
  AND total_cost > (
    SELECT AVG(total_cost) * 3 
    FROM t_llm_billing 
    WHERE billing_period = '2024-01'
  )
ORDER BY total_cost DESC;
```

## 数据保留策略

| 数据类型 | 保留期限 | 处理方式 |
|---------|---------|---------|
| 原始记录 | 1年 | 归档到冷存储 |
| 月度汇总 | 3年 | 保留在热存储 |
| 年度汇总 | 永久 | 保留在热存储 |
