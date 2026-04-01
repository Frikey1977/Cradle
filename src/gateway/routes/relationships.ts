/**
 * Agent-Contact 关系管理路由
 * 对应设计文档: design/memory/database/t_relationship.md
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  BindAgentEmployeeDto,
  RelationshipQuery,
  UpdateRelationshipDto,
} from "../../organization/relationships/types.js";
import {
  getAgentContacts,
  getAgentMemoryContacts,
  bindAgentToEmployee,
  unbindAgentContact,
  getRelationshipList,
  updateRelationship,
  deleteRelationship,
  getShortTermMemory,
  updateShortTermMemory,
} from "../../organization/relationships/service.js";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  notFoundResponse,
  internalErrorResponse,
} from "../shared/response.js";
import "../shared/types.js";

/**
 * 记录错误日志的辅助函数
 */
function logError(log: FastifyRequest["log"], error: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (log as any).error(error);
}

export default async function relationshipRoutes(fastify: FastifyInstance) {
  // 获取 Agent 的记忆联系人列表（用于记忆管理 Tab）
  fastify.get<{ Params: { agentId: string } }>(
    "/memory-contacts/agent/:agentId",
    async (request: FastifyRequest<{ Params: { agentId: string } }>, reply: FastifyReply) => {
      try {
        const { agentId } = request.params;
        const contacts = await getAgentMemoryContacts(agentId);
        return successResponse(reply, contacts, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取记忆联系人列表失败");
      }
    },
  );

  // 获取 Agent 绑定的联系人列表 - 注意：特定路径要在通用路径之前定义
  fastify.get<{ Params: { agentId: string } }>(
    "/contacts/agent/:agentId",
    async (request: FastifyRequest<{ Params: { agentId: string } }>, reply: FastifyReply) => {
      try {
        const { agentId } = request.params;
        const contacts = await getAgentContacts(agentId);
        return successResponse(reply, contacts, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取联系人列表失败");
      }
    },
  );

  // 绑定 Agent 到员工
  fastify.post<{ Body: BindAgentEmployeeDto }>(
    "/bind",
    async (request: FastifyRequest<{ Body: BindAgentEmployeeDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证必填字段
        if (!data.agentId) {
          return validationErrorResponse(reply, "Agent ID 不能为空");
        }
        if (!data.employeeId) {
          return validationErrorResponse(reply, "员工 ID 不能为空");
        }

        const binding = await bindAgentToEmployee(data);
        return successResponse(reply, binding, "绑定成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error) {
          if (error.message.includes("已绑定")) {
            return validationErrorResponse(reply, error.message);
          }
          if (error.message.includes("不存在")) {
            return notFoundResponse(reply, error.message);
          }
        }
        return internalErrorResponse(reply, "绑定失败");
      }
    },
  );

  // 解绑 Agent 和 Contact
  fastify.delete<{ Params: { agentId: string; contactId: string } }>(
    "/agent/:agentId/contact/:contactId",
    async (
      request: FastifyRequest<{ Params: { agentId: string; contactId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agentId, contactId } = request.params;
        await unbindAgentContact(agentId, contactId);
        return successResponse(reply, null, "解绑成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message.includes("不存在")) {
          return notFoundResponse(reply, "绑定关系不存在");
        }
        return internalErrorResponse(reply, "解绑失败");
      }
    },
  );

  // 获取关系列表
  fastify.get<{ Querystring: RelationshipQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: RelationshipQuery }>, reply: FastifyReply) => {
      try {
        const result = await getRelationshipList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取关系列表失败");
      }
    },
  );

  // 更新关系
  fastify.put<{ Params: { sid: string }; Body: UpdateRelationshipDto }>(
    "/:sid",
    async (
      request: FastifyRequest<{ Params: { sid: string }; Body: UpdateRelationshipDto }>,
      reply: FastifyReply,
    ) => {
      try {
        const { sid } = request.params;
        await updateRelationship(sid, request.body);
        return successResponse(reply, null, "更新成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message.includes("不存在")) {
          return notFoundResponse(reply, "关系不存在");
        }
        return internalErrorResponse(reply, "更新失败");
      }
    },
  );

  // 删除关系
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        await deleteRelationship(sid);
        return successResponse(reply, null, "删除成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message.includes("不存在")) {
          return notFoundResponse(reply, "关系不存在");
        }
        return internalErrorResponse(reply, "删除失败");
      }
    },
  );

  // 获取短期记忆（对话历史）
  fastify.get<{ Params: { agentId: string; contactId: string } }>(
    "/:agentId/:contactId/short-term-memory",
    async (
      request: FastifyRequest<{ Params: { agentId: string; contactId: string } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agentId, contactId } = request.params;
        const memory = await getShortTermMemory(agentId, contactId);
        return successResponse(reply, memory, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取短期记忆失败");
      }
    },
  );

  // 更新短期记忆（对话历史）
  fastify.put<{ Params: { agentId: string; contactId: string }; Body: { shortTermMemory: any[] } }>(
    "/:agentId/:contactId/short-term-memory",
    async (
      request: FastifyRequest<{ Params: { agentId: string; contactId: string }; Body: { shortTermMemory: any[] } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { agentId, contactId } = request.params;
        const { shortTermMemory } = request.body;
        await updateShortTermMemory(agentId, contactId, shortTermMemory);
        return successResponse(reply, null, "更新成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "更新短期记忆失败");
      }
    },
  );
}
