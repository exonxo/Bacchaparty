// QA: confetti ("graffiti") should fire once per finished game, not on every page load or tab.
// Needs the dev or preview server. Run: BASE=http://localhost:3000 node docs/testing/qa/confetti.js
// Uses Playwright from the machine's own install (require('playwright')).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3000';

// canvas-confetti appends a <canvas> while it animates; any canvas seen in the window counts as "fired".
async function fired(page, ms = 1800) {
  let seen = 0;
  for (let t = 0; t < ms; t += 150) {
    seen = Math.max(seen, await page.evaluate(() => document.querySelectorAll('canvas').length));
    await page.waitForTimeout(150);
  }
  return seen > 0;
}

// Marks the saved Puno game as finished, so the game ends the way a real one does.
async function forceOver(host, code) {
  await host.goto(BASE + '/'); await host.waitForTimeout(500);
  await host.evaluate((code) => {
    const k = 'bacchaparty-host-' + code; const st = JSON.parse(localStorage.getItem(k));
    const me = st.players.find((p) => p.name === 'Papa').id;
    const g = st.gameState; g.phase = 'over'; g.winner = me;
    g.hands[me] = []; g.ranking = [me, ...Object.keys(g.hands).filter((x) => x !== me)];
    g.lastPlay = { ...(g.lastPlay || { id: 99, playerId: me, card: g.top, wildColor: null }), at: Date.now() };
    localStorage.setItem(k, JSON.stringify(st));
  }, code);
  await host.goto(`${BASE}/room/${code}/host`); await host.waitForTimeout(3000);
}

(async () => {
  const b = await chromium.launch();
  const out = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const host = await ctx.newPage();
  await host.goto(BASE + '/host'); await host.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 60000 });
  const code = host.url().match(/room\/([A-Z]{4})/)[1];
  await host.getByPlaceholder('e.g. Chintu').fill('Papa');
  await host.getByRole('button', { name: 'Open the lobby' }).tap();
  await host.getByText(/Aaj kya khelein/).first().waitFor({ timeout: 30000 });
  // Test mode adds three bots, so Puno has enough players.
  await host.getByRole('button', { name: /Papa/ }).first().tap();
  await host.getByRole('switch', { name: /Test mode/ }).or(host.getByRole('menuitemcheckbox', { name: /Test mode/ })).tap({ force: true });
  await host.keyboard.press('Escape'); await host.mouse.click(5, 800); await host.waitForTimeout(1200);

  await host.getByRole('button', { name: /Puno/ }).first().tap({ force: true }); await host.waitForTimeout(600);
  await host.getByRole('button', { name: /Shuru karo/ }).last().tap({ force: true });
  await host.waitForTimeout(6000); // the deal opening
  await forceOver(host, code);

  // Leave the finished game: this creates the scorecard and should celebrate once.
  const toLobby = host.getByRole('button', { name: /^Lobby/ });
  if (await toLobby.count()) await toLobby.tap({ force: true });
  else await host.getByRole('button', { name: 'Back to lobby' }).tap({ force: true });
  await host.waitForTimeout(400);
  const card = await host.getByText(/Khel khatam/).count();
  const firstFire = await fired(host);
  out.push(`${card && firstFire ? 'PASS' : 'FAIL'} TC-CF-1 scorecard appears and celebrates once when a game ends (scorecard=${card > 0}, confetti=${firstFire})`);

  // Dismiss the card, then reload: the dismissed card must not celebrate again.
  const close = host.getByRole('button', { name: 'Close results' });
  if (await close.count()) await close.tap({ force: true });
  await host.waitForTimeout(800);
  await host.reload(); await host.waitForTimeout(1500);
  const reloadFire = await fired(host);
  out.push(`${reloadFire ? 'FAIL' : 'PASS'} TC-CF-2 reloading the lobby after dismissing the scorecard does not celebrate again`);

  // A new tab of the same room should behave the same way.
  const again = await ctx.newPage(); await again.goto(`${BASE}/room/${code}/host`); await again.waitForTimeout(1500);
  const newTab = await fired(again);
  out.push(`${newTab ? 'FAIL' : 'PASS'} TC-CF-3 opening the room in a new tab does not celebrate a dismissed result`);

  console.log(out.join('\n'));
  await b.close();
})().catch((e) => { console.log('ERR', e.message.split('\n')[0]); process.exit(1); });
