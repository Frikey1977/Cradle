/**
 * 心跳管理器 (HeartbeatManager)
 *
 * 负责管理Agent的心跳调度、执行和状态维护
 * 使用setTimeout链实现精确调度，支持工作时间窗口检查
 */

import type {
  HeartbeatConfig,
  HeartbeatState,
  HeartbeatEvent,
  HeartbeatEventType,
  HeartbeatManagerConfig,
  DEFAULT_HEARTBEAT_CONFIG,
  DEFAULT_HEARTBEAT_STATE,
} from "./types.js";

export class HeartbeatManager {
  private agentId: string;
  private config: HeartbeatConfig;
  private state: HeartbeatState;
  private timer: NodeJS.Timeout | null = null;
  private onExecute: (prompt: string) => Promise<string>;
  private onEvent?: (event: HeartbeatEvent) => void;
  private isBusy: boolean = false;
  private coalesceMs: number = 250;
  private pendingTrigger: boolean = false;

  constructor(managerConfig: HeartbeatManagerConfig) {
    this.agentId = managerConfig.agentId;
    this.config = managerConfig.config;
    this.onExecute = managerConfig.onExecute;
    this.onEvent = managerConfig.onEvent;
    this.state = {
      isRunning: false,
      lastRunAt: null,
      nextDueAt: null,
      consecutiveErrors: 0,
      lastError: null,
      status: "idle",
    };
  }

  start(): void {
    console.log(`[HeartbeatManager:${this.agentId}] start() called, isRunning=${this.state.isRunning}, enabled=${this.config.enabled}, interval=${this.config.intervalSeconds}s`);
    
    if (this.state.isRunning) {
      console.log(`[HeartbeatManager:${this.agentId}] Already running`);
      return;
    }

    if (!this.config.enabled) {
      console.log(`[HeartbeatManager:${this.agentId}] Heartbeat is disabled`);
      return;
    }

    this.state.isRunning = true;
    this.state.status = "idle";
    this.scheduleNext();
    this.emitEvent("started");
    console.log(`[HeartbeatManager:${this.agentId}] Started with interval ${this.config.intervalSeconds}s`);
  }

  stop(): void {
    if (!this.state.isRunning) {
      console.log(`[HeartbeatManager:${this.agentId}] Already stopped`);
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.state.isRunning = false;
    this.state.nextDueAt = null;
    this.state.status = "idle";
    this.emitEvent("stopped");
    console.log(`[HeartbeatManager:${this.agentId}] Stopped`);
  }

  triggerNow(): void {
    if (this.pendingTrigger) {
      console.log(`[HeartbeatManager:${this.agentId}] Trigger already pending, skipping`);
      return;
    }

    this.pendingTrigger = true;
    setTimeout(async () => {
      this.pendingTrigger = false;
      try {
        await this.execute(true); // true 表示强制执行，忽略 isRunning 检查
      } catch (error) {
        console.error(`[HeartbeatManager:${this.agentId}] Trigger execution failed:`, error);
      }
    }, this.coalesceMs);
  }

  updateConfig(newConfig: HeartbeatConfig): void {
    console.log(`[HeartbeatManager:${this.agentId}] Updating config, current interval=${this.config.intervalSeconds}, new interval=${newConfig.intervalSeconds}`);
    
    const wasRunning = this.state.isRunning;
    
    if (wasRunning) {
      console.log(`[HeartbeatManager:${this.agentId}] Stopping current heartbeat`);
      this.stop();
    }

    this.config = { ...newConfig };
    console.log(`[HeartbeatManager:${this.agentId}] Config updated, new interval=${this.config.intervalSeconds}s`);

    if (wasRunning && newConfig.enabled) {
      console.log(`[HeartbeatManager:${this.agentId}] Restarting with new config`);
      this.start();
    }
  }

  getState(): HeartbeatState {
    return { ...this.state };
  }

  getConfig(): HeartbeatConfig {
    return { ...this.config };
  }

  setBusy(busy: boolean): void {
    this.isBusy = busy;
  }

  private scheduleNext(): void {
    if (!this.state.isRunning || !this.config.enabled) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const intervalMs = this.config.intervalSeconds * 1000;
    const now = Date.now();
    let nextDelay = intervalMs;

    if (this.state.lastRunAt) {
      const elapsed = now - this.state.lastRunAt;
      if (elapsed < intervalMs) {
        nextDelay = intervalMs - elapsed;
      }
    }

    if (!this.isWithinActiveHours()) {
      const nextActiveTime = this.getNextActiveTime();
      console.log(`[HeartbeatManager:${this.agentId}] Outside active hours, nextActiveTime=${nextActiveTime ? new Date(nextActiveTime).toISOString() : 'null'}`);
      if (nextActiveTime !== null) {
        nextDelay = nextActiveTime - now;
        console.log(`[HeartbeatManager:${this.agentId}] nextDelay=${Math.round(nextDelay / 1000)}s until active hours`);
        if (nextDelay < 0) {
          nextDelay = intervalMs;
        }
      }
    }

    this.state.nextDueAt = now + nextDelay;
    this.state.status = "idle";

    console.log(`[HeartbeatManager:${this.agentId}] Scheduling next heartbeat in ${Math.round(nextDelay / 1000)}s`);

    this.timer = setTimeout(() => {
      this.execute();
    }, nextDelay);
  }

  private async execute(force: boolean = false): Promise<void> {
    if (!force && !this.state.isRunning) {
      console.log(`[HeartbeatManager:${this.agentId}] Heartbeat not running, skipping execution`);
      return;
    }

    if (!this.config.enabled) {
      console.log(`[HeartbeatManager:${this.agentId}] Heartbeat disabled, skipping`);
      this.emitEvent("skipped", { reason: "disabled" });
      if (!force) this.scheduleNext();
      return;
    }

    if (!force && !this.isWithinActiveHours()) {
      console.log(`[HeartbeatManager:${this.agentId}] Outside active hours, skipping`);
      this.emitEvent("skipped", { reason: "outside_active_hours" });
      if (!force) this.scheduleNext();
      return;
    }

    if (this.isBusy) {
      console.log(`[HeartbeatManager:${this.agentId}] Agent is busy, skipping`);
      this.emitEvent("skipped", { reason: "busy" });
      if (!force) this.scheduleNext();
      return;
    }

    this.state.status = "running";
    this.emitEvent("triggered");
    console.log(`[HeartbeatManager:${this.agentId}] Executing heartbeat...`);

    try {
      const result = await this.onExecute(this.config.prompt);
      
      // 只有非强制触发（定时触发）才更新 lastRunAt，避免影响原有的调度
      if (!force) {
        this.state.lastRunAt = Date.now();
      }
      this.state.consecutiveErrors = 0;
      this.state.lastError = null;
      this.state.status = "idle";

      this.emitEvent("completed", { result });
      console.log(`[HeartbeatManager:${this.agentId}] Heartbeat completed`);
    } catch (error) {
      this.state.consecutiveErrors++;
      this.state.lastError = error instanceof Error ? error.message : String(error);
      this.state.status = "error";

      this.emitEvent("error", { error: this.state.lastError });
      console.error(`[HeartbeatManager:${this.agentId}] Heartbeat error:`, error);
    }

    // 强制触发时不重新调度，只有定时触发才调度下一次
    if (!force) {
      this.scheduleNext();
    }
  }

  private isWithinActiveHours(): boolean {
    const { activeHours } = this.config;
    if (!activeHours || !activeHours.start || !activeHours.end) {
      return true;
    }

    const now = new Date();
    const timezone = activeHours.timezone || "Asia/Shanghai";
    
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      
      const parts = formatter.formatToParts(now);
      const hourPart = parts.find(p => p.type === "hour");
      const minutePart = parts.find(p => p.type === "minute");
      
      if (!hourPart || !minutePart) {
        return true;
      }

      const currentTime = parseInt(hourPart.value) * 60 + parseInt(minutePart.value);
      
      const [startHour, startMin] = activeHours.start.split(":").map(Number);
      const [endHour, endMin] = activeHours.end.split(":").map(Number);
      
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;

      if (startTime <= endTime) {
        return currentTime >= startTime && currentTime <= endTime;
      } else {
        return currentTime >= startTime || currentTime <= endTime;
      }
    } catch (error) {
      console.error(`[HeartbeatManager:${this.agentId}] Error checking active hours:`, error);
      return true;
    }
  }

  private getNextActiveTime(): number | null {
    const { activeHours } = this.config;
    if (!activeHours || !activeHours.start) {
      return null;
    }

    const now = new Date();
    const timezone = activeHours.timezone || "Asia/Shanghai";
    
    try {
      const [startHour, startMin] = activeHours.start.split(":").map(Number);
      
      const nextActive = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      nextActive.setHours(startHour, startMin, 0, 0);
      
      if (nextActive.getTime() <= now.getTime()) {
        nextActive.setDate(nextActive.getDate() + 1);
      }
      
      return nextActive.getTime();
    } catch (error) {
      console.error(`[HeartbeatManager:${this.agentId}] Error calculating next active time:`, error);
      return null;
    }
  }

  private emitEvent(type: HeartbeatEventType, data?: any): void {
    const event: HeartbeatEvent = {
      type,
      agentId: this.agentId,
      timestamp: Date.now(),
      data: {
        ...data,
        nextDueAt: this.state.nextDueAt,
      },
    };

    if (this.onEvent) {
      this.onEvent(event);
    }
  }

  /**
   * 公共方法：触发自定义事件（用于外部推送消息等场景）
   */
  emitCustomEvent(type: HeartbeatEventType, data?: any): void {
    this.emitEvent(type, data);
  }

  destroy(): void {
    this.stop();
    console.log(`[HeartbeatManager:${this.agentId}] Destroyed`);
  }
}
