/**
 * 工具上下文定义
 * 
 * 提供工具执行时所需的上下文信息
 */

export interface ToolContext {
  /** 工具调用 ID */
  toolCallId: string;
  
  /** 取消信号 */
  abortSignal?: AbortSignal;
  
  /** 会话 ID */
  sessionId?: string;
  
  /** 消息 ID */
  messageId?: string;
  
  /** Agent 名称 */
  agentName?: string;
  
  /** 工作目录 */
  workingDirectory?: string;
  
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}
