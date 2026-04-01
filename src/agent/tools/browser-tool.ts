/**
 * 浏览器自动化模块 - Browser Tool
 */

import { z } from "zod";
import { defineTool, type ToolDefinition } from "./tool-definitions.js";
import type { ToolContext } from "./tool-context.js";
import {
  getBrowserControlPort,
  getBrowserAuthToken,
} from "../browser/index.js";

const BrowserActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("navigate"),
    url: z.string().describe("The URL to navigate to"),
    timeoutMs: z.number().optional().describe("Navigation timeout in milliseconds"),
    waitUntil: z.enum(["load", "domcontentloaded", "networkidle"]).optional().describe("Wait condition"),
  }),
  z.object({
    action: z.literal("snapshot"),
    format: z.enum(["ai", "aria", "role"]).optional().describe("Snapshot format"),
    selector: z.string().optional().describe("CSS selector to limit snapshot scope"),
    limit: z.number().optional().describe("Maximum number of elements to return"),
  }),
  z.object({
    action: z.literal("click"),
    ref: z.string().describe("Element reference from snapshot"),
    button: z.enum(["left", "right", "middle"]).optional(),
    clickCount: z.number().optional(),
    delayMs: z.number().optional(),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("type"),
    ref: z.string().describe("Element reference from snapshot"),
    text: z.string().describe("Text to type"),
    submit: z.boolean().optional().describe("Press Enter after typing"),
    clear: z.boolean().optional().describe("Clear existing text first"),
    delayMs: z.number().optional(),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("hover"),
    ref: z.string().describe("Element reference from snapshot"),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("drag"),
    startRef: z.string().describe("Source element reference"),
    endRef: z.string().describe("Target element reference"),
    timeoutMs: z.number().optional(),
    steps: z.number().optional(),
  }),
  z.object({
    action: z.literal("select"),
    ref: z.string().describe("Element reference from snapshot"),
    values: z.array(z.string()).describe("Values to select"),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("press"),
    key: z.string().describe("Key to press (e.g., 'Enter', 'Tab', 'Escape')"),
    delayMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("screenshot"),
    fullPage: z.boolean().optional().describe("Capture full page"),
    selector: z.string().optional().describe("CSS selector to capture specific element"),
    type: z.enum(["png", "jpeg"]).optional(),
    quality: z.number().optional(),
  }),
  z.object({
    action: z.literal("wait"),
    selector: z.string().optional().describe("CSS selector to wait for"),
    timeoutMs: z.number().optional(),
    state: z.enum(["visible", "hidden", "attached", "detached"]).optional(),
    url: z.string().optional().describe("URL to wait for"),
    urlPattern: z.string().optional().describe("URL regex pattern to wait for"),
  }),
  z.object({
    action: z.literal("evaluate"),
    fn: z.string().describe("JavaScript function to execute"),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("fillForm"),
    fields: z.array(z.object({
      ref: z.string(),
      value: z.string(),
    })).describe("Form fields to fill"),
    timeoutMs: z.number().optional(),
  }),
  z.object({
    action: z.literal("listTabs"),
  }),
  z.object({
    action: z.literal("openTab"),
    url: z.string().describe("URL to open in new tab"),
  }),
  z.object({
    action: z.literal("focusTab"),
    targetId: z.string().describe("Tab ID to focus"),
  }),
  z.object({
    action: z.literal("closeTab"),
    targetId: z.string().describe("Tab ID to close"),
  }),
  z.object({
    action: z.literal("highlight"),
    ref: z.string().describe("Element reference to highlight"),
  }),
]);

type BrowserAction = z.infer<typeof BrowserActionSchema>;

interface BrowserToolContext extends ToolContext {
  browserControlPort?: number;
  browserToken?: string;
  browserProfile?: string;
}

export const BrowserTool = defineTool("browser", {
  description: `Control a web browser for automation tasks.

This tool allows you to:
- Navigate to URLs
- Take snapshots of page content (returns element references for interaction)
- Click, type, hover, drag, and select elements
- Take screenshots
- Wait for elements or conditions
- Execute JavaScript
- Manage browser tabs

Usage pattern:
1. Navigate to a URL with 'navigate'
2. Get a snapshot with 'snapshot' (returns element refs like 'e1', 'e2', etc.)
3. Interact with elements using their refs (click, type, etc.)
4. Repeat as needed

The snapshot returns elements with refs that you use for interactions.
Example: snapshot returns [button "Submit" ref=e1], then use click ref="e1"`,
  parameters: BrowserActionSchema,
  async execute(args: BrowserAction, ctx: BrowserToolContext) {
    const port = ctx.browserControlPort ?? getBrowserControlPort() ?? 18791;
    const token = ctx.browserToken ?? getBrowserAuthToken() ?? "";
    const profile = ctx.browserProfile ?? "default";
    
    const baseUrl = `http://127.0.0.1:${port}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const profileParam = `?profile=${encodeURIComponent(profile)}`;
    
    try {
      let response: Response;
      let result: any;
      
      switch (args.action) {
        case "navigate":
          response = await fetch(`${baseUrl}/navigate${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "snapshot":
          const params = new URLSearchParams();
          if (args.format) params.set("format", args.format);
          if (args.selector) params.set("selector", args.selector);
          if (args.limit) params.set("limit", args.limit.toString());
          params.set("profile", profile);
          response = await fetch(`${baseUrl}/snapshot?${params}`, { headers });
          break;
          
        case "click":
        case "type":
        case "hover":
        case "drag":
        case "select":
        case "press":
          response = await fetch(`${baseUrl}/act${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "screenshot":
          response = await fetch(`${baseUrl}/screenshot${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "wait":
          response = await fetch(`${baseUrl}/wait${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "evaluate":
          response = await fetch(`${baseUrl}/evaluate${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "fillForm":
          response = await fetch(`${baseUrl}/fill-form${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify(args),
          });
          break;
          
        case "listTabs":
          response = await fetch(`${baseUrl}/tabs${profileParam}`, { headers });
          break;
          
        case "openTab":
          response = await fetch(`${baseUrl}/tabs/open${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ url: args.url }),
          });
          break;
          
        case "focusTab":
          response = await fetch(`${baseUrl}/tabs/focus${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ targetId: args.targetId }),
          });
          break;
          
        case "closeTab":
          response = await fetch(`${baseUrl}/tabs/${args.targetId}${profileParam}`, {
            method: "DELETE",
            headers,
          });
          break;
          
        case "highlight":
          response = await fetch(`${baseUrl}/highlight${profileParam}`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ref: args.ref }),
          });
          break;
          
        default:
          throw new Error(`Unknown browser action: ${(args as any).action}`);
      }
      
      result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error ?? `Browser API error: ${response.status}`);
      }
      
      const output = formatBrowserResult(args.action, result);
      
      return {
        title: `Browser: ${args.action}`,
        output,
        metadata: result,
      };
    } catch (error) {
      throw new Error(
        `Browser action '${args.action}' failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  },
});

function formatBrowserResult(action: string, result: any): string {
  switch (action) {
    case "navigate":
      return `Navigated to: ${result.url}`;
      
    case "snapshot":
      if (result.elements && Array.isArray(result.elements)) {
        const elements = result.elements
          .map((el: any) => {
            const parts = [el.type ?? el.role, el.description ?? el.name ?? ""];
            if (el.ref) parts.push(`[ref=${el.ref}]`);
            return `- ${parts.join(" ")}`;
          })
          .join("\n");
        return `Page elements:\n${elements}\n\nPage text preview: ${(result.pageText ?? "").slice(0, 500)}...`;
      }
      return JSON.stringify(result, null, 2);
      
    case "screenshot":
      return `Screenshot captured (${result.size} bytes, ${result.mimeType})`;
      
    case "listTabs":
      if (result.tabs && Array.isArray(result.tabs)) {
        return result.tabs
          .map((tab: any) => `${tab.active ? "*" : " "} ${tab.targetId}: ${tab.url}`)
          .join("\n");
      }
      return JSON.stringify(result, null, 2);
      
    case "evaluate":
      return `Result: ${JSON.stringify(result.result, null, 2)}`;
      
    default:
      return result.success ? `Action '${action}' completed successfully` : JSON.stringify(result, null, 2);
  }
}

export const ALL_BROWSER_TOOLS: ToolDefinition[] = [BrowserTool];
