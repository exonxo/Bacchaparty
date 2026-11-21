// QA round 4: the admin login form in a real browser (ADM-5, ADM-6, ADM-8 from the UI side).
// Same environment as admin-http.js: BASE, ADMIN_PATH, ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_TOTP_SECRET.
const { chromium } = require('playwright');
const crypto = require('node:crypto');

const BASE = process.env.BASE || 'http://localhost:3100';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totpNow(secret) {
  let bits = 0, val = 0; const out = [];
  for (const ch of secret.toUpperCase()) {
    val = (val << 5) | ALPHA.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(c).digest();
  const o = h[h.length - 1] & 0xf;
  return String(((((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6)).padStart(6, '0');
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const out = [];
  const pass = (id, name, ok) => out.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}`);

  await page.goto(`${BASE}/${process.env.ADMIN_PATH}`);
  await page.getByRole('heading', { name: 'Admin login' }).waitFor({ timeout: 30000 });
  pass('ADM-5', 'the login form appears at the secret path', true);

  await page.getByPlaceholder('Username').fill(process.env.ADMIN_USERNAME);
  await page.getByPlaceholder('Password').fill(process.env.ADMIN_PASSWORD);
  await page.getByPlaceholder('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Log in' }).click();
  // Next's own route announcer also uses role=alert, so wait for our message text.
  const shown = await page.getByText('Login failed.').waitFor({ timeout: 15000 }).then(() => true, () => false);
  pass('ADM-6', 'a wrong code shows the generic message', shown);

  await page.getByPlaceholder('6-digit code').fill(totpNow(process.env.ADMIN_TOTP_SECRET));
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('heading', { name: 'Bacchaparty admin' }).waitFor({ timeout: 15000 });
  pass('ADM-8', 'the correct login reaches the panel', true);

  // No database in this run: the views say so, without showing an error stack.
  await page.getByRole('button', { name: 'Users' }).click();
  await page.getByText(/Database not configured|Could not load|No users/).first().waitFor({ timeout: 15000 });
  pass('DATA-0', 'without a database the panel says so instead of crashing', true);

  await page.screenshot({ path: '/tmp/claude-0/emoji/admin-ui.png' });
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('heading', { name: 'Admin login' }).waitFor({ timeout: 15000 });
  pass('ADM-14b', 'log out returns to the login form', true);

  console.log(out.join('\n'));
  await b.close();
  process.exit(out.some((l) => l.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => {
  console.log('ERR', e.message.split('\n')[0]);
  process.exit(1);
});
