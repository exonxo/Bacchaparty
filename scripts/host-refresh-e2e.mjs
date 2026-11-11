#!/usr/bin/env node
/**
 * Demo-mode check: host page reload must not show the takeover screen.
 * Usage: BASE_URL=http://localhost:3000 node scripts/host-refresh-e2e.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const TAKEOVER = /another device|take over/i;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  await page.goto(`${BASE}/host`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 30000 });
  const nameInput = page.locator("#player-name");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("HostRefresh");
    await page.getByRole("button", { name: "Open the lobby", exact: true }).click();
  }
  await page.getByText(/Waiting for friends|Kaun kaun aaya/).first().waitFor({ timeout: 25000 });

  for (let i = 1; i <= 2; i++) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText(/Waiting for friends|Kaun kaun aaya|Aaj kya khelein/).first().waitFor({ timeout: 25000 });
    await page.waitForTimeout(500);
    const body = await page.locator("body").innerText();
    if (TAKEOVER.test(body)) {
      console.error(`FAIL: takeover prompt after reload #${i}`);
      process.exit(1);
    }
    console.log(`PASS: reload #${i} — no takeover prompt`);
  }

  await browser.close();
  console.log("host-refresh-e2e: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
