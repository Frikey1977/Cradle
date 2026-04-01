/**
 * Cron 任务类型定义
 *
 * 借鉴 OpenClaw 的 Cron 设计，支持多种调度类型
 */

export type ScheduleType = "at" | "every" | "cron";

export type SessionTarget = "main" | "isolated";

export type WakeMode = "now";

export type PayloadType = "systemEvent" | "agentTurn" | "skill" | "workflow";

export type DeliveryMode = "none" | "announce";

export type ExecutionStatus = "ok" | "error" | "skipped";

export interface CronJobSchedule {
  type: ScheduleType;
  at?: Date;
  interval?: number;
  expression?: string;
  timezone: string;
}

export interface CronJobPayload {
  type: PayloadType;
  content: Record<string, unknown>;
}

export interface CronJobDelivery {
  mode: DeliveryMode;
  channel?: string;
  target?: string;
  bestEffort: boolean;
}

export interface CronJobState {
  nextRunAt?: Date;
  lastRunAt?: Date;
  lastStatus?: ExecutionStatus;
  lastError?: string;
  lastDurationMs?: number;
  runCount: number;
  failCount: number;
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  agentId?: string;
  userId?: string;
  orgId?: string;
  
  schedule: CronJobSchedule;
  sessionTarget: SessionTarget;
  wakeMode: WakeMode;
  
  payload: CronJobPayload;
  delivery?: CronJobDelivery;
  
  deleteAfterRun: boolean;
  
  state: CronJobState;
  
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
}

export interface CreateCronJobParams {
  name: string;
  description?: string;
  agentId?: string;
  userId?: string;
  orgId?: string;
  
  schedule: {
    type: ScheduleType;
    at?: Date | string;
    interval?: number;
    expression?: string;
    timezone?: string;
  };
  
  sessionTarget?: SessionTarget;
  wakeMode?: WakeMode;
  
  payload: {
    type: PayloadType;
    content: Record<string, unknown>;
  };
  
  delivery?: {
    mode: DeliveryMode;
    channel?: string;
    target?: string;
    bestEffort?: boolean;
  };
  
  deleteAfterRun?: boolean;
  enabled?: boolean;
}

export interface CronJobFilter {
  agentId?: string;
  userId?: string;
  orgId?: string;
  scheduleType?: ScheduleType;
  enabled?: boolean;
  nextRunBefore?: Date;
}

export interface CronJobExecutionResult {
  jobId: string;
  worktaskId?: string;
  status: ExecutionStatus;
  error?: string;
  durationMs: number;
  executedAt: Date;
  output?: string;
}

export interface CronJobHistory {
  id: string;
  jobId: string;
  worktaskId?: string;
  status: ExecutionStatus;
  error?: string;
  durationMs: number;
  executedAt: Date;
  output?: string;
  createdAt: Date;
}

export function parseCronExpression(expression: string): {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
} {
  const parts = expression.trim().split(/\s+/);
  
  if (parts.length < 5 || parts.length > 6) {
    throw new Error(`Invalid cron expression: ${expression}`);
  }

  const offset = parts.length === 6 ? 1 : 0;
  
  return {
    minute: parts[offset],
    hour: parts[offset + 1],
    dayOfMonth: parts[offset + 2],
    month: parts[offset + 3],
    dayOfWeek: parts[offset + 4],
  };
}

export function calculateNextRun(
  schedule: CronJobSchedule,
  from: Date = new Date()
): Date | null {
  switch (schedule.type) {
    case "at":
      return schedule.at && schedule.at > from ? schedule.at : null;

    case "every":
      if (!schedule.interval || schedule.interval <= 0) {
        return null;
      }
      return new Date(from.getTime() + schedule.interval);

    case "cron":
      if (!schedule.expression) {
        return null;
      }
      return calculateNextCronRun(schedule.expression, from, schedule.timezone);

    default:
      return null;
  }
}

function calculateNextCronRun(
  expression: string,
  from: Date,
  timezone?: string
): Date {
  const parsed = parseCronExpression(expression);
  
  const now = new Date(from);
  let next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);
  
  next.setMinutes(next.getMinutes() + 1);

  const maxIterations = 366 * 24 * 60;
  for (let i = 0; i < maxIterations; i++) {
    if (matchesCron(parsed, next)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error(`Could not find next run time for expression: ${expression}`);
}

function matchesCron(parsed: ReturnType<typeof parseCronExpression>, date: Date): boolean {
  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return (
    matchesField(parsed.minute, minute, 0, 59) &&
    matchesField(parsed.hour, hour, 0, 23) &&
    matchesField(parsed.dayOfMonth, dayOfMonth, 1, 31) &&
    matchesField(parsed.month, month, 1, 12) &&
    matchesField(parsed.dayOfWeek, dayOfWeek, 0, 6)
  );
}

function matchesField(field: string, value: number, min: number, max: number): boolean {
  if (field === "*") {
    return true;
  }

  if (field.includes(",")) {
    return field.split(",").some((part) => matchesField(part.trim(), value, min, max));
  }

  if (field.includes("/")) {
    const [base, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    
    if (base === "*") {
      return (value - min) % step === 0;
    }
    
    const baseValue = parseInt(base, 10);
    return value >= baseValue && (value - baseValue) % step === 0;
  }

  if (field.includes("-")) {
    const [start, end] = field.split("-").map((s) => parseInt(s, 10));
    return value >= start && value <= end;
  }

  return parseInt(field, 10) === value;
}
