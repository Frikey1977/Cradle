import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getModuleList,
  getModuleTree,
  getModuleById,
  isModuleNameExists,
  isModulePathExists,
  createModule,
  updateModule,
  updateModuleStatus,
  deleteModule,
  getModuleChildren,
  hasChildren,
} from "../../system/modules/service.js";
import {
  createModuleSchema,
  updateModuleSchema,
  updateStatusSchema,
} from "../../system/modules/schema.js";
import type {
  ModuleQuery,
  NameExistsQuery,
  PathExistsQuery,
  CreateModuleDto,
  UpdateModuleDto,
  UpdateStatusDto,
} from "../../system/modules/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function moduleRoutes(fastify: FastifyInstance) {
  // 获取模块列表
  fastify.get<{ Querystring: ModuleQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: ModuleQuery }>, reply: FastifyReply) => {
      const list = await getModuleList(request.query);
      return successResponse(reply, list);
    },
  );

  // 获取模块树
  fastify.get("/tree", async (_request: FastifyRequest, reply: FastifyReply) => {
    const tree = await getModuleTree();
    return successResponse(reply, tree, "获取成功");
  });

  // 获取模块详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const module = await getModuleById(id);

      if (!module) {
        return notFoundResponse(reply, "模块不存在");
      }

      return successResponse(reply, module, "获取成功");
    },
  );

  // 检查模块名称是否存在
  fastify.get<{ Querystring: NameExistsQuery }>(
    "/name-exists",
    async (request: FastifyRequest<{ Querystring: NameExistsQuery }>, reply: FastifyReply) => {
      const { id, name } = request.query;
      const exists = await isModuleNameExists(name, id);
      return successResponse(reply, exists, "");
    },
  );

  // 检查模块路径是否存在
  fastify.get<{ Querystring: PathExistsQuery }>(
    "/path-exists",
    async (request: FastifyRequest<{ Querystring: PathExistsQuery }>, reply: FastifyReply) => {
      const { id, path } = request.query;
      const exists = await isModulePathExists(path, id);
      return successResponse(reply, exists, "");
    },
  );

  // 创建模块
  fastify.post<{ Body: CreateModuleDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateModuleDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createModuleSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在
      const nameExists = await isModuleNameExists(data.name);
      if (nameExists) {
        return validationErrorResponse(reply, "模块名称已存在");
      }

      const sid = await createModule(data);
      return successResponse(reply, { sid }, "创建成功");
    },
  );

  // 更新模块
  fastify.put<{ Params: { id: string }; Body: UpdateModuleDto }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateModuleDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const data = request.body;

      // 检查模块是否存在
      const existingModule = await getModuleById(id);
      if (!existingModule) {
        return notFoundResponse(reply, "模块不存在");
      }

      // 验证数据
      const result = updateModuleSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在（排除当前记录）
      if (data.name && data.name !== existingModule.name) {
        const nameExists = await isModuleNameExists(data.name, id);
        if (nameExists) {
          return validationErrorResponse(reply, "模块名称已存在");
        }
      }

      // 检查是否将自身设置为父模块
      if (data.pid === id) {
        return validationErrorResponse(reply, "不能将自身设置为父模块");
      }

      await updateModule(id, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 更新模块状态
  fastify.put<{ Params: { id: string }; Body: UpdateStatusDto }>(
    "/:id/status",
    async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateStatusDto }>, reply: FastifyReply) => {
      const { id } = request.params;
      const data = request.body;

      // 验证数据
      const result = updateStatusSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查模块是否存在
      const existingModule = await getModuleById(id);
      if (!existingModule) {
        return notFoundResponse(reply, "模块不存在");
      }

      await updateModuleStatus(id, data);
      return successResponse(reply, null, data.status === "enabled" ? "启用成功" : "停用成功");
    },
  );

  // 删除模块
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查模块是否存在
      const existingModule = await getModuleById(id);
      if (!existingModule) {
        return notFoundResponse(reply, "模块不存在");
      }

      // 检查是否有子模块
      const hasChildModules = await hasChildren(id);
      if (hasChildModules) {
        return validationErrorResponse(reply, "请先删除子模块");
      }

      await deleteModule(id);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 获取子模块列表
  fastify.get<{ Params: { id: string } }>(
    "/:id/children",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const children = await getModuleChildren(id);
      return successResponse(reply, children, "获取成功");
    },
  );
}
