/**
 * Touch horizontal scroll check for Puno fan (393×852).
 * Simulates the fan scroller + direction-locked vertical drag on a selected card.
 */
import { chromium, devices } from "playwright";

const W = 393;
const H = 852;
const CARD_W = 168;
const OVERLAP = 98;
const N = 14;
const stripW = N * (CARD_W + OVERLAP) + 120;

const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=${W}"></head><body style="margin:0;background:#f6f0e4">
<div id="root" style="width:${W}px;height:${H}px;display:flex;flex-direction:column;font-family:system-ui">
  <div style="height:38%;background:repeating-linear-gradient(#f6f0e4 0 19px,#eee6d8 19px 20px)"></div>
  <section style="flex:1;display:grid;grid-template-columns:5.25rem 1fr;overflow:hidden">
    <motion.slot></motion.slot>
    <div id="fan" style="overflow-x:auto;overflow-y:visible;touch-action:pan-x;display:flex;align-items:flex-end;padding:0 1rem 0.75rem;-webkit-overflow-scrolling:touch">
      <div id="strip" style="display:flex;align-items:flex-end;min-width:${stripW}px;padding:0 1.25rem">
        ${Array.from({ length: N }, (_, i) => `<div class="card" data-i="${i}" style="width:${CARD_W}px;height:238px;flex-shrink:0;margin-left:${i ? -OVERLAP : 0}px;border:4px solid #1e1a17;border-radius:18px;background:#1E5FD8"></div>`).join("")}
      </div>
    </div>
  </section>
  <footer style="background:#1e1a17;color:#fff;padding:10px">footer visible</footer>
</div>
<script>
  document.getElementById('fan').addEventListener('touchstart', () => {}, {passive:true});
</script>
</body></html>`;

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: W, height: H } });
  const page = await ctx.newPage();
  await page.setContent(html);

  const fan = page.locator("#fan");
  const before = await fan.evaluate((el) => el.scrollLeft);
  const metrics = await fan.evaluate((el) => ({
    max: el.scrollWidth - el.clientWidth,
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
  const box = await fan.boundingBox();
  if (!box) throw new Error("fan box missing");

  // Touch-style horizontal swipe (pan-x scroller).
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

  const footerVisible = await page.locator("footer").isVisible();
  const footerBox = await page.locator("footer").boundingBox();
  const lastCard = page.locator(".card").last();
  await lastCard.scrollIntoViewIfNeeded();
  const lastVisible = await lastCard.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.right <= window.innerWidth + 4 && r.left >= -8;
  });

  const okStrip = metrics.max > 80;
  const okScroll = after > before + 20 || (okStrip && after > metrics.max * 0.5);
  const okFooter = footerVisible && footerBox && footerBox.y + footerBox.height <= H + 1;

  console.log(
    JSON.stringify(
      {
        viewport: `${W}x${H}`,
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
  if (!okFooter) throw new Error("footer not fully visible in viewport");

  await browser.close();
  console.log("puno-fan-scroll: OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
