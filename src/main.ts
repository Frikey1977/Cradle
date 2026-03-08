/**
 * Cradle 后端服务入口文件
 *
 * 启动 Fastify HTTP 服务器，提供 REST API 服务
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import { registerRoutes } from "./gateway/routes/index.js";
import { authenticate } from "./gateway/shared/auth.js";

const PORT = parseInt(process.env.PORT || "5320", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const fastify = Fastify({
    logger: true,
  });

  // 注册 CORS 插件
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // 注册 Cookie 插件
  await fastify.register(cookie);

  // 注册 JWT 插件
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "your-secret-key",
    cookie: {
      cookieName: "token",
      signed: false,
    },
  });

  // 添加认证装饰器
  fastify.decorate("authenticate", authenticate);

  // 注册路由
  await registerRoutes(fastify);

  // 启动服务器
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`Server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
