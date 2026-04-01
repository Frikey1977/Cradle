/**
 * Telegram ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/telegram.ts
 */

/**
 * 标准化 Telegram 消息目标地址
 * 支持格式:
 * - telegram:username
 * - tg:username
 * - @username
 * - https://t.me/username
 * - t.me/username
 * - 数字ID (群组/频道)
 */
export function normalizeTelegramMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  let normalized = trimmed;

  // 移除前缀
  if (normalized.startsWith("telegram:")) {
    normalized = normalized.slice("telegram:".length).trim();
  } else if (normalized.startsWith("tg:")) {
    normalized = normalized.slice("tg:".length).trim();
  }

  if (!normalized) {
    return undefined;
  }

  // 解析 t.me 链接
  const tmeMatch =
    /^https?:\/\/t\.me\/([A-Za-z0-9_]+)$/i.exec(normalized) ??
    /^t\.me\/([A-Za-z0-9_]+)$/i.exec(normalized);

  if (tmeMatch?.[1]) {
    normalized = `@${tmeMatch[1]}`;
  }

  if (!normalized) {
    return undefined;
  }

  return `telegram:${normalized}`.toLowerCase();
}

/**
 * 判断是否为 Telegram 目标 ID
 */
export function looksLikeTelegramTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  if (/^(telegram|tg):/i.test(trimmed)) {
    return true;
  }

  if (trimmed.startsWith("@")) {
    return true;
  }

  // 数字ID（群组/频道）
  return /^-?\d{6,}$/.test(trimmed);
}
