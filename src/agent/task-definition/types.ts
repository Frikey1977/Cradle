/**
 * 任务定义类型
 *
 * 支持 JSON 格式的任务定义，包含条件分支、并行执行、用户确认等
 */

export type TaskStepType = "serial" | "parallel" | "conditional" | "loop" | "confirm" | "skill" | "action";

export interface TaskCondition {
  type: "equals" | "not_equals" | "contains" | "not_contains" | "exists" | "not_exists" | "greater_than" | "less_than" | "regex";
  field: string;
  value?: unknown;
  source?: "context" | "result" | "env";
}

export interface TaskBranch {
  condition: TaskCondition;
  steps: TaskStep[];
  label?: string;
}

export interface TaskStep {
  id: string;
  type: TaskStepType;
  name: string;
  description?: string;
  
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  
  continueOnError?: boolean;
  skipIfFailed?: boolean;
  
  skill?: {
    id: string;
    action?: string;
    params?: Record<string, unknown>;
  };
  
  action?: {
    type: string;
    params?: Record<string, unknown>;
  };
  
  steps?: TaskStep[];
  
  branches?: TaskBranch[];
  defaultBranch?: TaskStep[];
  
  condition?: TaskCondition;
  
  maxIterations?: number;
  exitCondition?: TaskCondition;
  
  confirmMessage?: string;
  confirmOptions?: Array<{
    label: string;
    value: string;
    default?: boolean;
  }>;
  timeoutSeconds?: number;
  defaultChoice?: string;
  
  outputMapping?: Record<string, string>;
  
  dependsOn?: string[];
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  version?: string;
  
  inputs?: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "object" | "array";
    required?: boolean;
    default?: unknown;
    description?: string;
  }>;
  
  outputs?: Array<{
    name: string;
    source: string;
    description?: string;
  }>;
  
  steps: TaskStep[];
  
  variables?: Record<string, unknown>;
  
  onError?: {
    action: "continue" | "abort" | "retry";
    maxRetries?: number;
    notifyUser?: boolean;
  };
  
  metadata?: Record<string, unknown>;
}

export interface TaskExecutionContext {
  worktaskId: string;
  agentId: string;
  contactId: string;
  conversationId?: string;
  
  inputs: Record<string, unknown>;
  variables: Record<string, unknown>;
  
  results: Map<string, TaskStepResult>;
  
  currentStepIndex: number;
  iterationCount: number;
  
  userConfirmRequired: boolean;
  userConfirmData?: {
    stepId: string;
    message: string;
    options: Array<{ label: string; value: string }>;
  };
  userChoice?: string;
  
  startTime: Date;
  lastActivityTime: Date;
}

export interface TaskStepResult {
  stepId: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  output?: unknown;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  retries?: number;
}

export interface TaskExecutionResult {
  success: boolean;
  outputs: Record<string, unknown>;
  stepResults: TaskStepResult[];
  error?: string;
  duration: number;
  userConfirmRequired?: boolean;
  userConfirmData?: TaskExecutionContext["userConfirmData"];
}

export function validateTaskDefinition(definition: unknown): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!definition || typeof definition !== "object") {
    return { valid: false, errors: ["Definition must be an object"] };
  }

  const def = definition as Partial<TaskDefinition>;

  if (!def.id || typeof def.id !== "string") {
    errors.push("Missing or invalid 'id' field");
  }

  if (!def.name || typeof def.name !== "string") {
    errors.push("Missing or invalid 'name' field");
  }

  if (!Array.isArray(def.steps) || def.steps.length === 0) {
    errors.push("Missing or empty 'steps' array");
  } else {
    def.steps.forEach((step, index) => {
      const stepErrors = validateStep(step, index);
      errors.push(...stepErrors);
    });
  }

  if (def.inputs) {
    if (!Array.isArray(def.inputs)) {
      errors.push("'inputs' must be an array");
    } else {
      def.inputs.forEach((input, index) => {
        if (!input.name) {
          errors.push(`Input at index ${index} missing 'name'`);
        }
        if (!["string", "number", "boolean", "object", "array"].includes(input.type)) {
          errors.push(`Input '${input.name}' has invalid type: ${input.type}`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateStep(step: TaskStep, index: number): string[] {
  const errors: string[] = [];

  if (!step.id) {
    errors.push(`Step at index ${index} missing 'id'`);
  }

  if (!step.type) {
    errors.push(`Step '${step.id || index}' missing 'type'`);
  }

  if (!step.name) {
    errors.push(`Step '${step.id || index}' missing 'name'`);
  }

  const validTypes: TaskStepType[] = ["serial", "parallel", "conditional", "loop", "confirm", "skill", "action"];
  if (!validTypes.includes(step.type)) {
    errors.push(`Step '${step.id}' has invalid type: ${step.type}`);
  }

  switch (step.type) {
    case "skill":
      if (!step.skill?.id) {
        errors.push(`Skill step '${step.id}' missing skill.id`);
      }
      break;

    case "action":
      if (!step.action?.type) {
        errors.push(`Action step '${step.id}' missing action.type`);
      }
      break;

    case "serial":
    case "parallel":
      if (!step.steps || step.steps.length === 0) {
        errors.push(`${step.type} step '${step.id}' missing or empty steps`);
      }
      break;

    case "conditional":
      if (!step.branches || step.branches.length === 0) {
        errors.push(`Conditional step '${step.id}' missing branches`);
      }
      break;

    case "loop":
      if (!step.steps || step.steps.length === 0) {
        errors.push(`Loop step '${step.id}' missing steps`);
      }
      break;

    case "confirm":
      if (!step.confirmMessage) {
        errors.push(`Confirm step '${step.id}' missing confirmMessage`);
      }
      break;
  }

  return errors;
}

export function createTaskDefinition(params: {
  id: string;
  name: string;
  description?: string;
  steps: TaskStep[];
  inputs?: TaskDefinition["inputs"];
  outputs?: TaskDefinition["outputs"];
  variables?: Record<string, unknown>;
}): TaskDefinition {
  return {
    id: params.id,
    name: params.name,
    description: params.description,
    steps: params.steps,
    inputs: params.inputs,
    outputs: params.outputs,
    variables: params.variables,
  };
}
