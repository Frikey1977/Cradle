/**
 * 浏览器自动化模块 - 驱动工厂
 */

import type { BrowserDriver, ResolvedBrowserProfile, SSRFPolicy, LocalBrowserProfile } from "../types.js";
import { PlaywrightDriver } from "./playwright-driver.js";
import { RemoteCdpDriver } from "./remote-cdp-driver.js";

export { BaseDriver } from "./base-driver.js";
export { PlaywrightDriver } from "./playwright-driver.js";
export { RemoteCdpDriver } from "./remote-cdp-driver.js";
export type { BrowserDriver } from "../types.js";

const DEFAULT_CDP_PORT = 9222;
const CDP_CONNECTION_TIMEOUT_MS = 3000;

async function testCdpConnection(cdpUrl: string, timeoutMs: number = CDP_CONNECTION_TIMEOUT_MS): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(`${cdpUrl}/json/version`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}

export function createDriver(
  profile: ResolvedBrowserProfile,
  ssrfPolicy: SSRFPolicy
): BrowserDriver {
  switch (profile.driver) {
    case "local-managed":
      return new PlaywrightDriver(profile, ssrfPolicy);
    
    case "existing-session":
      // existing-session 使用 PlaywrightDriver 连接到已打开的 Chrome
      // 通过添加 cdpUrl 来连接到现有浏览器
      return new PlaywrightDriver({
        ...profile,
        driver: "local-managed",
        cdpUrl: `http://127.0.0.1:${DEFAULT_CDP_PORT}`,
      }, ssrfPolicy);
    
    case "remote-cdp":
      return new RemoteCdpDriver(profile, ssrfPolicy);
    
    default:
      throw new Error(`Unknown driver type: ${(profile as any).driver}`);
  }
}

export async function createAndStartDriver(
  profile: ResolvedBrowserProfile,
  ssrfPolicy: SSRFPolicy
): Promise<BrowserDriver> {
  if (profile.driver === "existing-session") {
    const cdpUrl = `http://127.0.0.1:${DEFAULT_CDP_PORT}`;
    const canConnect = await testCdpConnection(cdpUrl);
    
    if (canConnect) {
      console.log(`[createAndStartDriver] Connected to existing browser at ${cdpUrl}`);
      const driver = new PlaywrightDriver({
        ...profile,
        driver: "local-managed",
        cdpUrl,
      }, ssrfPolicy);
      await driver.start();
      return driver;
    }
    
    console.log(`[createAndStartDriver] Cannot connect to ${cdpUrl}, falling back to local-managed mode`);
    const fallbackProfile: ResolvedBrowserProfile & { driver: "local-managed" } = {
      ...profile,
      driver: "local-managed",
      cdpPort: DEFAULT_CDP_PORT,
      headless: false,
    };
    const driver = new PlaywrightDriver(fallbackProfile, ssrfPolicy);
    await driver.start();
    return driver;
  }
  
  const driver = createDriver(profile, ssrfPolicy);
  await driver.start();
  return driver;
}
