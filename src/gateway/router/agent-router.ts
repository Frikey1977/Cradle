/**
 * Agent Router - Agent 路由组件
 *
 * 职责：
 * 1. 身份归一化 - 将不同通道的 sender 标识映射为 contact_id
 * 2. Agent 路由 - 确定消息应该由哪个 Agent 处理
 * 3. 消息转换 - 构建标准化的 AgentMessage
 */

import { query, run } from "../../store/database.js";
import type { InboundMessageContext } from "../channels/types.js";
import type { AgentMessage } from "../../agent/types/index.js";

/**
 * Agent Router 配置
 */
export interface AgentRouterConfig {
  /** 默认 Agent ID */
  defaultAgentId?: string;
}

/**
 * Agent Router 实现
 */
export class AgentRouter {
  private config: AgentRouterConfig;
  private logger: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };

  constructor(config: AgentRouterConfig = {}) {
    this.config = config;
    this.logger = {
      info: (msg: string) => console.log(`[AgentRouter] ${msg}`),
      warn: (msg: string) => console.warn(`[AgentRouter] ${msg}`),
      error: (msg: string) => console.error(`[AgentRouter] ${msg}`),
    };
  }

  /**
   * @param channelName 通道名称
   * @returns 标准化的 AgentMessage
   */
  async route(
    context: InboundMessageContext,
    channelName: string
  ): Promise<AgentMessage> {
    this.logger.info(`Routing message ${context.messageId}`);
    this.logger.info(`Context voice: ${context.voice}, stream: ${context.stream}, voiceResponse: ${context.voiceResponse}`);

    // 1. 解析 Contact
    const contactId = await this.resolveContact(channelName, context.senderId);
    this.logger.info(`Resolved contact: ${contactId}`);

    // 2. 确定目标 Agent
    const agentId = await this.resolveAgent(context, channelName);
    this.logger.info(`Resolved agent: ${agentId}`);

    // 3. 构建 AgentMessage
    const agentMessage: AgentMessage = {
      messageId: context.messageId,
      agentId,
      contactId,
      content: context.body,
      channelName: channelName,
      timestamp: context.timestamp,
      metadata: {
        channelType: context.channelType,
        channelName: context.channelName,
        chatType: context.chatType,
        chatId: context.chatId,
        senderName: context.senderName,
        recipientId: context.recipientId,
        originalSenderId: context.senderId, // 保留原始 sender 标识
      },
      // 从消息顶层或元数据中读取 stream 设置，默认 true（开启流式输出）
      stream: context.stream !== false && context.metadata?.stream !== false,
      // 传递语音合成音色
      voice: context.voice,
    };
    
    this.logger.info(`AgentMessage stream: ${agentMessage.stream}, voice: ${agentMessage.voice}, metadata: ${JSON.stringify(context.metadata)}`);

    // 4. 传递多媒体数据
    if (context.audio) {
      this.logger.info(`Passing audio data to agent: ${context.audio.data.length} chars`);
      agentMessage.audio = context.audio;
    }
    if (context.images) {
      this.logger.info(`Passing ${context.images.length} images to agent`);
      agentMessage.images = context.images;
    }

    return agentMessage;
  }

  /**
   * 解析 Contact
   * @param channelName 通道名称
   * @param sender 原始 sender 标识（可能是 name 或 ID）
   * @returns contact_id
   */
  async resolveContact(channelName: string, sender: string): Promise<string> {
    try {
      // 1. 查询通道ID
      const channels = await query<Array<{ sid: string }>>(
        `SELECT sid FROM t_channels WHERE name = ? AND status = 'enabled'`,
        [channelName]
      );

      if (channels.length === 0) {
        this.logger.error(`Channel ${channelName} not found`);
        throw new Error(`Channel ${channelName} not found`);
      }

      const channelId = channels[0].sid;

      // 2. 查询 r_channel_contact 表（sender 可能是 name）
      const result = await query<
        Array<{ contact_id: string }>
      >(
        `SELECT contact_id FROM r_channel_contact 
         WHERE channel_id = ? AND sender = ?`,
        [channelId, sender]
      );

      if (result.length > 0) {
        return result[0].contact_id;
      }

      // 3. 尝试通过 contact name 查找（sender 是 name 的情况）
      const contactByName = await query<
        Array<{ sid: string }>
      >(
        `SELECT c.sid FROM t_contacts c
         JOIN t_employees e ON c.source_id = e.sid
         WHERE e.name = ? AND c.type = 'employee' AND c.deleted = 0`,
        [sender]
      );

      if (contactByName.length > 0) {
        const contactId = contactByName[0].sid;
        this.logger.info(`Found contact by name '${sender}': ${contactId}`);
        
        // 自动创建通道映射（便于后续查询）
        await this.createChannelMapping(channelId, contactId, sender).catch(() => {
          // 忽略创建映射失败
        });
        
        return contactId;
      }

      // 4. 尝试通过 source_id 查找（兼容现有数据结构）
      const contactBySource = await query<
        Array<{ sid: string }>
      >(
        `SELECT sid FROM t_contacts 
         WHERE source_id = ? AND type = 'employee' AND deleted = 0`,
        [sender]
      );

      if (contactBySource.length > 0) {
        const contactId = contactBySource[0].sid;
        this.logger.info(`Found contact by source_id: ${contactId}`);
        
        // 自动创建通道映射（便于后续查询）
        await this.createChannelMapping(channelId, contactId, sender).catch(() => {
          // 忽略创建映射失败
        });
        
        return contactId;
      }

      // 5. 未找到，创建新的访客 Contact
      this.logger.warn(`No contact found for sender '${sender}' in channel ${channelName}, creating visitor`);
      return this.createVisitorContact(channelName, sender);
    } catch (error) {
      this.logger.error(`Failed to resolve contact: ${error}`);
      throw error;
    }
  }

  /**
   * 创建通道映射
   * @param channelId 通道ID
   * @param contactId 联系人ID
   * @param sender 原始 sender 标识
   */
  private async createChannelMapping(
    channelId: string,
    contactId: string,
    sender: string
  ): Promise<void> {
    try {
      await run(
        `INSERT INTO r_channel_contact (channel_id, contact_id, sender, create_time) 
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE sender = sender`, // 如果已存在则忽略
        [channelId, contactId, sender]
      );
      this.logger.info(`Created channel mapping: ${channelId} -> ${contactId}`);
    } catch (error) {
      this.logger.warn(`Failed to create channel mapping: ${error}`);
    }
  }

  /**
   * 创建访客 Contact
   * @param channelName 通道名称
   * @param sender 原始 sender 标识
   * @returns 新创建的 contact_id
   */
  private async createVisitorContact(
    channelName: string,
    sender: string
  ): Promise<string> {
    const contactId = this.generateId("contact");

    try {
      // 1. 查询通道ID
      const channels = await query<Array<{ sid: string }>>(
        `SELECT sid FROM t_channels WHERE name = ? AND status = 'enabled'`,
        [channelName]
      );

      if (channels.length === 0) {
        this.logger.error(`Channel ${channelName} not found`);
        throw new Error(`Channel ${channelName} not found`);
      }

      const channelId = channels[0].sid;

      // 2. 创建 Contact 记录
      await run(
        `INSERT INTO t_contacts (sid, type, status, create_time) 
         VALUES (?, 'visitor', 'enabled', NOW())`,
        [contactId]
      );

      // 3. 创建通道映射
      await run(
        `INSERT INTO r_channel_contact (channel_id, contact_id, sender, create_time) 
         VALUES (?, ?, ?, NOW())`,
        [channelId, contactId, sender]
      );

      this.logger.info(`Created visitor contact ${contactId} with channel mapping: ${channelName} -> ${sender}`);
      return contactId;
    } catch (error) {
      this.logger.error(`Failed to create visitor contact: ${error}`);
      throw error;
    }
  }

  /**
   * 确定目标 Agent
   * @param context 消息上下文
   * @param channelName 通道名称
   * @returns agent_id
   */
  async resolveAgent(
    context: InboundMessageContext,
    channelName: string
  ): Promise<string> {
    // 1. 如果消息指定了 recipientId，尝试解析
    if (context.recipientId) {
      // 1.1 首先尝试作为 cradle 内部 agent_id 查询
      const agentById = await this.getAgent(context.recipientId);
      if (agentById) {
        return agentById.sid;
      }

      // 1.2 尝试通过 agent name 查询
      const agentByName = await this.getAgentByName(context.recipientId);
      if (agentByName) {
        return agentByName.sid;
      }

      // 1.3 尝试通过 r_channel_agent 映射查询
      // 对于微信/钉钉等，recipientId 可能是平台的机器人标识
      const agentByMapping = await this.getAgentByChannelMapping(
        channelName,
        context.recipientId
      );
      if (agentByMapping) {
        return agentByMapping.sid;
      }

      this.logger.warn(
        `Recipient ${context.recipientId} not found, using default agent`
      );
    }

    // 2. 尝试通过通道查找默认 Agent
    const defaultAgent = await this.getDefaultAgentForChannel(channelName);
    if (defaultAgent) {
      return defaultAgent.sid;
    }

    // 3. 使用配置中的默认 Agent
    if (this.config.defaultAgentId) {
      const agent = await this.getAgent(this.config.defaultAgentId);
      if (agent) {
        return agent.sid;
      }
    }

    // 4. 使用系统默认 Agent（第一个启用的 Agent）
    const firstAgent = await this.getFirstEnabledAgent();
    if (firstAgent) {
      return firstAgent.sid;
    }

    throw new Error("No available agent found");
  }

  /**
   * 根据 ID 获取 Agent
   */
  private async getAgent(
    agentId: string
  ): Promise<{ sid: string; name: string } | null> {
    const agents = await query<
      Array<{ sid: string; name: string }>
    >(
      `SELECT sid, name FROM t_agents 
       WHERE sid = ? AND status = 'enabled' AND deleted = 0`,
      [agentId]
    );
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * 根据名称获取 Agent
   */
  private async getAgentByName(
    name: string
  ): Promise<{ sid: string; name: string } | null> {
    const agents = await query<
      Array<{ sid: string; name: string }>
    >(
      `SELECT sid, name FROM t_agents 
       WHERE name = ? AND status = 'enabled' AND deleted = 0`,
      [name]
    );
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * 根据通道映射获取 Agent
   */
  private async getAgentByChannelMapping(
    channelName: string,
    platformId: string
  ): Promise<{ sid: string; name: string } | null> {
    try {
      // 查询通道ID
      const channels = await query<Array<{ sid: string }>>(
        `SELECT sid FROM t_channels WHERE name = ? AND status = 'enabled'`,
        [channelName]
      );

      if (channels.length === 0) {
        return null;
      }

      const channelId = channels[0].sid;

      // 查询映射关系
      const mappings = await query<
        Array<{ agent_id: string }>
      >(
        `SELECT agent_id FROM r_channel_agent 
         WHERE channel_id = ? AND platform_id = ? AND status = 'enabled'`,
        [channelId, platformId]
      );

      if (mappings.length === 0) {
        return null;
      }

      // 返回 Agent 信息
      return this.getAgent(mappings[0].agent_id);
    } catch (error) {
      this.logger.error(`Failed to get agent by channel mapping: ${error}`);
      return null;
    }
  }

  /**
   * 获取通道的默认 Agent
   */
  private async getDefaultAgentForChannel(
    channelName: string
  ): Promise<{ sid: string; name: string } | null> {
    try {
      // 查询通道ID
      const channels = await query<Array<{ sid: string }>>(
        `SELECT sid FROM t_channels WHERE name = ? AND status = 'enabled'`,
        [channelName]
      );

      if (channels.length === 0) {
        return null;
      }

      const channelId = channels[0].sid;

      // 查询默认映射
      const mappings = await query<
        Array<{ agent_id: string }>
      >(
        `SELECT agent_id FROM r_channel_agent 
         WHERE channel_id = ? AND is_default = 1 AND status = 'enabled'`,
        [channelId]
      );

      if (mappings.length === 0) {
        return null;
      }

      return this.getAgent(mappings[0].agent_id);
    } catch (error) {
      this.logger.error(`Failed to get default agent for channel: ${error}`);
      return null;
    }
  }

  /**
   * 获取第一个启用的 Agent
   */
  private async getFirstEnabledAgent(): Promise<
    { sid: string; name: string } | null
  > {
    const agents = await query<
      Array<{ sid: string; name: string }>
    >(
      `SELECT sid, name FROM t_agents 
       WHERE status = 'enabled' AND deleted = 0 
       ORDER BY create_time ASC LIMIT 1`
    );
    return agents.length > 0 ? agents[0] : null;
  }

  /**
   * 生成唯一ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
