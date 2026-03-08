import { requestClient } from "#/api/request";

export namespace OrganizationContactApi {
  export type ContactType = "employee" | "customer" | "partner" | "visitor";
  export type ContactStatus = "enabled" | "disabled";

  export interface ContactProfile {
    [key: string]: any;
  }

  export interface Contact {
    [key: string]: any;
    sid: string;
    type: ContactType;
    sourceId?: string;
    sourceName?: string;  // 关联源的名称（如员工姓名）
    profile?: ContactProfile;
    status: ContactStatus;
    description?: string;
    createTime?: string;
    timestamp?: string;
  }

  export interface ContactListResult {
    items: Contact[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface ContactQuery {
    type?: ContactType;
    keyword?: string;
    status?: ContactStatus;
    page?: number;
    pageSize?: number;
  }
}

/**
 * 获取联系人列表
 * @param params 查询参数
 */
async function getContactList(params?: OrganizationContactApi.ContactQuery) {
  return requestClient.get<OrganizationContactApi.ContactListResult>(
    "/organization/contacts",
    { params },
  );
}

/**
 * 获取联系人详情
 * @param sid 联系人SID
 */
async function getContactDetail(sid: string) {
  return requestClient.get<OrganizationContactApi.Contact>(
    `/organization/contacts/${sid}`,
  );
}

/**
 * 创建联系人
 * @param data 联系人数据
 */
async function createContact(
  data: Omit<OrganizationContactApi.Contact, "sid" | "createTime" | "timestamp">,
) {
  return requestClient.post("/organization/contacts", data);
}

/**
 * 更新联系人
 * @param sid 联系人SID
 * @param data 联系人数据
 */
async function updateContact(
  sid: string,
  data: Partial<Omit<OrganizationContactApi.Contact, "sid" | "createTime" | "timestamp">>,
) {
  return requestClient.put(`/organization/contacts/${sid}`, data);
}

/**
 * 删除联系人
 * @param sid 联系人SID
 */
async function deleteContact(sid: string) {
  return requestClient.delete(`/organization/contacts/${sid}`);
}

/**
 * 检查联系人是否存在
 * @param type 联系人类型
 * @param sourceId 来源ID
 * @param sid 排除的联系人SID（编辑时使用）
 */
async function isContactExists(
  type: OrganizationContactApi.ContactType,
  sourceId?: string,
  sid?: string,
) {
  return requestClient.get<boolean>("/organization/contacts/exists", {
    params: { type, sourceId, sid },
  });
}

/**
 * 获取当前登录用户的联系人信息
 */
async function getMyContact() {
  return requestClient.get<OrganizationContactApi.Contact>("/organization/contacts/my/contact");
}

export {
  createContact,
  deleteContact,
  getContactDetail,
  getContactList,
  getMyContact,
  isContactExists,
  updateContact,
};
