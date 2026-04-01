/**
 * 浏览器自动化模块 - Agent 操作路由 (Fastify)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";
import type {
  NavigateRequest,
  ActRequest,
  WaitRequest,
  ScreenshotRequest,
  EvaluateRequest,
  SnapshotOptions,
} from "../types.js";
import { globalSnapshotEnhancer } from "../element-marker/snapshot-enhancer.js";

export function registerAgentRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.post("/navigate", handleNavigate(ctx));
  app.get("/snapshot", handleSnapshot(ctx));
  app.post("/screenshot", handleScreenshot(ctx));
  app.post("/act", handleAct(ctx));
  app.get("/read/:ref", handleRead(ctx));
  app.post("/evaluate", handleEvaluate(ctx));
  app.post("/wait", handleWait(ctx));
  app.post("/highlight", handleHighlight(ctx));
  app.post("/pdf", handlePdf(ctx));
  app.post("/fill-form", handleFillForm(ctx));
}

function getProfileName(req: FastifyRequest, ctx: BrowserRouteContext): string | undefined {
  return (req.query as { profile?: string }).profile ?? ctx.getState().resolved.defaultProfile;
}

function handleNavigate(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: NavigateRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { url, timeoutMs, waitUntil } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!url) {
        return reply.code(400).send({ error: "Missing url parameter" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const result = await driver.navigate(url, { timeoutMs, waitUntil });
      
      return reply.send({ success: true, url: result.url });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleSnapshot(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { format?: "ai" | "aria" | "role"; selector?: string; limit?: string; profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const format = req.query.format ?? "ai";
      const selector = req.query.selector;
      const limit = req.query.limit ? parseInt(req.query.limit) : undefined;
      const profileName = getProfileName(req, ctx);
      
      const opts: SnapshotOptions = { format, selector, limit };
      const driver = await ctx.profileManager.ensureDriver(profileName);
      
      let result;
      switch (format) {
        case "aria":
          result = await driver.snapshotAria(opts);
          break;
        case "role":
          result = await driver.snapshotRole(opts);
          break;
        case "ai":
        default:
          result = await driver.snapshotAi(opts);
          break;
      }
      
      return reply.send({ success: true, ...result });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleScreenshot(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: ScreenshotRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const body = req.body ?? {};
      const { fullPage, selector, type, quality } = body;
      const profileName = getProfileName(req, ctx);
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const buffer = await driver.screenshot({ fullPage, selector, type, quality });
      
      const base64 = buffer.toString("base64");
      const mimeType = type === "jpeg" ? "image/jpeg" : "image/png";
      
      return reply.send({
        success: true,
        data: base64,
        mimeType,
        size: buffer.length,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleAct(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: ActRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const body = req.body;
      const { kind, ref, text, startRef, endRef, values, key, ...opts } = body;
      const profileName = getProfileName(req, ctx);
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      
      switch (kind) {
        case "click":
          await driver.click(ref!, opts);
          break;
        case "type":
          await driver.type(ref!, text!, opts);
          break;
        case "hover":
          await driver.hover(ref!, opts);
          break;
        case "drag":
          await driver.drag(startRef!, endRef!, opts);
          break;
        case "select":
          await driver.select(ref!, values!, opts);
          break;
        case "press":
          await driver.press(key!, opts);
          break;
        default:
          return reply.code(400).send({ error: `Unknown action kind: ${kind}` });
      }
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleEvaluate(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: EvaluateRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const body = req.body ?? {};
      const { fn, args, timeoutMs } = body;
      const profileName = getProfileName(req, ctx);
      
      if (!fn) {
        return reply.code(400).send({ error: "Missing fn parameter" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const result = await driver.evaluate(fn, { timeoutMs });
      
      return reply.send({ success: true, result: result ?? null });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleWait(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: WaitRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const body = req.body;
      const profileName = getProfileName(req, ctx);
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.wait(body);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleHighlight(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: { ref?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { ref } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!ref) {
        return reply.code(400).send({ error: "Missing ref parameter" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.highlight(ref);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handlePdf(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const buffer = await driver.pdf();
      
      const base64 = buffer.toString("base64");
      
      return reply.send({
        success: true,
        data: base64,
        mimeType: "application/pdf",
        size: buffer.length,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleFillForm(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: { fields?: Array<{ ref: string; value: string }>; timeoutMs?: number } }>,
    reply: FastifyReply
  ) => {
    try {
      const { fields, timeoutMs } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!fields || !Array.isArray(fields)) {
        return reply.code(400).send({ error: "Missing or invalid fields parameter" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.fillForm(fields, { timeoutMs });
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleRead(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Params: { ref: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { ref } = req.params;
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = await driver.ensureActivePage();
      
      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }
      
      const url = page.url();
      const { config, pageConfig } = await globalSnapshotEnhancer.injectMarkers(page, url);
      
      const locator = page.locator(`[data-cradle-ref="${ref}"]:not(span.cradle-marker-label)`);
      const count = await locator.count();
      
      if (count === 0) {
        return reply.code(404).send({ error: `Element not found: ${ref}` });
      }
      
      const element = locator.first();
      const content = await element.innerText();
      
      let description = "";
      let type = "";
      if (pageConfig) {
        const elementConfig = pageConfig.elements.find(e => e.ref === ref);
        if (elementConfig) {
          description = elementConfig.description;
          type = elementConfig.type;
        }
      }
      
      return reply.send({
        success: true,
        ref,
        type,
        description,
        content,
        url,
        domain: config?.domain || null,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
