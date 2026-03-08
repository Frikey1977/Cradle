/**
 * 系统技能服务层
 * 对应设计文档: design/system/database/t_skills.md
 */

import { readFile, writeFile, mkdir, access, readdir } from "fs/promises";
import { join, resolve } from "path";
import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Skill,
  CreateSkillDto,
  UpdateSkillDto,
  SkillQuery,
  SkillListResult,
} from "./types.js";

// 工作空间路径
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "f:\\Cradle workspace";
const SKILLS_DIR = process.env.SKILLS_DIR || "skills";

/**
 * 构建查询条件
 */
function buildWhereClause(queryParams: SkillQuery): { whereClause: string; params: any[] } {
  const { keyword, sourceType, status, type, parentId } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (name LIKE ? OR slug LIKE ? OR description LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (sourceType) {
    whereClause += " AND source_type = ?";
    params.push(sourceType);
  }

  if (status) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  if (type) {
    whereClause += " AND type = ?";
    params.push(type);
  }

  if (parentId !== undefined) {
    if (parentId === null || parentId === "") {
      whereClause += " AND parent_id IS NULL";
    } else {
      whereClause += " AND parent_id = ?";
      params.push(parentId);
    }
  }

  return { whereClause, params };
}

/**
 * 获取技能列表（分页）
 */
export async function getSkillList(queryParams: SkillQuery): Promise<SkillListResult> {
  const { page = 1, pageSize = 20 } = queryParams;
  const { whereClause, params } = buildWhereClause(queryParams);

  // 查询总数
  const countResult = await query<[{ count: number }]>(
    `SELECT COUNT(*) as count FROM t_skills ${whereClause}`,
    params,
  );
  const total = countResult[0].count;

  // 查询数据
  const offset = (page - 1) * pageSize;
  const rows = await query<Skill[]>(
    `SELECT
      sid,
      name,
      title,
      slug,
      version,
      description,
      source_type as sourceType,
      source_url as sourceUrl,
      metadata,
      config_schema as configSchema,
      default_config as defaultConfig,
      score,
      star,
      type,
      parent_id as parentId,
      sort,
      create_time as createTime,
      deleted,
      status
    FROM t_skills
    ${whereClause}
    ORDER BY sort ASC, type ASC, create_time DESC
    LIMIT ${Number(pageSize)} OFFSET ${Number(offset)}`,
    params,
  );

  return {
    items: rows,
    total,
  };
}

/**
 * 获取技能树（不分页，用于树形展示）
 */
export async function getSkillTree(queryParams: Omit<SkillQuery, "page" | "pageSize">): Promise<Skill[]> {
  const { whereClause, params } = buildWhereClause(queryParams);

  const rows = await query<Skill[]>(
    `SELECT
      sid,
      name,
      title,
      slug,
      version,
      description,
      source_type as sourceType,
      source_url as sourceUrl,
      metadata,
      config_schema as configSchema,
      default_config as defaultConfig,
      score,
      star,
      type,
      parent_id as parentId,
      sort,
      create_time as createTime,
      deleted,
      status
    FROM t_skills
    ${whereClause}
    ORDER BY sort ASC, type ASC, name ASC`,
    params,
  );

  // 构建树形结构
  return buildTree(rows);
}

/**
 * 构建树形结构
 */
function buildTree(items: Skill[]): Skill[] {
  const itemMap = new Map<string, Skill>();
  const roots: Skill[] = [];

  // 先建立映射
  items.forEach((item) => {
    itemMap.set(item.sid, { ...item, children: [] });
  });

  // 构建父子关系
  items.forEach((item) => {
    const node = itemMap.get(item.sid)!;
    if (item.parentId) {
      const parent = itemMap.get(item.parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        // 父节点不在当前结果集中，作为根节点
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * 获取所有技能（不分页）
 */
export async function getAllSkills(queryParams: Omit<SkillQuery, "page" | "pageSize">): Promise<Skill[]> {
  const { keyword, sourceType, status } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (keyword) {
    whereClause += " AND (name LIKE ? OR slug LIKE ? OR description LIKE ?)";
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  if (sourceType) {
    whereClause += " AND source_type = ?";
    params.push(sourceType);
  }

  if (status) {
    whereClause += " AND status = ?";
    params.push(status);
  }

  const rows = await query<Skill[]>(
    `SELECT
      sid,
      name,
      title,
      slug,
      version,
      description,
      source_type as sourceType,
      source_url as sourceUrl,
      metadata,
      config_schema as configSchema,
      default_config as defaultConfig,
      score,
      star,
      type,
      parent_id as parentId,
      sort,
      create_time as createTime,
      deleted,
      status
    FROM t_skills
    ${whereClause}
    ORDER BY sort ASC, type ASC, create_time DESC`,
    params,
  );

  return rows;
}

/**
 * 根据ID获取技能
 */
export async function getSkillById(sid: string): Promise<Skill | null> {
  const rows = await query<Skill[]>(
    `SELECT
      sid,
      name,
      title,
      slug,
      version,
      description,
      source_type as sourceType,
      source_url as sourceUrl,
      metadata,
      config_schema as configSchema,
      default_config as defaultConfig,
      score,
      star,
      type,
      parent_id as parentId,
      sort,
      create_time as createTime,
      deleted,
      status
    FROM t_skills
    WHERE sid = ? AND deleted = 0`,
    [sid],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 根据 slug 获取技能
 */
export async function getSkillBySlug(slug: string): Promise<Skill | null> {
  const rows = await query<Skill[]>(
    `SELECT
      sid,
      name,
      title,
      slug,
      version,
      description,
      source_type as sourceType,
      source_url as sourceUrl,
      metadata,
      config_schema as configSchema,
      default_config as defaultConfig,
      score,
      star,
      type,
      parent_id as parentId,
      create_time as createTime,
      deleted,
      status
    FROM t_skills
    WHERE slug = ? AND deleted = 0`,
    [slug],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查 slug 是否存在
 */
export async function isSlugExists(slug: string, excludeSid?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_skills WHERE slug = ? AND deleted = 0";
  const params: any[] = [slug];

  if (excludeSid) {
    sql += " AND sid != ?";
    params.push(excludeSid);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 创建技能
 */
export async function createSkill(data: CreateSkillDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_skills (
      sid, name, title, slug, version, description,
      source_type, source_url,
      metadata, config_schema, default_config,
      score, star, type, parent_id, sort,
      status, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.title || null,
      data.slug,
      data.version || "1.0.0",
      data.description || null,
      data.sourceType || "builtin",
      data.sourceUrl || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
      data.configSchema ? JSON.stringify(data.configSchema) : null,
      data.defaultConfig ? JSON.stringify(data.defaultConfig) : null,
      data.score || null,
      data.star || null,
      data.type || "skill",
      data.parentId || null,
      data.sort ?? 0,
      data.status || "enabled",
      0,
    ],
  );

  return sid;
}

/**
 * 更新技能
 */
export async function updateSkill(sid: string, data: UpdateSkillDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title || null);
  }
  if (data.slug !== undefined) {
    updates.push("slug = ?");
    params.push(data.slug);
  }
  if (data.version !== undefined) {
    updates.push("version = ?");
    params.push(data.version);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.sourceType !== undefined) {
    updates.push("source_type = ?");
    params.push(data.sourceType);
  }
  if (data.sourceUrl !== undefined) {
    updates.push("source_url = ?");
    params.push(data.sourceUrl || null);
  }
  if (data.metadata !== undefined) {
    updates.push("metadata = ?");
    params.push(data.metadata ? JSON.stringify(data.metadata) : null);
  }
  if (data.configSchema !== undefined) {
    updates.push("config_schema = ?");
    params.push(data.configSchema ? JSON.stringify(data.configSchema) : null);
  }
  if (data.defaultConfig !== undefined) {
    updates.push("default_config = ?");
    params.push(data.defaultConfig ? JSON.stringify(data.defaultConfig) : null);
  }
  if (data.score !== undefined) {
    updates.push("score = ?");
    params.push(data.score);
  }
  if (data.star !== undefined) {
    updates.push("star = ?");
    params.push(data.star);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type);
  }
  if (data.parentId !== undefined) {
    updates.push("parent_id = ?");
    params.push(data.parentId);
  }
  if (data.sort !== undefined) {
    updates.push("sort = ?");
    params.push(data.sort);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) {
    return;
  }

  updates.push("timestamp = NOW()");
  params.push(sid);

  await run(
    `UPDATE t_skills SET ${updates.join(", ")} WHERE sid = ? AND deleted = 0`,
    params,
  );
}

/**
 * 删除技能（逻辑删除）
 */
export async function deleteSkill(sid: string): Promise<void> {
  await run(
    "UPDATE t_skills SET deleted = 1, timestamp = NOW() WHERE sid = ? AND deleted = 0",
    [sid],
  );
}

/**
 * 检查技能是否存在
 */
export async function isSkillExists(sid: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_skills WHERE sid = ? AND deleted = 0",
    [sid],
  );
  return result[0].count > 0;
}

/**
 * 获取技能安装路径
 */
function getSkillInstallPath(slug: string): string {
  return join(WORKSPACE_DIR, SKILLS_DIR, slug);
}

/**
 * 获取 SKILL.md 文件路径
 */
function getSkillMdFilePath(slug: string): string {
  return join(getSkillInstallPath(slug), "SKILL.md");
}

/**
 * 读取 SKILL.md 内容
 */
export async function getSkillMdContent(slug: string): Promise<string> {
  const filePath = getSkillMdFilePath(slug);
  try {
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    // 文件不存在时返回空字符串
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
}

/**
 * 保存 SKILL.md 内容
 */
export async function saveSkillMdContent(slug: string, content: string): Promise<void> {
  const filePath = getSkillMdFilePath(slug);
  const installPath = getSkillInstallPath(slug);

  // 确保目录存在
  try {
    await access(installPath);
  } catch {
    await mkdir(installPath, { recursive: true });
  }

  await writeFile(filePath, content, "utf-8");
}

/**
 * 文件树节点类型
 */
export interface FileTreeNode {
  title: string;
  key: string;
  isLeaf?: boolean;
  children?: FileTreeNode[];
}

/**
 * 递归读取目录生成文件树
 */
async function readDirRecursive(dirPath: string, basePath: string): Promise<FileTreeNode[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = fullPath.replace(basePath, "").replace(/^\\/, "");

    if (entry.isDirectory()) {
      const children = await readDirRecursive(fullPath, basePath);
      nodes.push({
        title: entry.name,
        key: fullPath,
        children,
      });
    } else {
      nodes.push({
        title: entry.name,
        key: fullPath,
        isLeaf: true,
      });
    }
  }

  // 排序：文件夹在前，文件在后，按名称排序
  nodes.sort((a, b) => {
    if (a.children && !b.children) return -1;
    if (!a.children && b.children) return 1;
    return a.title.localeCompare(b.title);
  });

  return nodes;
}

/**
 * 获取技能文件树
 */
export async function getSkillFileTree(slug: string): Promise<FileTreeNode[]> {
  const installPath = getSkillInstallPath(slug);

  try {
    await access(installPath);
  } catch {
    // 目录不存在返回空数组
    return [];
  }

  const children = await readDirRecursive(installPath, installPath);

  // 返回以 slug 为根的树
  return [
    {
      title: slug,
      key: installPath,
      children,
    },
  ];
}

/**
 * 获取技能文件内容
 */
export async function getSkillFileContent(filePath: string): Promise<string> {
  try {
    // 安全检查：确保文件路径在技能目录内
    const resolvedPath = resolve(filePath);
    const workspaceDir = resolve(WORKSPACE_DIR);

    if (!resolvedPath.startsWith(workspaceDir)) {
      throw new Error("非法文件路径");
    }

    const content = await readFile(resolvedPath, "utf-8");
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("文件不存在");
    }
    throw error;
  }
}
