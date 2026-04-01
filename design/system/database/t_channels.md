# t_channels - IM 通道配置表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_channels |
| 中文名 | IM 通道配置表 |
| 说明 | 管理各 IM 通道的配置信息。通道名称通过代码管理配置，所有配置加密存储。 |

## 核心设计原则

**配置即服务**：
- 通道通过数据库配置管理，非配置文件
- 支持动态启用/禁用，无需重启服务
- 所有配置加密存储，运行时解密使用

**代码管理驱动**：
- `channel_name` 从代码管理读取，支持多语言显示
- 代码管理 key: `system.channels.client`

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 100 | YES | - | 通道名称（唯一标识，从代码管理读取） |
| 3 | config | JSON | - | YES | - | 通道配置（加密存储） |
| 4 | config.credentials | JSON | - | NO | NULL | 客户端连接配置（Cradle连接Gateway时握手用） |
| 5 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled/disabled/error |
| 6 | last_error | TEXT | - | NO | NULL | 最后错误信息 |
| 7 | last_connected_at | DATETIME | - | NO | NULL | 最后连接时间 |
| 8 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 9 | update_time | DATETIME | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |


## 字段详细说明

### config 通道配置（加密存储）

服务端通道配置，包含敏感和非敏感信息：

```json
// 钉钉示例
{
  "appKey": "ding_abc123",
  "appSecret": "secret_xxx",
  "agentId": "123456",
  "webhookUrl": "/webhook/dingtalk"
}

// Slack 示例
{
  "botToken": "xoxb-xxx",
  "signingSecret": "secret_xxx",
  "socketMode": false
}

// WebUI 示例
{
  "cors": true,
  "sessionTimeout": 3600,
  "maxUploadSize": 10485760,
  "allowedOrigins": ["https://cradle.company.com"]
}

// 自定义 Webhook 示例
{
  "url": "https://external-system.com/webhook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "secret": "***",
  "timeout": 30000
}
```

### client_config 客户端连接配置

Cradle 客户端连接 Gateway 时使用的握手配置：

```json
// WebSocket 连接示例
{
  "endpoint": "ws://gateway:8080/ws",
  "token": "xxx",
  "heartbeatInterval": 30000,
  "reconnectAttempts": 5
}

// HTTP 长轮询示例
{
  "endpoint": "http://gateway:8080/poll",
  "token": "xxx",
  "pollInterval": 5000
}
```

```json
// 钉钉示例
{
  "appKey": "ding_abc123",
  "appSecret": "secret_xxx",
  "agentId": "123456",
  "webhookUrl": "/webhook/dingtalk"
}

// Slack 示例
{
  "botToken": "xoxb-xxx",
  "signingSecret": "secret_xxx",
  "socketMode": false
}

// WebUI 示例
{
  "cors": true,
  "sessionTimeout": 3600,
  "maxUploadSize": 10485760,
  "allowedOrigins": ["https://cradle.company.com"]
}

// 自定义 Webhook 示例
{
  "url": "https://external-system.com/webhook",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "secret": "***",
  "timeout": 30000
}
```

### status / last_error 状态监控

| status | 说明 | 触发条件 |
|--------|------|---------|
| enabled | 启用 | 通道正常运行 |
| disabled | 禁用 | 管理员禁用 |
| error | 错误 | 连接失败或认证失败 |

## 索引

| 索引名 | 字段 | 类型 |
|--------|------|------|
| pk_channels | sid | 主键 |
| idx_channels_status | status | 普通索引 |

## SQL语句

```sql
CREATE TABLE t_channels (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(100) NOT NULL COMMENT '通道名称（唯一标识，从代码管理读取）',
    config JSON NOT NULL COMMENT '通道配置（加密存储，包含服务端配置和客户端凭证）',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled/error',
    last_error TEXT COMMENT '最后错误信息',
    last_connected_at DATETIME COMMENT '最后连接时间',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_channels_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IM 通道配置表';
```

## 使用场景

### 场景1：配置钉钉通道

```sql
INSERT INTO t_channels (
    sid, name, config, status
) VALUES (
    'ch-001',
    '钉钉',
    '{
        "appKey": "ding_abc123",
        "appSecret": "encrypted_secret",
        "agentId": "123456",
        "webhookUrl": "/webhook/dingtalk"
    }',
    'enabled'
);
```

### 场景2：配置 Cradle 内部通道

```sql
INSERT INTO t_channels (
    sid, name, config, status
) VALUES (
    'ch-002',
    'cradle',
    '{
        "config": {
            "cors": true,
            "max_connections": 1000,
            "connectionTimeout": 60000,
            "heartbeatInterval": 30000
        },
        "credentials": [
            {
                "name": "cradle-web",
                "token": "e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab",
                "enabled": true,
                "clientId": "cradle-web"
            },
            {
                "name": "cradle-mobile",
                "token": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
                "enabled": true,
                "clientId": "cradle-mobile"
            }
        ]
    }',
    'enabled'
);
```

## 运行时说明

1. **启动时**：从数据库读取配置，解密后加载到内存
2. **运行时**：Channel 对象持有明文配置，持续值守
3. **停止时**：清理内存中的敏感信息
