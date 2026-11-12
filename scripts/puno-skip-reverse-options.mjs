#!/usr/bin/env node
/** 2x PNG of skip/reverse design options (artifact only). */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(__dirname, "puno-skip-reverse-options-run.tsx");
const artifact = "/opt/cursor/artifacts/puno-skip-reverse-options-2x.png";

const gen = spawnSync("npx", ["--yes", "tsx", runner], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
if (gen.status !== 0) {
  console.error(gen.stderr || gen.stdout);
  process.exit(gen.status ?? 1);
}
const htmlPath = gen.stdout.trim().split("\n").pop();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 4200 } });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
await page.screenshot({ path: artifact, fullPage: true });
await browser.close();

console.log("puno-skip-reverse-options: OK");
console.log(artifact);
