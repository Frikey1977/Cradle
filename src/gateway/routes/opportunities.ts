import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getOpportunityList,
  getAllOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  isOpportunityExists,
  getOpportunitiesByCustomer,
} from "../../customer/opportunities/service.js";
import {
  createOpportunitySchema,
  updateOpportunitySchema,
} from "../../customer/opportunities/schema.js";
import type {
  OpportunityQuery,
  CreateOpportunityDto,
  UpdateOpportunityDto,
} from "../../customer/opportunities/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function opportunityRoutes(fastify: FastifyInstance) {
  // 获取商机列表（分页）
  fastify.get<{ Querystring: OpportunityQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: OpportunityQuery }>, reply: FastifyReply) => {
      try {
        const result = await getOpportunityList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, { list: [], total: 0, page: 1, pageSize: 20 }, "获取成功");
      }
    }
  );

  // 获取所有商机（不分页）
  fastify.get<{ Querystring: Omit<OpportunityQuery, "page" | "pageSize"> }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: Omit<OpportunityQuery, "page" | "pageSize"> }>, reply: FastifyReply) => {
      try {
        const list = await getAllOpportunities(request.query);
        return successResponse(reply, list, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, [], "获取成功");
      }
    }
  );

  // 获取商机详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const opportunity = await getOpportunityById(sid);

      if (!opportunity) {
        return notFoundResponse(reply, "商机不存在");
      }

      return successResponse(reply, opportunity, "获取成功");
    }
  );

  // 获取客户的商机列表
  fastify.get<{ Params: { customerId: string } }>(
    "/customer/:customerId",
    async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
      const { customerId } = request.params;
      const list = await getOpportunitiesByCustomer(customerId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 创建商机
  fastify.post<{ Body: CreateOpportunityDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateOpportunityDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createOpportunitySchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      const sid = await createOpportunity(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新商机
  fastify.put<{ Params: { sid: string }; Body: UpdateOpportunityDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateOpportunityDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查商机是否存在
      const existingOpportunity = await getOpportunityById(sid);
      if (!existingOpportunity) {
        return notFoundResponse(reply, "商机不存在");
      }

      // 验证数据
      const result = updateOpportunitySchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      await updateOpportunity(sid, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除商机
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查商机是否存在
      const existingOpportunity = await getOpportunityById(sid);
      if (!existingOpportunity) {
        return notFoundResponse(reply, "商机不存在");
      }

      await deleteOpportunity(sid);
      return successResponse(reply, null, "删除成功");
    }
  );
}
