import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getProviderList,
  getAllProviders,
  getProviderById,
  isProviderNameExists,
  createProvider,
  updateProvider,
  deleteProvider,
  getProviderCount,
} from "../../llm/providers/service.js";
import {
  createProviderSchema,
  updateProviderSchema,
} from "../../llm/providers/schema.js";
import type {
  ProviderQuery,
  NameExistsQuery,
  CreateProviderDto,
  UpdateProviderDto,
} from "../../llm/providers/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function llmProviderRoutes(fastify: FastifyInstance) {
  // 获取提供商列表（分页）
  fastify.get<{ Querystring: ProviderQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: ProviderQuery }>, reply: FastifyReply) => {
      const list = await getProviderList(request.query);
      const total = await getProviderCount(request.query);
      return successResponse(reply, { list, total }, "获取成功");
    }
  );

  // 获取所有提供商（不分页）
  fastify.get("/all", async (_request: FastifyRequest, reply: FastifyReply) => {
    const list = await getAllProviders();
    return successResponse(reply, list, "获取成功");
  });

  // 获取提供商详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const provider = await getProviderById(id);

      if (!provider) {
        return notFoundResponse(reply, "提供商不存在");
      }

      return successResponse(reply, provider, "获取成功");
    }
  );

  // 检查提供商名称是否存在
  fastify.get<{ Querystring: NameExistsQuery }>(
    "/name-exists",
    async (request: FastifyRequest<{ Querystring: NameExistsQuery }>, reply: FastifyReply) => {
      const { id, name } = request.query;
      const exists = await isProviderNameExists(name, id);
      return successResponse(reply, exists, "");
    }
  );

  // 创建提供商
  fastify.post<{ Body: CreateProviderDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateProviderDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createProviderSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在
      const nameExists = await isProviderNameExists(data.name);
      if (nameExists) {
        return validationErrorResponse(reply, "提供商名称已存在");
      }

      const sid = await createProvider(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新提供商
  fastify.put<{ Params: { id: string }; Body: UpdateProviderDto }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateProviderDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const data = request.body;

      // 检查提供商是否存在
      const existingProvider = await getProviderById(id);
      if (!existingProvider) {
        return notFoundResponse(reply, "提供商不存在");
      }

      // 验证数据
      const result = updateProviderSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在（排除当前记录）
      if (data.name && data.name !== existingProvider.name) {
        const nameExists = await isProviderNameExists(data.name, id);
        if (nameExists) {
          return validationErrorResponse(reply, "提供商名称已存在");
        }
      }

      await updateProvider(id, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除提供商
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查提供商是否存在
      const existingProvider = await getProviderById(id);
      if (!existingProvider) {
        return notFoundResponse(reply, "提供商不存在");
      }

      await deleteProvider(id);
      return successResponse(reply, null, "删除成功");
    }
  );
}
