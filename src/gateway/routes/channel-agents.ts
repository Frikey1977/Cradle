import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getChannelAgentList,
  createChannelAgent,
  updateChannelAgent,
  deleteChannelAgent,
  isIdentityExists,
} from "../../organization/channel-agent/service.js";
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../shared/response.js";
import "../shared/types.js";

export default async function channelAgentRoutes(fastify: FastifyInstance) {
  // 获取通道Agent绑定列表
  fastify.get(
    "/",
    async (request: FastifyRequest<{ Querystring: { agentId?: string; channelId?: string } }>, reply: FastifyReply) => {
      try {
        const { agentId, channelId } = request.query;
        const list = await getChannelAgentList({ agentId, channelId });
        return successResponse(reply, list);
      } catch (error: any) {
        console.error("[getChannelAgentList] Error:", error);
        return internalErrorResponse(reply, "获取通道Agent绑定列表失败");
      }
    },
  );

  // 创建通道Agent绑定
  fastify.post<{ Params: { agentId: string }; Body: { channelId: string; identity: string; config?: Record<string, any> } }>(
    "/:agentId",
    async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: { channelId: string; identity: string; config?: Record<string, any> } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agentId } = request.params;
        const { channelId, identity, config } = request.body;

        if (!channelId || !identity) {
          return internalErrorResponse(reply, "通道ID和身份标识不能为空");
        }

        const result = await createChannelAgent(agentId, { channelId, identity, config });
        return successResponse(reply, result, "创建成功");
      } catch (error: any) {
        console.error("[createChannelAgent] Error:", error);
        return internalErrorResponse(reply, error.message || "创建通道Agent绑定失败");
      }
    },
  );

  // 更新通道Agent绑定
  fastify.put<{ Params: { channelId: string; agentId: string }; Body: { identity: string; config?: Record<string, any> } }>(
    "/:channelId/:agentId",
    async (
      request: FastifyRequest<{ Params: { channelId: string; agentId: string }; Body: { identity: string; config?: Record<string, any> } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { channelId, agentId } = request.params;
        const { identity, config } = request.body;

        if (!identity) {
          return internalErrorResponse(reply, "身份标识不能为空");
        }

        const result = await updateChannelAgent(channelId, agentId, { identity, config });
        
        if (!result) {
          return notFoundResponse(reply, "绑定记录不存在");
        }

        return successResponse(reply, result, "更新成功");
      } catch (error: any) {
        console.error("[updateChannelAgent] Error:", error);
        return internalErrorResponse(reply, error.message || "更新通道Agent绑定失败");
      }
    },
  );

  // 删除通道Agent绑定
  fastify.delete<{ Params: { channelId: string; agentId: string } }>(
    "/:channelId/:agentId",
    async (
      request: FastifyRequest<{ Params: { channelId: string; agentId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { channelId, agentId } = request.params;
        const success = await deleteChannelAgent(channelId, agentId);

        if (!success) {
          return notFoundResponse(reply, "绑定记录不存在");
        }

        return successResponse(reply, null, "删除成功");
      } catch (error: any) {
        console.error("[deleteChannelAgent] Error:", error);
        return internalErrorResponse(reply, error.message || "删除通道Agent绑定失败");
      }
    },
  );

  // 检查 identity 是否已存在
  fastify.get(
    "/check-identity",
    async (request: FastifyRequest<{ Querystring: { channelId: string; identity: string; excludeAgentId?: string } }>, reply: FastifyReply) => {
      try {
        const { channelId, identity, excludeAgentId } = request.query;
        
        if (!channelId || !identity) {
          return internalErrorResponse(reply, "通道ID和身份标识不能为空");
        }

        const exists = await isIdentityExists(channelId, identity, excludeAgentId);
        return successResponse(reply, { exists });
      } catch (error: any) {
        console.error("[isIdentityExists] Error:", error);
        return internalErrorResponse(reply, "检查身份标识失败");
      }
    },
  );
}
