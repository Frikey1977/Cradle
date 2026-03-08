import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { query } from "../../store/database.js";
import "../shared/types.js";
import { successResponse } from "../shared/response.js";

interface MenuItem {
  id: string;
  name: string;
  path: string;
  component: string;
  pid: string;
  type?: string;
  show?: boolean;
  meta: {
    title: string;
    icon?: string;
    order: number;
    isClickGoToSelf?: boolean;
    isHide?: boolean;
    isKeepAlive?: boolean;
    isAffix?: boolean;
    isTab?: boolean;
    frameSrc?: string;
    iframeSrc?: string;
    link?: string;
    roles?: string[];
    permissions?: string[];
  };
  children?: MenuItem[];
}

export default async function menuRoutes(fastify: FastifyInstance) {
  fastify.get("/all", async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await query<
      {
        id: string;
        name: string;
        title: string;
        type: string;
        path: string;
        component: string;
        pid: string;
        meta_json: string;
        icon: string;
      }[]
    >(
      `SELECT sid as id, name, title, type, path, component, pid, meta as meta_json, icon 
       FROM t_modules WHERE deleted = 0 AND status = 'enabled' ORDER BY sort ASC`,
    );

    const menuItems: MenuItem[] = rows.map((row) => {
      let meta: MenuItem["meta"] = {
        title: row.title || row.name,
        icon: row.icon || "mdi:folder",
        order: 1,
      };

      try {
        if (row.meta_json) {
          let parsed;
          if (typeof row.meta_json === "string") {
            parsed = JSON.parse(row.meta_json);
          } else {
            // 如果已经是对象，直接使用
            parsed = row.meta_json;
          }
          console.log(`[DEBUG] Module ${row.name} meta parsed:`, parsed);
          meta = { ...meta, ...parsed };
          console.log(`[DEBUG] Module ${row.name} meta after merge:`, meta);
        }
      } catch (e) {
        console.error(`[DEBUG] Failed to parse meta for ${row.name}:`, e);
      }

      // action 类型的模块完全不在菜单中显示
      const isAction = row.type === "action";

      // 如果有子菜单且自身有 component，点击时打开自己的页面
      // 注意：只计算非 action 类型的子模块，因为 action 不会在菜单中显示
      const childItems = rows.filter((r) => r.pid === row.id && r.type !== "action");
      const hasChildren = childItems.length > 0;
      const isClickGoToSelf = hasChildren && !!row.component;

      // 设置 redirect 指向自己的 path，阻止框架自动设置为第一个子菜单
      const redirect = isClickGoToSelf ? row.path : undefined;

      // 处理 embedded 和 link 类型的组件
      let component = row.component || "";
      if (row.type === "embedded") {
        component = "IFrameView";
      }

      const result = {
        id: row.id,
        name: row.name,
        path: row.path || "",
        component,
        pid: row.pid || "0",
        type: row.type,
        show: !isAction,
        redirect,
        meta: {
          title: meta.title,
          icon: meta.icon,
          order: meta.order,
          isClickGoToSelf,
          iframeSrc: meta.iframeSrc || meta.frameSrc,
          link: meta.link,
        },
      };
      console.log(`[DEBUG] Module ${row.name} final result meta:`, result.meta);
      return result;
    });

    // 构建菜单树
    const menuTree = buildMenuTree(menuItems);

    return successResponse(reply, menuTree, "获取成功");
  });
}

function buildMenuTree(items: MenuItem[]): MenuItem[] {
  const map = new Map<string, MenuItem>();
  const roots: MenuItem[] = [];

  // 先过滤掉不显示的项
  const visibleItems = items.filter((item) => item.show !== false);

  visibleItems.forEach((item) => {
    map.set(item.id, { ...item, children: [] });
  });

  visibleItems.forEach((item) => {
    const node = map.get(item.id)!;
    if (item.pid === "0" || !item.pid) {
      roots.push(node);
    } else {
      const parent = map.get(item.pid);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}
