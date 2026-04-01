/**
 * Worker 进程入口文件
 *
 * 由 Master 进程通过 child_process.fork 启动
 */

import { GatewayWorker } from "./worker.js";

// 获取 Worker ID 从命令行参数
const workerId = process.argv[2] || "worker-unknown";

// 创建 Worker 实例
const worker = new GatewayWorker({
  workerId,
  maxConcurrency: 10,
  messageTimeout: 30000,
  heartbeatInterval: 5000,
});

// 启动 Worker
worker.start().catch((error) => {
  console.error(`[${workerId}] Failed to start:`, error);
  process.exit(1);
});

// 处理进程信号
process.on("SIGTERM", async () => {
  console.log(`[${workerId}] Received SIGTERM, shutting down...`);
  await worker.stop();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log(`[${workerId}] Received SIGINT, shutting down...`);
  await worker.stop();
  process.exit(0);
});

// 处理未捕获的错误
process.on("uncaughtException", (error) => {
  console.error(`[${workerId}] Uncaught exception:`, error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error(`[${workerId}] Unhandled rejection:`, reason);
  process.exit(1);
});
