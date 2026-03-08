/**
 * Skill 执行引擎
 * 负责执行 Skill 命令，处理参数注入和结果返回
 */

import { spawn } from "child_process";
import { promisify } from "util";
import type {
  ParsedSkill,
  SkillCommandDef,
  SkillExecutionContext,
  SkillExecutionResult,
  SkillParameterDef,
} from "./types.js";

const execAsync = promisify(spawn);

/**
 * 替换命令中的参数占位符
 * 支持 ${param} 和 $param 格式
 */
function substituteParams(command: string, params: Record<string, unknown>): string {
  let result = command;

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;

    const strValue = String(value);
    // 替换 ${param} 格式
    result = result.replace(new RegExp(`\\$\\{${key}\\}`, "g"), strValue);
    // 替换 $param 格式（仅在单词边界处）
    result = result.replace(new RegExp(`\\$${key}\\b`, "g"), strValue);
  }

  return result;
}

/**
 * 执行 Skill 命令
 */
export async function executeSkillCommand(
  skill: ParsedSkill,
  commandName: string,
  params: Record<string, unknown>,
  context: SkillExecutionContext,
): Promise<SkillExecutionResult> {
  const startTime = Date.now();

  // 查找命令
  const command = findCommand(skill, commandName);
  if (!command) {
    return {
      success: false,
      output: "",
      error: `Command "${commandName}" not found in skill "${skill.name}"`,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }

  // 验证参数
  const validation = validateParams(params, command.parameters);
  if (!validation.valid) {
    return {
      success: false,
      output: "",
      error: `Parameter validation failed: ${validation.errors.join(", ")}`,
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }

  // 替换命令中的参数
  const substitutedCommand = substituteParams(command.command, params);

  // 构建环境变量
  const env = buildEnvironment(params, context, skill);

  // 执行命令
  try {
    const result = await runCommand(substitutedCommand, env, command.workingDir || context.workspaceDir, command.timeout);
    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * 查找命令
 */
function findCommand(skill: ParsedSkill, commandName: string): SkillCommandDef | undefined {
  // 精确匹配
  let command = skill.commands.find((c) => c.name === commandName);

  // 模糊匹配
  if (!command) {
    command = skill.commands.find((c) =>
      c.name.toLowerCase().includes(commandName.toLowerCase()),
    );
  }

  return command;
}

/**
 * 验证参数
 */
function validateParams(
  params: Record<string, unknown>,
  defs: SkillParameterDef[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const def of defs) {
    const value = params[def.name];

    // 必填检查
    if (def.required && (value === undefined || value === null)) {
      errors.push(`Missing required parameter: ${def.name}`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // 类型检查
    if (!checkType(value, def.type)) {
      errors.push(`Invalid type for parameter ${def.name}: expected ${def.type}`);
      continue;
    }

    // 验证规则
    if (def.validation) {
      const strValue = String(value);

      // 正则匹配
      if (def.validation.pattern && !new RegExp(def.validation.pattern).test(strValue)) {
        errors.push(`Parameter ${def.name} does not match pattern: ${def.validation.pattern}`);
      }

      // 枚举值检查
      if (def.validation.enum && !def.validation.enum.includes(strValue)) {
        errors.push(`Parameter ${def.name} must be one of: ${def.validation.enum.join(", ")}`);
      }

      // 数值范围检查
      if (def.type === "number") {
        const numValue = Number(value);
        if (def.validation.min !== undefined && numValue < def.validation.min) {
          errors.push(`Parameter ${def.name} must be >= ${def.validation.min}`);
        }
        if (def.validation.max !== undefined && numValue > def.validation.max) {
          errors.push(`Parameter ${def.name} must be <= ${def.validation.max}`);
        }
      }

      // 字符串长度检查
      if (def.type === "string") {
        if (def.validation.min !== undefined && strValue.length < def.validation.min) {
          errors.push(`Parameter ${def.name} must have length >= ${def.validation.min}`);
        }
        if (def.validation.max !== undefined && strValue.length > def.validation.max) {
          errors.push(`Parameter ${def.name} must have length <= ${def.validation.max}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 检查类型
 */
function checkType(value: unknown, type: string): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !isNaN(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

/**
 * 构建环境变量
 */
function buildEnvironment(
  params: Record<string, unknown>,
  context: SkillExecutionContext,
  skill: ParsedSkill,
): Record<string, string> {
  const env: Record<string, string> = { ...context.env };

  // 添加上下文环境变量
  env.AGENT_ID = context.agentId;
  env.WORKSPACE_DIR = context.workspaceDir;

  // 添加 Skill 配置
  if (context.config) {
    for (const [key, value] of Object.entries(context.config)) {
      if (value !== undefined && value !== null) {
        env[`CONFIG_${key.toUpperCase()}`] = String(value);
      }
    }
  }

  // 添加参数作为环境变量
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      // 支持 ${param} 和 $param 格式
      env[key] = String(value);
      env[key.toUpperCase()] = String(value);
    }
  }

  // 添加 primaryEnv（API Key 等）
  if (skill.metadata.primaryEnv && env[skill.metadata.primaryEnv]) {
    env.PRIMARY_ENV = env[skill.metadata.primaryEnv];
  }

  return env;
}

/**
 * 运行命令
 */
function runCommand(
  command: string,
  env: Record<string, string>,
  cwd: string,
  timeout = 300,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // 使用 shell 执行命令
    const isWindows = process.platform === "win32";
    
    // Windows 使用 PowerShell（更好的 UTF-8 支持）
    const shell = isWindows ? "powershell.exe" : "bash";
    const shellFlag = isWindows ? "-Command" : "-c";
    
    // Windows 下设置 UTF-8 编码
    const finalCommand = isWindows
      ? `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`
      : command;

    const child = spawn(shell, [shellFlag, finalCommand], {
      env: { 
        ...process.env, 
        ...env,
        // Windows 下设置 UTF-8 环境变量
        ...(isWindows && { 
          PYTHONIOENCODING: "utf-8",
          CHCP: "65001"
        })
      },
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killed = false;

    // 设置超时
    const timeoutId = setTimeout(() => {
      killed = true;
      child.kill("SIGTERM");
      reject(new Error(`Command timed out after ${timeout} seconds`));
    }, timeout * 1000);

    child.stdout?.on("data", (data) => {
      stdout += data.toString("utf8");
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString("utf8");
    });

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      if (!killed) {
        reject(error);
      }
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      if (!killed) {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
        });
      }
    });
  });
}

/**
 * 执行原始命令（用于直接执行）
 */
export async function executeRawCommand(
  command: string,
  context: SkillExecutionContext,
  timeout = 300,
): Promise<SkillExecutionResult> {
  const startTime = Date.now();

  try {
    const env = buildEnvironment({}, context, {
      metadata: {},
      name: "",
      description: "",
      slug: "",
      content: "",
      commands: [],
      invocation: { userInvocable: true, disableModelInvocation: false },
      baseDir: context.workspaceDir || process.cwd(),
    });

    const result = await runCommand(command, env, context.workspaceDir, timeout);

    return {
      success: result.exitCode === 0,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      output: "",
      error: error instanceof Error ? error.message : String(error),
      exitCode: -1,
      duration: Date.now() - startTime,
    };
  }
}
