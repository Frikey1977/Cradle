import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { successResponse, errorResponse } from "../shared/response.js";
import {
  getLLMLogRepository,
  type LLMLogsQuery,
} from "../../store/repositories/llm-logs.js";

/**
 * 日志查询参数
 */
interface LogsQuery {
  page?: number;
  pageSize?: number;
  date?: string;
  type?: "request" | "response" | "error";
  source?: string;
  model?: string;
  provider?: string;
  agentName?: string;
  keyword?: string;
}

/**
 * 统计查询参数
 */
interface StatsQuery {
  date?: string;
  groupBy?: "model" | "provider" | "agent" | "source";
}

export default async function (fastify: FastifyInstance) {
  /**
   * 获取可用的日志日期列表
   */
  fastify.get("/dates", async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const repo = await getLLMLogRepository();
      const dates = await repo.getAvailableDates();
      return successResponse(reply, { dates }, "获取成功");
    } catch (error) {
      console.error("[Logs] Failed to get dates:", error);
      return errorResponse(reply, 500, "获取日期列表失败");
    }
  });

  /**
   * 获取日志列表
   */
  fastify.get("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as LogsQuery;

    try {
      const repo = await getLLMLogRepository();
      const result = await repo.query({
        page: query.page || 1,
        pageSize: Math.min(query.pageSize || 20, 100),
        date: query.date,
        type: query.type,
        source: query.source as any,
        model: query.model,
        provider: query.provider,
        agentName: query.agentName,
        keyword: query.keyword,
      });

      return successResponse(reply, result, "获取成功");
    } catch (error) {
      console.error("[Logs] Failed to query logs:", error);
      return errorResponse(reply, 500, "查询日志失败");
    }
  });

  /**
   * 获取日志统计
   */
  fastify.get("/stats", async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as StatsQuery;

    try {
      const repo = await getLLMLogRepository();
      const db = (repo as any).db;

      const date = query.date || new Date().toISOString().slice(0, 10);
      const groupBy = query.groupBy || "model";

      let groupColumn = "model";
      if (groupBy === "provider") groupColumn = "provider";
      else if (groupBy === "agent") groupColumn = "agent_name";
      else if (groupBy === "source") groupColumn = "source";

      const stats = await db.query(
        `SELECT 
          ${groupColumn} as name,
          COUNT(*) as total,
          SUM(CASE WHEN type = 'response' THEN 1 ELSE 0 END) as success_count,
          SUM(CASE WHEN type = 'error' THEN 1 ELSE 0 END) as error_count,
          AVG(CASE WHEN type = 'response' THEN duration ELSE NULL END) as avg_duration,
          SUM(CASE WHEN type = 'response' THEN token_total ELSE 0 END) as total_tokens
        FROM t_llm_logs 
        WHERE log_date = ?
        GROUP BY ${groupColumn}
        ORDER BY total DESC`,
        [date]
      );

      const summaryResult = await db.queryOne(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN type = 'response' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN type = 'error' THEN 1 ELSE 0 END) as errors,
          AVG(CASE WHEN type = 'response' THEN duration ELSE NULL END) as avg_duration,
          SUM(CASE WHEN type = 'response' THEN token_total ELSE 0 END) as total_tokens
        FROM t_llm_logs 
        WHERE log_date = ?`,
        [date]
      );

      const summary = summaryResult as any;

      return successResponse(
        reply,
        {
          date,
          groupBy,
          stats,
          summary: {
            total: summary?.total || 0,
            success: summary?.success || 0,
            errors: summary?.errors || 0,
            avgDuration: Math.round(summary?.avg_duration || 0),
            totalTokens: summary?.total_tokens || 0,
          },
        },
        "获取成功"
      );
    } catch (error) {
      console.error("[Logs] Failed to get stats:", error);
      return errorResponse(reply, 500, "获取统计失败");
    }
  });

  /**
   * 获取单条日志详情
   */
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { id: string };
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return errorResponse(reply, 400, "无效的日志ID");
    }

    try {
      const repo = await getLLMLogRepository();
      const db = (repo as any).db;

      const row = await db.queryOne(
        `SELECT * FROM t_llm_logs WHERE id = ?`,
        [id]
      );

      if (!row) {
        return errorResponse(reply, 404, "日志不存在");
      }

      const entry = {
        id: row.id,
        timestamp: new Date(row.timestamp),
        type: row.type,
        model: row.model,
        provider: row.provider,
        instanceId: row.instance_id,
        source: row.source,
        agentName: row.agent_name,
        contactName: row.contact_name,
        worktaskId: row.worktask_id,
        duration: row.duration,
        hasToolCalls: row.has_tool_calls === 1 || row.has_tool_calls === true,
        requestBody: row.request_body ? JSON.parse(row.request_body) : undefined,
        responseData: row.response_data ? JSON.parse(row.response_data) : undefined,
        error: row.error,
        tokenPrompt: row.token_prompt,
        tokenCompletion: row.token_completion,
        tokenTotal: row.token_total,
      };

      return successResponse(reply, entry, "获取成功");
    } catch (error) {
      console.error("[Logs] Failed to get log detail:", error);
      return errorResponse(reply, 500, "获取日志详情失败");
    }
  });

  /**
   * 删除指定日期的日志
   */
  fastify.delete("/:date", async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { date: string };

    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return errorResponse(reply, 400, "无效的日期格式");
    }

    try {
      const repo = await getLLMLogRepository();
      const deleted = await repo.deleteByDate(params.date);

      console.log(`[Logs] Deleted ${deleted} logs for date: ${params.date}`);
      return successResponse(reply, { deleted }, "删除成功");
    } catch (error) {
      console.error("[Logs] Failed to delete logs:", error);
      return errorResponse(reply, 500, "删除失败");
    }
  });

  /**
   * 清理旧日志（保留最近30天）
   */
  fastify.post("/cleanup", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { keepDays?: number } | undefined;
    const keepDays = body?.keepDays || 30;

    try {
      const repo = await getLLMLogRepository();
      const deleted = await repo.cleanupOldLogs(keepDays);

      console.log(`[Logs] Cleanup completed: deleted ${deleted} old logs`);
      return successResponse(reply, { deleted, keepDays }, "清理完成");
    } catch (error) {
      console.error("[Logs] Failed to cleanup logs:", error);
      return errorResponse(reply, 500, "清理失败");
    }
  });
}
