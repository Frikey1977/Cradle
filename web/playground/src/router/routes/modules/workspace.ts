import type { RouteRecordRaw } from "vue-router";
import { $t } from "#/locales";

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: "mdi:chat",
      order: 9995,
      title: $t("workspace.title"),
    },
    name: "Workspace",
    path: "/workspace",
    children: [
      {
        path: "/workspace/chat",
        name: "WorkspaceChat",
        meta: {
          icon: "mdi:message-text",
          title: $t("workspace.chat.title"),
        },
        component: () => import("#/views/workspace/chat/index.vue"),
      },
    ],
  },
];

export default routes;
