/**
 * 浏览器自动化模块 - 配置解析
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type {
  BrowserConfig,
  BrowserControlAuth,
  ResolvedBrowserConfig,
  ResolvedBrowserProfile,
  BrowserProfile,
  SSRFPolicy,
} from "./types.js";

const DEFAULT_CONTROL_PORT = 18791;
const DEFAULT_CDP_PORT = 18800;

export function loadConfig(): BrowserConfig {
  const configPath = findConfigPath();
  
  if (!configPath) {
    return createDefaultConfig();
  }
  
  try {
    const content = readFileSync(configPath, "utf-8");
    const raw = JSON.parse(content);
    return parseConfig(raw);
  } catch (error) {
    console.warn(`Failed to load browser config from ${configPath}: ${error}`);
    return createDefaultConfig();
  }
}

function findConfigPath(): string | null {
  const candidates = [
    join(process.cwd(), "browser.json"),
    join(process.cwd(), "config", "browser.json"),
    join(homedir(), ".cradle", "browser.json"),
  ];
  
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  return null;
}

function createDefaultConfig(): BrowserConfig {
  return {
    enabled: true,
    controlPort: DEFAULT_CONTROL_PORT,
    profiles: {
      default: {
        driver: "local-managed",
        cdpPort: DEFAULT_CDP_PORT,
        headless: false,
      },
    },
  };
}

function parseConfig(raw: Record<string, unknown>): BrowserConfig {
  return {
    enabled: raw.enabled as boolean ?? true,
    controlPort: raw.controlPort as number ?? DEFAULT_CONTROL_PORT,
    auth: raw.auth as BrowserControlAuth | undefined,
    ssrf: raw.ssrf as SSRFPolicy | undefined,
    profiles: raw.profiles as Record<string, BrowserProfile> ?? {},
  };
}

export function resolveBrowserConfig(
  config: BrowserConfig,
  fullConfig?: { gateway?: { auth?: { token?: string } } }
): ResolvedBrowserConfig {
  const profiles: Record<string, ResolvedBrowserProfile> = {};
  
  for (const [name, profile] of Object.entries(config.profiles)) {
    profiles[name] = {
      ...profile,
      name,
    };
  }
  
  if (Object.keys(profiles).length === 0) {
    profiles.default = {
      name: "default",
      driver: "local-managed",
      cdpPort: DEFAULT_CDP_PORT,
      headless: false,
    };
  }
  
  const auth = resolveBrowserControlAuth(config, fullConfig);
  
  return {
    enabled: config.enabled,
    controlPort: config.controlPort,
    auth,
    ssrf: resolveSSRFPolicy(config.ssrf),
    profiles,
    defaultProfile: Object.keys(profiles)[0],
  };
}

export function resolveBrowserControlAuth(
  config: BrowserConfig,
  fullConfig?: { gateway?: { auth?: { token?: string } } }
): BrowserControlAuth {
  if (config.auth?.token || config.auth?.password) {
    return config.auth;
  }
  
  if (fullConfig?.gateway?.auth?.token) {
    return { token: fullConfig.gateway.auth.token };
  }
  
  return { token: generateToken() };
}

export function resolveSSRFPolicy(ssrf?: SSRFPolicy): SSRFPolicy {
  return {
    allowPrivateHosts: ssrf?.allowPrivateHosts ?? false,
    allowLocalhost: ssrf?.allowLocalhost ?? true,
    allowList: ssrf?.allowList ?? [],
    denyList: ssrf?.denyList ?? [],
  };
}

export function resolveBrowserProfile(
  config: ResolvedBrowserConfig,
  profileName?: string
): ResolvedBrowserProfile {
  const name = profileName ?? config.defaultProfile;
  const profile = config.profiles[name];
  
  if (!profile) {
    throw new Error(`Browser profile '${name}' not found`);
  }
  
  return profile;
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export function getDefaultUserDataDir(profile: ResolvedBrowserProfile): string {
  const baseDir = join(process.cwd(), "browser-data");
  
  if (profile.driver === "local-managed") {
    return join(baseDir, "profiles", profile.name);
  }
  
  if (profile.driver === "existing-session") {
    return profile.userDataDir ?? join(baseDir, "user-session");
  }
  
  return baseDir;
}

export function getDefaultExecutablePath(): string | null {
  const platform = process.platform;
  
  const candidates: string[] = [];
  
  if (platform === "win32") {
    candidates.push(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    );
  } else if (platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    );
  } else {
    candidates.push(
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/brave-browser",
      "/usr/bin/brave",
      "/usr/bin/microsoft-edge",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    );
  }
  
  for (const path of candidates) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  return null;
}
