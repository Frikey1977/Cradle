/**
 * 列出数据库中所有表
 */

import { getDatabase } from "../src/store/factory.js";

async function listAllTables() {
  const db = await getDatabase();

  // SQLite 中获取所有表
  const tables = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'"
  );

  console.log("数据库中的所有表：");
  console.log("==================");

  for (const table of tables) {
    try {
      const count = await db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table.name}`
      );
      console.log(`${table.name}: ${count?.count || 0} 条记录`);
    } catch (error) {
      console.log(`${table.name}: 无法获取记录数`);
    }
  }

  await db.close();
}

listAllTables().catch(console.error);
