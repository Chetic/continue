#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const version =
  (process.env.CONTINUE_CLI_RELEASE_VERSION ??
    process.env.CONTINUE_CLI_VERSION ??
    "")
    .trim();

if (!version) {
  console.log(
    "[release-version] CONTINUE_CLI_RELEASE_VERSION not set - skipping release info generation.",
  );
  process.exit(0);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const distDir = join(__dirname, "dist");

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

const outputPath = join(distDir, "release-info.json");
const payload = JSON.stringify({ version }, null, 2);
writeFileSync(outputPath, `${payload}\n`, "utf8");
console.log(`[release-version] Wrote ${outputPath} with version ${version}`);
