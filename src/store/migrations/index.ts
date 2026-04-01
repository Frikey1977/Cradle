/**
 * 数据库迁移管理器
 * 负责执行 SQL 迁移脚本
 */

import type { IDatabaseAdapter } from "../adapter.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 迁移记录
 */
interface Migration {
  version: number;
  name: string;
  file: string;
}

/**
 * 可用迁移列表
 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    file: "001_initial_schema.sql",
  },
];

/**
 * 初始化迁移表
 */
async function initMigrationsTable(db: IDatabaseAdapter): Promise<void> {
  await db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

/**
 * 获取已执行的迁移版本
 */
async function getAppliedMigrations(db: IDatabaseAdapter): Promise<number[]> {
  const results = await db.query<{ version: number }>(
    "SELECT version FROM _migrations ORDER BY version"
  );
  return results.map((r) => r.version);
}

/**
 * 记录已执行的迁移
 */
async function recordMigration(
  db: IDatabaseAdapter,
  version: number,
  name: string
): Promise<void> {
  await db.run("INSERT INTO _migrations (version, name) VALUES (?, ?)", [
    version,
    name,
  ]);
}

/**
 * 执行单个迁移文件
 */
async function executeMigration(
  db: IDatabaseAdapter,
  migration: Migration
): Promise<void> {
  console.log(`[Migration] Executing ${migration.file}...`);

  const filePath = join(__dirname, migration.file);
  const sql = readFileSync(filePath, "utf-8");

  // 分割 SQL 语句（按分号分隔，但忽略注释中的分号）
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    if (statement) {
      await db.run(statement);
    }
  }

  // 记录迁移
  await recordMigration(db, migration.version, migration.name);

  console.log(`[Migration] ${migration.file} executed successfully`);
}

/**
 * 执行所有待执行的迁移
 */
export async function runMigrations(db: IDatabaseAdapter): Promise<void> {
  console.log("[Migration] Starting database migrations...");

  try {
    // 初始化迁移表
    await initMigrationsTable(db);

    // 获取已执行的迁移
    const appliedVersions = await getAppliedMigrations(db);
    console.log(
      `[Migration] Applied migrations: ${appliedVersions.join(", ") || "none"}`
    );

    // 执行待执行的迁移
    for (const migration of MIGRATIONS) {
      if (!appliedVersions.includes(migration.version)) {
        await executeMigration(db, migration);
      } else {
        console.log(
          `[Migration] Skipping ${migration.file} (already applied)`
        );
      }
    }

    console.log("[Migration] All migrations completed successfully");
  } catch (error) {
    console.error("[Migration] Migration failed:", error);
    throw error;
  }
}

/**
 * 检查是否需要执行迁移
 */
export async function hasPendingMigrations(
  db: IDatabaseAdapter
): Promise<boolean> {
  try {
    await initMigrationsTable(db);
    const appliedVersions = await getAppliedMigrations(db);
    return MIGRATIONS.some((m) => !appliedVersions.includes(m.version));
  } catch {
    return true;
  }
}
