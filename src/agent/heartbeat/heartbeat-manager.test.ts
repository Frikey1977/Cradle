/**
 * HeartbeatManager 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HeartbeatManager } from "./heartbeat-manager.js";
import type { HeartbeatConfig, HeartbeatEvent } from "./types.js";

describe("HeartbeatManager", () => {
  let manager: HeartbeatManager;
  let mockOnExecute: ReturnType<typeof vi.fn>;
  let mockOnEvent: ReturnType<typeof vi.fn>;
  let defaultConfig: HeartbeatConfig;

  beforeEach(() => {
    vi.useFakeTimers();

    mockOnExecute = vi.fn().mockResolvedValue("HEARTBEAT_OK");
    mockOnEvent = vi.fn();

    defaultConfig = {
      enabled: true,
      intervalSeconds: 30,
      activeHours: {
        start: "00:00",
        end: "23:59",
        timezone: "Asia/Shanghai",
      },
      prompt: "Test prompt",
    };

    manager = new HeartbeatManager({
      agentId: "test-agent",
      config: defaultConfig,
      onExecute: mockOnExecute,
      onEvent: mockOnEvent,
    });
  });

  afterEach(() => {
    manager.destroy();
    vi.useRealTimers();
  });

  describe("start", () => {
    it("should start heartbeat when enabled", () => {
      manager.start();

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "started",
          agentId: "test-agent",
        })
      );
    });

    it("should not start when already running", () => {
      manager.start();
      mockOnEvent.mockClear();
      manager.start();

      expect(mockOnEvent).not.toHaveBeenCalled();
    });

    it("should not start when disabled", () => {
      manager.updateConfig({ ...defaultConfig, enabled: false });
      mockOnEvent.mockClear();
      manager.start();

      expect(mockOnEvent).not.toHaveBeenCalled();
    });
  });

  describe("stop", () => {
    it("should stop heartbeat", () => {
      manager.start();
      mockOnEvent.mockClear();
      manager.stop();

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "stopped",
          agentId: "test-agent",
        })
      );
    });

    it("should not stop when not running", () => {
      manager.stop();

      expect(mockOnEvent).not.toHaveBeenCalled();
    });
  });

  describe("triggerNow", () => {
    it("should trigger heartbeat immediately", async () => {
      manager.start();
      vi.advanceTimersByTime(250);

      manager.triggerNow();
      vi.advanceTimersByTime(250);

      expect(mockOnExecute).toHaveBeenCalledWith("Test prompt");
    });

    it("should coalesce multiple triggers", async () => {
      manager.start();
      vi.advanceTimersByTime(250);

      manager.triggerNow();
      manager.triggerNow();
      manager.triggerNow();
      vi.advanceTimersByTime(250);

      expect(mockOnExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateConfig", () => {
    it("should update config and restart if running", () => {
      manager.start();
      mockOnEvent.mockClear();

      const newConfig: HeartbeatConfig = {
        ...defaultConfig,
        intervalSeconds: 60,
      };

      manager.updateConfig(newConfig);

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "stopped",
        })
      );
      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "started",
        })
      );
    });

    it("should update config without restart if not running", () => {
      const newConfig: HeartbeatConfig = {
        ...defaultConfig,
        intervalSeconds: 60,
      };

      manager.updateConfig(newConfig);
      const config = manager.getConfig();

      expect(config.intervalSeconds).toBe(60);
    });
  });

  describe("getState", () => {
    it("should return current state", () => {
      const state = manager.getState();

      expect(state).toEqual({
        isRunning: false,
        lastRunAt: null,
        nextDueAt: null,
        consecutiveErrors: 0,
        lastError: null,
        status: "idle",
      });
    });

    it("should return running state after start", () => {
      manager.start();
      const state = manager.getState();

      expect(state.isRunning).toBe(true);
      expect(state.nextDueAt).not.toBeNull();
    });
  });

  describe("getConfig", () => {
    it("should return current config", () => {
      const config = manager.getConfig();

      expect(config).toEqual(defaultConfig);
    });
  });

  describe("setBusy", () => {
    it("should skip heartbeat when busy", async () => {
      manager.start();
      vi.advanceTimersByTime(250);

      manager.setBusy(true);

      // Trigger heartbeat
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "skipped",
          data: expect.objectContaining({ reason: "busy" }),
        })
      );
    });
  });

  describe("execution", () => {
    it("should execute heartbeat after interval", async () => {
      manager.start();

      // Wait for initial delay
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockOnExecute).toHaveBeenCalledWith("Test prompt");
      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "completed",
        })
      );
    });

    it("should handle execution errors", async () => {
      mockOnExecute.mockRejectedValue(new Error("Test error"));

      manager.start();
      await vi.advanceTimersByTimeAsync(30000);

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          data: expect.objectContaining({ error: "Test error" }),
        })
      );
    });
  });

  describe("destroy", () => {
    it("should stop and cleanup", () => {
      manager.start();
      mockOnEvent.mockClear();
      manager.destroy();

      expect(mockOnEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "stopped",
        })
      );
    });
  });
});
