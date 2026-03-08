# t_llm_instances 大模型实例表（API Key池）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_llm_instances |
| 中文名 | 大模型实例表 |
| 说明 | 存储API Key，支持多Key轮询和负载均衡 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，实例唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 实例名称，如Key-1、生产环境 |
| 3 | description | TEXT | - | 否 | NULL | 实例描述 |
| 4 | config_id | VARCHAR | 36 | 是 | - | 关联配置ID |
| 5 | api_key | VARCHAR | 500 | 是 | - | API Key（加密存储） |
| 6 | api_key_hash | VARCHAR | 64 | 是 | - | API Key哈希（用于去重） |
| 7 | headers | JSON | - | 否 | NULL | 自定义请求头（如项目标识） |
| 8 | billing_type | VARCHAR | 50 | 否 | usage | 计费类型: free/privatization/dedicated/prepaid/subscription/usage |
| 9 | weight | INT | - | 否 | 1 | 轮询权重 |
| 10 | rpm_limit | INT | - | 否 | NULL | 每分钟请求限制 |
| 11 | tpm_limit | INT | - | 否 | NULL | 每分钟Token限制 |
| 12 | daily_quota | BIGINT | - | 否 | NULL | 每日Token配额 |
| 13 | daily_used | BIGINT | - | 否 | 0 | 今日已使用量 |
| 14 | fail_count | INT | - | 否 | 0 | 连续失败次数 |
| 15 | cooldown_until | DATETIME | - | 否 | NULL | 冷却截止时间 |
| 16 | last_used_at | DATETIME | - | 否 | NULL | 最后使用时间 |
| 17 | sort | INT | - | 否 | 0 | 显示顺序 |
| 18 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 19 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记 |
| 20 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP | 更新时间戳 |
| 21 | status | VARCHAR | 20 | 是 | enabled | 状态: enabled=启用, disabled=停用 |

## 字段详细说明

### weight 轮询权重

多个Key时的选择权重：
- 权重越高，被选中的概率越大
- 默认值为1

### billing_type 计费类型

| 值 | 说明 | 调用策略 |
|---|------|---------|
| free | 免费额度 | 限制并发、低优先级、可能有时段限制 |
| privatization | 私有部署 | 内部部署，无限制，高并发 |
| dedicated | 独占托管 | 独占资源，保证可用性，优先使用 |
| prepaid | 预付费 | 需要检查余额，欠费时停用 |
| subscription | 订阅制 | 按订阅周期重置配额 |
| usage | 按量计费 | 默认策略，按调用量计费 |

### rpm_limit / tpm_limit 速率限制

- `rpm_limit`: Requests Per Minute，每分钟最大请求数
- `tpm_limit`: Tokens Per Minute，每分钟最大Token数

### daily_quota / daily_used 配额管理

- `daily_quota`: 每日Token使用配额
- `daily_used`: 今日已使用量（定时任务重置）

### fail_count / cooldown_until 故障处理

- `fail_count`: 连续失败次数，达到阈值后进入冷却
- `cooldown_until`: 冷却截止时间，冷却期间该Key不会被使用

## SQL建表语句

```sql
CREATE TABLE t_llm_instances (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，实例唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '实例名称',
    description TEXT COMMENT '实例描述',
    config_id VARCHAR(36) NOT NULL COMMENT '关联配置ID',
    api_key VARCHAR(500) NOT NULL COMMENT 'API Key（加密存储）',
    api_key_hash VARCHAR(64) NOT NULL COMMENT 'API Key哈希（用于去重）',
    headers JSON COMMENT '自定义请求头（如项目标识）',
    billing_type VARCHAR(50) DEFAULT 'usage' COMMENT '计费类型: free/privatization/dedicated/prepaid/subscription/usage',
    weight INT DEFAULT 1 COMMENT '轮询权重',
    rpm_limit INT COMMENT '每分钟请求限制',
    tpm_limit INT COMMENT '每分钟Token限制',
    daily_quota BIGINT COMMENT '每日Token配额',
    daily_used BIGINT DEFAULT 0 COMMENT '今日已使用量',
    fail_count INT DEFAULT 0 COMMENT '连续失败次数',
    cooldown_until DATETIME COMMENT '冷却截止时间',
    last_used_at DATETIME COMMENT '最后使用时间',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用',
    INDEX idx_instances_config (config_id),
    UNIQUE INDEX idx_instances_hash (api_key_hash),
    INDEX idx_instances_cooldown (cooldown_until),
    INDEX idx_instances_status (status),
    INDEX idx_instances_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='大模型实例表（API Key池）';
```

## 示例数据

```sql
-- OpenAI 的多个Key
INSERT INTO t_llm_instances (sid, name, config_id, api_key, api_key_hash, weight, daily_quota) VALUES
(UUID(), 'Key-1', '{config-sid}', 'sk-xxx1...', 'hash1', 2, 10000000),
(UUID(), 'Key-2', '{config-sid}', 'sk-xxx2...', 'hash2', 1, 10000000),
(UUID(), 'Key-3', '{config-sid}', 'sk-xxx3...', 'hash3', 1, 10000000);
```

## Key选择逻辑

### 基于能力的智能路由

```typescript
// LLMServiceManager 路由逻辑
async route(task: RoutingTask): Promise<RoutingDecision> {
  // 1. 按能力筛选
  const candidates = instances.filter(inst => {
    // 检查是否具备所需能力
    const hasCapability = inst.capabilities.includes(task.capability);
    if (!hasCapability) return false;
    
    // 检查是否在冷却期
    if (inst.cooldownUntil && new Date(inst.cooldownUntil) > new Date()) {
      return false;
    }
    
    // 检查配额是否已用完
    if (inst.dailyQuota && inst.dailyUsed >= inst.dailyQuota) {
      return false;
    }
    
    // 检查失败次数
    if (inst.failCount >= 5) {
      return false;
    }
    
    return true;
  });
  
  // 2. 按计费类型优先级排序
  const billingTypePriority = {
    "free": 1,           // 免费优先
    "prepaid": 2,        // 预付套餐
    "subscription": 3,   // 订阅
    "dedicated": 4,      // 专用
    "privatization": 5,  // 私有化
    "usage": 6,          // 按量付费最后
  };
  
  candidates.sort((a, b) => {
    const priorityDiff = billingTypePriority[a.billingType] - 
                         billingTypePriority[b.billingType];
    if (priorityDiff !== 0) return priorityDiff;
    
    // 相同计费类型，按剩余配额排序
    const remainingA = a.dailyQuota ? a.dailyQuota - a.dailyUsed : Infinity;
    const remainingB = b.dailyQuota ? b.dailyQuota - b.dailyUsed : Infinity;
    return remainingB - remainingA;
  });
  
  return candidates[0];
}
```

### SQL 查询示例

```sql
-- 选择可用Key（按权重随机）
SELECT * FROM t_llm_instances 
WHERE config_id = '{config-id}' 
  AND status = 'enabled'
  AND deleted = 0
  AND (cooldown_until IS NULL OR cooldown_until < NOW())
ORDER BY weight DESC, RAND()
LIMIT 1;
```

## 配额管理

### 使用记录更新

```typescript
// 记录Token使用量
async recordUsage(instanceId: string, tokens: number): Promise<void> {
  await run(
    `UPDATE t_llm_instances 
     SET daily_used = daily_used + ? 
     WHERE sid = ?`,
    [tokens, instanceId]
  );
}

// 记录失败并重置
async recordError(instanceId: string): Promise<void> {
  await run(
    `UPDATE t_llm_instances 
     SET fail_count = fail_count + 1,
         cooldown_until = CASE 
           WHEN fail_count >= 4 THEN DATE_ADD(NOW(), INTERVAL 5 MINUTE)
           ELSE NULL 
         END
     WHERE sid = ?`,
    [instanceId]
  );
}

// 每日重置配额（定时任务）
async resetDailyQuota(): Promise<void> {
  await run(
    `UPDATE t_llm_instances 
     SET daily_used = 0, 
         fail_count = 0,
         cooldown_until = NULL
     WHERE deleted = 0`
  );
}
```
