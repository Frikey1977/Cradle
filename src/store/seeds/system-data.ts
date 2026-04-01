/**
 * 系统基础 Seed 数据
 * 包括默认角色、用户、模块等
 */

import type { IDatabaseAdapter } from "../adapter.js";
import { generateUUID } from "../../shared/utils.js";
import crypto from "crypto";

/**
 * 初始化系统基础数据
 */
export async function seedSystemData(db: IDatabaseAdapter): Promise<void> {
  console.log("[Seed] Initializing system data...");

  // 1. 创建默认角色
  await seedRoles(db);

  // 2. 创建默认管理员用户
  await seedUsers(db);

  // 3. 创建默认模块
  await seedModules(db);

  // 4. 创建默认技能
  await seedSkills(db);

  console.log("[Seed] System data initialized");
}

/**
 * 创建默认角色
 */
async function seedRoles(db: IDatabaseAdapter): Promise<void> {
  const roles = [
    {
      sid: "admin",
      name: "系统管理员",
      title: "role.admin",
      description: "拥有系统所有权限",
      sort: 1,
      status: "enabled",
    },
    {
      sid: "user",
      name: "普通用户",
      title: "role.user",
      description: "普通用户权限",
      sort: 2,
      status: "enabled",
    },
    {
      sid: "agent",
      name: "Agent",
      title: "role.agent",
      description: "AI Agent 角色",
      sort: 3,
      status: "enabled",
    },
  ];

  for (const role of roles) {
    const exists = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_roles WHERE sid = ?",
      [role.sid]
    );

    if (!exists) {
      await db.run(
        `INSERT INTO t_roles 
         (sid, name, title, description, sort, status, deleted, create_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [role.sid, role.name, role.title, role.description, role.sort, role.status]
      );
      console.log(`[Seed] Created role: ${role.name}`);
    }
  }
}

/**
 * 创建默认管理员用户
 */
async function seedUsers(db: IDatabaseAdapter): Promise<void> {
  // 检查是否已有用户
  const existingUser = await db.queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM t_user WHERE deleted = 0"
  );

  if (existingUser && existingUser.count > 0) {
    console.log("[Seed] Users already exist, skipping");
    return;
  }

  const adminId = generateUUID();
  const passwordHash = crypto.createHash("sha256").update("admin123").digest("hex");

  await db.run(
    `INSERT INTO t_user 
     (sid, username, password, name, email, phone, avatar, status, deleted, create_time, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
    [
      adminId,
      "admin",
      passwordHash,
      "系统管理员",
      "admin@cradle.ai",
      null,
      null,
      "enabled",
    ]
  );

  // 关联管理员角色
  await db.run(
    `INSERT INTO r_user_role (user_id, role_id, create_time)
     VALUES (?, ?, datetime('now'))`,
    [adminId, "admin"]
  );

  console.log("[Seed] Created admin user (username: admin, password: admin123)");
}

/**
 * 创建默认模块
 */
async function seedModules(db: IDatabaseAdapter): Promise<void> {
  const modules = [
    {
      sid: "system",
      name: "系统管理",
      code: "system",
      description: "系统基础配置管理",
      icon: "ri:settings-3-line",
      sort: 1,
      status: "enabled",
    },
    {
      sid: "llm",
      name: "大模型管理",
      code: "llm",
      description: "LLM 提供商、配置和实例管理",
      icon: "ri:brain-line",
      sort: 2,
      status: "enabled",
    },
    {
      sid: "agent",
      name: "Agent 管理",
      code: "agent",
      description: "AI Agent 管理和配置",
      icon: "ri:robot-2-line",
      sort: 3,
      status: "enabled",
    },
    {
      sid: "organization",
      name: "组织架构",
      code: "organization",
      description: "部门、员工、联系人管理",
      icon: "ri:organization-chart",
      sort: 4,
      status: "enabled",
    },
    {
      sid: "customer",
      name: "客户管理",
      code: "customer",
      description: "客户、商机、跟进管理",
      icon: "ri:customer-service-2-line",
      sort: 5,
      status: "enabled",
    },
  ];

  for (const module of modules) {
    const exists = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_module WHERE sid = ?",
      [module.sid]
    );

    if (!exists) {
      await db.run(
        `INSERT INTO t_module 
         (sid, name, code, description, icon, sort, status, deleted, create_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [
          module.sid,
          module.name,
          module.code,
          module.description,
          module.icon,
          module.sort,
          module.status,
        ]
      );
      console.log(`[Seed] Created module: ${module.name}`);
    }
  }
}

/**
 * 创建默认技能
 */
async function seedSkills(db: IDatabaseAdapter): Promise<void> {
  const skills = [
    {
      sid: "browser-automation",
      name: "浏览器自动化",
      code: "browser-automation",
      description: "控制浏览器执行网页操作",
      type: "system",
      status: "enabled",
    },
    {
      sid: "file-operation",
      name: "文件操作",
      code: "file-operation",
      description: "读写本地文件",
      type: "system",
      status: "enabled",
    },
    {
      sid: "code-execution",
      name: "代码执行",
      code: "code-execution",
      description: "执行代码片段",
      type: "system",
      status: "enabled",
    },
  ];

  for (const skill of skills) {
    const exists = await db.queryOne<{ sid: string }>(
      "SELECT sid FROM t_skills WHERE sid = ?",
      [skill.sid]
    );

    if (!exists) {
      await db.run(
        `INSERT INTO t_skills 
         (sid, name, code, description, type, status, deleted, create_time, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [
          skill.sid,
          skill.name,
          skill.code,
          skill.description,
          skill.type,
          skill.status,
        ]
      );
      console.log(`[Seed] Created skill: ${skill.name}`);
    }
  }
}
