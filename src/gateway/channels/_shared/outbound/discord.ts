/**
 * Discord 发送消息适配器
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/outbound/discord.ts
 */

import type { SendTextParams, SendMediaParams, SendResult, OutboundAdapter } from "./types.js";
import { normalizeDiscordOutboundTarget } from "../normalize/discord.js";

/**
 * Discord Outbound 适配器
 * 
 * 注意：这是一个适配器框架，实际的 sendMessageDiscord 函数
 * 需要在具体实现中提供，调用 Discord API
 */
export function createDiscordOutboundAdapter(
  sendMessage: (params: {
    to: string;
    text: string;
    replyTo?: string;
    accountId?: string;
    silent?: boolean;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
  }) => Promise<{ messageId: string; channelId: string }>,
  sendPoll?: (params: {
    to: string;
    question: string;
    options: string[];
    accountId?: string;
    silent?: boolean;
  }) => Promise<{ messageId: string; channelId: string }>,
): OutboundAdapter {
  return {
    deliveryMode: "direct",
    textChunkLimit: 2000,
    
    async sendText(params: SendTextParams): Promise<SendResult> {
      // 验证并标准化目标地址
      const targetResult = normalizeDiscordOutboundTarget(params.to);
      if (!targetResult.ok) {
        throw targetResult.error;
      }
      
      const result = await sendMessage({
        to: targetResult.to,
        text: params.text,
        replyTo: params.replyToId ?? undefined,
        accountId: params.accountId ?? undefined,
        silent: params.silent ?? undefined,
      });
      
      return {
        channel: "discord",
        messageId: result.messageId,
        chatId: result.channelId,
      };
    },
    
    async sendMedia(params: SendMediaParams): Promise<SendResult> {
      const targetResult = normalizeDiscordOutboundTarget(params.to);
      if (!targetResult.ok) {
        throw targetResult.error;
      }
      
      const result = await sendMessage({
        to: targetResult.to,
        text: params.text,
        mediaUrl: params.mediaUrl,
        mediaLocalRoots: params.mediaLocalRoots,
        replyTo: params.replyToId ?? undefined,
        accountId: params.accountId ?? undefined,
        silent: params.silent ?? undefined,
      });
      
      return {
        channel: "discord",
        messageId: result.messageId,
        chatId: result.channelId,
      };
    },
  };
}

/**
 * Discord 投票参数
 */
export interface DiscordPollParams {
  to: string;
  question: string;
  options: string[];
  accountId?: string;
  silent?: boolean;
}

/**
 * 发送 Discord 投票
 */
export async function sendDiscordPoll(
  adapter: OutboundAdapter & { sendPoll?: (params: DiscordPollParams) => Promise<SendResult> },
  params: DiscordPollParams,
): Promise<SendResult> {
  if (!adapter.sendPoll) {
    throw new Error("Discord adapter does not support polls");
  }
  return adapter.sendPoll(params);
}
