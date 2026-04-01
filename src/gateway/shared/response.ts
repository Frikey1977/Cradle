import type { FastifyReply } from "fastify";

export interface ResponseData<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

export function successResponse<T = any>(
  reply: FastifyReply,
  data: T,
  message = "操作成功",
): FastifyReply {
  const response: ResponseData<T> = {
    code: 0,
    message,
    data,
    timestamp: Date.now(),
  };
  return reply.send(response);
}

export function errorResponse(
  reply: FastifyReply,
  code: number,
  message: string,
  data: any = null,
): FastifyReply {
  const response: ResponseData = {
    code,
    message,
    data,
    timestamp: Date.now(),
  };
  return reply.code(code >= 400 ? code : 500).send(response);
}

export function validationErrorResponse(reply: FastifyReply, message: string): FastifyReply {
  return errorResponse(reply, 400, message, null);
}

export function unauthorizedResponse(
  reply: FastifyReply,
  message = "未登录或登录已过期",
): FastifyReply {
  return errorResponse(reply, 401, message, null);
}

export function forbiddenResponse(reply: FastifyReply, message = "权限不足"): FastifyReply {
  return errorResponse(reply, 403, message, null);
}

export function notFoundResponse(reply: FastifyReply, message: string): FastifyReply {
  return errorResponse(reply, 404, message, null);
}

export function conflictResponse(reply: FastifyReply, message: string): FastifyReply {
  return errorResponse(reply, 409, message, null);
}

export function internalErrorResponse(
  reply: FastifyReply,
  message = "服务器内部错误",
): FastifyReply {
  return errorResponse(reply, 500, message, null);
}
