import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { batchSyncTranslations, syncTranslation } from "../../system/translation/service.js";

// 请求体类型定义
interface SyncTranslationBody {
  key: string;
  values?: {
    zh?: string;
    en?: string;
  };
}

interface BatchSyncTranslationBody {
  items: Array<{
    key: string;
    values?: {
      zh?: string;
      en?: string;
    };
  }>;
}

/**
 * 翻译同步路由
 * 用于自动同步代码管理中的翻译键到多语言文件
 */
export default async function (fastify: FastifyInstance) {
  // 同步单个翻译
  fastify.post(
    "/sync",
    {
      schema: {
        body: z.object({
          key: z.string().min(1, "Translation key is required"),
          values: z.object({
            zh: z.string().optional(),
            en: z.string().optional(),
          }).optional(),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Body: SyncTranslationBody }>, reply: FastifyReply) => {
      const { key, values } = request.body;
      const result = syncTranslation(key, values);
      return reply.send(result);
    }
  );

  // 批量同步翻译
  fastify.post(
    "/batch-sync",
    {
      schema: {
        body: z.object({
          items: z.array(z.object({
            key: z.string().min(1, "Translation key is required"),
            values: z.object({
              zh: z.string().optional(),
              en: z.string().optional(),
            }).optional(),
          })),
        }),
        response: {
          200: z.object({
            success: z.boolean(),
            results: z.array(z.object({
              key: z.string(),
              success: z.boolean(),
              message: z.string(),
            })),
          }),
        },
      },
    },
    async (request: FastifyRequest<{ Body: BatchSyncTranslationBody }>, reply: FastifyReply) => {
      const { items } = request.body;
      const result = batchSyncTranslations(items);
      return reply.send(result);
    }
  );
}
