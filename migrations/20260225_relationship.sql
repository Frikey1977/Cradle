-- 创建 t_relationship 表 - Agent-Contact 双向关系表
-- 对应设计文档: design/memory/database/t_relationship.md
-- 注意：使用 utf8mb4_0900_ai_ci 排序规则以与现有表保持一致

CREATE TABLE IF NOT EXISTS t_relationship (
    sid VARCHAR(36) PRIMARY KEY COMMENT '主键，UUID',
    agent_id VARCHAR(36) NOT NULL COMMENT 'Agent ID，外键关联 t_agents',
    contact_id VARCHAR(36) NOT NULL COMMENT 'Contact ID，外键关联 t_contacts',
    contact_agent JSON DEFAULT NULL COMMENT 'Contact 视角：Contact 对 Agent 的偏好',
    agent_contact JSON DEFAULT NULL COMMENT 'Agent 视角：Agent 对 Contact 的学习',
    short_term_memory JSON DEFAULT NULL COMMENT '短期记忆：当前会话的近期对话历史（JSON格式）',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记: 0=未删除, 1=已删除',

    -- 联合唯一索引：确保一个 Agent-Contact 对只有一条关系记录
    UNIQUE KEY uk_agent_contact (agent_id, contact_id),

    -- 外键约束（可选，根据实际需求决定是否添加）
    -- FOREIGN KEY (agent_id) REFERENCES t_agents(sid),
    -- FOREIGN KEY (contact_id) REFERENCES t_contacts(sid),

    -- 索引
    KEY idx_agent_id (agent_id),
    KEY idx_contact_id (contact_id),
    KEY idx_deleted (deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Agent-Contact 双向关系表';

-- 如果表已存在，添加 short_term_memory 字段
ALTER TABLE t_relationship
ADD COLUMN IF NOT EXISTS short_term_memory JSON DEFAULT NULL COMMENT '短期记忆：当前会话的近期对话历史（JSON格式）';
