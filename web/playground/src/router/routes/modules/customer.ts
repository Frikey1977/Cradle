import type { RouteRecordRaw } from "vue-router";
import { $t } from "#/locales";

const routes: RouteRecordRaw[] = [
  {
    meta: {
      icon: "mdi:account-tie",
      order: 9995,
      title: $t("customer.title"),
    },
    name: "Customer",
    path: "/customer",
    children: [
      {
        path: "/customer/customers",
        name: "CustomerList",
        meta: {
          icon: "mdi:account-multiple",
          title: $t("customer.customers.title"),
        },
        component: () => import("#/views/customer/customers/list.vue"),
      },
      {
        path: "/customer/opportunities",
        name: "CustomerOpportunity",
        meta: {
          icon: "mdi:lightbulb-on",
          title: $t("customer.opportunities.title"),
        },
        component: () => import("#/views/customer/opportunities/list.vue"),
      },
      {
        path: "/customer/deals",
        name: "CustomerDeal",
        meta: {
          icon: "mdi:handshake",
          title: $t("customer.deals.title"),
        },
        component: () => import("#/views/customer/deals/list.vue"),
      },
      {
        path: "/customer/followups",
        name: "CustomerFollowup",
        meta: {
          icon: "mdi:phone-log",
          title: $t("customer.followups.title"),
        },
        component: () => import("#/views/customer/followups/list.vue"),
      },
    ],
  },
];

export default routes;
