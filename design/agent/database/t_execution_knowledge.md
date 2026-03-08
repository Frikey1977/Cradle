# t_execution_knowledge 执行知识表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_execution_knowledge |
| 中文名 | 执行知识表 |
| 说明 | 存储从执行历史中沉淀的知识条目，用于增强Agent任务规划 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，知识ID |
| 2 | name | VARCHAR | 200 | 是 | - | 知识名称 |
| 3 | description | TEXT | - | 否 | NULL | 知识描述 |
| 4 | type | VARCHAR | 20 | 是 | - | 知识类型 |
| 5 | category | VARCHAR | 50 | 是 | - | 业务分类 |
| 6 | scope | VARCHAR | 20 | 是 | 'global' | 适用范围 |
| 7 | match_intent | VARCHAR | 50 | 否 | NULL | 匹配意图 |
| 8 | match_keywords | JSON | - | 否 | NULL | 匹配关键词 |
| 9 | match_skills | JSON | - | 否 | NULL | 匹配Skill |
| 10 | min_confidence | DECIMAL | 3,2 | 是 | 0.7 | 最低匹配置信度 |
| 11 | content | JSON | - | 是 | - | 知识内容 |
| 12 | success_rate | DECIMAL | 5,2 | 是 | 0 | 成功率 |
| 13 | usage_count | INT | - | 是 | 0 | 使用次数 |
| 14 | source_type | VARCHAR | 20 | 是 | 'manual' | 来源类型 |
| 15 | source_execution_id | VARCHAR | 36 | 否 | NULL | 来源执行记录ID |
| 16 | source_agent_id | VARCHAR | 36 | 否 | NULL | 来源Agent ID |
| 17 | created_by | VARCHAR | 36 | 否 | NULL | 创建人 |
| 18 | status | VARCHAR | 20 | 是 | 'draft' | 状态 |
| 19 | version | INT | - | 是 | 1 | 版本号 |
| 20 | oid | VARCHAR | 36 | 否 | NULL | 组织ID |
| 21 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 22 | update_time | DATETIME | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

## 字段详细说明

### type 知识类型

| 取值 | 说明 |
|-----|------|
| pattern | 成功的执行模式 |
| anti-pattern | 失败的执行模式（应规避） |
| optimization | 性能优化建议 |
| constraint | 执行约束条件 |

### category 业务分类

| 取值 | 说明 |
|-----|------|
| DataQuery | 数据查询 |
| DataExport | 数据导出 |
| DataAnalysis | 数据分析 |
| Workflow | 工作流自动化 |
| Integration | 系统集成 |
| General | 通用 |

### scope 适用范围

| 取值 | 说明 |
|-----|------|
| global | 全公司通用 |
| org | 特定组织 |
| agent | 特定Agent |
| user | 特定用户 |

### status 状态

| 取值 | 说明 |
|-----|------|
| draft | 草稿 |
| active | 已发布 |
| deprecated | 已废弃 |

### content 知识内容（JSON格式）

```json
{
  "recommendedPlan": {
    "steps": [
      {
        "stepType": "permission_check",
        "description": "验证权限",
        "validation": "user.hasPermission('sales.view')"
      },
      {
        "stepType": "skill_invoke",
        "skillId": "db-query",
        "description": "查询数据",
        "parameters": {"table": "sales_data"}
      }
    ],
    "explanation": "标准销售数据查询流程"
  },
  "avoidPatterns": ["避免全表查询", "避免内存聚合大数据"],
  "optimizations": ["使用索引字段查询", "优先使用聚合函数"],
  "constraints": [
    {
      "condition": "数据量 > 10000",
      "action": "confirm"
    }
  ],
  "examples": [
    {
      "title": "销售数据查询示例",
      "code": "SELECT * FROM sales WHERE date > '2025-01-01'",
      "explanation": "使用时间索引查询"
    }
  ]
}
```

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_execution_knowledge | 主键索引 | sid | 主键索引 |
| idx_knowledge_type | 普通索引 | type | 类型筛选 |
| idx_knowledge_category | 普通索引 | category | 分类筛选 |
| idx_knowledge_scope | 普通索引 | scope, oid | 范围筛选 |
| idx_knowledge_status | 普通索引 | status | 状态筛选 |
| idx_knowledge_intent | 普通索引 | match_intent | 意图匹配 |
| idx_knowledge_usage | 普通索引 | usage_count DESC | 使用频率排序 |
| idx_knowledge_oid | 普通索引 | oid | 组织筛选 |

## SQL建表语句

```sql
CREATE TABLE t_execution_knowledge (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，知识ID',
    name VARCHAR(200) NOT NULL COMMENT '知识名称',
    description TEXT COMMENT '知识描述',
    type VARCHAR(20) NOT NULL COMMENT '知识类型: pattern/anti-pattern/optimization/constraint',
    category VARCHAR(50) NOT NULL COMMENT '业务分类',
    scope VARCHAR(20) NOT NULL DEFAULT 'global' COMMENT '适用范围: global/departments/agents/user',
    match_intent VARCHAR(50) COMMENT '匹配意图',
    match_keywords JSON COMMENT '匹配关键词',
    match_skills JSON COMMENT '匹配Skill',
    min_confidence DECIMAL(3,2) NOT NULL DEFAULT 0.7 COMMENT '最低匹配置信度',
    content JSON NOT NULL COMMENT '知识内容',
    success_rate DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '成功率',
    usage_count INT NOT NULL DEFAULT 0 COMMENT '使用次数',
    source_type VARCHAR(20) NOT NULL DEFAULT 'manual' COMMENT '来源类型: auto/manual',
    source_execution_id VARCHAR(36) COMMENT '来源执行记录ID',
    source_agent_id VARCHAR(36) COMMENT '来源Agent ID',
    created_by VARCHAR(36) COMMENT '创建人',
    status VARCHAR(20) NOT NULL DEFAULT 'draft' COMMENT '状态: draft/active/deprecated',
    version INT NOT NULL DEFAULT 1 COMMENT '版本号',
    oid VARCHAR(36) COMMENT '组织ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_knowledge_type (type),
    INDEX idx_knowledge_category (category),
    INDEX idx_knowledge_scope (scope, oid),
    INDEX idx_knowledge_status (status),
    INDEX idx_knowledge_intent (match_intent),
    INDEX idx_knowledge_usage (usage_count DESC),
    INDEX idx_knowledge_oid (oid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='执行知识表';
```

## 关联表

| 关联表 | 关联字段 | 关联类型 |
|--------|---------|---------|
| t_execution_log | source_execution_id | 多对一 |
| t_agent | source_agent_id | 多对一 |
| t_users | created_by | 多对一 |
| t_departments | oid | 多对一 |
| t_knowledge_usage | knowledge_id | 一对多 |

## 参考文档

- [执行知识库设计](../execution-knowledge.md)
- [知识使用记录表](./t_knowledge_usage.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
