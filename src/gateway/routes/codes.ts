import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  CodeQuery,
  CreateCodeDto,
  UpdateCodeDto,
  UpdateStatusDto,
} from "../../system/codes/types.js";
import {
  createCodeSchema,
  updateCodeSchema,
  updateStatusSchema,
} from "../../system/codes/schema.js";
import {
  getCodeList,
  getCodeTree,
  getCodeListByType,
  getCodeOptionsByType,
  getCodeOptionsByParentValue,
  getCodeById,
  isCodeNameExists,
  isCodeValueExists,
  createCode,
  updateCode,
  updateCodeStatus,
  deleteCode,
  getCodeTypes,
} from "../../system/codes/service.js";
import {
  successResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../shared/response.js";
import "../shared/types.js";

export default async function codesRoutes(fastify: FastifyInstance) {
  // 获取代码列表
  fastify.get<{ Querystring: CodeQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: CodeQuery }>, reply: FastifyReply) => {
      const list = await getCodeList(request.query);
      return successResponse(reply, list);
    },
  );

  // 获取代码树
  fastify.get("/tree", async (_request: FastifyRequest, reply: FastifyReply) => {
    const tree = await getCodeTree();
    return successResponse(reply, tree, "获取成功");
  });

  // 根据类型获取代码列表
  fastify.get<{ Params: { type: string } }>(
    "/type/:type",
    async (request: FastifyRequest<{ Params: { type: string } }>, reply: FastifyReply) => {
      const { type } = request.params;
      const list = await getCodeListByType(type);
      return successResponse(reply, list, "获取成功");
    },
  );

  // 根据类型获取代码选项（用于下拉选择）
  fastify.get<{ Params: { type: string } }>(
    "/options/:type",
    async (request: FastifyRequest<{ Params: { type: string } }>, reply: FastifyReply) => {
      const { type } = request.params;
      const options = await getCodeOptionsByType(type);
      return successResponse(reply, options, "获取成功");
    },
  );

  // 根据父级代码值获取子代码选项（用于下拉选择）
  fastify.get<{ Params: { parentValue: string } }>(
    "/options-by-parent/:parentValue",
    async (request: FastifyRequest<{ Params: { parentValue: string } }>, reply: FastifyReply) => {
      try {
        const { parentValue } = request.params;
        const options = await getCodeOptionsByParentValue(parentValue);
        return successResponse(reply, options, "获取成功");
      } catch (error) {
        console.error("[options-by-parent] Error:", error);
        return internalErrorResponse(reply, "获取代码选项失败");
      }
    },
  );

  // 获取代码类型列表
  fastify.get("/types", async (_request: FastifyRequest, reply: FastifyReply) => {
    const types = await getCodeTypes();
    return successResponse(reply, types, "获取成功");
  });

  // 检查代码值是否存在（同一父级下）
  fastify.get<{ Querystring: { value: string; parentId?: string; excludeId?: string } }>(
    "/value-exists",
    async (
      request: FastifyRequest<{
        Querystring: { value: string; parentId?: string; excludeId?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { value, parentId, excludeId } = request.query;
      if (!value) {
        return successResponse(reply, false, "检查完成");
      }
      const exists = await isCodeValueExists(value, parentId || null, excludeId);
      return successResponse(reply, exists, "检查完成");
    },
  );

  // 获取代码详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const code = await getCodeById(id);

      if (!code) {
        return notFoundResponse(reply, "代码不存在");
      }

      return successResponse(reply, code, "获取成功");
    },
  );

  // 创建代码
  fastify.post<{ Body: CreateCodeDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateCodeDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createCodeSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查名称是否已存在（同一父级下）
      const nameExists = await isCodeNameExists(data.name, data.parentId);
      if (nameExists) {
        return validationErrorResponse(reply, "同级代码名称已存在");
      }

      // 检查代码值是否已存在（同一父级下）
      if (data.value) {
        const valueExists = await isCodeValueExists(data.value, data.parentId);
        if (valueExists) {
          return validationErrorResponse(reply, "同级代码值已存在");
        }
      }

      try {
        const code = await createCode(data);
        return successResponse(reply, code, "创建成功");
      } catch (error: any) {
        return validationErrorResponse(reply, error.message || "创建失败");
      }
    },
  );

  // 更新代码
  fastify.put<{ Params: { id: string }; Body: UpdateCodeDto }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateCodeDto }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const data = request.body;

      // 验证数据
      const result = updateCodeSchema.safeParse(data);
      if (!result.success) {
        console.error("[updateCode] Validation error:", result.error.errors);
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查代码是否存在
      const existingCode = await getCodeById(id);
      if (!existingCode) {
        return notFoundResponse(reply, "代码不存在");
      }

      // 检查名称是否已存在（同一父级下）
      if (data.name) {
        const parentId = data.parentId !== undefined ? data.parentId : existingCode.parentId;
        const nameExists = await isCodeNameExists(data.name, parentId, id);
        if (nameExists) {
          return validationErrorResponse(reply, "同级代码名称已存在");
        }
      }

      // 检查代码值是否已存在（同一父级下）
      if (data.value) {
        const parentId = data.parentId !== undefined ? data.parentId : existingCode.parentId;
        const valueExists = await isCodeValueExists(data.value, parentId, id);
        if (valueExists) {
          return validationErrorResponse(reply, "同级代码值已存在");
        }
      }

      try {
        const code = await updateCode(id, data);
        return successResponse(reply, code, "更新成功");
      } catch (error: any) {
        return validationErrorResponse(reply, error.message || "更新失败");
      }
    },
  );

  // 更新代码状态
  fastify.put<{ Params: { id: string }; Body: UpdateStatusDto }>(
    "/:id/status",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateStatusDto }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { status } = request.body;

      // 验证数据
      const result = updateStatusSchema.safeParse({ status });
      if (!result.success) {
        return validationErrorResponse(reply, "状态值无效");
      }

      // 检查代码是否存在
      const existingCode = await getCodeById(id);
      if (!existingCode) {
        return notFoundResponse(reply, "代码不存在");
      }

      const code = await updateCodeStatus(id, Number(status));
      return successResponse(reply, code, "状态更新成功");
    },
  );

  // 删除代码
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查代码是否存在
      const existingCode = await getCodeById(id);
      if (!existingCode) {
        return notFoundResponse(reply, "代码不存在");
      }

      try {
        await deleteCode(id);
        return successResponse(reply, null, "删除成功");
      } catch (error: any) {
        return validationErrorResponse(reply, error.message || "删除失败");
      }
    },
  );
}
