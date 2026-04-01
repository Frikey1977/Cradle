# Cron 调度器设计

## 概述

Cron调度器是定时任务模块的核心组件，负责任务的调度计算、触发时机判断和执行触发。采用分布式设计，支持高可用和水平扩展。

## 核心职责

| 职责 | 说明 |
|------|------|
| **调度计算** | 根据任务配置计算下次执行时间 |
| **触发管理** | 维护待触发任务队列，准时触发 |
| **状态管理** | 跟踪任务执行状态和历史 |
| **容错处理** | 处理调度器故障转移和任务补偿 |

## 调度器架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Cron 调度器架构                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      调度器集群（Scheduler Cluster）              │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ Scheduler-1 │  │ Scheduler-2 │  │ Scheduler-N │             │   │
│  │  │  (Master)   │  │  (Slave)    │  │  (Slave)    │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  │         │                │                │                    │   │
│  │         └────────────────┴────────────────┘                    │   │
│  │                            │                                   │   │
│  │                    Leader Election                            │   │
│  │                   (基于数据库或Redis)                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      调度核心组件                                │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ 时间轮算法   │  │ 任务队列     │  │ 触发器       │             │   │
│  │  │ Time Wheel  │  │ Job Queue   │  │ Trigger     │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ 调度计算器   │  │ 状态管理器   │  │ 补偿执行器   │             │   │
│  │  │ Calculator  │  │ State Mgr   │  │ Compensator │             │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      数据存储层                                  │   │
│  │                                                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │   │
│  │  │ 任务配置表   │  │ 执行历史表   │             │   │
│  │  │ t_cron_job  │  │ t_cron_job_history│         │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 调度算法

### 时间轮算法（Time Wheel）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        分层时间轮设计                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  秒级时间轮（60槽）                                                       │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                            │
│  │ 0  │ 1  │ 2  │ ...│ 58 │ 59 │    │    │  ← 当前秒                   │
│  └────┴────┴────┴────┴────┴────┴────┴────┘                            │
│       │                                                            │   │
│       ▼                                                            │   │
│  任务列表：[job-001, job-002]                                        │   │
│                                                                     │   │
│  分钟级时间轮（60槽）                                                    │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                            │
│  │ 0  │ 1  │ 2  │ ...│ 58 │ 59 │    │    │  ← 当前分钟                 │
│  └────┴────┴────┴────┴────┴────┴────┴────┘                            │
│       │                                                            │   │
│       ▼                                                            │   │
│  任务列表：[job-003]                                                 │   │
│                                                                     │   │
│  小时级时间轮（24槽）                                                    │
│  ┌────┬────┬────┬────┬────┬────┬────┬────┐                            │
│  │ 0  │ 1  │ 2  │ ...│ 22 │ 23 │    │    │  ← 当前小时                 │
│  └────┴────┴────┴────┴────┴────┴────┴────┘                            │
│                                                                     │   │
└─────────────────────────────────────────────────────────────────────────┘
```

**算法说明**：
- 秒级时间轮：处理精确到秒的触发（at类型、短间隔every类型）
- 分钟级时间轮：处理分钟级触发（cron类型、长间隔every类型）
- 小时级时间轮：处理小时级触发（低频任务）
- 槽位溢出时，任务升级到上一级时间轮

### 调度计算

```typescript
interface ScheduleCalculator {
  // 计算下次执行时间
  calculateNextRun(job: CronJob): Date;
  
  // 验证调度表达式
  validateSchedule(type: string, expression: string): boolean;
  
  // 获取时间范围内的所有触发点
  getTriggerPoints(job: CronJob, start: Date, end: Date): Date[];
}

// 调度类型处理
class ScheduleCalculator {
  calculateNextRun(job: CronJob): Date {
    switch (job.scheduleType) {
      case 'at':
        return this.calculateAt(job.scheduleAt);
      case 'every':
        return this.calculateEvery(job.scheduleInterval, job.state_last_run_at);
      case 'cron':
        return this.calculateCron(job.scheduleExpression, job.scheduleTimezone);
      default:
        throw new Error(`Unknown schedule type: ${job.scheduleType}`);
    }
  }
  
  // at类型：指定时间执行一次
  private calculateAt(scheduleAt: Date): Date {
    return scheduleAt;
  }
  
  // every类型：按固定间隔重复
  private calculateEvery(intervalMs: number, lastRunAt?: Date): Date {
    const baseTime = lastRunAt || new Date();
    return new Date(baseTime.getTime() + intervalMs);
  }
  
  // cron类型：Cron表达式
  private calculateCron(expression: string, timezone: string): Date {
    // 使用cron-parser库解析
    const interval = parseExpression(expression, { tz: timezone });
    return interval.next().toDate();
  }
}
```

## 调度流程

### 正常调度流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        正常调度流程                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 任务注册                                                             │
│     ├── 用户创建定时任务                                                 │
│     ├── 计算首次执行时间                                                 │
│     └── 插入时间轮对应槽位                                               │
│                                                                         │
│  2. 时间轮扫描                                                           │
│     ├── 每秒扫描秒级时间轮                                               │
│     ├── 每分钟扫描分钟级时间轮                                           │
│     └── 提取当前槽位的任务列表                                           │
│                                                                         │
│  3. 任务触发                                                             │
│     ├── 检查任务状态（是否启用）                                         │
│     ├── 检查执行条件（如并发限制）                                       │
│     ├── 更新下次执行时间                                                 │
│     └── 发送执行消息到队列                                               │
│                                                                         │
│  4. 执行器处理                                                           │
│     ├── 消费执行消息                                                     │
│     ├── 根据payload_type路由                                             │
│     ├── 执行Agent/Skill/Workflow                                         │
│     └── 记录执行结果                                                     │
│                                                                         │
│  5. 状态更新                                                             │
│     ├── 更新state_last_run_at                                           │
│     ├── 更新state_last_status                                           │
│     ├── 更新state_next_run_at                                           │
│     └── 重新插入时间轮（重复任务）                                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 容错处理流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        容错处理流程                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  调度器故障检测                                                          │
│     ├── 心跳机制：调度器定期上报心跳                                     │
│     ├── 超时判定：超过30秒无心跳视为故障                                 │
│     └── Leader选举：从节点竞争成为新Master                               │
│                                                                         │
│  任务接管流程                                                            │
│     ├── 新Master读取所有待执行任务                                       │
│     ├── 重新计算每个任务的下次执行时间                                   │
│     ├── 重建时间轮状态                                                   │
│     └── 继续正常调度                                                     │
│                                                                         │
│  执行超时处理                                                            │
│     ├── 设置任务执行超时（如5分钟）                                      │
│     ├── 超时后标记为失败                                                 │
│     └── 根据重试策略决定是否重试                                         │
│                                                                         │
│  执行失败补偿                                                            │
│     ├── 记录失败原因                                                     │
│     ├── 连续失败计数                                                     │
│     ├── 超过阈值暂停任务                                                 │
│     └── 发送告警通知                                                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 核心组件设计

### 1. 时间轮（TimeWheel）

```typescript
interface TimeWheel {
  // 槽位数量
  slots: number;
  
  // 每个槽位的时间跨度
  tickMs: number;
  
  // 当前指针位置
  currentSlot: number;
  
  // 添加任务到时间轮
  add(job: CronJob, triggerTime: Date): void;
  
  // 推进时间轮
  advance(): CronJob[];
  
  // 移除任务
  remove(jobId: string): void;
}

class HierarchicalTimeWheel {
  private wheels: TimeWheel[] = [
    { slots: 60, tickMs: 1000 },    // 秒级：60秒
    { slots: 60, tickMs: 60000 },   // 分钟级：60分钟
    { slots: 24, tickMs: 3600000 }  // 小时级：24小时
  ];
  
  add(job: CronJob, triggerTime: Date): void {
    const delay = triggerTime.getTime() - Date.now();
    
    // 根据延迟选择合适的层级
    if (delay < 60000) {
      this.wheels[0].add(job, triggerTime);
    } else if (delay < 3600000) {
      this.wheels[1].add(job, triggerTime);
    } else {
      this.wheels[2].add(job, triggerTime);
    }
  }
}
```

### 2. 任务队列（JobQueue）

```typescript
interface JobQueue {
  // 待执行任务队列（按触发时间排序）
  pendingJobs: PriorityQueue<CronJob>;
  
  // 正在执行的任务
  runningJobs: Map<string, JobExecution>;
  
  // 入队
  enqueue(job: CronJob): void;
  
  // 出队（获取到期的任务）
  dequeue(currentTime: Date): CronJob[];
  
  // 标记执行中
  markRunning(jobId: string, execution: JobExecution): void;
  
  // 标记完成
  markComplete(jobId: string, result: ExecutionResult): void;
}
```

### 3. 触发器（Trigger）

```typescript
interface Trigger {
  // 触发任务执行
  fire(job: CronJob): Promise<void>;
  
  // 根据payload_type路由到不同执行器
  route(job: CronJob): Executor;
}

class CronTrigger implements Trigger {
  async fire(job: CronJob): Promise<void> {
    const executor = this.route(job);
    
    try {
      // 更新状态为执行中
      await this.updateJobState(job.sid, { status: 'running' });
      
      // 执行
      const result = await executor.execute(job);
      
      // 更新状态为完成
      await this.updateJobState(job.sid, {
        status: 'completed',
        lastStatus: 'ok',
        lastDuration: result.duration
      });
      
    } catch (error) {
      // 更新状态为失败
      await this.updateJobState(job.sid, {
        status: 'failed',
        lastStatus: 'error',
        lastError: error.message,
        failCount: job.stateFailCount + 1
      });
    }
  }
  
  route(job: CronJob): Executor {
    switch (job.payloadType) {
      case 'agentTurn':
        return new AgentExecutor();
      case 'skill':
        return new SkillExecutor();
      case 'workflow':
        return new WorkflowExecutor();
      default:
        throw new Error(`Unknown payload type: ${job.payloadType}`);
    }
  }
}
```

## 高可用设计

### Leader选举

```typescript
interface LeaderElection {
  // 尝试成为Leader
  tryBecomeLeader(): Promise<boolean>;
  
  // 维持Leader身份（心跳）
  keepAlive(): Promise<void>;
  
  // 监听Leader变化
  onLeaderChange(callback: (leaderId: string) => void): void;
}

class DatabaseLeaderElection implements LeaderElection {
  private readonly leaseDuration = 30000; // 30秒租期
  
  async tryBecomeLeader(): Promise<boolean> {
    try {
      await db.query(`
        INSERT INTO t_cron_leader (id, node_id, expire_at)
        VALUES (1, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))
        ON DUPLICATE KEY UPDATE
          node_id = IF(expire_at < NOW(), VALUES(node_id), node_id),
          expire_at = IF(node_id = VALUES(node_id), VALUES(expire_at), expire_at)
      `, [this.nodeId, this.leaseDuration / 1000]);
      
      // 检查是否成功
      const result = await db.query(`
        SELECT node_id FROM t_cron_leader WHERE id = 1
      `);
      
      return result[0].node_id === this.nodeId;
    } catch (error) {
      return false;
    }
  }
}
```

### 任务幂等性

```typescript
interface IdempotentExecution {
  // 生成执行ID（基于任务ID和执行时间）
  generateExecutionId(jobId: string, triggerTime: Date): string;
  
  // 检查是否已执行
  isExecuted(executionId: string): Promise<boolean>;
  
  // 记录执行
  recordExecution(executionId: string, result: ExecutionResult): Promise<void>;
}
```

## 性能优化

### 1. 批量处理

```typescript
// 批量获取到期任务
async function getDueJobsBatch(currentTime: Date, batchSize: number = 100): Promise<CronJob[]> {
  return db.query(`
    SELECT * FROM t_cron_job
    WHERE state_next_run_at <= ?
      AND status = 1
      AND deleted = 0
    ORDER BY state_next_run_at ASC
    LIMIT ?
  `, [currentTime, batchSize]);
}
```

### 2. 内存缓存

```typescript
interface JobCache {
  // 热点任务缓存（高频执行的任务）
  hotJobs: LRUCache<string, CronJob>;
  
  // 缓存最近1分钟要执行的任务
  nearTermJobs: CronJob[];
  
  // 刷新缓存
  refresh(): void;
}
```

### 3. 分片调度

```typescript
// 多调度器时分片
function getShardFilter(nodeId: string, totalNodes: number): string {
  // 根据任务ID哈希分片
  return `MOD(CONV(LEFT(sid, 8), 16, 10), ${totalNodes}) = ${getNodeIndex(nodeId)}`;
}
```

## 监控指标

| 指标 | 说明 | 告警阈值 |
|-----|------|---------|
| scheduler_lag | 调度延迟（实际触发-计划触发） | > 5s |
| job_queue_size | 待处理任务队列长度 | > 1000 |
| execution_success_rate | 任务执行成功率 | < 95% |
| leader_election_count | Leader选举次数 | > 10/小时 |
| time_wheel_utilization | 时间轮槽位利用率 | > 80% |

## 数据库表

### 调度状态表

```sql
CREATE TABLE t_cron_scheduler_state (
    id VARCHAR(36) PRIMARY KEY COMMENT '调度器节点ID',
    node_id VARCHAR(36) NOT NULL COMMENT '节点标识',
    is_leader TINYINT DEFAULT 0 COMMENT '是否为Leader: 0=否, 1=是',
    last_heartbeat DATETIME COMMENT '最后心跳时间',
    active_jobs INT DEFAULT 0 COMMENT '当前活跃任务数',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_leader (is_leader),
    INDEX idx_heartbeat (last_heartbeat)
) ENGINE=InnoDB COMMENT='调度器状态表';
```

### Leader选举表

```sql
CREATE TABLE t_cron_leader (
    id INT PRIMARY KEY DEFAULT 1 COMMENT '固定ID=1',
    node_id VARCHAR(36) NOT NULL COMMENT '当前Leader节点ID',
    expire_at DATETIME NOT NULL COMMENT '租期过期时间',
    INDEX idx_expire (expire_at)
) ENGINE=InnoDB COMMENT='Leader选举表';
```

## 关联文档

- [定时任务模块 README](./README.md)
- [定时任务表](./database/t_cron_job.md)
- [定时任务执行历史表](./database/t_cron_job_history.md)
- [Cron CLI](./cron-cli.md)
