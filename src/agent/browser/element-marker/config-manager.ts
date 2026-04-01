/**
 * 元素标记配置管理器
 *
 * 负责加载、保存和管理站点配置文件
 * 不使用内存缓存，每次直接从文件读取，确保变化即时生效
 */

import { readFile, writeFile, mkdir, access, readdir, unlink } from "fs/promises";
import { join, dirname } from "path";
import type { SiteConfig, PageConfig, MarkedElement } from "./types.js";

/** 配置管理器 */
export class ElementConfigManager {
  private configDir: string;

  constructor(configDir: string = "./config/element-markers") {
    this.configDir = configDir;
  }

  /**
   * 初始化配置目录
   */
  async initialize(): Promise<void> {
    try {
      await mkdir(this.configDir, { recursive: true });
      console.log(`[ElementConfigManager] Config directory ready: ${this.configDir}`);
    } catch (error) {
      console.error("[ElementConfigManager] Failed to initialize:", error);
      throw error;
    }
  }

  /**
   * 获取配置文件路径
   */
  private getConfigPath(domain: string): string {
    // 清理域名作为文件名
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
    return join(this.configDir, `${safeDomain}.json`);
  }

  /**
   * 从文件读取站点配置
   */
  async loadSiteConfig(domain: string): Promise<SiteConfig | null> {
    const configPath = this.getConfigPath(domain);
    try {
      const content = await readFile(configPath, "utf-8");
      return JSON.parse(content) as SiteConfig;
    } catch {
      return null;
    }
  }

  /**
   * 获取站点配置（直接从文件读取）
   */
  async getSiteConfig(domain: string): Promise<SiteConfig | undefined> {
    const config = await this.loadSiteConfig(domain);
    return config || undefined;
  }

  /**
   * 保存站点配置
   */
  async saveSiteConfig(config: SiteConfig): Promise<void> {
    const configPath = this.getConfigPath(config.domain);

    // 确保目录存在
    await mkdir(dirname(configPath), { recursive: true });

    // 更新元数据
    config.updatedAt = new Date().toISOString();
    config.version = (config.version || 0) + 1;

    // 保存到文件
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    console.log(`[ElementConfigManager] Saved config for ${config.domain}`);
  }

  /**
   * 创建新的站点配置
   */
  async createSiteConfig(domain: string, displayName: string, description?: string): Promise<SiteConfig> {
    const now = new Date().toISOString();
    const config: SiteConfig = {
      domain,
      displayName,
      description,
      pages: [],
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await this.saveSiteConfig(config);
    return config;
  }

  /**
   * 获取或创建站点配置
   */
  async getOrCreateSiteConfig(domain: string, displayName?: string): Promise<SiteConfig> {
    const config = await this.loadSiteConfig(domain);
    if (config) {
      return config;
    }
    return await this.createSiteConfig(domain, displayName || domain, "");
  }

  /**
   * 添加或更新页面配置
   */
  async savePageConfig(domain: string, pageConfig: PageConfig): Promise<void> {
    const config = await this.getOrCreateSiteConfig(domain);

    // 查找现有页面配置
    const existingIndex = config.pages.findIndex(p => p.pageType === pageConfig.pageType);

    if (existingIndex >= 0) {
      // 更新现有配置
      config.pages[existingIndex] = pageConfig;
    } else {
      // 添加新配置
      config.pages.push(pageConfig);
    }

    await this.saveSiteConfig(config);
  }

  /**
   * 查找匹配的页面配置
   */
  findPageConfig(config: SiteConfig, url: string): PageConfig | undefined {
    // 按URL模式匹配
    for (const page of config.pages) {
      if (this.matchUrlPattern(url, page.urlPattern)) {
        return page;
      }
    }
    return undefined;
  }

  /**
   * URL模式匹配
   * 支持通配符 * 和 ?，以及正则表达式（以 regex: 开头）
   */
  private matchUrlPattern(url: string, pattern: string): boolean {
    // 检查是否是正则表达式模式
    if (pattern.startsWith("regex:")) {
      const regexStr = pattern.substring(6);
      try {
        const regex = new RegExp(regexStr, "i");
        return regex.test(url);
      } catch {
        console.error(`[ElementConfigManager] Invalid regex pattern: ${regexStr}`);
        return false;
      }
    }
    
    // 将通配符转换为正则表达式
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 转义特殊字符
      .replace(/\*/g, ".*") // * 匹配任意字符
      .replace(/\?/g, "."); // ? 匹配单个字符

    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(url);
  }

  /**
   * 获取URL对应的配置（每次都从文件读取）
   */
  async getConfigForUrl(url: string): Promise<{ config: SiteConfig; page: PageConfig } | null> {
    // 提取域名
    const domain = this.extractDomain(url);
    if (!domain) {
      return null;
    }

    // 直接从文件获取站点配置
    const config = await this.loadSiteConfig(domain);
    if (!config) {
      return null;
    }

    // 查找匹配的页面配置
    const page = this.findPageConfig(config, url);
    if (!page) {
      return null;
    }

    return { config, page };
  }

  /**
   * 提取域名
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return null;
    }
  }

  /**
   * 获取所有站点配置
   */
  async getAllConfigs(): Promise<SiteConfig[]> {
    try {
      const files = await readdir(this.configDir);
      const configs: SiteConfig[] = [];

      for (const file of files) {
        if (file.endsWith(".json")) {
          try {
            const content = await readFile(join(this.configDir, file), "utf-8");
            const config: SiteConfig = JSON.parse(content);
            configs.push(config);
          } catch (error) {
            console.error(`[ElementConfigManager] Failed to load ${file}:`, error);
          }
        }
      }

      return configs;
    } catch {
      return [];
    }
  }

  /**
   * 删除站点配置
   */
  async deleteSiteConfig(domain: string): Promise<boolean> {
    const configPath = this.getConfigPath(domain);

    try {
      await access(configPath);
      await unlink(configPath);
      console.log(`[ElementConfigManager] Deleted config for ${domain}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查URL是否有配置
   */
  async hasConfigForUrl(url: string): Promise<boolean> {
    const result = await this.getConfigForUrl(url);
    return result !== null;
  }

  /**
   * 生成下一个元素引用ID
   */
  generateNextRef(pageConfig: PageConfig): string {
    const maxRef = pageConfig.elements.reduce((max, el) => {
      const num = parseInt(el.ref.replace(/^r/, ""), 10);
      return Math.max(max, num);
    }, 0);
    return `r${maxRef + 1}`;
  }

  /**
   * 添加标记元素到页面配置
   */
  async addMarkedElement(domain: string, pageType: string, element: MarkedElement): Promise<void> {
    const config = await this.getOrCreateSiteConfig(domain);
    let pageConfig = config.pages.find(p => p.pageType === pageType);

    if (!pageConfig) {
      // 创建新的页面配置
      pageConfig = {
        urlPattern: `*://${domain}/*`,
        pageType,
        description: `${pageType} page`,
        elements: [],
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      config.pages.push(pageConfig);
    }

    // 检查是否已存在相同ref的元素
    const existingIndex = pageConfig.elements.findIndex(e => e.ref === element.ref);
    if (existingIndex >= 0) {
      // 更新现有元素
      pageConfig.elements[existingIndex] = element;
    } else {
      // 添加新元素
      pageConfig.elements.push(element);
    }

    // 更新页面配置元数据
    pageConfig.updatedAt = new Date().toISOString();
    pageConfig.version = (pageConfig.version || 0) + 1;

    await this.saveSiteConfig(config);
  }

  /**
   * 更新标记元素
   */
  async updateMarkedElement(domain: string, pageType: string, ref: string, updates: Partial<MarkedElement>): Promise<boolean> {
    const config = await this.loadSiteConfig(domain);
    if (!config) return false;

    const pageConfig = config.pages.find(p => p.pageType === pageType);
    if (!pageConfig) return false;

    const elementIndex = pageConfig.elements.findIndex(e => e.ref === ref);
    if (elementIndex < 0) return false;

    // 更新元素
    pageConfig.elements[elementIndex] = {
      ...pageConfig.elements[elementIndex],
      ...updates,
    };

    // 更新元数据
    pageConfig.updatedAt = new Date().toISOString();
    pageConfig.version = (pageConfig.version || 0) + 1;
    config.updatedAt = new Date().toISOString();
    config.version = (config.version || 0) + 1;

    await this.saveSiteConfig(config);
    return true;
  }

  /**
   * 删除标记元素
   */
  async removeMarkedElement(domain: string, pageType: string, ref: string): Promise<boolean> {
    const config = await this.loadSiteConfig(domain);
    if (!config) return false;

    const pageConfig = config.pages.find(p => p.pageType === pageType);
    if (!pageConfig) return false;

    const elementIndex = pageConfig.elements.findIndex(e => e.ref === ref);
    if (elementIndex < 0) return false;

    // 删除元素
    pageConfig.elements.splice(elementIndex, 1);

    // 更新元数据
    pageConfig.updatedAt = new Date().toISOString();
    pageConfig.version = (pageConfig.version || 0) + 1;
    config.updatedAt = new Date().toISOString();
    config.version = (config.version || 0) + 1;

    await this.saveSiteConfig(config);
    return true;
  }

  /**
   * 获取页面配置
   */
  async getPageConfig(domain: string, pageType: string): Promise<PageConfig | undefined> {
    const config = await this.loadSiteConfig(domain);
    if (!config) return undefined;
    return config.pages.find(p => p.pageType === pageType);
  }
}

/** 全局配置管理器实例 */
export const globalConfigManager = new ElementConfigManager();
