# 成交管理 (Deal)

## 1. 模块概述

### 1.1 功能定位
成交管理用于记录和管理已成功签约的订单和合同信息。当商机赢单后，创建成交记录，跟踪合同执行和回款情况。

### 1.2 核心价值
- **业绩统计**：统计销售业绩和达成情况
- **合同管理**：管理合同信息和执行状态
- **回款跟踪**：跟踪回款计划和实际回款
- **客户价值**：分析客户贡献度和生命周期价值

### 1.3 使用场景
- **签约登记**：商机赢单后登记成交信息
- **合同管理**：上传和管理合同文档
- **回款记录**：记录客户付款情况
- **业绩分析**：统计销售业绩和趋势

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 成交列表 | 展示所有成交记录 |
| 创建成交 | 登记新的成交 |
| 成交详情 | 查看成交完整信息 |
| 编辑成交 | 修改成交信息 |
| 合同管理 | 上传和管理合同文件 |
| 回款记录 | 记录回款情况 |
| 业绩统计 | 销售业绩分析 |

### 2.2 成交状态

| 状态 | 编码 | 说明 |
|------|------|------|
| 待签约 | pending | 已确定意向，待正式签约 |
| 已签约 | signed | 合同已签署 |
| 已付款 | paid | 客户已完成付款 |
| 已交付 | delivered | 产品/服务已交付 |
| 已关闭 | closed | 交易完成，归档 |
| 已取消 | cancelled | 交易取消 |

### 2.3 付款方式

| 方式 | 说明 |
|------|------|
| 一次性付款 | 合同签订后一次性支付 |
| 分期付款 | 按约定分期支付 |
| 月付 | 按月支付 |
| 季付 | 按季度支付 |
| 年付 | 按年支付 |

### 2.4 业务流程

#### 成交创建流程

```
1. 赢单触发
   └── 商机阶段更新为"赢单"

2. 创建成交记录
   ├── 关联客户（从商机带入）
   ├── 关联商机（必填）
   ├── 填写成交名称
   ├── 输入成交金额
   ├── 选择付款方式
   ├── 设定签约日期
   └── 上传合同文件

3. 初始状态
   └── 设置为"待签约"或"已签约"

4. 后续跟踪
   └── 跟踪回款和交付
```

#### 回款记录流程

```
1. 记录回款
   ├── 选择关联成交
   ├── 输入回款金额
   ├── 选择回款日期
   ├── 选择回款方式
   └── 上传回款凭证

2. 更新成交状态
   ├── 计算已回款金额
   ├── 更新回款比例
   └── 如全额回款，更新状态为"已付款"
```

## 3. 数据模型

### 3.1 成交记录表 (t_deals)

详见 [t_deals.md](./database/t_deals.md)

## 4. 接口设计

### 4.1 REST API

| 接口 | 方法 | 说明 | 权限码 |
|------|------|------|--------|
| /api/deals | GET | 获取成交列表 | customer:deals:view |
| /api/deals | POST | 创建成交 | customer:deals:create |
| /api/deals/:id | GET | 获取成交详情 | customer:deals:view |
| /api/deals/:id | PUT | 更新成交 | customer:deals:update |
| /api/deals/:id/status | PUT | 更新成交状态 | customer:deals:update |
| /api/deals/:id/payments | GET | 获取回款记录 | customer:deals:view |
| /api/deals/:id/payments | POST | 添加回款记录 | customer:deals:update |
| /api/deals/statistics | GET | 获取成交统计 | customer:deals:view |

### 4.2 接口详情

#### 创建成交

**请求**：
```json
POST /api/deals
{
  "customer_id": "cust-xxx",
  "opportunity_id": "opp-xxx",
  "name": "企业管理系统采购合同",
  "amount": 480000,
  "payment_method": "installment",
  "sign_date": "2024-03-20",
  "expected_delivery_date": "2024-04-30",
  "remark": "分三期付款",
  "contract_files": [
    { "name": "合同.pdf", "url": "/files/xxx.pdf" }
  ]
}
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "sid": "deal-xxx",
    "deal_no": "D202403200001",
    "name": "企业管理系统采购合同",
    "amount": 480000,
    "status": "pending",
    "paid_amount": 0,
    "create_time": "2024-03-20T10:30:00Z"
  }
}
```

#### 添加回款记录

**请求**：
```json
POST /api/deals/:id/payments
{
  "amount": 160000,
  "payment_date": "2024-03-20",
  "payment_method": "bank_transfer",
  "remark": "首付款",
  "attachments": [
    { "name": "付款凭证.png", "url": "/files/xxx.png" }
  ]
}
```

#### 获取成交统计

**响应**：
```json
{
  "code": 200,
  "data": {
    "summary": {
      "total_deals": 50,
      "total_amount": 5000000,
      "total_paid": 4000000,
      "pending_amount": 1000000
    },
    "by_month": [
      { "month": "2024-01", "count": 10, "amount": 1000000 },
      { "month": "2024-02", "count": 15, "amount": 1500000 },
      { "month": "2024-03", "count": 25, "amount": 2500000 }
    ],
    "by_owner": [
      { "owner_id": "emp-001", "owner_name": "张三", "count": 20, "amount": 2000000 }
    ]
  }
}
```

## 5. 前端页面

### 5.1 页面清单

| 页面 | 路径 | 说明 |
|------|------|------|
| 成交列表 | /customer/deals | 成交记录列表 |
| 成交详情 | /customer/deals/:id | 成交详情页 |
| 成交表单 | /customer/deals/form | 创建/编辑成交 |
| 业绩报表 | /customer/deals/statistics | 成交统计分析 |

### 5.2 列表页字段

| 字段 | 说明 | 排序 |
|------|------|------|
| 成交编号 | 系统自动生成 | - |
| 成交名称 | 合同/订单名称 | 支持 |
| 客户名称 | 关联客户 | - |
| 成交金额 | 合同金额 | 支持 |
| 已回款 | 已回款金额 | 支持 |
| 回款比例 | 已回款百分比 | 支持 |
| 成交状态 | 当前状态 | 支持 |
| 签约日期 | 合同签署日期 | 支持 |
| 负责人 | 销售人员 | 支持 |

### 5.3 业绩报表

```
业绩统计报表
├── 汇总指标
│   ├── 成交数量
│   ├── 成交总额
│   ├── 已回款额
│   └── 待回款额
├── 趋势图表
│   ├── 月度成交趋势
│   └── 月度回款趋势
├── 排名统计
│   ├── 销售人员排名
│   └── 客户贡献排名
└── 状态分布
    └── 各状态成交金额占比
```

## 6. 关联文档

- [成交记录表设计](./database/t_deals.md)
- [客户管理](./customer.md)
- [商机管理](./opportunity.md)
