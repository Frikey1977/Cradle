# Skill 执行引擎设计

## 1. 概述

Skill 执行引擎是负责解析和执行 AgentSkills 标准 SKILL.md 的核心组件。它将大语言模型（LLM）生成的指令转换为实际的系统操作，并提供安全隔离、参数校验和错误处理机制。

### 1.1 核心职责

| 职责 | 说明 |
|-----|------|
| Skill 加载 | 从文件系统读取并解析 SKILL.md |
| 参数校验 | 验证 LLM 提供的参数是否符合 Skill 定义 |
| 安全隔离 | 在受控环境中执行 Skill 指令 |
| 结果返回 | 格式化执行结果返回给 LLM |
| 错误处理 | 捕获和处理执行过程中的异常 |

### 1.2 执行流程概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Skill 执行流程                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  LLM 生成指令                                                    │
│       ↓                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │ 指令解析器   │───→│ 参数校验器   │───→│ 执行引擎     │         │
│  │ Parser      │    │ Validator   │    │ Executor    │         │
│  └─────────────┘    └─────────────┘    └──────┬──────┘         │
│       ↑                                        │                │
│       └────────────────────────────────────────┘                │
│              返回执行结果（成功/失败）                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Skill 加载与解析

### 2.1 SKILL.md 解析

**文件结构**：
```
{skill_root}/{source_type}/{skill_slug}/
├── SKILL.md              # Skill 定义文件
├── README.md             # 使用说明（可选）
├── scripts/              # 自定义脚本（可选）
│   ├── pre-execute.sh    # 执行前钩子
│   └── post-execute.sh   # 执行后钩子
└── config/
    └── default.json      # 默认配置（可选）
```

**SKILL.md 解析流程**：

```typescript
interface SkillParser {
  parse(skillPath: string): ParsedSkill;
}

interface ParsedSkill {
  // YAML Frontmatter
  metadata: {
    name: string;
    description: string;
    metadata: {
      openclaw: {
        emoji: string;
        requires: {
          bins?: string[];      // 必需的二进制工具
          env?: string[];       // 必需的环境变量
          config?: string[];    // 必需的配置项
        };
        install?: InstallStep[];
        primaryEnv?: string;    // 主环境变量名（用于API Key）
      };
    };
  };
  
  // Markdown 内容
  content: string;            // Skill 使用说明
  
  // 提取的命令定义
  commands: CommandDef[];     // 从 Markdown 提取的命令
}

// 解析流程
async function parseSkill(skillPath: string): Promise<ParsedSkill> {
  // 1. 读取 SKILL.md 文件
  const content = await fs.readFile(`${skillPath}/SKILL.md`, 'utf-8');
  
  // 2. 分离 YAML Frontmatter
  const { frontmatter, markdown } = extractFrontmatter(content);
  
  // 3. 解析 YAML
  const metadata = yaml.parse(frontmatter);
  
  // 4. 提取命令定义（从 Markdown 代码块）
  const commands = extractCommands(markdown);
  
  // 5. 验证必需字段
  validateRequiredFields(metadata);
  
  return { metadata, content: markdown, commands };
}
```

### 2.2 命令提取

从 Markdown 内容中提取可执行命令：

```typescript
interface CommandDef {
  name: string;               // 命令名称
  description: string;        // 命令描述
  parameters: ParameterDef[]; // 参数定义
  command: string;            // 实际执行的命令模板
  workingDir?: string;        // 工作目录
  timeout?: number;           // 超时时间（秒）
}

interface ParameterDef {
  name: string;               // 参数名
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;          // 是否必需
  default?: unknown;          // 默认值
  description?: string;       // 参数描述
  validation?: {              // 验证规则
    pattern?: string;         // 正则表达式
    min?: number;             // 最小值/长度
    max?: number;             // 最大值/长度
    enum?: string[];          // 枚举值
  };
}

// 从 Markdown 提取命令示例
function extractCommands(markdown: string): CommandDef[] {
  const commands: CommandDef[] = [];
  
  // 匹配代码块中的命令定义
  const codeBlocks = markdown.match(/```bash\n([\s\S]*?)```/g) || [];
  
  for (const block of codeBlocks) {
    const command = extractCommandFromBlock(block);
    if (command) commands.push(command);
  }
  
  return commands;
}
```

## 3. 参数校验与注入

### 3.1 参数校验流程

```
LLM 生成参数
    ↓
┌─────────────────────────────────────────┐
│ 1. 类型检查                              │
│    - 检查参数类型是否符合定义             │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 2. 必填检查                              │
│    - 检查必需参数是否提供                 │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ 3. 格式验证                              │
│    - 正则匹配                            │
│    - 范围检查                            │
│    - 枚举值检查                          │
└─────────────────────────────────────────┘
    ↓
校验通过 → 注入环境变量 → 执行命令
```

### 3.2 参数校验实现

```typescript
class ParameterValidator {
  validate(params: Record<string, unknown>, defs: ParameterDef[]): ValidationResult {
    const errors: ValidationError[] = [];
    
    for (const def of defs) {
      const value = params[def.name];
      
      // 1. 必填检查
      if (def.required && (value === undefined || value === null)) {
        errors.push({
          field: def.name,
          message: `参数 ${def.name} 是必需的`
        });
        continue;
      }
      
      // 2. 类型检查
      if (value !== undefined && !this.checkType(value, def.type)) {
        errors.push({
          field: def.name,
          message: `参数 ${def.name} 类型错误，期望 ${def.type}`
        });
        continue;
      }
      
      // 3. 格式验证
      if (value !== undefined && def.validation) {
        const validationError = this.validateFormat(value, def.validation);
        if (validationError) {
          errors.push({
            field: def.name,
            message: validationError
          });
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private checkType(value: unknown, type: string): boolean {
    switch (type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'array': return Array.isArray(value);
      case 'object': return typeof value === 'object' && !Array.isArray(value);
      default: return false;
    }
  }
  
  private validateFormat(value: unknown, rules: ParameterDef['validation']): string | null {
    if (!rules) return null;
    
    // 正则匹配
    if (rules.pattern && typeof value === 'string') {
      const regex = new RegExp(rules.pattern);
      if (!regex.test(value)) {
        return `格式不匹配正则表达式: ${rules.pattern}`;
      }
    }
    
    // 范围检查（数字）
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        return `值不能小于 ${rules.min}`;
      }
      if (rules.max !== undefined && value > rules.max) {
        return `值不能大于 ${rules.max}`;
      }
    }
    
    // 枚举值检查
    if (rules.enum && !rules.enum.includes(String(value))) {
      return `值必须是以下之一: ${rules.enum.join(', ')}`;
    }
    
    return null;
  }
}
```

### 3.3 环境变量注入

```typescript
interface EnvironmentInjector {
  inject(
    command: string,
    params: Record<string, unknown>,
    envVars: Record<string, string>,
    config: Record<string, unknown>
  ): string;
}

class EnvironmentInjectorImpl implements EnvironmentInjector {
  inject(
    command: string,
    params: Record<string, unknown>,
    envVars: Record<string, string>,
    config: Record<string, unknown>
  ): string {
    let result = command;
    
    // 1. 注入参数
    for (const [key, value] of Object.entries(params)) {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    // 2. 注入环境变量
    for (const [key, value] of Object.entries(envVars)) {
      const placeholder = `$${key}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    // 3. 注入配置
    for (const [key, value] of Object.entries(config)) {
      const placeholder = `{{config.${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), String(value));
    }
    
    return result;
  }
}
```

## 4. 执行沙箱与安全隔离

### 4.1 沙箱架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      执行沙箱架构                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    主进程（Node.js）                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Skill调度器  │  │ 资源监控器   │  │ 结果处理器   │     │   │
│  │  │ Scheduler   │  │ Monitor     │  │ Handler     │     │   │
│  │  └──────┬──────┘  └─────────────┘  └─────────────┘     │   │
│  │         │                                               │   │
│  │         ↓ IPC / 子进程                                   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │              沙箱进程（隔离环境）                 │   │   │
│  │  │  ┌─────────────┐  ┌─────────────┐              │   │   │
│  │  │  │ 命令执行器   │  │ 文件系统访问 │              │   │   │
│  │  │  │ Executor    │  │ (受限)       │              │   │   │
│  │  │  └─────────────┘  └─────────────┘              │   │   │
│  │  │                                                 │   │   │
│  │  │  限制：                                         │   │   │
│  │  │  - 网络访问（白名单）                            │   │   │
│  │  │  - 文件系统（只读/指定目录）                      │   │   │
│  │  │  - CPU/内存限制                                  │   │   │
│  │  │  - 执行时间限制                                  │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 安全策略

| 安全维度 | 策略 | 实现方式 |
|---------|------|---------|
| **命令白名单** | 只允许执行预定义命令 | 命令模板匹配 |
| **网络隔离** | 限制网络访问 | 防火墙规则 / 容器网络 |
| **文件系统** | 只读访问，指定工作目录 | chroot / 容器挂载 |
| **资源限制** | CPU、内存、时间限制 | cgroup / 容器资源限制 |
| **环境隔离** | 干净的环境变量 | 自定义环境变量注入 |

### 4.3 沙箱实现

```typescript
interface SandboxConfig {
  workingDir: string;         // 工作目录
  timeout: number;            // 超时时间（毫秒）
  maxMemory: number;          // 最大内存（MB）
  maxCpu: number;             // 最大CPU使用率
  allowedCommands: string[];  // 允许的命令白名单
  networkPolicy: 'none' | 'restricted' | 'full';
  envVars: Record<string, string>;
}

class SkillSandbox {
  private config: SandboxConfig;
  
  constructor(config: SandboxConfig) {
    this.config = config;
  }
  
  async execute(command: string): Promise<ExecutionResult> {
    // 1. 命令白名单检查
    if (!this.isCommandAllowed(command)) {
      throw new SecurityError(`命令不在白名单中: ${command}`);
    }
    
    // 2. 使用子进程执行（带资源限制）
    return new Promise((resolve, reject) => {
      const child = spawn('sh', ['-c', command], {
        cwd: this.config.workingDir,
        env: this.config.envVars,
        timeout: this.config.timeout
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        resolve({
          exitCode: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          success: code === 0
        });
      });
      
      child.on('error', (error) => {
        reject(new ExecutionError(`执行失败: ${error.message}`));
      });
    });
  }
  
  private isCommandAllowed(command: string): boolean {
    // 提取命令名
    const cmdName = command.trim().split(' ')[0];
    
    // 检查是否在白名单中
    return this.config.allowedCommands.includes(cmdName);
  }
}
```

## 5. 执行结果返回

### 5.1 结果格式

```typescript
interface ExecutionResult {
  success: boolean;           // 是否成功
  exitCode: number;          // 退出码
  stdout: string;            // 标准输出
  stderr: string;            // 标准错误
  duration: number;          // 执行耗时（毫秒）
  metadata?: {               // 元数据
    command: string;         // 执行的命令
    workingDir: string;      // 工作目录
    startTime: number;       // 开始时间
    endTime: number;         // 结束时间
  };
}

// 返回给 LLM 的格式
interface SkillExecutionResponse {
  status: 'success' | 'error';
  result?: {
    output: string;          // 执行输出
    formatted?: unknown;     // 结构化数据（如JSON）
  };
  error?: {
    code: string;            // 错误码
    message: string;         // 错误消息
    details?: unknown;       // 详细错误信息
  };
  execution: {
    skillName: string;       // Skill 名称
    commandName: string;     // 命令名称
    duration: number;        // 执行耗时
    timestamp: number;       // 执行时间
  };
}
```

### 5.2 结果格式化

```typescript
class ResultFormatter {
  format(result: ExecutionResult, skillName: string, commandName: string): SkillExecutionResponse {
    if (result.success) {
      return {
        status: 'success',
        result: {
          output: result.stdout,
          formatted: this.tryParseJson(result.stdout)
        },
        execution: {
          skillName,
          commandName,
          duration: result.duration,
          timestamp: Date.now()
        }
      };
    } else {
      return {
        status: 'error',
        error: {
          code: `EXEC_ERROR_${result.exitCode}`,
          message: result.stderr || '执行失败',
          details: {
            exitCode: result.exitCode,
            stdout: result.stdout
          }
        },
        execution: {
          skillName,
          commandName,
          duration: result.duration,
          timestamp: Date.now()
        }
      };
    }
  }
  
  private tryParseJson(output: string): unknown | undefined {
    try {
      return JSON.parse(output);
    } catch {
      return undefined;
    }
  }
}
```

## 6. 错误处理和重试

### 6.1 错误分类

| 错误类型 | 说明 | 重试策略 |
|---------|------|---------|
| **参数错误** | 参数缺失或格式错误 | 不重试，返回错误 |
| **权限错误** | 无执行权限 | 不重试，返回错误 |
| **超时错误** | 执行超时 | 可重试1次 |
| **网络错误** | 网络连接失败 | 指数退避重试3次 |
| **资源错误** | 资源不足 | 等待后重试2次 |
| **未知错误** | 其他错误 | 不重试，记录日志 |

### 6.2 重试机制

```typescript
interface RetryPolicy {
  maxRetries: number;         // 最大重试次数
  retryDelay: number;         // 初始重试延迟（毫秒）
  backoffMultiplier: number;  // 退避乘数
  retryableErrors: string[];  // 可重试的错误码
}

class RetryExecutor {
  private policy: RetryPolicy;
  
  constructor(policy: RetryPolicy) {
    this.policy = policy;
  }
  
  async execute<T>(
    operation: () => Promise<T>,
    context: ExecutionContext
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.policy.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // 检查是否可重试
        if (!this.isRetryable(error)) {
          throw error;
        }
        
        // 最后一次尝试，直接抛出错误
        if (attempt === this.policy.maxRetries) {
          break;
        }
        
        // 计算延迟时间
        const delay = this.policy.retryDelay * Math.pow(
          this.policy.backoffMultiplier,
          attempt
        );
        
        // 记录重试日志
        console.log(`执行失败，${delay}ms后重试（第${attempt + 1}次）`);
        
        // 等待后重试
        await this.sleep(delay);
      }
    }
    
    throw lastError;
  }
  
  private isRetryable(error: Error): boolean {
    // 根据错误类型判断是否可重试
    return this.policy.retryableErrors.some(code => 
      error.message.includes(code)
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 6.3 错误处理流程

```
执行命令
    ↓
捕获异常
    ↓
分类错误类型
    ↓
┌─────────────────────────────────────────┐
│ 可重试错误？                              │
└─────────────────────────────────────────┘
    ↓
是 → 执行重试策略
    ↓
重试成功？
    ↓
是 → 返回结果
    ↓
否 → 记录错误日志
    ↓
返回错误响应
```

## 7. 执行引擎核心实现

### 7.1 引擎架构

```typescript
class SkillExecutionEngine {
  private parser: SkillParser;
  private validator: ParameterValidator;
  private injector: EnvironmentInjector;
  private sandbox: SkillSandbox;
  private formatter: ResultFormatter;
  private retryExecutor: RetryExecutor;
  
  constructor(config: EngineConfig) {
    this.parser = new SkillParserImpl();
    this.validator = new ParameterValidator();
    this.injector = new EnvironmentInjectorImpl();
    this.sandbox = new SkillSandbox(config.sandbox);
    this.formatter = new ResultFormatter();
    this.retryExecutor = new RetryExecutor(config.retryPolicy);
  }
  
  async execute(request: ExecutionRequest): Promise<SkillExecutionResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 加载并解析 Skill
      const skill = await this.loadSkill(request.skillId);
      
      // 2. 查找命令定义
      const command = this.findCommand(skill, request.commandName);
      if (!command) {
        throw new Error(`命令不存在: ${request.commandName}`);
      }
      
      // 3. 参数校验
      const validation = this.validator.validate(request.params, command.parameters);
      if (!validation.valid) {
        return this.formatValidationError(validation.errors);
      }
      
      // 4. 环境变量注入
      const executableCommand = this.injector.inject(
        command.command,
        request.params,
        request.envVars,
        request.config
      );
      
      // 5. 执行命令（带重试）
      const result = await this.retryExecutor.execute(
        () => this.sandbox.execute(executableCommand),
        { skillId: request.skillId, commandName: request.commandName }
      );
      
      // 6. 计算执行时间
      result.duration = Date.now() - startTime;
      
      // 7. 格式化结果
      return this.formatter.format(result, skill.metadata.name, command.name);
      
    } catch (error) {
      // 处理执行错误
      return this.formatExecutionError(error, request, startTime);
    }
  }
  
  private async loadSkill(skillId: string): Promise<ParsedSkill> {
    // 从数据库获取 Skill 路径
    const skillPath = await this.getSkillPathFromDB(skillId);
    
    // 解析 SKILL.md
    return this.parser.parse(skillPath);
  }
  
  private findCommand(skill: ParsedSkill, commandName: string): CommandDef | undefined {
    return skill.commands.find(cmd => cmd.name === commandName);
  }
  
  private formatValidationError(errors: ValidationError[]): SkillExecutionResponse {
    return {
      status: 'error',
      error: {
        code: 'VALIDATION_ERROR',
        message: '参数校验失败',
        details: errors
      },
      execution: {
        skillName: '',
        commandName: '',
        duration: 0,
        timestamp: Date.now()
      }
    };
  }
  
  private formatExecutionError(
    error: Error,
    request: ExecutionRequest,
    startTime: number
  ): SkillExecutionResponse {
    return {
      status: 'error',
      error: {
        code: 'EXECUTION_ERROR',
        message: error.message,
        details: {
          stack: error.stack
        }
      },
      execution: {
        skillName: request.skillId,
        commandName: request.commandName,
        duration: Date.now() - startTime,
        timestamp: Date.now()
      }
    };
  }
}
```

### 7.2 执行请求格式

```typescript
interface ExecutionRequest {
  skillId: string;                    // Skill ID
  commandName: string;                // 命令名称
  params: Record<string, unknown>;    // 执行参数
  envVars: Record<string, string>;    // 环境变量
  config: Record<string, unknown>;    // Skill 配置
  context?: {                         // 执行上下文
    sessionId?: string;
    userId?: string;
    agentId?: string;
  };
}
```

## 8. 性能优化

### 8.1 Skill 缓存

```typescript
class SkillCache {
  private cache: Map<string, CachedSkill>;
  private ttl: number;  // 缓存时间（毫秒）
  
  constructor(ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  get(skillId: string): ParsedSkill | null {
    const cached = this.cache.get(skillId);
    if (!cached) return null;
    
    // 检查是否过期
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(skillId);
      return null;
    }
    
    return cached.skill;
  }
  
  set(skillId: string, skill: ParsedSkill): void {
    this.cache.set(skillId, {
      skill,
      timestamp: Date.now()
    });
  }
  
  invalidate(skillId: string): void {
    this.cache.delete(skillId);
  }
}
```

### 8.2 连接池

对于需要保持连接的 Skill（如数据库连接），使用连接池：

```typescript
interface ConnectionPool {
  acquire(): Promise<Connection>;
  release(connection: Connection): void;
}
```

## 9. 监控和日志

### 9.1 执行日志

```typescript
interface ExecutionLog {
  logId: string;              // 日志ID
  skillId: string;            // Skill ID
  commandName: string;        // 命令名称
  params: Record<string, unknown>;  // 参数（脱敏）
  result: ExecutionResult;    // 执行结果
  context: ExecutionContext;  // 执行上下文
  timestamp: number;          // 时间戳
}
```

### 9.2 性能指标

| 指标 | 说明 |
|-----|------|
| 执行成功率 | 成功执行次数 / 总执行次数 |
| 平均执行时间 | 所有执行的平均耗时 |
| 错误率 | 错误次数 / 总执行次数 |
| 重试率 | 重试次数 / 总执行次数 |

## 10. 关联文档

- [系统技能管理](./skill.md)
- [AgentSkills 标准](https://agentskills.io)
- [系统技能表](./database/t_skill.md)
- [Agent 技能关联表](../agents/database/r_agent_skill.md)
