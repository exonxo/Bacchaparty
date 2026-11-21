// Layout sweep: the checks earlier rounds ran from a script kept outside the repository
// (memorylog.md: "audit.js <width>"). That script is lost, so this is a re-creation of the same
// checks, kept here so the result can be reproduced:
//   1. horizontal overflow (the page scrolls sideways),
//   2. text smaller than 11px,
//   3. tap targets smaller than 40x40, except links inside a sentence (WCAG 2.5.8's minimum is 24;
//      the brief asks for 44 on CTAs, which scripts/align-check.cjs checks),
//   4. popups / dialogs that don't fit the screen,
//   5. buttons and links covered by another element at their centre,
//   6. script errors (uncaught exceptions and console errors).
// Usage (local server only, no sign-in needed; public pages):
//   BASE=http://localhost:3100 node docs/testing/qa/layout-sweep.mjs 390 [route ...]
// Writes test-artifacts/layout-sweep-<width>.json (git-ignored). Exit code 1 if any issue is found.
// Mark an element with data-align-ignore to leave it out on purpose.
import pw from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const { chromium } = pw;
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] } : {};
const BASE = process.env.BASE || "http://localhost:3100";
const width = Number(process.argv[2]) || 390;
const ROUTES = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ["/", "/games", "/join", "/login?next=/host", "/privacy", "/games/housie", "/games/chor-kaun", "/games/puno"];
const MIN_TEXT = 11, MIN_TAP = 40;

const browser = await chromium.launch(launchOpts);
const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, isMobile: width < 600, hasTouch: width < 600 });
const report = [];
let total = 0;

for (const route of ROUTES) {
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.split("\n")[0]}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().split("\n")[0].slice(0, 160)}`); });
  let status = 0;
  try {
    const res = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 30_000 });
    status = res?.status() ?? 0;
  } catch (e) {
    errors.push(`navigation: ${e.message.split("\n")[0]}`);
  }
  await page.waitForTimeout(500);
  const found = await page.evaluate(({ MIN_TEXT, MIN_TAP }) => {
    const out = { overflow: [], smallText: [], smallTap: [], popups: [], covered: [] };
    const ignored = (el) => !!el.closest("[data-align-ignore]");
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) > 0;
    };
    const label = (el) => `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 30)}"`;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;

    if (document.documentElement.scrollWidth > vw + 1) {
      out.overflow.push(`page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`);
      for (const el of document.body.querySelectorAll("*")) {
        if (ignored(el) || !visible(el)) continue;
        const r = el.getBoundingClientRect();
        if (r.right > vw + 1 && out.overflow.length < 6) out.overflow.push(`${label(el)} right edge ${Math.round(r.right)}`);
      }
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent.trim() || ignored(el) || !visible(el)) continue;
      seen.add(el);
      if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < MIN_TEXT) out.smallText.push(`${label(el)} ${size}px`);
    }
    for (const el of document.querySelectorAll("a, button, input, select, textarea, [role=button]")) {
      if (ignored(el) || !visible(el) || el.disabled) continue;
      const r = el.getBoundingClientRect();
      // Links inside a sentence are exempt (WCAG 2.5.8 "inline" exception).
      const inline = el.tagName === "A" && getComputedStyle(el).display === "inline" && (el.parentElement?.textContent ?? "").trim().length > (el.textContent ?? "").trim().length;
      if (!inline && (r.width < MIN_TAP || r.height < MIN_TAP)) out.smallTap.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
      // Covered: what is at the centre of the control, once it is on screen?
      el.scrollIntoView({ block: "center", inline: "center" });
      const c = el.getBoundingClientRect();
      const x = c.left + c.width / 2, y = c.top + c.height / 2;
      if (x < 0 || y < 0 || x > vw || y > vh) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) out.covered.push(`${label(el)} under ${label(hit)}`);
    }
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll("[role=dialog], dialog[open], [aria-modal=true]")) {
      if (ignored(el) || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) out.popups.push(`${label(el)} ${Math.round(r.width)}x${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}`);
    }
    return out;
  }, { MIN_TEXT, MIN_TAP });
  const entry = { route, status, ...found, scriptErrors: errors };
  const n = found.overflow.length + found.smallText.length + found.smallTap.length + found.popups.length + found.covered.length + errors.length + (status >= 400 || status === 0 ? 1 : 0);
  total += n;
  report.push(entry);
  console.log(`${n ? "ISSUES" : "OK    "} ${route} (status ${status}) overflow ${found.overflow.length}, small text ${found.smallText.length}, small taps ${found.smallTap.length}, popups ${found.popups.length}, covered ${found.covered.length}, script errors ${errors.length}`);
  for (const k of ["overflow", "smallText", "smallTap", "popups", "covered"]) for (const line of found[k].slice(0, 5)) console.log(`       ${k}: ${line}`);
  for (const line of errors.slice(0, 5)) console.log(`       ${line}`);
  await page.close();
}
await browser.close();
mkdirSync("test-artifacts", { recursive: true });
writeFileSync(`test-artifacts/layout-sweep-${width}.json`, JSON.stringify({ base: BASE, width, at: new Date().toISOString(), report }, null, 2));
console.log(`\n${total} issue(s) across ${ROUTES.length} page(s) at ${width}px. Full list: test-artifacts/layout-sweep-${width}.json`);
process.exit(total ? 1 : 0);
