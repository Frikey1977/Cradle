import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  ChannelQuery,
  CreateChannelDto,
  UpdateChannelDto,
  UpdateStatusDto,
} from "../channels/types.js";
import {
  createChannelSchema,
  updateChannelSchema,
  updateStatusSchema,
} from "../channels/schema.js";
import {
  getChannelList,
  getChannelById,
  isChannelNameExists,
  createChannel,
  updateChannel,
  updateChannelStatus,
  deleteChannel,
} from "../channels/service.js";
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../shared/response.js";
import "../shared/types.js";

export default async function channelsRoutes(fastify: FastifyInstance) {
  // 获取通道列表
  fastify.get<{ Querystring: ChannelQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: ChannelQuery }>, reply: FastifyReply) => {
      try {
        const list = await getChannelList(request.query);
        return successResponse(reply, list);
      } catch (error: any) {
        console.error("[getChannelList] Error:", error);
        return internalErrorResponse(reply, "获取通道列表失败");
      }
    },
  );

  // 获取通道详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const channel = await getChannelById(id);

        if (!channel) {
          return notFoundResponse(reply, "通道不存在");
        }

        return successResponse(reply, channel, "获取成功");
      } catch (error: any) {
        console.error("[getChannelById] Error:", error);
        return internalErrorResponse(reply, "获取通道详情失败");
      }
    },
  );

  // 检查通道名称是否存在
  fastify.get<{ Querystring: { name: string; excludeId?: string } }>(
    "/name-exists",
    async (
      request: FastifyRequest<{
        Querystring: { name: string; excludeId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      try {
        const { name, excludeId } = request.query;
        if (!name) {
          return successResponse(reply, false, "检查完成");
        }
        const exists = await isChannelNameExists(name, excludeId);
        return successResponse(reply, exists, "检查完成");
      } catch (error: any) {
        console.error("[isChannelNameExists] Error:", error);
        return internalErrorResponse(reply, "检查失败");
      }
    },
  );

  // 创建通道
  fastify.post<{ Body: CreateChannelDto }>(
    "/",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            config: { type: "object" },
            status: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateChannelDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;
        console.log("[createChannel] received data:", JSON.stringify(data));
        console.log("[createChannel] config type:", typeof data.config, data.config);

        // 确保 config 是对象
        if (data.config && typeof data.config === "string") {
          try {
            data.config = JSON.parse(data.config);
          } catch {
            data.config = {};
          }
        }

        // 验证数据
        const result = createChannelSchema.safeParse(data);
        if (!result.success) {
          console.error("[createChannel] validation error:", result.error);
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查名称是否已存在
        const nameExists = await isChannelNameExists(data.name);
        if (nameExists) {
          return validationErrorResponse(reply, "通道名称已存在");
        }

        const channel = await createChannel(data);
        return successResponse(reply, channel, "创建成功");
      } catch (error: any) {
        console.error("[createChannel] Error:", error);
        return validationErrorResponse(reply, error.message || "创建失败");
      }
    },
  );

  // 更新通道
  fastify.put<{ Params: { id: string }; Body: UpdateChannelDto }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateChannelDto }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const data = request.body;

        // 验证数据
        const result = updateChannelSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查通道是否存在
        const existingChannel = await getChannelById(id);
        if (!existingChannel) {
          return notFoundResponse(reply, "通道不存在");
        }

        // 检查名称是否已存在
        if (data.name) {
          const nameExists = await isChannelNameExists(data.name, id);
          if (nameExists) {
            return validationErrorResponse(reply, "通道名称已存在");
          }
        }

        const channel = await updateChannel(id, data);
        return successResponse(reply, channel, "更新成功");
      } catch (error: any) {
        console.error("[updateChannel] Error:", error);
        return validationErrorResponse(reply, error.message || "更新失败");
      }
    },
  );

  // 更新通道状态
  fastify.put<{ Params: { id: string }; Body: UpdateStatusDto }>(
    "/:id/status",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateStatusDto }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const { status } = request.body;

        // 验证数据
        const result = updateStatusSchema.safeParse({ status });
        if (!result.success) {
          return validationErrorResponse(reply, "状态值无效");
        }

        // 检查通道是否存在
        const existingChannel = await getChannelById(id);
        if (!existingChannel) {
          return notFoundResponse(reply, "通道不存在");
        }

        const channel = await updateChannelStatus(id, status);
        return successResponse(reply, channel, "状态更新成功");
      } catch (error: any) {
        console.error("[updateChannelStatus] Error:", error);
        return validationErrorResponse(reply, error.message || "状态更新失败");
      }
    },
  );

  // 删除通道
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        // 检查通道是否存在
        const existingChannel = await getChannelById(id);
        if (!existingChannel) {
          return notFoundResponse(reply, "通道不存在");
        }

        await deleteChannel(id);
        return successResponse(reply, null, "删除成功");
      } catch (error: any) {
        console.error("[deleteChannel] Error:", error);
        return validationErrorResponse(reply, error.message || "删除失败");
      }
    },
  );
}
