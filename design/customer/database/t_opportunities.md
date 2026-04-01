# t_opportunities - 商机表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_opportunities |
| 中文名 | 商机表 |
| 说明 | 销售机会表，记录从初步接触到成交的全过程。商机是销售漏斗的核心数据。 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | opportunity_no | VARCHAR | 50 | YES | - | 商机编号，系统自动生成，格式：O+年月日+4位序号 |
| 3 | customer_id | VARCHAR | 36 | YES | - | 关联客户ID，关联 t_customers.sid |
| 4 | name | VARCHAR | 200 | YES | - | 商机名称/标题 |
| 5 | source | VARCHAR | 50 | NO | NULL | 商机来源：phone/email/exhibition/referral/website/social/partner/other |
| 6 | stage | VARCHAR | 50 | YES | 'initial' | 当前阶段：initial/needs/proposal/negotiation/won/lost |
| 7 | probability | INT | YES | 10 | 赢率百分比：10/30/60/80/100/0 |
| 8 | amount | DECIMAL | 18,2 | YES | 0 | 预计成交金额 |
| 9 | expected_amount | DECIMAL | 18,2 | YES | 0 | 预计加权金额（amount * probability） |
| 10 | actual_amount | DECIMAL | 18,2 | YES | 0 | 实际成交金额 |
| 11 | expected_close_date | DATE | NO | NULL | 预计成交日期 |
| 12 | actual_close_date | DATE | NO | NULL | 实际成交日期 |
| 13 | close_reason | VARCHAR | 500 | NO | NULL | 关闭原因（赢单或输单原因） |
| 14 | description | TEXT | NO | NULL | 需求描述/商机详情 |
| 15 | owner_id | VARCHAR | 36 | NO | NULL | 负责人ID，关联 t_employees.sid |
| 16 | status | VARCHAR | 20 | YES | 'open' | 状态：open=进行中, closed=已关闭 |
| 17 | create_time | DATETIME | YES | CURRENT_TIMESTAMP | 创建时间 |
| 18 | deleted | TINYINT | YES | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 19 | timestamp | TIMESTAMP | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### opportunity_no 商机编号

- 格式：`O` + `年月日` + `4位序号`
- 示例：`O202403200001`
- 生成规则：每日从0001开始递增

### stage 商机阶段

| 阶段编码 | 阶段名称 | 赢率 | 说明 |
|---------|---------|------|------|
| initial | 初步接触 | 10% | 刚建立联系，了解初步需求 |
| needs | 需求确认 | 30% | 深入沟通，确认具体需求 |
| proposal | 方案报价 | 60% | 提供解决方案和报价 |
| negotiation | 谈判协商 | 80% | 商务谈判，条款协商 |
| won | 赢单 | 100% | 成功签约 |
| lost | 输单 | 0% | 未能成交 |

### source 商机来源

| 来源编码 | 来源名称 |
|---------|---------|
| phone | 电话咨询 |
| email | 邮件咨询 |
| exhibition | 展会活动 |
| referral | 客户推荐 |
| website | 官网注册 |
| social | 社交媒体 |
| partner | 合作伙伴 |
| other | 其他渠道 |

### expected_amount 预计加权金额

计算公式：`amount * probability / 100`

用于销售预测，反映考虑赢率后的预期收入。

### status 状态

- **open**：商机进行中，可继续推进
- **closed**：商机已关闭（won 或 lost）

## 索引设计

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键 | sid | 主键索引 |
| uk_opportunity_no | 唯一 | opportunity_no | 商机编号唯一 |
| idx_customer | 普通 | customer_id | 按客户筛选 |
| idx_stage | 普通 | stage | 按阶段筛选 |
| idx_status | 普通 | status | 按状态筛选 |
| idx_owner | 普通 | owner_id | 按负责人筛选 |
| idx_source | 普通 | source | 按来源筛选 |
| idx_expected_close | 普通 | expected_close_date | 按预计成交日期筛选 |
| idx_create_time | 普通 | create_time | 按创建时间排序 |

## 建表语句

```sql
CREATE TABLE t_opportunities (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    opportunity_no VARCHAR(50) NOT NULL COMMENT '商机编号，格式：O+年月日+4位序号',
    customer_id VARCHAR(36) NOT NULL COMMENT '关联客户ID',
    name VARCHAR(200) NOT NULL COMMENT '商机名称',
    source VARCHAR(50) COMMENT '商机来源',
    stage VARCHAR(50) NOT NULL DEFAULT 'initial' COMMENT '当前阶段',
    probability INT NOT NULL DEFAULT 10 COMMENT '赢率百分比',
    amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '预计成交金额',
    expected_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '预计加权金额',
    actual_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '实际成交金额',
    expected_close_date DATE COMMENT '预计成交日期',
    actual_close_date DATE COMMENT '实际成交日期',
    close_reason VARCHAR(500) COMMENT '关闭原因',
    description TEXT COMMENT '需求描述',
    owner_id VARCHAR(36) COMMENT '负责人ID',
    status VARCHAR(20) NOT NULL DEFAULT 'open' COMMENT '状态：open/closed',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_opportunity_no (opportunity_no),
    KEY idx_customer (customer_id),
    KEY idx_stage (stage),
    KEY idx_status (status),
    KEY idx_owner (owner_id),
    KEY idx_source (source),
    KEY idx_expected_close (expected_close_date),
    KEY idx_create_time (create_time),
    
    CONSTRAINT fk_opportunity_customer FOREIGN KEY (customer_id) REFERENCES t_customers(sid) ON DELETE CASCADE,
    CONSTRAINT fk_opportunity_owner FOREIGN KEY (owner_id) REFERENCES t_employees(sid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商机表';
```

## 关联关系

| 关联表 | 关联字段 | 关系 | 说明 |
|-------|---------|------|------|
| t_customers | customer_id | 多对一 | 商机所属客户 |
| t_employees | owner_id | 多对一 | 商机负责人 |
| t_followups | opportunity_id | 一对多 | 商机的跟进记录 |
| t_deals | opportunity_id | 一对一 | 赢单后关联的成交记录 |

## 业务规则

1. **商机编号唯一**：opportunity_no 全局唯一
2. **必须关联客户**：customer_id 不能为空
3. **阶段与赢率对应**：stage 变更时 probability 应同步更新
4. **加权金额计算**：expected_amount = amount * probability / 100
5. **关闭商机**：stage 为 won 或 lost 时，status 自动变为 closed
6. **实际成交日期**：won 时必须填写 actual_close_date 和 actual_amount
7. **输单原因**：lost 时建议填写 close_reason

## 触发器建议

```sql
-- 自动计算加权金额
DELIMITER //
CREATE TRIGGER trg_opportunity_calc_expected
BEFORE INSERT ON t_opportunities
FOR EACH ROW
BEGIN
    SET NEW.expected_amount = NEW.amount * NEW.probability / 100;
END//

CREATE TRIGGER trg_opportunity_calc_expected_update
BEFORE UPDATE ON t_opportunities
FOR EACH ROW
BEGIN
    IF NEW.amount != OLD.amount OR NEW.probability != OLD.probability THEN
        SET NEW.expected_amount = NEW.amount * NEW.probability / 100;
    END IF;
    
    -- 更新状态
    IF NEW.stage IN ('won', 'lost') THEN
        SET NEW.status = 'closed';
    END IF;
END//
DELIMITER ;
```

## 代码配置

```sql
-- Function: opportunities
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-cust-opp', '商机管理', 'opportunities', 'customer.opportunities.moduleName', 'function', 'code-cust', 'carbon:opportunities', 20, 'enabled');

-- Code: stage
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-stage', '商机阶段', 'stage', 'customer.opportunities.stage', 'code', 'code-cust-opp', 10, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, color, sort, status, metadata) VALUES
('code-cust-stage-initial', '初步接触', 'initial', 'customer.opportunities.stageInitial', 'value', 'code-cust-stage', '#999999', 10, 'enabled', '{"probability": 10}'),
('code-cust-stage-needs', '需求确认', 'needs', 'customer.opportunities.stageNeeds', 'value', 'code-cust-stage', '#1890ff', 20, 'enabled', '{"probability": 30}'),
('code-cust-stage-proposal', '方案报价', 'proposal', 'customer.opportunities.stageProposal', 'value', 'code-cust-stage', '#faad14', 30, 'enabled', '{"probability": 60}'),
('code-cust-stage-negotiation', '谈判协商', 'negotiation', 'customer.opportunities.stageNegotiation', 'value', 'code-cust-stage', '#722ed1', 40, 'enabled', '{"probability": 80}'),
('code-cust-stage-won', '赢单', 'won', 'customer.opportunities.stageWon', 'value', 'code-cust-stage', '#52c41a', 50, 'enabled', '{"probability": 100}'),
('code-cust-stage-lost', '输单', 'lost', 'customer.opportunities.stageLost', 'value', 'code-cust-stage', '#ff4d4f', 60, 'enabled', '{"probability": 0}');

-- Code: source
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-source', '商机来源', 'source', 'customer.opportunities.source', 'code', 'code-cust-opp', 20, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-cust-source-phone', '电话咨询', 'phone', 'customer.opportunities.sourcePhone', 'value', 'code-cust-source', 'carbon:phone', 10, 'enabled'),
('code-cust-source-email', '邮件咨询', 'email', 'customer.opportunities.sourceEmail', 'value', 'code-cust-source', 'carbon:email', 20, 'enabled'),
('code-cust-source-exhibition', '展会活动', 'exhibition', 'customer.opportunities.sourceExhibition', 'value', 'code-cust-source', 'carbon:events', 30, 'enabled'),
('code-cust-source-referral', '客户推荐', 'referral', 'customer.opportunities.sourceReferral', 'value', 'code-cust-source', 'carbon:user--favorite', 40, 'enabled'),
('code-cust-source-website', '官网注册', 'website', 'customer.opportunities.sourceWebsite', 'value', 'code-cust-source', 'carbon:web', 50, 'enabled'),
('code-cust-source-social', '社交媒体', 'social', 'customer.opportunities.sourceSocial', 'value', 'code-cust-source', 'carbon:logo--wechat', 60, 'enabled'),
('code-cust-source-partner', '合作伙伴', 'partner', 'customer.opportunities.sourcePartner', 'value', 'code-cust-source', 'carbon:partnership', 70, 'enabled'),
('code-cust-source-other', '其他渠道', 'other', 'customer.opportunities.sourceOther', 'value', 'code-cust-source', 'carbon:unknown', 80, 'enabled');
```
