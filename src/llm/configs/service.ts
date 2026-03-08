/**
 * LLM配置管理服务层
 */

import type {
  LlmConfig,
  CreateConfigDto,
  UpdateConfigDto,
  ConfigQuery,
  ConfigListResult,
  ModelParameters,
} from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";

// 数据库行类型
interface ConfigRow {
  sid: string;
  name: string;
  description: string | null;
  provider_id: string;
  base_url: string;
  subscribe_type: string;
  icon: string | null;
  model_name: string;
  model_type: string;
  context_size: number;
  parameters: string | null;
  enable_thinking: string;
  stream: string;
  auth_method: string;
  provider_name: string | null;
  model_ability: string | null;
  timeout: number;
  retries: number;
  sort: number;
  status: string;
  create_time: Date;
  deleted: number;
}

// 转换数据库行到 LlmConfig
function rowToConfig(row: ConfigRow): LlmConfig {
  // mysql2 会自动解析 JSON 字段为对象，所以不需要 JSON.parse
  let parameters: ModelParameters | undefined;
  if (row.parameters) {
    if (typeof row.parameters === 'string') {
      try {
        parameters = JSON.parse(row.parameters) as ModelParameters;
      } catch {
        parameters = undefined;
      }
    } else {
      parameters = row.parameters as unknown as ModelParameters;
    }
  }

  // 解析 model_ability JSON 数组
  let modelAbility: string[] | undefined;
  if (row.model_ability) {
    if (typeof row.model_ability === 'string') {
      try {
        modelAbility = JSON.parse(row.model_ability) as string[];
      } catch {
        modelAbility = undefined;
      }
    } else {
      modelAbility = row.model_ability as unknown as string[];
    }
  }

  return {
    sid: row.sid,
    name: row.name,
    description: row.description || undefined,
    providerId: row.provider_id,
    baseUrl: row.base_url,
    subscribeType: row.subscribe_type,
    icon: row.icon || undefined,
    modelName: row.model_name,
    modelType: row.model_type,
    contextSize: row.context_size,
    parameters,
    enableThinking: row.enable_thinking,
    stream: row.stream,
    authMethod: row.auth_method,
    providerName: row.provider_name || undefined,
    modelAbility,
    timeout: row.timeout,
    retries: row.retries,
    sort: row.sort,
    status: row.status,
    createTime: row.create_time,
    deleted: row.deleted,
  };
}

/**
 * 获取配置列表
 */
export async function getConfigList(queryParams: ConfigQuery): Promise<ConfigListResult> {
  const { providerId, status, keyword, page, pageSize } = queryParams;

  let sql = `SELECT * FROM t_llm_configs WHERE deleted = 0`;
  const params: any[] = [];

  if (providerId) {
    sql += ` AND provider_id = ?`;
    params.push(providerId);
  }

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR description LIKE ? OR model_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  // 分页
  if (page && pageSize) {
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * sizeNum;
    sql += ` LIMIT ${sizeNum} OFFSET ${offset}`;
  }

  const rows = await query<ConfigRow[]>(sql, params);
  const list = rows.map(rowToConfig);

  return { list, total: await getConfigCount(queryParams) };
}

/**
 * 获取所有配置（不分页）
 * 当 provider_name 为空时，使用关联的提供商 name 作为备选
 */
export async function getAllConfigs(providerId?: string): Promise<LlmConfig[]> {
  let sql = `
    SELECT 
      c.*,
      COALESCE(c.provider_name, p.name) as provider_name
    FROM t_llm_configs c
    LEFT JOIN t_llm_providers p ON c.provider_id = p.sid
    WHERE c.deleted = 0
  `;
  const params: any[] = [];

  if (providerId) {
    sql += ` AND c.provider_id = ?`;
    params.push(providerId);
  }

  sql += ` ORDER BY c.sort ASC, c.create_time DESC`;

  const rows = await query<ConfigRow[]>(sql, params);
  return rows.map(rowToConfig);
}

/**
 * 根据ID获取配置
 */
export async function getConfigById(id: string): Promise<LlmConfig | null> {
  const rows = await query<ConfigRow[]>(
    `SELECT * FROM t_llm_configs WHERE sid = ? AND deleted = 0`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToConfig(rows[0]);
}

/**
 * 检查配置名称是否存在
 */
export async function isConfigNameExists(
  name: string,
  providerId: string,
  excludeId?: string
): Promise<boolean> {
  let sql = `SELECT sid FROM t_llm_configs WHERE name = ? AND provider_id = ? AND deleted = 0`;
  const params: any[] = [name, providerId];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建配置
 */
export async function createConfig(data: CreateConfigDto): Promise<string> {
  const sid = generateUUID();

  await run(
    `INSERT INTO t_llm_configs
     (sid, name, description, provider_id, base_url, subscribe_type, icon,
      model_name, model_type, context_size, parameters, enable_thinking, stream, auth_method,
      provider_name, model_ability, timeout, retries, sort, status, deleted, create_time, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      sid,
      data.name,
      data.description || null,
      data.providerId,
      data.baseUrl,
      data.subscribeType ?? "usage",
      data.icon || null,
      data.modelName,
      data.modelType ?? "text",
      data.contextSize ?? 8192,
      data.parameters ? JSON.stringify(data.parameters) : null,
      data.enableThinking ?? "disabled",
      data.stream ?? "enabled",
      data.authMethod ?? "api_key",
      data.providerName || null,
      data.modelAbility ? JSON.stringify(data.modelAbility) : null,
      data.timeout ?? 30000,
      data.retries ?? 3,
      data.sort ?? 0,
      data.status ?? "enabled",
      0, // deleted
    ]
  );

  return sid;
}

/**
 * 更新配置
 */
export async function updateConfig(id: string, data: UpdateConfigDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description);
  }
  if (data.providerId !== undefined) {
    updates.push("provider_id = ?");
    params.push(data.providerId);
  }
  if (data.baseUrl !== undefined) {
    updates.push("base_url = ?");
    params.push(data.baseUrl);
  }
  if (data.subscribeType !== undefined) {
    updates.push("subscribe_type = ?");
    params.push(data.subscribeType);
  }
  if (data.icon !== undefined) {
    updates.push("icon = ?");
    params.push(data.icon);
  }
  if (data.modelName !== undefined) {
    updates.push("model_name = ?");
    params.push(data.modelName);
  }
  if (data.modelType !== undefined) {
    updates.push("model_type = ?");
    params.push(data.modelType);
  }
  if (data.contextSize !== undefined) {
    updates.push("context_size = ?");
    params.push(data.contextSize);
  }
  if (data.parameters !== undefined) {
    updates.push("parameters = ?");
    params.push(data.parameters ? JSON.stringify(data.parameters) : null);
  }
  if (data.enableThinking !== undefined) {
    updates.push("enable_thinking = ?");
    params.push(data.enableThinking);
  }
  if (data.stream !== undefined) {
    updates.push("stream = ?");
    params.push(data.stream);
  }
  if (data.authMethod !== undefined) {
    updates.push("auth_method = ?");
    params.push(data.authMethod);
  }
  if (data.providerName !== undefined) {
    updates.push("provider_name = ?");
    params.push(data.providerName);
  }
  if (data.modelAbility !== undefined) {
    updates.push("model_ability = ?");
    params.push(data.modelAbility ? JSON.stringify(data.modelAbility) : null);
  }
  if (data.timeout !== undefined) {
    updates.push("timeout = ?");
    params.push(data.timeout);
  }
  if (data.retries !== undefined) {
    updates.push("retries = ?");
    params.push(data.retries);
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
    throw new Error("没有需要更新的字段");
  }

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(`UPDATE t_llm_configs SET ${updates.join(", ")} WHERE sid = ?`, params);
}

/**
 * 删除配置
 */
export async function deleteConfig(id: string): Promise<void> {
  await run(`UPDATE t_llm_configs SET deleted = 1, timestamp = NOW() WHERE sid = ?`, [id]);
}

/**
 * 获取配置总数
 */
export async function getConfigCount(queryParams: ConfigQuery): Promise<number> {
  const { providerId, status, keyword } = queryParams;

  let sql = `SELECT COUNT(*) as count FROM t_llm_configs WHERE deleted = 0`;
  const params: any[] = [];

  if (providerId) {
    sql += ` AND provider_id = ?`;
    params.push(providerId);
  }

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR description LIKE ? OR model_name LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }

  const rows = await query<{ count: number }[]>(sql, params);
  return rows[0]?.count || 0;
}

/**
 * 获取提供商的配置数量
 */
export async function getConfigCountByProvider(providerId: string): Promise<number> {
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM t_llm_configs WHERE provider_id = ? AND deleted = 0`,
    [providerId]
  );
  return rows[0]?.count || 0;
}
