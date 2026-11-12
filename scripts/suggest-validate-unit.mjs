#!/usr/bin/env node
/**
 * Lightweight checks for suggest validation + fallbacks.
 * Run from repo root: node scripts/suggest-validate-unit.mjs
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(__dirname, "suggest-validate-unit-run.mjs");

const ts = spawnSync("npx", ["--yes", "tsx", runner], { cwd: path.join(__dirname, ".."), encoding: "utf8", stdio: "pipe" });
if (ts.status !== 0) {
  console.error(ts.stderr || ts.stdout);
  process.exit(ts.status ?? 1);
}
process.stdout.write(ts.stdout);
