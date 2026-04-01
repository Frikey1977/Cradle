/**
 * 岗位管理类型定义
 */

export interface PositionProfile {
  name: string;
  responsibilities?: string[];
  requirements?: string[];
}

export interface PositionSkill {
  skillId: string;
  skillName?: string;
  skillSlug?: string;
  config?: Record<string, any>;
  invocation?: "auto" | "user_only" | "disabled";
  priority?: number;
}

export interface Position {
  id: string;
  name: string;
  eName?: string;
  title?: string;
  code: string;
  type?: string;
  oid: string;
  description?: string;
  level?: string;
  dataScope: "all" | "org" | "departments" | "group" | "self";
  status: string;
  createTime?: string;
  orgName?: string;
  orgTitle?: string;
  organization?: {
    name: string;
    title?: string;
  };
  skills?: PositionSkill[];
}

export interface CreatePositionDto {
  name: string;
  eName?: string;
  title?: string;
  code: string;
  type?: string;
  oid: string;
  description?: string;
  level?: string;
  dataScope?: "all" | "org" | "departments" | "group" | "self";
  status?: string;
  skills?: PositionSkill[];
}

export interface UpdatePositionDto {
  name?: string;
  eName?: string;
  title?: string;
  code?: string;
  type?: string;
  oid?: string;
  description?: string;
  level?: string;
  dataScope?: "all" | "org" | "departments" | "group" | "self";
  status?: string;
  skills?: PositionSkill[];
}

export interface PositionQuery {
  oid?: string;
  keyword?: string;
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}

export interface PositionListResult {
  items: Position[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PositionCodeExistsQuery {
  code: string;
  id?: string;
}
