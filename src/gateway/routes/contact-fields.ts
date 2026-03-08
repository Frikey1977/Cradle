/**
 * 联系人字段独立更新路由
 * 用于 Agent 自主更新联系人信息
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getPool } from "../../store/database.js";
import { successResponse, internalErrorResponse } from "../shared/response.js";

/**
 * 注册联系人字段更新路由
 */
export default async function (fastify: FastifyInstance) {
  // 更新联系人 facts
  fastify.put(
    "/:sid/facts",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: { facts: Record<string, any> } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        const { facts } = request.body;

        const pool = await getPool();

        // 检查联系人是否存在
        const [rows] = await pool.execute(
          "SELECT sid FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        // 更新 facts
        await pool.execute(
          "UPDATE t_contacts SET facts = ? WHERE sid = ?",
          [JSON.stringify(facts), sid]
        );

        return successResponse(reply, { facts });
      } catch (error: any) {
        console.error("[updateContactFacts] Error:", error);
        return internalErrorResponse(reply, "更新基本事实失败");
      }
    }
  );

  // 更新联系人 preferences
  fastify.put(
    "/:sid/preferences",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: { preferences: Record<string, any> } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        const { preferences } = request.body;

        const pool = await getPool();

        // 检查联系人是否存在
        const [rows] = await pool.execute(
          "SELECT sid FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        // 更新 preferences
        await pool.execute(
          "UPDATE t_contacts SET preferences = ? WHERE sid = ?",
          [JSON.stringify(preferences), sid]
        );

        return successResponse(reply, { preferences });
      } catch (error: any) {
        console.error("[updateContactPreferences] Error:", error);
        return internalErrorResponse(reply, "更新个人偏好失败");
      }
    }
  );

  // 更新联系人 short_term_memory
  fastify.put(
    "/:sid/short-term-memory",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: { shortTermMemory: Record<string, any> } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        const { shortTermMemory } = request.body;

        const pool = await getPool();

        // 检查联系人是否存在
        const [rows] = await pool.execute(
          "SELECT sid FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        // 更新 short_term_memory
        await pool.execute(
          "UPDATE t_contacts SET short_term_memory = ? WHERE sid = ?",
          [JSON.stringify(shortTermMemory), sid]
        );

        return successResponse(reply, { shortTermMemory });
      } catch (error: any) {
        console.error("[updateContactShortTermMemory] Error:", error);
        return internalErrorResponse(reply, "更新短期记忆失败");
      }
    }
  );

  // 获取联系人 facts
  fastify.get(
    "/:sid/facts",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;

        const pool = await getPool();

        const [rows] = await pool.execute(
          "SELECT facts FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        const facts = (rows as any[])[0].facts;
        return successResponse(reply, facts ? JSON.parse(facts) : {});
      } catch (error: any) {
        console.error("[getContactFacts] Error:", error);
        return internalErrorResponse(reply, "获取基本事实失败");
      }
    }
  );

  // 获取联系人 preferences
  fastify.get(
    "/:sid/preferences",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;

        const pool = await getPool();

        const [rows] = await pool.execute(
          "SELECT preferences FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        const preferences = (rows as any[])[0].preferences;
        return successResponse(reply, preferences ? JSON.parse(preferences) : {});
      } catch (error: any) {
        console.error("[getContactPreferences] Error:", error);
        return internalErrorResponse(reply, "获取个人偏好失败");
      }
    }
  );

  // 获取联系人 short_term_memory
  fastify.get(
    "/:sid/short-term-memory",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;

        const pool = await getPool();

        const [rows] = await pool.execute(
          "SELECT short_term_memory FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return reply.status(404).send({
            success: false,
            error: "联系人不存在",
          });
        }

        const shortTermMemory = (rows as any[])[0].short_term_memory;
        return successResponse(reply, shortTermMemory ? JSON.parse(shortTermMemory) : {});
      } catch (error: any) {
        console.error("[getContactShortTermMemory] Error:", error);
        return internalErrorResponse(reply, "获取短期记忆失败");
      }
    }
  );
}
