# t_task_definition 任务定义表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_task_definition |
| 中文名 | 任务定义表 |
| 说明 | 存储 JSON 任务定义，支持任务模板复用。任务定义是静态配置，可被多个 Worktask 实例引用。 |

## 核心设计原则

**任务定义与实例分离**：
- **任务定义**：静态配置，可复用的任务模板
- **Worktask 实例**：运行时任务实例，引用任务定义

**模板机制**：
- `is_template = 1` 的定义可作为模板
- 新任务可基于模板创建，复制配置后独立修改

**版本管理**：
- 通过 `version` 字段支持版本迭代
- 修改定义时建议创建新版本而非直接修改

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | 任务定义名称 |
| 3 | title | VARCHAR | 200 | NO | NULL | 多语言翻译标签，用于 i18n |
| 4 | description | TEXT | - | NO | NULL | 任务定义描述 |
| 5 | agent_id | VARCHAR | 36 | NO | NULL | 关联的 Agent ID |
| 6 | uid | VARCHAR | 36 | NO | NULL | 创建者用户ID |
| 7 | oid | VARCHAR | 36 | NO | NULL | 组织ID |
| 8 | driver_type | VARCHAR | 20 | YES | - | 驱动类型：once/loop/polling/event/cron |
| 9 | driver_config | JSON | - | NO | NULL | 驱动配置（interval/cron/maxIterations等） |
| 10 | variables | JSON | - | NO | NULL | 变量定义 |
| 11 | steps | JSON | - | YES | - | 步骤定义（JSON数组） |
| 12 | exit_condition | JSON | - | NO | NULL | 退出条件表达式 |
| 13 | is_template | TINYINT | 1 | YES | 0 | 是否为模板：0=否, 1=是 |
| 14 | template_category | VARCHAR | 100 | NO | NULL | 模板分类编码 |
| 15 | version | INT | - | YES | 1 | 版本号 |
| 16 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 17 | deleted | TINYINT | 1 | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 18 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 19 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_task_definition | 主键索引 | sid | 主键索引 |
| idx_task_def_agent | 普通索引 | agent_id | Agent查询索引 |
| idx_task_def_user | 普通索引 | uid | 创建者查询索引 |
| idx_task_def_org | 普通索引 | oid | 组织查询索引 |
| idx_task_def_driver | 普通索引 | driver_type | 驱动类型索引 |
| idx_task_def_template | 普通索引 | is_template | 模板筛选索引 |
| idx_task_def_category | 普通索引 | template_category | 分类筛选索引 |
| idx_task_def_status | 普通索引 | status | 状态筛选索引 |
| idx_task_def_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_task_definition (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，任务定义唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '任务定义名称',
    title VARCHAR(200) COMMENT '多语言翻译标签',
    description TEXT COMMENT '任务定义描述',
    agent_id VARCHAR(36) COMMENT '关联的 Agent ID',
    uid VARCHAR(36) COMMENT '创建者用户ID',
    oid VARCHAR(36) COMMENT '组织ID',
    driver_type VARCHAR(20) NOT NULL COMMENT '驱动类型：once/loop/polling/event/cron',
    driver_config JSON COMMENT '驱动配置',
    variables JSON COMMENT '变量定义',
    steps JSON NOT NULL COMMENT '步骤定义',
    exit_condition JSON COMMENT '退出条件表达式',
    is_template TINYINT DEFAULT 0 COMMENT '是否为模板：0=否, 1=是',
    template_category VARCHAR(100) COMMENT '模板分类编码',
    version INT DEFAULT 1 COMMENT '版本号',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态：enabled=启用, disabled=停用',
    
    INDEX idx_task_def_agent (agent_id),
    INDEX idx_task_def_user (uid),
    INDEX idx_task_def_org (oid),
    INDEX idx_task_def_driver (driver_type),
    INDEX idx_task_def_template (is_template),
    INDEX idx_task_def_category (template_category),
    INDEX idx_task_def_status (status),
    INDEX idx_task_def_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='任务定义表';
```

## driver_type 驱动类型说明

| 类型 | 说明 | driver_config 示例 |
|------|------|-------------------|
| once | 单次执行 | `{}` |
| loop | 循环执行 | `{ "maxIterations": 100 }` |
| polling | 轮询执行 | `{ "interval": 30000 }` |
| event | 事件驱动 | `{ "event": "user_input" }` |
| cron | 定时触发 | `{ "cron": "0 9 * * *" }` |

## steps 字段结构示例

```json
[
  {
    "type": "action",
    "id": "check-status",
    "name": "检查状态",
    "action": {
      "type": "skill",
      "target": "douyin",
      "params": { "action": "getLiveStatus" }
    },
    "saveTo": "liveStatus"
  },
  {
    "type": "condition",
    "id": "status-branch",
    "name": "根据状态分支",
    "branches": [
      {
        "condition": { "op": "eq", "left": "${liveStatus.status}", "right": "live" },
        "steps": []
      }
    ]
  }
]
```

## 关联表

- [t_worktask](./t_worktask.md) - 任务实例表，通过 `task_def_id` 关联
- [t_task_checkpoint](./t_task_checkpoint.md) - 任务检查点表
- [t_task_execution_log](./t_task_execution_log.md) - 任务执行日志表
