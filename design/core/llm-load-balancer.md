# 大模型多供应商负载均衡与权重调整设计

## 概述

基于响应效率审计数据，动态调整多供应商调用权重，实现智能负载均衡。

## 核心指标

### 效率评估指标

| 指标 | 权重 | 说明 | 理想值 |
|------|------|------|--------|
| **成功率** | 40% | 请求成功比例 | > 99% |
| **TTFB** | 25% | 首字节时间 | < 1s |
| **吞吐量** | 20% | tokens/秒 | > 50 |
| **成本效率** | 15% | 性价比 | 综合评分 |

### 指标计算公式

```typescript
// 效率评分 (0-100)
interface EfficiencyScore {
  successRate: number;      // 成功率 (0-100)
  ttfbScore: number;        // TTFB评分 (0-100)
  throughputScore: number;  // 吞吐量评分 (0-100)
  costScore: number;        // 成本评分 (0-100)
  total: number;            // 综合评分
}

// 计算供应商效率评分
function calculateEfficiencyScore(
  audit: AuditMetrics,
  pricing: PricingInfo
): EfficiencyScore {
  // 1. 成功率评分 (40%)
  const successRate = (audit.successCount / audit.totalCount) * 100;
  
  // 2. TTFB评分 (25%) - 越小越好
  // < 500ms = 100分, > 5000ms = 0分
  const ttfbScore = Math.max(0, 100 - (audit.avgTtfbMs - 500) / 45);
  
  // 3. 吞吐量评分 (20%) - 越大越好
  // > 100 tps = 100分, < 10 tps = 0分
  const throughputScore = Math.min(100, (audit.avgThroughput / 100) * 100);
  
  // 4. 成本评分 (15%) - 越低越好
  // 与基准价格比较
  const costScore = Math.max(0, 100 - (pricing.relativeCost - 1) * 50);
  
  // 综合评分
  const total = 
    successRate * 0.40 +
    ttfbScore * 0.25 +
    throughputScore * 0.20 +
    costScore * 0.15;
  
  return {
    successRate,
    ttfbScore,
    throughputScore,
    costScore,
    total,
  };
}
```

## 权重调整策略

### 1. 动态权重算法

```typescript
// 权重调整配置
interface WeightAdjustmentConfig {
  // 评估窗口
  evaluationWindow: number;      // 评估时间窗口（小时）
  
  // 调整阈值
  minWeight: number;             // 最小权重
  maxWeight: number;             // 最大权重
  adjustmentStep: number;        // 单次调整幅度
  
  // 触发条件
  scoreThreshold: number;        // 低于此分数触发调整
  consecutivePeriods: number;    // 连续几个周期低于阈值才调整
  
  // 冷却时间
  cooldownPeriod: number;        // 调整后冷却时间（分钟）
}

// 默认配置
const DEFAULT_ADJUSTMENT_CONFIG: WeightAdjustmentConfig = {
  evaluationWindow: 1,           // 1小时评估一次
  minWeight: 10,                 // 最小权重10%
  maxWeight: 80,                 // 最大权重80%
  adjustmentStep: 10,            // 每次调整10%
  scoreThreshold: 60,            // 低于60分触发调整
  consecutivePeriods: 2,         // 连续2个周期
  cooldownPeriod: 30,            // 30分钟冷却
};

// 权重调整器
export class WeightAdjuster {
  private config: WeightAdjustmentConfig;
  private auditRepository: AuditRepository;
  private instanceRepository: InstanceRepository;
  
  constructor(
    config: WeightAdjustmentConfig,
    auditRepo: AuditRepository,
    instanceRepo: InstanceRepository
  ) {
    this.config = config;
    this.auditRepository = auditRepo;
    this.instanceRepository = instanceRepo;
  }
  
  /**
   * 执行权重调整
   */
  async adjustWeights(configId: string): Promise<AdjustmentResult> {
    // 1. 获取所有实例
    const instances = await this.instanceRepository.findByConfigId(configId);
    
    // 2. 获取审计数据
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.config.evaluationWindow * 60 * 60 * 1000);
    
    const auditMetrics = await Promise.all(
      instances.map(instance => 
        this.auditRepository.getMetrics(instance.sid, startTime, endTime)
      )
    );
    
    // 3. 计算效率评分
    const scores = instances.map((instance, index) => ({
      instance,
      metrics: auditMetrics[index],
      score: this.calculateEfficiencyScore(auditMetrics[index]),
    }));
    
    // 4. 计算新权重
    const newWeights = this.calculateNewWeights(scores);
    
    // 5. 应用权重
    const adjustments: WeightAdjustment[] = [];
    for (const { instance, newWeight } of newWeights) {
      if (instance.weight !== newWeight) {
        await this.instanceRepository.updateWeight(instance.sid, newWeight);
        adjustments.push({
          instanceId: instance.sid,
          oldWeight: instance.weight,
          newWeight,
          reason: this.generateAdjustmentReason(scores, instance.sid),
        });
      }
    }
    
    return {
      configId,
      timestamp: new Date(),
      adjustments,
      scores: scores.map(s => ({
        instanceId: s.instance.sid,
        score: s.score.total,
        details: s.score,
      })),
    };
  }
  
  /**
   * 计算新权重
   */
  private calculateNewWeights(
    scores: Array<{ instance: Instance; metrics: AuditMetrics; score: EfficiencyScore }>
  ): Array<{ instance: Instance; newWeight: number }> {
    const totalScore = scores.reduce((sum, s) => sum + s.score.total, 0);
    
    return scores.map(({ instance, score }) => {
      // 基于评分比例分配权重
      let newWeight = (score.total / totalScore) * 100;
      
      // 应用边界限制
      newWeight = Math.max(this.config.minWeight, Math.min(this.config.maxWeight, newWeight));
      
      // 四舍五入到整数
      newWeight = Math.round(newWeight);
      
      return { instance, newWeight };
    });
  }
  
  /**
   * 生成调整原因
   */
  private generateAdjustmentReason(
    scores: Array<{ instance: Instance; score: EfficiencyScore }>,
    instanceId: string
  ): string {
    const item = scores.find(s => s.instance.sid === instanceId);
    if (!item) return 'Unknown';
    
    const reasons: string[] = [];
    
    if (item.score.successRate < 95) {
      reasons.push(`成功率低 (${item.score.successRate.toFixed(1)}%)`);
    }
    if (item.score.ttfbScore < 50) {
      reasons.push('响应慢');
    }
    if (item.score.throughputScore < 50) {
      reasons.push('吞吐量低');
    }
    if (item.score.costScore < 50) {
      reasons.push('成本高');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '性能优化';
  }
}
```

### 2. 熔断机制

```typescript
// 熔断器配置
interface CircuitBreakerConfig {
  failureThreshold: number;      // 失败阈值（连续失败次数）
  timeoutDuration: number;       // 熔断持续时间（秒）
  halfOpenRequests: number;      // 半开状态测试请求数
  slowCallThreshold: number;     // 慢调用阈值（毫秒）
}

// 熔断器
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private halfOpenSuccessCount = 0;
  
  constructor(
    private instanceId: string,
    private config: CircuitBreakerConfig
  ) {}
  
  /**
   * 记录成功
   */
  recordSuccess(): void {
    switch (this.state) {
      case 'half-open':
        this.halfOpenSuccessCount++;
        if (this.halfOpenSuccessCount >= this.config.halfOpenRequests) {
          this.close();
        }
        break;
      case 'closed':
        this.failureCount = 0;
        break;
    }
  }
  
  /**
   * 记录失败
   */
  recordFailure(): void {
    switch (this.state) {
      case 'half-open':
        this.open();
        break;
      case 'closed':
        this.failureCount++;
        if (this.failureCount >= this.config.failureThreshold) {
          this.open();
        }
        break;
    }
  }
  
  /**
   * 记录慢调用
   */
  recordSlowCall(latencyMs: number): void {
    if (latencyMs > this.config.slowCallThreshold) {
      this.failureCount += 0.5; // 慢调用算半个失败
    }
  }
  
  /**
   * 是否可以调用
   */
  canExecute(): boolean {
    if (this.state === 'closed') {
      return true;
    }
    
    if (this.state === 'open') {
      // 检查是否超过熔断时间
      if (this.lastFailureTime) {
        const elapsed = (Date.now() - this.lastFailureTime.getTime()) / 1000;
        if (elapsed >= this.config.timeoutDuration) {
          this.halfOpen();
          return true;
        }
      }
      return false;
    }
    
    // half-open 状态允许有限请求
    return this.halfOpenSuccessCount < this.config.halfOpenRequests;
  }
  
  private open(): void {
    this.state = 'open';
    this.lastFailureTime = new Date();
    console.warn(`Circuit breaker opened for instance ${this.instanceId}`);
  }
  
  private close(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.halfOpenSuccessCount = 0;
    console.info(`Circuit breaker closed for instance ${this.instanceId}`);
  }
  
  private halfOpen(): void {
    this.state = 'half-open';
    this.halfOpenSuccessCount = 0;
    console.info(`Circuit breaker half-opened for instance ${this.instanceId}`);
  }
}
```

### 3. 智能路由

```typescript
// 路由策略
enum RoutingStrategy {
  WEIGHTED_RANDOM = 'weighted_random',     // 加权随机
  ROUND_ROBIN = 'round_robin',             // 轮询
  LEAST_LATENCY = 'least_latency',         // 最低延迟
  BEST_EFFICIENCY = 'best_efficiency',     // 最佳效率
  COST_OPTIMIZED = 'cost_optimized',       // 成本优化
  PRIORITY = 'priority',                   // 优先级
}

// 智能路由器
export class SmartRouter {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private currentIndex = 0;
  
  constructor(
    private strategy: RoutingStrategy,
    private auditRepository: AuditRepository
  ) {}
  
  /**
   * 选择实例
   */
  async selectInstance(instances: Instance[]): Promise<Instance | null> {
    // 过滤掉熔断的实例
    const availableInstances = instances.filter(instance => {
      const cb = this.getCircuitBreaker(instance.sid);
      return cb.canExecute();
    });
    
    if (availableInstances.length === 0) {
      return null;
    }
    
    switch (this.strategy) {
      case RoutingStrategy.WEIGHTED_RANDOM:
        return this.weightedRandomSelect(availableInstances);
      case RoutingStrategy.ROUND_ROBIN:
        return this.roundRobinSelect(availableInstances);
      case RoutingStrategy.LEAST_LATENCY:
        return await this.leastLatencySelect(availableInstances);
      case RoutingStrategy.BEST_EFFICIENCY:
        return await this.bestEfficiencySelect(availableInstances);
      case RoutingStrategy.COST_OPTIMIZED:
        return await this.costOptimizedSelect(availableInstances);
      default:
        return this.weightedRandomSelect(availableInstances);
    }
  }
  
  /**
   * 加权随机选择
   */
  private weightedRandomSelect(instances: Instance[]): Instance {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0];
  }
  
  /**
   * 轮询选择
   */
  private roundRobinSelect(instances: Instance[]): Instance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }
  
  /**
   * 最低延迟选择
   */
  private async leastLatencySelect(instances: Instance[]): Promise<Instance> {
    const latencies = await Promise.all(
      instances.map(async instance => {
        const metrics = await this.auditRepository.getRecentMetrics(instance.sid, 10);
        return {
          instance,
          avgLatency: metrics.avgTtfbMs,
        };
      })
    );
    
    latencies.sort((a, b) => a.avgLatency - b.avgLatency);
    return latencies[0].instance;
  }
  
  /**
   * 最佳效率选择
   */
  private async bestEfficiencySelect(instances: Instance[]): Promise<Instance> {
    const scores = await Promise.all(
      instances.map(async instance => {
        const metrics = await this.auditRepository.getRecentMetrics(instance.sid, 100);
        return {
          instance,
          score: this.calculateEfficiencyScore(metrics),
        };
      })
    );
    
    scores.sort((a, b) => b.score.total - a.score.total);
    return scores[0].instance;
  }
  
  /**
   * 成本优化选择
   */
  private async costOptimizedSelect(instances: Instance[]): Promise<Instance> {
    // 综合考虑成本和性能
    const scores = await Promise.all(
      instances.map(async instance => {
        const metrics = await this.auditRepository.getRecentMetrics(instance.sid, 100);
        const pricing = await this.getPricing(instance.modelId);
        
        // 性价比评分 = 性能 / 成本
        const performanceScore = this.calculateEfficiencyScore(metrics).total;
        const costScore = 100 / (pricing.inputPrice + pricing.outputPrice);
        const valueScore = performanceScore * costScore;
        
        return {
          instance,
          valueScore,
        };
      })
    );
    
    scores.sort((a, b) => b.valueScore - a.valueScore);
    return scores[0].instance;
  }
  
  private getCircuitBreaker(instanceId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(instanceId)) {
      this.circuitBreakers.set(instanceId, new CircuitBreaker(instanceId, {
        failureThreshold: 5,
        timeoutDuration: 60,
        halfOpenRequests: 3,
        slowCallThreshold: 10000,
      }));
    }
    return this.circuitBreakers.get(instanceId)!;
  }
}
```

## 自动化调度

### 定时任务配置

```typescript
// 调度器
export class LoadBalancerScheduler {
  private weightAdjuster: WeightAdjuster;
  private isRunning = false;
  
  constructor(weightAdjuster: WeightAdjuster) {
    this.weightAdjuster = weightAdjuster;
  }
  
  /**
   * 启动调度器
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // 每5分钟执行一次权重调整
    setInterval(async () => {
      await this.runAdjustment();
    }, 5 * 60 * 1000);
    
    console.info('Load balancer scheduler started');
  }
  
  /**
   * 执行权重调整
   */
  private async runAdjustment(): Promise<void> {
    try {
      // 获取所有配置
      const configs = await this.getAllConfigs();
      
      for (const config of configs) {
        // 检查是否需要调整
        const needsAdjustment = await this.checkNeedsAdjustment(config.sid);
        
        if (needsAdjustment) {
          const result = await this.weightAdjuster.adjustWeights(config.sid);
          
          // 记录调整日志
          await this.logAdjustment(result);
          
          // 发送通知（如果有重大调整）
          if (result.adjustments.length > 0) {
            await this.notifyAdjustment(result);
          }
        }
      }
    } catch (error) {
      console.error('Weight adjustment failed:', error);
    }
  }
  
  /**
   * 检查是否需要调整
   */
  private async checkNeedsAdjustment(configId: string): Promise<boolean> {
    // 获取最近一次的调整时间
    const lastAdjustment = await this.getLastAdjustmentTime(configId);
    
    if (!lastAdjustment) {
      return true;
    }
    
    // 检查是否超过冷却时间
    const elapsed = Date.now() - lastAdjustment.getTime();
    const cooldownMs = 30 * 60 * 1000; // 30分钟
    
    return elapsed >= cooldownMs;
  }
}
```

## Web UI 监控

### 效率监控面板

```
┌─────────────────────────────────────────────────────────────┐
│  供应商效率监控                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  OpenAI (权重: 40%)                                         │
│  ├─ 成功率: 99.8% ████████████████████░░ 98分              │
│  ├─ TTFB: 450ms █████████████████████░░░ 85分              │
│  ├─ 吞吐量: 85 tps █████████████████░░░░ 80分              │
│  └─ 成本: $5/M ████████████████░░░░░░░░░ 70分              │
│     综合评分: 84.2                                          │
│                                                             │
│  Anthropic (权重: 35%)                                      │
│  ├─ 成功率: 99.5% ███████████████████░░░ 96分              │
│  ├─ TTFB: 380ms ██████████████████████░░ 90分              │
│  ├─ 吞吐量: 72 tps ████████████████░░░░░ 70分              │
│  └─ 成本: $3/M ████████████████████░░░░░ 80分              │
│     综合评分: 86.4                                          │
│                                                             │
│  阿里千问 (权重: 25%)                                       │
│  ├─ 成功率: 99.2% ██████████████████░░░░ 94分              │
│  ├─ TTFB: 520ms ███████████████████░░░░░ 78分              │
│  ├─ 吞吐量: 65 tps ███████████████░░░░░░ 65分              │
│  └─ 成本: ¥0.04/1K █████████████████████ 95分              │
│     综合评分: 83.6                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 权重调整历史

```
┌─────────────────────────────────────────────────────────────┐
│  权重调整历史                                                │
├─────────────────────────────────────────────────────────────┤
│  时间              │ 供应商      │ 旧权重 │ 新权重 │ 原因   │
├───────────────────┼───────────┼───────┼───────┼───────┤
│  2024-01-15 14:30 │ OpenAI    │ 50%   │ 40%   │ 成本高 │
│  2024-01-15 14:30 │ Anthropic │ 30%   │ 35%   │ 性能优 │
│  2024-01-15 10:00 │ 阿里千问  │ 20%   │ 25%   │ 性价比 │
│  2024-01-14 16:00 │ OpenAI    │ 60%   │ 50%   │ 响应慢 │
└─────────────────────────────────────────────────────────────┘
```

## 配置建议

### 不同场景的路由策略

| 场景 | 推荐策略 | 说明 |
|------|---------|------|
| **生产环境** | WEIGHTED_RANDOM | 均衡负载，容错性好 |
| **性能优先** | BEST_EFFICIENCY | 选择当前表现最好的 |
| **成本敏感** | COST_OPTIMIZED | 性价比最优 |
| **实时应用** | LEAST_LATENCY | 最低延迟 |
| **测试环境** | ROUND_ROBIN | 均匀测试各供应商 |

### 权重调整参数建议

| 参数 | 保守设置 | 激进设置 |
|------|---------|---------|
| evaluationWindow | 4小时 | 30分钟 |
| adjustmentStep | 5% | 20% |
| scoreThreshold | 70 | 50 |
| consecutivePeriods | 3 | 1 |
| cooldownPeriod | 60分钟 | 10分钟 |
