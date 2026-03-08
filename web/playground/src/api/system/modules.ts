import type { Recordable } from "@vben/types";
import { requestClient } from "#/api/request";

export namespace SystemModuleApi {
  export const BadgeVariants = ["default", "destructive", "primary", "success", "warning"] as const;
  export const BadgeTypes = ["dot", "normal"] as const;
  export const ModuleTypes = ["module", "function", "embedded", "link", "action"] as const;

  export interface SystemModule {
    [key: string]: any;
    sid: string;
    auth_code?: string;
    children?: SystemModule[];
    component?: string;
    meta?: {
      activeIcon?: string;
      activePath?: string;
      affixTab?: boolean;
      affixTabOrder?: number;
      badge?: string;
      badgeType?: (typeof BadgeTypes)[number];
      badgeVariants?: (typeof BadgeVariants)[number];
      hideChildrenInMenu?: boolean;
      hideInBreadcrumb?: boolean;
      hideInMenu?: boolean;
      hideInTab?: boolean;
      icon?: string;
      iframeSrc?: string;
      keepAlive?: boolean;
      link?: string;
      maxNumOfOpenTab?: number;
      noBasicLayout?: boolean;
      openInNewWindow?: boolean;
      order?: number;
      query?: Recordable<any>;
      title?: string;
    };
    name: string;
    path: string;
    pid: string;
    redirect?: string;
    status?: string;
    sort?: number;
    title?: string;
    type: (typeof ModuleTypes)[number];
  }
}

async function getModuleList() {
  return requestClient.get<any[]>("/system/modules");
}

async function getModuleChildren(sid: string) {
  return requestClient.get<any[]>(`/system/modules/${sid}/children`);
}

async function isModuleNameExists(name: string, sid?: string) {
  return requestClient.get<boolean>("/system/modules/name-exists", {
    params: { id: sid, name },
  });
}

async function isModulePathExists(path: string, sid?: string) {
  return requestClient.get<boolean>("/system/modules/path-exists", {
    params: { id: sid, path },
  });
}

async function createModule(data: Omit<SystemModuleApi.SystemModule, "children" | "sid">) {
  return requestClient.post("/system/modules", data);
}

async function updateModule(
  sid: string,
  data: Omit<SystemModuleApi.SystemModule, "children" | "sid">,
) {
  return requestClient.put(`/system/modules/${sid}`, data);
}

async function deleteModule(sid: string) {
  return requestClient.delete(`/system/modules/${sid}`);
}

export {
  createModule,
  deleteModule,
  getModuleChildren,
  getModuleList,
  isModuleNameExists,
  isModulePathExists,
  updateModule,
};
