import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getDealList,
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  isDealExists,
  getDealsByCustomer,
} from "../../customer/deals/service.js";
import {
  createDealSchema,
  updateDealSchema,
} from "../../customer/deals/schema.js";
import type {
  DealQuery,
  CreateDealDto,
  UpdateDealDto,
} from "../../customer/deals/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function dealRoutes(fastify: FastifyInstance) {
  // 获取成交列表（分页）
  fastify.get<{ Querystring: DealQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: DealQuery }>, reply: FastifyReply) => {
      try {
        const result = await getDealList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, { list: [], total: 0, page: 1, pageSize: 20 }, "获取成功");
      }
    }
  );

  // 获取所有成交（不分页）
  fastify.get<{ Querystring: Omit<DealQuery, "page" | "pageSize"> }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: Omit<DealQuery, "page" | "pageSize"> }>, reply: FastifyReply) => {
      try {
        const list = await getAllDeals(request.query);
        return successResponse(reply, list, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, [], "获取成功");
      }
    }
  );

  // 获取成交详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const deal = await getDealById(sid);

      if (!deal) {
        return notFoundResponse(reply, "成交记录不存在");
      }

      return successResponse(reply, deal, "获取成功");
    }
  );

  // 获取客户的成交列表
  fastify.get<{ Params: { customerId: string } }>(
    "/customer/:customerId",
    async (request: FastifyRequest<{ Params: { customerId: string } }>, reply: FastifyReply) => {
      const { customerId } = request.params;
      const list = await getDealsByCustomer(customerId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 创建成交
  fastify.post<{ Body: CreateDealDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateDealDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createDealSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      const sid = await createDeal(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新成交
  fastify.put<{ Params: { sid: string }; Body: UpdateDealDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateDealDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查成交是否存在
      const existingDeal = await getDealById(sid);
      if (!existingDeal) {
        return notFoundResponse(reply, "成交记录不存在");
      }

      // 验证数据
      const result = updateDealSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      await updateDeal(sid, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除成交
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查成交是否存在
      const existingDeal = await getDealById(sid);
      if (!existingDeal) {
        return notFoundResponse(reply, "成交记录不存在");
      }

      await deleteDeal(sid);
      return successResponse(reply, null, "删除成功");
    }
  );
}
