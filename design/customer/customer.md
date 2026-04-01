# 客户管理 (Customer)

## 1. 模块概述

### 1.1 功能定位
客户管理是CRM系统的核心模块，用于维护客户的基本信息、联系人、业务往来记录等。客户是商机和成交的基础，所有销售活动都围绕客户展开。

### 1.2 核心价值
- **客户资产沉淀**：将分散的客户信息集中管理，形成企业客户资产
- **信息共享**：销售团队可共享客户信息，避免重复工作和信息孤岛
- **关系维护**：记录客户互动历史，持续维护客户关系
- **数据分析**：基于客户数据进行分析，支持业务决策

### 1.3 使用场景
- **新客户录入**：获取新客户信息后建立客户档案
- **客户信息更新**：客户信息变更时及时更新
- **客户查询**：快速查找客户信息和历史记录
- **客户分级**：根据客户价值进行分级管理

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 客户列表 | 展示所有客户，支持筛选和搜索 |
| 客户创建 | 录入新客户信息 |
| 客户详情 | 查看客户完整信息和关联数据 |
| 客户编辑 | 修改客户信息 |
| 客户删除 | 删除客户（逻辑删除） |
| 联系人管理 | 维护客户的多个联系人 |
| 客户分配 | 将客户分配给销售人员 |

### 2.2 客户类型

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| enterprise | 企业客户 | B2B业务，有组织架构的客户 |
| individual | 个人客户 | B2C业务，个人消费者 |
| partner | 合作伙伴 | 渠道合作伙伴、代理商 |

### 2.3 客户等级

| 等级 | 说明 | 判定标准 |
|------|------|----------|
| A | 重点客户 | 高价值、高潜力客户 |
| B | 普通客户 | 中等价值客户 |
| C | 小客户 | 低价值但活跃客户 |
| D | 潜在客户 | 尚未成交的潜在客户 |

### 2.4 业务流程

#### 客户创建流程

```
1. 收集客户信息
   ├── 客户名称（必填）
   ├── 客户类型（必填）
   ├── 联系人信息
   ├── 联系方式
   └── 其他信息（行业、规模等）

2. 信息校验
   ├── 检查必填项
   ├── 检查联系方式格式
   └── 检查重复客户

3. 创建客户档案
   ├── 生成客户编号
   ├── 保存客户信息
   └── 创建联系人关联

4. 分配负责人
   └── 指定销售人员跟进
```

#### 客户信息更新流程

```
1. 查询客户
2. 编辑信息
3. 校验变更
4. 保存更新
5. 记录变更历史（可选）
```

## 3. 数据模型

### 3.1 客户表 (t_customers)

详见 [t_customers.md](./database/t_customers.md)

### 3.2 客户-联系人关联表 (r_customer_contact)

详见 [r_customer_contact.md](./database/r_customer_contact.md)

**说明**：由于 t_contacts 是系统保留表，客户联系人信息通过 r_customer_contact 关联到 t_contacts，同时在 t_customers 中保存主要联系人信息。

## 4. 接口设计

### 4.1 REST API

| 接口 | 方法 | 说明 | 权限码 |
|------|------|------|--------|
| /api/customers | GET | 获取客户列表 | customer:customers:view |
| /api/customers | POST | 创建客户 | customer:customers:create |
| /api/customers/:id | GET | 获取客户详情 | customer:customers:view |
| /api/customers/:id | PUT | 更新客户 | customer:customers:update |
| /api/customers/:id | DELETE | 删除客户 | customer:customers:delete |
| /api/customers/:id/contacts | GET | 获取客户联系人 | customer:customers:view |
| /api/customers/:id/contacts | POST | 添加联系人 | customer:customers:update |
| /api/customers/:id/assign | PUT | 分配负责人 | customer:customers:update |

### 4.2 接口详情

#### 创建客户

**请求**：
```json
POST /api/customers
{
  "name": "示例科技有限公司",
  "type": "enterprise",
  "level": "A",
  "industry": "互联网",
  "scale": "100-500人",
  "region": "北京",
  "address": "北京市海淀区xxx路xxx号",
  "primary_contact_name": "张三",
  "primary_contact_phone": "13800138000",
  "primary_contact_email": "zhangsan@example.com",
  "owner_id": "emp-001",
  "remark": "重点跟进客户"
}
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "sid": "cust-xxx",
    "customer_no": "C202403200001",
    "name": "示例科技有限公司",
    "type": "enterprise",
    "level": "A",
    "status": "enabled",
    "create_time": "2024-03-20T10:30:00Z"
  }
}
```

#### 获取客户列表

**请求**：
```
GET /api/customers?page=1&size=20&keyword=示例&type=enterprise&level=A&owner_id=emp-001
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 100
    }
  }
}
```

## 5. 前端页面

### 5.1 页面清单

| 页面 | 路径 | 说明 |
|------|------|------|
| 客户列表 | /customer/customers | 客户列表页，支持筛选搜索 |
| 客户详情 | /customer/customers/:id | 客户详情页，展示完整信息 |
| 客户表单 | /customer/customers/form | 客户创建/编辑页 |

### 5.2 列表页字段

| 字段 | 说明 | 排序 |
|------|------|------|
| 客户编号 | 系统自动生成 | - |
| 客户名称 | 客户显示名称 | 支持 |
| 客户类型 | 企业/个人/合作伙伴 | 支持 |
| 客户等级 | A/B/C/D级 | 支持 |
| 主要联系人 | 首要联系人姓名 | - |
| 联系电话 | 主要联系电话 | - |
| 负责人 | 跟进销售人员 | 支持 |
| 商机数量 | 关联的商机数 | - |
| 最近跟进 | 最近一次跟进时间 | 支持 |
| 创建时间 | 建档时间 | 支持 |

### 5.3 详情页结构

```
客户详情页
├── 基本信息卡片
│   ├── 客户名称、编号、类型
│   ├── 客户等级、行业、规模
│   └── 地址、区域
├── 联系人卡片
│   └── 联系人列表
├── 商机卡片
│   └── 关联商机列表
├── 跟进记录卡片
│   └── 最近跟进记录
└── 成交记录卡片
    └── 历史成交记录
```

## 6. 关联文档

- [客户表设计](./database/t_customers.md)
- [客户-联系人关联表](./database/r_customer_contact.md)
- [商机管理](./opportunity.md)
- [跟进记录](./followup.md)
- [成交管理](./deal.md)
