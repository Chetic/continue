import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-namespace
  var fetch: typeof globalThis.fetch;
}

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock("node-machine-id", () => ({
  default: { machineIdSync: vi.fn(() => "machine-id") },
}));

vi.mock("./auth/workos.js", () => ({
  isAuthenticatedConfig: vi.fn(() => false),
  loadAuthConfig: vi.fn(() => ({})),
}));

vi.mock("./util/logger.js", () => ({
  logger: { info: vi.fn(), debug: vi.fn() },
}));

describe("getVersion", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    process.env.CONTINUE_CLI_VERSION = "";
    process.env.CONTINUE_CLI_RELEASE_VERSION = "";
    global.fetch = vi.fn(
      () =>
        Promise.resolve({ ok: false, json: () => Promise.resolve({}) }) as any,
    );
  });

  afterEach(() => {
    delete process.env.CONTINUE_CLI_VERSION;
    delete process.env.CONTINUE_CLI_RELEASE_VERSION;
    // @ts-expect-error - cleanup mocked fetch
    delete global.fetch;
  });

  it("prefers the CONTINUE_CLI_VERSION environment variable", async () => {
    process.env.CONTINUE_CLI_VERSION = "env-version";
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: "0.0.0-dev" }));

    const versionModule = await import("./version.js");
    expect(versionModule.getVersion()).toBe("env-version");
  });

  it("uses the release info file when available", async () => {
    mockExistsSync.mockImplementation((filePath: string) =>
      filePath.endsWith("release-info.json"),
    );
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith("release-info.json")) {
        return JSON.stringify({ version: "release-tag" });
      }
      return JSON.stringify({ version: "0.0.0-dev" });
    });

    const versionModule = await import("./version.js");
    expect(versionModule.getVersion()).toBe("release-tag");
  });

  it("falls back to package.json when no release info is present", async () => {
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: "0.0.0-dev" }));

    const versionModule = await import("./version.js");
    expect(versionModule.getVersion()).toBe("0.0.0-dev");
  });
});
