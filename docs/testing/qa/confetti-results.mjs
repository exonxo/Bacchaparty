// QA: a finished Emoji Picture game should celebrate once, and reloading its results screen
// shouldn't celebrate again. Needs the dev or preview server.
// Run: BASE=http://localhost:3000 node docs/testing/qa/confetti-results.mjs
import pw from 'playwright';
const { chromium } = pw;
// Use CHROMIUM_PATH to point at a local browser build; otherwise Playwright's own download is used.
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] } : {};
const BASE = process.env.BASE || 'http://localhost:3000';

async function fired(page, ms = 2600) {
  let seen = 0;
  for (let t = 0; t < ms; t += 150) {
    seen = Math.max(seen, await page.evaluate(() => document.querySelectorAll('canvas').length));
    await page.waitForTimeout(150);
  }
  return seen > 0;
}

(async () => {
  const b = await chromium.launch(launchOpts);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await ctx.newPage();
  await host.goto(BASE + '/host'); await host.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 60000 });
  const code = host.url().match(/room\/([A-Z]{4})/)[1];
  await host.getByPlaceholder('e.g. Chintu').fill('Papa');
  await host.getByRole('button', { name: 'Open the lobby' }).tap();
  await host.getByText(/Aaj kya khelein/).first().waitFor({ timeout: 30000 });
  await host.getByRole('button', { name: /Papa/ }).first().tap();
  await host.getByRole('switch', { name: /Test mode/ }).or(host.getByRole('menuitemcheckbox', { name: /Test mode/ })).tap({ force: true });
  await host.keyboard.press('Escape'); await host.mouse.click(5, 800); await host.waitForTimeout(1200);

  await host.getByRole('button', { name: /Emoji Picture/ }).first().tap({ force: true }); await host.waitForTimeout(600);
  await host.getByRole('button', { name: /Shuru karo/ }).last().tap({ force: true });
  await host.waitForTimeout(3000);

  // Put the saved game into its results screen, then reload: this is the state a phone is in when it reconnects.
  await host.goto(BASE + '/'); await host.waitForTimeout(400);
  await host.evaluate((code) => {
    const k = 'bacchaparty-host-' + code; const st = JSON.parse(localStorage.getItem(k));
    st.gameState.phase = 'over';
    localStorage.setItem(k, JSON.stringify(st));
  }, code);
  await host.goto(`${BASE}/room/${code}/host`);
  await host.getByText(/Khel khatam|jeet gaye|Barabar|Aaj kya khelein|Kaun kaun/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  await host.waitForTimeout(2400); // results appear after a short reveal
  const onResults = await host.getByText(/Khel khatam|jeet gaye|Barabar|khatam/i).count();
  await host.screenshot({ path: '/tmp/claude-0/emoji/over-host.png' });
  const first = await fired(host);
  await host.goto(`${BASE}/room/${code}/host`);
  await host.getByText(/Khel khatam|jeet gaye|Barabar|Aaj kya khelein|Kaun kaun/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  const second = await fired(host);
  console.log([
    `${first ? 'PASS' : 'FAIL'} TC-CF-4 Emoji results celebrate when the game ends (results visible=${onResults > 0}, confetti=${first})`,
    `${second ? 'FAIL' : 'PASS'} TC-CF-5 reloading the Emoji results screen does not celebrate again`,
  ].join('\n'));
  await b.close();
})().catch((e) => { console.log('ERR', e.message.split('\n')[0]); process.exit(1); });
