/**
 * 系统技能路由
 * 对应设计文档: design/system/database/t_skills.md
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  getSkillList,
  getAllSkills,
  getSkillTree,
  getSkillById,
  isSlugExists,
  createSkill,
  updateSkill,
  deleteSkill,
  isSkillExists,
  getSkillFileTree,
  getSkillFileContent,
  type FileTreeNode,
} from "../../system/skills/service.js";
import {
  createSkillSchema,
  updateSkillSchema,
  skillTreeQuerySchema,
} from "../../system/skills/schema.js";
import type {
  SkillQuery,
  SkillTreeQuery,
  SlugExistsQuery,
  CreateSkillDto,
  UpdateSkillDto,
} from "../../system/skills/types.js";
import { successResponse, errorResponse, validationErrorResponse, notFoundResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function skillsRoutes(fastify: FastifyInstance) {
  // 获取技能列表（分页）
  fastify.get<{ Querystring: SkillQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: SkillQuery }>, reply: FastifyReply) => {
      try {
        const result = await getSkillList(request.query);
        return successResponse(reply, result, "获取成功");
      } catch (error) {
        console.error("获取技能列表失败:", error);
        return errorResponse(reply, 500, `获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  // 获取所有技能（不分页，树形结构）
  fastify.get<{ Querystring: SkillTreeQuery }>(
    "/tree",
    async (request: FastifyRequest<{ Querystring: SkillTreeQuery }>, reply: FastifyReply) => {
      const result = await getSkillTree(request.query);
      return successResponse(reply, result, "获取成功");
    },
  );

  // 获取技能详情
  fastify.get<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const skill = await getSkillById(sid);

      if (!skill) {
        return notFoundResponse(reply, "技能不存在");
      }

      return successResponse(reply, skill, "获取成功");
    },
  );

  // 创建技能
  fastify.post<{ Body: CreateSkillDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateSkillDto }>, reply: FastifyReply) => {
      const data = request.body;

      // 验证数据
      const result = createSkillSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查 slug 是否已存在
      const slugExists = await isSlugExists(data.slug);
      if (slugExists) {
        return validationErrorResponse(reply, "技能标识符已存在");
      }

      const sid = await createSkill(data);
      return successResponse(reply, { sid }, "创建成功");
    },
  );

  // 更新技能
  fastify.put<{ Params: { sid: string }; Body: UpdateSkillDto }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string }; Body: UpdateSkillDto }>, reply: FastifyReply) => {
      const { sid } = request.params;
      const data = request.body;

      // 检查技能是否存在
      const existingSkill = await getSkillById(sid);
      if (!existingSkill) {
        return notFoundResponse(reply, "技能不存在");
      }

      // 验证数据
      const result = updateSkillSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查 slug 是否已存在（排除当前记录）
      if (data.slug && data.slug !== existingSkill.slug) {
        const slugExists = await isSlugExists(data.slug, sid);
        if (slugExists) {
          return validationErrorResponse(reply, "技能标识符已存在");
        }
      }

      await updateSkill(sid, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除技能
  fastify.delete<{ Params: { sid: string } }>(
    "/:sid",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查技能是否存在
      const existingSkill = await getSkillById(sid);
      if (!existingSkill) {
        return notFoundResponse(reply, "技能不存在");
      }

      await deleteSkill(sid);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 检查 slug 是否存在
  fastify.get<{ Querystring: SlugExistsQuery }>(
    "/slug-exists",
    async (request: FastifyRequest<{ Querystring: SlugExistsQuery }>, reply: FastifyReply) => {
      const { slug, excludeSid } = request.query;

      if (!slug) {
        return successResponse(reply, false, "检查完成");
      }

      const exists = await isSlugExists(slug, excludeSid);
      return successResponse(reply, exists, "检查完成");
    },
  );

  // 获取技能文件树
  fastify.get<{ Params: { sid: string } }>(
    "/:sid/file-tree",
    async (request: FastifyRequest<{ Params: { sid: string } }>, reply: FastifyReply) => {
      const { sid } = request.params;

      // 检查技能是否存在
      const skill = await getSkillById(sid);
      if (!skill) {
        return notFoundResponse(reply, "技能不存在");
      }

      try {
        const tree = await getSkillFileTree(skill.slug);
        return successResponse(reply, tree, "获取成功");
      } catch (error) {
        console.error("获取文件树失败:", error);
        return errorResponse(reply, 500, `获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  // 获取技能文件内容
  fastify.get<{ Querystring: { path: string } }>(
    "/file-content",
    async (request: FastifyRequest<{ Querystring: { path: string } }>, reply: FastifyReply) => {
      const { path: filePath } = request.query;

      if (!filePath) {
        return validationErrorResponse(reply, "文件路径不能为空");
      }

      try {
        const content = await getSkillFileContent(filePath);
        return successResponse(reply, content, "获取成功");
      } catch (error) {
        console.error("获取文件内容失败:", error);
        return errorResponse(reply, 500, `获取失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
