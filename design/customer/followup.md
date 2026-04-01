# 跟进记录 (Follow-up)

## 1. 模块概述

### 1.1 功能定位
跟进记录用于记录销售人员与客户的每次互动，包括电话沟通、邮件往来、会议洽谈、现场拜访等。跟进记录是销售过程的重要痕迹，帮助团队了解客户动态和销售进展。

### 1.2 核心价值
- **过程追溯**：完整记录销售过程，便于复盘和分析
- **团队协作**：团队成员可了解客户最新情况
- **客户洞察**：通过历史跟进发现客户需求和偏好
- **工作量化**：统计销售人员的跟进工作量

### 1.3 使用场景
- **电话沟通**：记录电话沟通内容和客户反馈
- **会议记录**：记录会议要点和后续行动
- **邮件跟进**：记录邮件往来内容
- **现场拜访**：记录拜访情况和客户现场信息

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 跟进记录列表 | 展示跟进记录，支持按客户/商机筛选 |
| 创建跟进 | 记录新的跟进活动 |
| 跟进详情 | 查看跟进记录详情 |
| 编辑跟进 | 修改跟进记录 |
| 删除跟进 | 删除跟进记录 |
| 下次提醒 | 设置下次跟进提醒 |

### 2.2 跟进方式

| 方式 | 编码 | 说明 |
|------|------|------|
| 电话 | phone | 电话沟通 |
| 邮件 | email | 邮件往来 |
| 会议 | meeting | 线上或线下会议 |
| 拜访 | visit | 现场拜访 |
| 微信 | wechat | 微信沟通 |
| 其他 | other | 其他方式 |

### 2.3 跟进类型

| 类型 | 说明 |
|------|------|
| 客户跟进 | 关联客户的普通跟进 |
| 商机跟进 | 关联具体商机的跟进 |
| 售后跟进 | 成交后的客户维护 |

### 2.4 业务流程

#### 创建跟进记录流程

```
1. 选择关联对象
   ├── 关联客户（必填）
   └── 关联商机（可选）

2. 填写跟进信息
   ├── 跟进方式（电话/邮件/会议等）
   ├── 跟进时间（默认当前时间）
   ├── 跟进内容（详细记录）
   └── 客户反馈

3. 设置后续行动
   ├── 是否需要下次跟进
   ├── 下次跟进时间
   └── 下次跟进要点

4. 更新关联对象
   ├── 更新客户最近跟进时间
   └── 如关联商机，更新商机阶段（可选）
```

## 3. 数据模型

### 3.1 跟进记录表 (t_followups)

详见 [t_followups.md](./database/t_followups.md)

## 4. 接口设计

### 4.1 REST API

| 接口 | 方法 | 说明 | 权限码 |
|------|------|------|--------|
| /api/followups | GET | 获取跟进记录列表 | customer:followups:view |
| /api/followups | POST | 创建跟进记录 | customer:followups:create |
| /api/followups/:id | GET | 获取跟进详情 | customer:followups:view |
| /api/followups/:id | PUT | 更新跟进记录 | customer:followups:update |
| /api/followups/:id | DELETE | 删除跟进记录 | customer:followups:create |
| /api/customers/:id/followups | GET | 获取客户跟进记录 | customer:followups:view |
| /api/opportunities/:id/followups | GET | 获取商机跟进记录 | customer:followups:view |

### 4.2 接口详情

#### 创建跟进记录

**请求**：
```json
POST /api/followups
{
  "customer_id": "cust-xxx",
  "opportunity_id": "opp-xxx",
  "method": "phone",
  "follow_time": "2024-03-20T14:30:00Z",
  "content": "与客户张总电话沟通，确认了项目预算和时间要求",
  "feedback": "客户对初步方案表示认可，希望下周提供详细报价",
  "next_follow_date": "2024-03-27",
  "next_follow_content": "提交详细方案和报价",
  "reminder": true
}
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "sid": "flw-xxx",
    "followup_no": "F202403200001",
    "customer_id": "cust-xxx",
    "method": "phone",
    "content": "与客户张总电话沟通...",
    "create_time": "2024-03-20T14:30:00Z"
  }
}
```

#### 获取跟进列表

**请求**：
```
GET /api/followups?customer_id=cust-xxx&method=phone&start_date=2024-03-01&end_date=2024-03-31
```

**响应**：
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "sid": "flw-xxx",
        "followup_no": "F202403200001",
        "customer_name": "示例科技有限公司",
        "opportunity_name": "企业管理系统采购",
        "method": "phone",
        "method_name": "电话",
        "content": "与客户张总电话沟通...",
        "follow_time": "2024-03-20T14:30:00Z",
        "create_by_name": "李四"
      }
    ],
    "pagination": {
      "page": 1,
      "size": 20,
      "total": 50
    }
  }
}
```

## 5. 前端页面

### 5.1 页面清单

| 页面 | 路径 | 说明 |
|------|------|------|
| 跟进记录列表 | /customer/followups | 跟进记录列表页 |
| 跟进表单 | /customer/followups/form | 创建/编辑跟进记录 |

### 5.2 列表页字段

| 字段 | 说明 | 排序 |
|------|------|------|
| 跟进编号 | 系统自动生成 | - |
| 客户名称 | 关联客户 | - |
| 商机名称 | 关联商机（如有） | - |
| 跟进方式 | 电话/邮件/会议等 | 支持 |
| 跟进内容 | 内容摘要 | - |
| 跟进时间 | 实际跟进时间 | 支持 |
| 记录人 | 创建人 | 支持 |
| 下次跟进 | 是否有下次提醒 | - |

### 5.3 快捷入口

跟进记录通常在以下页面提供快捷创建入口：

- **客户详情页**：快速记录客户跟进
- **商机详情页**：记录商机推进过程
- **首页工作台**：显示今日待跟进提醒

## 6. 关联文档

- [跟进记录表设计](./database/t_followups.md)
- [客户管理](./customer.md)
- [商机管理](./opportunity.md)
