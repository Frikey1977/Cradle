/**
 * 浏览器自动化模块 - HTTP 路由注册 (Fastify)
 */

import Fastify from "fastify";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserServerState, BrowserControlAuth } from "../types.js";
import { createBrowserRouteContext, type BrowserRouteContext } from "./context.js";
import { registerBasicRoutes } from "./basic.js";
import { registerTabsRoutes } from "./tabs.js";
import { registerAgentRoutes } from "./agent.js";
import { registerStorageRoutes } from "./storage.js";
import { registerDebugRoutes } from "./debug.js";
import { registerRecorderRoutes } from "./recorder.js";
import { registerElementMarkerRoutes } from "./element-marker.js";

export { createBrowserRouteContext, type BrowserRouteContext } from "./context.js";

export function createBrowserApp(state: BrowserServerState): FastifyInstance {
  const app = Fastify({ logger: false });
  
  installAuthHook(app, state.resolved.auth);
  
  const ctx = createBrowserRouteContext({
    getState: () => state,
  });
  
  registerBasicRoutes(app, ctx);
  registerTabsRoutes(app, ctx);
  registerAgentRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerDebugRoutes(app, ctx);
  registerRecorderRoutes(app, ctx);
  registerElementMarkerRoutes(app, ctx);
  
  return app;
}

function installAuthHook(app: FastifyInstance, auth: BrowserControlAuth): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.url === "/" || request.url === "/status") {
      return;
    }
    
    if (!auth.token && !auth.password) {
      return;
    }
    
    const authHeader = request.headers.authorization;
    const xPassword = request.headers["x-cradle-password"];
    
    if (auth.token) {
      const token = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      
      if (token === auth.token) {
        return;
      }
    }
    
    if (auth.password) {
      if (xPassword === auth.password) {
        return;
      }
      
      if (authHeader?.startsWith("Basic ")) {
        const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
        const [, password] = credentials.split(":");
        if (password === auth.password) {
          return;
        }
      }
    }
    
    reply.code(401).send({ error: "Unauthorized" });
    throw new Error("Unauthorized");
  });
}

export function registerBrowserRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  registerBasicRoutes(app, ctx);
  registerTabsRoutes(app, ctx);
  registerAgentRoutes(app, ctx);
  registerStorageRoutes(app, ctx);
  registerDebugRoutes(app, ctx);
  registerRecorderRoutes(app, ctx);
  registerElementMarkerRoutes(app, ctx);
}
