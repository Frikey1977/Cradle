# t_skills 系统技能表（AgentSkills 兼容）

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_skills |
| 中文名 | 系统技能表 |
| 说明 | AgentSkills 标准的 Skill 安装索引，存储 Skill 元数据和安装信息，实际 Skill 内容遵循 AgentSkills 标准格式 |

## 核心设计原则

**数据库表 = 安装索引 + 元数据管理**
- 数据库存储：Skill 版本、启用状态、评分配置
- 文件系统存储：实际 SKILL.md 内容（遵循 AgentSkills 标准）
- 运行时加载：从文件系统读取 SKILL.md，按 AgentSkills 标准解析执行

**完全兼容 AgentSkills 生态**：
- 支持所有公开的 AgentSkills 标准 Skill
- 可以从 ClawHub 等仓库直接导入
- 运行时行为与 OpenClaw 完全一致

**路径计算规则**：
```
Skill 路径 = {workspace_dir}/skills/{slug}/SKILL.md
```
例如：`f:\Cradle workspace\skills\github\SKILL.md`

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | YES | UUID | 主键，UUID |
| 2 | name | VARCHAR | 200 | YES | - | Skill 名称（AgentSkills 标准中的 name） |
| 3 | title | VARCHAR | 200 | NO | NULL | 多语言翻译标签，用于 i18n |
| 4 | slug | VARCHAR | 100 | YES | - | Skill 标识符（唯一，如 github, notion） |
| 5 | version | VARCHAR | 20 | YES | '1.0.0' | 版本号 |
| 6 | description | TEXT | - | NO | NULL | Skill 描述（AgentSkills 标准中的 description） |
| 7 | source_type | VARCHAR | 20 | YES | 'builtin' | 来源类型: builtin=系统内置, local=本地上传（已审核）, openclaw=OpenClaw社区 |
| 8 | source_url | VARCHAR | 500 | NO | NULL | 来源地址（ClawHub URL、Git 地址等） |
| 9 | metadata | JSON | - | NO | NULL | AgentSkills metadata（包含 requires, install 等） |
| 10 | config_schema | JSON | - | NO | NULL | 配置参数 Schema（用于 UI 渲染） |
| 11 | default_config | JSON | - | NO | NULL | 默认配置（AgentSkills 标准中的配置） |
| 12 | score | INT | - | NO | NULL | 系统内评分（0-100） |
| 13 | star | INT | - | NO | NULL | 官方社区评分（0-5 星） |
| 14 | type | VARCHAR | 50 | NO | NULL | 节点类型: skill=技能, catalog=分类目录 |
| 15 | parent_id | VARCHAR | 36 | NO | NULL | 父节点ID，NULL为根级 |
| 16 | sort | INT | - | NO | 0 | 排序序号，同级节点按此排序 |
| 17 | create_time | DATETIME | - | YES | CURRENT_TIMESTAMP | 创建时间 |
| 18 | deleted | TINYINT | - | YES | 0 | 逻辑删除: 0=未删除, 1=已删除 |
| 19 | timestamp | TIMESTAMP | - | YES | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |
| 20 | status | VARCHAR | 20 | YES | 'enabled' | 状态: enabled=启用, disabled=停用, deprecated=弃用 |

## 字段详细说明

### name Skill 名称

- 对应 AgentSkills 标准中的 `name` 字段
- 显示在 UI 中供用户识别

### slug Skill 标识符

- 唯一标识符，用于引用 Skill
- 示例：`github`, `notion`, `slack`
- 对应 AgentSkills 文件夹名称

### title 多语言翻译标签

- 用于 i18n 国际化显示
- 格式：`system.skill.{slug}`
- 示例：`system.skill.github`
- 在 UI 中显示时自动翻译为当前语言

### sort 排序序号

- 用于控制同级节点的显示顺序
- 数值越小排序越靠前
- 默认为 0

### source_type 来源类型

| 值 | 说明 | 示例 |
|----|------|------|
| `builtin` | 系统内置 | 随系统安装的基础 Skill |
| `local` | 本地上传（已审核） | 管理员审核后上传的 Skill |
| `openclaw` | OpenClaw 社区 | 从 OpenClaw 社区导入的 Skill |

> **安全设计**：不支持直接从 ClawHub 等公开仓库安装，也不支持从 Git 仓库直接克隆。所有 Skill 必须经过企业管理员审核通过本地上传方式导入。

### source_url 来源地址

- **openclaw**: OpenClaw 社区地址，如 `https://github.com/openclaw/skills`
- **git**: Git 仓库地址，如 `https://github.com/users/skill-repo`
- **local**: 原始上传路径（备份用）

### metadata AgentSkills 元数据

存储 SKILL.md 中的 YAML frontmatter 解析后的 JSON：

```json
{
  "openclaw": {
    "emoji": "🐙",
    "requires": {
      "bins": ["gh"],
      "env": ["GITHUB_TOKEN"],
      "config": ["github.enabled"]
    },
    "install": [
      {
        "id": "brew",
        "kind": "brew",
        "formula": "gh",
        "bins": ["gh"]
      }
    ],
    "primaryEnv": "GITHUB_TOKEN"
  }
}
```

### default_config 默认配置

对应 AgentSkills 标准中的配置项，用于初始化 Skill：

```json
{
  "endpoint": "https://api.github.com",
  "timeout": 30,
  "retry": 3
}
```

### type 节点类型

区分节点是分类目录还是实际技能：

| 值 | 说明 | 示例 |
|----|------|------|
| `catalog` | 分类目录 | 开发工具、即时通信 |
| `skill` | 实际技能 | github、slack、notion |

### parent_id 父节点ID

- 为 `NULL` 时表示根级节点（一级分类）
- 为其他节点的 `sid` 时表示该节点的子节点
- 支持无限层级结构

### score 系统内评分

- 范围：0-100
- 用于企业内部对 Skill 的质量评分
- 可通过使用反馈自动更新

### star 官方社区评分

- 范围：0-5（整数）
- 对应 OpenClaw 社区的星级评分
- 导入社区 Skill 时自动填充

## 索引

| 索引名 | 字段 | 类型 | 说明 |
|--------|------|------|------|
| pk_skills | sid | 主键 | 主键索引 |
| uk_skills_slug | slug | 唯一 | Skill 标识符唯一 |
| idx_skills_source | source_type | 普通 | 来源类型筛选 |
| idx_skills_status | status | 普通 | 状态筛选 |
| idx_skills_deleted | deleted | 普通 | 删除标记筛选 |
| idx_skills_type | type | 普通 | 节点类型筛选 |
| idx_skills_parent | parent_id | 普通 | 父节点筛选 |
| idx_skills_sort | sort | 普通 | 排序索引 |

## SQL语句

```sql
CREATE TABLE t_skills (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键UUID',
    name VARCHAR(200) NOT NULL COMMENT 'Skill 名称（AgentSkills 标准）',
    title VARCHAR(200) COMMENT '多语言翻译标签，用于 i18n',
    slug VARCHAR(100) NOT NULL COMMENT 'Skill 标识符（唯一）',
    version VARCHAR(20) DEFAULT '1.0.0' COMMENT '版本号',
    description TEXT COMMENT 'Skill 描述',
    source_type VARCHAR(20) DEFAULT 'builtin' COMMENT '来源类型: builtin=系统内置, local=本地上传（已审核）, openclaw=OpenClaw社区',
    source_url VARCHAR(500) COMMENT '来源地址（OpenClaw/Git/本地路径）',
    metadata JSON COMMENT 'AgentSkills metadata（requires, install 等）',
    config_schema JSON COMMENT '配置参数 Schema（用于 UI）',
    default_config JSON COMMENT '默认配置（AgentSkills 标准）',
    score INT COMMENT '系统内评分（0-100）',
    star INT COMMENT '官方社区评分（0-5星）',
    type VARCHAR(50) DEFAULT 'skill' COMMENT '节点类型: catalog=分类目录, skill=技能',
    parent_id VARCHAR(36) NULL COMMENT '父节点ID，NULL为根级',
    sort INT DEFAULT 0 COMMENT '排序序号，同级节点按此排序',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除: 0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled=启用, disabled=停用, deprecated=弃用',

    UNIQUE KEY uk_skills_slug (slug),
    INDEX idx_skills_source (source_type),
    INDEX idx_skills_status (status),
    INDEX idx_skills_deleted (deleted),
    INDEX idx_skills_type (type),
    INDEX idx_skills_parent (parent_id),
    INDEX idx_skills_sort (sort),
    FOREIGN KEY (parent_id) REFERENCES t_skills(sid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='系统技能表（AgentSkills 兼容）';
```

## 示例数据

### OpenClaw 社区 Skill（GitHub）

```sql
INSERT INTO t_skills (
    sid, name, slug, version, description,
    source_type, source_url, metadata,
    score, star, status, deleted, create_time
) VALUES (
    'skill-github',
    'GitHub',
    'github',
    '1.0.0',
    'GitHub operations via gh CLI: issues, PRs, CI runs, code review, API queries.',
    'openclaw',
    'https://github.com/openclaw/skills/github',
    '{"openclaw":{"emoji":"🐙","requires":{"bins":["gh"]}}}',
    95,
    5,
    'enabled',
    0,
    NOW()
);
```

## 路径计算示例

| slug | 完整路径 |
|------|----------|
| github | f:\Cradle workspace\skills\github\SKILL.md |
| notion | f:\Cradle workspace\skills\notion\SKILL.md |
| slack | f:\Cradle workspace\skills\slack\SKILL.md |

> 注：实际路径由系统配置的 workspace_dir 和 skills_dir 决定
