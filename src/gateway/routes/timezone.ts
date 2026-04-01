import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { successResponse, errorResponse, validationErrorResponse } from "../shared/response.js";
import { getContactById, updateContact } from "../../organization/contact/service.js";
import "../shared/types.js";

// 常用时区列表
const TIMEZONE_OPTIONS = [
  { label: "UTC", value: "UTC" },
  { label: "北京/上海 (UTC+8)", value: "Asia/Shanghai" },
  { label: "东京 (UTC+9)", value: "Asia/Tokyo" },
  { label: "首尔 (UTC+9)", value: "Asia/Seoul" },
  { label: "新加坡 (UTC+8)", value: "Asia/Singapore" },
  { label: "香港 (UTC+8)", value: "Asia/Hong_Kong" },
  { label: "台北 (UTC+8)", value: "Asia/Taipei" },
  { label: "纽约 (UTC-5)", value: "America/New_York" },
  { label: "洛杉矶 (UTC-8)", value: "America/Los_Angeles" },
  { label: "伦敦 (UTC+0)", value: "Europe/London" },
  { label: "巴黎 (UTC+1)", value: "Europe/Paris" },
  { label: "柏林 (UTC+1)", value: "Europe/Berlin" },
  { label: "莫斯科 (UTC+3)", value: "Europe/Moscow" },
  { label: "悉尼 (UTC+11)", value: "Australia/Sydney" },
  { label: "墨尔本 (UTC+11)", value: "Australia/Melbourne" },
  { label: "迪拜 (UTC+4)", value: "Asia/Dubai" },
  { label: "孟买 (UTC+5:30)", value: "Asia/Kolkata" },
  { label: "曼谷 (UTC+7)", value: "Asia/Bangkok" },
  { label: "雅加达 (UTC+7)", value: "Asia/Jakarta" },
  { label: "河内 (UTC+7)", value: "Asia/Ho_Chi_Minh" },
];

export default async function timezoneRoutes(fastify: FastifyInstance) {
  // 获取支持的时区列表
  fastify.get("/timezone/getTimezoneOptions", async (_request, reply) => {
    return successResponse(reply, TIMEZONE_OPTIONS, "获取成功");
  });

  // 获取当前时区设置
  fastify.get("/timezone/getTimezone", async (_request, reply) => {
    return successResponse(reply, {
      timezone: "Asia/Shanghai",
      timeZoneOffset: 8,
    }, "获取成功");
  });

  // 设置用户时区（保存到联系人 profile）
  fastify.post<{ Body: { timezone: string; contactId?: string } }>(
    "/timezone/setTimezone",
    async (request: FastifyRequest<{ Body: { timezone: string; contactId?: string } }>, reply: FastifyReply) => {
      try {
        const { timezone, contactId } = request.body;

        if (!timezone) {
          return validationErrorResponse(reply, "时区不能为空");
        }

        // 如果有 contactId，保存到联系人 profile
        if (contactId) {
          const contact = await getContactById(contactId);
          if (!contact) {
            return errorResponse(reply, 404, "联系人不存在");
          }

          // 更新联系人 profile
          const profile = contact.profile || {};
          profile.timezone = timezone;

          await updateContact(contactId, { profile });
        }

        return successResponse(reply, { timezone }, "时区设置已保存");
      } catch (error) {
        console.error("[TimezoneRoutes] Failed to set timezone:", error);
        return errorResponse(reply, 500, "保存时区设置失败");
      }
    }
  );
}
