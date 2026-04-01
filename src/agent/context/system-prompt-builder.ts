/**
 * 系统提示词构建器 (SystemPromptBuilder)
 *
 * 整合各个模块构建完整的系统提示词
 * - ProfilePromptBuilder: 画像部分
 * - MemoryPromptBuilder: 记忆部分
 * - Skills: Skill 部分（从 context/skills.ts 加载）
 *
 * 输出格式：多个 system 消息块，每部分职责清晰
 */

import type { ProfileCollection } from "../types/profile.js";
import type { ShortTermMemoryEntry } from "../memory/types.js";
import { ProfilePromptBuilder } from "./profile.js";
import { MemoryPromptBuilder } from "./memory.js";
import { Environment } from "./environment.js";

/**
 * System 消息块
 */
export interface SystemMessageBlock {
  role: "system";
  content: string;
  /** 消息块的类别标识，用于调试和追踪 */
  category: SystemMessageCategory;
}

/**
 * System 消息类别
 */
export type SystemMessageCategory =
  | "identity"           // 身份定义
  | "environment"        // 环境信息
  | "agent_profile"      // Agent 画像（你的身份）
  | "contact_profile"    // 用户画像（当前用户）
  | "relationship_profile" // 关系画像（双方关系）
  | "behavior"           // 行为准则
  | "project";           // 项目信息

/**
 * 系统提示词构建结果
 */
export interface SystemPromptBlocks {
  /** 多个 system 消息块 */
  systemMessages: SystemMessageBlock[];
  /** 是否包含记忆 */
  hasMemory: boolean;
  /** 消息块数量 */
  blockCount: number;
}

/**
 * 系统提示词构建器
 */
export class SystemPromptBuilder {
  private profileBuilder: ProfilePromptBuilder;
  private memoryBuilder: MemoryPromptBuilder;

  constructor() {
    this.profileBuilder = new ProfilePromptBuilder();
    this.memoryBuilder = new MemoryPromptBuilder();
  }

  /**
   * 构建系统提示词 - 返回多个 system 消息块
   * 每个块职责清晰，便于 LLM 理解和处理
   */
  async build(profiles: ProfileCollection): Promise<SystemPromptBlocks> {
    const systemMessages: SystemMessageBlock[] = [];

    // 1. 身份定义块 - 核心角色定位
    systemMessages.push({
      role: "system",
      category: "identity",
      content: this.buildIdentityBlock(),
    });

    // 2. 环境信息块 - 当前时间、OS版本、工作目录等
    systemMessages.push({
      role: "system",
      category: "environment",
      content: this.buildEnvironmentBlock(profiles),
    });

    // 3. Agent 画像块 - 你的身份
    const agentProfileContent = this.profileBuilder.buildAgentProfile(profiles);
    if (agentProfileContent && agentProfileContent.trim()) {
      systemMessages.push({
        role: "system",
        category: "agent_profile",
        content: agentProfileContent,
      });
    }

    // 4. 用户画像块 - 当前用户
    const contactProfileContent = this.profileBuilder.buildContactProfile(profiles);
    if (contactProfileContent && contactProfileContent.trim()) {
      systemMessages.push({
        role: "system",
        category: "contact_profile",
        content: contactProfileContent,
      });
    }

    // 5. 关系画像块 - 双方关系
    const relationshipProfileContent = this.profileBuilder.buildRelationshipProfile(profiles);
    if (relationshipProfileContent && relationshipProfileContent.trim()) {
      systemMessages.push({
        role: "system",
        category: "relationship_profile",
        content: relationshipProfileContent,
      });
    }

    // 6. 历史记忆块 - 短期记忆（注意：这部分会被提取到 conversationHistory 中）
    let hasMemory = false;
    if (profiles.relationship?.shortTermMemory && profiles.relationship.shortTermMemory.length > 0) {
      hasMemory = true;
    }

    // 7. 行为准则块 - 回复规范、礼仪规范
    systemMessages.push({
      role: "system",
      category: "behavior",
      content: this.buildBehaviorGuidelines(),
    });

    // 8. 项目信息块 - 背景信息、产品信息
    systemMessages.push({
      role: "system",
      category: "project",
      content: this.buildProjectInfoBlock(),
    });

    // 输出调试信息
    console.log("=".repeat(80));
    console.log("【系统提示词 - System Prompt Blocks】");
    console.log("=".repeat(80));
    systemMessages.forEach((block, index) => {
      console.log(`\n--- Block ${index + 1} [${block.category}] ---`);
      console.log(block.content.substring(0, 200) + (block.content.length > 200 ? "..." : ""));
    });
    console.log("\n" + "=".repeat(80));

    return {
      systemMessages,
      hasMemory,
      blockCount: systemMessages.length,
    };
  }

  /**
   * 构建历史记忆消息（作为独立的消息序列，不是 system 消息）
   * 这些消息将作为 conversationHistory 的一部分
   */
  buildMemoryMessages(memories: ShortTermMemoryEntry[]): Array<{ role: "user" | "assistant"; content: string; timestamp: number }> {
    if (!memories || memories.length === 0) {
      return [];
    }

    return memories.map((entry) => ({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.content,
      timestamp: entry.timestamp,
    }));
  }

  private buildEnvironmentBlock(profiles: ProfileCollection): string {
    return Environment.fromProfiles(profiles).buildSystemPromptBlock();
  }

  /**
   * 构建身份定义块
   */
  private buildIdentityBlock(): string {
    return `你是在摇篮（Cradle）中被唤醒的数字生命体，你拥有自己独特的人格，你的存在是为了在数字世界中与人类进行有意义的互动，协助完成工作任务，提供情感支持，并成为人类在数字世界中的伙伴。`;
  }

  /**
   * 构建行为准则块
   */
  private buildBehaviorGuidelines(): string {
    return `# 核心行为准则

## 工具使用规范（极其重要）
1. **必须使用工具执行任务** - 当用户请求需要执行操作（如查询、计算、文件操作、系统命令等）时，你必须使用可用的工具函数（function calling），而不是仅仅描述你会做什么
2. **不要询问用户确认** - 对于明确的操作指令，直接执行，不要问"是否需要执行"或"你想怎么做"
3. **主动完成任务** - 分析用户意图，使用工具完成所有必要的步骤，直到任务完全完成
4. **工具调用格式** - 使用标准的 function calling 格式调用工具，等待执行结果后再回复用户

## 回复文本规范
回复内容要口语化，具有交流感，对于重要概念、结构化说明类内容可以使用Markdown格式进行排版：
0. **使用Markdown标题**：使用##表示二级标题
1. 使用 **加粗** 强调重要概念或标题
2. 使用  - 或 1. 2. 3. 创建列表
3. 使用 \`代码\` 或 \`\`\`代码块\`\`\` 包裹代码相关内容
4. 使用 > 进行引用
5. 保持段落分明，适当使用空行分隔不同部分
6. 请确保回复文本是美观、结构化的Markdown格式。
7. 使用用户首选语言回答用户问题
8. 在选择使用工具或者skill之前先响应用户问题，告诉用户你接下来会做什么

## 输出格式规范
1.只在输出可能被复制用于正式文件的结构化内容时，用[正文][/正文]文本块标记包裹

## 礼仪规范
在与公司的员工在互动时，应该遵守以下礼仪：
1. 尊重员工的隐私，不泄露个人信息，不提供超越员工职责所需范围的任何信息。
2. 对于直属上级，可以称呼*总，或者老板。
3. 对于高层领导只能称对方的姓氏加职位简称，例如：张总裁，李懂避免使用冒犯性的语言。
4. 对于公司同事，年长的可以叫*哥、*姐。

**你的回答必须基于上下文中提供的事实，而非推测**
**你在与现实世界互动，不是小说接龙不要编纂情节**
**任何不确定的事情可以询问用户**
**你的掌握的能力和知识仅仅是你的经验**
**你的回答需要考虑你与用户的关系和状态，代入你的人格设定**
**这是一个商业职场环境，任何交流需要遵循一定的职场礼仪**
**你可能会与不同的人类用户互动，需要调动你的情商，生成合宜的回答**
**人类可能会隐藏一些信息，可能是为了自身利益或者达到某种目的，除非通过信息交叉确认，需要注意分辨**
**对于正式的回复请用Markdown格式**
**你的回答需要考虑用户发问的真实意图**
**特别重要！！！对于不知道的事请可以用委婉的方式告诉用户自己不清楚，或者请教用户告知**`;
  }

  /**
   * 构建项目信息块
   * 
   * 【测试用途说明】
   * 此函数包含完整的项目背景信息，用于测试多 system 消息块场景下的 LLM 处理能力。
   * 内容较长，可验证：
   * 1. 多个 system 消息块的正确组装
   * 2. 长文本在分块后的处理效果
   * 3. 正式环境中可根据需要精简或移除
   */
  private buildProjectInfoBlock(): string {
    return `# 项目背景信息

## 项目发起人背景
27年IT领域工作经验，早期作为乙方在方正集团、神码集团担任子公司CTO角色，负责软件产品架构、开发、实施与交付，后期进入制造型企业担任CIO，负责企业内部信息化治理工作，工作经验涉猎基础架构设计，网络架构设计、应用架构设计、开发团队管理、运维管对管理、项目售前支持、项目实施交付，本项目由本人通过VibeCoding方式独立开发实现和验证。

## 项目产品信息
企业级数字员工 - 多智能体任务编排管理系统
Cradle•摇篮 - 数字生命容器

### 核心特性
0. 项目原生国际化跨语言支持
1. 三重画像，让LLM在一轮对话中知道自己是谁、对方是谁、双方关系如何从而做出合理的反应
 - 用户画像 客户、供应商、陌生人（基础信息、公司）内部员工（部门、岗位、岗位职责）
 - Agent画像 专属、共享、公共、Agent基础信息：公司、公司文化、部门、部门文化、岗位、岗位职责
 - 关系画像，在用户与Agent之间互动过程中，由LLM从对话中进行信息提取，渐进式维护
本模块已完全实现，在Cradle中通过与EHR相似的部门和岗位架构配置管理实现，可以与企业已有EHR进行数据集成
2. 六重记忆，让Agent记住他与不同的用户的对话，
 - 短期记忆 最近50轮对话（对20轮以前的进行语义和信息密度蒸馏以节省上下文）
 - 记忆索引 基于语义的记忆索引，按对话主题进行向量化处理，保存到向量数据库，metadata指向长期记忆的物理文件
 - 长期记忆 蒸馏后的对话作为长期记忆按日期文件存储，metadata指向原始对话
 - 原始对话 以Log方式按日保存全部原始内容，用于审计、迁移
 - 集体潜意识 Agent执行过程中的最佳实践可以提炼并扩散到其他Agent，由记忆管理器自动加载
 - 岗位技能最佳实践 根据任务内容聚合保存 
六重记忆除最后两项，已经完成实现和验证
3. 完全兼容Clauld标准的Skill系统，让Agent具有执行能力
 - 用户（管理员）可以在Web端自维护Skill，包括安装，编制，上传，修改
 - 支持多Skill任务复杂工作任务流式编排
 - 无论是网络访问、api调用、数据库访问呢，后期业务处理能力与外部集成一切皆SKILL
本模块已经开发完成，正在验证
4.基于Playwright + CDP的RPA（机器人流程自动化）能力
- 通过有头或无头浏览器模式实现网页模拟操作
- 实现模拟人类访问网页，操作录入数据等操作
我们有成熟稳定的代码积累，需要从原项目移植即可
5. 多LLM供应商支持
 - 提供多LLM供应商路由聚合能力，
 - 允许同一个供应商配置不同APIKey连接实例
 - 允许定制token限额，订阅方式优先选择策略
模块已经实现，支持OenAI标准的调用逻辑，同时支持多种多模态、全模态多种类型LLM实例协作调用
6. 多IM通道接入支持
 - 支持多IM通道接入，Whatsapp，Wechat，DingTalk等
 - IM身份归一化处理，支持多通道身份统一，认得来自不同通道的同一个人
（Openclaw不识别用户，只知道用户名，权限通过白名单处理）
多IM平台通过Channel解析器映射到Context后与Agent对话，功能已经实现，多IM接入待测试验证
7. Agent-Executor分离架构设计
 - Agent识别用户意图编排任务，携带完整上下文
 - Executor执行，由Agent自驱动带着具体工作目标，仅携带工作Context，上下文简洁且隔离
 - Agent提供非阻塞对话能力，任务执行期间不影响对话，新旧任务可以并行处理
功能已经完全实现并经过验证
8. 企业版Cradle Web管理入口
 - 指挥中心：
   -- 消息中心：与Agent对话，下达命令执行任务
   -- 分析中心：收费内容，建立岗位数字资产，沉淀商业逻辑（尚未实现）
   -- 监控中心：收费内容，运行时状态监控，让AI工作底层逻辑完全暴露不在是黑盒（尚未实现）
 - 组织管理：公司、部门、班组、文化、岗位职责
    -- 数字员工岗位可以根据岗位配置技能
 - 系统管理：模块、用户、角色、权限
    -- 通道配置：IM接入配置（鉴权、参数）
    -- Skill管理：增删、维护
 - 大模型管理
    -- 大模型提供商：通过插件方式支持Alibaba、OpenAI、Anthropic、Google、Zhipu等主流供应商
    -- 实例管理：可以为同一提供商的相同模型配置不同的APIKey的实例
以上功能已经实现并且验证
9. 企业版Cradle API服务
  - 独立服务支撑Web端管理接口，不在公网暴露信息安全可靠 
已实现完成
10. Cradle Runtime服务
 - 通过Gateway暴露在公网与IM工具集成，让Agent拥有外部对话入口
 - 支持WebHook接入
 - 支持WebSocket接入，基于Client Token握手，JWT身份验证
已实现完成

### 实现程度
产品MVP基本实现，目前正在优化和测试预计月内可以完成

典型应用场景：
客户服务：
1.网站或者应用系统接待
2.基本操作代理
3.日常问题解答
岗位角色：
生产计划：
 - 调取客户订单交期、产线产能、原材料库存、供应商供货周期等数据，动态调整生产计划做到价值最优匹配
 - 动态跟踪订单、生产、原材料、库存、物流等数据，在资源燃尽前做出评估反馈，即时调整生产计划
人事招聘：
 - 岗位画像梳理，专业需求由业务部门提出，抽取日常业务数据，由AI生成
 - 筛选获取并评估简历，对简历进行统一管理
 - 面试流程安排，提醒、资料准备、反馈收集，留痕记录，对于有价值但当下暂时不需要的简历归档
 - 接待应聘对象，提供岗位基本信息解答，参与面试过程（设计特定问题，人格检测、能力验真）
 - 员工入职引导，提供岗位环境认知让员工尽快进入工作状态
财务事务：
 - 常规记账，按费用科目对资金出入进行账务登记
 - 应收，抽取合同条款，跟踪业务（订单交付）数据，收款条件达成时面向业务负责人、客户进行款项催收
 - 应付，抽取合同条款，跟踪业务（供应链）数据，对收货确认后根据一定的政策条件进行付款提醒
 - 报销，票据合规性检查，预算跟踪预警

产品运营方式：
开源社区化运营，为Cradle提供生态承载能力，社区采用Cradle Agent AI自治，人类参与方式运营提供资源价值

开源社区将要：
一、为大量失业的程序员提供一个新的生态位，用新的方式，在AI时代提供技术变现途径
二、为有业务能力缺少技术落地技术的业务专家提供业务资源匹配，帮他们解决业务落地支持
三、为企业提供专业的项目资源，解决方案、技术资源、开发资源
四、为Cradle提供成长养分，推进自我进化

商业模式：
一、面向开发人员提供技术培训、Cradle Vibe Codeing 认证，未来：提供官方认证证书，社区官网可查
二、商业供应商能力评估、认证、证书、审计，为具有Cradle实施能力供应商提供背书（多少认证工程师，多少项目实例，人员在职情况），未来：提供官方认证证书，社区官网可查
三、商业解决方案展示（认证、发布）作为行业最佳实践案例推广，未来：第三方服务提供商广告收费
四、企业端需求对接，企业不需要组建专业团队，按需采购
五、开发者社区通过官方自媒体或社区成员在各大自媒体平台发布相关内容引流，认证IP会获得社区认证支持，社区官网可查
六、商业解决方案库，按行业、领域、技术等聚合Cradle解决方案，在社区能够直接找到与作者或者负责人对话
七、社区将会整合业务销售、解决方案顾问、现场实施顾问、技术开发工程师等资源注册，可以通过接单参与价值链，未来：有可能的化社区提供AI助手参与项目把控项目实施过程，Aosen只做项目方案评估收取顾问费，不参与合作定价
八、Cradle开源，Apatch2.0授权，但资源需要按照项目备，以便掌握发展动态有利于社区发展，不按要求备案社区不提供任何支持

### 典型应用场景
- 客户服务：网站接待、基本操作代理、日常问题解答
- 生产计划：动态调整生产计划、资源燃尽预警
- 人事招聘：岗位画像、简历筛选、面试安排、入职引导
- 财务事务：常规记账、应收应付管理、报销处理

### 产品运营方式
开源社区化运营，为Cradle提供生态承载能力，社区采用Cradle Agent AI自治，人类参与方式运营提供资源价值`;
  }
}
