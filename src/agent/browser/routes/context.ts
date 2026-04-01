/**
 * 浏览器自动化模块 - HTTP 路由上下文
 */

import type { BrowserServerState } from "../types.js";
import { ProfileManager } from "../profiles/manager.js";

export interface BrowserRouteContext {
  getState: () => BrowserServerState;
  profileManager: ProfileManager;
  refreshConfigFromDisk?: boolean;
}

export function createBrowserRouteContext(options: {
  getState: () => BrowserServerState;
  refreshConfigFromDisk?: boolean;
}): BrowserRouteContext {
  const { getState, refreshConfigFromDisk } = options;
  
  return {
    getState,
    profileManager: new ProfileManager(getState()),
    refreshConfigFromDisk,
  };
}
