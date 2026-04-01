import { buildAgentWorkspace } from "./workspace.js";
import type { ProfileCollection } from "../types/profile.js";

export interface EnvironmentConfig {
  agentName: string;
  userName: string;
  workspaceDir?: string;
  preferredLanguage?: string;
}

export class Environment {
  private config: EnvironmentConfig;
  private cachedInfo?: EnvironmentInfo;

  private constructor(config: EnvironmentConfig) {
    this.config = config;
  }

  static fromProfiles(profiles: ProfileCollection): Environment {
    return new Environment({
      agentName: profiles.agent?.eName || profiles.agent?.name || "unknown",
      userName: profiles.contact?.eName || profiles.contact?.name || "unknown",
      preferredLanguage: profiles.contact?.preferredLanguage,
    });
  }

  static fromConfig(config: EnvironmentConfig): Environment {
    return new Environment(config);
  }

  getConfig(): EnvironmentConfig {
    return { ...this.config };
  }

  getAgentName(): string {
    return this.config.agentName;
  }

  getUserName(): string {
    return this.config.userName;
  }

  getPreferredLanguage(): string | undefined {
    return this.config.preferredLanguage;
  }

  getInfo(): EnvironmentInfo {
    if (this.cachedInfo) {
      return this.cachedInfo;
    }

    const now = new Date();
    const timeString = now.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "long",
      timeZoneName: "short",
    });

    const workspaceInfo = buildAgentWorkspace(this.config.agentName, this.config.userName, { workspaceDir: this.config.workspaceDir });

    this.cachedInfo = {
      currentTime: timeString,
      osPlatform: process.platform,
      nodeVersion: process.version,
      agentHomeDir: workspaceInfo.agentHomeDir,
      userDocumentsDir: workspaceInfo.userDocumentsDir,
      workspaceDir: workspaceInfo.userDocumentsDir,
      preferredLanguage: this.config.preferredLanguage,
    };

    return this.cachedInfo;
  }

  buildSystemPromptBlock(): string {
    const env = this.getInfo();
    const languageMap: Record<string, string> = {
      "zh-CN": "简体中文",
      "en-US": "English",
      "ja-JP": "日本語",
      "es-ES": "Español",
    };

    const languageSection = env.preferredLanguage
      ? `\n## 用户偏好\n- preferred Language: ${languageMap[env.preferredLanguage] || env.preferredLanguage} (${env.preferredLanguage})`
      : "";

    return `# 环境信息

## 当前时间
${env.currentTime}

## 系统信息
- 操作系统: ${env.osPlatform}
- Node.js版本: ${env.nodeVersion}
${languageSection}

## 工作目录
- Agent Home: ${env.agentHomeDir}
- User Home: ${env.userDocumentsDir}
`;
  }
}

export interface EnvironmentInfo {
  currentTime: string;
  osPlatform: string;
  nodeVersion: string;
  agentHomeDir: string;
  userDocumentsDir: string;
  workspaceDir: string;
  preferredLanguage?: string;
}

export function buildEnvironmentInfo(config: EnvironmentConfig): EnvironmentInfo {
  return Environment.fromConfig(config).getInfo();
}

export function formatEnvironmentBlock(env: EnvironmentInfo): string {
  const languageMap: Record<string, string> = {
    "zh-CN": "简体中文",
    "en-US": "English",
    "ja-JP": "日本語",
    "es-ES": "Español",
  };

  const languageSection = env.preferredLanguage
    ? `\n## 用户偏好\n- preferred Language: ${languageMap[env.preferredLanguage] || env.preferredLanguage} (${env.preferredLanguage})`
    : "";

  return `# 环境信息

## 当前时间
${env.currentTime}

## 系统信息
- 操作系统: ${env.osPlatform}
- Node.js版本: ${env.nodeVersion}
${languageSection}

## 工作目录
- Agent Home: ${env.agentHomeDir}
- User Home: ${env.userDocumentsDir}
`;
}
