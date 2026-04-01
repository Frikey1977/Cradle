# 客户管理模块 (Customer)

## 模块概述

客户管理模块是一个简易版CRM系统，实现从商机到成交的业务过程跟踪。该模块帮助销售团队管理客户信息、跟踪销售机会、记录跟进活动，最终促成交易达成。

## 核心功能

| 功能 | 说明 |
|------|------|
| 客户管理 | 维护客户基本信息，支持企业客户和个人客户 |
| 商机管理 | 跟踪销售机会，管理商机阶段和预计成交金额 |
| 跟进记录 | 记录与客户的每次互动，包括电话、邮件、会议等 |
| 成交管理 | 管理订单和合同，跟踪成交状态 |
| 销售漏斗 | 可视化展示各阶段商机分布 |

## 业务流程

```
线索/潜在客户 → 客户建档 → 商机创建 → 跟进推进 → 报价/谈判 → 成交/关闭
     │              │           │           │           │          │
     └──────────────┴───────────┴───────────┴───────────┴──────────┘
                        销售漏斗各阶段
```

### 商机阶段流转

```
初步接触 → 需求确认 → 方案报价 → 谈判协商 → 赢单/输单
   │          │          │          │         │
  10%        30%        60%        80%      100%/0%
```

## 子模块清单

| 子模块 | 文档 | 说明 |
|--------|------|------|
| 客户管理 | [customer.md](./customer.md) | 客户信息维护 |
| 商机管理 | [opportunity.md](./opportunity.md) | 销售机会跟踪 |
| 跟进记录 | [followup.md](./followup.md) | 客户互动记录 |
| 成交管理 | [deal.md](./deal.md) | 订单合同管理 |

## 数据库表清单

| 表名 | 说明 | 文档 |
|------|------|------|
| t_customers | 客户表 | [t_customers.md](./database/t_customers.md) |
| t_opportunities | 商机表 | [t_opportunities.md](./database/t_opportunities.md) |
| t_followups | 跟进记录表 | [t_followups.md](./database/t_followups.md) |
| t_deals | 成交记录表 | [t_deals.md](./database/t_deals.md) |
| r_customer_contact | 客户-联系人关联表 | [r_customer_contact.md](./database/r_customer_contact.md) |

## 关联模块

- [组织架构](../organization/README.md) - 销售人员归属
- [联系人](../organization/t_contacts.md) - 客户联系人信息（t_contacts为系统保留表）
- [系统管理](../system/README.md) - 用户权限管理

## 代码配置

CRM模块使用以下代码配置：

| 配置项 | 路径 | 说明 |
|--------|------|------|
| 客户类型 | customer.customers.type | 企业客户、个人客户 |
| 客户等级 | customer.customers.level | A级、B级、C级、D级 |
| 商机阶段 | customer.opportunities.stage | 初步接触、需求确认、方案报价、谈判协商、赢单、输单 |
| 商机来源 | customer.opportunities.source | 电话、邮件、展会、推荐、网络等 |
| 跟进方式 | customer.followups.method | 电话、邮件、会议、拜访、其他 |
| 成交状态 | customer.deals.status | 待签约、已签约、已付款、已交付、已关闭 |

## 权限码

| 权限码 | 说明 |
|--------|------|
| customer:customers:view | 查看客户 |
| customer:customers:create | 创建客户 |
| customer:customers:update | 更新客户 |
| customer:customers:delete | 删除客户 |
| customer:opportunities:view | 查看商机 |
| customer:opportunities:create | 创建商机 |
| customer:opportunities:update | 更新商机 |
| customer:opportunities:delete | 删除商机 |
| customer:followups:view | 查看跟进记录 |
| customer:followups:create | 创建跟进记录 |
| customer:followups:update | 更新跟进记录 |
| customer:deals:view | 查看成交记录 |
| customer:deals:create | 创建成交记录 |
| customer:deals:update | 更新成交记录 |
