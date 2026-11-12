#!/usr/bin/env node
/** Build 2x Puno card contact sheet + verify centre art within 1px of card centre. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(__dirname, "puno-card-contactsheet-run.tsx");
const artifact = "/opt/cursor/artifacts/puno-card-contactsheet-2x.png";

const gen = spawnSync("npx", ["--yes", "tsx", runner], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
if (gen.status !== 0) {
  console.error(gen.stderr || gen.stdout);
  process.exit(gen.status ?? 1);
}
const htmlPath = gen.stdout.trim().split("\n").pop();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2200, height: 4000 } });
await page.goto(`file://${htmlPath}`, { waitUntil: "load" });

const measures = await page.evaluate(() => {
  const cells = [...document.querySelectorAll(".contact-cell")];
  return cells.map((cell) => {
    const cardId = cell.getAttribute("data-card-id");
    const inner = cell.querySelector("[style*='scale'] [data-puno-center-mount]");
    const art = cell.querySelector("[data-puno-center-art]");
    const mountBox = inner?.getBoundingClientRect();
    const artBox = art?.getBoundingClientRect();
    if (!mountBox || !artBox) return { cardId, ok: false, reason: "missing mount/art" };
    const cx = mountBox.left + mountBox.width / 2;
    const cy = mountBox.top + mountBox.height / 2;
    const ax = artBox.left + artBox.width / 2;
    const ay = artBox.top + artBox.height / 2;
    const dx = Math.abs(cx - ax);
    const dy = Math.abs(cy - ay);
  const mountOk = dx <= 1.5 && dy <= 1.5;

    const svg = art.querySelector("svg");
    let gdx = null;
    let gdy = null;
    let glyphOk = true;
    if (svg) {
      const bb = svg.getBBox();
      const vcx = bb.x + bb.width / 2;
      const vcy = bb.y + bb.height / 2;
      gdx = Math.abs(vcx - 50);
      gdy = Math.abs(vcy - 50);
      glyphOk = gdx <= 1.2 && gdy <= 1.2;
    }

    return { cardId, dx, dy, gdx, gdy, ok: mountOk && glyphOk };
  });
});

const bad = measures.filter((m) => !m.ok);
console.log(JSON.stringify({ total: measures.length, failed: bad.length, worst: bad[0] ?? null }, null, 2));

await page.screenshot({ path: artifact, fullPage: true });
await browser.close();

if (bad.length) {
  console.error("Center art alignment failures:", bad.slice(0, 5));
  process.exit(1);
}
console.log("puno-card-contactsheet: OK");
console.log(artifact);
