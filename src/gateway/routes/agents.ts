import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  AgentQuery,
  AgentNoExistsQuery,
  CreateAgentDto,
  UpdateAgentDto,
  BindUserDto,
} from "../../organization/agents/types.js";
import {
  createAgentSchema,
  updateAgentSchema,
  bindUserSchema,
} from "../../organization/agents/schema.js";
import {
  getAgentList,
  getAgentById,
  isAgentNoExists,
  createAgent,
  updateAgent,
  deleteAgent,
  bindUser,
  unbindUser,
} from "../../organization/agents/service.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

/**
 * 记录错误日志的辅助函数
 */
function logError(log: FastifyRequest["log"], error: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (log as any).error(error);
}

export default async function agentRoutes(fastify: FastifyInstance) {
  // 获取 Agent 列表（支持分页和筛选）
  fastify.get<{ Querystring: AgentQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: AgentQuery }>, reply: FastifyReply) => {
      try {
        const result = await getAgentList(request.query);
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

  // 更新 Agent Profile（偏好管理，使用 profile 字段）
  fastify.put<{ Params: { id: string }; Body: Record<string, any> }>(
    "/profile/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: Record<string, any> }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const data = request.body;

      // 检查 Agent 是否存在
      const existingAgent = await getAgentById(id);
      if (!existingAgent) {
        return notFoundResponse(reply, "Agent 不存在");
      }

      await updateAgent(id, { profile: data });
      return successResponse(reply, null, "更新成功");
    },
  );

  // 获取 Agent 详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const agent = await getAgentById(id);

      if (!agent) {
        return notFoundResponse(reply, "Agent 不存在");
      }

      return successResponse(reply, agent, "获取成功");
    },
  );

  // 创建 Agent
  fastify.post<{ Body: CreateAgentDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateAgentDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证数据
        const result = createAgentSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查 Agent 编号是否已存在
        const exists = await isAgentNoExists(data.agentNo);
        if (exists) {
          return validationErrorResponse(reply, "Agent 编号已存在");
        }

        const id = await createAgent(data);
        return successResponse(reply, { id }, "创建成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message?.includes("doesn't exist")) {
          return reply.status(500).send({
            code: "TABLE_NOT_EXISTS",
            message: "Agent 表不存在，请先初始化数据库",
            data: null,
          });
        }
        throw error;
      }
    },
  );

  // 更新 Agent
  fastify.put<{ Params: { id: string }; Body: UpdateAgentDto }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateAgentDto }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const data = request.body;

      // 检查 Agent 是否存在
      const existingAgent = await getAgentById(id);
      if (!existingAgent) {
        return notFoundResponse(reply, "Agent 不存在");
      }

      // 验证数据
      const result = updateAgentSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查 Agent 编号是否已存在（排除当前记录）
      if (data.agentNo && data.agentNo !== existingAgent.agentNo) {
        const exists = await isAgentNoExists(data.agentNo, id);
        if (exists) {
          return validationErrorResponse(reply, "Agent 编号已存在");
        }
      }

      await updateAgent(id, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除 Agent（逻辑删除）
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查 Agent 是否存在
      const existingAgent = await getAgentById(id);
      if (!existingAgent) {
        return notFoundResponse(reply, "Agent 不存在");
      }

      await deleteAgent(id);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 检查 Agent 编号是否存在
  fastify.get<{ Querystring: AgentNoExistsQuery }>(
    "/agent-no-exists",
    async (
      request: FastifyRequest<{ Querystring: AgentNoExistsQuery }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agentNo, id } = request.query;

        if (!agentNo) {
          return successResponse(reply, false, "检查完成");
        }

        const exists = await isAgentNoExists(agentNo, id);
        return successResponse(reply, exists, "检查完成");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 绑定用户（专属模式）
  fastify.post<{ Body: BindUserDto }>(
    "/bind-user",
    async (request: FastifyRequest<{ Body: BindUserDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证数据
        const result = bindUserSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查 Agent 是否存在
        const existingAgent = await getAgentById(data.agentId);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        await bindUser(data.agentId, data.userId);
        return successResponse(reply, null, "绑定成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 解绑用户
  fastify.post<{ Body: { agentId: string } }>(
    "/unbind-user",
    async (request: FastifyRequest<{ Body: { agentId: string } }>, reply: FastifyReply) => {
      try {
        const { agentId } = request.body;

        if (!agentId) {
          return validationErrorResponse(reply, "Agent ID 不能为空");
        }

        // 检查 Agent 是否存在
        const existingAgent = await getAgentById(agentId);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        await unbindUser(agentId);
        return successResponse(reply, null, "解绑成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );
}
