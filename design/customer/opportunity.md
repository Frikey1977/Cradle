# 商机管理 (Opportunity)

## 1. 模块概述

### 1.1 功能定位
商机管理用于跟踪和管理销售机会，记录从初步接触到最终成交的全过程。商机是销售漏斗的核心，反映潜在的收入机会。

### 1.2 核心价值
- **销售预测**：基于商机阶段和金额预测销售业绩
- **过程管理**：规范销售流程，确保关键节点不遗漏
- **资源分配**：根据商机优先级合理分配销售资源
- **漏斗分析**：分析各阶段转化率，优化销售策略

### 1.3 使用场景
- **商机创建**：发现销售机会时创建商机记录
- **阶段推进**：根据销售进展更新商机阶段
- **金额调整**：根据谈判情况调整预计成交金额
- **商机关闭**：成交或失败时关闭商机

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 商机列表 | 展示所有商机，支持按阶段筛选 |
| 商机创建 | 创建新的销售机会 |
| 商机详情 | 查看商机完整信息和推进历史 |
| 商机编辑 | 修改商机信息 |
| 阶段推进 | 更新商机阶段和赢率 |
| 商机关闭 | 标记商机为赢单或输单 |
| 销售漏斗 | 可视化展示各阶段商机分布 |

### 2.2 商机阶段

| 阶段 | 编码 | 赢率 | 说明 |
|------|------|------|------|
| 初步接触 | initial | 10% | 刚建立联系，了解初步需求 |
| 需求确认 | needs | 30% | 深入沟通，确认具体需求 |
| 方案报价 | proposal | 60% | 提供解决方案和报价 |
| 谈判协商 | negotiation | 80% | 商务谈判，条款协商 |
| 赢单 | won | 100% | 成功签约 |
| 输单 | lost | 0% | 未能成交 |

### 2.3 商机来源

| 来源 | 说明 |
|------|------|
| phone | 电话咨询 |
| email | 邮件咨询 |
| exhibition | 展会活动 |
| referral | 客户推荐 |
| website | 官网注册 |
| social | 社交媒体 |
| partner | 合作伙伴 |
| other | 其他渠道 |

### 2.4 业务流程

#### 商机创建流程

```
1. 识别机会
   └── 发现潜在销售机会

2. 创建商机
   ├── 选择关联客户（必填）
   ├── 填写商机名称
   ├── 选择商机来源
   ├── 输入预计成交金额
   ├── 选择预计成交日期
   └── 填写需求描述

3. 初始阶段
   └── 默认进入"初步接触"阶段

4. 分配负责人
   └── 指定销售人员跟进
```

#### 商机推进流程

```
1. 跟进活动
   └── 记录每次客户互动

2. 评估进展
   └── 判断是否满足阶段升级条件

3. 阶段更新
   ├── 更新商机阶段
   ├── 调整赢率
   ├── 更新预计金额（如有变化）
   └── 记录阶段变更原因

4. 重复推进
   └── 直至商机关闭
```

#### 商机关闭流程

```
1. 判断结果
   ├── 赢单：客户签约
   └── 输单：客户选择其他方案或放弃

2. 更新状态
   ├── 设置阶段为 won/lost
   ├── 记录关闭原因
   └── 记录实际成交金额（赢单）

3. 后续处理
   ├── 赢单：创建成交记录
   └── 输单：分析原因，归档
```

## 3. 数据模型

### 3.1 商机表 (t_opportunities)

详见 [t_opportunities.md](./database/t_opportunities.md)

## 4. 接口设计

### 4.1 REST API

| 接口 | 方法 | 说明 | 权限码 |
|------|------|------|--------|
| /api/opportunities | GET | 获取商机列表 | customer:opportunities:view |
| /api/opportunities | POST | 创建商机 | customer:opportunities:create |
| /api/opportunities/:id | GET | 获取商机详情 | customer:opportunities:view |
| /api/opportunities/:id | PUT | 更新商机 | customer:opportunities:update |
| /api/opportunities/:id/stage | PUT | 更新商机阶段 | customer:opportunities:update |
| /api/opportunities/:id/close | PUT | 关闭商机 | customer:opportunities:update |
| /api/opportunities/funnel | GET | 获取销售漏斗数据 | customer:opportunities:view |

### 4.2 接口详情

#### 创建商机

**请求**：
```json
POST /api/opportunities
{
  "customer_id": "cust-xxx",
  "name": "企业管理系统采购",
  "source": "referral",
  "amount": 500000,
  "expected_close_date": "2024-06-30",
  "description": "客户需要一套完整的ERP系统",
  "owner_id": "emp-001"
}
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "sid": "opp-xxx",
    "opportunity_no": "O202403200001",
    "name": "企业管理系统采购",
    "stage": "initial",
    "probability": 10,
    "amount": 500000,
    "expected_amount": 50000,
    "status": "open",
    "create_time": "2024-03-20T10:30:00Z"
  }
}
```

#### 更新商机阶段

**请求**：
```json
PUT /api/opportunities/:id/stage
{
  "stage": "proposal",
  "probability": 60,
  "reason": "已提交方案，客户反馈积极"
}
```

#### 关闭商机

**请求**：
```json
PUT /api/opportunities/:id/close
{
  "stage": "won",
  "actual_amount": 480000,
  "close_reason": "成功签约"
}
```

#### 获取销售漏斗

**响应**：
```json
{
  "code": 200,
  "data": {
    "funnel": [
      { "stage": "initial", "count": 20, "amount": 2000000 },
      { "stage": "needs", "count": 15, "amount": 1500000 },
      { "stage": "proposal", "count": 10, "amount": 1000000 },
      { "stage": "negotiation", "count": 5, "amount": 500000 },
      { "stage": "won", "count": 3, "amount": 300000 },
      { "stage": "lost", "count": 2, "amount": 200000 }
    ],
    "total_open": 50,
    "total_amount": 5000000,
    "weighted_amount": 2500000
  }
}
```

## 5. 前端页面

### 5.1 页面清单

| 页面 | 路径 | 说明 |
|------|------|------|
| 商机列表 | /customer/opportunities | 商机列表页，支持看板视图 |
| 商机详情 | /customer/opportunities/:id | 商机详情页 |
| 商机表单 | /customer/opportunities/form | 商机创建/编辑页 |
| 销售漏斗 | /customer/opportunities/funnel | 销售漏斗分析页 |

### 5.2 列表页字段

| 字段 | 说明 | 排序 |
|------|------|------|
| 商机编号 | 系统自动生成 | - |
| 商机名称 | 商机标题 | 支持 |
| 关联客户 | 客户名称 | - |
| 当前阶段 | 商机所处阶段 | 支持 |
| 赢率 | 成交概率 | 支持 |
| 预计金额 | 预计成交金额 | 支持 |
| 预计成交日 | 预计成交日期 | 支持 |
| 负责人 | 跟进销售人员 | 支持 |
| 创建时间 | 创建时间 | 支持 |

### 5.3 看板视图

按商机阶段分组展示，支持拖拽变更阶段：

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  初步接触   │  │  需求确认   │  │  方案报价   │  │  谈判协商   │
│    10%     │  │    30%     │  │    60%     │  │    80%     │
│  ¥200万    │  │  ¥150万    │  │  ¥100万    │  │   ¥50万    │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ 商机卡片1   │  │ 商机卡片3   │  │ 商机卡片5   │  │ 商机卡片6   │
│ 商机卡片2   │  │ 商机卡片4   │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

## 6. 关联文档

- [商机表设计](./database/t_opportunities.md)
- [客户管理](./customer.md)
- [跟进记录](./followup.md)
- [成交管理](./deal.md)
