/**
 * 任务定义模块
 *
 * 提供 JSON 格式的任务定义和执行能力：
 * - TaskDefinition: 任务定义类型
 * - TaskDefinitionExecutor: 任务执行引擎
 * - ResultValidator: 结果验证器
 * - UserConfirmHandler: 用户确认处理器
 */

export * from "./types.js";
export * from "./task-definition-executor.js";
export * from "./result-validator.js";
export * from "./user-confirm-handler.js";
