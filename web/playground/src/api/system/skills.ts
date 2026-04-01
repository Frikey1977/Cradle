import { requestClient } from "#/api/request";

export namespace SkillApi {
  export const SourceTypes = ["builtin", "local", "openclaw"] as const;
  export const StatusTypes = ["enabled", "disabled", "deprecated"] as const;
  export const NodeTypes = ["catalog", "skill"] as const;

  export interface Skill {
    sid: string;
    name: string;
    title?: string;
    slug: string;
    version: string;
    description?: string;
    sourceType: (typeof SourceTypes)[number];
    sourceUrl?: string;
    metadata?: {
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
    };
    configSchema?: Record<string, unknown>;
    defaultConfig?: Record<string, unknown>;
    score?: number;
    star?: number;
    type: (typeof NodeTypes)[number];
    parentId?: string | null;
    sort?: number;
    createTime?: string;
    deleted?: number;
    status: (typeof StatusTypes)[number];
    children?: Skill[];
  }

  export interface SkillListResult {
    items: Skill[];
    total: number;
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
}

async function getSkillList(params?: SkillApi.SkillQuery) {
  return requestClient.get<SkillApi.SkillListResult>("/system/skills", {
    params,
  });
}

async function getSkillTree(params?: SkillApi.SkillTreeQuery) {
  return requestClient.get<SkillApi.Skill[]>("/system/skills/tree", {
    params,
  });
}

async function getSkillDetail(sid: string) {
  return requestClient.get<SkillApi.Skill>(`/system/skills/${sid}`);
}

async function createSkill(data: Partial<SkillApi.Skill>) {
  return requestClient.post<string>("/system/skills", data);
}

async function updateSkill(sid: string, data: Partial<SkillApi.Skill>) {
  return requestClient.put<void>(`/system/skills/${sid}`, data);
}

async function deleteSkill(sid: string) {
  return requestClient.delete<void>(`/system/skills/${sid}`);
}

async function checkSlugExists(slug: string, excludeSid?: string) {
  return requestClient.get<boolean>("/system/skills/slug-exists", {
    params: { slug, excludeSid },
  });
}

// 文件树节点类型
export interface FileTreeNode {
  title: string;
  key: string;
  isLeaf?: boolean;
  children?: FileTreeNode[];
}

// 获取技能文件树
async function getSkillFileTree(sid: string) {
  return requestClient.get<FileTreeNode[]>(`/system/skills/${sid}/file-tree`);
}

// 获取技能文件内容
async function getSkillFileContent(filePath: string) {
  return requestClient.get<string>("/system/skills/file-content", {
    params: { path: filePath },
  });
}

export const skillApi = {
  getSkillList,
  getSkillTree,
  getSkillDetail,
  createSkill,
  updateSkill,
  deleteSkill,
  checkSlugExists,
  getSkillFileTree,
  getSkillFileContent,
};
