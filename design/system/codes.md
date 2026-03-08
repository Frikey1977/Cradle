# 代码管理模块设计

## 1. 模块概述

### 1.1 功能定位
代码管理模块采用树形结构统一管理系统中所有可配置的代码类型及其对应的代码值。

### 1.2 核心价值
- **标准化管理** - 确保全系统代码定义一致性
- **灵活配置** - 支持动态调整，无需修改业务代码
- **可视化维护** - 提供完整的代码增删改查能力
- **国际化支持** - 通过 i18nKey 支持多语言

### 1.3 使用场景
- **场景1**：系统初始化时配置基础代码字典
- **场景2**：业务扩展时动态添加新的代码类型
- **场景3**：多语言环境下维护代码的国际化映射

## 2. 功能设计

### 2.1 功能列表

| 功能 | 说明 |
|------|------|
| 代码类型管理 | 维护代码分类，如 SKILL_STATUS、AGENT_STATUS 等 |
| 代码值管理 | 维护各类型下的具体代码值 |
| 树形结构展示 | 以树形结构展示代码层级关系 |
| 代码查询 | 按类型查询代码列表 |

### 2.2 业务流程

#### 2.2.1 创建代码

**流程说明**：
1. 选择父级代码（可选，不选则为根节点）
2. 选择代码类型（支持下拉选择和自动加载已有类型）
3. 输入代码值
4. 输入显示名称和国际化标签
5. 输入描述
6. 提交创建

**输入参数**：
| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| parent_id | string | 否 | 父级代码ID |
| type | string | 是 | 代码类型 |
| value | string | 是 | 代码值 |
| name | string | 是 | 显示名称 |
| title | string | 否 | 多语言翻译标签，用于i18n |
| description | string | 否 | 描述说明 |
| sort | number | 否 | 排序序号 |
| status | string | 否 | 状态：enabled=启用，disabled=停用 |

#### 2.2.2 查询代码树

**流程说明**：
1. 查询所有代码数据
2. 构建树形结构
3. 返回层级化数据

**输出结果**：
```json
{
  "sid": "uuid-1",
  "name": "Skill状态",
  "type": "ROOT",
  "children": [
    {
      "sid": "uuid-2",
      "name": "启用",
      "type": "SKILL_STATUS",
      "value": "enabled"
    }
  ]
}
```

## 3. 接口设计

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/system/codes | GET | 获取代码列表（支持分页和筛选） |
| /api/system/codes/tree | GET | 获取代码树形结构 |
| /api/system/codes/types | GET | 获取所有代码类型列表 |
| /api/system/codes/type/:type | GET | 根据类型获取代码列表 |
| /api/system/codes/options/:type | GET | 根据类型获取代码选项（用于下拉选择） |
| /api/system/codes/value-exists | GET | 检查代码值是否存在（同一父级下） |
| /api/system/codes/:id | GET | 获取代码详情 |
| /api/system/codes | POST | 创建代码 |
| /api/system/codes/:id | PUT | 更新代码 |
| /api/system/codes/:id/status | PUT | 更新代码状态 |
| /api/system/codes/:id | DELETE | 删除代码（软删除） |

> **变更记录**：2025-02-19 将 API 路径从 `/system/code` 改为 `/system/codes`（复数形式），以符合 RESTful 规范。

## 4. 数据库设计

- [代码管理表](./database/t_codes.md)

## 5. 关联文档

- [系统管理模块索引](./README.md)
- [数据库设计规范](../../DATABASE_SPECIFICATION.md)
