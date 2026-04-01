/**
 * 浏览器自动化模块 - Profile 管理器
 */

import type {
  ResolvedBrowserProfile,
  ProfileRuntimeState,
  RunningBrowser,
  BrowserServerState,
  BrowserTab,
} from "../types.js";
import type { BrowserDriver } from "../drivers/index.js";
import { createAndStartDriver } from "../drivers/index.js";

export class ProfileManager {
  private state: BrowserServerState;
  private drivers: Map<string, BrowserDriver> = new Map();

  constructor(state: BrowserServerState) {
    this.state = state;
  }

  async getProfile(profileName?: string): Promise<ProfileRuntimeState> {
    const name = profileName ?? this.state.resolved.defaultProfile;
    let profileState = this.state.profiles.get(name);

    if (!profileState) {
      const profile = this.state.resolved.profiles[name];
      if (!profile) {
        throw new Error(`Profile '${name}' not found`);
      }

      profileState = {
        profile,
        running: null,
        lastTargetId: null,
        pageStates: new Map(),
      };
      this.state.profiles.set(name, profileState);
    }

    return profileState;
  }

  async ensureDriver(profileName?: string): Promise<BrowserDriver> {
    const name = profileName ?? this.state.resolved.defaultProfile;
    
    if (this.drivers.has(name)) {
      const driver = this.drivers.get(name)!;
      if (await driver.isRunning()) {
        return driver;
      }
    }

    const profileState = await this.getProfile(name);
    const driver = await createAndStartDriver(
      profileState.profile,
      this.state.resolved.ssrf
    );
    
    this.drivers.set(name, driver);
    
    return driver;
  }

  async stopDriver(profileName?: string): Promise<void> {
    const name = profileName ?? this.state.resolved.defaultProfile;
    const driver = this.drivers.get(name);
    
    if (driver) {
      await driver.stop();
      this.drivers.delete(name);
    }
  }

  async stopAllDrivers(): Promise<void> {
    for (const [name, driver] of this.drivers) {
      try {
        await driver.stop();
      } catch (error) {
        console.error(`Failed to stop driver for profile '${name}':`, error);
      }
    }
    this.drivers.clear();
  }

  async listTabs(profileName?: string): Promise<BrowserTab[]> {
    const driver = await this.ensureDriver(profileName);
    return await driver.listTabs();
  }

  async openTab(url: string, profileName?: string): Promise<BrowserTab> {
    const driver = await this.ensureDriver(profileName);
    return await driver.openTab(url);
  }

  async focusTab(targetId: string, profileName?: string): Promise<void> {
    const driver = await this.ensureDriver(profileName);
    return await driver.focusTab(targetId);
  }

  async closeTab(targetId: string, profileName?: string): Promise<void> {
    const driver = await this.ensureDriver(profileName);
    return await driver.closeTab(targetId);
  }

  getProfileNames(): string[] {
    return Object.keys(this.state.resolved.profiles);
  }

  hasProfile(name: string): boolean {
    return name in this.state.resolved.profiles;
  }
}
