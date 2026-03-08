# t_scheduler_node 调度器节点表

## 表说明

| 属性 | 值 |
|-----|-----|
| 表名 | t_scheduler_node |
| 中文名 | 调度器节点表 |
| 说明 | 分布式调度器集群的节点管理和Leader选举状态 |

## 字段列表

| 序号 | 字段名称 | 数据类型 | 长度 | 必填 | 默认值 | 字段说明 |
|-----|---------|---------|-----|-----|-------|---------|
| 1 | sid | VARCHAR | 36 | 是 | UUID | 主键，节点唯一标识 |
| 2 | name | VARCHAR | 200 | 是 | - | 节点名称（如scheduler-01） |
| 3 | description | TEXT | - | 否 | NULL | 节点描述 |
| 4 | node_id | VARCHAR | 100 | 是 | - | 节点ID（hostname+pid或UUID） |
| 5 | node_address | VARCHAR | 255 | 是 | - | 节点地址（IP:Port） |
| 6 | status | VARCHAR | 20 | 是 | 'active' | 节点状态：active/inactive/down |
| 7 | is_leader | TINYINT | 1 | 是 | 0 | 是否为Leader：0=否, 1=是 |
| 8 | leader_elected_at | DATETIME | - | 否 | NULL | 当选为Leader时间 |
| 9 | last_heartbeat_at | DATETIME | - | 是 | - | 最后心跳时间 |
| 10 | heartbeat_interval_sec | INT | - | 是 | 30 | 心跳间隔（秒） |
| 11 | assigned_jobs | INT | - | 是 | 0 | 当前分配的任务数 |
| 12 | max_jobs | INT | - | 否 | NULL | 最大可处理任务数 |
| 13 | version | VARCHAR | 50 | 否 | NULL | 调度器版本 |
| 14 | metadata | JSON | - | 否 | NULL | 扩展元数据（负载、性能指标等） |
| 15 | create_time | DATETIME | - | 是 | CURRENT_TIMESTAMP | 创建时间 |
| 16 | deleted | TINYINT | 1 | 是 | 0 | 逻辑删除标记：0=未删除, 1=已删除 |
| 17 | timestamp | TIMESTAMP | - | 是 | CURRENT_TIMESTAMP ON UPDATE | 更新时间戳 |

## 字段详细说明

### node_id 节点ID

- 唯一标识一个调度器实例
- 格式建议：`{hostname}:{pid}` 或 UUID
- 重启后node_id会改变，视为新节点

### status 节点状态

| 值 | 说明 |
|-----|------|
| active | 活跃状态，正常参与调度 |
| inactive | 非活跃状态，暂停接收新任务 |
| down | 宕机状态，超过心跳超时时间 |

### is_leader Leader标识

- 集群中只有一个Leader节点
- Leader负责任务分配和调度决策
- Leader宕机后触发重新选举

### metadata 扩展元数据

```json
{
  "load": {
    "cpu_percent": 45.2,
    "memory_percent": 62.1,
    "active_goroutines": 150
  },
  "performance": {
    "avg_task_duration_ms": 1500,
    "tasks_per_minute": 120
  },
  "capabilities": ["cron", "delay", "batch"]
}
```

## Leader选举机制

### 选举流程

```
1. 节点启动时注册到t_scheduler_node
2. 检查当前是否有Leader（is_leader=1且last_heartbeat_at在超时内）
3. 如果没有Leader，尝试获取分布式锁
4. 获取锁成功后，设置is_leader=1，leader_elected_at=now()
5. 其他节点作为Follower运行
```

### 故障检测

| 场景 | 检测方式 | 处理策略 |
|-----|---------|---------|
| Leader宕机 | 心跳超时（>2×heartbeat_interval_sec） | Follower触发选举 |
| Follower宕机 | 心跳超时 | Leader将其任务重新分配 |
| 网络分区 | 心跳超时但进程存活 | 等待网络恢复或优雅降级 |

## 索引

| 索引名称 | 索引类型 | 索引字段 | 说明 |
|---------|---------|---------|------|
| pk_scheduler_node | 主键索引 | sid | 主键索引 |
| uk_scheduler_node_id | 唯一索引 | node_id | 节点ID唯一 |
| idx_scheduler_node_status | 普通索引 | status | 状态筛选 |
| idx_scheduler_node_leader | 普通索引 | is_leader | Leader查询 |
| idx_scheduler_node_heartbeat | 普通索引 | last_heartbeat_at | 心跳时间查询 |
| idx_scheduler_node_deleted | 普通索引 | deleted | 删除标记索引 |

## SQL建表语句

```sql
CREATE TABLE t_scheduler_node (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，节点唯一标识',
    name VARCHAR(200) NOT NULL COMMENT '节点名称',
    description TEXT COMMENT '节点描述',
    node_id VARCHAR(100) NOT NULL COMMENT '节点ID（hostname+pid或UUID）',
    node_address VARCHAR(255) NOT NULL COMMENT '节点地址（IP:Port）',
    status VARCHAR(20) DEFAULT 'active' COMMENT '节点状态：active/inactive/down',
    is_leader TINYINT DEFAULT 0 COMMENT '是否为Leader：0=否, 1=是',
    leader_elected_at DATETIME COMMENT '当选为Leader时间',
    last_heartbeat_at DATETIME NOT NULL COMMENT '最后心跳时间',
    heartbeat_interval_sec INT DEFAULT 30 COMMENT '心跳间隔（秒）',
    assigned_jobs INT DEFAULT 0 COMMENT '当前分配的任务数',
    max_jobs INT COMMENT '最大可处理任务数',
    version VARCHAR(50) COMMENT '调度器版本',
    metadata JSON COMMENT '扩展元数据（负载、性能指标等）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记：0=未删除, 1=已删除',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间戳',
    
    UNIQUE KEY uk_scheduler_node_id (node_id),
    INDEX idx_scheduler_node_status (status),
    INDEX idx_scheduler_node_leader (is_leader),
    INDEX idx_scheduler_node_heartbeat (last_heartbeat_at),
    INDEX idx_scheduler_node_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='调度器节点表';
```

## 关联文档

- [调度器设计](../scheduler.md)
- [定时任务表](t_cron_job.md)
- [任务执行历史表](t_cron_job_history.md)
