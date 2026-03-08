import type { FastifyInstance, FastifyRequest } from "fastify";
import "../shared/types.js";
import { getUserById } from "../../system/users/service.js";
import { successResponse, errorResponse } from "../shared/response.js";
import type { JwtPayload } from "../shared/types.js";
import agentRoutes from "./agents.js";
import aiSmartFormRoutes from "./ai-smart-form.js";
import authRoutes from "./auth.js";
import channelAgentRoutes from "./channel-agents.js";
import channelContactRoutes from "./channel-contacts.js";
import channelsRoutes from "./channels.js";
import codesRoutes from "./codes.js";
import contactRoutes from "./contacts.js";
import contactFieldRoutes from "./contact-fields.js";
import departmentsRoutes from "./departments.js";
import employeeRoutes from "./employees.js";
import llmConfigRoutes from "./llm-configs.js";
import llmInstanceRoutes from "./llm-instances.js";
import llmProviderRoutes from "./llm-providers.js";
import menuRoutes from "./menu.js";
import moduleRoutes from "./modules.js";
import positionRoutes from "./positions.js";
import relationshipRoutes from "./relationships.js";
import roleRoutes from "./roles.js";
import skillsRoutes from "./skills.js";
import timezoneRoutes from "./timezone.js";
import userRoutes from "./users.js";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  await fastify.register(authRoutes, { prefix: "/auth" });

  // 注册 /users/info 路由（需要认证）
  await fastify.register(async (app) => {
    app.addHook("preHandler", app.authenticate);
    
    app.get("/users/info", async (request: FastifyRequest, reply) => {
      const payload = request.user as JwtPayload;
      const user = await getUserById(payload.sub);
      
      if (!user) {
        return errorResponse(reply, 404, "用户不存在");
      }
      
      return successResponse(reply, user, "获取成功");
    });
  });

  await fastify.register(async (app) => {
    app.addHook("preHandler", app.authenticate);

    await app.register(userRoutes, { prefix: "/system/users" });
    await app.register(menuRoutes, { prefix: "/menu" });
    await app.register(departmentsRoutes, { prefix: "/departments" });
    await app.register(positionRoutes, { prefix: "/positions" });
    await app.register(employeeRoutes, { prefix: "/organization/employees" });
    await app.register(contactRoutes, { prefix: "/organization/contacts" });
    await app.register(contactFieldRoutes, { prefix: "/organization/contacts" });
    await app.register(agentRoutes, { prefix: "/organization/agents" });
    await app.register(relationshipRoutes, { prefix: "/organization/relationships" });
    await app.register(roleRoutes, { prefix: "/system/roles" });
    await app.register(codesRoutes, { prefix: "/system/codes" });
    await app.register(moduleRoutes, { prefix: "/system/modules" });
    await app.register(skillsRoutes, { prefix: "/system/skills" });
    await app.register(llmProviderRoutes, { prefix: "/llm/providers" });
    await app.register(llmConfigRoutes, { prefix: "/llm/configs" });
    await app.register(llmInstanceRoutes, { prefix: "/llm/instances" });
    await app.register(aiSmartFormRoutes, { prefix: "/ai" });
    await app.register(channelsRoutes, { prefix: "/system/channels" });
    await app.register(channelContactRoutes, { prefix: "/system/channel-contacts" });
    await app.register(channelAgentRoutes, { prefix: "/system/channel-agents" });
    await app.register(timezoneRoutes, { prefix: "" });
  });
}
