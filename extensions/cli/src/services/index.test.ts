import { vi } from "vitest";

import { MCPService } from "./MCPService.js";

import { initializeServices, services } from "./index.js";

// Mock the onboarding module
vi.mock("../onboarding.js", () => ({
  initializeWithOnboarding: vi.fn().mockResolvedValue(undefined),
  isFirstTime: vi.fn().mockResolvedValue(false),
  createOrUpdateConfig: vi.fn().mockResolvedValue(undefined),
}));

// Mock auth module
vi.mock("../auth/workos.js", () => ({
  loadAuthConfig: vi.fn().mockReturnValue({}),
  getConfigUri: vi.fn().mockReturnValue(null),
}));

// Mock the config loader
vi.mock("../configLoader.js", () => ({
  loadConfiguration: vi.fn().mockResolvedValue({
    config: { name: "test", version: "1.0.0" },
    source: { type: "test" },
  }),
}));

describe("initializeServices", () => {
  describe("mode conversion", () => {
    it("should pass only auto flag for auto mode", async () => {
      const spy = vi.spyOn(services.toolPermissions, "initialize");
      await initializeServices({
        headless: true, // Skip onboarding
        toolPermissionOverrides: {
          mode: "auto",
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
        },
      });

      expect(spy).toHaveBeenCalledWith(
        {
          allow: ["tool1"],
          ask: ["tool2"],
          exclude: ["tool3"],
          mode: "auto",
          isHeadless: true,
        },
        {
          slug: null,
          agentFile: null,
          agentFileModel: null,
          parsedRules: null,
          parsedTools: null,
        },
        {
          connections: [],
          mcpService: expect.any(MCPService),
          prompts: [],
          tools: [],
        },
      );
    });
  });
});
