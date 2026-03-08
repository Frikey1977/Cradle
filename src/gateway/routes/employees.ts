import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type {
  EmployeeQuery,
  EmployeeNoExistsQuery,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from "../../organization/employees/types.js";
import { createEmployeeSchema, updateEmployeeSchema } from "../../organization/employees/schema.js";
import {
  getEmployeeList,
  getEmployeeById,
  isEmployeeNoExists,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../../organization/employees/service.js";
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

export default async function employeeRoutes(fastify: FastifyInstance) {
  // 获取员工列表（支持分页和筛选）
  fastify.get<{ Querystring: EmployeeQuery }>(
    "/",
    async (request: FastifyRequest<{ Querystring: EmployeeQuery }>, reply: FastifyReply) => {
      try {
        const result = await getEmployeeList(request.query);
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

  // 获取员工详情
  fastify.get<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const employee = await getEmployeeById(id);

      if (!employee) {
        return notFoundResponse(reply, "员工不存在");
      }

      return successResponse(reply, employee, "获取成功");
    },
  );

  // 创建员工
  fastify.post<{ Body: CreateEmployeeDto }>(
    "/",
    async (request: FastifyRequest<{ Body: CreateEmployeeDto }>, reply: FastifyReply) => {
      try {
        const data = request.body;

        // 验证数据
        const result = createEmployeeSchema.safeParse(data);
        if (!result.success) {
          return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
        }

        // 检查工号是否已存在
        if (data.employeeNo) {
          const exists = await isEmployeeNoExists(data.employeeNo);
          if (exists) {
            return validationErrorResponse(reply, "员工工号已存在");
          }
        }

        const id = await createEmployee(data);
        return successResponse(reply, { id }, "创建成功");
      } catch (error) {
        logError(request.log, error);
        if (error instanceof Error && error.message?.includes("doesn't exist")) {
          return reply.status(500).send({
            code: "TABLE_NOT_EXISTS",
            message: "员工表不存在，请先初始化数据库",
            data: null,
          });
        }
        throw error;
      }
    },
  );

  // 更新员工
  fastify.put<{ Params: { id: string }; Body: UpdateEmployeeDto }>(
    "/:id",
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateEmployeeDto }>,
      reply: FastifyReply,
    ) => {
      const { id } = request.params;
      const data = request.body;

      // 检查员工是否存在
      const existingEmployee = await getEmployeeById(id);
      if (!existingEmployee) {
        return notFoundResponse(reply, "员工不存在");
      }

      // 验证数据
      const result = updateEmployeeSchema.safeParse(data);
      if (!result.success) {
        return validationErrorResponse(reply, result.error.errors[0]?.message || "数据验证失败");
      }

      // 检查工号是否已存在（排除当前记录）
      if (data.employeeNo && data.employeeNo !== existingEmployee.employeeNo) {
        const exists = await isEmployeeNoExists(data.employeeNo, id);
        if (exists) {
          return validationErrorResponse(reply, "员工工号已存在");
        }
      }

      await updateEmployee(id, data);
      return successResponse(reply, null, "更新成功");
    },
  );

  // 删除员工（逻辑删除）
  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // 检查员工是否存在
      const existingEmployee = await getEmployeeById(id);
      if (!existingEmployee) {
        return notFoundResponse(reply, "员工不存在");
      }

      await deleteEmployee(id);
      return successResponse(reply, null, "删除成功");
    },
  );

  // 检查工号是否存在
  fastify.get<{ Querystring: EmployeeNoExistsQuery }>(
    "/employee-no-exists",
    async (
      request: FastifyRequest<{ Querystring: EmployeeNoExistsQuery }>,
      reply: FastifyReply,
    ) => {
      const { employeeNo, id } = request.query;

      if (!employeeNo) {
        return successResponse(reply, false, "检查完成");
      }

      const exists = await isEmployeeNoExists(employeeNo, id);
      return successResponse(reply, exists, "检查完成");
    },
  );
}
