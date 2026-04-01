# t_customers - 客户表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_customers |
| 中文名 | 客户表 |
| 说明 | CRM客户主表，存储客户基本信息。客户是商机和成交的基础实体。 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | customer_no | VARCHAR | 50 | YES | - | 客户编号，系统自动生成，格式：C+年月日+4位序号 |
| 3 | name | VARCHAR | 200 | YES | - | 客户名称（企业名称或个人姓名） |
| 4 | type | VARCHAR | 20 | YES | - | 客户类型：enterprise=企业客户, individual=个人客户, partner=合作伙伴 |
| 5 | level | VARCHAR | 10 | YES | 'D' | 客户等级：A=重点客户, B=普通客户, C=小客户, D=潜在客户 |
| 6 | industry | VARCHAR | 100 | NO | NULL | 所属行业 |
| 7 | scale | VARCHAR | 50 | NO | NULL | 企业规模（人数范围） |
| 8 | region | VARCHAR | 100 | NO | NULL | 所在地区/城市 |
| 9 | address | VARCHAR | 500 | NO | NULL | 详细地址 |
| 10 | primary_contact_name | VARCHAR | 100 | NO | NULL | 主要联系人姓名 |
| 11 | primary_contact_phone | VARCHAR | 50 | NO | NULL | 主要联系人电话 |
| 12 | primary_contact_email | VARCHAR | 200 | NO | NULL | 主要联系人邮箱 |
| 13 | website | VARCHAR | 255 | NO | NULL | 客户网站 |
| 14 | owner_id | VARCHAR | 36 | NO | NULL | 负责人ID，关联 t_employees.sid |
| 15 | remark | TEXT | NO | NULL | 备注说明 |
| 16 | last_follow_time | DATETIME | NO | NULL | 最近跟进时间 |
| 17 | opportunity_count | INT | YES | 0 | 关联商机数量（冗余字段） |
| 18 | deal_count | INT | YES | 0 | 成交次数（冗余字段） |
| 19 | total_deal_amount | DECIMAL | 18,2 | YES | 0 | 累计成交金额（冗余字段） |
| 20 | status | VARCHAR | 20 | YES | 'enabled' | 状态：enabled=启用, disabled=停用 |
| 21 | description | VARCHAR | 500 | NO | NULL | 描述说明 |
| 22 | create_time | DATETIME | YES | CURRENT_TIMESTAMP | 创建时间 |
| 23 | deleted | TINYINT | YES | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 24 | timestamp | TIMESTAMP | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### customer_no 客户编号

- 格式：`C` + `年月日` + `4位序号`
- 示例：`C202403200001`
- 生成规则：每日从0001开始递增

### type 客户类型

| 值 | 说明 | 适用场景 |
|----|------|----------|
| enterprise | 企业客户 | B2B业务 |
| individual | 个人客户 | B2C业务 |
| partner | 合作伙伴 | 渠道伙伴、代理商 |

### level 客户等级

| 值 | 说明 | 判定标准建议 |
|----|------|-------------|
| A | 重点客户 | 高价值、高潜力 |
| B | 普通客户 | 中等价值 |
| C | 小客户 | 低价值但活跃 |
| D | 潜在客户 | 尚未成交 |

### owner_id 负责人

关联 `t_employees.sid`，指定负责跟进该客户的销售人员。

### 冗余字段说明

以下字段为冗余设计，用于提升查询性能，需通过触发器或应用层维护一致性：

- `opportunity_count`：关联商机数量
- `deal_count`：成交次数
- `total_deal_amount`：累计成交金额
- `last_follow_time`：最近跟进时间

## 索引设计

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键 | sid | 主键索引 |
| uk_customer_no | 唯一 | customer_no | 客户编号唯一 |
| idx_name | 普通 | name | 客户名称搜索 |
| idx_type | 普通 | type | 按类型筛选 |
| idx_level | 普通 | level | 按等级筛选 |
| idx_owner | 普通 | owner_id | 按负责人筛选 |
| idx_status | 普通 | status | 按状态筛选 |
| idx_create_time | 普通 | create_time | 按创建时间排序 |

## 建表语句

```sql
CREATE TABLE t_customers (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    customer_no VARCHAR(50) NOT NULL COMMENT '客户编号，格式：C+年月日+4位序号',
    name VARCHAR(200) NOT NULL COMMENT '客户名称',
    type VARCHAR(20) NOT NULL COMMENT '客户类型：enterprise/individual/partner',
    level VARCHAR(10) NOT NULL DEFAULT 'D' COMMENT '客户等级：A/B/C/D',
    industry VARCHAR(100) COMMENT '所属行业',
    scale VARCHAR(50) COMMENT '企业规模',
    region VARCHAR(100) COMMENT '所在地区',
    address VARCHAR(500) COMMENT '详细地址',
    primary_contact_name VARCHAR(100) COMMENT '主要联系人姓名',
    primary_contact_phone VARCHAR(50) COMMENT '主要联系人电话',
    primary_contact_email VARCHAR(200) COMMENT '主要联系人邮箱',
    website VARCHAR(255) COMMENT '客户网站',
    owner_id VARCHAR(36) COMMENT '负责人ID，关联t_employees.sid',
    remark TEXT COMMENT '备注说明',
    last_follow_time DATETIME COMMENT '最近跟进时间',
    opportunity_count INT NOT NULL DEFAULT 0 COMMENT '关联商机数量',
    deal_count INT NOT NULL DEFAULT 0 COMMENT '成交次数',
    total_deal_amount DECIMAL(18,2) NOT NULL DEFAULT 0 COMMENT '累计成交金额',
    status VARCHAR(20) NOT NULL DEFAULT 'enabled' COMMENT '状态：enabled/disabled',
    description VARCHAR(500) COMMENT '描述说明',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_customer_no (customer_no),
    KEY idx_name (name),
    KEY idx_type (type),
    KEY idx_level (level),
    KEY idx_owner (owner_id),
    KEY idx_status (status),
    KEY idx_create_time (create_time),
    
    CONSTRAINT fk_customer_owner FOREIGN KEY (owner_id) REFERENCES t_employees(sid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';
```

## 关联关系

| 关联表 | 关联字段 | 关系 | 说明 |
|-------|---------|------|------|
| t_employees | owner_id | 多对一 | 客户负责人 |
| t_opportunities | customer_id | 一对多 | 客户拥有的商机 |
| t_followups | customer_id | 一对多 | 客户的跟进记录 |
| t_deals | customer_id | 一对多 | 客户的成交记录 |
| r_customer_contact | customer_id | 一对多 | 客户的联系人 |

## 业务规则

1. **客户编号唯一**：customer_no 全局唯一，按规则自动生成
2. **客户名称必填**：name 不能为空
3. **客户类型必填**：type 必须在定义范围内
4. **负责人可空**：新创建客户可暂不分配负责人
5. **逻辑删除**：使用 deleted 字段标记删除，不物理删除
6. **冗余字段维护**：opportunity_count、deal_count、total_deal_amount、last_follow_time 需保持同步

## 代码配置

客户模块使用以下代码配置：

```sql
-- Module: customer
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort, status) VALUES
('code-cust', '客户管理', 'customer', 'customer.moduleName', 'module', NULL, 'carbon:customer', '#1890ff', 10, 'enabled');

-- Function: customers
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, sort, status) VALUES
('code-cust-cust', '客户管理', 'customers', 'customer.customers.moduleName', 'function', 'code-cust', 'carbon:customer', 10, 'enabled');

-- Code: type
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-type', '客户类型', 'type', 'customer.customers.type', 'code', 'code-cust-cust', 10, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, icon, color, sort, status) VALUES
('code-cust-type-enterprise', '企业客户', 'enterprise', 'customer.customers.typeEnterprise', 'value', 'code-cust-type', 'carbon:enterprise', '#ff4d4f', 10, 'enabled'),
('code-cust-type-individual', '个人客户', 'individual', 'customer.customers.typeIndividual', 'value', 'code-cust-type', 'carbon:user', '#52c41a', 20, 'enabled'),
('code-cust-type-partner', '合作伙伴', 'partner', 'customer.customers.typePartner', 'value', 'code-cust-type', 'carbon:partnership', '#faad14', 30, 'enabled');

-- Code: level
INSERT INTO t_codes (sid, name, value, title, type, parent_id, sort, status) VALUES
('code-cust-level', '客户等级', 'level', 'customer.customers.level', 'code', 'code-cust-cust', 20, 'enabled');

-- Items
INSERT INTO t_codes (sid, name, value, title, type, parent_id, color, sort, status) VALUES
('code-cust-level-a', 'A级', 'A', 'customer.customers.levelA', 'value', 'code-cust-level', '#ff4d4f', 10, 'enabled'),
('code-cust-level-b', 'B级', 'B', 'customer.customers.levelB', 'value', 'code-cust-level', '#faad14', 20, 'enabled'),
('code-cust-level-c', 'C级', 'C', 'customer.customers.levelC', 'value', 'code-cust-level', '#1890ff', 30, 'enabled'),
('code-cust-level-d', 'D级', 'D', 'customer.customers.levelD', 'value', 'code-cust-level', '#999999', 40, 'enabled');
```
