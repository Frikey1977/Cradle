import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

/**
 * 翻译文件路径配置
 */
const TRANSLATION_PATHS = {
  zh: "web/playground/src/locales/langs/zh-CN",
  en: "web/playground/src/locales/langs/en-US",
};

/**
 * 翻译文件映射
 */
const TRANSLATION_FILES: Record<string, string> = {
  system: "system.json",
  organization: "organization.json",
  codes: "codes.json",
};

/**
 * 获取项目根目录
 */
function getProjectRoot(): string {
  // 使用 process.cwd() 查找 cradle 目录（考虑路径中可能有空格）
  const currentDir = process.cwd();

  // 查找 "cradle" 后跟路径分隔符或字符串结尾的位置
  // 使用正则匹配 cradle 后跟 \ 或 / 或字符串结尾
  const match = currentDir.match(/(.*cradle)[\\\/]/i);
  if (match) {
    return match[1];
  }

  // 如果当前目录就是 cradle，直接返回
  if (currentDir.toLowerCase().endsWith("cradle")) {
    return currentDir;
  }

  return currentDir;
}

/**
 * 解析翻译键
 * 例如: system.code.type.module -> { namespace: "system", keys: ["code", "type", "module"] }
 */
function parseTranslationKey(key: string): { namespace: string; keys: string[] } | null {
  const parts = key.split(".");
  if (parts.length < 2) return null;

  const namespace = parts[0];
  return {
    namespace,
    keys: parts.slice(1),
  };
}

/**
 * 读取翻译文件
 */
function readTranslationFile(lang: "zh" | "en", namespace: string): Record<string, any> {
  const projectRoot = getProjectRoot();
  const fileName = TRANSLATION_FILES[namespace];
  if (!fileName) return {};

  const filePath = join(projectRoot, TRANSLATION_PATHS[lang], fileName);
  if (!existsSync(filePath)) return {};

  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read translation file: ${filePath}`, error);
    return {};
  }
}

/**
 * 写入翻译文件
 * 使用原子写入：先写入临时文件，再重命名，避免文件处于不完整状态
 */
function writeTranslationFile(
  lang: "zh" | "en",
  namespace: string,
  data: Record<string, any>,
): boolean {
  const projectRoot = getProjectRoot();
  const fileName = TRANSLATION_FILES[namespace];
  if (!fileName) return false;

  const filePath = join(projectRoot, TRANSLATION_PATHS[lang], fileName);
  const tempPath = filePath + ".tmp";
  console.log("[writeTranslationFile] Writing to:", filePath);

  try {
    // 先写入临时文件
    writeFileSync(tempPath, JSON.stringify(data, null, 2) + "\n", "utf-8");
    // 原子重命名，确保文件完整性
    renameSync(tempPath, filePath);
    console.log("[writeTranslationFile] Success");
    return true;
  } catch (error) {
    console.error(`[writeTranslationFile] Failed to write translation file: ${filePath}`, error);
    // 清理临时文件
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
    } catch {
      // 忽略清理错误
    }
    return false;
  }
}

/**
 * 在对象中设置嵌套值
 */
function setNestedValue(obj: Record<string, any>, keys: string[], value: string): void {
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
}

/**
 * 检查键是否存在
 */
function hasNestedKey(obj: Record<string, any>, keys: string[]): boolean {
  let current = obj;
  for (const key of keys) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return false;
    }
    current = current[key];
  }
  return true;
}

/**
 * 生成默认翻译值
 */
function generateDefaultValue(keys: string[], lang: "zh" | "en"): string {
  const lastKey = keys[keys.length - 1];

  // 常见键的默认翻译
  const commonDefaults: Record<string, Record<string, string>> = {
    zh: {
      title: "标题",
      name: "名称",
      list: "列表",
      create: "新增",
      edit: "编辑",
      delete: "删除",
      moduleName: "模块名称",
      status: "状态",
      description: "描述",
      operation: "操作",
      sort: "排序",
      type: "类型",
      value: "值",
      code: "编码",
    },
    en: {
      title: "Title",
      name: "Name",
      list: "List",
      create: "Create",
      edit: "Edit",
      delete: "Delete",
      moduleName: "Module Name",
      status: "Status",
      description: "Description",
      operation: "Operation",
      sort: "Sort",
      type: "Type",
      value: "Value",
      code: "Code",
    },
  };

  // 如果最后一个键是 "title"，且前面还有其他键，使用父级键名作为翻译
  // 例如: code.system.title -> 使用 "system" 作为翻译基础
  if (lastKey === "title" && keys.length >= 2) {
    const parentKey = keys[keys.length - 2];
    // 返回父级键名（首字母大写）
    if (lang === "zh") {
      return parentKey;
    } else {
      return parentKey.charAt(0).toUpperCase() + parentKey.slice(1);
    }
  }

  return commonDefaults[lang][lastKey] || lastKey;
}

/**
 * 同步翻译
 * @param translationKey 翻译键，如 "system.code.type.newtype"
 * @param customValues 自定义翻译值 { zh: "中文", en: "English" }
 * @returns 是否成功
 */
export function syncTranslation(
  translationKey: string,
  customValues?: { zh?: string; en?: string },
): { success: boolean; message: string } {
  console.log("[syncTranslation] Starting sync for key:", translationKey);

  const parsed = parseTranslationKey(translationKey);
  if (!parsed) {
    console.log("[syncTranslation] Invalid translation key format");
    return { success: false, message: "Invalid translation key format" };
  }

  const { namespace, keys } = parsed;
  console.log("[syncTranslation] Parsed:", { namespace, keys });

  // 检查命名空间是否支持
  if (!TRANSLATION_FILES[namespace]) {
    console.log("[syncTranslation] Unsupported namespace:", namespace);
    return { success: false, message: `Unsupported namespace: ${namespace}` };
  }

  const projectRoot = getProjectRoot();
  console.log("[syncTranslation] Project root:", projectRoot);

  // 读取并更新中文翻译
  const zhData = readTranslationFile("zh", namespace);
  console.log("[syncTranslation] Current zhData keys:", Object.keys(zhData));
  const zhExists = hasNestedKey(zhData, keys);
  console.log("[syncTranslation] zhExists:", zhExists);
  if (!zhExists) {
    const zhValue = customValues?.zh || generateDefaultValue(keys, "zh");
    console.log("[syncTranslation] Setting zh value:", zhValue);
    setNestedValue(zhData, keys, zhValue);
    const zhWriteResult = writeTranslationFile("zh", namespace, zhData);
    console.log("[syncTranslation] zhWriteResult:", zhWriteResult);
  }

  // 读取并更新英文翻译
  const enData = readTranslationFile("en", namespace);
  console.log("[syncTranslation] Current enData keys:", Object.keys(enData));
  const enExists = hasNestedKey(enData, keys);
  console.log("[syncTranslation] enExists:", enExists);
  if (!enExists) {
    const enValue = customValues?.en || generateDefaultValue(keys, "en");
    console.log("[syncTranslation] Setting en value:", enValue);
    setNestedValue(enData, keys, enValue);
    const enWriteResult = writeTranslationFile("en", namespace, enData);
    console.log("[syncTranslation] enWriteResult:", enWriteResult);
  }

  const result = {
    success: true,
    message:
      zhExists && enExists
        ? "Translation key already exists"
        : "Translation synchronized successfully",
  };
  console.log("[syncTranslation] Result:", result);
  return result;
}

/**
 * 批量同步翻译
 */
export function batchSyncTranslations(
  items: Array<{
    key: string;
    values?: { zh?: string; en?: string };
  }>,
): { success: boolean; results: Array<{ key: string; success: boolean; message: string }> } {
  const results = items.map((item) => ({
    key: item.key,
    ...syncTranslation(item.key, item.values),
  }));

  return {
    success: results.every((r) => r.success),
    results,
  };
}
