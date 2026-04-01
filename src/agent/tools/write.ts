import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { expandPath } from "./path-utils.js";

/**
 * 写入文件 - 与 opencode 实现保持一致
 * 
 * 注意：不再限制内容长度，依赖 LLM 的 maxOutputTokens 设置（32,000）
 * 这样可以支持大文件输出，同时保持与 opencode 的一致性
 */
export async function executeWrite(filePath: string, content: string): Promise<string> {
  const expandedPath = expandPath(filePath);
  console.log(`[Tools] Writing file: ${expandedPath} (${content.length} characters)`);

  try {
    const dir = dirname(expandedPath);
    await mkdir(dir, { recursive: true });
    
    await writeFile(expandedPath, content, "utf-8");
    console.log(`[Tools] ✅ Wrote file: ${expandedPath}`);
    return `Successfully wrote ${content.length} characters to ${expandedPath}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write file ${expandedPath}: ${errorMessage}`);
  }
}
