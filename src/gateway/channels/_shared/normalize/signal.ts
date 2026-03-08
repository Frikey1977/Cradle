/**
 * Signal ID 格式标准化
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/normalize/signal.ts
 */

// UUID pattern for signal-cli recipient IDs
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;

/**
 * 标准化 Signal 消息目标地址
 * 支持格式:
 * - signal:group:<id>
 * - signal:username:<id>
 * - signal:u:<id>
 * - signal:uuid:<id>
 * - group:<id>
 * - username:<id>
 * - +1234567890
 * - UUID
 */
export function normalizeSignalMessagingTarget(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  let normalized = trimmed;

  // 移除 signal: 前缀
  if (normalized.toLowerCase().startsWith("signal:")) {
    normalized = normalized.slice("signal:".length).trim();
  }

  const lower = normalized.toLowerCase();

  // group:<id>
  if (lower.startsWith("group:")) {
    const id = normalized.slice("group:".length).trim();
    // Signal group IDs are base64-like and case-sensitive. Preserve ID casing.
    return id ? `signal:group:${id}` : undefined;
  }

  // username:<id> 或 u:<id>
  if (lower.startsWith("username:")) {
    const id = normalized.slice("username:".length).trim();
    return id ? `signal:username:${id}`.toLowerCase() : undefined;
  }

  if (lower.startsWith("u:")) {
    const id = normalized.slice("u:".length).trim();
    return id ? `signal:username:${id}`.toLowerCase() : undefined;
  }

  // uuid:<id>
  if (lower.startsWith("uuid:")) {
    const id = normalized.slice("uuid:".length).trim();
    return id ? `signal:${id.toLowerCase()}` : undefined;
  }

  // 电话号码
  if (/^\+?\d{3,}$/.test(normalized)) {
    return `signal:${normalized}`;
  }

  // UUID
  if (UUID_PATTERN.test(normalized) || UUID_COMPACT_PATTERN.test(normalized)) {
    return `signal:${normalized.toLowerCase()}`;
  }

  return `signal:${normalized.toLowerCase()}`;
}

/**
 * 判断是否为 Signal 目标 ID
 */
export function looksLikeSignalTargetId(raw: string, normalized?: string): boolean {
  const candidates = [raw, normalized ?? ""].map((value) => value.trim()).filter(Boolean);

  for (const candidate of candidates) {
    // 带前缀
    if (/^(signal:)?(group:|username:|u:)/i.test(candidate)) {
      return true;
    }

    // uuid:<id>
    if (/^(signal:)?uuid:/i.test(candidate)) {
      const stripped = candidate
        .replace(/^signal:/i, "")
        .replace(/^uuid:/i, "")
        .trim();
      if (!stripped) {
        continue;
      }
      if (UUID_PATTERN.test(stripped) || UUID_COMPACT_PATTERN.test(stripped)) {
        return true;
      }
      continue;
    }

    // UUID (used by signal-cli for reactions)
    const withoutSignalPrefix = candidate.replace(/^signal:/i, "").trim();
    if (UUID_PATTERN.test(withoutSignalPrefix) || UUID_COMPACT_PATTERN.test(withoutSignalPrefix)) {
      return true;
    }

    // 电话号码
    if (/^\+?\d{3,}$/.test(withoutSignalPrefix)) {
      return true;
    }
  }

  return false;
}
