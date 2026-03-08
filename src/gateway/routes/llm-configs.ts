import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getConfigList,
  getAllConfigs,
  getConfigById,
  isConfigNameExists,
  createConfig,
  updateConfig,
  deleteConfig,
  getConfigCountByProvider,
} from "../../llm/configs/service.js";
import {
  createConfigSchema,
  updateConfigSchema,
} from "../../llm/configs/schema.js";
import type {
  ConfigQuery,
  CreateConfigDto,
  UpdateConfigDto,
} from "../../llm/configs/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function llmConfigRoutes(fastify: FastifyInstance) {
  // 获取配置列表（分页）
  fastify.get<{ Querystring: ConfigQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: ConfigQuery }>, reply: FastifyReply) => {
      const result = await getConfigList(request.query);
      return successResponse(reply, result, "获取成功");
    }
  );

  // 获取所有配置（不分页）
  fastify.get<{ Querystring: { providerId?: string } }>(
    "/all",
    async (request: FastifyRequest<{ Querystring: { providerId?: string } }>, reply: FastifyReply) => {
      const list = await getAllConfigs(request.query.providerId);
      return successResponse(reply, list, "获取成功");
    }
  );

  // 获取配置详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const config = await getConfigById(id);

      if (!config) {
        return notFoundResponse(reply, "配置不存在");
      }

      return successResponse(reply, config, "获取成功");
    }
  );

  // 检查配置名称是否存在
  fastify.get<{ Querystring: { name: string; providerId: string; id?: string } }>(
    "/name-exists",
    async (request: FastifyRequest<{ Querystring: { name: string; providerId: string; id?: string } }>, reply: FastifyReply) => {
      const { id, name, providerId } = request.query;
      const exists = await isConfigNameExists(name, providerId, id);
      return successResponse(reply, exists, "");
    }
  );

  // 获取提供商的配置数量
  fastify.get<{ Params: { providerId: string } }>(
    "/count/:providerId",
    async (request: FastifyRequest<{ Params: { providerId: string } }>, reply: FastifyReply) => {
      const { providerId } = request.params;
      const count = await getConfigCountByProvider(providerId);
      return successResponse(reply, { count }, "获取成功");
    }
  );

  // 创建配置
  fastify.post<{ Body: CreateConfigDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateConfigDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createConfigSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在
      const nameExists = await isConfigNameExists(data.name, data.providerId);
      if (nameExists) {
        return validationErrorResponse(reply, "配置名称已存在");
      }

      const sid = await createConfig(data);
      return successResponse(reply, { sid }, "创建成功");
    }
  );

  // 更新配置
  fastify.put<{ Params: { id: string }; Body: UpdateConfigDto }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateConfigDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const data = request.body;

      // 检查配置是否存在
      const existingConfig = await getConfigById(id);
      if (!existingConfig) {
        return notFoundResponse(reply, "配置不存在");
      }

      // 验证数据
      const result = updateConfigSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在（排除当前记录）
      if (data.name && data.name !== existingConfig.name) {
        const nameExists = await isConfigNameExists(data.name, existingConfig.providerId, id);
        if (nameExists) {
          return validationErrorResponse(reply, "配置名称已存在");
        }
      }

      await updateConfig(id, data);
      return successResponse(reply, null, "更新成功");
    }
  );

  // 删除配置
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查配置是否存在
      const existingConfig = await getConfigById(id);
      if (!existingConfig) {
        return notFoundResponse(reply, "配置不存在");
      }

      await deleteConfig(id);
      return successResponse(reply, null, "删除成功");
    }
  );
}
