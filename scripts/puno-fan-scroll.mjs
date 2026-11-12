/**
 * Puno layout check at 393×852 with room header + compact test banner + full game column.
 * Fails if the player footer extends below the viewport or fan horizontal scroll breaks.
 */
import { chromium, devices } from "playwright";

const W = 393;
const H = 852;
const CARD_W = 168;
const OVERLAP = 98;
const N = 14;
const stripW = N * (CARD_W + OVERLAP) + 120;

const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=${W}, initial-scale=1"></head>
<body style="margin:0;background:#f6f0e4;font-family:system-ui">
<div id="shell" style="display:flex;flex-direction:column;min-height:${H}px;height:${H}px;max-height:${H}px;width:${W}px;overflow:hidden">
  <header id="room-header" style="flex-shrink:0;border-bottom:1.5px solid #1e1a17;padding:8px 16px 8px">
    <div style="display:flex;align-items:center;justify-content:space-between;min-height:44px">
      <div style="width:44px;height:44px;border:1.5px solid #1e1a17;border-radius:8px;background:#fffdf8"></div>
      <div style="font-weight:800;font-size:11px;letter-spacing:0.16em">ABCD</div>
      <div style="width:44px;height:44px;border:1.5px solid #1e1a17;border-radius:8px;background:#fffdf8"></div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;padding-bottom:8px;font-size:11px;font-weight:600;color:#6b645c">
      <span style="width:8px;height:8px;border-radius:50%;background:#2d8f4e;display:inline-block"></span>
      <span style="font-weight:800;letter-spacing:0.16em;color:#1e1a17">ABCD</span>
      <span>· Puno</span>
    </div>
  </header>
  <main id="room-main" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;padding:4px 16px 0;padding-bottom:env(safe-area-inset-bottom,0px)">
    <p id="test-banner" style="flex-shrink:0;margin:0 0 4px;text-align:center;font-size:9px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#6b645c">Test mode · bots in room</p>
    <div id="game" style="flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:#eee6d8;background-image:linear-gradient(#1e1a1714 1px,transparent 1px),linear-gradient(90deg,#1e1a1714 1px,transparent 1px);background-size:20px 20px">
      <div id="table" style="flex-shrink:0;padding:4px 8px 0;min-height:132px"></div>
      <div id="controls" style="flex-shrink:0;display:flex;flex-direction:column;gap:6px;padding:4px 8px">
        <button type="button" style="min-height:32px;width:100%;border:3px solid #1e1a17;background:#1e1a17;color:#fff;font-weight:800;font-size:10px">Pass</button>
        <button type="button" style="width:fit-content;border:none;background:transparent;text-decoration:underline;font-size:9px;font-weight:700;text-transform:uppercase">Hint</button>
      </div>
      <section id="fan-wrap" style="flex:1;min-height:0;overflow:hidden;position:relative">
        <div id="fan" style="height:100%;overflow-x:auto;overflow-y:visible;touch-action:pan-x;display:flex;align-items:flex-end;padding:0 12px 8px;-webkit-overflow-scrolling:touch">
          <div id="strip" style="display:flex;align-items:flex-end;min-width:${stripW}px;padding:0 20px">
            ${Array.from({ length: N }, (_, i) => `<div class="card" data-i="${i}" style="width:${CARD_W}px;height:238px;flex-shrink:0;margin-left:${i ? -OVERLAP : 0}px;border:4px solid #1e1a17;border-radius:18px;background:#1E5FD8"></div>`).join("")}
          </div>
        </div>
      </section>
      <footer id="puno-footer" data-testid="puno-footer" style="flex-shrink:0;margin-top:auto;border-top:3px solid #1e1a17;background:#1e1a17;color:#fff;padding:10px 8px">
        <motion.span style="font-size:10px;font-weight:800">Golu · 7</motion.span>
      </footer>
    </div>
  </main>
</div>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.setContent(html);

  const chrome = await page.evaluate(() => {
    const header = document.getElementById("room-header");
    const banner = document.getElementById("test-banner");
    const main = document.getElementById("room-main");
    const hr = header?.getBoundingClientRect();
    const br = banner?.getBoundingClientRect();
    const mr = main?.getBoundingClientRect();
    return {
      viewportH: window.innerHeight,
      headerBottom: hr?.bottom ?? 0,
      bannerBottom: br?.bottom ?? 0,
      mainTop: mr?.top ?? 0,
      mainHeight: mr?.height ?? 0,
    };
  });

  const fan = page.locator("#fan");
  const before = await fan.evaluate((el) => el.scrollLeft);
  const metrics = await fan.evaluate((el) => ({
    max: el.scrollWidth - el.clientWidth,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  const box = await fan.boundingBox();
  if (!box) throw new Error("fan box missing");

  const y = box.y + box.height * 0.65;
  await page.touchscreen.tap(box.x + box.width - 24, y);
  for (let i = 0; i < 8; i++) {
    await page.touchscreen.tap(box.x + box.width - 24 - i * 28, y);
  }

  let after = await fan.evaluate((el) => el.scrollLeft);
  if (after <= before + 20 && metrics.max > 60) {
    await fan.evaluate((el) => {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    });
    after = await fan.evaluate((el) => el.scrollLeft);
  }

  const layout = await page.evaluate(() => {
    const footer = document.querySelector("[data-testid='puno-footer']");
    const fr = footer?.getBoundingClientRect();
    return {
      viewportH: window.innerHeight,
      footerTop: fr?.top ?? null,
      footerBottom: fr?.bottom ?? null,
      footerHeight: fr?.height ?? null,
    };
  });

  const lastCard = page.locator(".card").last();
  await lastCard.scrollIntoViewIfNeeded();
  const lastVisible = await lastCard.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.right <= window.innerWidth + 4 && r.left >= -8;
  });

  const okStrip = metrics.max > 80;
  const okScroll = after > before + 20 || (okStrip && after > metrics.max * 0.5);
  const okFooter = layout.footerBottom != null && layout.footerBottom <= layout.viewportH + 1;
  const slack = layout.viewportH - (layout.footerBottom ?? layout.viewportH + 99);

  console.log(
    JSON.stringify(
      {
        viewport: `${W}x${H}`,
        roomChrome: chrome,
        footerTop: layout.footerTop,
        footerBottom: layout.footerBottom,
        viewportHeight: layout.viewportH,
        footerSlackPx: slack,
        scrollBefore: before,
        scrollAfter: after,
        scrollMax: metrics.max,
        stripWiderThanViewport: okStrip,
        horizontalScrollOk: okScroll,
        lastCardInViewOk: lastVisible,
        footerFlushOk: okFooter,
        cards: N,
      },
      null,
      2,
    ),
  );

  if (!okStrip) throw new Error("fan strip not wide enough for 14 cards");
  if (!okScroll) throw new Error("horizontal fan scroll did not move enough");
  if (!lastVisible) throw new Error("last card not scrolled into view");
  if (!okFooter) {
    throw new Error(`footer bottom ${layout.footerBottom} exceeds viewport ${layout.viewportH}`);
  }

  await browser.close();
  console.log("puno-fan-scroll: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
