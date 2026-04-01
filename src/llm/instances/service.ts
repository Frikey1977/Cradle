/**
 * LLM实例管理服务层
 * 对应表: t_llm_instances
 */

import type {
  LlmInstance,
  CreateInstanceDto,
  UpdateInstanceDto,
  InstanceQuery,
  InstanceListResult,
  CustomHeaders,
} from "./types.js";
import { generateUUID } from "../../shared/utils.js";
import { query, run } from "../../store/database.js";
import crypto from "crypto";

// 数据库行类型
interface InstanceRow {
  sid: string;
  name: string;
  description: string | null;
  provider_name: string;
  config_id: string;
  api_key: string;
  api_key_hash: string;
  headers: string | CustomHeaders | null;
  billing_type: string;
  weight: number;
  daily_quota: number | null;
  daily_used: number;
  fail_count: number;
  cooldown_until: Date | null;
  last_used_at: Date | null;
  sort: number;
  create_time: Date;
  deleted: number;
  status: string;
}

/**
 * 生成API Key的哈希值
 */
function generateApiKeyHash(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

/**
 * 加密API Key（简单加密，实际项目中应使用更安全的加密方式）
 */
function encryptApiKey(apiKey: string): string {
  // 这里使用简单的base64编码，实际项目中应使用AES等加密算法
  return Buffer.from(apiKey).toString("base64");
}

/**
 * 解密API Key
 */
function decryptApiKey(encryptedApiKey: string): string {
  return Buffer.from(encryptedApiKey, "base64").toString("utf-8");
}

/**
 * 转换数据库行到 LlmInstance
 */
function rowToInstance(row: InstanceRow): LlmInstance {
  // 解析 headers JSON
  let headers: CustomHeaders | undefined;
  if (row.headers) {
    if (typeof row.headers === "string") {
      try {
        headers = JSON.parse(row.headers) as CustomHeaders;
      } catch {
        headers = undefined;
      }
    } else {
      headers = row.headers as CustomHeaders;
    }
  }

  return {
    sid: row.sid,
    name: row.name,
    description: row.description || undefined,
    providerName: row.provider_name,
    configId: row.config_id,
    apiKey: decryptApiKey(row.api_key),
    apiKeyHash: row.api_key_hash,
    headers,
    billingType: row.billing_type as any,
    weight: row.weight,
    dailyQuota: row.daily_quota || undefined,
    dailyUsed: row.daily_used,
    failCount: row.fail_count,
    cooldownUntil: row.cooldown_until || undefined,
    lastUsedAt: row.last_used_at || undefined,
    sort: row.sort,
    createTime: row.create_time,
    deleted: row.deleted,
    status: row.status as any,
  };
}

/**
 * 获取实例列表
 */
export async function getInstanceList(queryParams: InstanceQuery): Promise<InstanceListResult> {
  const { configId, status, billingType, keyword, page, pageSize } = queryParams;

  let sql = `SELECT * FROM t_llm_instances WHERE deleted = 0`;
  const params: any[] = [];

  if (configId) {
    sql += ` AND config_id = ?`;
    params.push(configId);
  }

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (billingType !== undefined && billingType !== "") {
    sql += ` AND billing_type = ?`;
    params.push(billingType);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  // 分页
  if (page && pageSize) {
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 20;
    const offset = (pageNum - 1) * sizeNum;
    sql += ` LIMIT ${sizeNum} OFFSET ${offset}`;
  }

  const rows = await query<InstanceRow[]>(sql, params);
  const list = rows.map(rowToInstance);

  return { list, total: await getInstanceCount(queryParams) };
}

/**
 * 获取所有实例（不分页）
 */
export async function getAllInstances(configId?: string): Promise<LlmInstance[]> {
  let sql = `SELECT * FROM t_llm_instances WHERE deleted = 0`;
  const params: any[] = [];

  if (configId) {
    sql += ` AND config_id = ?`;
    params.push(configId);
  }

  sql += ` ORDER BY sort ASC, create_time DESC`;

  const rows = await query<InstanceRow[]>(sql, params);
  return rows.map(rowToInstance);
}

/**
 * 根据ID获取实例
 */
export async function getInstanceById(id: string): Promise<LlmInstance | null> {
  const rows = await query<InstanceRow[]>(
    `SELECT * FROM t_llm_instances WHERE sid = ? AND deleted = 0`,
    [id]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToInstance(rows[0]);
}

/**
 * 检查实例名称是否存在
 */
export async function isInstanceNameExists(
  name: string,
  configId: string,
  excludeId?: string
): Promise<boolean> {
  let sql = `SELECT sid FROM t_llm_instances WHERE name = ? AND config_id = ? AND deleted = 0`;
  const params: any[] = [name, configId];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 检查API Key哈希是否存在于同一配置下
 */
export async function isApiKeyHashExists(
  apiKey: string,
  configId: string,
  excludeId?: string
): Promise<boolean> {
  const apiKeyHash = generateApiKeyHash(apiKey);
  let sql = `SELECT sid FROM t_llm_instances WHERE api_key_hash = ? AND config_id = ? AND deleted = 0`;
  const params: any[] = [apiKeyHash, configId];

  if (excludeId) {
    sql += ` AND sid != ?`;
    params.push(excludeId);
  }

  const rows = await query<{ sid: string }[]>(sql, params);
  return rows.length > 0;
}

/**
 * 创建实例
 */
export async function createInstance(data: CreateInstanceDto): Promise<string> {
  const sid = generateUUID();
  const apiKeyHash = generateApiKeyHash(data.apiKey);
  const encryptedApiKey = encryptApiKey(data.apiKey);

  await run(
    `INSERT INTO t_llm_instances
     (sid, name, description, provider_name, config_id, api_key, api_key_hash, headers,
      billing_type, weight, daily_quota, daily_used,
      fail_count, cooldown_until, last_used_at, sort, create_time, deleted, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, NULL, ?, NOW(), 0, ?)`,
    [
      sid,
      data.name,
      data.description || null,
      data.providerName,
      data.configId,
      encryptedApiKey,
      apiKeyHash,
      data.headers ? JSON.stringify(data.headers) : null,
      data.billingType || "usage",
      data.weight ?? 1,
      data.dailyQuota || null,
      data.sort ?? 0,
      data.status || "enabled",
    ]
  );

  return sid;
}

/**
 * 更新实例
 */
export async function updateInstance(id: string, data: UpdateInstanceDto): Promise<void> {
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
  if (data.providerName !== undefined) {
    updates.push("provider_name = ?");
    params.push(data.providerName);
  }
  if (data.configId !== undefined) {
    updates.push("config_id = ?");
    params.push(data.configId);
  }
  if (data.apiKey !== undefined) {
    updates.push("api_key = ?");
    params.push(encryptApiKey(data.apiKey));
    updates.push("api_key_hash = ?");
    params.push(generateApiKeyHash(data.apiKey));
  }
  if (data.headers !== undefined) {
    updates.push("headers = ?");
    params.push(data.headers ? JSON.stringify(data.headers) : null);
  }
  if (data.billingType !== undefined) {
    updates.push("billing_type = ?");
    params.push(data.billingType);
  }
  if (data.weight !== undefined) {
    updates.push("weight = ?");
    params.push(data.weight);
  }
  if (data.dailyQuota !== undefined) {
    updates.push("daily_quota = ?");
    params.push(data.dailyQuota);
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

  await run(`UPDATE t_llm_instances SET ${updates.join(", ")} WHERE sid = ?`, params);
}

/**
 * 删除实例
 */
export async function deleteInstance(id: string): Promise<void> {
  await run(`UPDATE t_llm_instances SET deleted = 1, timestamp = NOW() WHERE sid = ?`, [id]);
}

/**
 * 获取实例总数
 */
export async function getInstanceCount(queryParams: InstanceQuery): Promise<number> {
  const { configId, status, billingType, keyword } = queryParams;

  let sql = `SELECT COUNT(*) as count FROM t_llm_instances WHERE deleted = 0`;
  const params: any[] = [];

  if (configId) {
    sql += ` AND config_id = ?`;
    params.push(configId);
  }

  if (status !== undefined && status !== "") {
    sql += ` AND status = ?`;
    params.push(status);
  }

  if (billingType !== undefined && billingType !== "") {
    sql += ` AND billing_type = ?`;
    params.push(billingType);
  }

  if (keyword) {
    sql += ` AND (name LIKE ? OR description LIKE ?)`;
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const rows = await query<{ count: number }[]>(sql, params);
  return rows[0]?.count || 0;
}

/**
 * 根据配置ID获取实例数量
 */
export async function getInstanceCountByConfig(configId: string): Promise<number> {
  const rows = await query<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM t_llm_instances WHERE config_id = ? AND deleted = 0`,
    [configId]
  );
  return rows[0]?.count || 0;
}

/**
 * 重置每日使用量
 */
export async function resetDailyUsed(): Promise<void> {
  await run(`UPDATE t_llm_instances SET daily_used = 0, timestamp = NOW()`);
}

/**
 * 增加失败次数
 */
export async function incrementFailCount(id: string): Promise<void> {
  await run(
    `UPDATE t_llm_instances SET fail_count = fail_count + 1, timestamp = NOW() WHERE sid = ?`,
    [id]
  );
}

/**
 * 重置失败次数
 */
export async function resetFailCount(id: string): Promise<void> {
  await run(
    `UPDATE t_llm_instances SET fail_count = 0, cooldown_until = NULL, timestamp = NOW() WHERE sid = ?`,
    [id]
  );
}

/**
 * 设置冷却时间
 */
export async function setCooldown(id: string, minutes: number): Promise<void> {
  const cooldownUntil = new Date(Date.now() + minutes * 60 * 1000);
  await run(
    `UPDATE t_llm_instances SET cooldown_until = ?, timestamp = NOW() WHERE sid = ?`,
    [cooldownUntil, id]
  );
}

/**
 * 更新最后使用时间
 */
export async function updateLastUsedAt(id: string): Promise<void> {
  await run(
    `UPDATE t_llm_instances SET last_used_at = NOW(), timestamp = NOW() WHERE sid = ?`,
    [id]
  );
}

/**
 * 增加每日使用量
 */
export async function incrementDailyUsed(id: string, tokens: number): Promise<void> {
  await run(
    `UPDATE t_llm_instances SET daily_used = daily_used + ?, timestamp = NOW() WHERE sid = ?`,
    [tokens, id]
  );
}

/**
 * 选择可用实例（按权重随机）
 */
export async function selectAvailableInstance(configId: string): Promise<LlmInstance | null> {
  const rows = await query<InstanceRow[]>(
    `SELECT * FROM t_llm_instances 
     WHERE config_id = ? 
       AND status = 'enabled'
       AND deleted = 0
       AND (cooldown_until IS NULL OR cooldown_until < NOW())
     ORDER BY weight DESC, RAND()
     LIMIT 1`,
    [configId]
  );

  if (rows.length === 0) {
    return null;
  }

  return rowToInstance(rows[0]);
}
