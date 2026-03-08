-- 岗位表字段重命名和新增字段迁移脚本
-- 版本: v1.2
-- 日期: 2026-02-18
-- 说明: 
--   1. 新增 e_name 字段用于保存英文名称
--   2. 将 org_id 字段重命名为 oid，遵循设计规范
--   3. 更新状态值从 active/inactive 改为 enabled/disabled

USE cradle;

-- 1. 新增 e_name 字段
ALTER TABLE t_positions ADD COLUMN e_name VARCHAR(200) COMMENT '岗位英文名称（用于自动创建多语言翻译）' AFTER name;

-- 2. 重命名 org_id 为 oid
ALTER TABLE t_positions CHANGE COLUMN org_id oid VARCHAR(36) NOT NULL COMMENT '所属组织ID';

-- 3. 更新索引名称
ALTER TABLE t_positions DROP INDEX idx_position_org;
ALTER TABLE t_positions ADD INDEX idx_position_oid (oid);

-- 4. 更新外键约束
ALTER TABLE t_positions DROP FOREIGN KEY t_positions_ibfk_1;
ALTER TABLE t_positions ADD CONSTRAINT fk_position_oid FOREIGN KEY (oid) REFERENCES t_departments(sid);

-- 5. 更新状态值
UPDATE t_positions SET status = 'enabled' WHERE status = 'active';
UPDATE t_positions SET status = 'disabled' WHERE status = 'inactive';
UPDATE t_positions SET status = 'enabled' WHERE status = '1';
UPDATE t_positions SET status = 'disabled' WHERE status = '0';

-- 6. 更新状态默认值（需要重建表或使用其他方法）
-- 注意：MySQL 不支持直接修改字段的默认值，需要使用 ALTER TABLE MODIFY
ALTER TABLE t_positions MODIFY COLUMN status VARCHAR(20) DEFAULT 'enabled' COMMENT '状态（代码表: organization.position.status）';

-- 验证迁移结果
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT, 
    COLUMN_COMMENT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'cradle' 
  AND TABLE_NAME = 't_positions'
ORDER BY ORDINAL_POSITION;
