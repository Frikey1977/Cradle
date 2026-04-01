/**
 * Skill 模块类型定义
 * 参考 OpenClaw 的 AgentSkills 标准实现
 */

export type SkillInstallSpec = {
  id?: string;
  kind: "brew" | "node" | "go" | "uv" | "download" | "shell";
  label?: string;
  bins?: string[];
  os?: string[];
  formula?: string;
  package?: string;
  module?: string;
  url?: string;
  archive?: string;
  extract?: boolean;
  stripComponents?: number;
  targetDir?: string;
  command?: string;
};

export type SkillMetadata = {
  emoji?: string;
  homepage?: string;
  requires?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
  };
  install?: SkillInstallSpec[];
  primaryEnv?: string;
  always?: boolean;
  skillKey?: string;
  os?: string[];
};

export type SkillInvocationPolicy = {
  userInvocable: boolean;
  disableModelInvocation: boolean;
};

export type ParsedSkillFrontmatter = Record<string, string>;

export type SkillCommandSpec = {
  name: string;
  skillName: string;
  description: string;
  dispatch?: {
    kind: "tool";
    toolName: string;
    argMode?: "raw";
  };
};

export type SkillEntry = {
  name: string;
  description: string;
  location: string;
  filePath: string;
  baseDir: string;
  source: "bundled" | "managed" | "workspace" | "direct";
  frontmatter: ParsedSkillFrontmatter;
  metadata?: SkillMetadata;
  invocation?: SkillInvocationPolicy;
};

export type SkillExecutionContext = {
  agentId: string;
  workspaceDir: string;
  env: Record<string, string>;
  config?: Record<string, unknown>;
};

export type SkillExecutionResult = {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  duration: number;
};

export type SkillParameterDef = {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required: boolean;
  default?: unknown;
  description?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: string[];
  };
};

export type SkillCommandDef = {
  name: string;
  description: string;
  parameters: SkillParameterDef[];
  command: string;
  workingDir?: string;
  timeout?: number;
};

export type ParsedSkill = {
  name: string;
  description: string;
  slug: string;
  metadata: SkillMetadata;
  content: string;
  commands: SkillCommandDef[];
  invocation: SkillInvocationPolicy;
  baseDir: string;
  whenToUse?: string[];
};

export type SkillSnapshot = {
  prompt: string;
  skills: Array<{
    name: string;
    primaryEnv?: string;
  }>;
  skillFilter?: string[];
  resolvedSkills: SkillEntry[];
  version?: number;
};