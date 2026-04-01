/**
 * 导出当前数据库数据为 Seed 脚本
 */

import { getDatabase } from "../src/store/factory.js";
import { writeFileSync } from "fs";
import { join } from "path";

async function exportSeedData() {
  const db = await getDatabase();

  // 获取数据库中所有表
  const tablesResult = await db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations' AND name NOT LIKE 't_llm_logs' AND name NOT LIKE 't_heartbeat_logs' AND name NOT LIKE 't_worktask%' AND name NOT LIKE 't_task_%' AND name NOT LIKE '_schema_version'"
  );

  const tables = tablesResult.map(t => t.name);
  console.log(`[Export] Found ${tables.length} tables to export\n`);

  const seedData: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const rows = await db.query<any>(`SELECT * FROM ${table} WHERE deleted = 0 OR deleted IS NULL`);
      if (rows.length > 0) {
        seedData[table] = rows;
        console.log(`[Export] ${table}: ${rows.length} rows`);
      } else {
        console.log(`[Export] ${table}: 0 rows (skipped)`);
      }
    } catch (error) {
      // 如果没有 deleted 字段，查询所有数据
      try {
        const rows = await db.query<any>(`SELECT * FROM ${table}`);
        if (rows.length > 0) {
          seedData[table] = rows;
          console.log(`[Export] ${table}: ${rows.length} rows`);
        } else {
          console.log(`[Export] ${table}: 0 rows (skipped)`);
        }
      } catch (e) {
        console.log(`[Export] ${table}: error - ${e}`);
      }
    }
  }

  // 生成 TypeScript Seed 文件
  const seedContent = generateSeedFile(seedData);
  const outputPath = join(process.cwd(), "src", "store", "seeds", "exported-data.ts");
  writeFileSync(outputPath, seedContent, "utf-8");

  console.log(`\n[Export] Seed data exported to: ${outputPath}`);

  await db.close();
}

function generateSeedFile(data: Record<string, any[]>): string {
  const tableInserts: string[] = [];

  for (const [table, rows] of Object.entries(data)) {
    if (rows.length === 0) continue;

    const columns = Object.keys(rows[0]).filter((col) => col !== "timestamp" && col !== "rowid");
    const columnList = columns.join(", ");

    const insertStatements = rows.map((row) => {
      const values = columns
        .map((col) => {
          const val = row[col];
          if (val === null || val === undefined) {
            return "NULL";
          }
          if (typeof val === "string") {
            return `'${val.replace(/'/g, "''")}'`;
          }
          if (typeof val === "object") {
            return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          }
          return val;
        })
        .join(", ");

      return `    await db.run(\`
      INSERT INTO ${table} (${columnList}) 
      VALUES (${values})
    \`);`;
    });

    tableInserts.push(`  // ${table} (${rows.length} rows)\n${insertStatements.join("\n")}`);
  }

  return `/**
 * 从现有数据库导出的 Seed 数据
 * 自动生成于 ${new Date().toISOString()}
 */

import type { IDatabaseAdapter } from "../adapter.js";

export async function seedExportedData(db: IDatabaseAdapter): Promise<void> {
  console.log("[Seed] Importing exported data...");

${tableInserts.join("\n\n")}

  console.log("[Seed] Exported data imported successfully");
}
`;
}

exportSeedData().catch(console.error);
