/**
 * 画像加载器 (ProfileLoader)
 *
 * 负责从数据库加载三类核心画像：
 * 1. 用户画像 (ContactProfile)
 * 2. Agent 画像 (AgentProfile)
 * 3. 关系画像 (RelationshipProfile)
 */

import type {
  ContactProfile,
  AgentProfile,
  RelationshipProfile,
  ScenarioProfile,
  ProfileCollection,
  ProfileLoadParams,
  CompanyInfo,
  DepartmentInfo,
  PositionInfo,
} from "../types/profile.js";
import type { ShortTermMemoryEntry } from "../memory/types.js";

// 数据库查询接口
interface DatabaseQuery {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
}

/**
 * 画像加载器
 */
export class ProfileLoader {
  private db: DatabaseQuery;

  constructor(db: DatabaseQuery) {
    this.db = db;
  }

  /**
   * 加载所有画像
   */
  async loadProfiles(params: ProfileLoadParams): Promise<ProfileCollection> {
    console.log(`[ProfileLoader] Loading profiles for agent=${params.agentId}, contact=${params.contactId}`);

    const [contact, agent, relationship, scenario] = await Promise.all([
      this.loadContactProfile(params.contactId),
      this.loadAgentProfile(params.agentId),
      this.loadRelationshipProfile(params.agentId, params.contactId),
      this.loadScenarioProfile(params),
    ]);

    console.log(`[ProfileLoader] Loaded: contact=${!!contact}, agent=${!!agent}, relationship=${!!relationship}, scenario=${!!scenario}`);

    return {
      contact,
      agent,
      relationship,
      scenario,
    };
  }

  /**
   * 加载用户画像
   * 从 t_contacts 读取，如果是员工则获取组织信息
   */
  async loadContactProfile(contactId: string): Promise<ContactProfile | undefined> {
    try {
      // 查询 contact 基本信息
      const contactRows = await this.db.query<
        {
          sid: string;
          type: string;
          source_id?: string;
          profile?: string;
        }[]
      >(
        `SELECT sid, type, source_id, profile 
         FROM t_contacts 
         WHERE sid = ? AND deleted = 0`,
        [contactId]
      );

      console.log(`[ProfileLoader] Contact query returned ${contactRows.length} rows for ${contactId}`);

      if (contactRows.length === 0) {
        console.warn(`[ProfileLoader] Contact not found: ${contactId}`);
        return undefined;
      }

      const contact = (contactRows[0] as unknown) as {
        sid: string;
        type: string;
        source_id?: string;
        profile?: string;
      };

      // 解析 profile JSON
      let profile: Record<string, any> = {};
      if (contact.profile) {
        try {
          profile = JSON.parse(contact.profile);
        } catch (e) {
          console.warn(`[ProfileLoader] Failed to parse contact profile: ${e}`);
        }
      }

      // 如果是员工，从员工表获取名字和组织信息
      let name = profile.facts?.basic?.name || profile.name || "未知用户";
      let organization: ContactProfile["organization"] = undefined;

      if (contact.type === "employee" && contact.source_id) {
        const orgInfo = await this.loadContactOrganization(contact.source_id);
        // 使用员工表的名字
        if (orgInfo.name) {
          name = orgInfo.name;
        }
        // 提取组织信息（去掉 name 字段）
        const { name: _, ...orgWithoutName } = orgInfo;
        organization = orgWithoutName;
      }

      const result: ContactProfile = {
        contactId: contact.sid,
        type: contact.type as "employee" | "customer" | "partner" | "visitor",
        sourceId: contact.source_id,
        name,
        profile,
        organization,
      };

      return result;
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load contact profile:`, error);
      return undefined;
    }
  }

  /**
   * 加载用户的组织信息
   */
  private async loadContactOrganization(employeeId: string): Promise<{
    name?: string;
    company?: CompanyInfo;
    department?: DepartmentInfo;
    position?: PositionInfo;
    location?: string;
  }> {
    try {
      // 获取员工信息
      const employeeRows = await this.db.query<
        {
          sid: string;
          name: string;
          oid?: string;
          position_id?: string;
          location?: string;
        }[]
      >(
        `SELECT sid, name, oid, position_id, location 
         FROM t_employees 
         WHERE sid = ? AND deleted = 0`,
        [employeeId]
      );

      if (employeeRows.length === 0) {
        return {};
      }

      const employee = (employeeRows[0] as unknown) as {
        sid: string;
        name: string;
        oid?: string;
        position_id?: string;
        location?: string;
      };
      const result: {
        name?: string;
        company?: CompanyInfo;
        department?: DepartmentInfo;
        position?: PositionInfo;
        location?: string;
      } = {
        name: employee.name,
        location: employee.location,
      };

      // 获取部门信息
      if (employee.oid) {
        result.department = await this.loadDepartmentInfo(employee.oid);
        // 获取公司信息（部门树根节点）
        if (result.department) {
          result.company = await this.loadCompanyInfo(result.department.path);
        }
      }

      // 获取岗位信息
      if (employee.position_id) {
        result.position = await this.loadPositionInfo(employee.position_id);
      }

      return result;
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load contact organization:`, error);
      return {};
    }
  }

  /**
   * 加载 Agent 画像
   * 从 t_agents 读取，同时获取 Agent 的组织信息
   */
  async loadAgentProfile(agentId: string): Promise<AgentProfile | undefined> {
    try {
      const agentRows = await this.db.query<
        {
          sid: string;
          name: string;
          e_name?: string;
          agent_no: string;
          profile?: string;
          soul?: string;
          oid?: string;
          position_id?: string;
        }[]
      >(
        `SELECT sid, name, e_name, agent_no, profile, soul, oid, position_id 
         FROM t_agents 
         WHERE sid = ? AND deleted = 0`,
        [agentId]
      );

      console.log(`[ProfileLoader] Agent query returned ${agentRows.length} rows for ${agentId}`);

      if (agentRows.length === 0) {
        console.warn(`[ProfileLoader] Agent not found: ${agentId}`);
        return undefined;
      }

      // 输出原始 profile 内容用于调试
      const rawProfile = (agentRows[0] as any).profile;
      console.log(`[ProfileLoader] Agent raw profile: ${rawProfile}`);

      const agent = (agentRows[0] as unknown) as {
        sid: string;
        name: string;
        e_name?: string;
        agent_no: string;
        profile?: string;
        soul?: string;
        oid?: string;
        position_id?: string;
      };

      // 解析 profile JSON
      let profile: Record<string, any> = {};
      if (agent.profile) {
        try {
          profile = JSON.parse(agent.profile);
        } catch (e) {
          // 如果解析失败，可能是存储格式错误（如 "[object Object]"）
          console.warn(`[ProfileLoader] Failed to parse agent profile: ${e}, raw value: ${agent.profile}`);
          // 尝试提取有效信息
          if (agent.profile === '[object Object]') {
            console.warn(`[ProfileLoader] Profile was stored as [object Object], using empty object`);
          }
        }
      }

      const result: AgentProfile = {
        agentId: agent.sid,
        name: agent.name,
        eName: agent.e_name,
        agentNo: agent.agent_no,
        soul: agent.soul,
        profile,
      };

      // 获取 Agent 的组织信息
      result.organization = await this.loadAgentOrganization(agent.oid, agent.position_id);

      console.log(`[ProfileLoader] AgentProfile loaded: name=${result.name}, agentNo=${result.agentNo}, hasProfile=${result.profile ? Object.keys(result.profile).length > 0 : false}, hasOrg=${!!result.organization}`);

      return result;
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load agent profile:`, error);
      return undefined;
    }
  }

  /**
   * 加载 Agent 的组织信息
   */
  private async loadAgentOrganization(
    departmentId?: string,
    positionId?: string
  ): Promise<{
    company?: CompanyInfo;
    department?: DepartmentInfo;
    position?: PositionInfo;
  }> {
    const result: {
      company?: CompanyInfo;
      department?: DepartmentInfo;
      position?: PositionInfo;
    } = {};

    try {
      // 获取部门信息
      if (departmentId) {
        result.department = await this.loadDepartmentInfo(departmentId);
        // 获取公司信息
        if (result.department) {
          result.company = await this.loadCompanyInfo(result.department.path);
        }
      }

      // 获取岗位信息
      if (positionId) {
        result.position = await this.loadPositionInfo(positionId);
      }

      return result;
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load agent organization:`, error);
      return result;
    }
  }

  /**
   * 加载部门信息
   */
  private async loadDepartmentInfo(departmentId: string): Promise<DepartmentInfo | undefined> {
    try {
      const deptRows = await this.db.query<
        {
          sid: string;
          name: string;
          e_name?: string;
          code: string;
          description?: string;
          culture?: string;
          type: string;
          parent_id?: string;
          path: string;
          leader_id?: string;
        }[]
      >(
        `SELECT sid, name, e_name, code, description, culture, type, parent_id, path, leader_id 
         FROM t_departments 
         WHERE sid = ? AND deleted = 0`,
        [departmentId]
      );

      if (deptRows.length === 0) {
        return undefined;
      }

      const dept = (deptRows[0] as unknown) as {
        sid: string;
        name: string;
        e_name?: string;
        code: string;
        description?: string;
        culture?: string;
        type: string;
        parent_id?: string;
        path: string;
        leader_id?: string;
      };
      return {
        departmentId: dept.sid,
        name: dept.name,
        eName: dept.e_name,
        code: dept.code,
        description: dept.description,
        culture: dept.culture,
        type: dept.type,
        parentId: dept.parent_id,
        path: dept.path,
        leaderId: dept.leader_id,
      };
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load department info:`, error);
      return undefined;
    }
  }

  /**
   * 加载公司信息（部门树根节点）
   */
  private async loadCompanyInfo(departmentPath: string): Promise<CompanyInfo | undefined> {
    try {
      // 从 path 获取根节点 ID
      const rootId = departmentPath.split("/")[0];
      if (!rootId) {
        return undefined;
      }

      const companyRows = await this.db.query<
        {
          sid: string;
          name: string;
          e_name?: string;
          code: string;
          description?: string;
          culture?: string;
          type: string;
        }[]
      >(
        `SELECT sid, name, e_name, code, description, culture, type 
         FROM t_departments 
         WHERE sid = ? AND deleted = 0`,
        [rootId]
      );

      if (companyRows.length === 0) {
        return undefined;
      }

      const company = (companyRows[0] as unknown) as {
        sid: string;
        name: string;
        e_name?: string;
        code: string;
        description?: string;
        culture?: string;
        type: string;
      };
      return {
        companyId: company.sid,
        name: company.name,
        eName: company.e_name,
        code: company.code,
        description: company.description,
        culture: company.culture,
        type: company.type,
      };
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load company info:`, error);
      return undefined;
    }
  }

  /**
   * 加载岗位信息
   */
  private async loadPositionInfo(positionId: string): Promise<PositionInfo | undefined> {
    try {
      const posRows = await this.db.query<
        {
          sid: string;
          name: string;
          e_name?: string;
          code: string;
          description?: string;
          level?: string;
          type?: string;
        }[]
      >(
        `SELECT sid, name, e_name, code, description, level, type 
         FROM t_positions 
         WHERE sid = ? AND deleted = 0`,
        [positionId]
      );

      if (posRows.length === 0) {
        return undefined;
      }

      const pos = (posRows[0] as unknown) as {
        sid: string;
        name: string;
        e_name?: string;
        code: string;
        description?: string;
        level?: string;
        type?: string;
      };
      return {
        positionId: pos.sid,
        name: pos.name,
        eName: pos.e_name,
        code: pos.code,
        description: pos.description,
        level: pos.level,
        type: pos.type,
      };
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load position info:`, error);
      return undefined;
    }
  }

  /**
   * 加载关系画像
   */
  async loadRelationshipProfile(
    agentId: string,
    contactId: string
  ): Promise<RelationshipProfile | undefined> {
    try {
      const relRows = await this.db.query<
        {
          sid: string;
          contact_agent?: string;
          agent_contact?: string;
          short_term_memory?: string;
        }[]
      >(
        `SELECT sid, contact_agent, agent_contact, short_term_memory 
         FROM t_relationship 
         WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
        [agentId, contactId]
      );

      if (relRows.length === 0) {
        return undefined;
      }

      const rel = (relRows[0] as unknown) as {
        sid: string;
        contact_agent?: string;
        agent_contact?: string;
        short_term_memory?: string;
      };

      // 解析 JSON
      let contactToAgent: Record<string, any> = {};
      let agentToContact: Record<string, any> = {};
      let shortTermMemory: ShortTermMemoryEntry[] = [];

      if (rel.contact_agent) {
        try {
          contactToAgent = JSON.parse(rel.contact_agent);
        } catch (e) {
          contactToAgent = { preference: rel.contact_agent };
        }
      }

      if (rel.agent_contact) {
        try {
          agentToContact = JSON.parse(rel.agent_contact);
        } catch (e) {
          agentToContact = { preference: rel.agent_contact };
        }
      }

      if (rel.short_term_memory) {
        try {
          const parsed = JSON.parse(rel.short_term_memory);
          if (parsed.entries && Array.isArray(parsed.entries)) {
            shortTermMemory = parsed.entries;
          }
        } catch (e) {
          console.warn(`[ProfileLoader] Failed to parse short_term_memory: ${e}`);
        }
      }

      return {
        relationshipId: rel.sid,
        agentId,
        contactId,
        contactToAgent,
        agentToContact,
        shortTermMemory,
      };
    } catch (error) {
      console.error(`[ProfileLoader] Failed to load relationship profile:`, error);
      return undefined;
    }
  }

  /**
   * 加载场景画像（动态生成）
   */
  async loadScenarioProfile(params: ProfileLoadParams): Promise<ScenarioProfile | undefined> {
    const now = new Date();
    const hour = now.getHours();

    // 时间上下文
    let timeContext: string;
    if (hour >= 9 && hour < 12) {
      timeContext = "上午工作时间";
    } else if (hour >= 12 && hour < 14) {
      timeContext = "午休时间";
    } else if (hour >= 14 && hour < 18) {
      timeContext = "下午工作时间";
    } else if (hour >= 18 && hour < 22) {
      timeContext = "晚间时间";
    } else {
      timeContext = "休息时间";
    }

    // 业务上下文
    let businessContext: string | undefined;
    if (params.conversationId) {
      businessContext = "持续对话中";
    }

    return {
      timeContext,
      businessContext,
    };
  }
}
