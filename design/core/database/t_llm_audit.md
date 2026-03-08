# t_llm_audit 大模型响应效率审计表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_audit |
| 中文名 | 大模型响应效率审计表 |
| 说明 | 记录每次API调用的详细性能指标，用于评估模型响应效率和多供应商权重调整 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，审计记录唯一标识 |
| 2 | name | VARCHAR | 200 | 否 | NULL | 审计记录名称（可选） |
| 3 | description | TEXT | - | 否 | NULL | 审计描述 |
| 4 | request_id | VARCHAR | 64 | 是 | - | 请求唯一标识（关联 billing） |
| 5 | provider_id | VARCHAR | 36 | 是 | - | 关联提供商ID |
| 4 | config_id | VARCHAR | 36 | 是 | - | 关联配置ID |
| 5 | instance_id | VARCHAR | 36 | 否 | NULL | 关联实例/Key ID |
| 6 | model_id | VARCHAR | 36 | 是 | - | 关联模型ID |
| 7 | agent_id | VARCHAR | 36 | 否 | NULL | 关联Agent ID |
| 8 | request_time | DATETIME | - | 是 | - | 请求发起时间 |
| 9 | response_time | DATETIME | - | 否 | NULL | 首次响应时间 |
| 10 | complete_time | DATETIME | - | 否 | NULL | 完成时间 |
| 11 | ttfb_ms | INT | - | 否 | 0 | Time To First Byte（首字节时间） |
| 12 | total_latency_ms | INT | - | 否 | 0 | 总延迟（毫秒） |
| 13 | connect_time_ms | INT | - | 否 | 0 | 连接建立时间 |
| 14 | dns_time_ms | INT | - | 否 | 0 | DNS解析时间 |
| 15 | tls_time_ms | INT | - | 否 | 0 | TLS握手时间 |
| 16 | input_tokens | INT | - | 否 | 0 | 输入Token数 |
| 17 | output_tokens | INT | - | 否 | 0 | 输出Token数 |
| 18 | throughput_tps | DECIMAL | 10,2 | 否 | 0 | 吞吐量（tokens/秒） |
| 19 | success | TINYINT | 1 | 否 | 1 | 是否成功: 0=失败, 1=成功 |
| 20 | error_type | VARCHAR | 50 | 否 | NULL | 错误类型 |
| 21 | error_code | VARCHAR | 50 | 否 | NULL | 错误代码 |
| 22 | retry_count | INT | - | 否 | 0 | 重试次数 |
| 23 | is_cached | TINYINT | 1 | 否 | 0 | 是否命中缓存 |
| 24 | is_streaming | TINYINT | 1 | 否 | 0 | 是否流式请求 |
| 25 | network_type | VARCHAR | 20 | 否 | NULL | 网络类型: wifi/4g/5g |
| 26 | region | VARCHAR | 50 | 否 | NULL | 请求来源地区 |
| 27 | metadata | JSON | - | 否 | NULL | 扩展元数据 |
| 28 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 29 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |

## 字段详细说明

### 性能指标

| 指标 | 说明 | 计算方式 |
|------|------|---------|
| ttfb_ms | 首字节时间 | response_time - request_time |
| total_latency_ms | 总延迟 | complete_time - request_time |
| connect_time_ms | 连接时间 | TCP连接建立时间 |
| dns_time_ms | DNS解析时间 | 域名解析耗时 |
| tls_time_ms | TLS握手时间 | HTTPS握手耗时 |
| throughput_tps | 吞吐量 | output_tokens / (total_latency_ms / 1000) |

### 错误类型

| 值 | 说明 |
|---|------|
| timeout | 请求超时 |
| connection_error | 连接错误 |
| rate_limit | 速率限制 |
| auth_error | 认证失败 |
| model_error | 模型错误 |
| network_error | 网络错误 |
| unknown | 未知错误 |

## SQL建表语句

```sql
CREATE TABLE t_llm_audit (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，审计记录唯一标识',
    name VARCHAR(200) COMMENT '审计记录名称（可选）',
    description TEXT COMMENT '审计描述',
    request_id VARCHAR(64) NOT NULL COMMENT '请求唯一标识（关联 billing）',
    provider_id VARCHAR(36) NOT NULL COMMENT '关联提供商ID',
    config_id VARCHAR(36) NOT NULL COMMENT '关联配置ID',
    instance_id VARCHAR(36) COMMENT '关联实例/Key ID',
    model_id VARCHAR(36) NOT NULL COMMENT '关联模型ID',
    agent_id VARCHAR(36) COMMENT '关联Agent ID',
    request_time DATETIME NOT NULL COMMENT '请求发起时间',
    response_time DATETIME COMMENT '首次响应时间',
    complete_time DATETIME COMMENT '完成时间',
    ttfb_ms INT DEFAULT 0 COMMENT 'Time To First Byte（首字节时间）',
    total_latency_ms INT DEFAULT 0 COMMENT '总延迟（毫秒）',
    connect_time_ms INT DEFAULT 0 COMMENT '连接建立时间',
    dns_time_ms INT DEFAULT 0 COMMENT 'DNS解析时间',
    tls_time_ms INT DEFAULT 0 COMMENT 'TLS握手时间',
    input_tokens INT DEFAULT 0 COMMENT '输入Token数',
    output_tokens INT DEFAULT 0 COMMENT '输出Token数',
    throughput_tps DECIMAL(10,2) DEFAULT 0 COMMENT '吞吐量（tokens/秒）',
    success TINYINT DEFAULT 1 COMMENT '是否成功: 0=失败, 1=成功',
    error_type VARCHAR(50) COMMENT '错误类型',
    error_code VARCHAR(50) COMMENT '错误代码',
    retry_count INT DEFAULT 0 COMMENT '重试次数',
    is_cached TINYINT DEFAULT 0 COMMENT '是否命中缓存',
    is_streaming TINYINT DEFAULT 0 COMMENT '是否流式请求',
    network_type VARCHAR(20) COMMENT '网络类型: wifi/4g/5g',
    region VARCHAR(50) COMMENT '请求来源地区',
    metadata JSON COMMENT '扩展元数据',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    UNIQUE INDEX idx_audit_request (request_id),
    INDEX idx_audit_provider (provider_id),
    INDEX idx_audit_config (config_id),
    INDEX idx_audit_model (model_id),
    INDEX idx_audit_agent (agent_id),
    INDEX idx_audit_time (request_time),
    INDEX idx_audit_success (success),
    INDEX idx_audit_ttfb (ttfb_ms),
    INDEX idx_audit_latency (total_latency_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型响应效率审计表';
```

## 示例数据

```sql
-- 成功请求记录
INSERT INTO t_llm_audit (
  sid, request_id, provider_id, config_id, model_id, agent_id,
  request_time, response_time, complete_time,
  ttfb_ms, total_latency_ms, connect_time_ms, dns_time_ms, tls_time_ms,
  input_tokens, output_tokens, throughput_tps,
  success, is_cached, is_streaming
) VALUES (
  UUID(), 'req-20240115-001', 'openai', '{config-id}', '{gpt-4o-model-id}', '{agent-id}',
  '2024-01-15 10:30:00.000', '2024-01-15 10:30:01.200', '2024-01-15 10:30:03.500',
  1200, 3500, 50, 20, 80,
  1000, 500, 142.86,
  1, 0, 0
);

-- 失败请求记录
INSERT INTO t_llm_audit (
  sid, request_id, provider_id, config_id, model_id,
  request_time, ttfb_ms, total_latency_ms,
  success, error_type, error_code, retry_count
) VALUES (
  UUID(), 'req-20240115-002', 'anthropic', '{config-id}', '{claude-model-id}',
  '2024-01-15 10:35:00.000', 5000, 5000,
  0, 'timeout', 'REQUEST_TIMEOUT', 2
);

-- 缓存命中记录（极快）
INSERT INTO t_llm_audit (
  sid, request_id, provider_id, config_id, model_id,
  request_time, response_time, complete_time,
  ttfb_ms, total_latency_ms,
  input_tokens, output_tokens, throughput_tps,
  success, is_cached
) VALUES (
  UUID(), 'req-20240115-003', 'openai', '{config-id}', '{gpt-4o-model-id}',
  '2024-01-15 10:40:00.000', '2024-01-15 10:40:00.050', '2024-01-15 10:40:00.100',
  50, 100,
  1000, 500, 5000.00,
  1, 1
);
```

## 关联表

| 关联表 | 关联字段 | 关系 |
|--------|---------|------|
| t_llm_billing | request_id | 一对一 |
| t_llm_provider | provider_id | 多对一 |
| t_llm_config | config_id | 多对一 |
| t_llm_instance | instance_id | 多对一（可选） |
| t_llm_model | model_id | 多对一 |
| t_agents | agent_id | 多对一（可选） |

## 使用场景

### 1. 按供应商统计平均响应时间
```sql
SELECT 
  provider_id,
  COUNT(*) as total_requests,
  AVG(ttfb_ms) as avg_ttfb,
  AVG(total_latency_ms) as avg_latency,
  AVG(throughput_tps) as avg_throughput,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) / COUNT(*) as success_rate
FROM t_llm_audit
WHERE request_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY provider_id
ORDER BY avg_latency;
```

### 2. 按模型统计性能
```sql
SELECT 
  model_id,
  COUNT(*) as request_count,
  AVG(ttfb_ms) as avg_ttfb,
  AVG(total_latency_ms) as avg_latency,
  AVG(throughput_tps) as avg_throughput,
  MAX(total_latency_ms) as max_latency,
  MIN(total_latency_ms) as min_latency
FROM t_llm_audit
WHERE success = 1
  AND request_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY model_id;
```

### 3. 识别慢请求
```sql
SELECT * FROM t_llm_audit
WHERE total_latency_ms > 10000  -- 超过10秒
  AND success = 1
  AND request_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY total_latency_ms DESC
LIMIT 100;
```

### 4. 错误率分析
```sql
SELECT 
  provider_id,
  error_type,
  COUNT(*) as error_count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY provider_id) as error_rate
FROM t_llm_audit
WHERE success = 0
  AND request_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY provider_id, error_type
ORDER BY error_count DESC;
```

### 5. 时段性能分析（用于识别高峰期）
```sql
SELECT 
  HOUR(request_time) as hour,
  AVG(ttfb_ms) as avg_ttfb,
  AVG(total_latency_ms) as avg_latency,
  COUNT(*) as request_count
FROM t_llm_audit
WHERE request_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY HOUR(request_time)
ORDER BY hour;
```

## 数据保留策略

| 数据类型 | 保留期限 | 处理方式 |
|---------|---------|---------|
| 原始审计记录 | 30天 | 归档到冷存储 |
| 小时级汇总 | 90天 | 保留在热存储 |
| 日级汇总 | 1年 | 保留在热存储 |
| 月级汇总 | 永久 | 保留在热存储 |
