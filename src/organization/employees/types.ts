/**
 * 员工管理类型定义
 */

export interface Employee {
  id: string;
  name: string;
  employeeNo: string;
  oid: string;
  orgTitle?: string;
  positionId: string;
  positionTitle?: string;
  type: string;
  location?: string;
  email: string;
  phone: string;
  hireDate: string;
  status: string;
  description?: string;
  userId?: string;
  createTime?: string;
}

export interface CreateEmployeeDto {
  name: string;
  employeeNo?: string;
  oid?: string;
  positionId?: string;
  type?: string;
  location?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  status?: string;
  description?: string;
}

export interface UpdateEmployeeDto {
  name?: string;
  employeeNo?: string;
  oid?: string;
  positionId?: string;
  type?: string;
  location?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  status?: string;
  description?: string;
}

export interface EmployeeQuery {
  oid?: string;
  keyword?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface EmployeeListResult {
  items: Employee[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EmployeeNoExistsQuery {
  employeeNo: string;
  id?: string;
}
