/**
 * 画像数据访问接口 (Repository Pattern)
 *
 * 将数据访问逻辑从业务逻辑中分离，便于测试和替换实现
 */

import type {
  ContactProfile,
  AgentProfile,
  RelationshipProfile,
  ScenarioProfile,
  ProfileLoadParams,
  CompanyInfo,
  DepartmentInfo,
  PositionInfo,
} from "../../types/profile.js";

/**
 * 画像数据访问接口
 */
export interface ProfileRepository {
  /**
   * 加载联系人画像
   */
  loadContactProfile(contactId: string): Promise<ContactProfile | undefined>;

  /**
   * 加载 Agent 画像
   */
  loadAgentProfile(agentId: string): Promise<AgentProfile | undefined>;

  /**
   * 加载关系画像
   */
  loadRelationshipProfile(
    agentId: string,
    contactId: string
  ): Promise<RelationshipProfile | undefined>;

  /**
   * 加载场景画像
   */
  loadScenarioProfile(params: ProfileLoadParams): Promise<ScenarioProfile | undefined>;

  /**
   * 加载部门信息
   */
  loadDepartmentInfo(departmentId: string): Promise<DepartmentInfo | undefined>;

  /**
   * 加载公司信息
   */
  loadCompanyInfo(companyId: string): Promise<CompanyInfo | undefined>;

  /**
   * 加载职位信息
   */
  loadPositionInfo(positionId: string): Promise<PositionInfo | undefined>;
}

/**
 * 数据库实现的画像 Repository
 */
export class DatabaseProfileRepository implements ProfileRepository {
  constructor(private query: <T>(sql: string, params?: any[]) => Promise<T>) {}

  async loadContactProfile(contactId: string): Promise<ContactProfile | undefined> {
    try {
      // 查询 contact 基本信息 - 使用 t_contacts 表
      const contactRows = await this.query<
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

      console.log(`[ProfileRepository] Contact query returned ${contactRows.length} rows for ${contactId}`);

      if (contactRows.length === 0) {
        console.warn(`[ProfileRepository] Contact not found: ${contactId}`);
        return undefined;
      }

      const contact = contactRows[0];

      // 解析 profile JSON
      let profile: Record<string, any> = {};
      if (contact.profile) {
        try {
          profile = JSON.parse(contact.profile);
        } catch (e) {
          console.warn(`[ProfileRepository] Failed to parse contact profile: ${e}`);
        }
      }

      // 提取用户语言偏好
      const preferredLanguage = profile.preferredLanguage || profile.preferences?.language || "zh-CN";

      // 如果是员工，从员工表获取名字和组织信息
      let name = profile.facts?.basic?.name || profile.name || "未知用户";
      let eName: string | undefined = undefined;
      let organization: ContactProfile["organization"] = undefined;

      if (contact.type === "employee" && contact.source_id) {
        const orgInfo = await this.loadContactOrganization(contact.source_id);
        // 使用员工表的名字和e_name
        if (orgInfo.name) {
          name = orgInfo.name;
        }
        if (orgInfo.eName) {
          eName = orgInfo.eName;
        }
        // 提取组织信息
        const { name: _, eName: __, ...orgWithoutName } = orgInfo;
        organization = orgWithoutName;
      }

      return {
        contactId: contact.sid,
        type: contact.type as "employee" | "customer" | "partner" | "visitor",
        sourceId: contact.source_id,
        name,
        eName,
        profile,
        preferredLanguage,
        organization,
      };
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load contact profile:`, error);
      return undefined;
    }
  }

  async loadAgentProfile(agentId: string): Promise<AgentProfile | undefined> {
    try {
      // 查询 Agent 基本信息 - 使用 t_agents 表
      const agentRows = await this.query<
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

      console.log(`[ProfileRepository] Agent query returned ${agentRows.length} rows for ${agentId}`);

      if (agentRows.length === 0) {
        console.warn(`[ProfileRepository] Agent not found: ${agentId}`);
        return undefined;
      }

      const agent = agentRows[0];

      // 解析 profile JSON
      let profile: Record<string, any> = {};
      if (agent.profile) {
        try {
          profile = JSON.parse(agent.profile);
        } catch (e) {
          console.warn(`[ProfileRepository] Failed to parse agent profile: ${e}`);
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

      console.log(`[ProfileRepository] AgentProfile loaded: name=${result.name}, agentNo=${result.agentNo}`);

      return result;
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load agent profile:`, error);
      return undefined;
    }
  }

  async loadRelationshipProfile(
    agentId: string,
    contactId: string
  ): Promise<RelationshipProfile | undefined> {
    try {
      // 查询关系表 - 使用 t_relationships 表
      const relRows = await this.query<
        {
          sid: string;
          agent_id: string;
          contact_id: string;
          relationship_type: string;
          intimacy_level: number;
          custom_fields?: string;
        }[]
      >(
        `SELECT sid, agent_id, contact_id, relationship_type, intimacy_level, custom_fields
         FROM t_relationships
         WHERE agent_id = ? AND contact_id = ? AND deleted = 0`,
        [agentId, contactId]
      );

      if (relRows.length === 0) {
        return undefined;
      }

      const rel = relRows[0];

      // 解析 custom_fields JSON
      let customFields: Record<string, unknown> = {};
      if (rel.custom_fields) {
        try {
          customFields = JSON.parse(rel.custom_fields);
        } catch {
          // 忽略解析错误
        }
      }

      return {
        relationshipId: rel.sid,
        agentId: rel.agent_id,
        contactId: rel.contact_id,
        contactToAgent: customFields.contactToAgent as Record<string, any> | undefined,
        agentToContact: customFields.agentToContact as Record<string, any> | undefined,
      };
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load relationship profile:`, error);
      return undefined;
    }
  }

  async loadScenarioProfile(
    params: ProfileLoadParams
  ): Promise<ScenarioProfile | undefined> {
    // 场景画像可以根据 conversationId 或其他上下文信息加载
    // 目前返回一个简单的默认实现
    return {
      timeContext: new Date().toISOString(),
    };
  }

  async loadDepartmentInfo(departmentId: string): Promise<DepartmentInfo | undefined> {
    try {
      // 查询部门信息 - 使用 t_departments 表
      const deptRows = await this.query<
        {
          sid: string;
          title: string;
          parent_id?: string;
          path?: string;
        }[]
      >(
        `SELECT sid, title, parent_id, path
         FROM t_departments
         WHERE sid = ? AND deleted = 0`,
        [departmentId]
      );

      if (deptRows.length === 0) {
        return undefined;
      }

      const dept = deptRows[0];

      return {
        departmentId: dept.sid,
        name: dept.title,
        code: dept.sid,
        type: "department",
        path: dept.path || "",
      };
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load department info:`, error);
      return undefined;
    }
  }

  async loadCompanyInfo(companyId: string): Promise<CompanyInfo | undefined> {
    try {
      // 查询公司信息 - 使用 t_departments 表的根节点
      const companyRows = await this.query<
        {
          sid: string;
          title: string;
        }[]
      >(
        `SELECT sid, title
         FROM t_departments
         WHERE sid = ? AND deleted = 0 AND (parent_id IS NULL OR parent_id = '')`,
        [companyId]
      );

      if (companyRows.length === 0) {
        return undefined;
      }

      const company = companyRows[0];

      return {
        companyId: company.sid,
        name: company.title,
        code: company.sid,
        type: "company",
      };
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load company info:`, error);
      return undefined;
    }
  }

  async loadPositionInfo(positionId: string): Promise<PositionInfo | undefined> {
    try {
      // 查询职位信息 - 使用 t_positions 表
      const posRows = await this.query<
        {
          sid: string;
          title: string;
          code?: string;
        }[]
      >(
        `SELECT sid, title, code
         FROM t_positions
         WHERE sid = ? AND deleted = 0`,
        [positionId]
      );

      if (posRows.length === 0) {
        return undefined;
      }

      const pos = posRows[0];

      return {
        positionId: pos.sid,
        name: pos.title,
        code: pos.code || pos.sid,
      };
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load position info:`, error);
      return undefined;
    }
  }

  private async loadContactOrganization(employeeId: string): Promise<{
    name?: string;
    eName?: string;
    company?: CompanyInfo;
    department?: DepartmentInfo;
    position?: PositionInfo;
    location?: string;
  }> {
    try {
      // 获取员工信息 - 使用 t_employees 表
      const employeeRows = await this.query<
        {
          sid: string;
          name: string;
          e_name?: string;
          oid?: string;
          position_id?: string;
          location?: string;
        }[]
      >(
        `SELECT sid, name, e_name, oid, position_id, location 
         FROM t_employees 
         WHERE sid = ? AND deleted = 0`,
        [employeeId]
      );

      if (employeeRows.length === 0) {
        return {};
      }

      const employee = employeeRows[0];
      const result: {
        name?: string;
        eName?: string;
        company?: CompanyInfo;
        department?: DepartmentInfo;
        position?: PositionInfo;
        location?: string;
      } = {
        name: employee.name,
        eName: employee.e_name,
        location: employee.location,
      };

      // 获取部门信息
      if (employee.oid) {
        result.department = await this.loadDepartmentInfo(employee.oid);
        // 获取公司信息（部门树根节点）
        if (result.department?.path) {
          const pathParts = result.department.path.split("/");
          if (pathParts.length > 0) {
            result.company = await this.loadCompanyInfo(pathParts[0]);
          }
        }
      }

      // 获取岗位信息
      if (employee.position_id) {
        result.position = await this.loadPositionInfo(employee.position_id);
      }

      return result;
    } catch (error) {
      console.error(`[ProfileRepository] Failed to load contact organization:`, error);
      return {};
    }
  }

  private async loadAgentOrganization(
    oid?: string,
    positionId?: string
  ): Promise<AgentProfile["organization"]> {
    if (!oid && !positionId) {
      return undefined;
    }

    const result: NonNullable<AgentProfile["organization"]> = {};

    if (oid) {
      result.department = await this.loadDepartmentInfo(oid);
      // 获取公司信息
      if (result.department?.path) {
        const pathParts = result.department.path.split("/");
        if (pathParts.length > 0) {
          result.company = await this.loadCompanyInfo(pathParts[0]);
        }
      }
    }

    if (positionId) {
      result.position = await this.loadPositionInfo(positionId);
    }

    return result;
  }
}
