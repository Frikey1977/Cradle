/**
 * ID 格式标准化模块
 * 从 OpenClaw 提取并适配
 * 
 * 提供各 IM 平台的目标地址标准化功能
 * 统一处理不同格式的用户/群组 ID
 */

import {
  normalizeTelegramMessagingTarget,
  looksLikeTelegramTargetId,
} from "./telegram.js";

import {
  normalizeDiscordMessagingTarget,
  normalizeDiscordOutboundTarget,
  looksLikeDiscordTargetId,
} from "./discord.js";

import {
  normalizeSlackMessagingTarget,
  looksLikeSlackTargetId,
} from "./slack.js";

import {
  normalizeWhatsAppMessagingTarget,
  looksLikeWhatsAppTargetId,
} from "./whatsapp.js";

import {
  normalizeSignalMessagingTarget,
  looksLikeSignalTargetId,
} from "./signal.js";

import {
  normalizeIMessageMessagingTarget,
  looksLikeIMessageTargetId,
} from "./imessage.js";

export {
  normalizeTelegramMessagingTarget,
  looksLikeTelegramTargetId,
  normalizeDiscordMessagingTarget,
  normalizeDiscordOutboundTarget,
  looksLikeDiscordTargetId,
  normalizeSlackMessagingTarget,
  looksLikeSlackTargetId,
  normalizeWhatsAppMessagingTarget,
  looksLikeWhatsAppTargetId,
  normalizeSignalMessagingTarget,
  looksLikeSignalTargetId,
  normalizeIMessageMessagingTarget,
  looksLikeIMessageTargetId,
};

/**
 * 通用目标地址标准化函数
 * 根据通道类型自动选择对应的标准化函数
 */
export function normalizeTarget(
  channelType: string,
  raw: string,
): string | undefined {
  switch (channelType.toLowerCase()) {
    case "telegram":
      return normalizeTelegramMessagingTarget(raw);
    case "discord":
      return normalizeDiscordMessagingTarget(raw);
    case "slack":
      return normalizeSlackMessagingTarget(raw);
    case "whatsapp":
      return normalizeWhatsAppMessagingTarget(raw);
    case "signal":
      return normalizeSignalMessagingTarget(raw);
    case "imessage":
      return normalizeIMessageMessagingTarget(raw);
    default:
      return undefined;
  }
}

/**
 * 判断是否为有效的目标 ID
 * 根据通道类型自动选择对应的判断函数
 */
export function looksLikeTargetId(
  channelType: string,
  raw: string,
): boolean {
  switch (channelType.toLowerCase()) {
    case "telegram":
      return looksLikeTelegramTargetId(raw);
    case "discord":
      return looksLikeDiscordTargetId(raw);
    case "slack":
      return looksLikeSlackTargetId(raw);
    case "whatsapp":
      return looksLikeWhatsAppTargetId(raw);
    case "signal":
      return looksLikeSignalTargetId(raw);
    case "imessage":
      return looksLikeIMessageTargetId(raw);
    default:
      return false;
  }
}
