import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getFollowupList,
  getAllFollowups,
  getFollowupById,
  createFollowup,
  updateFollowup,
  deleteFollowup,
  isFollowupExists,
  getFollowupsByCustomer,
  getFollowupsByOpportunity,
} from "../../customer/followups/service.js";
import {
  createFollowupSchema,
  updateFollowupSchema,
} from "../../customer/followups/schema.js";
import type {
  FollowupQuery,
  CreateFollowupDto,
  UpdateFollowupDto,
} from "../../customer/followups/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function followupRoutes(fastify: FastifyInstance) {
  // 获取跟进记录列表（分页）
  fastify.get<{ Querystring: FollowupQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: FollowupQuery }>, reply: FastifyReply) => {
      try {
        const result = await getFollowupList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, { list: [], total: 0, page: 1, pageSize: 20 }, "获取成功");
      }
    }
  );

  // 获取所有跟进记录（不分页）
  fastify.get<{ Querystring: Omit<FollowupQuery, "page" | "pageSize"> }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: Omit<FollowupQuery, "page" | "pageSize"> }>, reply: FastifyReply) => {
      try {
        const list = await getAllFollowups(request.query);
        return successResponse(reply, list, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, [], "获取成功");
      }
    }
  );

  // 获取跟进记录详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const followup = await getFollowupById(sid);

      if (!followup) {
        return notFoundResponse(reply, "跟进记录不存在");
      }

      return successResponse(reply, followup, "获取成功");
    }
  );

  // 获取客户的跟进记录列表
  fastify.get<{ Params: { customerId: string } }>(
    "/customer/:customerId",
    async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
      const { customerId } = request.params;
      const list = await getFollowupsByCustomer(customerId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 获取商机的跟进记录列表
  fastify.get<{ Params: { opportunityId: string } }>(
    "/opportunity/:opportunityId",
    async (request: FastifyRequest<{ Params: { opportunityId: string } }>, reply: FastifyReply) => {
      const { opportunityId } = request.params;
      const list = await getFollowupsByOpportunity(opportunityId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 创建跟进记录
  fastify.post<{ Body: CreateFollowupDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateFollowupDto }>, reply: FastifyReply) => {
      const data = request.body;
      const user = request.user as { sub?: string } | undefined;
      const createBy = user?.sub;

      // 验证数据
      const result = createFollowupSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      const sid = await createFollowup(data, createBy);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新跟进记录
  fastify.put<{ Params: { sid: string }; Body: UpdateFollowupDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateFollowupDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查跟进记录是否存在
      const existingFollowup = await getFollowupById(sid);
      if (!existingFollowup) {
        return notFoundResponse(reply, "跟进记录不存在");
      }

      // 验证数据
      const result = updateFollowupSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      await updateFollowup(sid, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除跟进记录
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查跟进记录是否存在
      const existingFollowup = await getFollowupById(sid);
      if (!existingFollowup) {
        return notFoundResponse(reply, "跟进记录不存在");
      }

      await deleteFollowup(sid);
      return successResponse(reply, null, "删除成功");
    }
  );
}
