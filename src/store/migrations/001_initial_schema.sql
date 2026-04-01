-- ============================================
-- 初始数据库迁移脚本
-- 创建所有必要的表结构
-- ============================================

-- --------------------------------------------
-- 系统模块表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_module (
    sid VARCHAR(36) PRIMARY KEY COMMENT '模块ID',
    name VARCHAR(200) NOT NULL COMMENT '模块名称',
    code VARCHAR(100) NOT NULL COMMENT '模块代码',
    description TEXT COMMENT '模块描述',
    icon VARCHAR(100) COMMENT '模块图标',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_module_code (code),
    INDEX idx_module_status (status),
    INDEX idx_module_deleted (deleted)
) COMMENT='系统模块表';

-- --------------------------------------------
-- 角色表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_roles (
    sid VARCHAR(36) PRIMARY KEY COMMENT '角色ID',
    name VARCHAR(200) NOT NULL COMMENT '角色名称',
    title VARCHAR(200) COMMENT '多语言标签',
    description TEXT COMMENT '角色描述',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_roles_status (status),
    INDEX idx_roles_deleted (deleted)
) COMMENT='角色表';

-- --------------------------------------------
-- 用户表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_user (
    sid VARCHAR(36) PRIMARY KEY COMMENT '用户ID',
    username VARCHAR(100) NOT NULL COMMENT '用户名',
    password VARCHAR(255) NOT NULL COMMENT '密码哈希',
    name VARCHAR(200) COMMENT '显示名称',
    email VARCHAR(200) COMMENT '邮箱',
    phone VARCHAR(50) COMMENT '电话',
    avatar VARCHAR(500) COMMENT '头像URL',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_user_username (username),
    INDEX idx_user_status (status),
    INDEX idx_user_deleted (deleted)
) COMMENT='用户表';

-- --------------------------------------------
-- 用户角色关联表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS r_user_role (
    user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
    role_id VARCHAR(36) NOT NULL COMMENT '角色ID',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (user_id, role_id),
    INDEX idx_user_role_role (role_id)
) COMMENT='用户角色关联表';

-- --------------------------------------------
-- 技能表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_skills (
    sid VARCHAR(36) PRIMARY KEY COMMENT '技能ID',
    name VARCHAR(200) NOT NULL COMMENT '技能名称',
    code VARCHAR(100) NOT NULL COMMENT '技能代码',
    description TEXT COMMENT '技能描述',
    type VARCHAR(50) DEFAULT 'custom' COMMENT '类型: system/custom',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_skills_code (code),
    INDEX idx_skills_status (status),
    INDEX idx_skills_deleted (deleted)
) COMMENT='技能表';

-- --------------------------------------------
-- LLM 提供商表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_llm_providers (
    sid VARCHAR(36) PRIMARY KEY COMMENT '提供商ID',
    name VARCHAR(100) NOT NULL COMMENT '提供商标识名',
    title VARCHAR(200) COMMENT '多语言标签',
    ename VARCHAR(200) NOT NULL COMMENT '英文名',
    description TEXT COMMENT '提供商描述',
    icon VARCHAR(100) COMMENT '图标',
    color VARCHAR(20) COMMENT '主题颜色',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_providers_name (name),
    INDEX idx_providers_status (status),
    INDEX idx_providers_deleted (deleted)
) COMMENT='大模型提供商表';

-- --------------------------------------------
-- LLM 配置表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_llm_configs (
    sid VARCHAR(36) PRIMARY KEY COMMENT '配置ID',
    name VARCHAR(200) NOT NULL COMMENT '配置名称',
    description TEXT COMMENT '配置描述',
    provider_id VARCHAR(36) NOT NULL COMMENT '关联提供商ID',
    base_url VARCHAR(512) NOT NULL COMMENT 'API基础地址',
    subscribe_type VARCHAR(50) DEFAULT 'usage' COMMENT '订阅类型',
    icon VARCHAR(255) COMMENT '配置图标',
    model_name VARCHAR(200) NOT NULL COMMENT '模型名称',
    model_type VARCHAR(50) DEFAULT 'text' COMMENT '模型类别',
    context_size INT DEFAULT 8192 COMMENT '上下文窗口大小',
    parameters JSON COMMENT '模型调用参数',
    enable_thinking VARCHAR(20) DEFAULT 'disabled' COMMENT '思考模式',
    stream VARCHAR(20) DEFAULT 'enabled' COMMENT '流式输出',
    auth_method VARCHAR(50) DEFAULT 'api_key' COMMENT '认证方式',
    provider_name VARCHAR(100) COMMENT '提供商名称',
    model_ability JSON COMMENT '模型能力',
    timeout INT DEFAULT 30000 COMMENT '超时时间（毫秒）',
    retries INT DEFAULT 3 COMMENT '重试次数',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_configs_provider (provider_id),
    INDEX idx_configs_status (status),
    INDEX idx_configs_deleted (deleted)
) COMMENT='大模型配置表';

-- --------------------------------------------
-- LLM 实例表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_llm_instances (
    sid VARCHAR(36) PRIMARY KEY COMMENT '实例ID',
    name VARCHAR(200) NOT NULL COMMENT '实例名称',
    description TEXT COMMENT '实例描述',
    config_id VARCHAR(36) NOT NULL COMMENT '关联配置ID',
    api_key VARCHAR(500) NOT NULL COMMENT 'API Key（加密存储）',
    api_key_hash VARCHAR(64) NOT NULL COMMENT 'API Key哈希',
    headers JSON COMMENT '自定义请求头',
    billing_type VARCHAR(50) DEFAULT 'usage' COMMENT '计费类型',
    weight INT DEFAULT 1 COMMENT '轮询权重',
    rpm_limit INT COMMENT '每分钟请求限制',
    tpm_limit INT COMMENT '每分钟Token限制',
    daily_quota BIGINT COMMENT '每日Token配额',
    daily_used BIGINT DEFAULT 0 COMMENT '今日已使用量',
    fail_count INT DEFAULT 0 COMMENT '连续失败次数',
    cooldown_until DATETIME COMMENT '冷却截止时间',
    last_used_at DATETIME COMMENT '最后使用时间',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态: enabled/disabled',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_instances_config (config_id),
    INDEX idx_instances_status (status),
    INDEX idx_instances_deleted (deleted)
) COMMENT='大模型实例表';

-- --------------------------------------------
-- 组织架构表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_org (
    sid VARCHAR(36) PRIMARY KEY COMMENT '组织ID',
    name VARCHAR(200) NOT NULL COMMENT '组织名称',
    description TEXT COMMENT '组织描述',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_org_status (status),
    INDEX idx_org_deleted (deleted)
) COMMENT='组织架构表';

-- --------------------------------------------
-- 部门表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_dept (
    sid VARCHAR(36) PRIMARY KEY COMMENT '部门ID',
    name VARCHAR(200) NOT NULL COMMENT '部门名称',
    pid VARCHAR(36) COMMENT '父部门ID',
    org_id VARCHAR(36) COMMENT '组织ID',
    sort INT DEFAULT 0 COMMENT '显示顺序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_dept_pid (pid),
    INDEX idx_dept_org (org_id),
    INDEX idx_dept_status (status),
    INDEX idx_dept_deleted (deleted)
) COMMENT='部门表';

-- --------------------------------------------
-- 员工表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_employee (
    sid VARCHAR(36) PRIMARY KEY COMMENT '员工ID',
    name VARCHAR(200) NOT NULL COMMENT '姓名',
    e_name VARCHAR(200) COMMENT '英文名',
    user_id VARCHAR(36) COMMENT '关联用户ID',
    dept_id VARCHAR(36) COMMENT '部门ID',
    position_id VARCHAR(36) COMMENT '职位ID',
    email VARCHAR(200) COMMENT '邮箱',
    phone VARCHAR(50) COMMENT '电话',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_emp_user (user_id),
    INDEX idx_emp_dept (dept_id),
    INDEX idx_emp_status (status),
    INDEX idx_emp_deleted (deleted)
) COMMENT='员工表';

-- --------------------------------------------
-- 联系人表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_contacts (
    sid VARCHAR(36) PRIMARY KEY COMMENT '联系人ID',
    name VARCHAR(200) NOT NULL COMMENT '姓名',
    type VARCHAR(50) DEFAULT 'individual' COMMENT '类型: individual/enterprise',
    source_type VARCHAR(50) COMMENT '来源类型: employee/customer',
    source_id VARCHAR(36) COMMENT '来源ID',
    profile JSON COMMENT '联系人画像',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_contacts_source (source_type, source_id),
    INDEX idx_contacts_status (status),
    INDEX idx_contacts_deleted (deleted)
) COMMENT='联系人表';

-- --------------------------------------------
-- Agent 表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_agents (
    sid VARCHAR(36) PRIMARY KEY COMMENT 'Agent ID',
    agent_no VARCHAR(100) NOT NULL COMMENT 'Agent 编号',
    name VARCHAR(200) NOT NULL COMMENT 'Agent 名称',
    description TEXT COMMENT 'Agent 描述',
    profile JSON COMMENT 'Agent 画像配置',
    skills JSON COMMENT '技能列表',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_agent_no (agent_no),
    INDEX idx_agents_status (status),
    INDEX idx_agents_deleted (deleted)
) COMMENT='Agent 表';

-- --------------------------------------------
-- 渠道表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_channels (
    sid VARCHAR(36) PRIMARY KEY COMMENT '渠道ID',
    name VARCHAR(100) NOT NULL COMMENT '渠道名称',
    type VARCHAR(50) NOT NULL COMMENT '渠道类型: webui/wechat/dingtalk 等',
    config JSON COMMENT '渠道配置',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_channels_name (name),
    INDEX idx_channels_status (status),
    INDEX idx_channels_deleted (deleted)
) COMMENT='渠道表';

-- --------------------------------------------
-- 渠道联系人关联表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS r_channel_contact (
    channel_id VARCHAR(36) NOT NULL COMMENT '渠道ID',
    contact_id VARCHAR(36) NOT NULL COMMENT '联系人ID',
    channel_user_id VARCHAR(200) COMMENT '渠道用户标识',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (channel_id, contact_id),
    INDEX idx_channel_contact_contact (contact_id)
) COMMENT='渠道联系人关联表';

-- --------------------------------------------
-- 会话表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_session (
    sid VARCHAR(36) PRIMARY KEY COMMENT '会话ID',
    contact_id VARCHAR(36) NOT NULL COMMENT '联系人ID',
    agent_id VARCHAR(36) COMMENT 'Agent ID',
    channel_id VARCHAR(36) COMMENT '渠道ID',
    context JSON COMMENT '会话上下文',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态: active/closed',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_session_contact (contact_id),
    INDEX idx_session_agent (agent_id),
    INDEX idx_session_status (status)
) COMMENT='会话表';

-- --------------------------------------------
-- 上下文表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_context (
    sid VARCHAR(36) PRIMARY KEY COMMENT '上下文ID',
    session_id VARCHAR(36) NOT NULL COMMENT '会话ID',
    contact_id VARCHAR(36) NOT NULL COMMENT '联系人ID',
    agent_id VARCHAR(36) COMMENT 'Agent ID',
    messages JSON COMMENT '消息历史',
    summary TEXT COMMENT '会话摘要',
    status VARCHAR(20) DEFAULT 'active' COMMENT '状态',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_context_session (session_id),
    INDEX idx_context_contact (contact_id),
    INDEX idx_context_status (status)
) COMMENT='上下文表';

-- --------------------------------------------
-- 审计日志表
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_audit_log (
    sid VARCHAR(36) PRIMARY KEY COMMENT '日志ID',
    user_id VARCHAR(36) COMMENT '用户ID',
    action VARCHAR(100) NOT NULL COMMENT '操作类型',
    resource_type VARCHAR(100) COMMENT '资源类型',
    resource_id VARCHAR(36) COMMENT '资源ID',
    details JSON COMMENT '操作详情',
    ip_address VARCHAR(50) COMMENT 'IP地址',
    user_agent TEXT COMMENT '用户代理',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_resource (resource_type, resource_id),
    INDEX idx_audit_time (create_time)
) COMMENT='审计日志表';

-- --------------------------------------------
-- 代码表（数据字典）
-- --------------------------------------------
CREATE TABLE IF NOT EXISTS t_code (
    sid VARCHAR(36) PRIMARY KEY COMMENT '代码ID',
    category VARCHAR(100) NOT NULL COMMENT '分类',
    code VARCHAR(100) NOT NULL COMMENT '代码',
    name VARCHAR(200) NOT NULL COMMENT '名称',
    description TEXT COMMENT '描述',
    sort INT DEFAULT 0 COMMENT '排序',
    status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态',
    deleted TINYINT DEFAULT 0 COMMENT '逻辑删除标记',
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    UNIQUE INDEX idx_code_category_code (category, code),
    INDEX idx_code_category (category),
    INDEX idx_code_status (status)
) COMMENT='代码表';
