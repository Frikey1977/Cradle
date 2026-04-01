# t_followups - 跟进记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_followups |
| 中文名 | 跟进记录表 |
| 说明 | 记录销售人员与客户的每次互动，包括电话、邮件、会议、拜访等。 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | followup_no | VARCHAR | 50 | YES | - | 跟进编号，系统自动生成，格式：F+年月日+4位序号 |
| 3 | customer_id | VARCHAR | 36 | YES | - | 关联客户ID，关联 t_customers.sid |
| 4 | opportunity_id | VARCHAR | 36 | NO | NULL | 关联商机ID，关联 t_opportunities.sid |
| 5 | method | VARCHAR | 50 | YES | - | 跟进方式：phone/email/meeting/visit/wechat/other |
| 6 | follow_time | DATETIME | YES | CURRENT_TIMESTAMP | 实际跟进时间 |
| 7 | content | TEXT | YES | - | 跟进内容详细记录 |
| 8 | feedback | TEXT | NO | NULL | 客户反馈 |
| 9 | next_follow_date | DATE | NO | NULL | 下次跟进日期 |
| 10 | next_follow_content | VARCHAR | 500 | NO | NULL | 下次跟进要点 |
| 11 | reminder | TINYINT | YES | 0 | 是否设置提醒：0=否, 1=是 |
| 12 | reminder_time | DATETIME | NO | NULL | 提醒时间 |
| 13 | attachments | JSON | NO | NULL | 附件列表（文件名称和URL） |
| 14 | create_by | VARCHAR | 36 | NO | NULL | 创建人ID |
| 15 | create_time | DATETIME | YES | CURRENT_TIMESTAMP | 创建时间 |
| 16 | deleted | TINYINT | YES | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 17 | timestamp | TIMESTAMP | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### followup_no 跟进编号

- 格式：`F` + `年月日` + `4位序号`
- 示例：`F202403200001`
- 生成规则：每日从0001开始递增

### method 跟进方式

| 方式编码 | 方式名称 | 说明 |
|---------|---------|------|
| phone | 电话 | 电话沟通 |
| email | 邮件 | 邮件往来 |
| meeting | 会议 | 线上或线下会议 |
| visit | 拜访 | 现场拜访 |
| wechat | 微信 | 微信沟通 |
| other | 其他 | 其他方式 |

### follow_time 跟进时间

记录实际发生跟进的时间，可与 create_time 不同（补录历史跟进时）。

### next_follow_date 下次跟进

设置下次跟进计划，系统可根据此字段生成待办提醒。

### attachments 附件

JSON格式存储附件列表：
```json
[
  { "name": "会议记录.pdf", "url": "/files/xxx.pdf", "size": 1024000 },
  { "name": "录音.mp3", "url": "/files/xxx.mp3", "size": 5120000 }
]
```

## 索引设计

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键 | sid | 主键索引 |
| uk_followup_no | 唯一 | followup_no | 跟进编号唯一 |
| idx_customer | 普通 | customer_id | 按客户筛选 |
| idx_opportunity | 普通 | opportunity_id | 按商机筛选 |
| idx_method | 普通 | method | 按跟进方式筛选 |
| idx_follow_time | 普通 | follow_time | 按跟进时间排序 |
| idx_next_follow | 普通 | next_follow_date | 按下次跟进日期筛选 |
| idx_reminder | 普通 | reminder, reminder_time | 提醒查询 |
| idx_create_by | 普通 | create_by | 按创建人筛选 |
| idx_create_time | 普通 | create_time | 按创建时间排序 |

## 建表语句

```sql
CREATE TABLE t_followups (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    followup_no VARCHAR(50) NOT NULL COMMENT '跟进编号，格式：F+年月日+4位序号',
    customer_id VARCHAR(36) NOT NULL COMMENT '关联客户ID',
    opportunity_id VARCHAR(36) COMMENT '关联商机ID',
    method VARCHAR(50) NOT NULL COMMENT '跟进方式',
    follow_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '实际跟进时间',
    content TEXT NOT NULL COMMENT '跟进内容',
    feedback TEXT COMMENT '客户反馈',
    next_follow_date DATE COMMENT '下次跟进日期',
    next_follow_content VARCHAR(500) COMMENT '下次跟进要点',
    reminder TINYINT NOT NULL DEFAULT 0 COMMENT '是否设置提醒',
    reminder_time DATETIME COMMENT '提醒时间',
    attachments JSON COMMENT '附件列表',
    create_by VARCHAR(36) COMMENT '创建人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_followup_no (followup_no),
    KEY idx_customer (customer_id),
    KEY idx_opportunity (opportunity_id),
    KEY idx_method (method),
    KEY idx_follow_time (follow_time),
    KEY idx_next_follow (next_follow_date),
    KEY idx_reminder (reminder, reminder_time),
    KEY idx_create_by (create_by),
    KEY idx_create_time (create_time),
    
    CONSTRAINT fk_followup_customer FOREIGN KEY (customer_id) REFERENCES t_customers(sid) ON DELETE CASCADE,
    CONSTRAINT fk_followup_opportunity FOREIGN KEY (opportunity_id) REFERENCES t_opportunities(sid) ON DELETE SET NULL,
    CONSTRAINT fk_followup_create_by FOREIGN KEY (create_by) REFERENCES t_employees(sid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='跟进记录表';
```

## 关联关系

| 关联表 | 关联字段 | 关系 | 说明 |
|-------|---------|------|------|
| t_customers | customer_id | 多对一 | 跟进所属客户 |
| t_opportunities | opportunity_id | 多对一 | 关联的商机 |
| t_employees | create_by | 多对一 | 记录创建人 |

## 业务规则

1. **跟进编号唯一**：followup_no 全局唯一
2. **必须关联客户**：customer_id 不能为空
3. **商机可选**：opportunity_id 可为空（纯客户跟进）
4. **跟进时间**：默认为当前时间，支持补录历史跟进
5. **内容必填**：content 不能为空
6. **提醒设置**：reminder=1 时 reminder_time 建议填写
7. **级联更新**：创建跟进后需更新客户的 last_follow_time

## 触发器建议

```sql
-- 更新客户最近跟进时间
DELIMITER //
CREATE TRIGGER trg_followup_update_customer
AFTER INSERT ON t_followups
FOR EACH ROW
BEGIN
    UPDATE t_customers 
    SET last_follow_time = NEW.follow_time 
    WHERE sid = NEW.customer_id;
END//
DELIMITER ;
```

## 代码配置

```sql
-- Function: followups
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-cust-flw', '跟进记录', 'followups', 'customer.followups.moduleName', 'function', 'code-cust', 'carbon:activity', 30, 'enabled');

-- Code: method
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-method', '跟进方式', 'method', 'customer.followups.method', 'code', 'code-cust-flw', 10, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort, status) VALUES
('code-cust-method-phone', '电话', 'phone', 'customer.followups.methodPhone', 'value', 'code-cust-method', 'carbon:phone', '#52c41a', 10, 'enabled'),
('code-cust-method-email', '邮件', 'email', 'customer.followups.methodEmail', 'value', 'code-cust-method', 'carbon:email', '#1890ff', 20, 'enabled'),
('code-cust-method-meeting', '会议', 'meeting', 'customer.followups.methodMeeting', 'value', 'code-cust-method', 'carbon:video', '#722ed1', 30, 'enabled'),
('code-cust-method-visit', '拜访', 'visit', 'customer.followups.methodVisit', 'value', 'code-cust-method', 'carbon:location', '#faad14', 40, 'enabled'),
('code-cust-method-wechat', '微信', 'wechat', 'customer.followups.methodWechat', 'value', 'code-cust-method', 'carbon:logo--wechat', '#07c160', 50, 'enabled'),
('code-cust-method-other', '其他', 'other', 'customer.followups.methodOther', 'value', 'code-cust-method', 'carbon:unknown', '#999999', 60, 'enabled');
```
