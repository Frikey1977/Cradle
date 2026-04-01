/**
 * 浏览器操作录制路由
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { BrowserRouteContext } from "./context.js";
import { globalRecorder } from "../recorder/index.js";
import { formatSessionForLLM, type RecordingSession } from "../recorder/types.js";
import { readFile } from "fs/promises";
import { resolve } from "path";

export function registerRecorderRoutes(app: FastifyInstance, ctx: BrowserRouteContext): void {
  app.post("/recording/start", handleStartRecording(ctx));
  app.post("/recording/stop", handleStopRecording(ctx));
  app.get("/recording/status", handleRecordingStatus(ctx));
  app.get("/recording/actions", handleGetActions(ctx));
  app.get("/recording/action/:index", handleGetSingleAction(ctx));
  app.post("/recording/replay", handleReplayRecording(ctx));
  app.post("/recording/replay/:index", handleReplaySingleAction(ctx));
  app.post("/recording/replay-from/:startIndex", handleReplayFrom(ctx));
  app.post("/recording/execute", handleExecuteActionJson(ctx));
  app.get("/recording/export", handleExportRecording(ctx));
  app.post("/recording/load", handleLoadRecording(ctx));
  
  // 回放控制端点
  app.post("/recording/replay/pause", handlePauseReplay(ctx));
  app.post("/recording/replay/resume", handleResumeReplay(ctx));
  app.post("/recording/replay/stop", handleStopReplay(ctx));
  app.get("/recording/replay/status", handleReplayStatus(ctx));
}

function handleStartRecording(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { profile?: string };
      Body?: { name?: string; description?: string; tags?: string[] };
    }>,
    reply: FastifyReply
  ) => {
    try {
      if (globalRecorder.isRecording()) {
        return reply.code(400).send({ error: "Recording already in progress" });
      }

      const profileName = req.query.profile;
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const session = await globalRecorder.startRecording(page, {
        name: req.body?.name,
        description: req.body?.description,
        tags: req.body?.tags,
      });

      return reply.send({
        success: true,
        session: {
          id: session.id,
          name: session.name,
          startTime: session.startTime,
          startUrl: session.metadata.startUrl,
        },
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleStopRecording(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const session = await globalRecorder.stopRecording();

      if (!session) {
        return reply.code(400).send({ error: "No recording in progress" });
      }

      return reply.send({
        success: true,
        session: {
          id: session.id,
          name: session.name,
          startTime: session.startTime,
          endTime: session.endTime,
          actionCount: session.actions.length,
        },
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleRecordingStatus(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const isRecording = globalRecorder.isRecording();
      const session = globalRecorder.getSession();

      return reply.send({
        isRecording,
        session: session
          ? {
              id: session.id,
              name: session.name,
              startTime: session.startTime,
              actionCount: session.actions.length,
              startUrl: session.metadata.startUrl,
            }
          : null,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleGetActions(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { format?: "json" | "llm" };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const session = globalRecorder.getSession();

      if (!session) {
        return reply.code(400).send({ error: "No recording in progress" });
      }

      const format = req.query.format || "json";

      if (format === "llm") {
        const llmText = formatSessionForLLM(session);
        return reply.type("text/plain").send(llmText);
      }

      return reply.send({
        success: true,
        actions: session.actions,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleGetSingleAction(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Params: { index: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const index = parseInt(req.params.index, 10);
      
      if (isNaN(index) || index < 0) {
        return reply.code(400).send({ error: "Invalid action index" });
      }

      const action = globalRecorder.getAction(index);

      if (!action) {
        return reply.code(404).send({ error: `Action at index ${index} not found` });
      }

      return reply.send({
        success: true,
        index,
        totalActions: globalRecorder.getActions().length,
        action,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleReplaySingleAction(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Params: { index: string };
      Querystring: { profile?: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const index = parseInt(req.params.index, 10);
      
      if (isNaN(index) || index < 0) {
        return reply.code(400).send({ error: "Invalid action index" });
      }

      const profileName = req.query.profile;
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const result = await globalRecorder.replaySingleAction(page, index);

      return reply.send({
        success: result.success,
        index,
        action: result.action ? {
          type: result.action.type,
          selector: result.action.selector,
          element: result.action.element?.tagName,
          text: result.action.element?.text?.substring(0, 50),
        } : null,
        error: result.error,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleReplayFrom(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Params: { startIndex: string };
      Querystring: { 
        profile?: string;
        count?: number;
        delay?: number;
        useOriginalTiming?: string;
        speedMultiplier?: number;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const startIndex = parseInt(req.params.startIndex, 10);
      
      if (isNaN(startIndex) || startIndex < 0) {
        return reply.code(400).send({ error: "Invalid start index" });
      }

      const session = globalRecorder.getLastSession();

      if (!session || session.actions.length === 0) {
        return reply.code(400).send({ error: "No recording available to replay" });
      }

      const profileName = req.query.profile;
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const delay = req.query.delay ?? 500;
      const useOriginalTiming = req.query.useOriginalTiming !== "false";
      const speedMultiplier = req.query.speedMultiplier ?? 1;
      const count = req.query.count;

      const result = await globalRecorder.replayFrom(page, startIndex, {
        count,
        delay,
        useOriginalTiming,
        speedMultiplier,
        onAction: (action, i) => {
          console.log(`[Replay] Action ${startIndex + i + 1}/${session.actions.length}: ${action.type}`);
        },
      });

      return reply.send({
        success: result.success,
        replayedCount: result.replayedCount,
        startIndex: result.startIndex,
        endIndex: result.endIndex,
        totalActions: session.actions.length,
        errors: result.errors,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleExecuteActionJson(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { profile?: string; showCursor?: string };
      Body: Record<string, unknown>;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const actionJson = req.body;

      if (!actionJson || typeof actionJson !== "object") {
        return reply.code(400).send({ error: "Request body must be a JSON object" });
      }

      if (!actionJson.type) {
        return reply.code(400).send({ error: "Action must have a 'type' field (e.g., 'click', 'hover', 'input')" });
      }

      const profileName = req.query.profile;
      const showCursor = req.query.showCursor !== "false";
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const result = await globalRecorder.executeActionJson(page, actionJson, showCursor);

      return reply.send({
        success: result.success,
        action: result.action ? {
          id: result.action.id,
          type: result.action.type,
          selector: result.action.selector,
          element: result.action.element?.tagName,
          text: result.action.element?.text?.substring(0, 50),
        } : null,
        error: result.error,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleExportRecording(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { format?: "json" | "llm" | "markdown" };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const session = globalRecorder.getSession();

      if (!session) {
        return reply.code(400).send({ error: "No recording available" });
      }

      const format = req.query.format || "json";

      if (format === "llm" || format === "markdown") {
        const llmText = formatSessionForLLM(session);
        return reply.type("text/markdown").send(llmText);
      }

      return reply.type("application/json").send(JSON.stringify(session, null, 2));
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleReplayRecording(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Querystring: { 
        profile?: string; 
        delay?: number;
        useOriginalTiming?: string;
        speedMultiplier?: number;
        showCursor?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const session = globalRecorder.getLastSession();

      if (!session || session.actions.length === 0) {
        return reply.code(400).send({ error: "No recording available to replay" });
      }

      const profileName = req.query.profile;
      const driver = await ctx.profileManager.ensureDriver(profileName);
      const page = driver.getActivePage();

      if (!page) {
        return reply.code(400).send({ error: "No active page available" });
      }

      const delay = req.query.delay ?? 500;
      const useOriginalTiming = req.query.useOriginalTiming !== "false";
      const speedMultiplier = req.query.speedMultiplier ?? 1;
      const showCursor = req.query.showCursor !== "false";

      const result = await globalRecorder.replay(page, {
        delay,
        useOriginalTiming,
        speedMultiplier,
        showCursor,
        onAction: (action, index) => {
          const nextAction = session.actions[index + 1];
          let interval = 0;
          if (useOriginalTiming && nextAction && action.timestamp) {
            interval = nextAction.timestamp - action.timestamp;
          }
          console.log(`[Replay] Action ${index + 1}/${session.actions.length}: ${action.type} (interval: ${interval}ms)`);
        },
      });

      return reply.send({
        success: result.success,
        replayedCount: result.replayedCount,
        totalActions: session.actions.length,
        errors: result.errors,
        timing: {
          useOriginalTiming,
          speedMultiplier,
        },
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleLoadRecording(ctx: BrowserRouteContext) {
  return async (
    req: FastifyRequest<{
      Body: { filePath: string };
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        return reply.code(400).send({ error: "filePath is required" });
      }

      const absolutePath = resolve(process.cwd(), filePath);
      let content = await readFile(absolutePath, "utf-8");
      
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      
      const session: RecordingSession = JSON.parse(content);

      if (!session.id || !session.actions || !Array.isArray(session.actions)) {
        return reply.code(400).send({ error: "Invalid recording file format" });
      }

      globalRecorder.loadSession(session);

      return reply.send({
        success: true,
        sessionId: session.id,
        name: session.name,
        actionCount: session.actions.length,
        startTime: session.startTime,
        endTime: session.endTime,
      });
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

// ==================== 回放控制处理函数 ====================

function handlePauseReplay(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = globalRecorder.pauseReplay();
      return reply.send(result);
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleResumeReplay(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = globalRecorder.resumeReplay();
      return reply.send(result);
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleStopReplay(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = globalRecorder.stopReplay();
      return reply.send(result);
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}

function handleReplayStatus(ctx: BrowserRouteContext) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = globalRecorder.getReplayStatus();
      return reply.send(result);
    } catch (error) {
      return reply.code(500).send({ error: String(error) });
    }
  };
}
