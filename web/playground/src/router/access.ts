import type { ComponentRecordType, GenerateMenuAndRoutesOptions } from "@vben/types";
import { getAllMenusApi } from "#/api";
import { BasicLayout, IFrameView } from "#/layouts";
import { $t } from "#/locales";
import { generateAccessible } from "@vben/access";
import { message } from "ant-design-vue";

const forbiddenComponent = () => import("#/views/_core/fallback/forbidden.vue");

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  //const accessMode = "mixed";
  const accessMode = "backend";
  const pageMap: ComponentRecordType = import.meta.glob("../views/**/*.vue");

  const layoutMap: ComponentRecordType = {
    BasicLayout,
    IFrameView,
  };

  return await generateAccessible(accessMode, {
    ...options,
    fetchMenuListAsync: async () => {
      message.loading({
        content: `${$t("common.loadingMenu")}...`,
        duration: 1.5,
      });
      return await getAllMenusApi();
    },
    // 可以指定没有权限跳转403页面
    forbiddenComponent,
    // 如果 route.meta.menuVisibleWithForbidden = true
    layoutMap,
    pageMap,
  });
}

export { generateAccess };
