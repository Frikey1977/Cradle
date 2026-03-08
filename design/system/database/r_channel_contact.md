# r_channel_contact - Contact 通道绑定表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | r_channel_contact |
| 中文名 | Contact 通道绑定表 |
| 说明 | 存储 Contact 在各通信通道的身份映射。一个 Contact 可在多个通道有身份，实现身份归一化。 |

## 核心设计原则

**身份映射**：
- 通过 `(channel_id, sender)` 唯一确定一个 Contact
- Gateway 根据消息中的通道类型和发送者标识查询对应的 Contact
- 查询不到记录即为陌生人

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | channel_id | VARCHAR | 36 | YES | - | 通道ID，外键关联 t_channels |
| 2 | contact_id | VARCHAR | 36 | YES | - | 联系人ID，外键关联 t_contacts |
| 3 | sender | VARCHAR | 200 | YES | - | 发送者在通道内的唯一标识（由IM生成） |
| 4 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### channel_id 通道ID

外键关联 `t_channels.sid`，标识属于哪个通道。

### contact_id 联系人ID

外键关联 `t_contacts.sid`，标识这个通道身份对应哪个 Contact。

### sender 发送者标识

由 IM 平台生成的唯一标识，表示消息发送者：

| 通道 | sender 示例 | 说明 |
|-----|------------|------|
| cradle | `user-001` | 系统用户ID |
| wechat | `wxid_abc123` | 微信用户标识 |
| dingtalk | `ding_456` | 钉钉用户ID |
| lark | `ou_xxx` | 飞书用户ID |
| email | `zhao@company.com` | 邮箱地址 |

**员工场景**：
- 如果是员工，还会通过 `contact_id` → `t_contacts` → `t_employees` 获取相关事实信息

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| pk_channel_contact | channel_id, contact_id | 联合主键 | 通道-Contact 唯一 |
| uk_channel_sender | channel_id, sender | 唯一索引 | 通道内发送者唯一 |
| idx_contact_id | contact_id | 普通索引 | 查询 Contact 的所有通道身份 |

## SQL语句

```sql
CREATE TABLE r_channel_contact (
    channel_id VARCHAR(36) NOT NULL COMMENT '通道ID，外键关联 t_channels',
    contact_id VARCHAR(36) NOT NULL COMMENT '联系人ID，外键关联 t_contacts',
    sender VARCHAR(200) NOT NULL COMMENT '发送者在通道内的唯一标识（由IM生成）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (channel_id, contact_id),
    UNIQUE KEY uk_channel_sender (channel_id, sender),
    INDEX idx_contact_id (contact_id),
    
    FOREIGN KEY (channel_id) REFERENCES t_channels(sid) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES t_contacts(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Contact 通道绑定表';
```

## 使用场景

### 场景1：Gateway 路由消息

```sql
-- 钉钉消息：from=ding_123
-- 1. 识别通道
SELECT sid FROM t_channels WHERE channel_name = '钉钉' AND status = 'active';
-- → channel_id = 'ch_ding_001'

-- 2. 查询 Contact
SELECT contact_id FROM r_channel_contact 
WHERE channel_id = 'ch_ding_001' AND sender = 'ding_123';
-- → contact_id = 'contact_001' (已知身份)
-- → 或 NULL (陌生人)

-- 3. 如果是员工，获取员工信息
SELECT e.* FROM t_contacts c
JOIN t_employees e ON c.source_id = e.sid
WHERE c.sid = 'contact_001';
```

### 场景2：员工扫码绑定微信

```sql
-- 员工在 WebUI 扫码绑定微信
-- 微信 sender = 'wxid_abc123'

INSERT INTO r_channel_contact (channel_id, contact_id, sender) VALUES
('ch_wechat_001', 'contact_001', 'wxid_abc123');

-- 现在 contact_001 有两个通道身份：
-- - cradle:user-001 (WebUI)
-- - wechat:wxid_abc123 (微信)
```

### 场景3：查询 Contact 的所有通道身份

```sql
-- 查询赵大伟的所有通道身份
SELECT 
    rc.channel_id,
    rc.sender,
    tc.channel_name
FROM r_channel_contact rc
JOIN t_channels tc ON rc.channel_id = tc.sid
WHERE rc.contact_id = 'contact_001';

-- 结果：
-- channel_id  | sender        | channel_name
-- ch_cradle_001 | user-001      | WebUI
-- ch_wechat_001 | wxid_abc123   | 微信
-- ch_ding_001   | ding_456      | 钉钉
```

### 场景4：陌生人首次联系

```sql
-- 钉钉用户 ding_789 首次发消息，未找到绑定记录
SELECT contact_id FROM r_channel_contact 
WHERE channel_id = 'ch_ding_001' AND sender = 'ding_789';
-- → NULL

-- 创建临时 Contact 和绑定记录
INSERT INTO t_contacts (sid, type, status) VALUES
('contact_temp_001', 'visitor', 'enabled');

INSERT INTO r_channel_contact (channel_id, contact_id, sender) VALUES
('ch_ding_001', 'contact_temp_001', 'ding_789');

-- 进入陌生人处理流程
```

## 关联文档

- [Gateway 通道架构](../../gateway/channels.md)
- [t_channels 表](./t_channels.md) - 通道配置表
- [r_channel_agent 表](./r_channel_agent.md) - Agent 通道绑定表
- [t_contacts 表](../../organization/database/t_contacts.md) - 联系人表
