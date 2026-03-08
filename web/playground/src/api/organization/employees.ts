import { requestClient } from "#/api/request";

export namespace OrganizationEmployeeApi {
  export interface EmployeeProfile {
    skills?: string[];
    certifications?: string[];
    expertise?: string[];
    level?: string;
    education?: Array<{
      school: string;
      major: string;
      degree: string;
      startDate: string;
      endDate: string;
    }>;
    workHistory?: Array<{
      company: string;
      position: string;
      startDate: string;
      endDate: string;
      description?: string;
    }>;
    projects?: Array<{
      name: string;
      role: string;
      startDate: string;
      endDate: string;
      description?: string;
    }>;
    personality?: string[];
    habits?: string[];
    traits?: string[];
    workStyle?: string;
    communicationStyle?: string;
    focusTime?: string;
    preferredTools?: string[];
  }

  export interface Employee {
    [key: string]: any;
    id: string;
    name: string;
    employeeNo?: string;
    oid?: string;
    orgTitle?: string;
    positionId?: string;
    positionTitle?: string;
    type?: string;
    location?: string;
    email?: string;
    phone?: string;
    hireDate?: string;
    status: string;
    description?: string;
    userId?: string;
    createTime?: string;
  }

  export interface EmployeeListResult {
    items: Employee[];
    total: number;
    page: number;
    pageSize: number;
  }

  export interface EmployeeQuery {
    oid?: string;
    keyword?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }
}

/**
 * 获取员工列表
 * @param params 查询参数
 */
async function getEmployeeList(params?: OrganizationEmployeeApi.EmployeeQuery) {
  return requestClient.get<OrganizationEmployeeApi.EmployeeListResult>(
    "/organization/employees",
    { params },
  );
}

/**
 * 获取员工详情
 * @param id 员工ID
 */
async function getEmployeeDetail(id: string) {
  return requestClient.get<OrganizationEmployeeApi.Employee>(
    `/organization/employees/${id}`,
  );
}

/**
 * 创建员工
 * @param data 员工数据
 */
async function createEmployee(
  data: Omit<OrganizationEmployeeApi.Employee, "id" | "createTime">,
) {
  return requestClient.post("/organization/employees", data);
}

/**
 * 更新员工
 * @param id 员工ID
 * @param data 员工数据
 */
async function updateEmployee(
  id: string,
  data: Partial<Omit<OrganizationEmployeeApi.Employee, "id" | "createTime">>,
) {
  return requestClient.put(`/organization/employees/${id}`, data);
}

/**
 * 删除员工
 * @param id 员工ID
 */
async function deleteEmployee(id: string) {
  return requestClient.delete(`/organization/employees/${id}`);
}

/**
 * 检查工号是否存在
 * @param employeeNo 员工工号
 * @param id 排除的员工ID（编辑时使用）
 */
async function isEmployeeNoExists(employeeNo: string, id?: string) {
  return requestClient.get<boolean>("/organization/employees/employee-no-exists", {
    params: { employeeNo, id },
  });
}

export {
  createEmployee,
  deleteEmployee,
  getEmployeeDetail,
  getEmployeeList,
  isEmployeeNoExists,
  updateEmployee,
};
