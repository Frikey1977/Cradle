/**
 * 通道管理模块入口
 */

// 导出类型
export type {
  ChatType,
  ChannelType,
  InboundMessageContext,
  OutboundMessageContext,
  ChannelCapabilities,
  ChannelConfig,
  ChannelStatus,
  Channel,
  CreateChannelDto,
  UpdateChannelDto,
  ChannelQuery,
} from "./types.js";

// 导出基类和注册表
export {
  BaseChannel,
  ChannelPluginRegistry,
  type ChannelPluginOptions,
} from "./base-channel.js";

// 导出服务
export {
  getChannelList,
  getChannelById,
  isChannelNameExists,
  createChannel,
  updateChannel,
  updateChannelStatus,
  deleteChannel,
} from "./service.js";

// 导出 schema
export {
  createChannelSchema,
  updateChannelSchema,
  updateStatusSchema,
} from "./schema.js";
