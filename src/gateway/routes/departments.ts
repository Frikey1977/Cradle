import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getOrgTree,
  getOrgList,
  getOrgById,
  isOrgCodeExists,
  createOrg,
  updateOrg,
  deleteOrg,
  moveOrg,
  hasChildren,
  isOrgExists,
} from "../../organization/departments/service.js";
import {
  createOrgSchema,
  updateOrgSchema,
  moveOrgSchema,
} from "../../organization/departments/schema.js";
import type {
  OrgQuery,
  CodeExistsQuery,
  CreateOrgDto,
  UpdateOrgDto,
  MoveOrgDto,
} from "../../organization/departments/types.js";
import { successResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function departmentsRoutes(fastify: FastifyInstance) {
  // 获取组织架构树
  fastify.get<{ Querystring: OrgQuery }>(
    "/tree",
    async (request: FastifyRequest<{ Querystring: OrgQuery }>, reply: FastifyReply) => {
      try {
        const tree = await getOrgTree(request.query);
        return successResponse(reply, tree, "获取成功");
      } catch (error) {
        request.log.error(error);
        // 如果表不存在，返回空数组
        return successResponse(reply, [], "获取成功");
      }
    },
  );

  // 获取组织架构列表（扁平结构）
  fastify.get<{ Querystring: OrgQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: OrgQuery }>, reply: FastifyReply) => {
      const list = await getOrgList(request.query);
      return successResponse(reply, list, "获取成功");
    },
  );

  // 获取组织架构详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const org = await getOrgById(sid);

      if (!org) {
        return notFoundResponse(reply, "组织不存在");
      }

      return successResponse(reply, org, "获取成功");
    },
  );

  // 创建组织架构
  fastify.post<{ Body: CreateOrgDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateOrgDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createOrgSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查编码是否已存在
      const codeExists = await isOrgCodeExists(data.code);
      if (codeExists) {
        return validationErrorResponse(reply, "组织编码已存在");
      }

      // 检查父组织是否存在
      if (data.parentId) {
        const parentExists = await isOrgExists(data.parentId);
        if (!parentExists) {
          return validationErrorResponse(reply, "父组织不存在");
        }
      }

      const sid = await createOrg(data);
      return successResponse(reply, { sid }, "创建成功");
    },
  );

  // 更新组织架构
  fastify.put<{ Params: { sid: string }; Body: UpdateOrgDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateOrgDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查组织是否存在
      const existingOrg = await getOrgById(sid);
      if (!existingOrg) {
        return notFoundResponse(reply, "组织不存在");
      }

      // 验证数据
      const result = updateOrgSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查编码是否已存在（排除当前记录）
      if (data.code && data.code !== existingOrg.code) {
        const codeExists = await isOrgCodeExists(data.code, sid);
        if (codeExists) {
          return validationErrorResponse(reply, "组织编码已存在");
        }
      }

      await updateOrg(sid, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除组织架构
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查组织是否存在
      const existingOrg = await getOrgById(sid);
      if (!existingOrg) {
        return notFoundResponse(reply, "组织不存在");
      }

      // 检查是否有子组织
      const hasChildOrgs = await hasChildren(sid);
      if (hasChildOrgs) {
        return validationErrorResponse(reply, "该组织下存在子组织，无法删除");
      }

      await deleteOrg(sid);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 移动组织架构
  fastify.put<{ Params: { sid: string }; Body: MoveOrgDto }>(
    "/:sid/move",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: MoveOrgDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 验证数据
      const result = moveOrgSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 不能移动到自己下面
      if (data.parentId === sid) {
        return validationErrorResponse(reply, "不能将组织移动到自己下面");
      }

      // 检查目标父组织是否存在
      if (data.parentId) {
        const parentExists = await isOrgExists(data.parentId);
        if (!parentExists) {
          return validationErrorResponse(reply, "目标父组织不存在");
        }
      }

      await moveOrg(sid, data);
      return successResponse(reply, null, "移动成功");
    },
  );

  // 检查组织编码是否存在
  fastify.get<{ Querystring: CodeExistsQuery }>(
    "/code-exists",
    async (request: FastifyRequest<{ Querystring: CodeExistsQuery }>, reply: FastifyReply) => {
      const { code, sid } = request.query;

      if (!code) {
        return successResponse(reply, false, "检查完成");
      }

      const exists = await isOrgCodeExists(code, sid);
      return successResponse(reply, exists, "检查完成");
    },
  );
}
