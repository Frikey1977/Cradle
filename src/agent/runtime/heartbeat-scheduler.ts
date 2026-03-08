/**
 * 心跳调度器
 *
 * 管理 Agent 的心跳调度
 * 使用 setTimeout 链实现精确调度
 */

import type { AgentRuntime } from "./agent-runtime.js";
import type { HeartbeatConfig } from "../types/index.js";

/**
 * 心跳调度器
 */
export class HeartbeatScheduler {
  private agent: AgentRuntime;
  private config: HeartbeatConfig;
  private timer?: NodeJS.Timeout;
  private running = false;

  // 防抖动配置
  private static readonly DEFAULT_COALESCE_MS = 250; // 合并 250ms 内的多次请求
  private static readonly DEFAULT_RETRY_MS = 1000; // 忙时 1 秒后重试

  constructor(agent: AgentRuntime) {
    this.agent = agent;
    const config = agent.getHeartbeatConfig();

    if (!config) {
      throw new Error("Heartbeat config not found");
    }

    this.config = config;
  }

  /**
   * 启动心跳调度
   */
  start(): void {
    if (this.running) {
      console.log(`[HeartbeatScheduler] Already running`);
      return;
    }

    if (!this.config.enabled) {
      console.log(`[HeartbeatScheduler] Heartbeat disabled`);
      return;
    }

    console.log(`[HeartbeatScheduler] Starting...`);
    this.running = true;

    // 调度第一次心跳
    this.scheduleNext();
  }

  /**
   * 停止心跳调度
   */
  stop(): void {
    console.log(`[HeartbeatScheduler] Stopping...`);

    this.running = false;

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /**
   * 调度下次心跳
   */
  scheduleNext(): void {
    if (!this.running) {
      return;
    }

    // 清除现有定时器
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // 计算下次执行时间
    const intervalMs = this.parseInterval(this.config.interval);
    const nextDue = new Date(Date.now() + intervalMs);

    console.log(
      `[HeartbeatScheduler] Next heartbeat scheduled at ${nextDue.toISOString()}`,
    );

    // 设置定时器
    this.timer = setTimeout(() => {
      this.executeHeartbeat();
    }, intervalMs);
  }

  /**
   * 立即触发心跳
   */
  triggerNow(): void {
    console.log(`[HeartbeatScheduler] Triggering heartbeat immediately`);

    // 清除现有定时器
    if (this.timer) {
      clearTimeout(this.timer);
    }

    // 立即执行
    this.executeHeartbeat();
  }

  /**
   * 执行心跳
   */
  private async executeHeartbeat(): Promise<void> {
    if (!this.running) {
      return;
    }

    console.log(`[HeartbeatScheduler] Executing heartbeat`);

    try {
      // 调用 Agent 的心跳执行方法
      await this.agent.executeHeartbeat();
    } catch (error) {
      console.error(`[HeartbeatScheduler] Heartbeat execution failed:`, error);

      // 即使失败也继续调度下次心跳
      this.scheduleNext();
    }
  }

  /**
   * 解析间隔字符串为毫秒
   */
  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);

    if (!match) {
      console.warn(
        `[HeartbeatScheduler] Invalid interval format: ${interval}, using default 30m`,
      );
      return 30 * 60 * 1000; // 默认 30 分钟
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers: Record<string, number> = {
      s: 1000, // 秒
      m: 60 * 1000, // 分钟
      h: 60 * 60 * 1000, // 小时
      d: 24 * 60 * 60 * 1000, // 天
    };

    return value * (multipliers[unit] || multipliers["m"]);
  }

  /**
   * 获取下次执行时间
   */
  getNextDue(): Date | null {
    if (!this.running || !this.timer) {
      return null;
    }

    // 这里返回预估的下次执行时间
    const intervalMs = this.parseInterval(this.config.interval);
    return new Date(Date.now() + intervalMs);
  }

  /**
   * 检查是否正在运行
   */
  isRunning(): boolean {
    return this.running;
  }
}
