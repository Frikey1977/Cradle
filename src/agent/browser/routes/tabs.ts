/**
 * 浏览器自动化模块 - 标签页路由 (Fastify)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";

export function registerTabsRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.get("/tabs", handleListTabs(ctx));
  app.post("/tabs/open", handleOpenTab(ctx));
  app.post("/tabs/focus", handleFocusTab(ctx));
  app.delete("/tabs/:targetId", handleCloseTab(ctx));
}

function getProfileName(req: FastifyRequest, ctx: BrowserRouteContext): string | undefined {
  return (req.query as { profile?: string }).profile ?? ctx.getState().resolved.defaultProfile;
}

function handleListTabs(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest<{ Querystring: { profile?: string } }>, reply: FastifyReply) => {
    try {
      const profileName = getProfileName(req, ctx);
      const tabs = await ctx.profileManager.listTabs(profileName);
      
      return reply.send({ tabs });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleOpenTab(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: { url?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { url } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!url) {
        return reply.code(400).send({ error: "Missing url parameter" });
      }
      
      const tab = await ctx.profileManager.openTab(url, profileName);
      
      return reply.send({ success: true, tab });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleFocusTab(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: { targetId?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetId } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!targetId) {
        return reply.code(400).send({ error: "Missing targetId parameter" });
      }
      
      await ctx.profileManager.focusTab(targetId, profileName);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleCloseTab(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { targetId: string }; Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { targetId } = req.params;
      const profileName = getProfileName(req, ctx);
      
      await ctx.profileManager.closeTab(targetId, profileName);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
