import type { FastifyInstance } from "fastify";

import { successResponse } from "../shared/response.js";
import "../shared/types.js";

export default async function timezoneRoutes(fastify: FastifyInstance) {
  fastify.get("/timezone/getTimezone", async (_request, reply) => {
    return successResponse(reply, {
      timezone: "Asia/Shanghai",
      timeZoneOffset: 8,
    }, "获取成功");
  });
}
