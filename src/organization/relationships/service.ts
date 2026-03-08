/**
 * Agent-Contact 关系管理服务
 * 对应设计文档: design/memory/database/t_relationship.md
 */

import { query, run } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import type {
  Relationship,
  BindAgentContactDto,
  BindAgentEmployeeDto,
  AgentContactBinding,
  MemoryContactInfo,
  RelationshipQuery,
  UpdateRelationshipDto,
} from "./types.js";
import type { Contact, CreateContactDto } from "../contact/types.js";
import { createContact, getContactById } from "../contact/service.js";
import { getEmployeeById } from "../employees/service.js";

const TABLE_NAME = "t_relationship";
const CONTACT_TABLE = "t_contacts";

/**
 * 获取 Agent 绑定的联系人列表（包含员工信息）
 */
export async function getAgentContacts(agentId: string): Promise<AgentContactBinding[]> {
  const sql = `
    SELECT
      r.sid,
      r.agent_id as agentId,
      r.contact_id as contactId,
      c.source_id as employeeId,
      c.profile,
      r.create_time as createTime
    FROM ${TABLE_NAME} r
    INNER JOIN ${CONTACT_TABLE} c ON r.contact_id = c.sid
    WHERE r.agent_id = ?
      AND r.deleted = 0
      AND c.deleted = 0
      AND c.type = 'employee'
    ORDER BY r.create_time DESC
  `;

  const rows = await query<any[]>(sql, [agentId]);

  // 获取员工详细信息
  const bindings: AgentContactBinding[] = [];
  for (const row of rows) {
    const binding: AgentContactBinding = {
      sid: row.sid,
      agentId: row.agentId,
      contactId: row.contactId,
      employeeId: row.employeeId,
      createTime: row.createTime,
    };

    // 解析 profile 获取部门信息
    if (row.profile) {
      try {
        const profile = typeof row.profile === "string" ? JSON.parse(row.profile) : row.profile;
        binding.departmentId = profile?.department;
        binding.departmentName = profile?.departmentName;
      } catch {
        // 忽略解析错误
      }
    }

    // 获取员工信息
    if (row.employeeId) {
      try {
        const employee = await getEmployeeById(row.employeeId);
        if (employee) {
          binding.employeeName = employee.name;
          binding.employeeNo = employee.employeeNo;
        }
      } catch {
        // 忽略查询错误
      }
    }

    bindings.push(binding);
  }

  return bindings;
}

/**
 * 获取 Agent 的记忆联系人列表（用于记忆管理 Tab）
 * 查询所有与当前 Agent 有对话关系的 contact，并关联员工和部门信息
 */
export async function getAgentMemoryContacts(agentId: string): Promise<MemoryContactInfo[]> {
  const sql = `
    SELECT
      r.sid,
      r.agent_id as agentId,
      r.contact_id as contactId,
      c.type as contactType,
      c.source_id as employeeId,
      c.profile as contactProfile,
      r.short_term_memory as shortTermMemory,
      r.create_time as createTime,
      r.update_time as updateTime
    FROM ${TABLE_NAME} r
    INNER JOIN ${CONTACT_TABLE} c ON r.contact_id = c.sid
    WHERE r.agent_id = ?
      AND r.deleted = 0
      AND c.deleted = 0
    ORDER BY r.update_time DESC, r.create_time DESC
  `;

  const rows = await query<any[]>(sql, [agentId]);

  // 获取详细联系人信息
  const contacts: MemoryContactInfo[] = [];
  for (const row of rows) {
    const contact: MemoryContactInfo = {
      sid: row.sid,
      agentId: row.agentId,
      contactId: row.contactId,
      contactType: row.contactType,
      employeeId: row.employeeId,
      createTime: row.createTime,
      lastInteractionTime: row.updateTime,
      hasShortTermMemory: !!row.shortTermMemory && row.shortTermMemory !== '[]',
    };

    // 解析 contact profile 获取名称和部门信息
    if (row.contactProfile) {
      try {
        const profile = typeof row.contactProfile === 'string' ? JSON.parse(row.contactProfile) : row.contactProfile;
        // 从 profile.facts.basic.name 获取联系人名称
        contact.contactName = profile?.facts?.basic?.name || profile?.name;
        contact.departmentId = profile?.department;
        contact.companyId = profile?.company;
      } catch {
        // 忽略解析错误
      }
    }

    // 如果是员工类型，获取员工详细信息
    if (row.contactType === 'employee' && row.employeeId) {
      try {
        const employee = await getEmployeeById(row.employeeId);
        if (employee) {
          // 如果 contactName 为空，使用员工姓名
          if (!contact.contactName) {
            contact.contactName = employee.name;
          }
          // 获取部门ID
          if (employee.oid) {
            contact.departmentId = employee.oid;
          }
        }
      } catch {
        // 忽略查询错误
      }
    }

    // 获取部门名称
    if (contact.departmentId) {
      try {
        const deptSql = `SELECT title FROM t_departments WHERE sid = ? AND deleted = 0`;
        const deptRows = await query<Array<{ title: string }>>(deptSql, [contact.departmentId]);
        if (deptRows.length > 0) {
          contact.departmentName = deptRows[0].title;
        }
      } catch {
        // 忽略查询错误
      }
    }

    contacts.push(contact);
  }

  return contacts;
}

/**
 * 绑定 Agent 到 Contact
 * 保存时先读取现有数据，合并后再更新，避免覆盖其他字段
 */
export async function bindAgentContact(data: BindAgentContactDto): Promise<string> {
  // 检查是否已存在有效关系
  const checkActiveSql = `
    SELECT sid, agent_contact FROM ${TABLE_NAME}
    WHERE agent_id = ? AND contact_id = ? AND deleted = 0
  `;
  const existingActive = await query<any[]>(checkActiveSql, [data.agentId, data.contactId]);

  if (existingActive.length > 0) {
    throw new Error("该联系人已绑定到此Agent");
  }

  // 检查是否已存在被删除的关系（需要恢复）
  const checkDeletedSql = `
    SELECT sid, agent_contact FROM ${TABLE_NAME}
    WHERE agent_id = ? AND contact_id = ? AND deleted = 1
  `;
  const existingDeleted = await query<any[]>(checkDeletedSql, [data.agentId, data.contactId]);

  if (existingDeleted.length > 0) {
    // 恢复已删除的关系，并合并 agent_contact 数据
    const sid = existingDeleted[0].sid;

    // 读取现有的 agent_contact 数据（如果有）
    let existingAgentContact: Record<string, any> = {};
    if (existingDeleted[0].agent_contact) {
      try {
        existingAgentContact = typeof existingDeleted[0].agent_contact === "string"
          ? JSON.parse(existingDeleted[0].agent_contact)
          : existingDeleted[0].agent_contact;
      } catch {
        // 解析失败则使用空对象
      }
    }

    // 合并数据：保留现有数据，只更新 owner 字段
    const mergedAgentContact = JSON.stringify({
      ...existingAgentContact,
      owner: true,
    });

    const restoreSql = `
      UPDATE ${TABLE_NAME}
      SET deleted = 0, agent_contact = ?, update_time = NOW()
      WHERE sid = ?
    `;
    await run(restoreSql, [mergedAgentContact, sid]);
    return sid;
  }

  // 创建新关系
  const sid = generateUUID();
  const sql = `
    INSERT INTO ${TABLE_NAME} (sid, agent_id, contact_id, contact_agent, agent_contact)
    VALUES (?, ?, ?, ?, ?)
  `;

  const contactAgent = JSON.stringify({
    intimacy: 50,
    trust: 50,
  });

  // 使用 owner: true 表示这是 Owner 关系
  const agentContact = JSON.stringify({
    owner: true,
  });

  await run(sql, [
    sid,
    data.agentId,
    data.contactId,
    contactAgent,
    agentContact,
  ]);

  return sid;
}

/**
 * 绑定 Agent 到员工（自动创建 Contact 和 Relationship）
 */
export async function bindAgentToEmployee(data: BindAgentEmployeeDto): Promise<AgentContactBinding> {
  // 1. 获取员工信息
  const employee = await getEmployeeById(data.employeeId);
  if (!employee) {
    throw new Error("员工不存在");
  }

  // 2. 检查是否已存在该员工的 Contact
  const checkContactSql = `
    SELECT sid FROM ${CONTACT_TABLE}
    WHERE type = 'employee' AND source_id = ? AND deleted = 0
  `;
  const existingContacts = await query<any[]>(checkContactSql, [data.employeeId]);

  let contactId: string;

  if (existingContacts.length > 0) {
    // 使用已存在的 Contact
    contactId = existingContacts[0].sid;
  } else {
    // 创建新的 Contact
    const contactData: CreateContactDto = {
      type: "employee",
      sourceId: data.employeeId,
      profile: {
        department: data.oid || employee.oid,
        departmentName: employee.orgTitle,
        position: employee.positionTitle,
        employeeNo: employee.employeeNo,
      },
      status: "enabled",
    };
    contactId = await createContact(contactData);
  }

  // 3. 创建 Relationship
  await bindAgentContact({
    agentId: data.agentId,
    contactId,
  });

  // 4. 返回绑定结果
  const binding: AgentContactBinding = {
    sid: "", // 将在查询中填充
    agentId: data.agentId,
    contactId,
    employeeId: data.employeeId,
    employeeName: employee.name,
    employeeNo: employee.employeeNo,
    departmentId: data.oid || employee.oid,
    departmentName: employee.orgTitle,
    createTime: new Date().toISOString(),
  };

  return binding;
}

/**
 * 解绑 Agent 和 Contact
 */
export async function unbindAgentContact(agentId: string, contactId: string): Promise<void> {
  const sql = `
    UPDATE ${TABLE_NAME}
    SET deleted = 1
    WHERE agent_id = ? AND contact_id = ? AND deleted = 0
  `;

  const result = await run(sql, [agentId, contactId]);

  if (result.affectedRows === 0) {
    throw new Error("绑定关系不存在");
  }
}

/**
 * 获取关系列表
 */
export async function getRelationshipList(
  queryParams: RelationshipQuery,
): Promise<{ items: Relationship[]; total: number }> {
  const { agentId, contactId, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE deleted = 0";
  const params: any[] = [];

  if (agentId) {
    whereClause += " AND agent_id = ?";
    params.push(agentId);
  }

  if (contactId) {
    whereClause += " AND contact_id = ?";
    params.push(contactId);
  }

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM ${TABLE_NAME} ${whereClause}`;
  const countResult = await query<[{ total: number }]>(countSql, params);
  const total = countResult[0].total;

  // 查询列表
  const sql = `
    SELECT
      sid,
      agent_id as agentId,
      contact_id as contactId,
      contact_agent as contactAgent,
      agent_contact as agentContact,
      create_time as createTime,
      update_time as updateTime
    FROM ${TABLE_NAME}
    ${whereClause}
    ORDER BY create_time DESC
    LIMIT ? OFFSET ?
  `;

  const rows = await query<any[]>(sql, [...params, pageSize, (page - 1) * pageSize]);

  const items = rows.map((row) => ({
    ...row,
    contactAgent: row.contactAgent ? JSON.parse(row.contactAgent) : undefined,
    agentContact: row.agentContact ? JSON.parse(row.agentContact) : undefined,
  }));

  return { items, total };
}

/**
 * 更新关系
 */
export async function updateRelationship(
  sid: string,
  data: UpdateRelationshipDto,
): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.contactAgent !== undefined) {
    updates.push("contact_agent = ?");
    params.push(JSON.stringify(data.contactAgent));
  }

  if (data.agentContact !== undefined) {
    updates.push("agent_contact = ?");
    params.push(JSON.stringify(data.agentContact));
  }

  if (updates.length === 0) {
    return;
  }

  const sql = `
    UPDATE ${TABLE_NAME}
    SET ${updates.join(", ")}
    WHERE sid = ? AND deleted = 0
  `;

  params.push(sid);

  const result = await run(sql, params);

  if (result.affectedRows === 0) {
    throw new Error("关系不存在");
  }
}

/**
 * 删除关系（软删除）
 */
export async function deleteRelationship(sid: string): Promise<void> {
  const sql = `
    UPDATE ${TABLE_NAME}
    SET deleted = 1
    WHERE sid = ? AND deleted = 0
  `;

  const result = await run(sql, [sid]);

  if (result.affectedRows === 0) {
    throw new Error("关系不存在");
  }
}

/**
 * 获取短期记忆（对话历史）
 * @param agentId Agent ID
 * @param contactId Contact ID
 */
export async function getShortTermMemory(
  agentId: string,
  contactId: string,
): Promise<any[]> {
  const sql = `
    SELECT short_term_memory
    FROM ${TABLE_NAME}
    WHERE agent_id = ? AND contact_id = ? AND deleted = 0
  `;

  const rows = await query<Array<{ short_term_memory: string | null }>>(sql, [
    agentId,
    contactId,
  ]);

  if (!rows || rows.length === 0 || !rows[0].short_term_memory) {
    return [];
  }

  try {
    const memory = JSON.parse(rows[0].short_term_memory);
    return memory.entries || [];
  } catch {
    return [];
  }
}

/**
 * 更新短期记忆（对话历史）
 * @param agentId Agent ID
 * @param contactId Contact ID
 * @param entries 记忆条目列表（精简格式）
 */
export async function updateShortTermMemory(
  agentId: string,
  contactId: string,
  entries: any[],
): Promise<void> {
  // 先检查 relationship 是否存在
  const checkSql = `
    SELECT sid FROM ${TABLE_NAME}
    WHERE agent_id = ? AND contact_id = ? AND deleted = 0
  `;
  const existing = await query<Array<{ sid: string }>>(checkSql, [agentId, contactId]);

  // 精简格式：只保留 entries 数组
  const memory = {
    entries,
  };

  if (!existing || existing.length === 0) {
    // 创建新的 relationship 记录
    const sid = generateUUID();
    const insertSql = `
      INSERT INTO ${TABLE_NAME} (sid, agent_id, contact_id, short_term_memory, contact_agent, agent_contact)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await run(insertSql, [
      sid,
      agentId,
      contactId,
      JSON.stringify(memory),
      JSON.stringify({ intimacy: 50, trust: 50 }),
      JSON.stringify({ intimacy: 50, trust: 50 }),
    ]);
  } else {
    // 更新现有记录
    const updateSql = `
      UPDATE ${TABLE_NAME}
      SET short_term_memory = ?, update_time = NOW()
      WHERE agent_id = ? AND contact_id = ? AND deleted = 0
    `;
    await run(updateSql, [JSON.stringify(memory), agentId, contactId]);
  }
}
