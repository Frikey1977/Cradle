-- 岗位表增加 level 字段
-- 版本: v1.3
-- 日期: 2026-02-18
-- 说明: 新增 level 字段用于存储岗位级别，使用代码表 organization.position.level 管理

-- 添加 level 字段
ALTER TABLE t_positions ADD COLUMN level VARCHAR(50) COMMENT '岗位级别（代码表: organization.position.level）' AFTER oid;

-- 更新现有数据的 level（根据 profile_json 中的 level 值迁移）
UPDATE t_positions SET level = JSON_UNQUOTE(JSON_EXTRACT(profile_json, '$.level')) WHERE profile_json IS NOT NULL AND JSON_EXTRACT(profile_json, '$.level') IS NOT NULL;

-- 为 level 字段添加索引（可选，如果需要按级别筛选）
CREATE INDEX idx_position_level ON t_positions(level);
