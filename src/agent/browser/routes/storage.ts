/**
 * 浏览器自动化模块 - 存储路由 (Fastify)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";
import type { SetCookiesRequest, SetStorageRequest } from "../types.js";

export function registerStorageRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.get("/cookies", handleGetCookies(ctx));
  app.post("/cookies/set", handleSetCookies(ctx));
  app.post("/cookies/clear", handleClearCookies(ctx));
  app.get("/storage/:kind", handleGetStorage(ctx));
  app.post("/storage/:kind/set", handleSetStorage(ctx));
  app.post("/storage/:kind/clear", handleClearStorage(ctx));
}

function getProfileName(req: FastifyRequest, ctx: BrowserRouteContext): string | undefined {
  return (req.query as { profile?: string }).profile ?? ctx.getState().resolved.defaultProfile;
}

function handleGetCookies(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const cookies = await driver.getCookies();
      
      return reply.send({ success: true, cookies });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleSetCookies(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string }; Body: SetCookiesRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { cookies } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (!cookies || !Array.isArray(cookies)) {
        return reply.code(400).send({ error: "Missing or invalid cookies parameter" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.setCookies(cookies);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleClearCookies(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.clearCookies();
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleGetStorage(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { kind: string }; Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { kind } = req.params;
      const profileName = getProfileName(req, ctx);
      
      if (kind !== "local" && kind !== "session") {
        return reply.code(400).send({ error: "Invalid storage kind. Must be 'local' or 'session'" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const data = await driver.getStorage(kind);
      
      return reply.send({ success: true, data });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleSetStorage(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { kind: string }; Querystring: { profile?: string }; Body: SetStorageRequest }>,
    reply: FastifyReply
  ) => {
    try {
      const { kind } = req.params;
      const { data } = req.body;
      const profileName = getProfileName(req, ctx);
      
      if (kind !== "local" && kind !== "session") {
        return reply.code(400).send({ error: "Invalid storage kind. Must be 'local' or 'session'" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.setStorage(kind, data);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleClearStorage(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Params: { kind: string }; Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { kind } = req.params;
      const profileName = getProfileName(req, ctx);
      
      if (kind !== "local" && kind !== "session") {
        return reply.code(400).send({ error: "Invalid storage kind. Must be 'local' or 'session'" });
      }
      
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.clearStorage(kind);
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
