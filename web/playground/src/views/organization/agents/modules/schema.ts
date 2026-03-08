import type { VbenFormSchema } from "#/adapter/form";
import type { OrganizationApi } from "#/api/organization/departments";
import type { OrganizationPositionApi } from "#/api/organization/positions";

import { z } from "#/adapter/form";
import { getOrgTree } from "#/api/organization/departments";
import { getPositionList } from "#/api/organization/positions";
import { $t } from "#/locales";
import { IconifyIcon } from "@vben/icons";
import { h } from "vue";

/**
 * 翻译组织架构树中的 title 字段，并处理显示标签（带图标）
 * @param orgs - 组织架构列表
 * @returns 翻译后的组织架构列表
 */
function translateOrgTree(orgs: OrganizationApi.Organization[]): any[] {
  return orgs.map((org) => ({
    ...org,
    title: org.icon
      ? h("div", { class: "flex items-center gap-2" }, [
          h(IconifyIcon, { icon: org.icon, class: "size-4 flex-shrink-0" }),
          h("span", org.title ? $t(org.title as any) : ""),
        ])
      : org.title
        ? $t(org.title as any)
        : "",
    children: org.children ? translateOrgTree(org.children) : undefined,
  }));
}

/**
 * 获取组织架构树（带翻译）
 */
async function getOrgTreeWithTranslation() {
  const data = await getOrgTree();
  return translateOrgTree(data);
}

/**
 * 基本信息表单配置
 * @param patternOptions - 服务模式选项（从代码配置获取）
 * @param onOrgChange - 组织变更回调
 */
export function useBasicInfoSchema(
  patternOptions: { label: string; value: string }[] = [],
  onOrgChange?: (oid: string) => Promise<void>,
): VbenFormSchema[] {
  return [
    {
      component: "ApiTreeSelect",
      componentProps: {
        allowClear: true,
        api: getOrgTreeWithTranslation,
        class: "w-full",
        childrenField: "children",
        labelField: "title",
        treeDefaultExpandAll: true,
        valueField: "sid",
      },
      fieldName: "oid",
      label: $t("organization.agents.orgName"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.agents.orgName")])),
    },
    {
      component: "Select",
      componentProps: {
        allowClear: true,
        class: "w-full",
        disabled: true,
        options: [],
        placeholder: $t("organization.agents.selectOrgFirst"),
      },
      dependencies: {
        triggerFields: ["oid"],
        trigger: (value, actions) => {
          if (value?.oid) {
            actions.setFieldValue("positionId", undefined);
            if (onOrgChange) {
              onOrgChange(value.oid);
            }
          }
        },
      },
      fieldName: "positionId",
      label: $t("organization.agents.positionName"),
      rules: z.string().optional(),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: patternOptions.length > 0 ? patternOptions : [
          { label: $t("organization.agents.serviceModeExclusive"), value: "exclusive" },
          { label: $t("organization.agents.serviceModeShared"), value: "shared" },
          { label: $t("organization.agents.serviceModePublic"), value: "public" },
          { label: $t("organization.agents.serviceModeDepartment"), value: "department" },
        ],
        optionType: "button",
      },
      defaultValue: "exclusive",
      fieldName: "mode",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.agents.serviceMode"),
      rules: z.string().min(1, $t("ui.formRules.required", [$t("organization.agents.serviceMode")])),
    },
    {
      component: "Input",
      fieldName: "name",
      label: $t("organization.agents.name"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.agents.name")]))
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.name"), 200])),
    },
    {
      component: "Input",
      fieldName: "eName",
      label: $t("organization.agents.eName"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.eName"), 200]))
        .optional(),
    },
    {
      component: "Input",
      fieldName: "title",
      label: $t("organization.agents.title"),
      rules: z
        .string()
        .max(200, $t("ui.formRules.maxLength", [$t("organization.agents.title"), 200]))
        .optional(),
    },
    {
      component: "Input",
      fieldName: "agentNo",
      label: $t("organization.agents.agentNo"),
      rules: z
        .string()
        .min(1, $t("ui.formRules.required", [$t("organization.agents.agentNo")]))
        .max(100, $t("ui.formRules.maxLength", [$t("organization.agents.agentNo"), 100])),
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.avatarPlaceholder"),
      },
      fieldName: "avatar",
      label: $t("organization.agents.avatar"),
      rules: z.string().max(500, $t("ui.formRules.maxLength", [$t("organization.agents.avatar"), 500])).optional(),
    },
    {
      component: "Textarea",
      componentProps: {
        maxLength: 1000,
        rows: 4,
        showCount: true,
      },
      fieldName: "description",
      formItemClass: "col-span-2",
      controlClass: "w-full",
      label: $t("organization.agents.description"),
      rules: z.string().max(1000, $t("ui.formRules.maxLength", [$t("organization.agents.description"), 1000])).optional(),
    },
    {
      component: "RadioGroup",
      componentProps: {
        buttonStyle: "solid",
        options: [
          { label: $t("common.enabled"), value: "enabled" },
          { label: $t("common.disabled"), value: "disabled" },
        ],
        optionType: "button",
      },
      defaultValue: "enabled",
      fieldName: "status",
      label: $t("organization.agents.status"),
    },
  ];
}

/**
 * 偏好管理表单配置（JSON textarea，使用 profile 字段）
 */
export function useProfileSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        placeholder: $t("organization.agents.profilePlaceholder"),
        rows: 20,
        class: "w-full font-mono",
      },
      fieldName: "profile",
      label: "",
      rules: z.string().optional().refine(
        (val) => {
          if (!val) return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        },
        { message: $t("organization.agents.invalidJson") }
      ),
    },
  ];
}

/**
 * 模型配置表单配置（JSON textarea，使用 config 字段）
 * 与偏好管理tab呈现形式一致
 */
export function useModelConfigSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        placeholder: $t("organization.agents.modelConfigPlaceholder"),
        rows: 20,
        class: "w-full font-mono",
      },
      fieldName: "config",
      label: "",
      rules: z.string().optional().refine(
        (val) => {
          if (!val) return true;
          try {
            JSON.parse(val);
            return true;
          } catch {
            return false;
          }
        },
        { message: $t("organization.agents.invalidJson") }
      ),
    },
  ];
}

/**
 * 灵魂/人格描述表单配置（纯文本 textarea，使用 soul 字段）
 * 与偏好管理tab呈现形式一致
 */
export function useSoulSchema(): VbenFormSchema[] {
  return [
    {
      component: "Textarea",
      componentProps: {
        placeholder: $t("organization.agents.soulPlaceholder"),
        rows: 20,
        class: "w-full",
        maxlength: 600,
        showCount: true,
      },
      fieldName: "soul",
      label: "",
      rules: z.string().max(600, $t("organization.agents.soulMaxLength")).optional(),
    },
  ];
}

/**
 * 技能配置表单配置
 */
export function useSkillsSchema(): VbenFormSchema[] {
  return [
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.skillsPlaceholder"),
      },
      fieldName: "skills",
      label: $t("organization.agents.skills"),
      rules: z.array(z.string()).optional(),
    },
  ];
}

/**
 * Owner表单配置 - 已废弃，使用新的联系人绑定方式
 * @deprecated
 */
export function useOwnerSchema(): VbenFormSchema[] {
  return [];
}

/**
 * 通道配置表单配置（IM Channel）
 */
export function useChannelSchema(): VbenFormSchema[] {
  return [
    {
      component: "Switch",
      fieldName: "wechat.enabled",
      label: $t("organization.agents.channels.wechat"),
      defaultValue: false,
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.channels.wechatWebhookPlaceholder"),
      },
      fieldName: "wechat.webhook",
      label: $t("organization.agents.channels.wechatWebhook"),
      rules: z.string().max(500).optional(),
      dependencies: {
        triggerFields: ["wechat.enabled"],
        show: (values) => values?.wechat?.enabled,
      },
    },
    {
      component: "Switch",
      fieldName: "dingtalk.enabled",
      label: $t("organization.agents.channels.dingtalk"),
      defaultValue: false,
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.channels.dingtalkWebhookPlaceholder"),
      },
      fieldName: "dingtalk.webhook",
      label: $t("organization.agents.channels.dingtalkWebhook"),
      rules: z.string().max(500).optional(),
      dependencies: {
        triggerFields: ["dingtalk.enabled"],
        show: (values) => values?.dingtalk?.enabled,
      },
    },
    {
      component: "Switch",
      fieldName: "slack.enabled",
      label: $t("organization.agents.channels.slack"),
      defaultValue: false,
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.channels.slackWebhookPlaceholder"),
      },
      fieldName: "slack.webhook",
      label: $t("organization.agents.channels.slackWebhook"),
      rules: z.string().max(500).optional(),
      dependencies: {
        triggerFields: ["slack.enabled"],
        show: (values) => values?.slack?.enabled,
      },
    },
    {
      component: "Switch",
      fieldName: "teams.enabled",
      label: $t("organization.agents.channels.teams"),
      defaultValue: false,
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.channels.teamsWebhookPlaceholder"),
      },
      fieldName: "teams.webhook",
      label: $t("organization.agents.channels.teamsWebhook"),
      rules: z.string().max(500).optional(),
      dependencies: {
        triggerFields: ["teams.enabled"],
        show: (values) => values?.teams?.enabled,
      },
    },
    {
      component: "Switch",
      fieldName: "email.enabled",
      label: $t("organization.agents.channels.email"),
      defaultValue: false,
    },
    {
      component: "Input",
      componentProps: {
        placeholder: $t("organization.agents.channels.emailAddressPlaceholder"),
      },
      fieldName: "email.address",
      label: $t("organization.agents.channels.emailAddress"),
      rules: z.string().email().max(100).optional(),
      dependencies: {
        triggerFields: ["email.enabled"],
        show: (values) => values?.email?.enabled,
      },
    },
  ];
}
