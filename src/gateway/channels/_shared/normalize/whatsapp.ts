/**
 * WhatsApp ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/whatsapp.ts
 */

/**
 * 标准化 WhatsApp 消息目标地址
 * 支持格式:
 * - whatsapp:+1234567890
 * - +1234567890
 * - 1234567890@c.us
 * - 1234567890@g.us (群组)
 */
export function normalizeWhatsAppMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  let normalized = trimmed;

  // 移除 whatsapp: 前缀
  if (normalized.toLowerCase().startsWith("whatsapp:")) {
    normalized = normalized.slice("whatsapp:".length).trim();
  }

  // 已经是完整格式
  if (normalized.includes("@")) {
    const [number, suffix] = normalized.split("@");
    if (suffix === "c.us" || suffix === "g.us") {
      return `whatsapp:${normalized}`;
    }
    return undefined;
  }

  // 电话号码格式
  const phoneMatch = normalized.match(/^(\+?\d{3,})$/);
  if (phoneMatch?.[1]) {
    const phone = phoneMatch[1].startsWith("+") ? phoneMatch[1] : `+${phoneMatch[1]}`;
    return `whatsapp:${phone}@c.us`;
  }

  return undefined;
}

/**
 * 判断是否为 WhatsApp 目标 ID
 */
export function looksLikeWhatsAppTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  if (/^whatsapp:/i.test(trimmed)) {
    return true;
  }

  // WhatsApp ID 格式
  if (trimmed.includes("@")) {
    return true;
  }

  // 电话号码
  return /^\+?\d{3,}$/.test(trimmed);
}
