import { join, resolve, isAbsolute } from "path";

export interface WorkspaceConfig {
  workspaceDir?: string;
}

export interface AgentWorkspaceInfo {
  workspaceDir: string;
  agentHomeDir: string;
  userDocumentsDir: string;
}

function getWorkspaceBaseDir(): string {
  let baseDir = process.env.WORKSPACE_DIR || "./workspace";
  if (!isAbsolute(baseDir)) {
    baseDir = resolve(process.cwd(), baseDir);
  }
  return baseDir;
}

export function buildAgentWorkspace(
  agentEName: string,
  contactEName: string,
  config?: WorkspaceConfig
): AgentWorkspaceInfo {
  const workspaceDir = config?.workspaceDir 
    ? (isAbsolute(config.workspaceDir) ? config.workspaceDir : resolve(process.cwd(), config.workspaceDir))
    : getWorkspaceBaseDir();
  
  const agentHomeDir = join(workspaceDir, "agents", agentEName);
  const userDocumentsDir = join(agentHomeDir, contactEName, "documents");

  return {
    workspaceDir,
    agentHomeDir,
    userDocumentsDir,
  };
}

export function resolveWorkspaceDir(dir?: string): string {
  if (!dir) {
    return getWorkspaceBaseDir();
  }
  if (isAbsolute(dir)) {
    return dir;
  }
  return resolve(process.cwd(), dir);
}
