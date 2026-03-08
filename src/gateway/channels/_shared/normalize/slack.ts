/**
 * Slack ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/slack.ts
 */

/**
 * 标准化 Slack 消息目标地址
 * 支持格式:
 * - slack:channel:<id>
 * - slack:user:<id>
 * - channel:<id>
 * - user:<id>
 * - #channel-name
 * - @username
 * - <@USERID>
 */
export function normalizeSlackMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  let normalized = trimmed;

  // 移除 slack: 前缀
  if (normalized.toLowerCase().startsWith("slack:")) {
    normalized = normalized.slice("slack:".length).trim();
  }

  // Slack mention: <@USERID>
  const mentionMatch = /^<@([A-Z0-9]+)>$/i.exec(normalized);
  if (mentionMatch?.[1]) {
    return `slack:user:${mentionMatch[1].toUpperCase()}`;
  }

  // @username → user:username
  if (normalized.startsWith("@")) {
    const username = normalized.slice(1).trim();
    return username ? `slack:user:${username}` : undefined;
  }

  // #channel → channel:channel
  if (normalized.startsWith("#")) {
    const channel = normalized.slice(1).trim();
    return channel ? `slack:channel:${channel}` : undefined;
  }

  // 已有前缀
  if (/^(user|channel):/i.test(normalized)) {
    return `slack:${normalized}`.toLowerCase();
  }

  // Slack ID 格式 (U/C/W/D 开头)
  if (/^[CUWGD][A-Z0-9]{8,}$/i.test(normalized)) {
    const prefix = normalized.charAt(0).toUpperCase();
    const kind = prefix === 'U' ? 'user' : 'channel';
    return `slack:${kind}:${normalized.toUpperCase()}`;
  }

  return undefined;
}

/**
 * 判断是否为 Slack 目标 ID
 */
export function looksLikeSlackTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  // Slack mention
  if (/^<@([A-Z0-9]+)>$/i.test(trimmed)) {
    return true;
  }

  // 带前缀
  if (/^(user|channel):/i.test(trimmed)) {
    return true;
  }

  if (/^slack:/i.test(trimmed)) {
    return true;
  }

  // @user 或 #channel
  if (/^[@#]/.test(trimmed)) {
    return true;
  }

  // Slack ID 格式
  return /^[CUWGD][A-Z0-9]{8,}$/i.test(trimmed);
}
