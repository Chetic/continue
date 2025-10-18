import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { machineIdSync } from "node-machine-id";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the auth module and node-machine-id
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn(),
  isAuthenticatedConfig: vi.fn(),
}));

vi.mock("node-machine-id", () => {
  const mockFn = vi.fn(() => "test-machine-id");
  return {
    default: {
      machineIdSync: mockFn,
    },
    machineIdSync: mockFn,
  };
});

// Mock dns/promises for connection checks
vi.mock("dns/promises", () => {
  const lookup = vi.fn();
  return { default: { lookup } };
});

// eslint-disable-next-line import/order
import { isAuthenticatedConfig, loadAuthConfig } from "../auth/workos.js";
import { PosthogService } from "./posthogService.js";

describe("PosthogService", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-test-"));

    // Mock os.homedir to return our temp directory
    vi.spyOn(os, "homedir").mockReturnValue(tempDir);

    // Clear environment variable
    delete process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY;

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Restore mocks
    vi.restoreAllMocks();
  });

  describe("uniqueId generation", () => {
    it("should use Continue user id when signed in", () => {
      const mockUserId = "user123";

      vi.mocked(loadAuthConfig).mockReturnValue({ userId: mockUserId } as any);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(true);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockUserId);
      expect(loadAuthConfig).toHaveBeenCalled();
      expect(isAuthenticatedConfig).toHaveBeenCalled();
    });

    it("should use machine id when not signed in", () => {
      const mockMachineId = "test-machine-id";

      vi.mocked(loadAuthConfig).mockReturnValue(null);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(false);
      vi.mocked(machineIdSync).mockReturnValue(mockMachineId);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockMachineId);
      expect(loadAuthConfig).toHaveBeenCalled();
      expect(isAuthenticatedConfig).toHaveBeenCalled();
      expect(machineIdSync).toHaveBeenCalled();
    });

    it("should use machine id when auth config is environment-based", () => {
      const mockMachineId = "test-machine-id";

      vi.mocked(loadAuthConfig).mockReturnValue({
        accessToken: "token",
      } as any);
      vi.mocked(isAuthenticatedConfig).mockReturnValue(false);
      vi.mocked(machineIdSync).mockReturnValue(mockMachineId);

      const service = new PosthogService();

      // Access private field for testing
      const uniqueId = (service as any).uniqueId;

      expect(uniqueId).toBe(mockMachineId);
      expect(machineIdSync).toHaveBeenCalled();
    });
  });

  describe("telemetry enabled/disabled", () => {
    it("should be disabled by default", () => {
      const service = new PosthogService();
      expect(service.isEnabled).toBe(false);
    });

    it("should remain disabled even when CONTINUE_ALLOW_ANONYMOUS_TELEMETRY is set", () => {
      process.env.CONTINUE_ALLOW_ANONYMOUS_TELEMETRY = "1";
      const service = new PosthogService();
      expect(service.isEnabled).toBe(false);
    });
  });

  describe("disabled telemetry behavior", () => {
    let service: PosthogService;

    beforeEach(() => {
      service = new PosthogService();
    });

    it("does not attempt DNS lookup when capturing events", async () => {
      const dns: any = (await import("dns/promises")).default;
      await service.capture("test_event", { test: "data" });
      expect(dns.lookup).not.toHaveBeenCalled();
      expect((service as any)._client).toBeUndefined();
    });

    it("does not attempt shutdown when disabled", async () => {
      const dns: any = (await import("dns/promises")).default;
      await service.shutdown();
      expect(dns.lookup).not.toHaveBeenCalled();
      expect((service as any)._client).toBeUndefined();
    });
  });
});
