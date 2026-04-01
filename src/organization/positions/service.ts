/**
 * 岗位管理服务层
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import { syncTranslation } from "../../system/translation/service.js";
import type {
  Position,
  CreatePositionDto,
  UpdatePositionDto,
  PositionQuery,
  PositionListResult,
} from "./types.js";

/**
 * 获取岗位列表（支持分页和筛选）
 */
export async function getPositionList(queryParams: PositionQuery): Promise<PositionListResult> {
  const { oid, keyword, status, type, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE p.deleted = 0";
  const params: any[] = [];

  if (oid) {
    whereClause += " AND p.oid = ?";
    params.push(oid);
  }

  if (keyword) {
    whereClause += " AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword);
  }

  if (status !== undefined) {
    whereClause += " AND p.status = ?";
    params.push(status);
  }

  if (type) {
    whereClause += " AND p.type = ?";
    params.push(type);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_positions p ${whereClause}`,
    params,
  );
  const total = countResult[0].total;

  // 获取列表数据
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const rows = await query<Position[]>(
    `SELECT
      p.sid as id,
      p.name,
      p.e_name as eName,
      p.title,
      p.code,
      p.type,
      p.oid,
      o.name as orgName,
      o.title as orgTitle,
      p.description,
      p.level,
      p.data_scope as dataScope,
      p.status,
      p.create_time as createTime
    FROM t_positions p
    LEFT JOIN t_departments o ON p.oid = o.sid AND o.deleted = 0
    ${whereClause}
    ORDER BY p.create_time DESC
    LIMIT ${pageSizeNum} OFFSET ${offset}`,
    params,
  );

  // 构建 organization 对象
  const items = rows.map((row) => ({
    ...row,
    organization: row.orgName ? {
      name: row.orgName,
      title: row.orgTitle,
    } : undefined,
  }));

  return {
    items,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
  };
}

/**
 * 根据ID获取岗位
 */
export async function getPositionById(id: string): Promise<Position | null> {
  const rows = await query<Position[]>(
    `SELECT
      p.sid as id,
      p.name,
      p.e_name as eName,
      p.title,
      p.code,
      p.type,
      p.oid,
      o.name as orgName,
      o.title as orgTitle,
      p.description,
      p.data_scope as dataScope,
      p.status,
      p.create_time as createTime
    FROM t_positions p
    LEFT JOIN t_departments o ON p.oid = o.sid AND o.deleted = 0
    WHERE p.sid = ? AND p.deleted = 0`,
    [id],
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    ...row,
    organization: row.orgName ? {
      name: row.orgName,
      title: row.orgTitle,
    } : undefined,
  };
}

/**
 * 检查岗位编码是否存在（同组织下唯一）
 */
export async function isPositionCodeExists(code: string, oid: string, excludeId?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_positions WHERE code = ? AND oid = ? AND deleted = 0";
  const params: any[] = [code, oid];

  if (excludeId) {
    sql += " AND sid != ?";
    params.push(excludeId);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 检查岗位是否有关联员工
 */
export async function hasAssociatedEmployees(positionId: string): Promise<boolean> {
  const result = await query<[{ count: number }]>(
    "SELECT COUNT(*) as count FROM t_employees WHERE position_id = ? AND deleted = 0",
    [positionId],
  );
  return result[0].count > 0;
}

/**
 * 创建岗位
 */
export async function createPosition(data: CreatePositionDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_positions (
      sid, name, e_name, title, code, type, oid, level, description, data_scope,
      status, deleted, create_time, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.eName || null,
      data.title || null,
      data.code,
      data.type || null,
      data.oid,
      data.level || null,
      data.description || null,
      data.dataScope || "self",
      data.status ?? "enabled",
    ],
  );

  // 同步翻译
  if (data.title && data.eName) {
    try {
      syncTranslation(data.title, {
        zh: data.name,
        en: data.eName.charAt(0).toUpperCase() + data.eName.slice(1),
      });
    } catch (error) {
      console.error('[createPosition] Failed to sync translation:', error);
    }
  }

  return sid;
}

/**
 * 更新岗位
 */
export async function updatePosition(id: string, data: UpdatePositionDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.eName !== undefined) {
    updates.push("e_name = ?");
    params.push(data.eName || null);
  }
  if (data.title !== undefined) {
    updates.push("title = ?");
    params.push(data.title || null);
  }
  if (data.code !== undefined) {
    updates.push("code = ?");
    params.push(data.code);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type || null);
  }
  if (data.oid !== undefined) {
    updates.push("oid = ?");
    params.push(data.oid);
  }
  if (data.level !== undefined) {
    updates.push("level = ?");
    params.push(data.level || null);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }
  if (data.dataScope !== undefined) {
    updates.push("data_scope = ?");
    params.push(data.dataScope);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }

  if (updates.length === 0) return;

  // 获取原始数据用于翻译同步
  const original = await query<Position[]>(
    "SELECT name, e_name, title FROM t_positions WHERE sid = ? AND deleted = 0",
    [id]
  );

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(`UPDATE t_positions SET ${updates.join(", ")} WHERE sid = ?`, params);

  // 同步翻译
  if (original.length > 0) {
    const name = data.name !== undefined ? data.name : original[0].name;
    const eName = data.eName !== undefined ? data.eName : original[0].eName;
    const title = data.title !== undefined ? data.title : original[0].title;

    if (title && eName) {
      try {
        syncTranslation(title, {
          zh: name,
          en: eName.charAt(0).toUpperCase() + eName.slice(1),
        });
      } catch (error) {
        console.error('[updatePosition] Failed to sync translation:', error);
      }
    }
  }
}

/**
 * 删除岗位（逻辑删除）
 */
export async function deletePosition(id: string): Promise<void> {
  await run("UPDATE t_positions SET deleted = 1, timestamp = NOW() WHERE sid = ?", [id]);
}

/**
 * 获取指定组织的岗位列表（不分页，用于下拉选择）
 */
export async function getPositionsByOrgId(orgId: string): Promise<Position[]> {
  const rows = await query<Position[]>(
    `SELECT
      p.sid as id,
      p.name,
      p.e_name as eName,
      p.title,
      p.code,
      p.oid,
      o.name as orgName,
      o.title as orgTitle,
      p.description,
      p.level,
      p.data_scope as dataScope,
      p.status,
      p.create_time as createTime
    FROM t_positions p
    LEFT JOIN t_departments o ON p.oid = o.sid AND o.deleted = 0
    WHERE p.oid = ? AND p.deleted = 0 AND p.status = 'enabled'
    ORDER BY p.create_time DESC`,
    [orgId],
  );

  return rows.map((row) => ({
    ...row,
    organization: row.orgName ? {
      name: row.orgName,
      title: row.orgTitle,
    } : undefined,
  }));
}

/**
 * 获取岗位关联的技能列表
 */
export async function getPositionSkills(positionId: string): Promise<import("./types.js").PositionSkill[]> {
  const rows = await query<
    Array<{
      skill_id: string;
      skill_name: string;
      skill_slug: string;
      config: string | null;
      invocation: string;
      priority: number;
    }>
  >(
    `SELECT 
      ps.skill_id,
      s.name as skill_name,
      s.slug as skill_slug,
      ps.config,
      ps.invocation,
      ps.priority
    FROM r_position_skills ps
    INNER JOIN t_skills s ON ps.skill_id = s.sid
    WHERE ps.position_id = ? AND s.deleted = 0 AND s.status = 'enabled'
    ORDER BY ps.priority DESC, ps.create_time ASC`,
    [positionId],
  );

  return rows.map((row) => ({
    skillId: row.skill_id,
    skillName: row.skill_name,
    skillSlug: row.skill_slug,
    config: row.config ? JSON.parse(row.config) : undefined,
    invocation: row.invocation as "auto" | "user_only" | "disabled",
    priority: row.priority,
  }));
}

/**
 * 保存岗位关联的技能
 */
export async function savePositionSkills(
  positionId: string,
  skills: import("./types.js").PositionSkill[],
): Promise<void> {
  // 先删除现有的技能关联
  await run("DELETE FROM r_position_skills WHERE position_id = ?", [positionId]);

  // 插入新的技能关联
  if (skills && skills.length > 0) {
    for (const skill of skills) {
      await run(
        `INSERT INTO r_position_skills 
         (position_id, skill_id, config, invocation, priority, create_time) 
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          positionId,
          skill.skillId,
          skill.config ? JSON.stringify(skill.config) : null,
          skill.invocation || "auto",
          skill.priority ?? 0,
        ],
      );
    }
  }
}
