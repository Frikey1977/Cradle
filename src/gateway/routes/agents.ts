import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  AgentQuery,
  AgentNoExistsQuery,
  CreateAgentDto,
  UpdateAgentDto,
  BindUserDto,
  HeartbeatConfig,
  HeartbeatAction,
} from "../../organization/agents/types.js";
import {
  createAgentSchema,
  updateAgentSchema,
  bindUserSchema,
} from "../../organization/agents/schema.js";
import {
  getAgentList,
  getAgentById,
  getAgentsByUserId,
  isAgentNoExists,
  createAgent,
  updateAgent,
  deleteAgent,
  bindUser,
  unbindUser,
  updateHeartbeatConfig,
  getHeartbeatConfig,
} from "../../organization/agents/service.js";
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import { ContextManager } from "../../agent/context/context-manager.js";
import { query } from "../../store/database.js";
import {
  DatabaseProfileRepository,
  DatabaseLLMInstanceRepository,
} from "../../agent/context/repositories/index.js";
import "../shared/types.js";

/**
 * 记录错误日志的辅助函数
 */
function logError(log: FastifyRequest["log"], error: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (log as any).error(error);
}

export default async function agentRoutes(fastify: FastifyInstance) {
  // 获取当前登录用户绑定的 Agent 列表
  fastify.get(
    "/my/agents",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.sub;
        if (!userId) {
          return errorResponse(reply, 401, "未登录");
        }

        const agents = await getAgentsByUserId(userId);
        return successResponse(reply, { items: agents, total: agents.length }, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return successResponse(reply, { items: [], total: 0 }, "获取成功");
      }
    },
  );

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
          return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
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
        return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
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
          return validationErrorResponse(reply, result.error.issues[0]?.message || "数据验证失败");
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

  // 获取心跳配置
  fastify.get<{ Params: { id: string } }>(
    "/:id/heartbeat",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const existingAgent = await getAgentById(id);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        const config = await getHeartbeatConfig(id);
        return successResponse(reply, config, "获取成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 更新心跳配置
  fastify.put<{ Params: { id: string }; Body: HeartbeatConfig }>(
    "/:id/heartbeat",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: HeartbeatConfig }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const config = request.body;

        console.log(`[AgentRoutes] Updating heartbeat config: agent=${id}, config=`, JSON.stringify(config, null, 2));

        const existingAgent = await getAgentById(id);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        const existingConfig = await getHeartbeatConfig(id) || {};
        console.log(`[AgentRoutes] Existing config:`, JSON.stringify(existingConfig, null, 2));
        
        const mergedConfig = {
          ...existingConfig,
          ...config,
        };
        
        if (config.enabled !== undefined && !config.enabled) {
          mergedConfig.isRunning = false;
          mergedConfig.status = "idle";
        }
        
        console.log(`[AgentRoutes] Merged config:`, JSON.stringify(mergedConfig, null, 2));
        
        await updateHeartbeatConfig(id, mergedConfig);
        console.log(`[AgentRoutes] Heartbeat config saved to database`);
        
        return successResponse(reply, null, "更新成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 控制心跳（启动/停止/触发）
  fastify.post<{ Params: { id: string }; Body: { action: HeartbeatAction } }>(
    "/:id/heartbeat/control",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { action: HeartbeatAction } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const { action } = request.body;

        console.log(`[AgentRoutes] Received heartbeat control request: agent=${id}, action=${action}`);

        const existingAgent = await getAgentById(id);
        if (!existingAgent) {
          console.warn(`[AgentRoutes] Agent not found: ${id}`);
          return notFoundResponse(reply, "Agent 不存在");
        }

        const currentConfig = await getHeartbeatConfig(id) || {};
        
        if (action === "start") {
          currentConfig.isRunning = true;
          currentConfig.status = "running";
          await updateHeartbeatConfig(id, currentConfig);
          console.log(`[AgentRoutes] Heartbeat started: agent=${id}`);
        } else if (action === "stop") {
          currentConfig.isRunning = false;
          currentConfig.status = "idle";
          await updateHeartbeatConfig(id, currentConfig);
          console.log(`[AgentRoutes] Heartbeat stopped: agent=${id}`);
        } else if (action === "trigger") {
          console.log(`[AgentRoutes] Heartbeat triggered: agent=${id}`);
        }

        // 通过 HTTP 请求发送控制命令到 Gateway Master
        try {
          console.log(`[AgentRoutes] Sending heartbeat control to Gateway Master: action=${action}`);
          
          const gatewayMasterUrl = process.env.GATEWAY_MASTER_URL || "http://localhost:3000";
          const controlUrl = `${gatewayMasterUrl}/api/agent/${id}/heartbeat/control`;
          
          console.log(`[AgentRoutes] Calling Gateway Master API: ${controlUrl}`);
          
          const response = await fetch(controlUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action,
              config: currentConfig,
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`[AgentRoutes] Gateway Master response:`, result);
          } else {
            const errorText = await response.text();
            console.warn(`[AgentRoutes] Gateway Master returned error: ${response.status} ${errorText}`);
          }
        } catch (masterError) {
          console.warn(`[AgentRoutes] Failed to notify Gateway Master:`, masterError);
        }

        return successResponse(reply, { agentId: id, action }, "控制命令已发送");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 获取心跳状态
  fastify.get<{ Params: { id: string } }>(
    "/:id/heartbeat/status",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;

        const existingAgent = await getAgentById(id);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        const config = await getHeartbeatConfig(id);
        const status = {
          agentId: id,
          enabled: config?.enabled || false,
          isRunning: config?.isRunning || false,
          lastRunAt: config?.lastRunAt || null,
          nextDueAt: config?.nextDueAt || null,
          status: config?.status || "idle",
        };

        return successResponse(reply, status, "获取成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 获取心跳日志
  fastify.get<{ Params: { id: string }; Querystring: { limit?: number } }>(
    "/:id/heartbeat/logs",
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { limit?: number } }>,
      reply: FastifyReply,
    ) => {
      try {
        const { id } = request.params;
        const { limit = 20 } = request.query;

        const existingAgent = await getAgentById(id);
        if (!existingAgent) {
          return notFoundResponse(reply, "Agent 不存在");
        }

        const { getHeartbeatLogRepository } = await import("../../store/repositories/heartbeat-logs.js");
        const repo = await getHeartbeatLogRepository();
        const logs = await repo.getRecentByAgent(id, limit);

        console.log("[API] Heartbeat logs from DB:", logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          timestampType: typeof log.timestamp,
        })));

        const formattedLogs = logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp,
          agentId: log.agentId,
          agentName: log.agentName,
          type: log.type,
          prompt: log.prompt,
          result: log.result,
          error: log.error,
          nextDueAt: log.nextDueAt,
        }));

        console.log("[API] Heartbeat logs formatted:", formattedLogs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
        })));

        return successResponse(reply, formattedLogs, "获取成功");
      } catch (error) {
        logError(request.log, error);
        throw error;
      }
    },
  );

  // 注册客户端（用于接收心跳消息等推送）
  fastify.post<{ Params: { id: string }; Body: { contactId: string } }>(
    "/:id/client/register",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { contactId: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { contactId } = request.body;

      if (!contactId) {
        return errorResponse(reply, 400, "contactId is required");
      }

      try {
        // 获取 Gateway Master 地址
        const gatewayMasterUrl = process.env.GATEWAY_MASTER_URL || "http://localhost:3000";
        const controlUrl = `${gatewayMasterUrl}/api/agent/${id}/client/register`;

        console.log(`[AgentRoutes] Registering client for agent ${id}: contactId=${contactId}`);

        // 发送请求到 Gateway Master
        const response = await fetch(controlUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AgentRoutes] Failed to register client: ${errorText}`);
          return errorResponse(reply, response.status, `Failed to register client: ${errorText}`);
        }

        const result = await response.json();
        console.log(`[AgentRoutes] Client registered successfully:`, result);

        return successResponse(reply, result.data, "客户端注册成功");
      } catch (error) {
        logError(request.log, error);
        return errorResponse(reply, 500, `注册客户端失败: ${error}`);
      }
    },
  );

  // 注销客户端
  fastify.post<{ Params: { id: string }; Body: { contactId: string } }>(
    "/:id/client/unregister",
    async (request: FastifyRequest<{ Params: { id: string }; Body: { contactId: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { contactId } = request.body;

      if (!contactId) {
        return errorResponse(reply, 400, "contactId is required");
      }

      try {
        // 获取 Gateway Master 地址
        const gatewayMasterUrl = process.env.GATEWAY_MASTER_URL || "http://localhost:3000";
        const controlUrl = `${gatewayMasterUrl}/api/agent/${id}/client/unregister`;

        console.log(`[AgentRoutes] Unregistering client for agent ${id}: contactId=${contactId}`);

        // 发送请求到 Gateway Master
        const response = await fetch(controlUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AgentRoutes] Failed to unregister client: ${errorText}`);
          return errorResponse(reply, response.status, `Failed to unregister client: ${errorText}`);
        }

        const result = await response.json();
        console.log(`[AgentRoutes] Client unregistered successfully:`, result);

        return successResponse(reply, result.data, "客户端注销成功");
      } catch (error) {
        logError(request.log, error);
        return errorResponse(reply, 500, `注销客户端失败: ${error}`);
      }
    },
  );

  // 获取原始上下文
  fastify.get<{ Params: { id: string }; Querystring: { contactId?: string; conversationId?: string } }>(
    "/:id/raw-context",
    async (request: FastifyRequest<{ Params: { id: string }; Querystring: { contactId?: string; conversationId?: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { contactId, conversationId } = request.query;

      console.log(`[AgentRoutes] Getting raw context for agent ${id}, contactId=${contactId}`);

      try {
        // 获取 Agent 详情
        const agent = await getAgentById(id);
        if (!agent) {
          return errorResponse(reply, 404, "Agent not found");
        }

        // 获取 Agent 配置
        const agentConfig = agent.config || {};

        // 创建 Repository 实例
        const profileRepo = new DatabaseProfileRepository(query);
        const llmInstanceRepo = new DatabaseLLMInstanceRepository(query);

        // 创建 ContextManager 实例
        const contextManager = new ContextManager(id, profileRepo, llmInstanceRepo);

        // 如果有 contactId，初始化记忆管理器
        if (contactId) {
          await contextManager.initializeMemoryManager(contactId, conversationId);
        }

        // 构建上下文
        const context = await contextManager.build({
          agentId: id,
          contactId: contactId || "",
          content: "",
          conversationId,
        });

        // 转换工具格式，使其更易读
        const formattedTools = context.availableTools?.map((tool: any) => ({
          name: tool.function?.name || tool.name || "unnamed",
          description: tool.function?.description || tool.description || "",
          parameters: tool.function?.parameters || tool.parameters || {},
          type: tool.type || "function",
        })) || [];

        // 构建实际发送到LLM的请求体（与Agent运行时一致）
        const systemMessages = context.systemMessages
          ? context.systemMessages.map((block: any) => ({ role: "system" as const, content: block.content }))
          : [{ role: "system" as const, content: context.systemPrompt }];

        const llmRequestBody = {
          model: {
            ...(context.modelConfig.instanceId
              ? { instanceId: context.modelConfig.instanceId }
              : { provider: context.modelConfig.provider, model: context.modelConfig.model }),
            parameters: {
              temperature: context.modelConfig.parameters?.temperature ?? 0.7,
              maxTokens: context.modelConfig.parameters?.maxTokens ?? 4096,
            },
          },
          messages: [
            ...systemMessages,
            ...context.conversationHistory,
          ],
          tools: context.availableTools,
        };

        // 返回可序列化的上下文数据
        const rawContext = {
          // 实际LLM请求体（最常用）
          llmRequestBody,

          // 原始组件（供参考）
          systemPrompt: context.systemPrompt,
          systemMessages: context.systemMessages,
          modelConfig: context.modelConfig,
          conversationHistory: context.conversationHistory,
          memories: context.memories,
          availableTools: formattedTools,
          metadata: context.metadata,
          contactName: context.contactName,
          environment: context.environment,
        };

        console.log(`[AgentRoutes] Raw context built successfully for agent ${id}`);
        return successResponse(reply, rawContext, "获取原始上下文成功");
      } catch (error) {
        console.error(`[AgentRoutes] Failed to get raw context:`, error);
        return errorResponse(reply, 500, `获取原始上下文失败: ${error}`);
      }
    },
  );
}
