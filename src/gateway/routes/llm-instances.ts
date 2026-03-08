import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getInstanceList,
  getAllInstances,
  getInstanceById,
  isInstanceNameExists,
  isApiKeyHashExists,
  createInstance,
  updateInstance,
  deleteInstance,
  getInstanceCountByConfig,
} from "../../llm/instances/service.js";
import {
  createInstanceSchema,
  updateInstanceSchema,
} from "../../llm/instances/schema.js";
import type {
  InstanceQuery,
  CreateInstanceDto,
  UpdateInstanceDto,
} from "../../llm/instances/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function llmInstanceRoutes(fastify: FastifyInstance) {
  // 获取实例列表（分页）
  fastify.get<{ Querystring: InstanceQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: InstanceQuery }>, reply: FastifyReply) => {
      const result = await getInstanceList(request.query);
      return successResponse(reply, result, "获取成功");
    }
  );

  // 获取所有实例（不分页）
  fastify.get<{ Querystring: { configId?: string } }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: { configId?: string } }>, reply: FastifyReply) => {
      const list = await getAllInstances(request.query.configId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 获取实例详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const instance = await getInstanceById(id);

      if (!instance) {
        return notFoundResponse(reply, "实例不存在");
      }

      return successResponse(reply, instance, "获取成功");
    }
  );

  // 检查实例名称是否存在
  fastify.get<{ Querystring: { name: string; configId: string; id?: string } }>(
    "/name-exists",
    async (request: FastifyRequest<{ Querystring: { name: string; configId: string; id?: string } }>, reply: FastifyReply) => {
      const { id, name, configId } = request.query;
      const exists = await isInstanceNameExists(name, configId, id);
      return successResponse(reply, exists, "");
    }
  );

  // 检查API Key是否存在（在同一配置下）
  fastify.get<{ Querystring: { apiKey: string; configId: string; id?: string } }>(
    "/apikey-exists",
    async (request: FastifyRequest<{ Querystring: { apiKey: string; configId: string; id?: string } }>, reply: FastifyReply) => {
      const { id, apiKey, configId } = request.query;
      const exists = await isApiKeyHashExists(apiKey, configId, id);
      return successResponse(reply, exists, "");
    }
  );

  // 获取配置的实例数量
  fastify.get<{ Params: { configId: string } }>(
    "/count/:configId",
    async (request: FastifyRequest<{ Params: { configId: string } }>, reply: FastifyReply) => {
      const { configId } = request.params;
      const count = await getInstanceCountByConfig(configId);
      return successResponse(reply, { count }, "获取成功");
    }
  );

  // 创建实例
  fastify.post<{ Body: CreateInstanceDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateInstanceDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createInstanceSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在
      const nameExists = await isInstanceNameExists(data.name, data.configId);
      if (nameExists) {
        return validationErrorResponse(reply, "实例名称已存在");
      }

      // 检查API Key是否已在同一配置下存在
      const apiKeyExists = await isApiKeyHashExists(data.apiKey, data.configId);
      if (apiKeyExists) {
        return validationErrorResponse(reply, "该配置下已存在相同的API Key");
      }

      const sid = await createInstance(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新实例
  fastify.put<{ Params: { id: string }; Body: UpdateInstanceDto }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateInstanceDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const data = request.body;

      // 检查实例是否存在
      const existingInstance = await getInstanceById(id);
      if (!existingInstance) {
        return notFoundResponse(reply, "实例不存在");
      }

      // 验证数据
      const result = updateInstanceSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在（排除当前记录）
      if (data.name && data.name !== existingInstance.name) {
        const configId = data.configId || existingInstance.configId;
        const nameExists = await isInstanceNameExists(data.name, configId, id);
        if (nameExists) {
          return validationErrorResponse(reply, "实例名称已存在");
        }
      }

      // 检查API Key是否已在同一配置下存在（排除当前记录）
      if (data.apiKey && data.apiKey !== existingInstance.apiKey) {
        const configId = data.configId || existingInstance.configId;
        const apiKeyExists = await isApiKeyHashExists(data.apiKey, configId, id);
        if (apiKeyExists) {
          return validationErrorResponse(reply, "该配置下已存在相同的API Key");
        }
      }

      await updateInstance(id, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除实例
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查实例是否存在
      const existingInstance = await getInstanceById(id);
      if (!existingInstance) {
        return notFoundResponse(reply, "实例不存在");
      }

      await deleteInstance(id);
      return successResponse(reply, null, "删除成功");
    }
  );
}
