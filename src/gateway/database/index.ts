/**
 * Gateway 数据库模块
 * 
 * 提供通道相关的数据库实体和访问层
 */

// 类型定义
export type {
  ChannelEntity,
  ChannelContactEntity,
  ChannelAgentEntity,
  ChannelType,
  ChannelStatus,
  BindSource,
  BindStatus,
  ContactChannelIdentity,
  AgentChannelIdentity,
} from "./types.js";

// Repository
export {
  type DatabaseConnection,
  ChannelRepository,
  ChannelContactRepository,
  ChannelAgentRepository,
} from "./channel-repository.js";
