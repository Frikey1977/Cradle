import type { FastifyRequest, FastifyReply } from "fastify";

import { unauthorizedResponse } from "./response.js";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return unauthorizedResponse(reply, "未登录或登录已过期");
  }
}
