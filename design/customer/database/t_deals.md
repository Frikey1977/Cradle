# t_deals - 成交记录表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_deals |
| 中文名 | 成交记录表 |
| 说明 | 记录已成功签约的订单和合同信息，跟踪回款和交付状态。 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | deal_no | VARCHAR | 50 | YES | - | 成交编号，系统自动生成，格式：D+年月日+4位序号 |
| 3 | customer_id | VARCHAR | 36 | YES | - | 关联客户ID，关联 t_customers.sid |
| 4 | opportunity_id | VARCHAR | 36 | NO | NULL | 关联商机ID，关联 t_opportunities.sid |
| 5 | name | VARCHAR | 200 | YES | - | 成交名称/合同名称 |
| 6 | amount | DECIMAL | 18,2 | YES | 0 | 成交金额 |
| 7 | paid_amount | DECIMAL | 18,2 | YES | 0 | 已回款金额 |
| 8 | unpaid_amount | DECIMAL | 18,2 | YES | 0 | 未回款金额（amount - paid_amount） |
| 9 | payment_method | VARCHAR | 50 | NO | NULL | 付款方式：once/installment/month/quarter/year |
| 10 | sign_date | DATE | NO | NULL | 签约日期 |
| 11 | expected_delivery_date | DATE | NO | NULL | 预计交付日期 |
| 12 | actual_delivery_date | DATE | NO | NULL | 实际交付日期 |
| 13 | status | VARCHAR | 20 | YES | 'pending' | 成交状态：pending/signed/paid/delivered/closed/cancelled |
| 14 | contract_files | JSON | NO | NULL | 合同文件列表 |
| 15 | remark | TEXT | NO | NULL | 备注说明 |
| 16 | owner_id | VARCHAR | 36 | NO | NULL | 负责人ID，关联 t_employees.sid |
| 17 | create_time | DATETIME | YES | CURRENT_TIMESTAMP | 创建时间 |
| 18 | deleted | TINYINT | YES | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 19 | timestamp | TIMESTAMP | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### deal_no 成交编号

- 格式：`D` + `年月日` + `4位序号`
- 示例：`D202403200001`
- 生成规则：每日从0001开始递增

### status 成交状态

| 状态编码 | 状态名称 | 说明 |
|---------|---------|------|
| pending | 待签约 | 已确定意向，待正式签约 |
| signed | 已签约 | 合同已签署 |
| paid | 已付款 | 客户已完成付款 |
| delivered | 已交付 | 产品/服务已交付 |
| closed | 已关闭 | 交易完成，归档 |
| cancelled | 已取消 | 交易取消 |

状态流转：
```
pending → signed → paid → delivered → closed
   ↓
cancelled
```

### payment_method 付款方式

| 方式编码 | 方式名称 | 说明 |
|---------|---------|------|
| once | 一次性付款 | 合同签订后一次性支付 |
| installment | 分期付款 | 按约定分期支付 |
| month | 月付 | 按月支付 |
| quarter | 季付 | 按季度支付 |
| year | 年付 | 按年支付 |

### contract_files 合同文件

JSON格式存储合同文件列表：
```json
[
  { "name": "销售合同.pdf", "url": "/files/xxx.pdf", "size": 2048000 },
  { "name": "技术协议.pdf", "url": "/files/yyy.pdf", "size": 1024000 }
]
```

### unpaid_amount 未回款金额

计算公式：`amount - paid_amount`

用于跟踪回款进度。

## 索引设计

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键 | sid | 主键索引 |
| uk_deal_no | 唯一 | deal_no | 成交编号唯一 |
| idx_customer | 普通 | customer_id | 按客户筛选 |
| idx_opportunity | 普通 | opportunity_id | 按商机筛选 |
| idx_status | 普通 | status | 按状态筛选 |
| idx_owner | 普通 | owner_id | 按负责人筛选 |
| idx_sign_date | 普通 | sign_date | 按签约日期筛选 |
| idx_create_time | 普通 | create_time | 按创建时间排序 |

## 建表语句

```sql
CREATE TABLE t_deals (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    deal_no VARCHAR(50) NOT NULL COMMENT '成交编号，格式：D+年月日+4位序号',
    customer_id VARCHAR(36) NOT NULL COMMENT '关联客户ID',
    opportunity_id VARCHAR(36) COMMENT '关联商机ID',
    name VARCHAR(200) NOT NULL COMMENT '成交名称',
    amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '成交金额',
    paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '已回款金额',
    unpaid_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '未回款金额',
    payment_method VARCHAR(50) COMMENT '付款方式',
    sign_date DATE COMMENT '签约日期',
    expected_delivery_date DATE COMMENT '预计交付日期',
    actual_delivery_date DATE COMMENT '实际交付日期',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '成交状态',
    contract_files JSON COMMENT '合同文件列表',
    remark TEXT COMMENT '备注说明',
    owner_id VARCHAR(36) COMMENT '负责人ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_deal_no (deal_no),
    KEY idx_customer (customer_id),
    KEY idx_opportunity (opportunity_id),
    KEY idx_status (status),
    KEY idx_owner (owner_id),
    KEY idx_sign_date (sign_date),
    KEY idx_create_time (create_time),
    
    CONSTRAINT fk_deal_customer FOREIGN KEY (customer_id) REFERENCES t_customers(sid) ON DELETE CASCADE,
    CONSTRAINT fk_deal_opportunity FOREIGN KEY (opportunity_id) REFERENCES t_opportunities(sid) ON DELETE SET NULL,
    CONSTRAINT fk_deal_owner FOREIGN KEY (owner_id) REFERENCES t_employees(sid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成交记录表';
```

## 关联关系

| 关联表 | 关联字段 | 关系 | 说明 |
|-------|---------|------|------|
| t_customers | customer_id | 多对一 | 成交所属客户 |
| t_opportunities | opportunity_id | 一对一 | 关联的商机（赢单） |
| t_employees | owner_id | 多对一 | 成交负责人 |

## 业务规则

1. **成交编号唯一**：deal_no 全局唯一
2. **必须关联客户**：customer_id 不能为空
3. **商机可选**：opportunity_id 可为空（直接成交）
4. **金额计算**：unpaid_amount = amount - paid_amount
5. **状态流转**：按定义的状态流转规则执行
6. **回款跟踪**：paid_amount 不能超过 amount
7. **业绩统计**：已签约（signed）及以上的成交计入业绩

## 触发器建议

```sql
-- 自动计算未回款金额
DELIMITER //
CREATE TRIGGER trg_deal_calc_unpaid_insert
BEFORE INSERT ON t_deals
FOR EACH ROW
BEGIN
    SET NEW.unpaid_amount = NEW.amount - NEW.paid_amount;
END//

CREATE TRIGGER trg_deal_calc_unpaid_update
BEFORE UPDATE ON t_deals
FOR EACH ROW
BEGIN
    IF NEW.amount != OLD.amount OR NEW.paid_amount != OLD.paid_amount THEN
        SET NEW.unpaid_amount = NEW.amount - NEW.paid_amount;
    END IF;
END//

-- 更新客户成交统计
CREATE TRIGGER trg_deal_update_customer_stats
AFTER INSERT ON t_deals
FOR EACH ROW
BEGIN
    IF NEW.status IN ('signed', 'paid', 'delivered', 'closed') THEN
        UPDATE t_customers 
        SET deal_count = deal_count + 1,
            total_deal_amount = total_deal_amount + NEW.amount
        WHERE sid = NEW.customer_id;
    END IF;
END//
DELIMITER ;
```

## 回款记录表（扩展）

如需详细记录每次回款，可创建 t_deal_payments 表：

```sql
CREATE TABLE t_deal_payments (
    deal_id VARCHAR(36) NOT NULL COMMENT '关联成交ID',
    payment_no VARCHAR(50) NOT NULL COMMENT '回款编号',
    amount DECIMAL(18,2) NOT NULL COMMENT '回款金额',
    payment_date DATE NOT NULL COMMENT '回款日期',
    payment_method VARCHAR(50) COMMENT '付款方式',
    remark VARCHAR(500) COMMENT '备注',
    attachments JSON COMMENT '回款凭证',
    create_by VARCHAR(36) COMMENT '记录人',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (deal_id, payment_no),
    KEY idx_payment_date (payment_date),
    
    CONSTRAINT fk_payment_deal FOREIGN KEY (deal_id) REFERENCES t_deals(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='回款记录表';
```

## 代码配置

```sql
-- Function: deals
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-cust-deal', '成交管理', 'deals', 'customer.deals.moduleName', 'function', 'code-cust', 'carbon:checkmark--outline', 40, 'enabled');

-- Code: status
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-deal-status', '成交状态', 'status', 'customer.deals.status', 'code', 'code-cust-deal', 10, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, color, sort, status) VALUES
('code-cust-deal-pending', '待签约', 'pending', 'customer.deals.statusPending', 'value', 'code-cust-deal-status', '#faad14', 10, 'enabled'),
('code-cust-deal-signed', '已签约', 'signed', 'customer.deals.statusSigned', 'value', 'code-cust-deal-status', '#1890ff', 20, 'enabled'),
('code-cust-deal-paid', '已付款', 'paid', 'customer.deals.statusPaid', 'value', 'code-cust-deal-status', '#722ed1', 30, 'enabled'),
('code-cust-deal-delivered', '已交付', 'delivered', 'customer.deals.statusDelivered', 'value', 'code-cust-deal-status', '#52c41a', 40, 'enabled'),
('code-cust-deal-closed', '已关闭', 'closed', 'customer.deals.statusClosed', 'value', 'code-cust-deal-status', '#999999', 50, 'enabled'),
('code-cust-deal-cancelled', '已取消', 'cancelled', 'customer.deals.statusCancelled', 'value', 'code-cust-deal-status', '#ff4d4f', 60, 'enabled');

-- Code: payment_method
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-payment', '付款方式', 'payment_method', 'customer.deals.paymentMethod', 'code', 'code-cust-deal', 20, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-payment-once', '一次性付款', 'once', 'customer.deals.paymentOnce', 'value', 'code-cust-payment', 10, 'enabled'),
('code-cust-payment-installment', '分期付款', 'installment', 'customer.deals.paymentInstallment', 'value', 'code-cust-payment', 20, 'enabled'),
('code-cust-payment-month', '月付', 'month', 'customer.deals.paymentMonth', 'value', 'code-cust-payment', 30, 'enabled'),
('code-cust-payment-quarter', '季付', 'quarter', 'customer.deals.paymentQuarter', 'value', 'code-cust-payment', 40, 'enabled'),
('code-cust-payment-year', '年付', 'year', 'customer.deals.paymentYear', 'value', 'code-cust-payment', 50, 'enabled');
```
