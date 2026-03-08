import type { FastifyRequest, FastifyReply } from "fastify";

import { errorResponse } from "./response.js";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    errorResponse(reply, 401, "未登录或登录已过期");
  }
}
