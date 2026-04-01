/**
 * 浏览器自动化模块 - 基础路由 (Fastify)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";

export function registerBasicRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.get("/", handleStatus(ctx));
  app.get("/status", handleStatus(ctx));
  app.post("/start", handleStart(ctx));
  app.post("/stop", handleStop(ctx));
  app.get("/profiles", handleListProfiles(ctx));
}

function handleStatus(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const state = ctx.getState();
      const profiles = ctx.profileManager.getProfileNames();
      
      return reply.send({
        status: "ok",
        port: state.port,
        startTime: state.startTime,
        profiles: profiles.map(name => ({
          name,
          driver: state.resolved.profiles[name]?.driver,
        })),
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleStart(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest<{ Querystring: { profile?: string } }>, reply: FastifyReply) => {
    try {
      const profileName = req.query.profile;
      const driver = await ctx.profileManager.ensureDriver(profileName);
      
      return reply.send({
        success: true,
        profile: profileName ?? ctx.getState().resolved.defaultProfile,
        running: await driver.isRunning(),
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleStop(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest<{ Querystring: { profile?: string } }>, reply: FastifyReply) => {
    try {
      const profileName = req.query.profile;
      await ctx.profileManager.stopDriver(profileName);
      
      return reply.send({
        success: true,
        profile: profileName ?? ctx.getState().resolved.defaultProfile,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleListProfiles(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const state = ctx.getState();
      const profiles = Object.entries(state.resolved.profiles).map(([name, profile]) => ({
        name,
        driver: profile.driver,
      }));
      
      return reply.send({
        profiles,
        defaultProfile: state.resolved.defaultProfile,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
