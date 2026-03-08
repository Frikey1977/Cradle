/**
 * Outbound 发送消息模块
 * 从 OpenClaw 提取并适配
 * 
 * 提供各 IM 平台的消息发送适配器
 */

export type {
  SendTextParams,
  SendMediaParams,
  SendResult,
  OutboundAdapter,
} from "./types.js";

export {
  createTelegramOutboundAdapter,
  markdownToTelegramHtml,
  chunkText,
} from "./telegram.js";

export {
  createDiscordOutboundAdapter,
  sendDiscordPoll,
  type DiscordPollParams,
} from "./discord.js";

export {
  createSlackOutboundAdapter,
  resolveSlackSendIdentity,
  type SlackSendIdentity,
} from "./slack.js";

/**
 * 创建 Outbound 适配器工厂函数
 * 根据通道类型自动选择对应的适配器创建函数
 * 注意：这是一个异步工厂函数，需要使用 await
 */
export async function createOutboundAdapter(
  channelType: string,
  sendMessage: (params: Record<string, unknown>) => Promise<{ messageId: string; chatId: string }>,
): Promise<import("./types.js").OutboundAdapter> {
  switch (channelType.toLowerCase()) {
    case "telegram": {
      const { createTelegramOutboundAdapter } = await import("./telegram.js");
      return createTelegramOutboundAdapter(sendMessage as any);
    }
    case "discord": {
      const { createDiscordOutboundAdapter } = await import("./discord.js");
      return createDiscordOutboundAdapter(sendMessage as any);
    }
    case "slack": {
      const { createSlackOutboundAdapter } = await import("./slack.js");
      return createSlackOutboundAdapter(sendMessage as any);
    }
    default:
      throw new Error(`Unsupported channel type: ${channelType}`);
  }
}
