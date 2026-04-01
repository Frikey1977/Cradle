/**
 * Slack 发送消息适配器
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/outbound/slack.ts
 */

import type { SendTextParams, SendMediaParams, SendResult, OutboundAdapter } from "./types.js";

/**
 * Slack 发送身份配置
 */
export interface SlackSendIdentity {
  /** 用户名 */
  username?: string;
  /** 头像URL */
  iconUrl?: string;
  /** 表情符号（如 :robot:） */
  iconEmoji?: string;
}

/**
 * Slack Outbound 适配器
 * 
 * 注意：这是一个适配器框架，实际的 sendMessageSlack 函数
 * 需要在具体实现中提供，调用 Slack API
 */
export function createSlackOutboundAdapter(
  sendMessage: (params: {
    to: string;
    text: string;
    threadTs?: string;
    accountId?: string;
    mediaUrl?: string;
    mediaLocalRoots?: readonly string[];
    identity?: SlackSendIdentity;
  }) => Promise<{ messageId: string; channelId: string; threadTs?: string }>,
): OutboundAdapter {
  return {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    
    async sendText(params: SendTextParams): Promise<SendResult> {
      // 解析线程ID
      const threadTs = params.replyToId ?? 
        (params.threadId != null ? String(params.threadId) : undefined);
      
      const result = await sendMessage({
        to: params.to,
        text: params.text,
        threadTs,
        accountId: params.accountId ?? undefined,
      });
      
      return {
        channel: "slack",
        messageId: result.messageId,
        chatId: result.channelId,
        meta: result.threadTs ? { threadTs: result.threadTs } : undefined,
      };
    },
    
    async sendMedia(params: SendMediaParams): Promise<SendResult> {
      const threadTs = params.replyToId ?? 
        (params.threadId != null ? String(params.threadId) : undefined);
      
      const result = await sendMessage({
        to: params.to,
        text: params.text,
        threadTs,
        accountId: params.accountId ?? undefined,
        mediaUrl: params.mediaUrl,
        mediaLocalRoots: params.mediaLocalRoots,
      });
      
      return {
        channel: "slack",
        messageId: result.messageId,
        chatId: result.channelId,
        meta: result.threadTs ? { threadTs: result.threadTs } : undefined,
      };
    },
  };
}

/**
 * 解析 Slack 发送身份
 * 从 OpenClaw 的 resolveSlackSendIdentity 提取
 */
export function resolveSlackSendIdentity(params: {
  name?: string;
  avatarUrl?: string;
  emoji?: string;
}): SlackSendIdentity | undefined {
  const username = params.name?.trim() || undefined;
  const iconUrl = params.avatarUrl?.trim() || undefined;
  const rawEmoji = params.emoji?.trim();
  
  // 验证表情符号格式 :emoji:
  const iconEmoji = !iconUrl && rawEmoji && /^:[^:\s]+:$/.test(rawEmoji) 
    ? rawEmoji 
    : undefined;
  
  if (!username && !iconUrl && !iconEmoji) {
    return undefined;
  }
  
  return { username, iconUrl, iconEmoji };
}
