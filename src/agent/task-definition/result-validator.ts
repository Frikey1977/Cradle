/**
 * 结果验证器
 *
 * 验证任务执行结果，支持多种验证规则
 */

import type { TaskStepResult } from "./types.js";

export type ValidationRuleType =
  | "required"
  | "type"
  | "minLength"
  | "maxLength"
  | "minValue"
  | "maxValue"
  | "pattern"
  | "enum"
  | "custom";

export interface ValidationRule {
  type: ValidationRuleType;
  field?: string;
  value?: unknown;
  message?: string;
  customValidator?: (value: unknown, context: ValidationContext) => boolean | string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

export interface ValidationError {
  field: string;
  rule: ValidationRuleType;
  message: string;
  value?: unknown;
}

export interface ValidationContext {
  stepResult: TaskStepResult;
  allResults: Map<string, TaskStepResult>;
  variables: Record<string, unknown>;
  inputs: Record<string, unknown>;
}

export class ResultValidator {
  private rules: Map<string, ValidationRule[]> = new Map();

  addRule(stepId: string, rule: ValidationRule): void {
    if (!this.rules.has(stepId)) {
      this.rules.set(stepId, []);
    }
    this.rules.get(stepId)!.push(rule);
  }

  addRules(stepId: string, rules: ValidationRule[]): void {
    for (const rule of rules) {
      this.addRule(stepId, rule);
    }
  }

  clearRules(stepId?: string): void {
    if (stepId) {
      this.rules.delete(stepId);
    } else {
      this.rules.clear();
    }
  }

  validate(
    stepId: string,
    context: ValidationContext
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const rules = this.rules.get(stepId) || [];

    for (const rule of rules) {
      const value = rule.field
        ? this.getNestedValue(context.stepResult.output, rule.field)
        : context.stepResult.output;

      const error = this.applyRule(rule, value, context);
      if (error) {
        errors.push({
          field: rule.field || "output",
          rule: rule.type,
          message: error,
          value,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateAll(
    results: Map<string, TaskStepResult>,
    context: Omit<ValidationContext, "stepResult" | "allResults">
  ): Map<string, ValidationResult> {
    const validationResults = new Map<string, ValidationResult>();

    for (const [stepId, stepResult] of results) {
      const result = this.validate(stepId, {
        ...context,
        stepResult,
        allResults: results,
      });
      validationResults.set(stepId, result);
    }

    return validationResults;
  }

  private applyRule(
    rule: ValidationRule,
    value: unknown,
    context: ValidationContext
  ): string | null {
    switch (rule.type) {
      case "required":
        if (value === undefined || value === null || value === "") {
          return rule.message || "Field is required";
        }
        break;

      case "type":
        const expectedType = rule.value as string;
        const actualType = this.getType(value);
        if (actualType !== expectedType) {
          return rule.message || `Expected type ${expectedType}, got ${actualType}`;
        }
        break;

      case "minLength":
        const minLen = rule.value as number;
        if (typeof value === "string" && value.length < minLen) {
          return rule.message || `Minimum length is ${minLen}`;
        }
        if (Array.isArray(value) && value.length < minLen) {
          return rule.message || `Minimum array length is ${minLen}`;
        }
        break;

      case "maxLength":
        const maxLen = rule.value as number;
        if (typeof value === "string" && value.length > maxLen) {
          return rule.message || `Maximum length is ${maxLen}`;
        }
        if (Array.isArray(value) && value.length > maxLen) {
          return rule.message || `Maximum array length is ${maxLen}`;
        }
        break;

      case "minValue":
        const minVal = rule.value as number;
        if (typeof value === "number" && value < minVal) {
          return rule.message || `Minimum value is ${minVal}`;
        }
        break;

      case "maxValue":
        const maxVal = rule.value as number;
        if (typeof value === "number" && value > maxVal) {
          return rule.message || `Maximum value is ${maxVal}`;
        }
        break;

      case "pattern":
        const pattern = rule.value as string;
        const regex = new RegExp(pattern);
        if (typeof value === "string" && !regex.test(value)) {
          return rule.message || `Value does not match pattern ${pattern}`;
        }
        break;

      case "enum":
        const allowedValues = rule.value as unknown[];
        if (!allowedValues.includes(value)) {
          return rule.message || `Value must be one of: ${allowedValues.join(", ")}`;
        }
        break;

      case "custom":
        if (rule.customValidator) {
          const result = rule.customValidator(value, context);
          if (result !== true) {
            return typeof result === "string" ? result : rule.message || "Custom validation failed";
          }
        }
        break;
    }

    return null;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    if (!path) return obj;
    
    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private getType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }
}

export function createResultValidator(): ResultValidator {
  return new ResultValidator();
}

export const commonValidationRules = {
  required: (field: string, message?: string): ValidationRule => ({
    type: "required",
    field,
    message,
  }),

  type: (field: string, expectedType: string, message?: string): ValidationRule => ({
    type: "type",
    field,
    value: expectedType,
    message,
  }),

  minLength: (field: string, min: number, message?: string): ValidationRule => ({
    type: "minLength",
    field,
    value: min,
    message,
  }),

  maxLength: (field: string, max: number, message?: string): ValidationRule => ({
    type: "maxLength",
    field,
    value: max,
    message,
  }),

  pattern: (field: string, pattern: string, message?: string): ValidationRule => ({
    type: "pattern",
    field,
    value: pattern,
    message,
  }),

  enum: (field: string, values: unknown[], message?: string): ValidationRule => ({
    type: "enum",
    field,
    value: values,
    message,
  }),

  custom: (
    field: string,
    validator: (value: unknown, context: ValidationContext) => boolean | string,
    message?: string
  ): ValidationRule => ({
    type: "custom",
    field,
    customValidator: validator,
    message,
  }),
};
