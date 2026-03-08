/**
 * Profile 提示词构建模块
 * 负责将画像数据转换为 Markdown 格式的系统提示词
 */

import type {
  ProfileCollection,
  ContactProfile,
  AgentProfile,
  RelationshipProfile,
  ScenarioProfile,
} from "../types/profile.js";

/**
 * Profile 提示词构建器
 */
export class ProfilePromptBuilder {
  /**
   * 构建所有画像部分的提示词
   */
  build(profiles: ProfileCollection): string {
    const parts: string[] = [];

    // Agent 画像（你的身份）
    if (profiles.agent) {
      const agentSection = this.buildAgentSection(profiles.agent);
      const trustSection = this.buildTrustSection(profiles.relationship);
      console.log(`[ProfilePromptBuilder] Agent section length: ${agentSection.length}, Trust section length: ${trustSection?.length || 0}`);
      parts.push(agentSection);
      if (trustSection) {
        parts.push(trustSection);
      }
    }

    // 用户画像（当前用户）
    if (profiles.contact) {
      parts.push(this.buildContactSection(profiles.contact));
    }

    // 关系画像（双方关系，不含信任级别）
    if (profiles.relationship) {
      parts.push(this.buildRelationshipSection(profiles.relationship));
    }

    // 场景画像（当前场景）
    if (profiles.scenario) {
      parts.push(this.buildScenarioSection(profiles.scenario));
    }

    return parts.join("\n\n");
  }

  /**
   * 构建 Agent 画像部分（你的身份）
   * 加载顺序：
   * 1. 灵魂设定（Agent的soul字段）
   * 2. 个人说明（Agent相关字段拼接：名字、部门、岗位等）
   * 3. 岗位信息（直接使用对应岗位的名字、级别、description）
   * 4. 部门信息（名称、文化、description）
   * 5. 公司情况（公司的名字、文化、description）
   */
  private buildAgentSection(agent: AgentProfile): string {
    const parts: string[] = [];

    parts.push("# 你的身份");

    // 1. 灵魂设定
    if (agent.soul) {
      parts.push("");
      parts.push("## 灵魂设定");
      parts.push(agent.soul);
    }

    // 2. 个人说明（Agent相关字段拼接）
    parts.push("");
    parts.push("## 个人说明");
    parts.push(`姓名：${agent.name}`);
    if (agent.eName) {
      parts.push(`英文名：${agent.eName}`);
    }
    parts.push(`编号：${agent.agentNo}`);

    // 组织层级信息（简要）
    if (agent.organization) {
      if (agent.organization.position) {
        parts.push(`岗位：${agent.organization.position.name}`);
      }
      if (agent.organization.department) {
        parts.push(`部门：${agent.organization.department.name}`);
      }
      if (agent.organization.company) {
        parts.push(`公司：${agent.organization.company.name}`);
      }
    }

    // 完整的 profile（展开为 Markdown）
    if (agent.profile && Object.keys(agent.profile).length > 0) {
      parts.push("");
      parts.push(this.flattenProfileToMarkdown(agent.profile, 0));
    }

    // 3. 岗位信息
    if (agent.organization?.position) {
      const position = agent.organization.position;
      parts.push("");
      parts.push("## 岗位信息");
      parts.push(`岗位名称：${position.name}`);
      if (position.level) {
        parts.push(`岗位级别：${position.level}`);
      }
      if (position.description) {
        parts.push("");
        parts.push("岗位描述：");
        parts.push(position.description);
      }
    }

    // 4. 部门信息
    if (agent.organization?.department) {
      const department = agent.organization.department;
      parts.push("");
      parts.push("## 部门信息");
      parts.push(`部门名称：${department.name}`);
      if (department.culture) {
        parts.push("");
        parts.push("部门文化：");
        parts.push(department.culture);
      }
      if (department.description) {
        parts.push("");
        parts.push("部门描述：");
        parts.push(department.description);
      }
    }

    // 5. 公司情况
    if (agent.organization?.company) {
      const company = agent.organization.company;
      parts.push("");
      parts.push("## 公司情况");
      parts.push(`公司名称：${company.name}`);
      if (company.culture) {
        parts.push("");
        parts.push("公司文化：");
        parts.push(company.culture);
      }
      if (company.description) {
        parts.push("");
        parts.push("公司描述：");
        parts.push(company.description);
      }
    }

    return parts.join("\n");
  }

  /**
   * 构建信任级别部分（从关系画像获取）
   */
  private buildTrustSection(relationship?: RelationshipProfile): string {
    if (!relationship?.agentToContact?.owner) {
      return "";
    }

    const parts: string[] = [];
    parts.push("");
    parts.push("### 信任级别");
    if (relationship.agentToContact.owner === true) {
      parts.push("当前用户是你的负责人，拥有对你的管理权限");
    }

    return parts.join("\n");
  }

  /**
   * 构建用户画像部分（当前用户）
   */
  private buildContactSection(contact: ContactProfile): string {
    const parts: string[] = [];

    parts.push("---");
    parts.push("");
    parts.push("# 用户身份");

    // 区分员工和陌生人处理
    if (contact.type === "employee" && contact.organization) {
      // 员工：构建完整信息
      parts.push(this.buildEmployeeBasicInfo(contact));
      parts.push(this.buildEmployeeOrganizationInfo(contact.organization));
    } else {
      // 陌生人：构建基础信息
      parts.push(this.buildStrangerBasicInfo(contact));
    }

    // 完整的 profile（展开为 Markdown）- 一般事实
    if (contact.profile && Object.keys(contact.profile).length > 0) {
      parts.push("");
      parts.push("## 一般事实");
      parts.push(this.flattenProfileToMarkdown(contact.profile, 0));
    }

    return parts.join("\n");
  }

  /**
   * 构建员工基本信息
   */
  private buildEmployeeBasicInfo(contact: ContactProfile): string {
    const parts: string[] = [];

    parts.push("");
    parts.push("## 基本信息");
    parts.push(`姓名：${contact.name}`);
    parts.push(`类型：${this.translateContactType(contact.type)}`);

    const org = contact.organization!;
    if (org.position) {
      parts.push(`岗位：${org.position.name}`);
    }
    if (org.department) {
      parts.push(`部门：${org.department.name}`);
    }
    if (org.company) {
      parts.push(`公司：${org.company.name}`);
    }
    if (org.location) {
      parts.push(`工作地点：${org.location}`);
    }

    return parts.join("\n");
  }

  /**
   * 构建员工组织详细信息
   */
  private buildEmployeeOrganizationInfo(org: NonNullable<ContactProfile["organization"]>): string {
    const parts: string[] = [];

    // 公司背景
    if (org.company?.description) {
      parts.push("");
      parts.push("### 公司背景");
      parts.push(org.company.description);
    }

    // 部门信息
    if (org.department?.description) {
      parts.push("");
      parts.push("### 部门信息");
      parts.push(org.department.description);
    }

    // 岗位职责
    if (org.position?.description) {
      parts.push("");
      parts.push("### 岗位职责");
      parts.push(org.position.description);
    }

    return parts.join("\n");
  }

  /**
   * 构建陌生人基础信息
   */
  private buildStrangerBasicInfo(contact: ContactProfile): string {
    const parts: string[] = [];

    parts.push("");
    parts.push("## 基本信息");
    parts.push(`姓名：${contact.name}`);
    parts.push(`类型：${this.translateContactType(contact.type)}`);
    parts.push("公司：待确认（请在交谈中了解用户所在公司）");

    return parts.join("\n");
  }

  /**
   * 构建关系画像部分（双方关系）
   */
  private buildRelationshipSection(relationship: RelationshipProfile): string {
    const parts: string[] = [];

    parts.push("---");
    parts.push("");
    parts.push("# 你与用户的关系");

    // 用户对 Agent 的偏好
    if (relationship.contactToAgent && Object.keys(relationship.contactToAgent).length > 0) {
      parts.push("");
      parts.push("## 用户对你的偏好");
      parts.push(this.flattenProfileToMarkdown(relationship.contactToAgent, 0));
    }

    // Agent 对用户的偏好
    if (relationship.agentToContact && Object.keys(relationship.agentToContact).length > 0) {
      parts.push("");
      parts.push("## 你对用户的了解");
      parts.push(this.flattenProfileToMarkdown(relationship.agentToContact, 0));
    }

    return parts.join("\n");
  }

  /**
   * 构建场景画像部分（当前场景）
   */
  private buildScenarioSection(scenario: ScenarioProfile): string {
    const parts: string[] = [];

    parts.push("---");
    parts.push("");
    parts.push("# 当前场景");

    // 当前时间
    parts.push("");
    parts.push("## 当前时间");
    if (scenario.timeContext) {
      parts.push(scenario.timeContext);
    } else {
      // 如果没有传入时间，使用系统当前时间
      parts.push(new Date().toLocaleString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
      }));
    }

    // 其他场景信息
    const contexts: string[] = [];
    if (scenario.locationContext) {
      contexts.push(scenario.locationContext);
    }
    if (scenario.businessContext) {
      contexts.push(scenario.businessContext);
    }
    if (scenario.urgency) {
      contexts.push(`紧急程度：${scenario.urgency}`);
    }

    if (contexts.length > 0) {
      parts.push("");
      parts.push(contexts.join("，"));
    }

    return parts.join("\n");
  }

  /**
   * 将 profile JSON 展开为 Markdown
   */
  private flattenProfileToMarkdown(obj: unknown, depth: number): string {
    if (obj === null || obj === undefined) {
      return "";
    }

    if (typeof obj === "string") {
      return obj;
    }

    if (typeof obj === "number" || typeof obj === "boolean") {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return "";
      }
      return obj.map((item) => `- ${this.flattenProfileToMarkdown(item, depth + 1)}`).join("\n");
    }

    if (typeof obj === "object") {
      const parts: string[] = [];
      const indent = "  ".repeat(depth);

      for (const [key, value] of Object.entries(obj)) {
        const formattedKey = this.formatKey(key);
        const formattedValue = this.flattenProfileToMarkdown(value, depth + 1);

        if (formattedValue === "") {
          continue;
        }

        if (typeof value === "object" && !Array.isArray(value) && value !== null) {
          // 嵌套对象
          parts.push(`${indent}- **${formattedKey}**`);
          parts.push(formattedValue);
        } else {
          // 基本类型或数组
          parts.push(`${indent}- **${formattedKey}**：${formattedValue}`);
        }
      }

      return parts.join("\n");
    }

    return "";
  }

  /**
   * 格式化 key（驼峰转中文或添加空格）
   */
  private formatKey(key: string): string {
    // 常见的 key 映射
    const keyMap: Record<string, string> = {
      facts: "事实",
      preferences: "偏好",
      basic: "基本信息",
      work: "工作信息",
      life: "生活信息",
      likes: "喜欢",
      dislikes: "不喜欢",
      expertise: "专业技能",
      experience: "经验",
      name: "姓名",
      type: "类型",
      language: "语言",
      timezone: "时区",
      theme: "主题",
      owners: "负责人",
      bestTime: "最佳时间",
      workStyle: "工作风格",
      hobbies: "爱好",
      location: "位置",
      family: "家庭",
    };

    return keyMap[key] || key;
  }

  /**
   * 翻译联系人类型
   */
  private translateContactType(type: string): string {
    const typeMap: Record<string, string> = {
      employee: "员工",
      customer: "客户",
      partner: "合作伙伴",
      visitor: "访客",
    };
    return typeMap[type] || type;
  }
}
