/**
 * 系统技能类型定义
 * 对应设计文档: design/system/database/t_skills.md
 */

export interface Skill {
  sid: string;
  name: string;
  title?: string;
  slug: string;
  version: string;
  description?: string;
  sourceType: string;
  sourceUrl?: string;
  metadata?: SkillMetadata;
  configSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  score?: number;
  star?: number;
  type: "catalog" | "skill";
  parentId?: string | null;
  sort?: number;
  createTime?: string;
  deleted?: number;
  status: string;
  children?: Skill[];
}

export interface SkillMetadata {
  openclaw?: {
    emoji?: string;
    requires?: {
      bins?: string[];
      env?: string[];
      config?: string[];
    };
    install?: Array<{
      id: string;
      kind: string;
      formula?: string;
      bins?: string[];
    }>;
    primaryEnv?: string;
  };
}

export interface CreateSkillDto {
  name: string;
  title?: string;
  slug: string;
  version?: string;
  description?: string;
  sourceType?: string;
  sourceUrl?: string;
  metadata?: SkillMetadata;
  configSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  score?: number;
  star?: number;
  type?: "catalog" | "skill";
  parentId?: string | null;
  sort?: number;
  status?: string;
}

export interface UpdateSkillDto {
  name?: string;
  title?: string;
  slug?: string;
  version?: string;
  description?: string;
  sourceType?: string;
  sourceUrl?: string;
  metadata?: SkillMetadata;
  configSchema?: Record<string, unknown>;
  defaultConfig?: Record<string, unknown>;
  score?: number;
  star?: number;
  type?: "catalog" | "skill";
  parentId?: string | null;
  sort?: number;
  status?: string;
}

export interface SkillQuery {
  keyword?: string;
  sourceType?: string;
  status?: string;
  type?: "catalog" | "skill";
  parentId?: string;
  page?: number;
  pageSize?: number;
}

export interface SkillTreeQuery {
  keyword?: string;
  sourceType?: string;
  status?: string;
}

export interface SkillListResult {
  items: Skill[];
  total: number;
}

export interface SlugExistsQuery {
  slug: string;
  excludeSid?: string;
}
