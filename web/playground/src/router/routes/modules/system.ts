import type { RouteRecordRaw } from "vue-router";
import { $t } from "#/locales";

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: "ion:settings-outline",
      order: 9997,
      title: $t("system.title"),
    },
    name: "System",
    path: "/system",
    children: [
      {
        path: "/system/roles",
        name: "SystemRole",
        meta: {
          icon: "mdi:account-group",
          title: $t("system.roles.moduleName"),
        },
        component: () => import("#/views/system/roles/list.vue"),
      },
      {
        path: "/system/modules",
        name: "SystemModule",
        meta: {
          icon: "mdi:menu",
          title: $t("system.module.moduleName"),
        },
        component: () => import("#/views/system/modules/list.vue"),
      },
      {
        path: "/system/departments",
        name: "SystemDept",
        meta: {
          icon: "charm:organisation",
          title: $t("system.departments.moduleName"),
        },
        component: () => import("#/views/system/dept/list.vue"),
      },
      {
        path: "/system/codes",
        name: "SystemCodes",
        meta: {
          icon: "mdi:code-braces",
          title: $t("system.codes.moduleName"),
        },
        component: () => import("#/views/system/codes/list.vue"),
      },
      {
        path: "/system/users",
        name: "SystemUser",
        meta: {
          icon: "mdi:account-cog",
          title: $t("system.users.moduleName"),
        },
        component: () => import("#/views/system/users/list.vue"),
      },
      {
        path: "/system/channels",
        name: "SystemChannels",
        meta: {
          icon: "mdi:connection",
          title: $t("system.channels.moduleName"),
        },
        component: () => import("#/views/system/channels/list.vue"),
      },
      {
        path: "/system/skills",
        name: "SystemSkills",
        meta: {
          icon: "mdi:tools",
          title: $t("system.skills.moduleName"),
        },
        component: () => import("#/views/system/skills/list.vue"),
      },
    ],
  },
];

export default routes;
