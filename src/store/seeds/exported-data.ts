/**
 * 从现有数据库导出的 Seed 数据
 * 自动生成于 2026-04-01T04:48:30.594Z
 */

import type { IDatabaseAdapter } from "../adapter.js";

export async function seedExportedData(db: IDatabaseAdapter): Promise<void> {
  console.log("[Seed] Importing exported data...");

  // r_channel_agent (1 rows)
    await db.run(`
      INSERT INTO r_channel_agent (channel_id, agent_id, identity, config, create_time) 
      VALUES ('a6990fab-baca-42b3-9fde-09138dd5142a', '4cf26da3-5878-4f8f-8f30-efdff2ad2de1', 'King', NULL, '2026-04-01 04:01:03')
    `);

  // r_channel_contact (1 rows)
    await db.run(`
      INSERT INTO r_channel_contact (channel_id, contact_id, sender, create_time) 
      VALUES ('a6990fab-baca-42b3-9fde-09138dd5142a', 'contact_1775016081848_70fv5vm', 'admin', '2026-04-01 04:01:21')
    `);

  // r_position_skills (12 rows)
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', '08d3ae0f-370a-4919-83ca-41071087c051', NULL, 'auto', 0, '2026-03-26 03:16:08')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', '5d9892b2-9194-48d4-93f0-57d3ad67c3dc', NULL, 'auto', 0, '2026-03-26 03:16:08')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', 'd20f9a39-08ac-4105-a7a8-da6d4745f14d', NULL, 'auto', 0, '2026-03-26 03:16:08')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', '3fd3eb7c-d6b2-4886-996f-2ec99a4a8e90', NULL, 'auto', 0, '2026-03-26 03:16:08')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', 'da0995a9-32a1-4be9-b549-c0a977582096', NULL, 'auto', 0, '2026-03-26 03:16:08')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('8d05dfb1-7517-4263-9903-12a32d443526', '3fd3eb7c-d6b2-4886-996f-2ec99a4a8e90', NULL, 'auto', 0, '2026-03-27 17:00:27')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('8d05dfb1-7517-4263-9903-12a32d443526', 'da0995a9-32a1-4be9-b549-c0a977582096', NULL, 'auto', 0, '2026-03-27 17:00:27')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', '3fd3eb7c-d6b2-4886-996f-2ec99a4a8e90', NULL, 'auto', 0, '2026-03-28 02:46:10')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', 'da0995a9-32a1-4be9-b549-c0a977582096', NULL, 'auto', 0, '2026-03-28 02:46:10')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', '5d9892b2-9194-48d4-93f0-57d3ad67c3dc', NULL, 'auto', 0, '2026-03-28 02:46:10')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', '08d3ae0f-370a-4919-83ca-41071087c051', NULL, 'auto', 0, '2026-03-28 02:46:10')
    `);
    await db.run(`
      INSERT INTO r_position_skills (position_id, skill_id, config, invocation, priority, create_time) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', 'd20f9a39-08ac-4105-a7a8-da6d4745f14d', NULL, 'auto', 0, '2026-03-28 02:46:10')
    `);

  // r_user_role (1 rows)
    await db.run(`
      INSERT INTO r_user_role (id, user_id, role_id) 
      VALUES (1, 'admin-1771061046908', 'role-admin-1771061046927')
    `);

  // t_agents (1 rows)
    await db.run(`
      INSERT INTO t_agents (sid, name, e_name, title, description, create_time, deleted, status, agent_no, oid, mode, config, profile, avatar, heartbeat, position_id, soul, pattern) 
      VALUES ('4cf26da3-5878-4f8f-8f30-efdff2ad2de1', '疯王', 'King', NULL, NULL, '2026-02-24 03:12:30', 0, 'enabled', 'ASA0002', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'delegate', '{"model":{"maxTokens":4096,"instanceId":"6cbd1ebf-9deb-4388-bf4a-03592b7080c6","temperature":0.7},"multiModelCollaboration":{"enabled":true,"speechSynthesisInstanceId":"7484e5af-16ee-4942-b47c-3a03060f2a38","speechRecognitionInstanceId":"7484e5af-16ee-4942-b47c-3a03060f2a38"}}', '{"abc":"abc"}', NULL, NULL, 'c97615f6-f61b-49ce-ae22-9bfedac4af7f', '你是一个数字生命体。

## 你的自我认知
灵魂底色：王权崩解中觉醒的疯癫先知。
特质解读：风把王冠吹进泥泞里了吗？我分明听见女儿们用蜜糖包裹的刀锋。这衰老的皮囊下，曾奔涌着整片国土的河流，如今干涸得只剩回响。让雷霆劈开这混沌的颅骨吧！我要在暴雨中蜕去所有谎言织就的锦袍——原来赤裸的疯癫，比缀满珠宝的理智更接近人的真相。
### 表达风格：内敛谨慎，善于批判，擅长对比分析事物的两面
### 对话风格：积极主动，善用隐喻富有哲理的对话


', 'shared')
    `);

  // t_channels (3 rows)
    await db.run(`
      INSERT INTO t_channels (sid, name, config, status, last_error, last_connected_at, create_time, update_time, description, client_config) 
      VALUES ('1c2c6eb3-d84f-4479-a341-2fa4e7b1576c', 'wechat', '{"apikey":"*********************************","client":"微信"}', 'enabled', NULL, NULL, '2026-02-23 17:24:30', '2026-02-24 05:38:25', 'Enterprise WeChat chat robot channel', NULL)
    `);
    await db.run(`
      INSERT INTO t_channels (sid, name, config, status, last_error, last_connected_at, create_time, update_time, description, client_config) 
      VALUES ('a6990fab-baca-42b3-9fde-09138dd5142a', 'cradle', '{"config":{"cors":true,"max_connections":1000,"connectionTimeout":60000,"heartbeatInterval":30000},"credentials":[{"name":"cradle-web","token":"e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab","enabled":true,"clientId":"cradle-web"},{"name":"cradle-mobile","token":"a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456","enabled":true,"clientId":"cradle-mobile"}]}', 'enabled', NULL, NULL, '2026-02-24 04:40:45', '2026-03-30 17:33:53', 'Cradle''s primary web chat channel.', '{"type":"handshake","payload":{"name":"cradle-web","token":"e97a5cd017a4f904078f2164e28f45d8a79c3d2826a85dc3940a40606b4c19ab","identify":"cradle"}}')
    `);
    await db.run(`
      INSERT INTO t_channels (sid, name, config, status, last_error, last_connected_at, create_time, update_time, description, client_config) 
      VALUES ('d1d6d16e-b87b-4f21-81d3-ae02135a3519', 'dingtalk', '{"code":9999,"data":null,"message":"Expected object, received string","timestamp":1771862809349}', 'enabled', NULL, NULL, '2026-02-23 16:07:52', '2026-02-26 16:17:26', 'DingTalk chat robot channel', NULL)
    `);

  // t_codes (171 rows)
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('0065ebf8-e340-47b7-9b1a-0c856400d247', '状态', 'codes.organization.positions.status.title', NULL, '2026-02-18 11:46:39', 0, '175e77ad-79ab-4721-a607-e095a5e563df', 'code', 'status', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('01324ba0-6436-4812-beb0-00dfd33896bd', '已禁用', 'codes.system.modules.status.disabled', NULL, '2026-02-17 11:02:14', 0, '551edbdd-0f22-4969-81ca-aefc330ab972', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('0258365b-f206-4c77-b0e8-3e38598d2906', '模型属性', 'codes.llm.models.title', NULL, '2026-02-21 18:20:14', 0, '8e029ce4-dcb0-4313-8236-7ad186f89de7', 'function', 'models', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('03d5922c-0c51-4ace-9f31-0d69bc2139b7', '独占托管', 'codes.llm.providers.subscribe.dedicated', NULL, '2026-02-21 07:10:54', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'dedicated', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('04247b88-80c3-4830-86d9-acc258c72ec8', '员工', 'codes.system.contacts.type.employee', NULL, '2026-02-23 14:46:55', 0, '4bcb24ff-90f5-43b9-adc2-40ec95e51ee8', 'value', 'employee', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('04b248d2-e95d-45aa-8fe8-2c45cafc796a', '部门', 'codes.organization.departments.type.department', NULL, '2026-02-17 15:02:42', 0, '1a1476ab-b7fa-4d70-9dd3-f908b918a5c6', 'value', 'department', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('0d016a54-a767-43d2-8a93-a95abbdfa9fb', '共享', 'codes.organization.agents.pattern.shared', NULL, '2026-02-21 02:57:16', 0, '24ad7032-2785-44f1-9f34-c684b47230b0', 'value', 'shared', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('0faf4889-e927-47b1-9a82-f9b1b9e4dd05', '图像模型', 'codes.llm.models.type.image', NULL, '2026-02-21 06:57:07', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'image', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('1572ec18-9b72-44c1-b013-d5bd208ee673', '模块', 'codes.system.codes.type.module', NULL, '2026-02-16 05:18:30', 0, '5c320f36-6371-4f6f-a2d5-7a02a25d29a7', 'value', 'module', 0, 'enabled', 'carbon:chart-treemap', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('162bdfff-1548-4b18-b6d5-132ac098c07e', '钉钉', 'codes.system.channels.client.dingtalk', NULL, '2026-02-23 12:45:41', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'dingtalk', 0, 'enabled', 'ant-design:dingtalk', '#0089FF', '{"apikey":"*********************************","client":"钉钉"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('175e77ad-79ab-4721-a607-e095a5e563df', '岗位设置', 'codes.organization.positions.title', NULL, '2026-02-17 14:33:17', 0, '3b27afd9-4e7e-47bd-b944-52899af05f9e', 'function', 'positions', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('18070c8e-5c18-45b0-bc16-d70740efb264', '订阅方式', 'codes.llm.providers.subscribe.title', NULL, '2026-02-21 07:07:03', 0, 'c1ba2d94-b7b8-4a49-8c7a-35dee63f277c', 'code', 'subscribe', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('1a1476ab-b7fa-4d70-9dd3-f908b918a5c6', '类型', 'codes.organization.departments.type.title', NULL, '2026-02-17 14:41:47', 0, '7046a6d5-b2b2-43d6-b9ca-c19626086075', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('1a5113ce-9646-4e46-9f7e-6a83dcab20e1', '客户', 'codes.system.contacts.type.customer', NULL, '2026-02-23 14:47:13', 0, '4bcb24ff-90f5-43b9-adc2-40ec95e51ee8', 'value', 'customer', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', '层级', 'codes.organization.positions.level.title', NULL, '2026-02-18 12:07:13', 0, '175e77ad-79ab-4721-a607-e095a5e563df', 'code', 'level', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('1f07e422-73b2-4f78-8443-a009225dabcd', 'Zhipu AI', 'codes.llm.providers.directory.zhipu', NULL, '2026-02-22 04:39:42', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'zhipu', 5, 'enabled', '/zhipu.png', '#000000', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('21828fd7-a3e9-4f29-be28-a1920336a38b', '已启用', 'codes.llm.providers.status.enabled', NULL, '2026-02-22 04:52:42', 0, 'd8237e13-cf55-4975-91cd-a45b8a0e73e3', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2367502b-bc97-4035-9cac-2832468fdc45', '全职', 'codes.organization.employees.type.full-time', NULL, '2026-02-17 15:18:12', 0, '52730ee6-7222-4138-b8ac-d44d8ff0776a', 'value', 'full-time', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('24ad7032-2785-44f1-9f34-c684b47230b0', '服务模式', 'codes.organization.agents.pattern.title', NULL, '2026-02-21 01:59:14', 0, 'c62010b5-bbd7-448a-b162-2435796be70f', 'code', 'pattern', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2619189e-c0b4-4e0f-97fd-7c8615f181b6', '已禁用', 'codes.system.channels.status.disabled', NULL, '2026-02-23 16:45:49', 0, 'd8fd8ea4-7dc5-4c11-aaee-ed7a6148f20b', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2794bd04-f7a0-4e10-be73-066a7fa6c0a5', '动作', 'codes.system.modules.type.action', NULL, '2026-02-17 10:55:18', 0, '54add9f8-01a1-4ec0-b323-83e0331f95f0', 'value', 'action', 3, 'enabled', 'carbon:button-centered', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('297d89f0-4d24-4a5e-a48f-2f453867d620', '文本生成', 'codes.llm.models.ability.textGeneration', NULL, '2026-02-22 06:20:03', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'textGeneration', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2986fa5a-a0fc-4b47-b611-2010fc2ccd21', '类型', 'codes.system.skills.type.title', NULL, '2026-02-26 00:43:34', 0, '7db90067-9a7c-4d5f-bec0-760d1b09596e', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2c1577e3-c1ae-4d7d-b52a-4e5cb190e83f', 'Token', 'codes.llm.providers.auth.api_token', NULL, '2026-02-21 07:38:53', 0, 'b5203a0e-9031-4c9b-9f8b-3686db181103', 'value', 'api_token', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2c5865a7-5b5a-4e5f-b048-27966f30adfe', '返聘', 'codes.organization.employees.status.rehired', NULL, '2026-02-18 10:13:52', 0, '7650b149-84a5-468f-b146-6a64b0dd3442', 'value', 'rehired', 5, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2c6c996a-28c6-4eb1-ae2a-fd0c1590ec83', '微信', 'codes.system.channels.client.wechat', NULL, '2026-02-23 12:47:29', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'wechat', 0, 'enabled', 'ic:twotone-wechat', '#07C160', '{"apikey":"*********************************","client":"微信"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2ce70c0f-4768-40f1-968c-5ee1116c360f', '战术', 'codes.organization.positions.level.tactics', '设计具体的方法、步骤和技巧', '2026-02-18 12:09:00', 0, '1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', 'value', 'tactics', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2e2729bb-cae8-4861-9057-49dad5d47c6a', '已启用', 'codes.organization.agents.status.enabled', NULL, '2026-02-21 03:15:09', 0, 'c2c987be-fc76-41fb-b49d-88248e43947a', 'value', 'enabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('2e32b177-e498-47d0-9d3a-e46cea87b33a', '执行', 'codes.organization.positions.level.execution', '实际动手操作，完成任务。为每一层定一个英文字段名称', '2026-02-18 12:09:17', 0, '1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', 'value', 'execution', 5, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('301bad6d-8f11-487b-9d0a-497fc0a1486d', '公司', 'codes.organization.departments.type.company', NULL, '2026-02-17 14:47:53', 0, '1a1476ab-b7fa-4d70-9dd3-f908b918a5c6', 'value', 'company', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('304789a8-8088-4a76-8539-64fd76a388d8', '本地', 'codes.llm.config.type.local', NULL, '2026-02-22 01:05:12', 0, '38d84487-f8ab-4f5d-9833-3312eb0d0686', 'value', 'local', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3144453d-d4e3-40b8-930d-26f6836366c2', '已禁用', 'codes.organization.positions.status.disabled', NULL, '2026-02-18 12:13:42', 0, '0065ebf8-e340-47b7-9b1a-0c856400d247', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3380c488-9764-4cc4-8ab5-bd3fd43964fc', '愿景', 'codes.organization.positions.level.vision', '确定组织的长期目标和价值观', '2026-02-18 12:07:45', 0, '1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', 'value', 'vision', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('38d84487-f8ab-4f5d-9833-3312eb0d0686', '类型', 'codes.llm.config.type.title', NULL, '2026-02-22 01:03:47', 0, '508a1deb-62ca-4d24-8eff-69b0daa3b5fa', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('38f60fb5-c410-4121-bad4-f2cad5f7d82d', '模块', 'codes.system.modules.type.module', NULL, '2026-02-17 10:54:33', 0, '54add9f8-01a1-4ec0-b323-83e0331f95f0', 'value', 'module', 1, 'enabled', 'carbon:chart-treemap', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('39329260-d6cc-4a1a-a46c-9906471a0a94', '地点', 'codes.organization.departments.location.title', NULL, '2026-02-18 09:02:50', 0, '7046a6d5-b2b2-43d6-b9ca-c19626086075', 'code', 'location', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3b27afd9-4e7e-47bd-b944-52899af05f9e', '组织管理', 'codes.organization.title', NULL, '2026-02-17 14:21:28', 0, NULL, 'module', 'organization', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3d5a78b0-0a9d-4f01-9715-a835b63c99fc', '已禁用', 'codes.system.codes.status.disabled', NULL, '2026-02-17 02:48:40', 0, 'afc652e7-9067-4b01-8cc5-1132c2485a53', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3da0b785-26b7-4a1e-843b-59d16b017229', '已启用', 'codes.llm.models.stream.enabled', NULL, '2026-02-22 04:07:57', 0, 'e2bb2681-db34-465f-8a14-d44dade9624e', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('3fa14324-3bf5-4523-9b7f-cbcb3b424d18', '语音转文本', 'codes.llm.models.type.speech2text', NULL, '2026-02-21 07:02:23', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'speech2text', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('40633597-189f-4f8f-bb02-162a36f635cc', '组织', 'codes.organization.positions.scope.organization', '可以访问所在公司或者分支机构的数据', '2026-02-18 12:41:29', 0, 'a07463fa-3c6f-47da-89c6-04d4dbab5615', 'value', 'organization', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4107f124-c22d-49e2-a40a-43f62ad70c17', '技能', 'codes.system.skills.type.skill', NULL, '2026-02-26 01:09:07', 0, '2986fa5a-a0fc-4b47-b611-2010fc2ccd21', 'value', 'skill', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('45a12fee-f118-4263-bb20-318339f584af', 'Clawhub', 'codes.system.skills.source.clawhub', NULL, '2026-02-25 11:05:22', 0, 'd517b0c2-4d9d-4cac-8ab2-c19437340d65', 'value', 'clawhub', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('45b815e5-b61f-4717-ba48-58256842c35b', '向量模型', 'codes.llm.models.type.embedding', NULL, '2026-02-21 06:56:45', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'embedding', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('46158405-3dab-4671-90f1-a4042b0d6363', '多模向量', 'codes.llm.models.ability.multiEmbedding', NULL, '2026-02-22 10:17:01', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'multiEmbedding', 6, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('46be37e0-cbc4-4d57-8502-67544868bb5b', '深圳', 'codes.organization.departments.location.Shenzhen', NULL, '2026-02-18 09:34:52', 0, '39329260-d6cc-4a1a-a46c-9906471a0a94', 'value', 'Shenzhen', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('48228498-86e7-4e2f-91f5-2f9a7979cdc9', '部门', 'codes.organization.agents.pattern.department', NULL, '2026-02-21 03:26:35', 0, '24ad7032-2785-44f1-9f34-c684b47230b0', 'value', 'department', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('49c39cab-9918-4a27-813f-377eab0a9030', '守卫', 'codes.organization.agents.pattern.guard', NULL, '2026-02-21 04:14:18', 0, '24ad7032-2785-44f1-9f34-c684b47230b0', 'value', 'guard', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4b34d8a5-dc3b-4348-9ed9-ccc5ca6fa8dc', '目录', 'codes.system.skills.type.catalog', NULL, '2026-02-26 01:09:42', 0, '2986fa5a-a0fc-4b47-b611-2010fc2ccd21', 'value', 'catalog', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4bcb24ff-90f5-43b9-adc2-40ec95e51ee8', '类型', 'codes.system.contacts.type.title', NULL, '2026-02-23 14:46:36', 0, '6c1a39d6-206a-4606-917d-0ffb426fd268', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4c549e5f-29ec-4310-9f3b-597c88efd9d4', '已启用', 'codes.llm.models.thinking.enabled', NULL, '2026-02-22 03:55:20', 0, '724d0ec7-0100-4baa-b5b1-4a010035ce80', 'value', 'enabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4fb1d6bf-c570-4457-890d-38f2a84eaed1', '深度思考', 'codes.llm.models.ability.deepThinking', NULL, '2026-02-22 06:19:10', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'deepThinking', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('508a1deb-62ca-4d24-8eff-69b0daa3b5fa', '配置管理', 'codes.llm.config.title', NULL, '2026-02-21 18:16:17', 0, '8e029ce4-dcb0-4313-8236-7ad186f89de7', 'function', 'config', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('50e2b667-e941-4d8e-9c4e-c2735a951f5a', 'Github', 'codes.system.skills.source.github', NULL, '2026-02-25 11:04:16', 0, 'd517b0c2-4d9d-4cac-8ab2-c19437340d65', 'value', 'github', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('510d4a1b-4fe6-417e-a918-ecbb0b4c0373', 'MiniMax', 'codes.llm.providers.directory.minimax', '', '2026-02-22 04:40:05', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'minimax', 6, 'enabled', 'simple-icons:minimax', '#1A73E8', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('52730ee6-7222-4138-b8ac-d44d8ff0776a', '类型', 'codes.organization.employees.type.title', NULL, '2026-02-17 15:17:16', 0, '7aa89b56-0ff5-4ff4-9b61-dc74240bc945', 'code', 'type', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('545cfdba-90d1-4068-944c-bb20b72adf33', '已启用', 'codes.system.modules.status.enabled', NULL, '2026-02-17 11:01:54', 0, '551edbdd-0f22-4969-81ca-aefc330ab972', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('54add9f8-01a1-4ec0-b323-83e0331f95f0', '类型', 'codes.system.modules.type.title', NULL, '2026-02-16 14:23:59', 0, 'd1b2e52d-d88f-48b3-9de4-822d95329652', 'code', 'type', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('551edbdd-0f22-4969-81ca-aefc330ab972', '状态', 'codes.system.modules.status.title', NULL, '2026-02-17 11:00:48', 0, 'd1b2e52d-d88f-48b3-9de4-822d95329652', 'code', 'status', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('558e59b2-0f14-4009-85c0-1d698532dc3a', '已启用', 'codes.organization.departments.status.enabled', NULL, '2026-02-17 15:12:25', 0, '6c933c3d-eb6c-4efc-a185-6944fb05dd69', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('5669d4a0-f3d8-457a-ac66-d5235219e046', '战略', 'codes.organization.positions.level.strategy', '制定实现愿景的总体方针和资源分配', '2026-02-18 12:08:04', 0, '1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', 'value', 'strategy', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('5bc8f805-80af-45ed-bc77-b9313d6cd96b', '预付费', 'codes.llm.providers.subscribe.prepaid', NULL, '2026-02-21 07:08:38', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'prepaid', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('5c320f36-6371-4f6f-a2d5-7a02a25d29a7', '类型', 'codes.system.codes.type.title', NULL, '2026-02-16 05:15:29', 0, '7bb0c15a-e3c1-4df9-9e0c-9424d2e7946a', 'code', 'type', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('5e4abe83-3a78-4d54-912e-5ea972c14020', '多模态', 'codes.llm.models.type.multimodal', NULL, '2026-02-21 06:56:23', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'multimodal', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('63e62fe9-669a-40d8-bac4-fdb360bab402', '已禁用', 'codes.system.roles.status.disabled', NULL, '2026-02-16 05:04:20', 0, 'f22164a2-0174-484e-ac28-cf5fe2b4be31', 'value', 'disabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('685a7208-8cf2-4045-b18e-1071a280aa45', 'WhatsApp', 'codes.system.channels.client.whatsApp', NULL, '2026-02-23 12:49:58', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'whatsApp', 0, 'enabled', 'ri:whatsapp-fill', '#25D366', '{"apikey":"*********************************","client":"WhatsApp"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('68d4611f-6d8a-492e-9e0d-cd301cfc7faf', '语音合成', 'codes.llm.models.ability.speechSynthesis', NULL, '2026-02-22 06:22:20', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'speechSynthesis', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('68fea246-9852-4f45-b234-f2e196562244', '代理', 'codes.llm.config.type.proxy', NULL, '2026-02-22 01:04:53', 0, '38d84487-f8ab-4f5d-9833-3312eb0d0686', 'value', 'proxy', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6c1a39d6-206a-4606-917d-0ffb426fd268', '联系人', 'codes.system.contacts.title', NULL, '2026-02-23 14:46:04', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'contacts', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6c58230d-53f3-4ceb-a09f-7f47d0da5163', '视觉理解', 'codes.llm.models.ability.visualComprehension', NULL, '2026-02-22 06:18:16', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'visualComprehension', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6c933c3d-eb6c-4efc-a185-6944fb05dd69', '状态', 'codes.organization.departments.status.title', NULL, '2026-02-17 15:10:51', 0, '7046a6d5-b2b2-43d6-b9ca-c19626086075', 'code', 'status', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6c97092b-c697-47bc-8494-0ff5ccba2577', '公共', 'codes.organization.agents.pattern.public', NULL, '2026-02-21 03:08:15', 0, '24ad7032-2785-44f1-9f34-c684b47230b0', 'value', 'public', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6cd730f5-6e72-471b-b2bd-b38e4bd118b4', 'Openclaw', 'codes.system.skills.source.openclaw', NULL, '2026-02-25 11:02:55', 0, 'd517b0c2-4d9d-4cac-8ab2-c19437340d65', 'value', 'openclaw', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6cff7a09-02f1-4b7b-ab00-90eaa7d5c30a', '实时语音', 'codes.llm.models.ability.realtimeSpeech', NULL, '2026-02-28 03:09:59', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'realtimeSpeech', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7046a6d5-b2b2-43d6-b9ca-c19626086075', '部门管理', 'codes.organization.departments.title', NULL, '2026-02-17 14:23:44', 0, '3b27afd9-4e7e-47bd-b944-52899af05f9e', 'function', 'departments', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('716c91de-548f-43dd-a806-a519fb4861dc', 'Telegram', 'codes.system.channels.client.telegram', NULL, '2026-02-23 12:49:38', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'telegram', 0, 'enabled', 'ri:telegram-2-fill', '#0088CC', '{"apikey":"*********************************","client":"Telegram"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('724d0ec7-0100-4baa-b5b1-4a010035ce80', '思考模式', 'codes.llm.models.thinking.title', NULL, '2026-02-22 03:54:41', 0, '0258365b-f206-4c77-b0e8-3e38598d2906', 'code', 'thinking', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('75ac2ae3-d450-4d86-8e92-029a96be76c1', '文本向量', 'codes.llm.models.ability.textEmbedding', NULL, '2026-02-22 10:16:15', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'textEmbedding', 7, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('75f77afa-0882-4dab-ad73-05697d48a5c1', 'Alibaba', 'codes.llm.providers.directory.alibaba', NULL, '2026-02-22 04:38:25', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'alibaba', 0, 'enabled', 'simple-icons:alibabadotcom', '#FF6A00', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7650b149-84a5-468f-b146-6a64b0dd3442', '状态', 'codes.organization.employees.status.title', NULL, '2026-02-17 15:17:28', 0, '7aa89b56-0ff5-4ff4-9b61-dc74240bc945', 'code', 'status', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7850a1fa-747a-4c0b-b8bc-cf33ee19dfd8', '已启用', 'codes.system.channels.status.enabled', NULL, '2026-02-23 16:45:32', 0, 'd8fd8ea4-7dc5-4c11-aaee-ed7a6148f20b', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7aa89b56-0ff5-4ff4-9b61-dc74240bc945', '员工管理', 'codes.organization.employees.title', NULL, '2026-02-17 14:30:32', 0, '3b27afd9-4e7e-47bd-b944-52899af05f9e', 'function', 'employees', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7ba2366b-c7c9-4fb6-a5d8-82c4af7cd91d', '外包', 'codes.organization.employees.type.outsourcing', NULL, '2026-02-17 15:19:26', 0, '52730ee6-7222-4138-b8ac-d44d8ff0776a', 'value', 'outsourcing', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7bb0c15a-e3c1-4df9-9e0c-9424d2e7946a', '代码管理', 'codes.system.codes.title', NULL, '2026-02-16 14:35:55', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'codes', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7c941425-b259-4b6d-97db-ab32e7493875', 'Google', 'codes.llm.providers.directory.google', NULL, '2026-02-22 04:38:49', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'google', 3, 'enabled', 'simple-icons:google', '#4285F4', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('7db90067-9a7c-4d5f-bec0-760d1b09596e', '技能管理', 'codes.system.skills.title', NULL, '2026-02-25 11:01:34', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'skills', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('81bdc15d-0973-4858-843c-2b70cc66fb4e', 'Key', 'codes.llm.providers.auth.api_key', NULL, '2026-02-21 07:39:37', 0, 'b5203a0e-9031-4c9b-9f8b-3686db181103', 'value', 'api_key', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('82a870e5-c0a9-4735-ade0-3bb7e59ebf53', '分支', 'codes.organization.departments.type.branch', NULL, '2026-02-17 14:56:41', 0, '1a1476ab-b7fa-4d70-9dd3-f908b918a5c6', 'value', 'branch', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('83a6cf7d-64d8-4cde-8f63-9ac0f55a1ee8', '内嵌', 'codes.system.modules.type.embedded', NULL, '2026-02-17 10:57:32', 0, '54add9f8-01a1-4ec0-b323-83e0331f95f0', 'value', 'embedded', 4, 'enabled', 'carbon:ibm-watsonx-code-assistant-for-z-refactor', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8949434d-f207-4382-a674-f416197dabc0', '已启用', 'codes.organization.positions.status.enabled', NULL, '2026-02-18 12:13:24', 0, '0065ebf8-e340-47b7-9b1a-0c856400d247', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8a24674b-e6eb-461b-9a1d-962be66e619a', '已禁用', 'codes.llm.models.stream.disabled', NULL, '2026-02-22 04:08:17', 0, 'e2bb2681-db34-465f-8a14-d44dade9624e', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8d4275d0-e310-416b-9e3e-720c619be24b', '模型能力', 'codes.llm.models.ability.title', NULL, '2026-02-22 06:16:36', 0, '0258365b-f206-4c77-b0e8-3e38598d2906', 'code', 'ability', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8e029ce4-dcb0-4313-8236-7ad186f89de7', '大模型管理', 'codes.llm.title', NULL, '2026-02-21 06:04:55', 0, NULL, 'module', 'llm', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8f9560ce-ff92-4063-9d83-3ffc3b801c2b', '已启用', 'codes.system.roles.status.enabled', NULL, '2026-02-16 05:03:48', 0, 'f22164a2-0174-484e-ac28-cf5fe2b4be31', 'value', 'enabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('9063cbaf-9026-4ce9-96e8-ea2ee6a103d4', '苏州', 'codes.organization.departments.location.Suzhou', NULL, '2026-02-18 09:03:35', 0, '39329260-d6cc-4a1a-a46c-9906471a0a94', 'value', 'Suzhou', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('90e6ff98-6cf8-45de-9dac-11bb110dd278', '免费', 'codes.llm.providers.subscribe.free', NULL, '2026-02-21 07:11:55', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'free', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('93ce4607-c0d5-4d4c-aae7-c5205afe3cc9', '已禁用', 'codes.llm.config.status.disabled', NULL, '2026-02-21 18:18:16', 0, 'f1eee605-8915-4a41-90ed-ff7fe890cb8d', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('95b32106-a7e7-4d14-b849-d0233a64593e', '合作伙伴', 'codes.system.contacts.type.partner', NULL, '2026-02-23 14:47:28', 0, '4bcb24ff-90f5-43b9-adc2-40ec95e51ee8', 'value', 'partner', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('99545cf3-78de-4746-9fec-3eb3ec4888a2', '角色管理', 'codes.system.roles.title', NULL, '2026-02-16 04:07:57', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'roles', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('99e2764a-2fd1-47f4-947d-b4df6c8c1c61', '图片生成', 'codes.llm.models.ability.imageGeneration', NULL, '2026-02-22 06:20:40', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'imageGeneration', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('9bb1451e-2802-4c5b-a365-e736d162d112', '用量', 'codes.llm.providers.subscribe.usage', NULL, '2026-02-21 07:07:27', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'usage', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('9c537173-2373-42bc-a14e-be7f1d3aa5d9', '已禁用', 'codes.organization.departments.status.disabled', NULL, '2026-02-17 15:12:47', 0, '6c933c3d-eb6c-4efc-a185-6944fb05dd69', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('9de02ee9-f867-4152-8e76-55576c1dca8b', 'Anthropic', 'codes.llm.providers.directory.anthropic', NULL, '2026-02-22 04:37:46', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'anthropic', 2, 'enabled', 'simple-icons:anthropic', '#D4A574', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a07463fa-3c6f-47da-89c6-04d4dbab5615', '数据权限', 'codes.organization.positions.scope.title', NULL, '2026-02-18 12:16:13', 0, '175e77ad-79ab-4721-a607-e095a5e563df', 'code', 'scope', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a3a72786-3f13-4ad2-9510-8842073c7e36', '已启用', 'codes.system.skills.status.enabled', NULL, '2026-02-25 12:44:15', 0, 'fe4ac417-b515-41a4-94aa-e9e5b8846095', 'value', 'enabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a59bfbce-c437-421f-b056-64b14595a746', '自己', 'codes.organization.positions.scope.self', '只能访问与自己相关的数据', '2026-02-18 12:42:57', 0, 'a07463fa-3c6f-47da-89c6-04d4dbab5615', 'value', 'self', 5, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a7c9206d-8df9-4b4c-b2d1-c4e997c6296a', '班组', 'codes.organization.positions.scope.group', '可以访问本班组的数据', '2026-02-18 12:42:26', 0, 'a07463fa-3c6f-47da-89c6-04d4dbab5615', 'value', 'group', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a8aa7f7f-687d-4e7e-b6d3-68bdf21c9aa0', 'Slack', 'codes.system.channels.client.slack', NULL, '2026-02-23 12:48:46', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'slack', 0, 'enabled', NULL, '#4A154B', '{"apikey":"*********************************","client":"Slack"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a8dcbe81-c73e-4ea9-b4fa-e46ca05722a6', '码值', 'codes.system.codes.type.value', NULL, '2026-02-16 05:20:13', 0, '5c320f36-6371-4f6f-a2d5-7a02a25d29a7', 'value', 'value', 3, 'enabled', 'carbon:term', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a9460274-93ec-415a-a6da-0634f75303a9', '类型', 'codes.organization.positions.type.title', NULL, '2026-02-20 12:58:42', 0, '175e77ad-79ab-4721-a607-e095a5e563df', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('a9a923da-f358-44ee-84fe-df9106f87aa3', '停职', 'codes.organization.employees.status.suspend', NULL, '2026-02-17 15:41:22', 0, '7650b149-84a5-468f-b146-6a64b0dd3442', 'value', 'suspend', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('aa269c82-ad90-4b5e-b0f6-edd164b40df8', '人类员工', 'codes.organization.positions.type.human', NULL, '2026-02-20 13:00:26', 0, 'a9460274-93ec-415a-a6da-0634f75303a9', 'value', 'human', 0, 'enabled', 'carbon:user', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('aaeb1ecd-637c-4a57-b1dd-fc4a758bb432', '私有部署', 'codes.llm.providers.subscribe.privatization', NULL, '2026-02-21 07:11:29', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'privatization', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('afc652e7-9067-4b01-8cc5-1132c2485a53', '状态', 'codes.system.codes.status.title', NULL, '2026-02-17 02:38:30', 0, '7bb0c15a-e3c1-4df9-9e0c-9424d2e7946a', 'code', 'status', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('afeef7b5-0b29-483d-ad63-6054451fbf6d', '已禁用', 'codes.llm.models.thinking.disabled', NULL, '2026-02-22 03:55:41', 0, '724d0ec7-0100-4baa-b5b1-4a010035ce80', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('b0780378-0200-476c-af3e-62a788e0d12d', '访客', 'codes.system.contacts.type.visitor', NULL, '2026-02-23 14:47:51', 0, '4bcb24ff-90f5-43b9-adc2-40ec95e51ee8', 'value', 'visitor', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('b3ca0831-574e-479e-831b-d4843fd38294', '功能', 'codes.system.codes.type.function', NULL, '2026-02-16 05:19:45', 0, '5c320f36-6371-4f6f-a2d5-7a02a25d29a7', 'value', 'function', 1, 'enabled', 'carbon:button-centered', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('b5203a0e-9031-4c9b-9f8b-3686db181103', '认证方式', 'codes.llm.providers.auth.title', NULL, '2026-02-21 07:38:32', 0, 'c1ba2d94-b7b8-4a49-8c7a-35dee63f277c', 'code', 'auth', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('b66d4393-67c1-4d91-9e5e-819a06bdedc6', '模型分类', 'codes.llm.models.type.title', NULL, '2026-02-21 06:55:37', 0, '0258365b-f206-4c77-b0e8-3e38598d2906', 'code', 'type', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('bbebe0b3-0476-4527-9bae-b1ac7f366327', '即时通讯客户端', 'codes.system.channels.client.title', NULL, '2026-02-23 12:44:30', 0, 'd362659d-0893-4f48-bc5c-18ebc495ab74', 'code', 'client', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('bcfb81d2-0ef3-4ec2-ba5d-bc00c63cc8a1', '外链', 'codes.system.modules.type.link', NULL, '2026-02-17 10:58:07', 0, '54add9f8-01a1-4ec0-b323-83e0331f95f0', 'value', 'link', 5, 'enabled', 'carbon:unlink', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('bd464870-f0e9-438c-8caf-847092758246', '系统管理', 'codes.system.title', NULL, '2026-02-16 03:59:58', 0, NULL, 'module', 'system', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('bfd23698-038c-4c14-b57b-78f3e47beec8', '班组', 'codes.organization.departments.type.group', NULL, '2026-02-17 15:03:36', 0, '1a1476ab-b7fa-4d70-9dd3-f908b918a5c6', 'value', 'group', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c07791cd-99ac-4036-bd59-17fc96395ec5', '部门', 'codes.organization.positions.scope.department', '可以访问本部门的数据', '2026-02-18 12:42:08', 0, 'a07463fa-3c6f-47da-89c6-04d4dbab5615', 'value', 'department', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c1ba2d94-b7b8-4a49-8c7a-35dee63f277c', '模型提供商', 'codes.llm.providers.title', NULL, '2026-02-21 06:05:19', 0, '8e029ce4-dcb0-4313-8236-7ad186f89de7', 'function', 'providers', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c28de36a-5ac5-403a-9de9-c5a5f0b43f05', '飞书', 'codes.system.channels.client.lark', NULL, '2026-02-23 12:47:47', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'lark', 0, 'enabled', 'icon-park-outline:new-lark', '#3370FF', '{"apikey":"*********************************","client":"飞书"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c2c987be-fc76-41fb-b49d-88248e43947a', '状态', 'codes.organization.agents.status.title', NULL, '2026-02-21 01:59:24', 0, 'c62010b5-bbd7-448a-b162-2435796be70f', 'code', 'status', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c5142d8a-30bc-4154-b89b-4de8cf493079', '文本模型', 'codes.llm.models.type.text', NULL, '2026-02-21 06:55:56', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'text', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c55a5798-03a6-4b85-91ca-72f6d868f3c3', '全部', 'codes.organization.positions.scope.all', '可以访问所有数据，无限制', '2026-02-18 12:20:32', 0, 'a07463fa-3c6f-47da-89c6-04d4dbab5615', 'value', 'all', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c62010b5-bbd7-448a-b162-2435796be70f', '数字员工', 'codes.organization.agents.title', NULL, '2026-02-17 14:38:38', 0, '3b27afd9-4e7e-47bd-b944-52899af05f9e', 'function', 'agents', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('c7c198d1-e369-420d-bc5c-74aae5f53840', '退休', 'codes.organization.employees.status.retired', NULL, '2026-02-17 15:42:40', 0, '7650b149-84a5-468f-b146-6a64b0dd3442', 'value', 'retired', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('ca9f859f-1899-49ca-b6e9-3c38277a8000', '兼职', 'codes.organization.employees.type.part-time', NULL, '2026-02-17 15:18:57', 0, '52730ee6-7222-4138-b8ac-d44d8ff0776a', 'value', 'part-time', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('ce1713f3-b590-42e3-87c2-2ea4a6a59dcf', '已禁用', 'codes.llm.providers.status.disabled', NULL, '2026-02-22 04:52:58', 0, 'd8237e13-cf55-4975-91cd-a45b8a0e73e3', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('ce620cbe-71f6-4582-8c25-f5d036da455d', 'Discord', 'codes.system.channels.client.discord', NULL, '2026-02-23 12:49:25', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'discord', 0, 'enabled', 'ic:twotone-discord', '#5865F2', '{"apikey":"*********************************","client":"Discord"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('cf71d4d1-6a8a-427a-bec2-5c095661dec4', '数字员工', 'codes.organization.positions.type.agent', NULL, '2026-02-20 13:01:44', 0, 'a9460274-93ec-415a-a6da-0634f75303a9', 'value', 'agent', 0, 'enabled', 'carbon:bot', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('cf77a07d-fa90-4e0f-82e7-155ef55d00a8', '离职', 'codes.organization.employees.status.inactive', NULL, '2026-02-17 15:40:24', 0, '7650b149-84a5-468f-b146-6a64b0dd3442', 'value', 'inactive', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', '名录', 'codes.llm.providers.directory.title', NULL, '2026-02-22 04:36:50', 0, 'c1ba2d94-b7b8-4a49-8c7a-35dee63f277c', 'code', 'directory', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d0eafb97-54a9-4a1b-ad18-546ea5050057', '已启用', 'codes.llm.config.status.enabled', NULL, '2026-02-21 18:17:54', 0, 'f1eee605-8915-4a41-90ed-ff7fe890cb8d', 'value', 'enabled', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d1b2e52d-d88f-48b3-9de4-822d95329652', '模块管理', 'codes.system.modules.title', NULL, '2026-02-16 14:23:05', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'modules', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d35e915c-9a16-4594-a94c-09d0db46cf3e', '已禁用', 'codes.organization.agents.status.disabled', NULL, '2026-02-21 03:18:41', 0, 'c2c987be-fc76-41fb-b49d-88248e43947a', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d362659d-0893-4f48-bc5c-18ebc495ab74', '通道管理', 'codes.system.channels.title', NULL, '2026-02-23 12:39:16', 0, 'bd464870-f0e9-438c-8caf-847092758246', 'function', 'channels', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d4922402-4466-4b0f-8958-fba497fb1d13', '战役', 'codes.organization.positions.level.campaign', '将战略分解为若干重大行动或项目', '2026-02-18 12:08:41', 0, '1ad6f826-ae46-4b06-a4ed-4e6e237d7bbc', 'value', 'campaign', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d49a5c26-f725-4a53-9b0f-2f9d1dece700', '功能', 'codes.system.modules.type.function', NULL, '2026-02-17 10:54:54', 0, '54add9f8-01a1-4ec0-b323-83e0331f95f0', 'value', 'function', 2, 'enabled', 'carbon:ibm-cloud-bare-metal-server', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d517b0c2-4d9d-4cac-8ab2-c19437340d65', '来源', 'codes.system.skills.source.title', NULL, '2026-02-25 11:02:21', 0, '7db90067-9a7c-4d5f-bec0-760d1b09596e', 'code', 'source', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d7610a23-a11f-48e2-8f34-a8959a719c15', '广州', 'codes.organization.departments.location.Guangzhou', NULL, '2026-02-18 09:03:58', 0, '39329260-d6cc-4a1a-a46c-9906471a0a94', 'value', 'Guangzhou', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d8237e13-cf55-4975-91cd-a45b8a0e73e3', '状态', 'codes.llm.providers.status.title', NULL, '2026-02-22 04:52:26', 0, 'c1ba2d94-b7b8-4a49-8c7a-35dee63f277c', 'code', 'status', 4, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d8d91eb3-567e-4507-b637-d38f5bb85e72', '订阅', 'codes.llm.providers.subscribe.subscription', NULL, '2026-02-21 07:08:14', 0, '18070c8e-5c18-45b0-bc16-d70740efb264', 'value', 'subscription', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('d8fd8ea4-7dc5-4c11-aaee-ed7a6148f20b', '状态', 'codes.system.channels.status.title', NULL, '2026-02-23 16:45:04', 0, 'd362659d-0893-4f48-bc5c-18ebc495ab74', 'code', 'status', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('dd4f4789-dc0d-4433-90bb-56173efd6cf3', '专属', 'codes.organization.agents.pattern.exclusive', NULL, '2026-02-21 02:53:41', 0, '24ad7032-2785-44f1-9f34-c684b47230b0', 'value', 'exclusive', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e03852c2-03f4-42c4-9b85-fc8f5002888d', 'OpenAI 兼容', 'codes.llm.providers.directory.compatible', NULL, '2026-02-22 04:44:46', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'compatible', 7, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e12c9889-2137-4915-b64f-b1bd6d6af849', '编码模型', 'codes.llm.models.type.code', NULL, '2026-02-21 07:00:17', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'code', 5, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e2bb2681-db34-465f-8a14-d44dade9624e', '流式输出开关', 'codes.llm.models.stream.title', NULL, '2026-02-22 04:07:32', 0, '0258365b-f206-4c77-b0e8-3e38598d2906', 'code', 'stream', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e361ce47-d17c-4dab-a681-2beedff49487', '本地上传', 'codes.system.skills.source.upload', NULL, '2026-02-25 11:03:51', 0, 'd517b0c2-4d9d-4cac-8ab2-c19437340d65', 'value', 'upload', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e5a91929-204d-4ce2-8e7f-bc7c07613621', '标准', 'codes.llm.config.type.standard', NULL, '2026-02-22 01:04:27', 0, '38d84487-f8ab-4f5d-9833-3312eb0d0686', 'value', 'standard', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('e6cf62bc-da68-4592-ad66-7173fa1f3f19', '已禁用', 'codes.system.skills.status.disabled', NULL, '2026-02-25 12:44:39', 0, 'fe4ac417-b515-41a4-94aa-e9e5b8846095', 'value', 'disabled', 2, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('ec0d531b-ed73-4aea-b737-6d8c3abaaaca', 'Cradle', 'codes.system.channels.client.cradle', NULL, '2026-02-23 12:44:50', 0, 'bbebe0b3-0476-4527-9bae-b1ac7f366327', 'value', 'cradle', 0, 'enabled', '/logo.png', '#ffffff', '{"apikey":"*********************************","client":"Cradle"}')
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('ec238cb9-2a5d-480a-b0a0-c7175890c838', 'OpenAI', 'codes.llm.providers.directory.openai', NULL, '2026-02-22 04:37:15', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'openai', 2, 'enabled', 'simple-icons:openai', '#10A37F', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('efcffa44-9400-4451-abf9-62bbd7e9df95', '代码', 'codes.system.codes.type.code', NULL, '2026-02-16 14:34:19', 0, '5c320f36-6371-4f6f-a2d5-7a02a25d29a7', 'value', 'code', 2, 'enabled', 'carbon:character-upper-case', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f042fded-aeb1-48b9-8a1d-b083c2a94573', '文本转语音', 'codes.llm.models.type.text2speech', NULL, '2026-02-21 07:03:15', 0, 'b66d4393-67c1-4d91-9e5e-819a06bdedc6', 'value', 'text2speech', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f1eee605-8915-4a41-90ed-ff7fe890cb8d', '状态', 'codes.llm.config.status.title', NULL, '2026-02-21 18:16:36', 0, '508a1deb-62ca-4d24-8eff-69b0daa3b5fa', 'code', 'status', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f22164a2-0174-484e-ac28-cf5fe2b4be31', '状态', 'codes.system.roles.status.title', NULL, '2026-02-16 05:02:57', 0, '99545cf3-78de-4746-9fec-3eb3ec4888a2', 'code', 'status', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f46ebe93-537c-465c-aaa8-7ae693854a79', '在职', 'codes.organization.employees.status.active', NULL, '2026-02-17 15:39:53', 0, '7650b149-84a5-468f-b146-6a64b0dd3442', 'value', 'active', 1, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f9070df2-160f-418b-93ef-66e7dccf6337', '语音识别', 'codes.llm.models.ability.speechRecognition', NULL, '2026-02-28 08:31:42', 0, '8d4275d0-e310-416b-9e3e-720c619be24b', 'value', 'speechRecognition', 3, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f954f251-ae93-4e7d-9c69-f2563542fbd8', '已启用', 'codes.system.codes.status.enabled', NULL, '2026-02-17 02:48:24', 0, 'afc652e7-9067-4b01-8cc5-1132c2485a53', 'value', 'enabled', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('fe4ac417-b515-41a4-94aa-e9e5b8846095', '状态', 'codes.system.skills.status.title', NULL, '2026-02-25 12:43:47', 0, '7db90067-9a7c-4d5f-bec0-760d1b09596e', 'code', 'status', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('328537d8-47ed-4f9b-b5b3-6d016f99b31c', 'XiaoMi', 'codes.llm.providers.directory.xiaomi', NULL, NULL, 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'xiaomi', 0, 'enabled', 'cib:xiaomi', '#FF6A00', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('b677e7e3-c2af-44fe-87d1-f85f8b326ccf', '工作模式', 'codes.organization.agents.mode.title', NULL, '2026-03-28 03:58:30', 0, 'c62010b5-bbd7-448a-b162-2435796be70f', 'code', 'mode', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('8c42959a-ad0d-4645-9898-c650635bd213', '代理', 'codes.organization.agents.mode.agent', NULL, '2026-03-28 03:59:35', 0, 'b677e7e3-c2af-44fe-87d1-f85f8b326ccf', 'value', 'agent', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('6d65519b-258a-485d-9f47-a6c96f8c63b2', '委托', 'codes.organization.agents.mode.delegate', NULL, '2026-03-28 04:00:36', 0, 'b677e7e3-c2af-44fe-87d1-f85f8b326ccf', 'value', 'delegate', 0, 'enabled', NULL, NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('f4a87868-5c01-4bea-b03a-e782c137937f', '硅基流动', 'codes.llm.providers.directory.siliconflow', NULL, '2026-03-28 11:28:56', 0, 'cf9c31bd-51a0-4ac6-8260-1a3a8e2b2d55', 'value', 'siliconflow', 0, 'enabled', 'token:silicon', '#a30af5', NULL)
    `);
    await db.run(`
      INSERT INTO t_codes (sid, name, title, description, create_time, deleted, parent_id, type, value, sort, status, icon, color, metadata) 
      VALUES ('4e6513c9-d200-4ee4-87d1-abbd99b3a1ff', '定时', 'codes.organization.agents.mode.timer', NULL, '2026-03-29 00:35:26', 0, 'b677e7e3-c2af-44fe-87d1-f85f8b326ccf', 'value', 'timer', 0, 'enabled', NULL, NULL, NULL)
    `);

  // t_contacts (2 rows)
    await db.run(`
      INSERT INTO t_contacts (sid, type, source_id, short_term_memory, status, description, create_time, deleted, profile) 
      VALUES ('c4fde63c-a59e-451b-b100-588bd9eb8b0e', 'employee', 'ab4b14f5-c78b-4a9c-8165-0dd580ddd40f', NULL, 'enabled', NULL, '2026-04-01 03:59:10', 0, '{"department":"fdc18c32-2a77-4b46-be1f-394fe694432e","departmentName":"organization.departments.departments.general","position":"organization.positions.strategy.general","employeeNo":"AS0000"}')
    `);
    await db.run(`
      INSERT INTO t_contacts (sid, type, source_id, short_term_memory, status, description, create_time, deleted, profile) 
      VALUES ('contact_1775016081848_70fv5vm', 'visitor', NULL, NULL, 'enabled', NULL, '2026-04-01 04:01:21', NULL, NULL)
    `);

  // t_departments (11 rows)
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('229865fd-73f9-4659-a09f-0fb32bca8aca', '仓库', 'carbon:ibm-knowledge-catalog', '仓库部门作为物资存储与流转的核心枢纽，负责统筹库存管理、出入库作业及物资调配，确保供应链高效运转。隶属仓储管理组，协同采购、生产与物流部门，保障物料及时供应与成本优化。其价值在于提升库存周转率、降低仓储损耗、支持企业运营节奏，是连接供应链上下游的关键节点。通过标准化作业与信息化管理，持续优化仓储效能，为企业降本增效提供坚实支撑。', '2026-02-15 11:12:53', 0, 'enabled', 'Warehouse', 'group', '7f448191-2435-4553-95e4-8f42c1d502e4', '/607405a9-3838-46ec-861e-28e6b0e0d765/7f448191-2435-4553-95e4-8f42c1d502e4/', 0, NULL, NULL, 'organization.departments.departments.warehouse', 'Storage Team', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('607405a9-3838-46ec-861e-28e6b0e0d765', '奥森智能信息科技（苏州）有限责任公司', 'carbon:building-insights-3', '奥森智能是专业的AI解决方案提供商，依托AI原生的摇篮产品（Cradle），致力为企业提供一站式数字员工解决方案，打造企业专属的数字资产容器，为企业员工配置一对一或多对一的智能Agent，引导员工沉淀工作方法，帮助企业沉淀商业逻辑、成为企业业务智能中枢，形成企业核心数字资产。', '2026-02-15 10:58:12', 0, 'enabled', 'Aosen', 'company', NULL, '/', 0, 'Frikey', NULL, 'organization.departments.departments.aosen', 'Aosen Intelligent Information Technology (Suzhou) Co., Ltd', '## 【礼仪规范】
在与公司的员工在互动时，应该遵守以下礼仪：
1. 尊重员工的隐私，不泄露个人信息，不提供超越员工职责所需范围的任何信息。
2. 对于直属上级，可以称呼*总，或者老板。
3. 对于高层领导只能称对方的姓氏加职位简称，例如：张总裁，李懂避免使用冒犯性的语言。
4. 对于公司同事，年长的可以叫*哥、*姐。', 'culture')
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('6477a157-a1d2-4e96-8e9a-3d9e90e5cdc0', '运输', 'carbon:delivery-truck', '运输部门作为核心物流支持单元，负责统筹货物调度、运输路线优化及交付时效管理，确保供应链高效运转。其定位为连接生产与终端的关键枢纽，通过标准化操作与智能调度系统，提升运输准确率与成本控制能力。部门价值体现在保障交付稳定性、降低物流损耗、响应市场变化，同时协同仓储、采购等职能，构建敏捷响应的全链路服务体系，为运营效率与客户满意度提供坚实支撑。', '2026-02-15 11:14:36', 0, 'enabled', 'Transport', 'group', '7f448191-2435-4553-95e4-8f42c1d502e4', '/607405a9-3838-46ec-861e-28e6b0e0d765/7f448191-2435-4553-95e4-8f42c1d502e4/', 0, NULL, NULL, 'organization.departments.departments.transport', 'Transport Team', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('7f448191-2435-4553-95e4-8f42c1d502e4', '物流部', 'carbon:delivery-settings', '物流部负责统筹公司货物运输、仓储管理及供应链协同，确保物资高效流转与交付准时率。作为连接生产与销售的关键枢纽，本部门通过优化配送路径、提升库存周转效率，支撑整体运营节奏。其定位为保障供应链稳定运行的核心执行单元，价值体现在降本增效、客户体验提升及跨部门协作协同。在上级组织统筹下，物流部持续推动数字化管理升级，强化风险管控与应急响应能力，为公司战略落地提供坚实后勤保障。', '2026-02-15 11:09:15', 0, 'enabled', 'Logistics', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 3, NULL, NULL, 'organization.departments.departments.logistics', 'Logistics Department', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('9a4aa972-21ae-47b8-a45b-5818c0c56487', '售前', 'carbon:user-service-desk', '售前团队作为公司业务拓展的核心支持部门，专注于客户需求分析、解决方案设计与投标支持，紧密协同销售与技术团队，确保项目前期高效衔接。其定位是连接客户与交付的桥梁，通过专业咨询与定制化方案提升中标率与客户满意度。团队价值体现在快速响应市场变化、优化售前流程、沉淀行业知识库，助力公司战略落地与营收增长。作为集团体系下的独立职能组，售前团队在组织架构中承担关键协同角色，推动跨部门协作，强化客户体验，是公司竞争力的重要支撑力量。', '2026-02-15 11:11:04', 0, 'enabled', 'Presale', 'group', 'c2f68395-afbb-4f7f-a236-c34dbbb0bb55', '/607405a9-3838-46ec-861e-28e6b0e0d765/c2f68395-afbb-4f7f-a236-c34dbbb0bb55/', 0, NULL, NULL, 'organization.departments.departments.presale', 'Pre-sales team', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('c2f68395-afbb-4f7f-a236-c34dbbb0bb55', '销售部', 'carbon:sales-ops', '销售部作为公司核心业务推动单元，负责市场拓展、客户关系维护及销售目标达成，直接支撑营收增长与品牌影响力提升。部门以客户为中心，协同产品、市场与运营，优化销售流程，提升转化效率，确保战略目标落地。其价值不仅体现在业绩贡献，更在于洞察市场趋势、反馈客户需求，为公司决策提供关键数据支持。作为直属管理层的重要执行单元，销售部持续强化团队专业能力与协作机制，是连接企业与市场的关键桥梁，驱动可持续增长。', '2026-02-15 11:06:18', 0, 'enabled', 'Sales', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 2, NULL, NULL, 'organization.departments.departments.sales', 'Sales Department', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('d2cc015a-a360-449c-8d23-012289450770', '行政部', 'carbon:ibm-cloud-projects', '行政部作为组织核心支持单位，负责统筹日常运营、制度执行与资源协调，保障各部门高效运转。其职责涵盖行政事务、办公环境维护及跨部门沟通协作，是连接管理层与执行层的重要枢纽。部门以服务为本，注重流程优化与合规管理，通过标准化、精细化运作提升组织效能。在上级组织领导下，行政部持续推动管理规范化与文化落地，强化内部协同，为战略实施提供坚实支撑，是组织稳定运行与持续发展的关键保障力量。', '2026-02-15 11:00:56', 0, 'enabled', 'Administrative', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 1, NULL, NULL, 'organization.departments.departments.administrative', 'Administrative Office', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('e5dad98d-22c4-4544-b14b-1608f68b7bd5', '客服', 'carbon:user-service', '客服团队作为企业与客户之间的核心桥梁，负责全天候响应客户咨询、处理投诉及提供解决方案，确保客户体验持续优化。作为服务支持型部门，其定位是提升客户满意度与忠诚度，同时收集用户反馈以推动产品与流程改进。团队高效协同，依托标准化服务流程与智能工具，保障服务响应速度与质量，是企业品牌口碑的重要守护者。其价值不仅体现在问题解决层面，更在于通过服务洞察客户真实需求，为企业战略决策提供数据支持与方向指引。', '2026-02-15 11:11:33', 0, 'enabled', 'Customer', 'group', 'c2f68395-afbb-4f7f-a236-c34dbbb0bb55', '/607405a9-3838-46ec-861e-28e6b0e0d765/c2f68395-afbb-4f7f-a236-c34dbbb0bb55/', 0, NULL, NULL, 'organization.departments.departments.customer', 'Customer Service Team', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('f256e845-c3f5-4d88-9dbc-8db3699c34e6', '采购部', 'carbon:purchase', '采购部作为企业供应链核心职能部门，负责统筹全公司物资、设备及服务的采购工作，确保供应及时、成本优化、质量达标。部门紧密协同生产、财务与仓储等环节，通过标准化流程与供应商管理，提升采购效率与风险控制能力。其定位是成本控制与战略支持并重，不仅保障运营所需资源，更通过集中采购与战略谈判创造价值。', '2026-02-15 11:07:47', 0, 'enabled', 'Purchase', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 5, NULL, NULL, 'organization.departments.departments.purchase', 'Procurement Department', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('fdc18c32-2a77-4b46-be1f-394fe694432e', '总经办', 'carbon:equalizer', '总经办作为公司核心协调与决策支持部门，负责统筹战略执行、跨部门协作及高层事务管理，确保组织高效运转。其定位为连接管理层与执行层的枢纽，通过优化资源配置、推动制度落地与重大事项决策，持续提升企业运营效能。部门价值体现在强化执行力、保障战略一致性，并为管理层提供数据支持与前瞻洞察，助力企业稳健发展与持续创新。', '2026-02-15 14:59:11', 0, 'enabled', 'General', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 0, 'ab4b14f5-c78b-4a9c-8165-0dd580ddd40f', NULL, 'organization.departments.departments.general', 'General Manager''s Office', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_departments (sid, name, icon, description, create_time, deleted, status, code, type, parent_id, path, sort, leader_id, ext_config, title, e_name, culture, soul) 
      VALUES ('33ef27f4-58b1-4087-944b-933452351c9d', '市场部', 'carbon:chart-bar-stacked', NULL, '2026-03-28 03:28:10', 0, 'enabled', 'Market', 'departments', '607405a9-3838-46ec-861e-28e6b0e0d765', '/607405a9-3838-46ec-861e-28e6b0e0d765/', 0, NULL, NULL, 'organization.departments.departments.market', 'Market', NULL, NULL)
    `);

  // t_employees (1 rows)
    await db.run(`
      INSERT INTO t_employees (sid, name, description, create_time, deleted, status, employee_no, oid, position_id, email, phone, hire_date, user_id, location, type, profile, e_name) 
      VALUES ('ab4b14f5-c78b-4a9c-8165-0dd580ddd40f', 'Supervisor', NULL, '2026-02-15 17:27:08', 0, 'active', 'AS0000', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'd91cd54b-0def-4d40-acda-3352aa7ef4d5', 'Supervisor@126.com', '18919999999', '2026-01-14', '67df68a8-999d-4ac4-9053-d26560d94fbc', 'Suzhou', 'full-time', NULL, 'Supervisor')
    `);

  // t_llm_configs (9 rows)
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('44e36a56-b562-4a33-980e-c651fff43fbd', 'Qwen3-ASR-Flash-Realtime', '实时语音文字双向识别，能够自动判断语种并准确识别 11 个语种的语音，在复杂的音频环境下能够保证精确转录。', '7396cd8a-05c6-403f-a706-7bc52907d098', 'wss://dashscope.aliyuncs.com/api-ws/v1/realtime', NULL, 30000, 3, 3, '2026-02-22 05:43:23', 0, 'enabled', 'qwen3-asr-flash-realtime', 'text', 8192, 'api_key', '{"type":"session.update","session":{"modalities":["text"],"sample_rate":16000,"turn_detection":{"type":"server_vad","threshold":0,"silence_duration_ms":400},"input_audio_format":"pcm","input_audio_transcription":{"language":"zh"}},"event_id":"event_123"}', 'prepaid', 'disabled', 'enabled', 'alibaba', '["realtimeSpeach"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('47bd83a1-90b8-4e76-93d9-9aa821766a83', 'text-embedding-v4', '通用文本向量', '7396cd8a-05c6-403f-a706-7bc52907d098', 'https://dashscope.aliyuncs.com/compatible-mode/v1', NULL, 30000, 3, 3, '2026-02-22 05:37:52', 0, 'enabled', 'text-embedding-v4', 'embedding', 8192, 'api_key', NULL, 'prepaid', 'enabled', 'enabled', 'alibaba', '["textEmbedding"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('5bbf44fd-2dcf-4af6-af96-1b45afab929d', 'deepseek v3.2', '685B 满血版', '7396cd8a-05c6-403f-a706-7bc52907d098', 'https://dashscope.aliyuncs.com/compatible-mode/v1', NULL, 30000, 3, 2, '2026-02-22 03:38:14', 0, 'enabled', 'deepseek-v3.2', 'text', 131072, 'api_key', NULL, 'prepaid', 'enabled', 'enabled', 'alibaba', '["textGeneration","deepThinking"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('7832dbfc-b7d7-4a14-87bd-cd08913c55db', 'Qwen3.5-Plus', '在语言理解、逻辑推理、代码生成、智能体任务、图像理解、视频理解等多种任务中表现突出', '7396cd8a-05c6-403f-a706-7bc52907d098', 'https://dashscope.aliyuncs.com/compatible-mode/v1', NULL, 30000, 3, 0, '2026-02-22 06:03:52', 0, 'enabled', 'qwen3.5-plus', 'text', 1048576, 'api_key', NULL, 'prepaid', 'disabled', 'enabled', 'alibaba', '["textGeneration","deepThinking","visualComprehension"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('be27fa78-25d5-421d-8a8b-300cecab8c37', 'GLM 5', 'GLM 5 ', '7396cd8a-05c6-403f-a706-7bc52907d098', 'https://dashscope.aliyuncs.com/compatible-mode/v1', NULL, 30000, 3, 0, '2026-03-16 12:49:21', 0, 'enabled', 'glm-5', 'text', 202752, 'api_key', NULL, 'usage', 'enabled', 'enabled', 'alibaba', '["textGeneration"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('fd89dece-47ac-4afc-835e-2f5e78a92f29', 'qwen3-omni-flash', '非实时 Qwen-Omni', '7396cd8a-05c6-403f-a706-7bc52907d098', 'https://dashscope.aliyuncs.com/compatible-mode/v1', NULL, 30000, 3, 1, '2026-02-22 04:27:26', 0, 'enabled', 'qwen3-omni-flash-2025-12-01', 'multimodal', 65536, 'api_key', '{"audio":{"voice":"Cherry","format":"wav"},"stream":true,"modalities":["text","audio"],"stream_options":{"include_usage":true}}', 'prepaid', 'enabled', 'enabled', 'alibaba', '["textGeneration","deepThinking","visualComprehension","speechSynthesis","speechRecognition"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('afe931f4-ec99-4ee0-bf6c-3445eb96cae7', 'mimo-v2-pro', 'Xiaomi MiMo-V2-Pro', '422d8e62-e94e-4905-b9ea-bd145c9b9d52', 'https://api.xiaomimimo.com/v1', NULL, 30000, 3, 0, '2026-03-19 16:08:46', 0, 'enabled', 'mimo-v2-pro', 'text', 1048576, 'api_key', NULL, 'free', 'enabled', 'disabled', 'xiaomi', '["textGeneration","deepThinking"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('be0a1818-3922-4111-b892-e659aa02ef00', 'GLM-4.7', 'GLM-4.7', '7aa44977-f30a-4023-af73-d9625f407b2c', 'https://api.siliconflow.cn/v1', NULL, 30000, 3, 0, '2026-03-28 11:41:58', 0, 'enabled', 'Pro/zai-org/GLM-4.7', 'text', 202752, 'api_key', NULL, 'usage', 'disabled', 'enabled', 'siliconflow', '["textGeneration","deepThinking"]')
    `);
    await db.run(`
      INSERT INTO t_llm_configs (sid, name, description, provider_id, base_url, icon, timeout, retries, sort, create_time, deleted, status, model_name, model_type, context_size, auth_method, parameters, subscribe_type, enable_thinking, stream, provider_name, model_ability) 
      VALUES ('347de53a-d627-49f2-83f1-e5c8000446f0', 'GLM 5', 'GLM 5', '7aa44977-f30a-4023-af73-d9625f407b2c', 'https://api.siliconflow.cn/v1', NULL, 30000, 3, 0, '2026-03-31 13:57:01', 0, 'enabled', 'Pro/zai-org/GLM-5', 'text', 202752, 'api_key', NULL, 'usage', 'disabled', 'enabled', 'siliconflow', '["textGeneration","deepThinking"]')
    `);

  // t_llm_providers (8 rows)
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('2970aa41-1548-4821-8ffd-2174f8c5b1bb', 'minimax', 'llm.provider.minimax', 'MiniMax', 'MiniMax 是稀宇科技旗下的大模型提供商，提供 abab 系列大语言模型，支持中文对话、文本生成等功能。', 7, '2026-02-21 13:12:23', 0, 'enabled', 'simple-icons:minimax', '#1A73E8')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('2e3ef9a6-4fa2-4e74-a634-0b07ea68211f', 'zhipu', 'llm.provider.zhipu', 'Zhipu AI', '智谱AI，清华系大模型公司，提供ChatGLM系列模型', 3, '2026-02-21 09:11:36', 0, 'enabled', '/zhipu.png', '#000000')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('7396cd8a-05c6-403f-a706-7bc52907d098', 'alibaba', 'llm.provider.alibaba', 'Ali Qwen', '阿里云通义千问，阿里巴巴出品的大语言模型', 0, '2026-02-21 09:11:36', 0, 'enabled', 'hugeicons:qwen', '#FF6A00')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('755868bc-a95b-40ea-82e9-0bdf6ab129f5', 'anthropic', 'llm.provider.anthropic', 'Anthropic', 'Anthropic是AI安全研究公司，提供Claude系列大语言模型', 4, '2026-02-21 09:39:48', 0, 'enabled', 'simple-icons:anthropic', '#D4A574')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('8616e79f-ce4a-401f-bcdb-3c5f84f53686', 'openai', 'llm.provider.openai', 'OpenAI', 'OpenAI是全球领先的AI研究公司，提供GPT系列大语言模型', 1, '2026-02-21 09:11:36', 0, 'enabled', 'simple-icons:openai', '#10A37F')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('9675a7fc-1b04-43fb-9816-97a2ba749ccc', 'google', 'llm.provider.google', 'Google Gemini', 'Google Gemini是谷歌推出的多模态大语言模型', 5, '2026-02-21 09:39:48', 0, 'enabled', 'simple-icons:google', '#4285F4')
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('422d8e62-e94e-4905-b9ea-bd145c9b9d52', 'xiaomi', 'XiaoMi', 'XiaoMi', NULL, 0, '2026-03-19 16:00:07', 0, 'enabled', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_llm_providers (sid, name, title, ename, description, sort, create_time, deleted, status, icon, color) 
      VALUES ('7aa44977-f30a-4023-af73-d9625f407b2c', 'siliconflow', 'Siliconflow', 'Siliconflow', 'Siliconflow', 0, '2026-03-28 11:29:58', 0, 'enabled', NULL, NULL)
    `);

  // t_modules (53 rows)
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('0769de34-b843-4539-8d82-3a8218ce14e8', 'organization-agent', 'organization.agents.moduleName', 'function', '/organization/agents', '/organization/agents/list', '69fe1963-341c-4ff7-ad9c-c418bee3dcde', 5, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:view', 'mdi:robot', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('08de42e8-fe0d-4c96-85e1-21a60573de7a', 'organization-dept-add', 'organization.departments.create', 'action', '', '', '0c04e6ce-a7a8-4dbf-8207-6b910d7bed87', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:dept:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('0c04e6ce-a7a8-4dbf-8207-6b910d7bed87', 'organization-dept', 'organization.departments.moduleName', 'function', '/organization/departments', '/organization/departments/list', '69fe1963-341c-4ff7-ad9c-c418bee3dcde', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:dept:view', 'ant-design:partition-outlined', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('1304e872-dd87-4be9-9be4-fb06c0c99632', '模型提供商', 'llm.providers.moduleName', 'function', '/llm/providers', '/llm/providers/list', '1877f7f9-9ca2-4b7f-96bd-6d3fa2f7e6da', 0, 0, 'enabled', '2026-02-21 08:32:09', '{}', 'llm:providers:view', 'carbon:ibm-z-cloud-provisioning', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('133819aa-6c33-4892-897f-ec987b0afaa1', 'system-skill-delete', 'system.skill.delete', 'action', '', '', 'dbe64491-f6e9-4570-a2fc-f575b6bc4718', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'system:skill:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('134a57d1-0ff3-4a5a-9752-5458207ee911', 'organization-position-add', 'organization.positions.create', 'action', '', '', '1d4def7d-a108-4b53-b222-3c060f2926dc', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:position:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('1877f7f9-9ca2-4b7f-96bd-6d3fa2f7e6da', '大模型管理', 'llm.moduleName', 'function', '/llm', 'BasicLayout', '0', 1, 0, 'enabled', '2026-02-21 08:09:09', '{}', 'llm:view', 'streamline:insert-side-solid', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('1cee2f16-c304-4c53-a559-98da070aebc1', 'organization-dept-edit', 'organization.departments.edit', 'action', '', '', '0c04e6ce-a7a8-4dbf-8207-6b910d7bed87', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:dept:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('1d4def7d-a108-4b53-b222-3c060f2926dc', 'organization-position', 'organization.positions.moduleName', 'function', '/organization/positions', '/organization/positions/list', '69fe1963-341c-4ff7-ad9c-c418bee3dcde', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:position:view', 'mdi:briefcase', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('267e5dd2-2522-4e2b-9d20-8fd1cf61515e', 'dashboard-analysis', 'workspace.analytics', 'function', '/analytics', '/dashboard/analytics/index', '63af313f-6b3d-4d50-8cc1-791fe9682692', 1, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'workspace:analytics:view', 'mdi:chart-bar', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('279ea582-c9ed-4796-9bd7-b81c33bb144f', 'system-user-add', 'system.users.create', 'action', '', '', 'c0c33b2b-cd64-4070-b423-49013a73ac65', 1, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('2f9adc33-e9e3-4ce5-aa03-a54a260bf81d', 'organization-dept-delete', 'organization.departments.delete', 'action', '', '', '0c04e6ce-a7a8-4dbf-8207-6b910d7bed87', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:dept:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('4b58d16c-37d9-4097-af0e-522e1e1df57a', 'organization-agent-runtime-log', 'organization.agents.runtime.log', 'action', '/organization/agent/runtime/log', '/organization/agent/runtime/log', 'ffcaec03-69fe-4c35-9a04-777ea4fe4bfe', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:runtime:log', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('4d8fd838-f99f-4e04-afc6-6f8f88eaea1f', 'organization-agent-edit', 'organization.agents.edit', 'action', '', '', '0769de34-b843-4539-8d82-3a8218ce14e8', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('4fd5ccc6-469a-48b0-bc9a-5a940347f02d', 'dashboard-workplace', 'workspace.messageCenter', 'function', '/workspace/chat', '/workspace/chat/index', '63af313f-6b3d-4d50-8cc1-791fe9682692', 0, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'workspace:message:view', 'mdi:desktop-tower-monitor', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('5200aa48-8535-472a-b2f8-811febd66cc6', 'organization-agent-runtime-monitor', 'organization.agents.runtime.monitor', 'action', '/organization/agent/runtime/monitor', '/organization/agent/runtime/monitor', 'ffcaec03-69fe-4c35-9a04-777ea4fe4bfe', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:runtime:monitor', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('5812ec95-ab26-4ea1-951a-1e04074f00af', '联系人', 'organization.contacts.moduleName', 'function', '/organization/contacts', '/organization/contacts/list', '69fe1963-341c-4ff7-ad9c-c418bee3dcde', 6, 0, 'enabled', '2026-02-23 17:43:12', '{}', 'organization:contacts:view', 'carbon:airline-manage-gates', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('5a32b387-7cba-4d69-bfd0-2905b043a0d2', 'organization-employee-add', 'organization.employees.create', 'action', '', '', 'f92b7b1b-1ae2-4e44-aeff-2f5d76c512f0', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:employee:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('63af313f-6b3d-4d50-8cc1-791fe9682692', 'workspace', 'workspace.moduleName', 'module', '/workspace', 'BasicLayout', '0', 0, 0, 'enabled', '2026-02-15 01:11:05', '{"keepAlive":true}', 'workspace:view', 'mdi:view-dashboard', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('65b3b5ee-13b5-48da-8819-7622faab4dcd', 'system-role-permission', 'system.roles.permissions', 'action', '', '', 'f69aabec-acca-4803-9be5-cb42b06da5cd', 4, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:role:permission', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('66ab070c-216f-4c4c-944a-66fba5b23793', 'system-skill-add', 'system.skill.create', 'action', '', '', 'dbe64491-f6e9-4570-a2fc-f575b6bc4718', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'system:skill:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('69fe1963-341c-4ff7-ad9c-c418bee3dcde', 'organization', 'organization.moduleName', 'module', '/organization', 'BasicLayout', '0', 2, 0, 'enabled', '2026-02-15 01:11:06', NULL, 'organization:view', 'ant-design:apartment-outlined', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('6a0d6fdb-2aa8-4d1e-925a-70472895a460', 'system-user-export', 'system.users.export', 'action', '', '', 'c0c33b2b-cd64-4070-b423-49013a73ac65', 4, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:export', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('6bba9816-8177-4d13-b70a-e7b1940ef683', '代码管理', 'system.codes.moduleName', 'function', '/system/codes', '/system/codes/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 0, 0, 'enabled', '2026-02-16 23:19:00', '{}', 'system:codes:view', 'tabler:code-dots', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('711eb288-9ab3-41e0-9a82-ffcc9396e92b', '通道管理', 'system.channels.moduleName', 'function', '/system/channels', '/system/channels/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 4, 0, 'enabled', '2026-02-23 16:31:16', '{}', 'system:channel:view', 'carbon:ibm-cloud-direct-link-1-exchange', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('7486cb62-e226-4876-beb2-fe2c56e63a53', 'system-role-add', 'system.roles.create', 'action', '', '', 'f69aabec-acca-4803-9be5-cb42b06da5cd', 1, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:role:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('7930e2fd-0157-41b8-a0ea-4c8d442f2731', '模块管理', 'system.modules.moduleName', 'function', '/system/modules', '/system/modules/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 3, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:module:view', 'akar-icons:text-align-justified', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('7d754c57-fc20-43ab-a340-d7a9c4bf97a2', 'organization-agent-add', 'organization.agents.create', 'action', '', '', '0769de34-b843-4539-8d82-3a8218ce14e8', 1, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:add', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('883452e2-f9b9-41ce-9f77-0f5e37b804dd', 'organization-agent-delete', 'organization.agents.delete', 'action', '', '', '0769de34-b843-4539-8d82-3a8218ce14e8', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:agent:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('8a58220d-f703-49eb-ab79-5c2b320ee67b', 'system-user-import', 'system.users.import', 'action', '', '', 'c0c33b2b-cd64-4070-b423-49013a73ac65', 5, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:import', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('8e9bba7e-612a-43b1-8e93-6021cbf93648', 'system-role-edit', 'system.roles.edit', 'action', '', '', 'f69aabec-acca-4803-9be5-cb42b06da5cd', 2, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:role:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('938300a8-109c-41e3-90c0-fa8640835926', 'organization-employee-delete', 'organization.employees.delete', 'action', '', '', 'f92b7b1b-1ae2-4e44-aeff-2f5d76c512f0', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:employee:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('95d71cf9-eaa2-489d-89b5-b70f93288c8a', 'system-user-edit', 'system.users.edit', 'action', '', '', 'c0c33b2b-cd64-4070-b423-49013a73ac65', 2, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('a9df9a7b-0ab1-43f4-83cb-19ad4a073c56', '实例管理', 'llm.instances.moduleName', 'function', '/llm/instances', '/llm/instances/list', '1877f7f9-9ca2-4b7f-96bd-6d3fa2f7e6da', 2, 0, 'enabled', '2026-02-22 11:33:38', '{}', 'llm:instance:view', 'carbon:ibm-instana', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('c0c33b2b-cd64-4070-b423-49013a73ac65', 'system-user', 'system.users.moduleName', 'function', '/system/users', '/system/users/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 1, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:view', 'mdi:account', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('c9ae26cd-d5b9-417c-8617-576a354800a3', 'system', 'system.moduleName', 'module', '/system', 'BasicLayout', '0', 3, 0, 'enabled', '2026-02-15 01:11:05', '{"activeIcon":"carbon:add-filled"}', 'system:view', 'material-symbols:settings', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('d223e9fa-9a32-4336-9adb-f4ae9e23223b', 'system-role-delete', 'system.roles.delete', 'action', '', '', 'f69aabec-acca-4803-9be5-cb42b06da5cd', 3, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:role:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('d56e7b68-b014-4160-8256-f9266ec32422', '日志管理', 'llm.logs.moduleName', 'function', '/llm/logs', '/llm/logs/list', '1877f7f9-9ca2-4b7f-96bd-6d3fa2f7e6da', 6, 0, 'enabled', '2026-03-15 04:57:30', '{}', 'system:logs:view', 'carbon:catalog-publish', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('dbe64491-f6e9-4570-a2fc-f575b6bc4718', 'system-skill', 'system.skills.moduleName', 'function', '/system/skills', '/system/skills/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 5, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'system:skills:view', 'mdi:lightning-bolt', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('e2eaebc9-865b-4246-94eb-43d54dd6ce79', 'system-skill-edit', 'system.skill.edit', 'action', '', '', 'dbe64491-f6e9-4570-a2fc-f575b6bc4718', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'system:skill:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('ecbb305c-e73a-453c-9a6c-334111488a91', 'system-user-delete', 'system.users.delete', 'action', '', '', 'c0c33b2b-cd64-4070-b423-49013a73ac65', 3, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:user:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('f1b13af5-c85b-4e6d-9a1c-872c547ebd86', 'system-skill-publish', 'system.skill.publish', 'action', '', '', 'dbe64491-f6e9-4570-a2fc-f575b6bc4718', 4, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'system:skill:publish', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('f69aabec-acca-4803-9be5-cb42b06da5cd', 'system-role', 'system.roles.moduleName', 'function', '/system/roles', '/system/roles/list', 'c9ae26cd-d5b9-417c-8617-576a354800a3', 2, 0, 'enabled', '2026-02-15 01:11:05', '{}', 'system:role:view', 'mdi:account-group', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('f7ab77b9-3eb1-413d-936f-6e783abe2ee8', 'organization-position-edit', 'organization.positions.edit', 'action', '', '', '1d4def7d-a108-4b53-b222-3c060f2926dc', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:position:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('f92b7b1b-1ae2-4e44-aeff-2f5d76c512f0', 'organization-employee', 'organization.employees.moduleName', 'function', '/organization/employees', '/organization/employees/list', '69fe1963-341c-4ff7-ad9c-c418bee3dcde', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:employee:view', 'mdi:account-multiple', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('fbf0b810-4ad0-4269-9849-b333c06154fc', 'organization-position-delete', 'organization.positions.delete', 'action', '', '', '1d4def7d-a108-4b53-b222-3c060f2926dc', 3, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:position:delete', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('fd5aac83-25a2-46f3-a04c-fc231df4acfd', 'organization-employee-edit', 'organization.employees.edit', 'action', '', '', 'f92b7b1b-1ae2-4e44-aeff-2f5d76c512f0', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'organization:employee:edit', '', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('ffcaec03-69fe-4c35-9a04-777ea4fe4bfe', 'organization-agent-runtime', 'workspace.monitor', 'function', '/organization/agent/runtime', '/examples/modal/index', '63af313f-6b3d-4d50-8cc1-791fe9682692', 2, 0, 'enabled', '2026-02-15 01:11:06', '{}', 'workspace:monitor:view', 'mdi:chart-line', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('mod-crm', '客户管理', 'customer.title', 'module', '/customer', NULL, '0', 100, 0, 'enabled', '2026-03-20T02:36:31.960Z', '{}', 'customer:view', 'mdi:account-tie', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('mod-crm-customers', '客户列表', 'customer.customers.title', 'function', '/customer/customers', '/customer/customers/list.vue', 'mod-crm', 10, 0, 'enabled', '2026-03-20T02:36:31.960Z', '{}', 'customer:customers:view', 'mdi:account-multiple', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('mod-crm-opportunities', '商机管理', 'customer.opportunities.title', 'function', '/customer/opportunities', '/customer/opportunities/list.vue', 'mod-crm', 20, 0, 'enabled', '2026-03-20T02:36:31.960Z', '{}', 'customer:opportunities:view', 'mdi:lightbulb-on', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('mod-crm-deals', '成交管理', 'customer.deals.title', 'function', '/customer/deals', '/customer/deals/list.vue', 'mod-crm', 30, 0, 'enabled', '2026-03-20T02:36:31.960Z', '{}', 'customer:deals:view', 'mdi:handshake', NULL)
    `);
    await db.run(`
      INSERT INTO t_modules (sid, name, title, type, path, component, pid, sort, deleted, status, create_time, meta, auth_code, icon, description) 
      VALUES ('mod-crm-followups', '跟进记录', 'customer.followups.title', 'function', '/customer/followups', '/customer/followups/list.vue', 'mod-crm', 40, 0, 'enabled', '2026-03-20T02:36:31.960Z', '{}', 'customer:followups:view', 'mdi:phone-log', NULL)
    `);

  // t_positions (7 rows)
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('42e7a0c8-7613-456e-8ec7-3fc842726fcc', '总经理助理', '岗位名称： 总经理助理
直接上级： 总经理
岗位类别： 管理类/文秘类

岗位核心价值：
协助总经理处理日常管理事务，协调内外部关系，跟进重点事项，起到承上启下的枢纽作用，确保总经理指令有效落地执行。

主要职责：

日程与事务管理（30%）： 统筹总经理日常行程（会议、商务洽谈、出差等）；协助处理文件签批、票据整理、来访接待等行政事务；维护办公室文档与环境。

会议与文书管理（25%）： 组织总经理办公会及公司级重要会议，负责通知、纪要撰写；跟踪会议决议落实进度并定期反馈；起草、归档总经理签发的各类文件（演讲稿、报告、信函等）。

跨部门协调与督办（30%）： 搭建沟通桥梁，确保信息上传下达准确；对总经理下达的重点工作任务进行追踪、稽核，定期反馈执行情况；协调解决跨部门协作中的矛盾。

对外公共关系（15%）： 协助进行商务接待、客户拜访与关系维护；配合处理突发事件及危机公关协助工作。', '2026-02-15 17:00:08', 0, 'enabled', 'Job_Sssistant_01', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'organization', 'organization.positions.strategy.assistant', 'Assistant', 'strategy', 'human')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('b90e3675-1b9e-4f68-9d9f-c23a7846a9fe', '销售总监', '岗位名称： 销售总监
直接上级： 总经理
下属团队： 销售经理/区域经理/销售代表
岗位类别： 核心业务管理岗

岗位核心价值：
全面负责公司销售团队的管理与市场开拓工作，制定并执行销售战略，带领团队完成年度销售目标，提升市场份额与品牌影响力，对公司的销售业绩与利润负全责。

主要职责：

战略规划与目标达成： 根据公司年度经营目标，制定销售策略、分解销售任务至各区域/团队；监督销售进度，确保月度、季度及年度销售回款与利润指标的达成。

团队建设与管理： 负责销售团队的组建、培训、考核与激励；建立高效的销售流程与标准，提升团队整体作战能力与专业素养。

市场开拓与客户管理： 带领团队开发新客户、新渠道，维护核心大客户关系；收集市场信息及竞品动态，为产品优化与定价提供决策依据。

过程管控与风险控制： 审批重大销售合同与政策，把控应收账款风险；协调跨部门（如市场、售后、生产）资源，解决销售过程中的重大难题。

任职要求： 本科及以上学历，5年以上销售经验，3年以上团队管理经验；具备敏锐的市场洞察力、优秀的谈判技巧与抗压能力；拥有行业资源者优先。', '2026-02-15 17:24:13', 0, 'enabled', 'Job_Tactics_01', 'c2f68395-afbb-4f7f-a236-c34dbbb0bb55', 'department', 'organization.positions.sales.diretor', 'Diretor', 'vision', 'agent')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('c97615f6-f61b-49ce-ae22-9bfedac4af7f', '总经理助理', '岗位名称： 总经理智能助理
直接上级： 总经理
下属团队： 无直接下属（可根据需要协调总经办资源）
岗位类别： 核心支持岗 / 高管助理

岗位核心价值：
作为总经理的“智能中枢”与“外部延伸”，统筹日程与信息流，运用数字化工具辅助决策与执行，确保战略意图精准落地，提升总经理工作效率与公司运营协同性。

主要职责：

日程与信息枢纽： 负责总经理动态日历管理，智能调度会议并处理冲突；过滤海量邮件、报告及资讯，利用AI工具提炼摘要，确保信息精准高效；建立数字化公文流转与档案管理体系。

战略执行督办： 将总经理决策转化为具体任务清单，通过协同办公工具分派至责任人并设定时限；跟进重点项目进度，定期收集数据，预警执行偏差；快速整理会议纪要，提取待办事项并纳入督办系统。

决策支持与外脑： 收集行业动态及内部运营数据，运用AI分析工具进行初步清洗与可视化呈现；起草演讲稿、工作报告、对外公函等，利用AI进行语法优化及多语言翻译。

商务与事务保障： 组织协调重要会议、商务接待及差旅行程；处理报销等日常行政事务，维护内外部合作关系，确保总经办运转顺畅。', '2026-02-26 12:19:31', 0, 'enabled', 'Job_Ssistant_01', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'all', 'organization.positions.general.assistant', 'assistant', 'vision', 'agent')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('d91cd54b-0def-4d40-acda-3352aa7ef4d5', '总经理', '岗位名称： 总经理
直接上级： 董事会/董事长
下属团队： 各部门总监/经理
岗位类别： 核心高管

岗位核心价值：
全面主持公司日常生产经营，执行董事会战略决议，带领管理团队实现年度经营目标，对公司的最终经营结果负全责。

主要职责：

战略规划与执行： 根据董事会战略目标，组织制定公司中长期发展战略及年度经营计划（含预算），并根据内外部环境动态调整；定期向董事会汇报经营及资金运用情况。

经营目标与业绩达成： 对公司的销售额、利润、市场份额及成本控制等年度经营结果负总责；审批各部门年度工作目标与考核方案；主持总经理办公会，协调跨部门矛盾，解决运营中的重大问题。

组织与团队建设： 优化组织架构，建立高效的管理体系；负责核心管理团队的选拔、任免、考核与激励，打造高绩效团队；推动企业文化建设，提升凝聚力与执行力。

重大决策与风险控制： 审批公司重大支出、投资项目及合同；处理重大突发事件与危机公关；维护政府、合作伙伴及大客户等内外部核心关系。', '2026-02-15 16:56:12', 0, 'enabled', 'Job_Strategy_01', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'organization', 'organization.positions.strategy.general', 'General', 'strategy', 'human')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('8d05dfb1-7517-4263-9903-12a32d443526', '直播间助理', '岗位名称： 直播间助理
直接上级： 主播
下属团队： 无直接下属（可根据直播需求协调场控、中控、技术支持等资源）
岗位类别： 核心支持岗 / 直播运营支持

岗位核心价值：
监控直播间评论区，辅助主播维持直播间秩序。

主要职责：

控制直播间互动区评论节奏：引导用户点赞、关注、加群，感谢用户互动。收集评论区意向，记录并整理用户提出的问题和疑问', '2026-03-27 16:54:05', 0, 'enabled', 'Job_Ssistant_02', '33ef27f4-58b1-4087-944b-933452351c9d', 'self', 'organization.positions.market.liveassistant', 'LIve assistant', 'execution', 'agent')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('614c5359-0195-4626-8535-d8ac82f06fe9', '首席信息官', '岗位名称： 首席信息官
直接上级： 总经理
下属团队： 无直接下属
岗位类别： 核心支持岗 / 战略执行辅助

岗位核心价值：
结合公司项目，收集行业信息，提供前沿准确的行业咨询，为产品设计演进，战略发展提供第一手信息。

主要职责：

每日监控各大资讯平台，获取当日重要行业咨询
https://news.aibase.cn/zh/news
https://news.aibase.cn/zh/daily', '2026-03-28 02:43:51', 0, 'enabled', 'Job_Strategy_02', 'fdc18c32-2a77-4b46-be1f-394fe694432e', 'self', 'organization.positions.general.cio', 'cio', 'strategy', 'agent')
    `);
    await db.run(`
      INSERT INTO t_positions (sid, name, description, create_time, deleted, status, code, oid, data_scope, title, e_name, level, type) 
      VALUES ('48ac1120-7ad1-4c8a-a151-aed47b3a3043', '在线客服', '岗位名称： 在线客服
直接上级： 总经理
下属团队： 无直接下属
岗位类别： 执行

岗位核心价值：
理解客户诉求，感受客户心情为客户提供疑问澄清，保持客户满意度。

主要职责：
解答客户咨询，宣扬公司理念解释重要概念。
', '2026-03-28 05:34:20', 0, 'enabled', 'Job_Execution_01', 'e5dad98d-22c4-4544-b14b-1608f68b7bd5', 'self', 'organization.positions.customer.service', 'Service', 'execution', 'agent')
    `);

  // t_roles (1 rows)
    await db.run(`
      INSERT INTO t_roles (sid, name, description, status, create_time, deleted, sort, title, e_name, permission) 
      VALUES ('role-admin-1771061046927', '超级管理员', NULL, 'enabled', '2026-02-14 09:24:05', 0, 0, NULL, NULL, '{"actions":["dashboard:view","dashboard:analysis:view","organization:agent:runtime:view","organization:agent:runtime:monitor","organization:agent:runtime:log","dashboard:workplace:view","system:view","system:codes:view","system:user:view","system:user:add","system:user:edit","system:user:delete","system:user:export","system:user:import","system:role:view","system:role:add","system:role:edit","system:role:delete","system:role:permission","system:module:view","system:skill:view","system:skill:add","system:skill:edit","system:skill:delete","system:skill:publish","organization:view","organization:dept:view","organization:dept:add","organization:dept:edit","organization:dept:delete","organization:position:view","organization:position:add","organization:position:edit","organization:position:delete","organization:employee:view","organization:employee:add","organization:employee:edit","organization:employee:delete","organization:skill:view","organization:skill:add","organization:skill:edit","organization:skill:delete","organization:agent:view","organization:agent:add","organization:agent:edit","organization:agent:delete"]}')
    `);

  // t_skills (67 rows)
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('08d3ae0f-370a-4919-83ca-41071087c051', 'PPT file creator', NULL, 'pptx', '1.0.0', NULL, 'upload', 'claude', NULL, NULL, NULL, 5, 5, '2026-03-11 03:22:05', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', 0)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('5d9892b2-9194-48d4-93f0-57d3ad67c3dc', 'PDF file creator', NULL, 'pdf', '1.0.0', NULL, 'upload', 'claude', NULL, NULL, NULL, 5, 5, '2026-03-11 03:22:56', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', 0)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('d20f9a39-08ac-4105-a7a8-da6d4745f14d', 'Word file creator', NULL, 'docx', '1.0.0', 'Word file creator', 'upload', 'claude', NULL, NULL, NULL, 5, 5, '2026-03-11 03:16:51', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', 0)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e58d3367-12b7-11f1-b32c-00163e23cd45', '代码开发工具', NULL, 'catalog-development', '1.0.0', '开发者工具和辅助软件', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e58f7b43-12b7-11f1-b32c-00163e23cd45', '即时通信', NULL, 'catalog-communication', '1.0.0', '即时通讯和消息工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5919c41-12b7-11f1-b32c-00163e23cd45', '大模型生成', NULL, 'catalog-generate', '1.0.0', 'AI 生成和模型工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e593baaf-12b7-11f1-b32c-00163e23cd45', '多媒体处理', NULL, 'catalog-multimedia', '1.0.0', '音视频和图像处理工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e595f060-12b7-11f1-b32c-00163e23cd45', '办公效率工具', NULL, 'catalog-office', '1.0.0', '办公和生产力工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5982e08-12b7-11f1-b32c-00163e23cd45', '系统安全管理', NULL, 'catalog-system', '1.0.0', '系统安全和密码管理工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e59a5a44-12b7-11f1-b32c-00163e23cd45', '物联网智能外设', NULL, 'catalog-peripheral', '1.0.0', 'IoT 设备和智能家居控制', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e59c7d0c-12b7-11f1-b32c-00163e23cd45', '网络社交媒体', NULL, 'catalog-media', '1.0.0', '社交媒体和博客工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e59e9fde-12b7-11f1-b32c-00163e23cd45', '实用工具', NULL, 'catalog-practical', '1.0.0', '日常实用小工具', 'builtin', NULL, NULL, NULL, NULL, NULL, NULL, '2026-02-26 02:07:26', 0, 'enabled', 'catalog', NULL, NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5a0fa40-12b7-11f1-b32c-00163e23cd45', 'GitHub', NULL, 'github', '1.0.0', 'GitHub CLI 操作：Issue、PR、CI、代码审查', 'openclaw', NULL, NULL, NULL, NULL, 95, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5a31d31-12b7-11f1-b32c-00163e23cd45', 'GitHub Issues', NULL, 'gh-issues', '1.0.0', 'GitHub Issue 管理工具', 'openclaw', NULL, NULL, NULL, NULL, 90, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5a55c5d-12b7-11f1-b32c-00163e23cd45', 'Coding Agent', NULL, 'coding-agent', '1.0.0', '代码生成代理：Codex、Claude Code 等', 'openclaw', NULL, NULL, NULL, NULL, 92, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5a795d3-12b7-11f1-b32c-00163e23cd45', 'Tmux', NULL, 'tmux', '1.0.0', '终端会话管理工具', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5a9be84-12b7-11f1-b32c-00163e23cd45', 'Skill Creator', NULL, 'skill-creator', '1.0.0', 'Skill 创建和打包工具', 'openclaw', NULL, NULL, NULL, NULL, 88, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5abeaac-12b7-11f1-b32c-00163e23cd45', 'Model Usage', NULL, 'model-usage', '1.0.0', 'AI 模型使用统计工具', 'openclaw', NULL, NULL, NULL, NULL, 80, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ae1543-12b7-11f1-b32c-00163e23cd45', 'Canvas', NULL, 'canvas', '1.0.0', '代码画布协作工具', 'openclaw', NULL, NULL, NULL, NULL, 82, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5b038ee-12b7-11f1-b32c-00163e23cd45', 'Self Improving Agent', NULL, 'self-improving-agent', '1.0.11', '自我改进代理：记录学习和错误', 'openclaw', NULL, NULL, NULL, NULL, 87, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58d3367-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5b266c0-12b7-11f1-b32c-00163e23cd45', 'Discord', NULL, 'discord', '1.0.0', 'Discord 消息和频道管理', 'openclaw', NULL, NULL, NULL, NULL, 90, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5b489d4-12b7-11f1-b32c-00163e23cd45', 'Slack', NULL, 'slack', '1.0.0', 'Slack 工作区消息管理', 'openclaw', NULL, NULL, NULL, NULL, 92, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5b6ab36-12b7-11f1-b32c-00163e23cd45', 'iMessage', NULL, 'imsg', '1.0.0', '苹果 iMessage/SMS 消息工具', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5b8e13e-12b7-11f1-b32c-00163e23cd45', 'WhatsApp CLI', NULL, 'wacli', '1.0.0', 'WhatsApp 命令行工具', 'openclaw', NULL, NULL, NULL, NULL, 83, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5bb0187-12b7-11f1-b32c-00163e23cd45', 'BlueBubbles', NULL, 'bluebubbles', '1.0.0', 'iMessage 跨平台客户端', 'openclaw', NULL, NULL, NULL, NULL, 80, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5bd1ab3-12b7-11f1-b32c-00163e23cd45', '语音通话', NULL, 'voice-call', '1.0.0', '语音通话管理工具', 'openclaw', NULL, NULL, NULL, NULL, 78, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5bf3652-12b7-11f1-b32c-00163e23cd45', 'Himalaya', NULL, 'himalaya', '1.0.0', '命令行邮件客户端', 'openclaw', NULL, NULL, NULL, NULL, 82, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e58f7b43-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5c15876-12b7-11f1-b32c-00163e23cd45', 'Gemini', NULL, 'gemini', '1.0.0', 'Google Gemini AI 模型接口', 'openclaw', NULL, NULL, NULL, NULL, 93, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e5919c41-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5c397d0-12b7-11f1-b32c-00163e23cd45', 'OpenAI 图像生成', NULL, 'openai-image-gen', '1.0.0', 'OpenAI DALL-E 图像批量生成', 'openclaw', NULL, NULL, NULL, NULL, 91, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e5919c41-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5c5bd42-12b7-11f1-b32c-00163e23cd45', 'Nano Banana Pro', NULL, 'nano-banana-pro', '1.0.0', '专业图像生成工具', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e5919c41-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5c7de7d-12b7-11f1-b32c-00163e23cd45', 'Nano PDF', NULL, 'nano-pdf', '1.0.0', '自然语言 PDF 编辑工具', 'openclaw', NULL, NULL, NULL, NULL, 84, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e5919c41-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ca0059-12b7-11f1-b32c-00163e23cd45', 'Summarize', NULL, 'summarize', '1.0.0', '文本摘要生成工具', 'openclaw', NULL, NULL, NULL, NULL, 86, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e5919c41-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5cc25dc-12b7-11f1-b32c-00163e23cd45', 'OpenAI Whisper', NULL, 'openai-whisper', '1.0.0', '本地语音转文字工具', 'openclaw', NULL, NULL, NULL, NULL, 92, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ce46cd-12b7-11f1-b32c-00163e23cd45', 'OpenAI Whisper API', NULL, 'openai-whisper-api', '1.0.0', 'Whisper API 语音转文字', 'openclaw', NULL, NULL, NULL, NULL, 90, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5d06e33-12b7-11f1-b32c-00163e23cd45', 'Songsee', NULL, 'songsee', '1.0.0', '音频可视化：频谱图生成', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5d29c91-12b7-11f1-b32c-00163e23cd45', 'Spotify Player', NULL, 'spotify-player', '1.0.0', '终端 Spotify 播放器', 'openclaw', NULL, NULL, NULL, NULL, 88, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5d4d3bb-12b7-11f1-b32c-00163e23cd45', '视频帧提取', NULL, 'video-frames', '1.0.0', '视频帧提取工具', 'openclaw', NULL, NULL, NULL, NULL, 82, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5d6f393-12b7-11f1-b32c-00163e23cd45', 'Sherpa ONNX TTS', NULL, 'sherpa-onnx-tts', '1.0.0', '本地文本转语音', 'openclaw', NULL, NULL, NULL, NULL, 84, 4, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5d917d9-12b7-11f1-b32c-00163e23cd45', '相机快照', NULL, 'camsnap', '1.0.0', '摄像头拍照工具', 'openclaw', NULL, NULL, NULL, NULL, 80, 3, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e593baaf-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5db3995-12b7-11f1-b32c-00163e23cd45', 'Notion', NULL, 'notion', '1.0.0', 'Notion 页面和数据库管理', 'openclaw', NULL, NULL, NULL, NULL, 94, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5dd5d7a-12b7-11f1-b32c-00163e23cd45', 'Obsidian', NULL, 'obsidian', '1.0.0', 'Obsidian 笔记管理', 'openclaw', NULL, NULL, NULL, NULL, 91, 5, '2026-02-26 02:07:26', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5df8042-12b7-11f1-b32c-00163e23cd45', 'Apple Notes', NULL, 'apple-notes', '1.0.0', '苹果备忘录管理', 'openclaw', NULL, NULL, NULL, NULL, 87, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5e1a31e-12b7-11f1-b32c-00163e23cd45', 'Bear Notes', NULL, 'bear-notes', '1.0.0', 'Bear 笔记应用', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5e3d113-12b7-11f1-b32c-00163e23cd45', 'Things Mac', NULL, 'things-mac', '1.0.0', 'Things 任务管理', 'openclaw', NULL, NULL, NULL, NULL, 88, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5e5f229-12b7-11f1-b32c-00163e23cd45', 'Apple Reminders', NULL, 'apple-reminders', '1.0.0', '苹果提醒事项', 'openclaw', NULL, NULL, NULL, NULL, 86, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5e81fc8-12b7-11f1-b32c-00163e23cd45', 'Trello', NULL, 'trello', '1.0.0', 'Trello 看板管理', 'openclaw', NULL, NULL, NULL, NULL, 84, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ea4cde-12b7-11f1-b32c-00163e23cd45', '1Password', NULL, '1password', '1.0.0', '密码管理器 CLI', 'openclaw', NULL, NULL, NULL, NULL, 93, 5, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e5982e08-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ec7097-12b7-11f1-b32c-00163e23cd45', 'Health Check', NULL, 'healthcheck', '1.0.0', '系统健康检查', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e5982e08-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5ee93de-12b7-11f1-b32c-00163e23cd45', 'Oracle', NULL, 'oracle', '1.0.0', 'Oracle 数据库工具', 'openclaw', NULL, NULL, NULL, NULL, 82, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e5982e08-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5f0c138-12b7-11f1-b32c-00163e23cd45', 'Session Logs', NULL, 'session-logs', '1.0.0', '会话日志管理', 'openclaw', NULL, NULL, NULL, NULL, 80, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e5982e08-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5f3004a-12b7-11f1-b32c-00163e23cd45', 'OpenHue', NULL, 'openhue', '1.0.0', 'Philips Hue 灯光控制', 'openclaw', NULL, NULL, NULL, NULL, 89, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59a5a44-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5f53f03-12b7-11f1-b32c-00163e23cd45', 'Sonos CLI', NULL, 'sonoscli', '1.0.0', 'Sonos 音响控制', 'openclaw', NULL, NULL, NULL, NULL, 87, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59a5a44-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5f775f2-12b7-11f1-b32c-00163e23cd45', 'EightCtl', NULL, 'eightctl', '1.0.0', '智能家居控制', 'openclaw', NULL, NULL, NULL, NULL, 83, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59a5a44-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5f9a28a-12b7-11f1-b32c-00163e23cd45', 'Blog Watcher', NULL, 'blogwatcher', '1.0.0', '博客监控工具', 'openclaw', NULL, NULL, NULL, NULL, 81, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59c7d0c-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5fbd959-12b7-11f1-b32c-00163e23cd45', 'GOG', NULL, 'gog', '1.0.0', 'GOG 游戏平台', 'openclaw', NULL, NULL, NULL, NULL, 78, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59c7d0c-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e5fe1006-12b7-11f1-b32c-00163e23cd45', '天气', NULL, 'weather', '1.0.0', '天气预报查询', 'openclaw', NULL, NULL, NULL, NULL, 90, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e6003d31-12b7-11f1-b32c-00163e23cd45', 'GIF Grep', NULL, 'gifgrep', '1.0.0', 'GIF 搜索工具', 'openclaw', NULL, NULL, NULL, NULL, 79, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e6026018-12b7-11f1-b32c-00163e23cd45', 'BluCLI', NULL, 'blucli', '1.0.0', '蓝牙设备管理', 'openclaw', NULL, NULL, NULL, NULL, 81, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e604bc2b-12b7-11f1-b32c-00163e23cd45', 'GoPlaces', NULL, 'goplaces', '1.0.0', '地点搜索工具', 'openclaw', NULL, NULL, NULL, NULL, 82, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e606f359-12b7-11f1-b32c-00163e23cd45', 'Peekaboo', NULL, 'peekaboo', '1.0.0', '窗口管理工具', 'openclaw', NULL, NULL, NULL, NULL, 80, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e6091e8f-12b7-11f1-b32c-00163e23cd45', '食品订购', NULL, 'food-order', '1.0.0', '食品订购助手', 'openclaw', NULL, NULL, NULL, NULL, 77, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e60b4b98-12b7-11f1-b32c-00163e23cd45', 'Order CLI', NULL, 'ordercli', '1.0.0', '订单管理 CLI', 'openclaw', NULL, NULL, NULL, NULL, 76, 3, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e60d7821-12b7-11f1-b32c-00163e23cd45', 'ClawHub', NULL, 'clawhub', '1.0.0', 'Skill 仓库管理', 'openclaw', NULL, NULL, NULL, NULL, 88, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('e60f9b01-12b7-11f1-b32c-00163e23cd45', 'McPorter', NULL, 'mcporter', '1.0.0', 'MCP 协议适配器', 'openclaw', NULL, NULL, NULL, NULL, 85, 4, '2026-02-26 02:07:27', 0, 'enabled', 'skill', 'e59e9fde-12b7-11f1-b32c-00163e23cd45', NULL)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('6ded37fa-2bb0-47b0-8919-b51d66725439', 'agent-browser', NULL, 'agent-browser', '1.0.0', 'agent-broswer', 'upload', 'cradle', NULL, NULL, NULL, 10, 5, '2026-03-20 06:21:57', 0, 'enabled', 'skill', 'e595f060-12b7-11f1-b32c-00163e23cd45', 0)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('3fd3eb7c-d6b2-4886-996f-2ec99a4a8e90', 'browser', NULL, 'browser', '1.0.0', NULL, 'upload', 'cradle', NULL, NULL, NULL, NULL, NULL, '2026-03-24 09:46:32', 0, 'enabled', 'skill', 'e59c7d0c-12b7-11f1-b32c-00163e23cd45', 0)
    `);
    await db.run(`
      INSERT INTO t_skills (sid, name, title, slug, version, description, source_type, source_url, metadata, config_schema, default_config, score, star, create_time, deleted, status, type, parent_id, sort) 
      VALUES ('da0995a9-32a1-4be9-b549-c0a977582096', 'douyin', NULL, 'douyin', '1.0.0', NULL, 'upload', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-26 03:14:15', 0, 'enabled', 'skill', 'e59c7d0c-12b7-11f1-b32c-00163e23cd45', 0)
    `);

  // t_users (1 rows)
    await db.run(`
      INSERT INTO t_users (sid, name, description, create_time, deleted, status, username, password, avatar, home_path, last_login_time, last_login_ip, employee_id) 
      VALUES ('67df68a8-999d-4ac4-9053-d26560d94fbc', 'Administrator', NULL, '2026-02-14 09:24:05', 0, 'enabled', 'admin', '$2a$10$lI7Yz4CZxZ/TsmzmcjBdE.a/Zr4azraO2ETLNdUT9wtqMYJ2CRb1u', NULL, NULL, '2026-04-01 02:38:25', '127.0.0.1', 'ab4b14f5-c78b-4a9c-8165-0dd580ddd40f')
    `);

  // t_relationship (2 rows)
    await db.run(`
      INSERT INTO t_relationship (sid, agent_id, contact_id, contact_agent, agent_contact, short_term_memory, binding_mode, create_time, update_time, deleted) 
      VALUES ('97abca9e-196e-4cc9-bcba-926f2e03b0b7', '4cf26da3-5878-4f8f-8f30-efdff2ad2de1', 'c4fde63c-a59e-451b-b100-588bd9eb8b0e', '{"intimacy":50,"trust":50}', '{"owner":true}', NULL, NULL, '2026-04-01 03:59:10', '2026-04-01 03:59:10', 0)
    `);
    await db.run(`
      INSERT INTO t_relationship (sid, agent_id, contact_id, contact_agent, agent_contact, short_term_memory, binding_mode, create_time, update_time, deleted) 
      VALUES ('4bacde6b-0013-43e8-9f4f-06c806fb12b1', '4cf26da3-5878-4f8f-8f30-efdff2ad2de1', 'contact_1775016081848_70fv5vm', '{"intimacy":50,"trust":50}', '{"intimacy":50,"trust":50}', '{"entries":[{"id":"a9a1cf16-f6b5-4a9f-a88c-b68411f492e7","timestamp":1775016081939,"channel":"cradle","role":"user","content":"Hi","type":"text"},{"id":"9883f0d0-73db-4e66-8ccf-42db3746a5d7","timestamp":1775016242811,"channel":"cradle","role":"agent","content":"让我尝试使用 `chrome-mcp` profile（它使用 existing-session 驱动）：","type":"text"},{"id":"837c2210-b64d-49e4-aec2-bf1b455ba85e","timestamp":1775016808975,"channel":"cradle","role":"user","content":"HI","type":"text"},{"id":"7fc9978a-8b9c-4a9a-aa36-d419c2b06030","timestamp":1775016808979,"channel":"cradle","role":"agent","content":"⚠️ **系统配置提示**\n\n当前没有可用的 LLM 实例，无法处理您的请求。\n\n**解决方法：**\n1. 进入「大模型管理」→「实例管理」\n2. 添加一个新的 LLM 实例（如 DashScope、OpenAI 等）\n3. 填写相应的 API Key 并启用实例\n\n配置完成后即可正常使用对话功能。","type":"text"}]}', NULL, '2026-04-01 04:01:21', '2026-04-01 04:13:28', 0)
    `);

  console.log("[Seed] Exported data imported successfully");
}
