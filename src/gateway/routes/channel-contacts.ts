import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import {
  getChannelContactList,
  createChannelContact,
  updateChannelContact,
  deleteChannelContact,
  isSenderExists,
} from "../../organization/channel-contact/service.js";
import {
  successResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../shared/response.js";
import "../shared/types.js";

export default async function channelContactRoutes(fastify: FastifyInstance) {
  // 获取通道联系人绑定列表
  fastify.get(
    "/",
    async (request: FastifyRequest<{ Querystring: { contactId?: string; sourceId?: string; sourceType?: string; channelId?: string } }>, reply: FastifyReply) => {
      try {
        const { contactId, sourceId, sourceType, channelId } = request.query;
        const list = await getChannelContactList({ contactId, sourceId, sourceType, channelId });
        return successResponse(reply, list);
      } catch (error: any) {
        console.error("[getChannelContactList] Error:", error);
        return internalErrorResponse(reply, "获取通道联系人绑定列表失败");
      }
    },
  );

  // 创建通道联系人绑定（通过 Contact ID）
  fastify.post<{ Params: { contactId: string }; Body: { channelId: string; sender: string } }>(
    "/:contactId",
    async (
      request: FastifyRequest<{ Params: { contactId: string }; Body: { channelId: string; sender: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { contactId } = request.params;
        const { channelId, sender } = request.body;

        if (!channelId || !sender) {
          return internalErrorResponse(reply, "通道ID和发送者标识不能为空");
        }

        const result = await createChannelContact(contactId, { channelId, sender }, false);
        return successResponse(reply, result, "创建成功");
      } catch (error: any) {
        console.error("[createChannelContact] Error:", error);
        return internalErrorResponse(reply, error.message || "创建通道联系人绑定失败");
      }
    },
  );

  // 创建通道联系人绑定（通过 Source ID，如员工ID）
  fastify.post<{ Params: { sourceId: string }; Body: { channelId: string; sender: string } }>(
    "/by-source/:sourceId",
    async (
      request: FastifyRequest<{ Params: { sourceId: string }; Body: { channelId: string; sender: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { sourceId } = request.params;
        const { channelId, sender } = request.body;

        if (!channelId || !sender) {
          return internalErrorResponse(reply, "通道ID和发送者标识不能为空");
        }

        const result = await createChannelContact(sourceId, { channelId, sender }, true);
        return successResponse(reply, result, "创建成功");
      } catch (error: any) {
        console.error("[createChannelContact by source] Error:", error);
        return internalErrorResponse(reply, error.message || "创建通道联系人绑定失败");
      }
    },
  );

  // 更新通道联系人绑定
  fastify.put<{ Params: { channelId: string; contactId: string }; Body: { sender: string } }>(
    "/:channelId/:contactId",
    async (
      request: FastifyRequest<{ Params: { channelId: string; contactId: string }; Body: { sender: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { channelId, contactId } = request.params;
        const { sender } = request.body;

        if (!sender) {
          return internalErrorResponse(reply, "发送者标识不能为空");
        }

        const result = await updateChannelContact(channelId, contactId, { sender });
        
        if (!result) {
          return notFoundResponse(reply, "绑定记录不存在");
        }

        return successResponse(reply, result, "更新成功");
      } catch (error: any) {
        console.error("[updateChannelContact] Error:", error);
        return internalErrorResponse(reply, error.message || "更新通道联系人绑定失败");
      }
    },
  );

  // 删除通道联系人绑定
  fastify.delete<{ Params: { channelId: string; contactId: string } }>(
    "/:channelId/:contactId",
    async (
      request: FastifyRequest<{ Params: { channelId: string; contactId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { channelId, contactId } = request.params;
        const success = await deleteChannelContact(channelId, contactId);

        if (!success) {
          return notFoundResponse(reply, "绑定记录不存在");
        }

        return successResponse(reply, null, "删除成功");
      } catch (error: any) {
        console.error("[deleteChannelContact] Error:", error);
        return internalErrorResponse(reply, "删除通道联系人绑定失败");
      }
    },
  );

  // 检查 sender 是否已存在
  fastify.get<{ Querystring: { channelId: string; sender: string; excludeContactId?: string } }>(
    "/sender-exists",
    async (
      request: FastifyRequest<{
        Querystring: { channelId: string; sender: string; excludeContactId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { channelId, sender, excludeContactId } = request.query;
        
        if (!channelId || !sender) {
          return successResponse(reply, false, "检查完成");
        }

        const exists = await isSenderExists(channelId, sender, excludeContactId);
        return successResponse(reply, exists, "检查完成");
      } catch (error: any) {
        console.error("[isSenderExists] Error:", error);
        return internalErrorResponse(reply, "检查失败");
      }
    },
  );
}
