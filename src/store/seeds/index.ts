/**
 * 数据库 Seed 数据初始化
 * 在首次启动时自动插入基础数据
 */

import type { IDatabaseAdapter } from "../adapter.js";
import { seedExportedData } from "./exported-data.js";

/**
 * 执行所有 Seed 数据插入
 */
export async function runSeeds(db: IDatabaseAdapter): Promise<void> {
  console.log("[Seed] Starting database seeding...");

  try {
    // 导入从现有数据库导出的数据
    await seedExportedData(db);

    console.log("[Seed] Database seeding completed successfully");
  } catch (error) {
    console.error("[Seed] Database seeding failed:", error);
    throw error;
  }
}

/**
 * 检查是否需要执行 Seed
 */
export async function shouldRunSeeds(db: IDatabaseAdapter): Promise<boolean> {
  try {
    // 检查是否已有数据
    const result = await db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM t_llm_providers WHERE deleted = 0"
    );
    return (result?.count ?? 0) === 0;
  } catch {
    // 表不存在，需要执行 seed
    return true;
  }
}
