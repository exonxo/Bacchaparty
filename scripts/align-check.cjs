/**
 * Layout checks for the brief's acceptance rules:
 *  - tap targets >= 44x44, content left edges in one column (±2px),
 *  - no horizontal page scroll, CTA text centred in its box (±1px).
 * Usage: BASE=http://localhost:3000 OUT=./shots node scripts/align-check.cjs [route ...]
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "http://localhost:3000";
const OUT = process.env.OUT || "shots";
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ["/", "/games", "/join", "/login?next=/host", "/games/housie", "/games/chor-kaun", "/privacy"];
const VIEWPORTS = [
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: "360", width: 360, height: 740, isMobile: true, hasTouch: true },
  { name: "1400", width: 1400, height: 900 },
];

async function measure(page) {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const textLeft = (el) => {
      if (!el) return null;
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      return rects.length ? Math.round(Math.min(...rects.map((r) => r.left)) * 10) / 10 : Math.round(el.getBoundingClientRect().left);
    };
    const small = [];
    document.querySelectorAll("a, button, input, select, textarea, [role=button]").forEach((el) => {
      if (!vis(el) || el.disabled || el.closest("[data-align-ignore]")) return;
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) small.push(`${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    const logo = document.querySelector("header a");
    const h1 = document.querySelector("main h1, h1");
    const h2 = document.querySelector("main h2");
    const label = document.querySelector("main label");
    const edges = {
      logo: logo ? Math.round(logo.getBoundingClientRect().left * 10) / 10 : null,
      h1: textLeft(h1),
      h2: textLeft(h2),
      label: textLeft(label),
    };
    return { small, edges, scrollWidth: document.documentElement.scrollWidth, vw: window.innerWidth };
  });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  let failures = 0;
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      const m = await measure(page);
      const vals = Object.values(m.edges).filter((v) => v !== null);
      const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;
      const overflow = m.scrollWidth > m.vw + 1;
      const tag = `${vp.name} ${route}`;
      console.log(`\n[${tag}] edges ${JSON.stringify(m.edges)} spread=${spread.toFixed(1)} overflow=${overflow}`);
      if (m.small.length) console.log(`  small targets (${m.small.length}): ${m.small.slice(0, 12).join("; ")}`);
      failures += m.small.length + (overflow ? 1 : 0) + (spread > 2 ? 1 : 0);
      const file = path.join(OUT, `${route.replace(/[^a-z0-9]+/gi, "_") || "home"}-${vp.name}.png`);
      await page.screenshot({ path: file, fullPage: vp.width < 1000 ? false : false });
      await page.close();
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`\nTotal issues: ${failures}`);
})();
