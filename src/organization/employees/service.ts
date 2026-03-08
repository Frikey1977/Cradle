/**
 * 员工管理服务层
 */

import { query, run, withTransaction } from "../../store/database.js";
import { generateUUID } from "../../shared/utils.js";
import { createContact } from "../contact/service.js";
import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeQuery,
  EmployeeListResult,
} from "./types.js";

/**
 * 获取员工列表（支持分页和筛选）
 */
export async function getEmployeeList(queryParams: EmployeeQuery): Promise<EmployeeListResult> {
  const { oid, keyword, status, page = 1, pageSize = 20 } = queryParams;

  let whereClause = "WHERE e.deleted = 0";
  const params: any[] = [];

  if (oid) {
    whereClause += " AND e.oid = ?";
    params.push(oid);
  }

  if (keyword) {
    whereClause +=
      " AND (e.name LIKE ? OR e.employee_no LIKE ? OR e.email LIKE ? OR e.phone LIKE ?)";
    const likeKeyword = `%${keyword}%`;
    params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword);
  }

  if (status !== undefined) {
    whereClause += " AND e.status = ?";
    params.push(status);
  }

  // 获取总数
  const countResult = await query<[{ total: number }]>(
    `SELECT COUNT(*) as total FROM t_employees e ${whereClause}`,
    params,
  );
  const total = countResult[0].total;

  // 获取列表数据
  const pageNum = Number(page);
  const pageSizeNum = Number(pageSize);
  const offset = (pageNum - 1) * pageSizeNum;

  const rows = await query<Employee[]>(
    `SELECT
      e.sid as id,
      e.name,
      e.employee_no as employeeNo,
      e.oid as oid,
      o.title as orgTitle,
      e.position_id as positionId,
      p.title as positionTitle,
      e.type,
      e.location,
      e.email,
      e.phone,
      e.hire_date as hireDate,
      e.status,
      e.description,
      e.user_id as userId,
      e.create_time as createTime
    FROM t_employees e
    LEFT JOIN t_departments o ON e.oid = o.sid AND o.deleted = 0
    LEFT JOIN t_positions p ON e.position_id = p.sid AND p.deleted = 0
    ${whereClause}
    ORDER BY e.create_time DESC
    LIMIT ${pageSizeNum} OFFSET ${offset}`,
    params,
  );

  return {
    items: rows,
    total,
    page: pageNum,
    pageSize: pageSizeNum,
  };
}

/**
 * 根据ID获取员工
 */
export async function getEmployeeById(id: string): Promise<Employee | null> {
  const rows = await query<Employee[]>(
    `SELECT
      e.sid as id,
      e.name,
      e.employee_no as employeeNo,
      e.oid as oid,
      o.title as orgTitle,
      e.position_id as positionId,
      p.title as positionTitle,
      e.type,
      e.location,
      e.email,
      e.phone,
      e.hire_date as hireDate,
      e.status,
      e.description,
      e.user_id as userId,
      e.create_time as createTime
    FROM t_employees e
    LEFT JOIN t_departments o ON e.oid = o.sid AND o.deleted = 0
    LEFT JOIN t_positions p ON e.position_id = p.sid AND p.deleted = 0
    WHERE e.sid = ? AND e.deleted = 0`,
    [id],
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * 检查工号是否存在
 */
export async function isEmployeeNoExists(employeeNo: string, excludeId?: string): Promise<boolean> {
  let sql = "SELECT COUNT(*) as count FROM t_employees WHERE employee_no = ? AND deleted = 0";
  const params: any[] = [employeeNo];

  if (excludeId) {
    sql += " AND sid != ?";
    params.push(excludeId);
  }

  const result = await query<[{ count: number }]>(sql, params);
  return result[0].count > 0;
}

/**
 * 创建员工（带事务）
 */
export async function createEmployee(data: CreateEmployeeDto): Promise<string> {
  return withTransaction(async (connection) => {
    const sid = generateUUID();

    // 将 ISO 格式日期转换为 YYYY-MM-DD 格式
    const formattedHireDate = data.hireDate
      ? new Date(data.hireDate).toISOString().split("T")[0]
      : null;

    // 创建员工记录
    await connection.execute(
      `INSERT INTO t_employees (
        sid, name, employee_no, oid, position_id, type, location, email, phone, hire_date,
        status, description, deleted, create_time, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        sid,
        data.name,
        data.employeeNo || null,
        data.oid || null,
        data.positionId || null,
        data.type || "full-time",
        data.location || null,
        data.email || null,
        data.phone || null,
        formattedHireDate,
        data.status ?? "active",
        data.description || null,
      ],
    );

    // 同步创建联系人记录（使用同一事务连接）
    await createContact({
      type: "employee",
      sourceId: sid,
      status: "enabled",
      description: data.description,
    }, connection);

    return sid;
  });
}

/**
 * 更新员工
 */
export async function updateEmployee(id: string, data: UpdateEmployeeDto): Promise<void> {
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push("name = ?");
    params.push(data.name);
  }
  if (data.employeeNo !== undefined) {
    updates.push("employee_no = ?");
    params.push(data.employeeNo || null);
  }
  if (data.oid !== undefined) {
    updates.push("oid = ?");
    params.push(data.oid || null);
  }
  if (data.positionId !== undefined) {
    updates.push("position_id = ?");
    params.push(data.positionId || null);
  }
  if (data.type !== undefined) {
    updates.push("type = ?");
    params.push(data.type || "full-time");
  }
  if (data.location !== undefined) {
    updates.push("location = ?");
    params.push(data.location || null);
  }
  if (data.email !== undefined) {
    updates.push("email = ?");
    params.push(data.email || null);
  }
  if (data.phone !== undefined) {
    updates.push("phone = ?");
    params.push(data.phone || null);
  }
  if (data.hireDate !== undefined) {
    updates.push("hire_date = ?");
    // 将 ISO 格式日期转换为 YYYY-MM-DD 格式
    const formattedDate = data.hireDate
      ? new Date(data.hireDate).toISOString().split("T")[0]
      : null;
    params.push(formattedDate);
  }
  if (data.status !== undefined) {
    updates.push("status = ?");
    params.push(data.status);
  }
  if (data.description !== undefined) {
    updates.push("description = ?");
    params.push(data.description || null);
  }

  if (updates.length === 0) {
    throw new Error("没有需要更新的字段");
  }

  updates.push("timestamp = NOW()");
  params.push(id);

  await run(`UPDATE t_employees SET ${updates.join(", ")} WHERE sid = ?`, params);
}

/**
 * 删除员工（逻辑删除）
 */
export async function deleteEmployee(id: string): Promise<void> {
  await run("UPDATE t_employees SET deleted = 1, timestamp = NOW() WHERE sid = ?", [id]);
}
