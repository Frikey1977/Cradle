import type { RouteRecordRaw } from "vue-router";
import { $t } from "#/locales";

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: "charm:organisation",
      order: 9996,
      title: $t("organization.title"),
    },
    name: "Organization",
    path: "/organization",
    children: [
      {
        path: "/organization/departments",
        name: "OrganizationDept",
        meta: {
          icon: "mdi:office-building",
          title: $t("organization.departments.title"),
        },
        component: () => import("#/views/organization/departments/list.vue"),
      },
      {
        path: "/organization/employees",
        name: "OrganizationEmployee",
        meta: {
          icon: "mdi:account-group",
          title: $t("organization.employee.title"),
        },
        component: () => import("#/views/organization/employees/list.vue"),
      },
      {
        path: "/organization/positions",
        name: "OrganizationPosition",
        meta: {
          icon: "mdi:briefcase-account",
          title: $t("organization.position.title"),
        },
        component: () => import("#/views/organization/positions/list.vue"),
      },
      {
        path: "/organization/agents",
        name: "OrganizationAgent",
        meta: {
          icon: "mdi:robot",
          title: $t("organization.agents.title"),
        },
        component: () => import("#/views/organization/agents/list.vue"),
      },
      {
        path: "/organization/contacts",
        name: "OrganizationContact",
        meta: {
          icon: "mdi:account-box",
          title: $t("organization.contacts.title"),
        },
        component: () => import("#/views/organization/contacts/list.vue"),
      },
    ],
  },
];

export default routes;
