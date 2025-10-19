#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { getAsset } = require("node:sea");

const debug = Boolean(process.env.CONTINUE_CLI_DEBUG);

const SEA_WARNING_FRAGMENT = "single executable application";
const SEA_WARNING_TYPE = "ExperimentalWarning";

const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = (warning, ...args) => {
  const shouldSuppress = (() => {
    if (typeof warning === "string") {
      const [typeOrOptions] = args;
      if (typeof typeOrOptions === "string") {
        return (
          typeOrOptions === SEA_WARNING_TYPE &&
          warning.toLowerCase().includes(SEA_WARNING_FRAGMENT)
        );
      }

      if (
        typeOrOptions &&
        typeof typeOrOptions === "object" &&
        typeOrOptions.type === SEA_WARNING_TYPE
      ) {
        return warning.toLowerCase().includes(SEA_WARNING_FRAGMENT);
      }

      return false;
    }

    if (!warning || typeof warning !== "object") {
      return false;
    }

    const { name, message } = warning;
    return (
      name === SEA_WARNING_TYPE &&
      typeof message === "string" &&
      message.toLowerCase().includes(SEA_WARNING_FRAGMENT)
    );
  })();

  if (shouldSuppress) {
    if (debug) {
      console.error(
        "[continue-cli:sea] suppressed ExperimentalWarning for SEA runtime"
      );
    }
    return;
  }

  return originalEmitWarning(warning, ...args);
};

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-cli-sea-"));
  const distDir = path.join(tempDir, "dist");
  fs.mkdirSync(distDir);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      if (debug) {
        console.error("[continue-cli:sea] cleanup failed", error);
      }
    }
  };

  process.once("exit", cleanup);

  try {
    const files = [
      "index.js",
      "index.js.map",
      "cn.js",
      "meta.json",
      "release-info.json",
      "xhr-sync-worker.js"
    ];
    for (const file of files) {
      const data = getAsset(`dist/${file}`, "utf8");
      if (data !== undefined) {
        fs.writeFileSync(path.join(distDir, file), data);
      }
    }
    const pkgJson = getAsset("package.json", "utf8");
    if (pkgJson !== undefined) {
      fs.writeFileSync(path.join(tempDir, "package.json"), pkgJson);
    }
    const resolvedPath = path.join(distDir, "index.js");
    const modulePath = pathToFileURL(resolvedPath).href;
    if (debug) {
      console.error("[continue-cli:sea] extracted", {
        tempDir,
        files: fs.readdirSync(tempDir)
      });
    }
    const { runCli } = await import(modulePath);
    await runCli();
  } catch (error) {
    cleanup();
    throw error;
  }
}

main().catch((error) => {
  console.error("Failed to start Continue CLI:", error);
  process.exit(1);
});
