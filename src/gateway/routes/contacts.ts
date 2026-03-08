import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  ContactQuery,
  ContactExistsQuery,
  CreateContactDto,
  UpdateContactDto,
} from "../../organization/contact/types.js";
import { createContactSchema, updateContactSchema } from "../../organization/contact/schema.js";
import {
  getContactList,
  getContactById,
  isContactExists,
  createContact,
  updateContact,
  deleteContact,
  getContactByUserId,
} from "../../organization/contact/service.js";
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse, internalErrorResponse } from "../shared/response.js";
import { getPool } from "../../store/database.js";
import "../shared/types.js";

/**
 * 记录错误日志的辅助函数
 */
function logError(log: FastifyRequest["log"], error: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (log as any).error(error);
}

export default async function contactRoutes(fastify: FastifyInstance) {
  // 获取联系人列表（支持分页和筛选）
  fastify.get<{ Querystring: ContactQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: ContactQuery }>, reply: FastifyReply) => {
      try {
        const result = await getContactList(request.query);
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

  // 创建联系人
  fastify.post<{ Body: CreateContactDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateContactDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证数据
        const result = createContactSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查联系人是否已存在（非访客类型）
        if (data.type !== "visitor") {
          const exists = await isContactExists(data.type, data.sourceId);
          if (exists) {
            return validationErrorResponse(reply, "该类型的联系人已存在");
          }
        }

        const sid = await createContact(data);
        return successResponse(reply, { sid }, "创建成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message?.includes("doesn't exist")) {
          return reply.status(500).send({
            code: "TABLE_NOT_EXISTS",
            message: "联系人表不存在，请先初始化数据库",
            data: null,
          });
        }
        throw error;
      }
    },
  );

  // 检查联系人是否存在
  fastify.get<{ Querystring: ContactExistsQuery }>(
    "/exists",
    async (
      request: FastifyRequest<{ Querystring: ContactExistsQuery }>,
      reply: FastifyReply,
    ) => {
      const { type, sourceId, sid } = request.query;

      if (!type) {
        return validationErrorResponse(reply, "类型参数不能为空");
      }

      const exists = await isContactExists(type, sourceId, sid);
      return successResponse(reply, exists, "检查完成");
    },
  );

  // ========== 偏好管理路由（使用 profile 字段）==========

  // 获取联系人 profile
  fastify.get(
    "/profile/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        const pool = await getPool();

        const [rows] = await pool.execute(
          "SELECT profile FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return notFoundResponse(reply, "联系人不存在");
        }

        const profile = (rows as any[])[0].profile;
        return successResponse(reply, profile ? JSON.parse(profile) : {});
      } catch (error: any) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取偏好管理失败");
      }
    }
  );

  // 更新联系人 profile
  fastify.put(
    "/profile/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: { profile: Record<string, any> } }>, reply: FastifyReply) => {
      try {
        const { sid } = request.params;
        const { profile } = request.body;

        const pool = await getPool();

        // 检查联系人是否存在
        const [rows] = await pool.execute(
          "SELECT sid FROM t_contacts WHERE sid = ?",
          [sid]
        );

        if ((rows as any[]).length === 0) {
          return notFoundResponse(reply, "联系人不存在");
        }

        // 更新 profile
        await pool.execute(
          "UPDATE t_contacts SET profile = ? WHERE sid = ?",
          [JSON.stringify(profile), sid]
        );

        return successResponse(reply, { profile });
      } catch (error: any) {
        logError(request.log, error);
        return internalErrorResponse(reply, "更新偏好管理失败");
      }
    }
  );

  // 获取联系人详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const contact = await getContactById(sid);

      if (!contact) {
        return notFoundResponse(reply, "联系人不存在");
      }

      return successResponse(reply, contact, "获取成功");
    },
  );

  // 更新联系人（必须放在独立字段路由之后）
  fastify.put<{ Params: { sid: string }; Body: UpdateContactDto }>(
    "/:sid",
    async (
      request: FastifyRequest<{ Params: { sid: string }; Body: UpdateContactDto }>,
      reply: FastifyReply,
    ) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查联系人是否存在
      const existingContact = await getContactById(sid);
      if (!existingContact) {
        return notFoundResponse(reply, "联系人不存在");
      }

      // 验证数据
      const result = updateContactSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查联系人是否已存在（如果修改了 type 或 sourceId）
      if ((data.type || data.sourceId !== undefined) && data.type !== "visitor") {
        const newType = data.type || existingContact.type;
        const newSourceId = data.sourceId !== undefined ? data.sourceId : existingContact.sourceId;
        const exists = await isContactExists(newType, newSourceId, sid);
        if (exists) {
          return validationErrorResponse(reply, "该类型的联系人已存在");
        }
      }

      await updateContact(sid, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除联系人（逻辑删除）
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查联系人是否存在
      const existingContact = await getContactById(sid);
      if (!existingContact) {
        return notFoundResponse(reply, "联系人不存在");
      }

      await deleteContact(sid);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 获取当前登录用户的联系人信息
  fastify.get(
    "/my/contact",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = (request.user as any)?.sub;
        if (!userId) {
          return errorResponse(reply, 401, "未登录");
        }

        const contact = await getContactByUserId(userId);
        if (!contact) {
          return notFoundResponse(reply, "未找到关联的联系人");
        }

        return successResponse(reply, contact, "获取成功");
      } catch (error) {
        logError(request.log, error);
        return internalErrorResponse(reply, "获取联系人信息失败");
      }
    },
  );
}
