import { readFile } from "fs/promises";
import { expandPath } from "./path-utils.js";

export async function executeRead(filePath: string): Promise<string> {
  const expandedPath = expandPath(filePath);
  console.log(`[Tools] Reading file: ${expandedPath}`);

  try {
    const content = await readFile(expandedPath, "utf-8");
    return content;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read file ${expandedPath}: ${errorMessage}`);
  }
}
