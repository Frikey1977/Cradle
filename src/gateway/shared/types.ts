// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import "@fastify/jwt";

export interface JwtPayload {
  sub: string;
  username: string;
  employeeId?: string;
}

// 扩展 FastifyJWT 命名空间
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

// 扩展 Fastify 类型声明
declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply, done: () => void) => void;
  }
}
