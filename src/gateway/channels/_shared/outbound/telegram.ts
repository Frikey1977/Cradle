/**
 * Telegram 发送消息适配器
 * 从 OpenClaw 提取并适配
 * 原文件: openclaw/src/channels/plugins/outbound/telegram.ts
 */

import type { SendTextParams, SendMediaParams, SendResult, OutboundAdapter } from "./types.js";

/**
 * Telegram HTML 格式化辅助函数
 * 将 Markdown 转换为 Telegram HTML
 */
export function markdownToTelegramHtml(text: string): string {
  // 简单的 Markdown → HTML 转换
  // **bold** → <b>bold</b>
  // *italic* → <i>italic</i>
  // `code` → <code>code</code>
  // ```code``` → <pre>code</pre>
  // [text](url) → <a href="url">text</a>
  
  let html = text
    .replace(/```([\s\S]*?)```/g, "<pre>$1</pre>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*]+)\*/g, "<i>$1</i>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  return html;
}

/**
 * 将长文本分块
 * Telegram 限制 4096 字符
 */
export function chunkText(text: string, limit: number = 4000): string[] {
  if (text.length <= limit) {
    return [text];
  }
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }
    
    // 在限制范围内找最后一个换行符
    let cutIndex = remaining.lastIndexOf("\n", limit);
    if (cutIndex === -1 || cutIndex < limit * 0.8) {
      // 如果没有换行符或换行符太靠前，直接截断
      cutIndex = limit;
    }
    
    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex).trim();
  }
  
  return chunks;
}

/**
 * 解析回复消息ID
 */
function parseReplyToMessageId(replyToId?: string | null): number | undefined {
  if (!replyToId) return undefined;
  const parsed = parseInt(replyToId, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * 解析线程ID
 */
function parseThreadId(threadId?: string | number | null): number | undefined {
  if (threadId == null) return undefined;
  if (typeof threadId === "number") return threadId;
  const parsed = parseInt(threadId, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Telegram Outbound 适配器
 * 
 * 注意：这是一个适配器框架，实际的 sendMessageTelegram 函数
 * 需要在具体实现中提供，调用 Telegram Bot API
 */
export function createTelegramOutboundAdapter(
  sendMessage: (params: {
    to: string;
    text: string;
    textMode: "html" | "markdown";
    messageThreadId?: number;
    replyToMessageId?: number;
    accountId?: string;
  }) => Promise<{ messageId: string; chatId: string }>,
): OutboundAdapter {
  return {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    
    async sendText(params: SendTextParams): Promise<SendResult> {
      const replyToMessageId = parseReplyToMessageId(params.replyToId);
      const messageThreadId = parseThreadId(params.threadId);
      
      // 转换 Markdown 为 HTML
      const htmlText = markdownToTelegramHtml(params.text);
      
      // 分块发送（如果超长）
      const chunks = chunkText(htmlText, 4000);
      let lastResult: { messageId: string; chatId: string } | undefined;
      
      for (let i = 0; i < chunks.length; i++) {
        const isLast = i === chunks.length - 1;
        const result = await sendMessage({
          to: params.to,
          text: chunks[i],
          textMode: "html",
          messageThreadId,
          // 只有最后一块才带回复标记
          replyToMessageId: isLast ? replyToMessageId : undefined,
          accountId: params.accountId ?? undefined,
        });
        lastResult = result;
      }
      
      return {
        channel: "telegram",
        messageId: lastResult?.messageId ?? "unknown",
        chatId: lastResult?.chatId ?? params.to,
      };
    },
    
    async sendMedia(params: SendMediaParams): Promise<SendResult> {
      const replyToMessageId = parseReplyToMessageId(params.replyToId);
      const messageThreadId = parseThreadId(params.threadId);
      
      // 媒体消息通常直接发送，不转换格式
      const result = await sendMessage({
        to: params.to,
        text: params.text,
        textMode: "html",
        messageThreadId,
        replyToMessageId,
        accountId: params.accountId ?? undefined,
      });
      
      return {
        channel: "telegram",
        messageId: result.messageId,
        chatId: result.chatId,
      };
    },
  };
}
