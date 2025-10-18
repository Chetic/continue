#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");
const { getAsset } = require("node:sea");

const debug = Boolean(process.env.CONTINUE_CLI_DEBUG);

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "continue-cli-sea-"));
  const distDir = path.join(tempDir, "dist");
  fs.mkdirSync(distDir);
  try {
    const files = [
      "index.js",
      "index.js.map",
      "cn.js",
      "meta.json",
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
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      if (debug) {
        console.error("[continue-cli:sea] cleanup failed", error);
      }
    }
  }
}

main().catch((error) => {
  console.error("Failed to start Continue CLI:", error);
  process.exit(1);
});
