import { spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import path from "path";
import os from "os";
import type { ToolExecutionContext } from "./types.js";
import { smartDecode } from "./encoding-utils.js";

// 设置 UTF-8 编码的环境变量
const UTF8_ENV = {
  ...process.env,
  PYTHONIOENCODING: "utf-8",
  LANG: "zh_CN.UTF-8",
  LC_ALL: "zh_CN.UTF-8",
};

/**
 * 确保工具所需的目录存在
 * 例如 agent-browser 需要 ~/.agent-browser 目录
 */
function ensureToolDirectories(): void {
  const homeDir = os.homedir();
  const requiredDirs = [
    path.join(homeDir, ".agent-browser"),
  ];
  
  for (const dir of requiredDirs) {
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
        console.log(`[Tools] Created directory: ${dir}`);
      } catch (error) {
        console.warn(`[Tools] Failed to create directory ${dir}:`, error);
      }
    }
  }
}

// Shell 类型
export type ShellType = "powershell" | "cmd" | "bash" | "zsh" | "sh";

// Shell 配置
interface ShellConfig {
  type: ShellType;
  path: string;
  shellArgs: string[];
}

// Windows PowerShell 可能的路径
const POWERSHELL_PATHS = [
  "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  "C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe",
];

/**
 * 检测路径是否包含空格且未被引号包裹
 */
function hasUnquotedSpaces(path: string): boolean {
  if (path.startsWith('"') && path.endsWith('"')) {
    return false;
  }
  if (path.startsWith("'") && path.endsWith("'")) {
    return false;
  }
  return path.includes(" ");
}

/**
 * 为路径添加引号
 */
function quotePath(path: string, shellType: ShellType): string {
  if (!hasUnquotedSpaces(path)) {
    return path;
  }
  if (shellType === "powershell") {
    return `'${path.replace(/'/g, "''")}'`;
  }
  return `"${path}"`;
}

/**
 * 检测字符串是否可能是文件路径
 */
function isLikelyFilePath(str: string): boolean {
  if (str.length < 2) return false;
  if (/^[A-Za-z]:[/\\]/.test(str)) return true;
  if (str.startsWith("/") || str.startsWith("./") || str.startsWith("../")) return true;
  if (str.startsWith("~")) return true;
  if (/\.[a-zA-Z]{1,10}$/.test(str) && (str.includes("/") || str.includes("\\"))) return true;
  return false;
}

/**
 * 处理命令中包含空格的路径，自动添加引号
 */
function quotePathsInCommand(command: string, shellType: ShellType): string {
  const tokens: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let i = 0;

  while (i < command.length) {
    const char = command[i];

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (char === " " && !inSingleQuote && !inDoubleQuote) {
      if (current) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += char;
    }
    i++;
  }

  if (current) {
    tokens.push(current);
  }

  const processedTokens = tokens.map((token) => {
    if (isLikelyFilePath(token) && hasUnquotedSpaces(token)) {
      return quotePath(token, shellType);
    }
    return token;
  });

  return processedTokens.join(" ");
}

/**
 * 检测当前系统的 shell
 * 参考 codex 的实现，使用用户的默认 shell
 */
function detectShell(): ShellConfig {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: 优先使用 PowerShell，因为它对引号和路径的处理更合理
    
    // 1. 尝试 PowerShell Core (pwsh.exe)
    try {
      const { execSync } = require("child_process");
      execSync("pwsh.exe -NoProfile -Command 'exit 0'", { 
        stdio: "ignore", 
        timeout: 2000 
      });
      return {
        type: "powershell",
        path: "pwsh.exe",
        shellArgs: ["-NoProfile", "-Command"],
      };
    } catch {
      // pwsh 不可用，继续尝试其他选项
    }
    
    // 2. 尝试 Windows PowerShell (检查文件是否存在)
    for (const psPath of POWERSHELL_PATHS) {
      if (existsSync(psPath)) {
        return {
          type: "powershell",
          path: psPath,
          shellArgs: ["-NoProfile", "-Command"],
        };
      }
    }
    
    // 3. 尝试 PATH 中的 powershell.exe
    try {
      const { execSync } = require("child_process");
      execSync("powershell.exe -NoProfile -Command 'exit 0'", { 
        stdio: "ignore", 
        timeout: 2000 
      });
      return {
        type: "powershell",
        path: "powershell.exe",
        shellArgs: ["-NoProfile", "-Command"],
      };
    } catch {
      // powershell.exe 不可用
    }
    
    // 4. 回退到 cmd（不推荐，因为引号处理有问题）
    const comSpec = process.env.ComSpec || "cmd.exe";
    return {
      type: "cmd",
      path: comSpec,
      shellArgs: ["/d", "/c"],
    };
  }

  // Unix-like 系统 (macOS, Linux)
  const userShell = process.env.SHELL;
  if (userShell) {
    if (userShell.includes("zsh")) {
      return { type: "zsh", path: userShell, shellArgs: ["-c"] };
    }
    if (userShell.includes("bash")) {
      return { type: "bash", path: userShell, shellArgs: ["-c"] };
    }
    return { type: "sh", path: userShell, shellArgs: ["-c"] };
  }

  return { type: "sh", path: "/bin/sh", shellArgs: ["-c"] };
}

// 缓存 shell 配置
let cachedShell: ShellConfig | null = null;

function getShell(): ShellConfig {
  if (!cachedShell) {
    cachedShell = detectShell();
    console.log(`[Tools] Detected shell: ${cachedShell.type} (${cachedShell.path})`);
  }
  return cachedShell;
}

/**
 * 构建执行命令的参数数组
 * 参考 codex 的 derive_exec_args 方法
 */
function buildExecArgs(command: string): { shell: string; args: string[]; shellType: ShellType } {
  const shell = getShell();
  const processedCommand = quotePathsInCommand(command, shell.type);

  return {
    shell: shell.path,
    args: [...shell.shellArgs, processedCommand],
    shellType: shell.type,
  };
}

export interface ExecuteExecOptions {
  cwd?: string;
  context?: ToolExecutionContext;
  detached?: boolean; // 是否以 detached 模式运行（不等待命令完成）
}

export async function executeExec(
  command: string,
  options?: ExecuteExecOptions
): Promise<string> {
  const workDir = options?.cwd || options?.context?.workspaceDir || process.cwd();
  const detached = options?.detached || false;

  console.log(`[Tools] Executing command: ${command}`);
  console.log(`[Tools] Working directory: ${workDir}`);
  console.log(`[Tools] Detached mode: ${detached}`);

  const { shell, args, shellType } = buildExecArgs(command);
  const processedCommand = args[args.length - 1];

  if (processedCommand !== command) {
    console.log(`[Tools] Processed command (paths quoted): ${processedCommand}`);
  }

  console.log(`[Tools] Shell: ${shell} (${shellType})`);
  console.log(`[Tools] Shell args: ${JSON.stringify(args)}`);

  return new Promise((resolve, reject) => {
    try {
      // 确保工具所需的目录存在
      ensureToolDirectories();
      
      // 通过用户 shell 执行命令
      // 这样支持所有 shell 特性：管道、重定向、变量、脚本等
      const child = spawn(shell, args, {
        cwd: workDir,
        env: UTF8_ENV,
        timeout: detached ? undefined : 60000,
        windowsHide: true,
        detached: detached, // 允许命令在后台运行
      });

      // 如果是 detached 模式，启动成功后立即返回
      if (detached) {
        child.unref(); // 让进程独立运行

        // 给进程一点时间来启动，检查是否有立即的错误
        setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) {
            // 进程仍在运行，认为启动成功
            console.log(`[Tools] ✅ Command started in detached mode (PID: ${child.pid})`);
            resolve(`Command started successfully in background (PID: ${child.pid}): ${command}`);
          }
        }, 500);

        // 监听启动错误
        child.on("error", (error) => {
          console.error(`[Tools] Failed to start detached command:`, error);
          reject(new Error(`Failed to start command: ${error.message}`));
        });

        return;
      }

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout?.on("data", (data: Buffer) => {
        stdoutChunks.push(data);
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderrChunks.push(data);
      });

      // 处理超时
      child.on("timeout", () => {
        console.error(`[Tools] ⏱️ Command timed out after 60s: ${command}`);
        child.kill("SIGTERM");
        reject(new Error(`Command timed out after 60 seconds: ${command}`));
      });

      child.on("close", async (code, signal) => {
        const stdout = Buffer.concat(stdoutChunks);
        const stderr = Buffer.concat(stderrChunks);

        const stdoutStr = await smartDecode(stdout);
        const stderrStr = await smartDecode(stderr);

        console.log(`[Tools] ✅ Command completed (exit code: ${code}, signal: ${signal})`);
        console.log(
          `[Tools] stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes`
        );

        if (code === 0) {
          // 成功：返回 stdout，如果没有则返回成功提示
          resolve(stdoutStr || "Command executed successfully (no output)");
        } else if (signal === "SIGTERM") {
          // 超时或被终止
          reject(new Error(`Command was terminated (timeout or killed): ${command}`));
        } else {
          // 失败：将错误信息返回给 LLM，让它有机会自我修正
          const errorDetails: string[] = [];
          errorDetails.push(`Command failed with exit code ${code}`);
          if (stderrStr) {
            errorDetails.push(`\nStderr:\n${stderrStr}`);
          }
          if (stdoutStr) {
            errorDetails.push(`\nStdout:\n${stdoutStr}`);
          }
          reject(new Error(errorDetails.join("")));
        }
      });

      child.on("error", (error) => {
        console.error(`[Tools] Spawn error:`, error);
        const errorCode = (error as NodeJS.ErrnoException).code;
        if (errorCode === "ENOENT") {
          reject(
            new Error(
              `Shell not found: ${shell}\n` +
                `Error: ${error.message}\n` +
                `Please ensure the shell is available.`
            )
          );
        } else {
          reject(new Error(`Command execution failed: ${error.message}`));
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      reject(new Error(`Failed to execute command: ${errorMessage}`));
    }
  });
}
