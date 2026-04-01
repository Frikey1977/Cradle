import type { ToolDefinition } from "../../llm/runtime/types.js";
import type { SkillEntry } from "../skills/types.js";

export interface OrchestratorToolParams {
  skills: string[];
  taskDescription: string;
}

export interface ExecutorToolParams {
  skillName: string;
  taskDescription: string;
}

export interface HandlerToolParams {
  command: "read" | "write" | "exec";
  params: {
    file_path?: string;
    content?: string;
    command?: string;
    cwd?: string;
  };
}

export function buildOrchestratorTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "orchestrator",
      description: `编排执行复杂任务。适用于：
- 需要多个 Skill 协作的复杂任务
- 有依赖关系的多步骤任务
- 需要并行处理的任务`,
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description: "注意：只选择实现用户意图所需要用到的Skill，在系统提示词中可用 Skills 中进行选择",
          },
          taskDescription: {
            type: "string",
            description: "任务描述和相关上下文，包括用户的具体需求和期望结果",
          },
        },
        required: ["skills", "taskDescription"],
      },
    },
  };
}

export function buildExecutorTool(availableSkills: SkillEntry[]): ToolDefinition {
  const skillNames = availableSkills.map(s => s.name);
  
  return {
    type: "function",
    function: {
      name: "executor",
      description: `执行单一 Skill 任务。适用于：
- 明确只需要一个 Skill 的简单任务
- 单一步骤即可完成的任务
`,
      parameters: {
        type: "object",
        properties: {
          skillName: {
            type: "string",
            enum: skillNames,
            description: "要执行的 Skill 名称",
          },
          taskDescription: {
            type: "string",
            description: "任务描述和相关上下文，包括用户的具体需求和期望结果",
          },
        },
        required: ["skillName", "taskDescription"],
      },
    },
  };
}

export function buildHandlerTool(): ToolDefinition {
  return {
    type: "function",
    function: {
      name: "handler",
      description: `轻量级任务执行器。具有自主推理和执行能力，可以处理简单的文件操作和命令执行任务。适用于：
- 文件读取、写入操作
- 目录管理（自动创建不存在的目录）
- 简单的命令执行
- 需要少量步骤完成的确定性任务

Handler 会自动处理常见问题，如目录不存在时自动创建。`,
      parameters: {
        type: "object",
        properties: {
          taskDescription: {
            type: "string",
            description: "任务描述，清晰说明需要执行的操作和目标",
          },
        },
        required: ["taskDescription"],
      },
    },
  };
}

export function buildAgentTools(availableSkills: SkillEntry[]): ToolDefinition[] {
  return [
    buildOrchestratorTool(),
    buildExecutorTool(availableSkills),
    buildHandlerTool(),
  ];
}