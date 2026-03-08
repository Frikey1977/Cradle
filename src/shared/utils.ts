// 全局工具函数

import { randomUUID } from "crypto";

/**
 * 生成 UUID
 */
export function generateUUID(): string {
  return randomUUID();
}

/**
 * 构建树形结构
 */
export function buildTree<T extends Record<string, any>>(
  items: T[],
  options?: { idField?: string; pidField?: string; childrenField?: string },
): T[] {
  const { idField = "id", pidField = "pid", childrenField = "children" } = options || {};

  const map = new Map<string, T>();
  const roots: T[] = [];

  // 首先按 sort 字段排序（如果存在）
  const sortedItems = [...items].sort((a, b) => {
    const sortA = a.sort ?? 0;
    const sortB = b.sort ?? 0;
    return sortA - sortB;
  });

  sortedItems.forEach((item) => {
    map.set(item[idField], { ...item, [childrenField]: [] });
  });

  sortedItems.forEach((item) => {
    const node = map.get(item[idField])!;
    if (item[pidField] === "0" || !item[pidField]) {
      roots.push(node);
    } else {
      const parent = map.get(item[pidField]);
      if (parent) {
        (parent as Record<string, any>)[childrenField] = (parent as Record<string, any>)[childrenField] || [];
        (parent as Record<string, any>)[childrenField].push(node);
      } else {
        roots.push(node);
      }
    }
  });

  return roots;
}

/**
 * 格式化响应数据
 */
export function formatResponse<T>(data: T, message = "操作成功") {
  return {
    code: "SUCCESS",
    message,
    data,
    timestamp: Date.now(),
  };
}

/**
 * 格式化分页响应
 */
export function formatPaginatedResponse<T>(
  list: T[],
  total: number,
  page: number,
  pageSize: number,
) {
  return {
    code: "SUCCESS",
    message: "获取成功",
    data: {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    timestamp: Date.now(),
  };
}
