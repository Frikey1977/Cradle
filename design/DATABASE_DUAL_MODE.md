# Cradle 双数据库架构设计文档

## 1. 设计目标

支持 MySQL 和 SQLite 两种数据库模式，实现：
- **云端模式**：使用 MySQL，适合企业多实例部署
- **本地模式**：使用 SQLite，开箱即用，零配置
- **统一存储**：业务和日志数据不分散，统一存储在数据库中
- **无缝切换**：通过配置即可切换数据库类型

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│              (Services, Controllers, API)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Abstraction Layer                     │
│  ┌─────────────────┐  ┌──────────────────────────────┐     │
│  │  IDatabase      │  │  DatabaseFactory             │     │
│  │  Interface      │  │  (创建适配器实例)             │     │
│  └────────┬────────┘  └──────────────────────────────┘     │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  MySQLAdapter   │  │  SQLiteAdapter  │                  │
│  │  (mysql2)       │  │  (better-sqlite3)│                 │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
    ┌─────────────────────┐      ┌─────────────────────┐
    │      MySQL          │      │      SQLite         │
    │  (云端/企业部署)     │      │  (本地/个人使用)     │
    └─────────────────────┘      └─────────────────────┘
```

### 2.2 目录结构

```
src/store/
├── index.ts                 # 统一导出
├── types.ts                 # 数据库类型定义（已存在）
├── config.ts                # 数据库配置管理
├── adapter.ts               # 数据库适配器接口
├── factory.ts               # 数据库工厂
├── mysql/
│   ├── adapter.ts           # MySQL适配器实现
│   └── pool.ts              # MySQL连接池管理
├── sqlite/
│   ├── adapter.ts           # SQLite适配器实现
│   └── connection.ts        # SQLite连接管理
└── migrations/
    ├── mysql/               # MySQL迁移脚本
    ├── sqlite/              # SQLite迁移脚本
    └── index.ts             # 迁移管理器
```

## 3. 核心接口设计

### 3.1 数据库适配器接口

```typescript
// src/store/adapter.ts

export interface IDatabaseAdapter {
  /** 初始化数据库连接 */
  initialize(): Promise<void>;
  
  /** 关闭数据库连接 */
  close(): Promise<void>;
  
  /** 执行查询（返回多行） */
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  
  /** 执行单条查询（返回单行） */
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  
  /** 执行更新/插入/删除 */
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
  
  /** 执行事务 */
  transaction<T>(callback: (trx: ITransaction) => Promise<T>): Promise<T>;
  
  /** 检查表是否存在 */
  tableExists(tableName: string): Promise<boolean>;
  
  /** 获取数据库版本 */
  getVersion(): Promise<number>;
  
  /** 设置数据库版本 */
  setVersion(version: number): Promise<void>;
}

export interface ITransaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes?: number }>;
}
```

### 3.2 数据库配置

```typescript
// src/store/config.ts

export type DatabaseType = 'mysql' | 'sqlite';

export interface DatabaseConfig {
  type: DatabaseType;
  // MySQL配置
  mysql?: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    connectionLimit?: number;
  };
  // SQLite配置
  sqlite?: {
    path: string;  // 数据库文件路径
  };
}

// 从环境变量读取配置
export function loadDatabaseConfig(): DatabaseConfig {
  const type = (process.env.DB_TYPE as DatabaseType) || 'sqlite';
  
  if (type === 'mysql') {
    return {
      type: 'mysql',
      mysql: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'cradle',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
      }
    };
  }
  
  return {
    type: 'sqlite',
    sqlite: {
      path: process.env.DB_PATH || './data/cradle.db',
    }
  };
}
```

## 4. 数据表设计

### 4.1 统一表结构

所有表使用统一的命名规范和结构，适配两种数据库：

```sql
-- 系统表：数据库版本管理
CREATE TABLE IF NOT EXISTS _schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户表（示例）
CREATE TABLE IF NOT EXISTS t_user (
  sid VARCHAR(32) PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(50) NOT NULL,
  avatar VARCHAR(500),
  status VARCHAR(20) DEFAULT 'enabled',
  home_path VARCHAR(200),
  employee_id VARCHAR(32),
  last_login_time DATETIME,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted INTEGER DEFAULT 0
);

-- LLM调用日志表（统一存储，替代文件日志）
CREATE TABLE IF NOT EXISTS t_llm_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- SQLite
  -- id INT AUTO_INCREMENT PRIMARY KEY,   -- MySQL
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  type VARCHAR(20) NOT NULL,  -- request/response/error
  model VARCHAR(50),
  provider VARCHAR(50),
  instance_id VARCHAR(64),
  source VARCHAR(50),  -- agent/orchestrator/executor/handler
  agent_name VARCHAR(100),
  contact_name VARCHAR(100),
  worktask_id VARCHAR(64),
  duration INTEGER,  -- 毫秒
  has_tool_calls BOOLEAN DEFAULT FALSE,
  request_body TEXT,  -- JSON字符串
  response_data TEXT, -- JSON字符串
  error TEXT,
  token_prompt INTEGER DEFAULT 0,
  token_completion INTEGER DEFAULT 0,
  token_total INTEGER DEFAULT 0,
  log_date DATE GENERATED ALWAYS AS (DATE(timestamp)) STORED  -- 用于按日期分区/索引
);

-- 日志表索引
CREATE INDEX idx_llm_logs_date ON t_llm_logs(log_date);
CREATE INDEX idx_llm_logs_type ON t_llm_logs(type);
CREATE INDEX idx_llm_logs_source ON t_llm_logs(source);
CREATE INDEX idx_llm_logs_model ON t_llm_logs(model);
CREATE INDEX idx_llm_logs_timestamp ON t_llm_logs(timestamp);
```

### 4.2 方言差异处理

| 特性 | MySQL | SQLite | 处理方案 |
|------|-------|--------|----------|
| 自增主键 | `AUTO_INCREMENT` | `AUTOINCREMENT` | 迁移脚本区分 |
| 布尔类型 | `BOOLEAN`/`TINYINT` | `INTEGER` | 统一用 `BOOLEAN`，适配器转换 |
| 时间戳 | `DATETIME` | `DATETIME`/`TEXT` | 统一用 `DATETIME` |
| JSON字段 | `JSON` | `TEXT` | 统一用 `TEXT`，应用层序列化 |
| 分页 | `LIMIT offset, count` | `LIMIT count OFFSET offset` | 适配器统一接口 |
| 插入返回ID | `result.insertId` | `last_insert_rowid()` | 适配器封装 |

## 5. 迁移管理

### 5.1 迁移脚本结构

```typescript
// src/store/migrations/index.ts

export interface Migration {
  version: number;
  name: string;
  up: string;   -- MySQL SQL
  upSqlite: string;  -- SQLite SQL（如不同）
  down?: string;
  downSqlite?: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'init_schema',
    up: `CREATE TABLE ...`,  -- MySQL版本
    upSqlite: `CREATE TABLE ...`,  -- SQLite版本（如有差异）
  },
  {
    version: 2,
    name: 'add_llm_logs',
    up: `CREATE TABLE t_llm_logs ...`,
    upSqlite: `CREATE TABLE t_llm_logs ...`,
  }
];
```

### 5.2 自动迁移

```typescript
// 启动时自动执行
export async function migrate(adapter: IDatabaseAdapter): Promise<void> {
  const currentVersion = await adapter.getVersion();
  const pendingMigrations = migrations.filter(m => m.version > currentVersion);
  
  for (const migration of pendingMigrations) {
    console.log(`[Migration] Applying ${migration.name} (v${migration.version})`);
    await adapter.run(migration.up);
    await adapter.setVersion(migration.version);
  }
}
```

## 6. 使用方式

### 6.1 基础使用

```typescript
// 获取数据库适配器实例
import { getDatabase } from '@/store';

const db = await getDatabase();

// 查询
const users = await db.query<User>('SELECT * FROM t_user WHERE deleted = ?', [0]);

// 插入
const result = await db.run(
  'INSERT INTO t_user (sid, username, password, name) VALUES (?, ?, ?, ?)',
  ['123', 'admin', 'hash', 'Admin']
);

// 事务
await db.transaction(async (trx) => {
  await trx.run('INSERT INTO t_user ...');
  await trx.run('INSERT INTO t_role ...');
});
```

### 6.2 日志记录

```typescript
// 替代原有的文件日志
import { getLLMLogRepository } from '@/store/repositories/llm-logs';

const logRepo = getLLMLogRepository();

// 记录请求
await logRepo.logRequest({
  model: 'gpt-4',
  provider: 'openai',
  source: 'agent',
  agentName: 'King',
  requestBody: { messages: [...] }
});

// 记录响应
await logRepo.logResponse({
  instanceId: 'xxx',
  duration: 1500,
  responseData: { fullContent: '...', toolCalls: [...] },
  tokenUsage: { prompt: 100, completion: 50, total: 150 }
});

// 查询日志（支持分页、过滤）
const logs = await logRepo.query({
  date: '2026-03-18',
  type: 'response',
  page: 1,
  pageSize: 20
});
```

## 7. 配置示例

### 7.1 本地模式（SQLite）

```env
# .env
DB_TYPE=sqlite
DB_PATH=./data/cradle.db
```

### 7.2 云端模式（MySQL）

```env
# .env
DB_TYPE=mysql
DB_HOST=rm-xxx.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=cradle
DB_PASSWORD=xxx
DB_NAME=cradle
DB_CONNECTION_LIMIT=10
```

## 8. 性能优化

### 8.1 SQLite优化

```sql
-- WAL模式（提升并发写入性能）
PRAGMA journal_mode = WAL;

-- 同步模式（平衡安全和性能）
PRAGMA synchronous = NORMAL;

-- 缓存大小
PRAGMA cache_size = -64000;  -- 64MB

-- 临时表存储
PRAGMA temp_store = MEMORY;
```

### 8.2 MySQL优化

```sql
-- 连接池配置
-- 已在适配器中实现

-- 索引优化
-- 已在表结构中定义

-- 日志表分区（大数据量时）
-- 可按日期分区，待后续优化
```

## 9. 数据迁移工具

### 9.1 SQLite → MySQL

```bash
# 导出SQLite数据
npm run db:export -- --from sqlite --to mysql

# 或自动迁移
npm run db:migrate -- --source ./data/cradle.db --target mysql://user:pass@host/db
```

### 9.2 实现思路

1. 读取源数据库所有表数据
2. 转换方言差异（如自增ID处理）
3. 批量插入目标数据库
4. 验证数据完整性

## 10. 实施计划

1. **Phase 1**: 创建抽象层和适配器接口
2. **Phase 2**: 实现SQLite适配器（默认模式）
3. **Phase 3**: 实现MySQL适配器（兼容现有）
4. **Phase 4**: 迁移系统表结构
5. **Phase 5**: 实现LLM日志表和仓库
6. **Phase 6**: 替换文件日志为数据库存储
7. **Phase 7**: 测试和优化

---

**设计完成时间**: 2026-03-18
**版本**: v1.0
