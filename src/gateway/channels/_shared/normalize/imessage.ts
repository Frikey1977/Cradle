/**
 * iMessage ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/imessage.ts
 */

// Service prefixes that indicate explicit delivery method
const SERVICE_PREFIXES = ["imessage:", "sms:", "auto:"] as const;

// Chat target prefixes
const CHAT_TARGET_PREFIX_RE =
  /^(chat_id:|chatid:|chat:|chat_guid:|chatguid:|guid:|chat_identifier:|chatidentifier:|chatident:)/i;

/**
 * 标准化 iMessage 消息目标地址
 * 支持格式:
 * - imessage:+1234567890
 * - sms:+1234567890
 * - auto:+1234567890
 * - +1234567890
 * - email@example.com
 * - chat_id:<id>
 * - chat_guid:<guid>
 */
export function normalizeIMessageMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();

  // Preserve service prefix if present (e.g., "sms:+1555" → "sms:+15551234567")
  for (const prefix of SERVICE_PREFIXES) {
    if (lower.startsWith(prefix)) {
      const remainder = trimmed.slice(prefix.length).trim();
      const normalizedHandle = normalizeIMessageHandle(remainder);
      if (!normalizedHandle) {
        return undefined;
      }
      if (CHAT_TARGET_PREFIX_RE.test(normalizedHandle)) {
        return normalizedHandle;
      }
      return `${prefix}${normalizedHandle}`;
    }
  }

  const normalized = normalizeIMessageHandle(trimmed);
  return normalized || undefined;
}

/**
 * 标准化 iMessage 句柄
 */
function normalizeIMessageHandle(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  // Chat target prefixes
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  // Email
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }

  // Phone number
  if (/^\+?\d{3,}$/.test(trimmed)) {
    return trimmed;
  }

  return undefined;
}

/**
 * 判断是否为 iMessage 目标 ID
 */
export function looksLikeIMessageTargetId(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }

  // Service prefix
  if (/^(imessage:|sms:|auto:)/i.test(trimmed)) {
    return true;
  }

  // Chat target prefix
  if (CHAT_TARGET_PREFIX_RE.test(trimmed)) {
    return true;
  }

  // Email
  if (trimmed.includes("@")) {
    return true;
  }

  // Phone number
  return /^\+?\d{3,}$/.test(trimmed);
}
