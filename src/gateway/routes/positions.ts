import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  PositionQuery,
  PositionCodeExistsQuery,
  CreatePositionDto,
  UpdatePositionDto,
} from "../../organization/positions/types.js";
import {
  createPositionSchema,
  updatePositionSchema,
} from "../../organization/positions/schema.js";
import {
  getPositionList,
  getPositionById,
  isPositionCodeExists,
  hasAssociatedEmployees,
  createPosition,
  updatePosition,
  deletePosition,
  getPositionSkills,
  savePositionSkills,
} from "../../organization/positions/service.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

/**
 * 记录错误日志的辅助函数
 * Fastify 的 logger 类型定义不完整，需要类型断言
 */
function logError(log: FastifyRequest["log"], error: unknown): void {
  // Fastify 使用 pino 作为 logger，但类型定义不完整
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (log as any).error(error);
}

export default async function positionRoutes(fastify: FastifyInstance) {
  // 获取岗位列表（支持分页和筛选）
  fastify.get<{ Querystring: PositionQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: PositionQuery }>, reply: FastifyReply) => {
      try {
        const result = await getPositionList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        logError(request.log, error);
        // 如果表不存在，返回空数据
        return successResponse(
          reply,
          {
            items: [],
            total: 0,
            page: 1,
            pageSize: 20,
          },
          "获取成功",
        );
      }
    },
  );

  // 获取岗位详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const position = await getPositionById(id);

      if (!position) {
        return notFoundResponse(reply, "岗位不存在");
      }

      return successResponse(reply, position, "获取成功");
    },
  );

  // 创建岗位
  fastify.post<{ Body: CreatePositionDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreatePositionDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证数据
        const result = createPositionSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查岗位编码是否已存在
        const exists = await isPositionCodeExists(data.code, data.oid);
        if (exists) {
          return validationErrorResponse(reply, "岗位编码已存在");
        }

        const id = await createPosition(data);
        return successResponse(reply, { id }, "创建成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message?.includes("doesn't exist")) {
          return reply.status(500).send({
            code: "TABLE_NOT_EXISTS",
            message: "岗位表不存在，请先初始化数据库",
            data: null,
          });
        }
        throw error;
      }
    },
  );

  // 更新岗位
  fastify.put<{ Params: { id: string }; Body: UpdatePositionDto }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdatePositionDto }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const data = request.body;

      // 检查岗位是否存在
      const existingPosition = await getPositionById(id);
      if (!existingPosition) {
        return notFoundResponse(reply, "岗位不存在");
      }

      // 验证数据
      const result = updatePositionSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查岗位编码是否已存在（排除当前记录）
      if (data.code && data.code !== existingPosition.code) {
        const exists = await isPositionCodeExists(data.code, id);
        if (exists) {
          return validationErrorResponse(reply, "岗位编码已存在");
        }
      }

      await updatePosition(id, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除岗位（逻辑删除）
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查岗位是否存在
      const existingPosition = await getPositionById(id);
      if (!existingPosition) {
        return notFoundResponse(reply, "岗位不存在");
      }

      // 检查是否有关联员工
      const hasEmployees = await hasAssociatedEmployees(id);
      if (hasEmployees) {
        return validationErrorResponse(reply, "该岗位下有关联员工，无法删除");
      }

      await deletePosition(id);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 检查岗位编码是否存在
  fastify.get<{ Querystring: PositionCodeExistsQuery & { oid: string } }>(
    "/code-exists",
    async (
      request: FastifyRequest<{ Querystring: PositionCodeExistsQuery & { oid: string } }>,
      reply: FastifyReply,
    ) => {
      const { code, oid, id } = request.query;

      if (!code || !oid) {
        return successResponse(reply, false, "检查完成");
      }

      const exists = await isPositionCodeExists(code, oid, id);
      return successResponse(reply, exists, "检查完成");
    },
  );

  // 获取岗位关联的技能列表
  fastify.get<{ Params: { id: string } }>(
    "/:id/skills",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查岗位是否存在
      const position = await getPositionById(id);
      if (!position) {
        return notFoundResponse(reply, "岗位不存在");
      }

      try {
        const skills = await getPositionSkills(id);
        return successResponse(reply, skills, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return successResponse(reply, [], "获取成功");
      }
    },
  );

  // 保存岗位关联的技能
  fastify.put<{ Params: { id: string }; Body: { skills: import("../../organization/positions/types.js").PositionSkill[] } }>(
    "/:id/skills",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { skills: import("../../organization/positions/types.js").PositionSkill[] } }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const { skills } = request.body;

      // 检查岗位是否存在
      const position = await getPositionById(id);
      if (!position) {
        return notFoundResponse(reply, "岗位不存在");
      }

      // 仅 agent 类型岗位可以配置技能
      if (position.type !== "agent") {
        return validationErrorResponse(reply, "仅 Agent 类型岗位可以配置技能");
      }

      try {
        await savePositionSkills(id, skills || []);
        return successResponse(reply, null, "保存成功");
      } catch (error) {
        logError(request.log, error);
        return validationErrorResponse(reply, "保存技能失败");
      }
    },
  );
}
