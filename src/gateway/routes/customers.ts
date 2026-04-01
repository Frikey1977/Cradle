import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getCustomerList,
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  isCustomerExists,
} from "../../customer/customers/service.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "../../customer/customers/schema.js";
import type {
  CustomerQuery,
  CreateCustomerDto,
  UpdateCustomerDto,
} from "../../customer/customers/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function customerRoutes(fastify: FastifyInstance) {
  // 获取客户列表（分页）
  fastify.get<{ Querystring: CustomerQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: CustomerQuery }>, reply: FastifyReply) => {
      try {
        const result = await getCustomerList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, { list: [], total: 0, page: 1, pageSize: 20 }, "获取成功");
      }
    }
  );

  // 获取所有客户（不分页）
  fastify.get<{ Querystring: Omit<CustomerQuery, "page" | "pageSize"> }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: Omit<CustomerQuery, "page" | "pageSize"> }>, reply: FastifyReply) => {
      try {
        const list = await getAllCustomers(request.query);
        return successResponse(reply, list, "获取成功");
      } catch (error) {
        request.log.error(error);
        return successResponse(reply, [], "获取成功");
      }
    }
  );

  // 获取客户详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const customer = await getCustomerById(sid);

      if (!customer) {
        return notFoundResponse(reply, "客户不存在");
      }

      return successResponse(reply, customer, "获取成功");
    }
  );

  // 创建客户
  fastify.post<{ Body: CreateCustomerDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateCustomerDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createCustomerSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      const sid = await createCustomer(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新客户
  fastify.put<{ Params: { sid: string }; Body: UpdateCustomerDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateCustomerDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查客户是否存在
      const existingCustomer = await getCustomerById(sid);
      if (!existingCustomer) {
        return notFoundResponse(reply, "客户不存在");
      }

      // 验证数据
      const result = updateCustomerSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
      }

      await updateCustomer(sid, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除客户
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查客户是否存在
      const existingCustomer = await getCustomerById(sid);
      if (!existingCustomer) {
        return notFoundResponse(reply, "客户不存在");
      }

      await deleteCustomer(sid);
      return successResponse(reply, null, "删除成功");
    }
  );
}
