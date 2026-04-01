# t_contacts - 联系人表（身份归一化容器）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_contacts |
| 中文名 | 联系人表 |
| 说明 | 身份归一化容器，是不同实体（员工/客户/访客）的投射。必须关联到实体才有意义，存储跨通道的 profile（画像信息）。 |

## 核心设计原则

**容器定位**：
- 本身不是实体，而是背后实体（员工/客户/访客）的投射
- 必须关联到 `type` + `source_id` 才有意义
- 主要存储跨通道的 **profile（画像信息）**，包含 facts（事实）和 preferences（偏好）

**身份归一化**：
- 一个人 = 一个 Contact
- 通过 `r_channel_contact` 配置多通道身份映射
- 已知身份（员工/客户）由管理员配置归一
- 访客身份合并暂时不处理，后续由销售手工合并或 AI 自动处理

**员工画像存储**：
- 员工的画像信息统一存储在 t_contacts.profile 中
- t_employees 只保留基础信息（姓名、工号、部门、岗位等）
- 通过 `type='employee'` + `source_id=employee.sid` 关联

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | type | VARCHAR | 20 | YES | - | 类型: employee/customer/partner/visitor |
| 3 | source_id | VARCHAR | 36 | NO | NULL | 来源ID（关联实体表） |
| 4 | profile | JSON | - | NO | NULL | 画像信息（包含 facts 和 preferences） |
| 5 | short_term_memory | JSON | - | NO | NULL | 短期记忆（最后对话内容） |
| 6 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled/disabled |
| 7 | description | VARCHAR | 500 | NO | NULL | 描述说明（如禁用原因） |
| 8 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 9 | deleted | TINYINT | - | YES | 0 | 逻辑删除标记: 0=未删除, 1=已删除 |
| 10 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### type / source_id 来源信息

| type | 含义 | source_id 关联表 |
|------|------|-----------------|
| employee | 内部员工 | t_employees.sid |
| customer | 外部客户 | t_customers.sid（如有） |
| partner | 合作伙伴 | t_partners.sid（如有） |
| visitor | 访客 | NULL（临时用户） |

### profile 画像信息

统一存储联系人的画像信息，包含事实和偏好：

```json
{
  "facts": {
    "basic": {
      "name": "张三",
      "type": "employee"
    },
    "work": {
      "department": "技术部",
      "departmentId": "dept-001",
      "position": "高级工程师",
      "positionId": "pos-001",
      "employeeNo": "EMP001",
      "expertise": ["Java", "Spring", "微服务"],
      "experience": "10年后端开发经验"
    },
    "life": {
      "hobbies": ["摄影", "徒步", "阅读"],
      "location": "北京",
      "family": "已婚，有一子"
    }
  },
  "preferences": {
    "basic": {
      "language": "zh-CN",
      "timezone": "Asia/Shanghai",
      "theme": "dark"
    },
    "work": {
      "likes": ["技术讨论", "代码审查", "架构设计"],
      "dislikes": ["无意义的会议", "临时插单", "加班"],
      "bestTime": "上午9-12点",
      "workStyle": "喜欢异步沟通，深度工作"
    },
    "life": {
      "likes": ["摄影交流", "徒步路线推荐"],
      "dislikes": ["周末工作消息"],
      "boundaries": "周末不处理工作，晚上8点后不回复"
    },
    "communication": {
      "formality": "casual",
      "channel": "即时通讯",
      "responseTime": "工作时间内2小时内回复",
      "topics": ["技术方案", "项目管理"]
    },
    "notification": {
      "email": true,
      "sms": false,
      "push": true
    }
  }
}
```

**结构约定**：
- `facts`: 客观事实信息，由系统或管理员维护
- `preferences`: 主观偏好设置，由用户自己或 LLM 学习维护
- 支持自定义分类，如 `facts.education`、`preferences.custom.xxx`
- 具体内容由 LLM 自主发现和维护，系统只约定顶层结构

### short_term_memory 短期记忆

存储最后对话内容，用于上下文保持：

```json
{
  "lastConversationAt": "2024-01-15T10:30:00Z",
  "lastAgentId": "agent-001",
  "summary": "用户咨询产品价格",
  "keyPoints": ["关注企业版", "需要20个账号"]
}
```

## 索引

| 索引名 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_contacts | 主键索引 | sid | 主键索引 |
| idx_contacts_type | 普通索引 | type | 类型筛选 |
| idx_contacts_source | 普通索引 | source_id | 来源ID查询 |
| idx_contacts_status | 普通索引 | status | 状态筛选 |
| idx_contacts_deleted | 普通索引 | deleted | 删除标记筛选 |

## SQL建表语句

```sql
CREATE TABLE t_contacts (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    type VARCHAR(20) NOT NULL COMMENT '类型: employee/customer/partner/visitor',
    source_id VARCHAR(36) COMMENT '来源ID（关联实体表）',
    profile JSON COMMENT '画像信息（包含 facts 和 preferences）',
    short_term_memory JSON COMMENT '短期记忆（最后对话内容）',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    description VARCHAR(500) COMMENT '描述说明',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    INDEX idx_contacts_type (type),
    INDEX idx_contacts_source (source_id),
    INDEX idx_contacts_status (status),
    INDEX idx_contacts_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='联系人表（身份归一化容器）';
```

## 关联关系

```
t_contacts (联系人容器)
    │
    ├── type='employee' → source_id → t_employees (基础信息)
    │                           │
    │                           ├── oid → t_departments (部门信息)
    │                           └── position_id → t_positions (岗位信息)
    │
    ├── type='customer' → source_id → t_customers (客户信息)
    │
    └── type='partner' → source_id → t_partners (合作伙伴信息)
```

## 关联文档

- [t_employees](t_employee.md) - 员工表
- [t_departments](t_org.md) - 部门架构表
- [t_positions](t_position.md) - 岗位表
- [t_relationship](../memory/database/t_relationship.md) - Agent-Contact 关系表
