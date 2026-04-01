/**
 * 浏览器自动化模块 - Browser Control Service
 */

import { createServer, type Server } from "http";
import type { FastifyInstance } from "fastify";
import {
  loadConfig,
  resolveBrowserConfig,
} from "./config.js";
import { createBrowserApp } from "./routes/index.js";
import type {
  BrowserServerState,
  BrowserConfig,
  ResolvedBrowserConfig,
} from "./types.js";
import { ProfileManager } from "./profiles/manager.js";
import { globalConfigManager } from "./element-marker/config-manager.js";

export type { BrowserServerState } from "./types.js";

let state: BrowserServerState | null = null;

export interface StartBrowserControlServerOptions {
  config?: BrowserConfig;
  fullConfig?: { gateway?: { auth?: { token?: string } } };
  port?: number;
  onWarn?: (message: string) => void;
}

export async function startBrowserControlServer(
  options: StartBrowserControlServerOptions = {}
): Promise<BrowserServerState | null> {
  if (state) {
    return state;
  }

  const { config: inputConfig, fullConfig, port: inputPort, onWarn } = options;
  
  const cfg = inputConfig ?? loadConfig();
  const resolved = resolveBrowserConfig(cfg, fullConfig);
  
  if (!resolved.enabled) {
    return null;
  }

  const port = inputPort ?? resolved.controlPort;
  
  state = {
    server: null as any,
    port,
    resolved,
    profiles: new Map(),
    startTime: Date.now(),
  };

  const app = createBrowserApp(state);

  const server = await new Promise<Server>((resolve, reject) => {
    const s = createServer((req, res) => {
      Promise.resolve(app.ready()).then(() => {
        app.server.emit("request", req, res);
      }).catch(reject);
    });
    s.listen(port, "127.0.0.1", () => resolve(s));
    s.once("error", reject);
  }).catch((err) => {
    console.error(`Browser control server failed to bind 127.0.0.1:${port}: ${err}`);
    return null;
  });

  if (!server) {
    state = null;
    return null;
  }

  state.server = server;

  const authMode = resolved.auth.token
    ? "token"
    : resolved.auth.password
    ? "password"
    : "off";

  console.log(`Browser control listening on http://127.0.0.1:${port}/ (auth=${authMode})`);

  // 初始化元素标记配置管理器
  try {
    await globalConfigManager.initialize();
  } catch (error) {
    console.warn(`[BrowserControl] Failed to initialize element marker config manager: ${error}`);
  }

  return state;
}

export async function stopBrowserControlServer(): Promise<void> {
  if (!state) {
    return;
  }

  const profileManager = new ProfileManager(state);
  await profileManager.stopAllDrivers();

  await new Promise<void>((resolve) => {
    state?.server.close(() => resolve());
  });

  state = null;
}

export function getBrowserServerState(): BrowserServerState | null {
  return state;
}

export function getBrowserControlPort(): number | null {
  return state?.port ?? null;
}

export function getBrowserAuthToken(): string | null {
  return state?.resolved.auth.token ?? null;
}

export async function ensureBrowserControlServer(
  options?: StartBrowserControlServerOptions
): Promise<BrowserServerState> {
  if (state) {
    return state;
  }

  const result = await startBrowserControlServer(options);
  
  if (!result) {
    throw new Error("Browser control server failed to start");
  }

  return result;
}
