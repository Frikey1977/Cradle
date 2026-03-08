/**
 * Skill 模块类型定义
 * 参考 OpenClaw 的 AgentSkills 标准实现
 */

/**
 * Skill 安装规范
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

/**
 * Skill Metadata（AgentSkills 标准）
 */
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

/**
 * Skill 调用策略
 */
export type SkillInvocationPolicy = {
  userInvocable: boolean;
  disableModelInvocation: boolean;
};

/**
 * 解析后的 Skill Frontmatter
 */
export type ParsedSkillFrontmatter = Record<string, string>;

/**
 * Skill 命令规范
 */
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

/**
 * 加载的 Skill 条目
 */
export type SkillEntry = {
  skill: {
    name: string;
    description: string;
    slug: string;
    content: string;
  };
  frontmatter: ParsedSkillFrontmatter;
  metadata?: SkillMetadata;
  invocation?: SkillInvocationPolicy;
  config?: Record<string, unknown>;
};

/**
 * Skill 执行上下文
 */
export type SkillExecutionContext = {
  agentId: string;
  workspaceDir: string;
  env: Record<string, string>;
  config?: Record<string, unknown>;
};

/**
 * Skill 执行结果
 */
export type SkillExecutionResult = {
  success: boolean;
  output: string;
  error?: string;
  exitCode?: number;
  duration: number;
};

/**
 * Skill 参数定义
 */
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

/**
 * Skill 命令定义（从 Markdown 提取）
 */
export type SkillCommandDef = {
  name: string;
  description: string;
  parameters: SkillParameterDef[];
  command: string;
  workingDir?: string;
  timeout?: number;
};

/**
 * 解析后的 Skill
 */
export type ParsedSkill = {
  name: string;
  description: string;
  slug: string;
  metadata: SkillMetadata;
  content: string;
  commands: SkillCommandDef[];
  invocation: SkillInvocationPolicy;
  /** Skill 所在目录路径（用于解析 {baseDir}） */
  baseDir: string;
  /** When to Use 场景列表 */
  whenToUse?: string[];
};
