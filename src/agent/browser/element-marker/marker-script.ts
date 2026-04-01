/**
 * 元素标记器脚本加载器
 *
 * 从独立JS文件加载标记器脚本
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

// 脚本缓存
let scriptCache: string | null = null;

/**
 * 获取元素标记器脚本
 * 从独立JS文件加载，支持热更新
 */
export function getElementMarkerScript(): string {
  // 每次重新读取文件，支持热更新
  try {
    // 使用相对于当前文件的路径，不再依赖 process.cwd()
    const scriptPath = join(__dirname, "scripts", "marker-inject.js");
    scriptCache = readFileSync(scriptPath, "utf-8");
    return scriptCache;
  } catch (error) {
    console.error("[ElementMarker] Failed to load script:", error);
    // 如果文件读取失败，返回缓存的脚本
    if (scriptCache) {
      return scriptCache;
    }
    throw new Error("Element marker script not found");
  }
}

// 为了保持向后兼容，保留空字符串
export const ELEMENT_MARKER_SCRIPT = "";
