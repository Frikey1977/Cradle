/**
 * Gateway CLI
 *
 * 命令行工具，用于启动和管理 Gateway
 *
 * 用法:
 *   npx tsx src/gateway/cli.ts master    # 启动 Master 进程
 *   npx tsx src/gateway/cli.ts worker    # 启动 Worker 进程
 *   npx tsx src/gateway/cli.ts status    # 查看状态
 */

import { config } from "dotenv";
import { resolve } from "path";

// 加载环境变量
config({ path: resolve(process.cwd(), ".env") });

import { GatewayMaster, type MasterConfig } from "./core/master.js";
import { GatewayWorker, type WorkerConfig } from "./core/worker.js";
import { WebUIChannel } from "./channels/plugins/webui-channel.js";
import { DingTalkChannel } from "./channels/plugins/dingtalk-channel.js";

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
Cradle Gateway CLI

用法:
  npx tsx src/gateway/cli.ts <command> [options]

命令:
  master [options]    启动 Master 进程
  worker [options]    启动 Worker 进程
  status              查看 Gateway 状态
  help                显示帮助信息

Master 选项:
  --port <number>         HTTP 端口 (默认: 3000)
  --workers <number>      Worker 进程数 (默认: 4)
  --webhook-prefix <path> Webhook 路径前缀 (默认: /webhook)

Worker 选项:
  --id <string>           Worker ID (默认: worker-1)
  --max-concurrency <n>   最大并发数 (默认: 10)

示例:
  npx tsx src/gateway/cli.ts master --port 8080 --workers 8
  npx tsx src/gateway/cli.ts worker --id worker-1
`);
}

/**
 * 解析命令行参数
 */
function parseArgs(args: string[]): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "_");
      const nextArg = args[i + 1];

      if (nextArg && !nextArg.startsWith("--")) {
        // 有值
        const numValue = Number(nextArg);
        result[key] = Number.isNaN(numValue) ? nextArg : numValue;
        i++; // 跳过下一个参数
      } else {
        // 布尔标志
        result[key] = true;
      }
    }
  }

  return result;
}

/**
 * 启动 Master 进程
 */
async function startMaster(args: string[]): Promise<void> {
  const options = parseArgs(args);

  const config: Partial<MasterConfig> = {
    port: (options.port as number) ?? 3000,
    workerCount: (options.workers as number) ?? 4,
    webhookPathPrefix: (options.webhook_prefix as string) ?? "/webhook",
  };

  console.log("Starting Gateway Master...");
  console.log("Config:", JSON.stringify(config, null, 2));

  const master = new GatewayMaster(config);

  // 处理信号
  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down...");
    await master.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, shutting down...");
    await master.stop();
    process.exit(0);
  });

  try {
    await master.start();
    console.log("Gateway Master started successfully!");
    console.log(`Health check: http://localhost:${config.port}/health`);
    console.log(`Stats: http://localhost:${config.port}/stats`);
  } catch (error) {
    console.error("Failed to start Gateway Master:", error);
    process.exit(1);
  }
}

/**
 * 启动 Worker 进程
 */
async function startWorker(args: string[]): Promise<void> {
  const options = parseArgs(args);

  const config: Partial<WorkerConfig> = {
    workerId: (options.id as string) ?? "worker-1",
    maxConcurrency: (options.max_concurrency as number) ?? 10,
    agentId: (options.agent_id as string) ?? process.env.AGENT_ID,
  };

  console.log("Starting Gateway Worker...");
  console.log("Config:", JSON.stringify(config, null, 2));

  if (!config.agentId) {
    console.warn("Warning: No agentId specified. Worker will not be able to process messages.");
    console.warn("Use --agent-id <id> or set AGENT_ID environment variable.");
  }

  const worker = new GatewayWorker(config);

  // 处理信号
  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down...");
    await worker.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, shutting down...");
    await worker.stop();
    process.exit(0);
  });

  try {
    await worker.start();
    console.log("Gateway Worker started successfully!");
  } catch (error) {
    console.error("Failed to start Gateway Worker:", error);
    process.exit(1);
  }
}

/**
 * 显示状态
 */
async function showStatus(): Promise<void> {
  console.log("Gateway Status");
  console.log("==============");
  console.log("Version: 1.0.0");
  console.log("Status: Not implemented");
  // TODO: 实现状态查询
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    showHelp();
    return;
  }

  switch (command) {
    case "master":
      await startMaster(args.slice(1));
      break;
    case "worker":
      await startWorker(args.slice(1));
      break;
    case "status":
      await showStatus();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
