import type { RouteRecordRaw } from "vue-router";
import { $t } from "#/locales";

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: "carbon:machine-learning",
      order: 9996,
      title: $t("llm.title"),
    },
    name: "Llm",
    path: "/llm",
    children: [
      {
        path: "/llm/providers",
        name: "LlmProvider",
        meta: {
          icon: "carbon:cloud-service-management",
          title: $t("llm.providers.moduleName"),
        },
        component: () => import("#/views/llm/providers/list.vue"),
      },
      {
        path: "/llm/instances",
        name: "LlmInstance",
        meta: {
          icon: "carbon:key",
          title: $t("llm.instances.moduleName"),
        },
        component: () => import("#/views/llm/instances/list.vue"),
      },
    ],
  },
];

export default routes;
