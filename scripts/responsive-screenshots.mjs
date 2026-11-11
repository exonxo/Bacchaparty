#!/usr/bin/env node
/**
 * Capture key pages at 393, 768, 1280, 1920 widths; fail on horizontal overflow.
 * Screenshots → /opt/cursor/artifacts only (never commit).
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "/opt/cursor/artifacts/responsive";
const WIDTHS = [393, 768, 1280, 1920];

async function overflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
}

async function shot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const fails = [];

  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: Math.min(900, w < 640 ? 852 : 1000) } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(25000);

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    if (await overflow(page)) fails.push(`home@${w}`);
    await shot(page, `home-${w}`);

    await page.goto(`${BASE}/games`, { waitUntil: "domcontentloaded" });
    if (await overflow(page)) fails.push(`games@${w}`);
    await shot(page, `games-${w}`);

    await page.goto(`${BASE}/join`, { waitUntil: "domcontentloaded" });
    if (await overflow(page)) fails.push(`join@${w}`);
    await shot(page, `join-${w}`);

    await page.goto(`${BASE}/host`, { waitUntil: "networkidle" });
    await page.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 30000 }).catch(() => {});
    if (page.url().includes("/host")) {
      const ni = page.locator("#player-name");
      if (await ni.isVisible().catch(() => false)) {
        await ni.fill("WideHost");
        await page.getByRole("button", { name: "Open the lobby", exact: true }).click();
      }
      await page.getByText(/Waiting for friends|Kaun kaun|Aaj kya khelein/).first().waitFor({ timeout: 25000 }).catch(() => {});
      if (await overflow(page)) fails.push(`host-lobby@${w}`);
      await shot(page, `host-lobby-${w}`);
    }

    await ctx.close();
  }

  await browser.close();
  if (fails.length) {
    console.error("Horizontal overflow:", fails.join(", "));
    process.exit(1);
  }
  console.log(`responsive-screenshots: OK → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
