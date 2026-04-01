/**
 * Discord ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/discord.ts
 */

/**
 * 标准化 Discord 消息目标地址
 * 支持格式:
 * - discord:channel:<id>
 * - discord:user:<id>
 * - channel:<id>
 * - user:<id>
 * - <id> (纯数字，默认为 channel)
 */
export function normalizeDiscordMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // 移除 discord: 前缀
  let normalized = trimmed;
  if (normalized.toLowerCase().startsWith("discord:")) {
    normalized = normalized.slice("discord:".length).trim();
  }

  // 纯数字ID默认为 channel
  if (/^\d+$/.test(normalized)) {
    normalized = `channel:${normalized}`;
  }

  // 验证格式
  if (!/^(channel|user):\d+$/.test(normalized)) {
    return undefined;
  }

  return `discord:${normalized}`.toLowerCase();
}

/**
 * 标准化 Discord 发送目标（用于发送消息时）
 */
export function normalizeDiscordOutboundTarget(
  to?: string,
): { ok: true; to: string } | { ok: false; error: Error } {
  const trimmed = to?.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: new Error(
        'Discord recipient is required. Use "channel:<id>" for channels or "user:<id>" for DMs.',
      ),
    };
  }

  // 纯数字ID默认为 channel
  if (/^\d+$/.test(trimmed)) {
    return { ok: true, to: `channel:${trimmed}` };
  }

  return { ok: true, to: trimmed };
}

/**
 * 判断是否为 Discord 目标 ID
 */
export function looksLikeDiscordTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  // Discord mention: <@123> 或 <@!123>
  if (/^<@!?\d+>$/.test(trimmed)) {
    return true;
  }

  // 带前缀
  if (/^(user|channel|discord):/i.test(trimmed)) {
    return true;
  }

  // 纯数字ID
  if (/^\d{6,}$/.test(trimmed)) {
    return true;
  }

  return false;
}
