/**
 * Skill 解析器
 * 负责解析 SKILL.md 文件的 YAML frontmatter 和 Markdown 内容
 * 参考 OpenClaw 实现
 */

import YAML from "yaml";
import type {
  ParsedSkill,
  ParsedSkillFrontmatter,
  SkillMetadata,
  SkillInvocationPolicy,
  SkillCommandDef,
  SkillParameterDef,
  SkillInstallSpec,
} from "./types.js";

/**
 * 从文件内容解析 Skill
 * @param content SKILL.md 文件内容
 * @param slug Skill slug
 * @param baseDir Skill 所在目录（用于解析 {baseDir} 占位符）
 */
export function parseSkill(content: string, slug: string, baseDir: string = ""): ParsedSkill {
  const { frontmatter, markdown } = extractFrontmatter(content);
  const metadata = resolveMetadata(frontmatter);
  const invocation = resolveInvocationPolicy(frontmatter);
  const commands = extractCommands(markdown, baseDir);
  const whenToUse = extractWhenToUse(markdown);

  return {
    name: frontmatter.name || slug,
    description: frontmatter.description || "",
    slug,
    metadata,
    content: markdown,
    commands,
    invocation,
    baseDir,
    whenToUse,
  };
}

/**
 * 提取 YAML frontmatter
 */
function extractFrontmatter(content: string): {
  frontmatter: ParsedSkillFrontmatter;
  markdown: string;
} {
  // 支持 \r\n (Windows) 和 \n (Unix) 换行符
  // 使用 \r?\n 来匹配可选的 \r 后跟 \n
  const frontmatterRegex = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      markdown: content,
    };
  }

  const frontmatterBlock = match[1];
  const markdown = match[2].trim();

  try {
    const parsed = YAML.parse(frontmatterBlock) as Record<string, unknown>;
    const frontmatter: ParsedSkillFrontmatter = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || value === undefined) {
        continue;
      }
      if (typeof value === "string") {
        frontmatter[key] = value;
      } else if (typeof value === "number" || typeof value === "boolean") {
        frontmatter[key] = String(value);
      } else if (typeof value === "object") {
        frontmatter[key] = JSON.stringify(value);
      }
    }

    return { frontmatter, markdown };
  } catch {
    return {
      frontmatter: {},
      markdown: content,
    };
  }
}

/**
 * 解析 Metadata
 */
function resolveMetadata(frontmatter: ParsedSkillFrontmatter): SkillMetadata {
  const metadata: SkillMetadata = {};

  // emoji
  if (frontmatter.emoji) {
    metadata.emoji = frontmatter.emoji;
  }

  // homepage
  if (frontmatter.homepage) {
    metadata.homepage = frontmatter.homepage;
  }

  // primaryEnv
  if (frontmatter.primaryEnv) {
    metadata.primaryEnv = frontmatter.primaryEnv;
  }

  // skillKey
  if (frontmatter.skillKey) {
    metadata.skillKey = frontmatter.skillKey;
  }

  // always
  if (frontmatter.always) {
    metadata.always = frontmatter.always === "true";
  }

  // os
  if (frontmatter.os) {
    metadata.os = parseStringList(frontmatter.os);
  }

  // requires
  if (frontmatter.requires) {
    try {
      metadata.requires = JSON.parse(frontmatter.requires);
    } catch {
      // ignore
    }
  }

  // metadata (OpenClaw format)
  if (frontmatter.metadata) {
    try {
      const metaObj = JSON.parse(frontmatter.metadata);
      if (metaObj.openclaw) {
        const openclaw = metaObj.openclaw;
        metadata.emoji = openclaw.emoji || metadata.emoji;
        metadata.requires = openclaw.requires || metadata.requires;
        metadata.install = openclaw.install || metadata.install;
        metadata.primaryEnv = openclaw.primaryEnv || metadata.primaryEnv;
      }
    } catch {
      // ignore
    }
  }

  return metadata;
}

/**
 * 解析调用策略
 */
function resolveInvocationPolicy(frontmatter: ParsedSkillFrontmatter): SkillInvocationPolicy {
  return {
    userInvocable: parseBool(frontmatter["user-invocable"], true),
    disableModelInvocation: parseBool(frontmatter["disable-model-invocation"], false),
  };
}

/**
 * 从 Markdown 提取 When to Use 场景列表
 * @param markdown SKILL.md 内容
 */
function extractWhenToUse(markdown: string): string[] {
  const whenToUse: string[] = [];

  // 匹配 ## When to Use 或 ## When to use 部分
  const whenToUseRegex = /##\s*When\s+to\s+Use\s*\n([\s\S]*?)(?=\n##|\n###|$)/i;
  const match = markdown.match(whenToUseRegex);

  if (match) {
    const content = match[1];
    // 提取列表项（- 或 * 开头）
    const listItemRegex = /^[-*]\s+(.+)$/gm;
    let itemMatch;
    while ((itemMatch = listItemRegex.exec(content)) !== null) {
      whenToUse.push(itemMatch[1].trim());
    }
  }

  return whenToUse;
}

/**
 * 从 Markdown 提取命令
 * 支持从标题中提取命令名，并使用 {baseDir} 占位符
 * @param markdown SKILL.md 内容
 * @param baseDir Skill 所在目录路径
 */
function extractCommands(markdown: string, baseDir: string): SkillCommandDef[] {
  const commands: SkillCommandDef[] = [];

  // 匹配 bash 代码块 - 支持 \r\n (Windows) 和 \n (Unix) 换行符
  const codeBlockRegex = /```bash\r?\n([\s\S]*?)```/g;
  let match;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    let code = match[1].trim();
    const beforeMatch = markdown.slice(0, match.index);

    // 查找代码块之前最近的 ### 或 ## 标题
    // 从代码块位置向前搜索，找到最近的标题
    // 兼容 Windows (\r\n) 和 Unix (\n) 换行符
    const lines = beforeMatch.split(/\r?\n/);
    let headingText = "";

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      // 匹配 ### 或 ## 标题
      const headingMatch = line.match(/^###\s+(.+)$/) || line.match(/^##\s+(.+)$/);
      if (headingMatch) {
        headingText = headingMatch[1].trim();
        break;
      }
      // 如果遇到另一个代码块或空行分隔，停止搜索
      if (line.startsWith("```") || line.startsWith("---")) {
        break;
      }
    }

    // 从标题生成命令名（转换为 kebab-case）
    // 例如 "List Pull Requests" -> "list-pull-requests"
    const commandName = headingText
      ? headingText
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "")
      : "unnamed";

    // 提取命令名称（第一行）
    // 兼容 Windows (\r\n) 和 Unix (\n) 换行符
    const codeLines = code.split(/\r?\n/);
    const firstLine = codeLines[0].trim();

    // 跳过注释和空行
    if (firstLine.startsWith("#") || !firstLine) {
      continue;
    }

    // 替换 {baseDir} 占位符为实际路径
    if (baseDir) {
      code = code.replace(/\{baseDir\}/g, baseDir);
    }

    // 解析参数占位符如 ${param} 或 $param
    const parameters = extractParameters(code);

    commands.push({
      name: commandName,
      description: headingText,
      parameters,
      command: code,
      timeout: 300, // 默认5分钟超时
    });
  }

  return commands;
}

/**
 * 从命令中提取参数定义
 */
function extractParameters(command: string): SkillParameterDef[] {
  const parameters: SkillParameterDef[] = [];
  const seen = new Set<string>();

  // 匹配 ${param} 或 $param
  const paramRegex = /\$\{(\w+)\}|\$(\w+)/g;
  let match;

  while ((match = paramRegex.exec(command)) !== null) {
    const name = match[1] || match[2];
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);

    parameters.push({
      name,
      type: "string",
      required: true,
      description: `Parameter: ${name}`,
    });
  }

  return parameters;
}

/**
 * 解析字符串列表
 */
function parseStringList(value: string): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 解析布尔值
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === "true" || value === "1" || value === "yes";
}

/**
 * 解析安装规范
 */
export function parseInstallSpec(input: unknown): SkillInstallSpec | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  const raw = input as Record<string, unknown>;
  const validKinds = ["brew", "node", "go", "uv", "download", "shell"];
  const kind = String(raw.kind || "");

  if (!validKinds.includes(kind)) {
    return undefined;
  }

  const spec: SkillInstallSpec = { kind: kind as SkillInstallSpec["kind"] };

  if (typeof raw.id === "string") spec.id = raw.id;
  if (typeof raw.label === "string") spec.label = raw.label;
  if (Array.isArray(raw.bins)) spec.bins = raw.bins.map(String);
  if (Array.isArray(raw.os)) spec.os = raw.os.map(String);
  if (typeof raw.formula === "string") spec.formula = raw.formula;
  if (typeof raw.package === "string") spec.package = raw.package;
  if (typeof raw.module === "string") spec.module = raw.module;
  if (typeof raw.url === "string") spec.url = raw.url;
  if (typeof raw.archive === "string") spec.archive = raw.archive;
  if (typeof raw.extract === "boolean") spec.extract = raw.extract;
  if (typeof raw.stripComponents === "number") spec.stripComponents = raw.stripComponents;
  if (typeof raw.targetDir === "string") spec.targetDir = raw.targetDir;
  if (typeof raw.command === "string") spec.command = raw.command;

  return spec;
}
