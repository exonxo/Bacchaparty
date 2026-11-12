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

async function tapProfileMenu(page) {
  const btn = page.locator('button[aria-haspopup="menu"]').first();
  await btn.waitFor({ state: "visible", timeout: 10000 });
  const box = await btn.boundingBox();
  if (!box) throw new Error("profile menu button missing");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
}

async function enableTestMode(page) {
  await page.waitForTimeout(1200);
  await tapProfileMenu(page);
  const toggle = page.getByRole("switch").first();
  await toggle.waitFor({ state: "visible", timeout: 10000 });
  if ((await toggle.getAttribute("aria-checked")) !== "true") {
    const tbox = await toggle.boundingBox();
    if (tbox) await page.touchscreen.tap(tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
    else await toggle.click();
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

async function createRoomCode() {
  const r = await fetch(`${BASE}/api/rooms`, { method: "POST" });
  const data = await r.json();
  if (!r.ok || !data.code) throw new Error(data.error ?? "Could not create room");
  return data.code;
}

async function startPunoHost(page) {
  const code = await createRoomCode();
  await page.goto(`${BASE}/room/${code}/host`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const nameInput = page.locator("#player-name");
  if (await nameInput.isEnabled().catch(() => false)) {
    await nameInput.fill("Host");
    await page.getByRole("button", { name: /Open the lobby/i }).click();
  }
  await page.locator('button[aria-haspopup="menu"]').first().waitFor({ state: "visible", timeout: 30000 });
  await page.getByText(/Waiting for friends|Kaun kaun aaya|Aaj kya khelein/i).first().waitFor({ timeout: 30000 });
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
  await ctx.addInitScript(() => {
    sessionStorage.setItem("bacchaparty-me", JSON.stringify({ id: "host-qa", name: "Host", avatar: "cat" }));
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

  const lobbyBtn = page.getByRole("button", { name: "Back to lobby" });
  const lb = await lobbyBtn.boundingBox();
  if (lb) await page.touchscreen.tap(lb.x + lb.width / 2, lb.y + lb.height / 2);
  else await lobbyBtn.click();
  await page.getByRole("dialog", { name: /End this game/i }).waitFor({ timeout: 10000 });
  await page.waitForTimeout(900);
  const endBtn = page.getByRole("button", { name: "End game", exact: true });
  await endBtn.waitFor({ state: "visible" });
  const sheetHit = await endBtn.evaluate((btn) => {
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return top === btn || (top != null && btn.contains(top));
  });

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
        endGameButtonTappable: sheetHit,
      },
      null,
      2,
    ),
  );

  if (!sheetHit) throw new Error("End game button covered by footer or another layer (elementFromPoint miss)");

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
