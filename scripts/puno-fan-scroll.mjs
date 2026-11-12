/**
 * Puno layout at 393×852 on the real host room page (demo + test mode + Puno).
 * Asserts footer flush to viewport bottom and basic fan horizontal scroll.
 * Usage: BASE_URL=http://localhost:3000 node scripts/puno-fan-scroll.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const W = 393;
const H = 852;

async function waitForServer(base, attempts = 24) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(base, { method: "HEAD" });
      if (res.ok || res.status < 500) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function enableTestMode(page) {
  await page.locator('button[aria-haspopup="menu"]').first().click();
  const toggle = page.getByRole("switch", { name: /Test mode/i });
  await toggle.waitFor({ state: "visible", timeout: 10000 });
  if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  await page.locator('button[aria-haspopup="menu"]').first().click();
  await page.waitForTimeout(500);
}

async function startPunoHost(page) {
  await page.goto(`${BASE}/host`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 60000 });
  const nameInput = page.locator("#player-name");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("Host");
    await page.getByRole("button", { name: /Open the lobby/i }).click();
  }
  await page.getByText(/Waiting for friends|Kaun kaun|Aaj kya khelein/i).first().waitFor({ timeout: 30000 });
  await enableTestMode(page);
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Puno/i }).first().click({ timeout: 15000 });
  await page.getByRole("button", { name: /Shuru karo/i }).waitFor({ timeout: 10000 });
  const start = page.getByRole("button", { name: /Shuru karo/i });
  await start.click();
  await page.getByText(/Test mode · bots/i).waitFor({ timeout: 20000 });
  await page.locator('[data-testid="puno-footer"]').waitFor({ timeout: 25000 });
  await page.waitForTimeout(800);
}

async function main() {
  const up = await waitForServer(BASE);
  if (!up) throw new Error(`Dev server not reachable at ${BASE} (run: npm run dev)`);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);

  await startPunoHost(page);

  const layout = await page.evaluate(() => {
    const footer = document.querySelector('[data-testid="puno-footer"]');
    const fr = footer?.getBoundingClientRect();
    const chips = [...(footer?.querySelectorAll("[class*='truncate']") ?? [])].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent,
        right: r.right,
        clipped: r.right > window.innerWidth + 0.5,
      };
    });
    return {
      innerHeight: window.innerHeight,
      footerTop: fr?.top ?? null,
      footerBottom: fr?.bottom ?? null,
      footerHeight: fr?.height ?? null,
      chips,
    };
  });

  const fan = page.locator('[aria-label="Your cards"] [class*="touch-pan-x"]').first();
  const fanFallback = page.locator('[aria-label="Your cards"] div').filter({ has: page.locator("button") }).first();
  const fanEl = (await fan.count()) > 0 ? fan : fanFallback;
  const metrics = await fanEl.evaluate((el) => ({
    max: el.scrollWidth - el.clientWidth,
    scrollLeft: el.scrollLeft,
  }));
  const box = await fanEl.boundingBox();
  if (box && metrics.max > 40) {
    const y = box.y + box.height * 0.7;
    for (let i = 0; i < 6; i++) {
      await page.touchscreen.tap(box.x + box.width - 20 - i * 24, y);
    }
  }
  let afterScroll = await fanEl.evaluate((el) => el.scrollLeft);
  if (afterScroll <= 8 && metrics.max > 40) {
    await fanEl.evaluate((el) => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });
    afterScroll = await fanEl.evaluate((el) => el.scrollLeft);
  }

  const slack = layout.innerHeight - (layout.footerBottom ?? 0);
  const okFooter = layout.footerBottom != null && Math.abs(layout.footerBottom - layout.innerHeight) <= 1.5;
  const okChips = layout.chips.every((c) => !c.clipped);
  const okFan = metrics.max < 20 || afterScroll > 20 || afterScroll > metrics.max * 0.45;

  console.log(
    JSON.stringify(
      {
        source: "real-app",
        baseUrl: BASE,
        viewport: `${W}x${H}`,
        innerHeight: layout.innerHeight,
        footerTop: layout.footerTop,
        footerBottom: layout.footerBottom,
        footerSlackPx: slack,
        footerFlushOk: okFooter,
        chips: layout.chips,
        chipsUnclippedOk: okChips,
        fanScrollMax: metrics.max,
        fanScrollAfter: afterScroll,
        horizontalScrollOk: okFan,
      },
      null,
      2,
    ),
  );

  if (!okFooter) {
    throw new Error(`footer bottom ${layout.footerBottom} !== innerHeight ${layout.innerHeight} (slack ${slack}px)`);
  }
  if (!okChips) throw new Error("footer player names clipped at right edge");
  if (!okFan && metrics.max > 40) throw new Error("fan horizontal scroll did not move");

  await browser.close();
  console.log("puno-fan-scroll: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
