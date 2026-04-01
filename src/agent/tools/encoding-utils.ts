// 缓存 iconv-lite 模块
let iconvLite: any = null;

async function decodeGBK(buffer: Buffer): Promise<string> {
  if (!iconvLite) {
    try {
      iconvLite = await import("iconv-lite");
    } catch {
      // 如果 iconv-lite 不可用，使用 latin1 作为后备
      return buffer.toString("latin1");
    }
  }
  return iconvLite.decode(buffer, "gbk");
}

// 智能解码：尝试 UTF-8，失败则使用 GBK
export async function smartDecode(buffer: Buffer): Promise<string> {
  try {
    const utf8Str = buffer.toString("utf8");
    // 检查是否有乱码字符
    if (!utf8Str.includes("�")) {
      return utf8Str;
    }
  } catch {}
  return decodeGBK(buffer);
}
