/**
 * 元素标记路由
 * 
 * 提供元素标记相关的HTTP API
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";
import { globalConfigManager } from "../element-marker/config-manager.js";
import { globalSnapshotEnhancer } from "../element-marker/snapshot-enhancer.js";
import { getElementMarkerScript } from "../element-marker/marker-script.js";
import type { MarkedElement, PageConfig, SiteConfig } from "../element-marker/types.js";

export function registerElementMarkerRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  // 配置管理API
  app.get("/marker/configs", handleGetAllConfigs(ctx));
  app.get("/marker/config/:domain", handleGetSiteConfig(ctx));
  app.post("/marker/config", handleCreateSiteConfig(ctx));
  app.put("/marker/config/:domain", handleUpdateSiteConfig(ctx));
  app.delete("/marker/config/:domain", handleDeleteSiteConfig(ctx));
  
  // 页面配置API
  app.get("/marker/config/:domain/pages", handleGetPageConfigs(ctx));
  app.get("/marker/config/:domain/page/:pageType", handleGetPageConfig(ctx));
  app.post("/marker/config/:domain/page", handleSavePageConfig(ctx));
  app.delete("/marker/config/:domain/page/:pageType", handleDeletePageConfig(ctx));
  
  // 元素标记API
  app.post("/marker/element", handleAddMarkedElement(ctx));
  app.delete("/marker/element/:domain/:pageType/:ref", handleRemoveMarkedElement(ctx));
  
  // 标记器控制API
  app.post("/marker/start", handleStartMarking(ctx));
  app.post("/marker/stop", handleStopMarking(ctx));
  app.get("/marker/script", handleGetMarkerScript(ctx));
  
  // 快照增强API
  app.get("/marker/snapshot", handleGetEnhancedSnapshot(ctx));
  app.post("/marker/batch-action", handleExecuteBatchAction(ctx));
  app.post("/marker/action-group/:groupId", handleExecuteActionGroup(ctx));
}

// 辅助函数：获取profile名称
function getProfileName(req: FastifyRequest, ctx: BrowserRouteContext): string | undefined {
  return (req.query as { profile?: string }).profile ?? ctx.getState().resolved.defaultProfile;
}

// 获取所有站点配置
function handleGetAllConfigs(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const configs = await globalConfigManager.getAllConfigs();
      return reply.send({
        success: true,
        configs: configs.map(c => ({
          domain: c.domain,
          displayName: c.displayName,
          description: c.description,
          pageCount: c.pages.length,
          updatedAt: c.updatedAt,
          version: c.version,
        })),
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 获取站点配置
function handleGetSiteConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain } = req.params;
      const config = await globalConfigManager.getSiteConfig(domain);
      
      if (!config) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      return reply.send({ success: true, config });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 创建站点配置
function handleCreateSiteConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Body: { domain: string; displayName: string; description?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain, displayName, description } = req.body;
      
      if (!domain || !displayName) {
        return reply.code(400).send({ error: "Missing required fields: domain, displayName" });
      }
      
      const config = await globalConfigManager.createSiteConfig(domain, displayName, description);
      
      return reply.send({ success: true, config });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 更新站点配置
function handleUpdateSiteConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Params: { domain: string };
      Body: Partial<SiteConfig>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain } = req.params;
      const existingConfig = await globalConfigManager.getSiteConfig(domain);
      
      if (!existingConfig) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      const updatedConfig: SiteConfig = {
        ...existingConfig,
        ...req.body,
        domain, // 不允许修改domain
        updatedAt: new Date().toISOString(),
        version: (existingConfig.version || 0) + 1,
      };
      
      await globalConfigManager.saveSiteConfig(updatedConfig);
      
      return reply.send({ success: true, config: updatedConfig });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 删除站点配置
function handleDeleteSiteConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain } = req.params;
      const success = await globalConfigManager.deleteSiteConfig(domain);
      
      if (!success) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 获取页面配置列表
function handleGetPageConfigs(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain } = req.params;
      const config = await globalConfigManager.getSiteConfig(domain);
      
      if (!config) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      return reply.send({
        success: true,
        pages: config.pages.map(p => ({
          pageType: p.pageType,
          urlPattern: p.urlPattern,
          description: p.description,
          elementCount: p.elements.length,
          updatedAt: p.updatedAt,
        })),
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 获取单个页面配置
function handleGetPageConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string; pageType: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain, pageType } = req.params;
      const config = await globalConfigManager.getSiteConfig(domain);
      
      if (!config) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      const pageConfig = config.pages.find(p => p.pageType === pageType);
      
      if (!pageConfig) {
        return reply.code(404).send({ error: `Page config '${pageType}' not found` });
      }
      
      return reply.send({ success: true, page: pageConfig });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 保存页面配置
function handleSavePageConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Params: { domain: string };
      Body: PageConfig;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain } = req.params;
      const pageConfig = req.body;
      
      if (!pageConfig.pageType) {
        return reply.code(400).send({ error: "Missing required field: pageType" });
      }
      
      // 更新元数据
      pageConfig.updatedAt = new Date().toISOString();
      pageConfig.version = (pageConfig.version || 0) + 1;
      
      await globalConfigManager.savePageConfig(domain, pageConfig);
      
      return reply.send({ success: true, page: pageConfig });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 删除页面配置
function handleDeletePageConfig(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string; pageType: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain, pageType } = req.params;
      const config = await globalConfigManager.getSiteConfig(domain);
      
      if (!config) {
        return reply.code(404).send({ error: `Config for domain '${domain}' not found` });
      }
      
      const initialLength = config.pages.length;
      config.pages = config.pages.filter(p => p.pageType !== pageType);
      
      if (config.pages.length === initialLength) {
        return reply.code(404).send({ error: `Page config '${pageType}' not found` });
      }
      
      await globalConfigManager.saveSiteConfig(config);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 添加标记元素
function handleAddMarkedElement(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Body: { 
        domain: string; 
        pageType: string; 
        element: MarkedElement;
        url?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain, pageType, element, url } = req.body;
      
      if (!domain || !pageType || !element) {
        return reply.code(400).send({ error: "Missing required fields" });
      }
      
      // 如果没有指定ref，自动生成
      if (!element.ref) {
        const config = await globalConfigManager.getOrCreateSiteConfig(domain);
        const pageConfig = config.pages.find(p => p.pageType === pageType);
        const tempPageConfig: PageConfig = pageConfig || {
          urlPattern: `*://${domain}/*`,
          pageType,
          description: `${pageType} page`,
          elements: [],
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        element.ref = globalConfigManager.generateNextRef(tempPageConfig);
      }
      
      await globalConfigManager.addMarkedElement(domain, pageType, element);
      
      return reply.send({ success: true, element });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 删除标记元素
function handleRemoveMarkedElement(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { domain: string; pageType: string; ref: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { domain, pageType, ref } = req.params;
      
      const success = await globalConfigManager.removeMarkedElement(domain, pageType, ref);
      
      if (!success) {
        return reply.code(404).send({ error: "Element not found" });
      }
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 启动标记器
function handleStartMarking(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { profile?: string };
      Body: { domain?: string; pageType?: string; url?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);

      // 使用 ensureActivePage 获取真实的活动页面（通过 CDP 检测）
      const page = await driver.ensureActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const url = req.body?.url || page.url();
      const domain = req.body?.domain || new URL(url).hostname;

      // 获取现有配置
      const config = await globalConfigManager.getOrCreateSiteConfig(domain);

      // 自动检测页面类型：先尝试根据URL匹配，否则使用请求中的pageType或default
      let pageType = req.body?.pageType;
      let pageConfig = pageType ? config.pages.find(p => p.pageType === pageType) : undefined;

      if (!pageConfig) {
        // 尝试根据URL自动匹配页面配置
        pageConfig = globalConfigManager.findPageConfig(config, url);
        if (pageConfig) {
          pageType = pageConfig.pageType;
          console.log(`[ElementMarker] Auto-matched page type: ${pageType} for URL: ${url}`);
        }
      }

      // 如果还是没有匹配到，使用默认值
      if (!pageType) {
        pageType = "default";
        pageConfig = config.pages.find(p => p.pageType === pageType);
      }

      // 注入标记器脚本（直接在当前页面执行）
      const markerScript = getElementMarkerScript();
      await page.evaluate((script) => {
        // 如果脚本已经存在，先销毁旧的
        if ((window as any).__cradle_element_marker) {
          (window as any).__cradle_element_marker.destroy();
        }

        // 执行脚本
        eval(script);

        // 初始化标记器
        if ((window as any).__cradle_element_marker) {
          (window as any).__cradle_element_marker.init();
        }
      }, markerScript);

      // 如果有现有配置，加载已标记的元素
      if (pageConfig?.elements?.length) {
        await page.evaluate((elements) => {
          if ((window as any).__cradle_element_marker) {
            (window as any).__cradle_element_marker.loadElements(elements);
            (window as any).__cradle_element_marker.highlightAll();
          }
        }, pageConfig.elements);
      }

      // 暴露回调函数 - 实时保存标记的元素
      await page.exposeFunction("__cradle_marker_callback", async (data: { action: string; element: MarkedElement }) => {
        console.log("[ElementMarker] Callback received:", data);

        // 获取当前配置
        const currentConfig = await globalConfigManager.getOrCreateSiteConfig(domain);
        let currentPageConfig = currentConfig.pages.find(p => p.pageType === pageType);

        if (!currentPageConfig) {
          currentPageConfig = {
            pageType,
            description: '',
            urlPattern: url,
            elements: [],
            actionGroups: [],
            updatedAt: new Date().toISOString(),
            version: 1,
          };
          currentConfig.pages.push(currentPageConfig);
        }

        if (data.action === 'elementMarked') {
          // 检查是否已存在相同选择器的元素
          const existingIndex = currentPageConfig.elements.findIndex(
            e => e.selector === data.element.selector
          );

          if (existingIndex >= 0) {
            // 更新现有元素
            currentPageConfig.elements[existingIndex] = data.element;
          } else {
            // 添加新元素
            currentPageConfig.elements.push(data.element);
          }

          // 更新页面配置时间
          currentPageConfig.updatedAt = new Date().toISOString();

          // 保存配置
          await globalConfigManager.saveSiteConfig(currentConfig);
          console.log(`[ElementMarker] Element saved: ${data.element.ref} - ${data.element.description}`);
        } else if (data.action === 'elementUpdated') {
          // 更新已有元素
          const existingIndex = currentPageConfig.elements.findIndex(
            e => e.ref === data.element.ref
          );

          if (existingIndex >= 0) {
            currentPageConfig.elements[existingIndex] = data.element;
            currentPageConfig.updatedAt = new Date().toISOString();
            await globalConfigManager.saveSiteConfig(currentConfig);
            console.log(`[ElementMarker] Element updated: ${data.element.ref} - ${data.element.description}`);
          }
        } else if (data.action === 'elementDeleted') {
          // 删除元素
          const initialLength = currentPageConfig.elements.length;
          currentPageConfig.elements = currentPageConfig.elements.filter(
            e => e.ref !== data.element.ref
          );

          if (currentPageConfig.elements.length < initialLength) {
            currentPageConfig.updatedAt = new Date().toISOString();
            await globalConfigManager.saveSiteConfig(currentConfig);
            console.log(`[ElementMarker] Element deleted: ${data.element.ref}`);
          }
        }
      });

      return reply.send({
        success: true,
        message: "Element marker started. Hold Right Alt and click elements to mark them.",
        domain,
        pageType,
        existingElements: pageConfig?.elements?.length || 0,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 停止标记器
function handleStopMarking(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = await driver.ensureActivePage();
      
      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }
      
      // 获取已标记的元素
      const markedElements = await page.evaluate(() => {
        if ((window as any).__cradle_element_marker) {
          return (window as any).__cradle_element_marker.getElements();
        }
        return [];
      });
      
      // 销毁标记器
      await page.evaluate(() => {
        if ((window as any).__cradle_element_marker) {
          (window as any).__cradle_element_marker.destroy();
        }
      });
      
      return reply.send({
        success: true,
        markedElements,
        elementCount: markedElements.length,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 获取标记器脚本
function handleGetMarkerScript(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const script = getElementMarkerScript();
      return reply.type("application/javascript").send(script);
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 获取增强快照
function handleGetEnhancedSnapshot(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Querystring: { 
        profile?: string;
        url?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      
      // 使用 ensureActivePage 获取真实的活动页面（通过 CDP 检测）
      const page = await driver.ensureActivePage();
      
      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }
      
      const url = req.query.url || page.url();
      
      // 获取增强快照
      const result = await globalSnapshotEnhancer.getEnhancedSnapshot(page, url);
      
      return reply.send({
        success: true,
        url,
        hasConfig: result.config !== null,
        elementCount: result.markedElements.length,
        actionGroupCount: result.actionGroups.length,
        snapshot: result.originalSnapshot,
        elements: result.markedElements,
        actionGroups: result.actionGroups,
        pageData: result.pageData,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 执行批处理操作
function handleExecuteBatchAction(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Querystring: { profile?: string };
      Body: { 
        actions: { ref: string; type: string; value?: string }[];
        delayMs?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = await driver.ensureActivePage();
      
      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }
      
      const { actions, delayMs = 1000 } = req.body;
      
      if (!actions || !Array.isArray(actions)) {
        return reply.code(400).send({ error: "Missing or invalid actions parameter" });
      }
      
      // 先注入标记（确保 data-cradle-ref 属性存在）
      const url = page.url();
      await globalSnapshotEnhancer.injectMarkers(page, url);
      
      const result = await globalSnapshotEnhancer.executeBatchActions(page, actions, delayMs);
      
      return reply.send({
        success: result.success,
        results: result.results,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// 执行操作组
function handleExecuteActionGroup(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ 
      Params: { groupId: string };
      Querystring: { profile?: string; url?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();
      
      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }
      
      const url = req.query.url || page.url();
      const { groupId } = req.params;
      
      // 获取配置
      const configResult = await globalConfigManager.getConfigForUrl(url);
      
      if (!configResult) {
        return reply.code(404).send({ error: "No config found for current page" });
      }
      
      const { page: pageConfig } = configResult;
      const group = pageConfig.actionGroups?.find(g => g.id === groupId);
      
      if (!group) {
        return reply.code(404).send({ error: `Action group '${groupId}' not found` });
      }
      
      // 执行操作组
      const result = await globalSnapshotEnhancer.executeActionGroup(page, group, pageConfig.elements);
      
      return reply.send({
        success: result.success,
        error: result.error,
        group: {
          id: group.id,
          name: group.name,
          elementRefs: group.elementRefs,
        },
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
