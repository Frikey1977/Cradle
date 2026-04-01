/**
 * 浏览器自动化模块 - 调试路由 (Fastify)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";

export function registerDebugRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.get("/console", handleGetConsole(ctx));
  app.get("/errors", handleGetErrors(ctx));
  app.get("/requests", handleGetRequests(ctx));
  app.post("/trace/start", handleTraceStart(ctx));
  app.post("/trace/stop", handleTraceStop(ctx));
}

function getProfileName(req: FastifyRequest, ctx: BrowserRouteContext): string | undefined {
  return (req.query as { profile?: string }).profile ?? ctx.getState().resolved.defaultProfile;
}

function handleGetConsole(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const messages = await driver.getConsoleMessages();
      
      return reply.send({ success: true, messages });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleGetErrors(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const errors = await driver.getPageErrors();
      
      return reply.send({ success: true, errors });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleGetRequests(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const requests = await driver.getNetworkRequests();
      
      return reply.send({ success: true, requests });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleTraceStart(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      await driver.traceStart();
      
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleTraceStop(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{ Querystring: { profile?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const profileName = getProfileName(req, ctx);
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const trace = await driver.traceStop();
      
      const base64 = trace.toString("base64");
      
      return reply.send({
        success: true,
        data: base64,
        size: trace.length,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
