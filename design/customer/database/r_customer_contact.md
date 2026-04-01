# r_customer_contact - 客户-联系人关联表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | r_customer_contact |
| 中文名 | 客户-联系人关联表 |
| 说明 | 维护客户与联系人的多对多关系。一个客户可以有多个联系人，一个联系人（通过t_contacts）可以关联多个客户（如合作伙伴）。注意：t_contacts是系统保留表，本表仅存储关联关系。 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | customer_id | VARCHAR | 36 | YES | - | 客户ID，关联 t_customers.sid，联合主键第一部分 |
| 2 | contact_id | VARCHAR | 36 | YES | - | 联系人ID，关联 t_contacts.sid，联合主键第二部分 |
| 3 | is_primary | TINYINT | YES | 0 | 是否主要联系人：0=否, 1=是 |
| 4 | role | VARCHAR | 100 | NO | NULL | 职位/角色（如：采购经理、技术负责人） |
| 5 | department | VARCHAR | 100 | NO | NULL | 所在部门 |
| 6 | remark | VARCHAR | 500 | NO | NULL | 备注说明 |
| 7 | create_time | DATETIME | YES | CURRENT_TIMESTAMP | 创建时间 |

## 字段详细说明

### customer_id / contact_id

联合主键，确保一个客户与一个联系人的关联唯一。

- `customer_id`：关联 [t_customers](./t_customers.md).sid
- `contact_id`：关联 t_contacts.sid（系统保留表，不占用或修改）

### is_primary 主要联系人

标记该联系人是否为客户的默认/主要联系人：
主要联系人，在客户列表中显示
普通联系人

**约束**：一个客户只能有一个主要联系人。

### role 角色

描述该联系人在客户方的角色或职位，如：
- 采购经理
- 技术负责人
- 决策者
- 使用人

## 索引设计

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| PRIMARY | 主键 | (customer_id, contact_id) | 联合主键 |
| idx_contact | 普通 | contact_id | 按联系人筛选 |
| idx_primary | 普通 | customer_id, is_primary | 查询主要联系人 |

## 建表语句

```sql
CREATE TABLE r_customer_contact (
    customer_id VARCHAR(36) NOT NULL COMMENT '客户ID',
    contact_id VARCHAR(36) NOT NULL COMMENT '联系人ID，关联t_contacts.sid',
    is_primary TINYINT NOT NULL DEFAULT 0 COMMENT '是否主要联系人：0=否, 1=是',
    role VARCHAR(100) COMMENT '职位/角色',
    department VARCHAR(100) COMMENT '所在部门',
    remark VARCHAR(500) COMMENT '备注说明',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    
    PRIMARY KEY (customer_id, contact_id),
    KEY idx_contact (contact_id),
    KEY idx_primary (customer_id, is_primary),
    
    CONSTRAINT fk_rcc_customer FOREIGN KEY (customer_id) REFERENCES t_customers(sid) ON DELETE CASCADE,
    CONSTRAINT fk_rcc_contact FOREIGN KEY (contact_id) REFERENCES t_contacts(sid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户-联系人关联表';
```

## 关联关系

| 关联表 | 关联字段 | 关系 | 说明 |
|-------|---------|------|------|
| t_customers | customer_id | 多对一 | 关联的客户 |
| t_contacts | contact_id | 多对一 | 关联的联系人（系统保留表） |

## 业务规则

1. **联合主键**：(customer_id, contact_id) 组合唯一
2. **主要联系人唯一**：一个客户只能有一个 is_primary=1 的联系人
3. **级联删除**：客户删除时，关联记录自动删除
4. **联系人删除**：联系人删除时，关联记录自动删除
5. **不存储联系人详情**：联系人姓名、电话等信息存储在 t_contacts 中

## 主要联系人维护触发器

```sql
-- 确保一个客户只有一个主要联系人
DELIMITER //
CREATE TRIGGER trg_rcc_primary_insert
BEFORE INSERT ON r_customer_contact
FOR EACH ROW
BEGIN
    IF NEW.is_primary = 1 THEN
        UPDATE r_customer_contact 
        SET is_primary = 0 
        WHERE customer_id = NEW.customer_id AND is_primary = 1;
    END IF;
END//

CREATE TRIGGER trg_rcc_primary_update
BEFORE UPDATE ON r_customer_contact
FOR EACH ROW
BEGIN
    IF NEW.is_primary = 1 AND OLD.is_primary = 0 THEN
        UPDATE r_customer_contact 
        SET is_primary = 0 
        WHERE customer_id = NEW.customer_id AND is_primary = 1;
    END IF;
END//
DELIMITER ;
```

## 使用示例

### 查询客户的所有联系人

```sql
SELECT 
    c.sid as customer_id,
    c.name as customer_name,
    ct.profile->>'$.facts.basic.name' as contact_name,
    ct.profile->>'$.facts.work.position' as contact_position,
    rcc.role,
    rcc.department,
    rcc.is_primary
FROM t_customers c
JOIN r_customer_contact rcc ON c.sid = rcc.customer_id
JOIN t_contacts ct ON rcc.contact_id = ct.sid
WHERE c.sid = 'cust-xxx'
ORDER BY rcc.is_primary DESC, rcc.create_time;
```

### 添加联系人关联

```sql
-- 假设已存在 contact_id = 'contact-xxx'
INSERT INTO r_customer_contact (customer_id, contact_id, is_primary, role, department)
VALUES ('cust-xxx', 'contact-xxx', 1, '采购经理', '采购部');
```

### 更新主要联系人

```sql
-- 将某个联系人设为主要联系人
UPDATE r_customer_contact 
SET is_primary = 1 
WHERE customer_id = 'cust-xxx' AND contact_id = 'contact-yyy';
-- 触发器会自动将其他联系人设为 is_primary=0
```

## 与 t_customers 的协作

[t_customers](./t_customers.md) 表中存储了主要联系人的冗余信息：
- `primary_contact_name`
- `primary_contact_phone`
- `primary_contact_email`

这些字段用于快速展示，实际详情需通过 r_customer_contact 关联 t_contacts 获取。

**数据同步建议**：
- 当 r_customer_contact 中 is_primary=1 的联系人变更时，同步更新 t_customers 的冗余字段
- 或通过触发器/应用层保持数据一致
