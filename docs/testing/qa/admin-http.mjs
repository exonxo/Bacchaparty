// QA rounds 4 and 8: the hidden admin panel over HTTP (ADM-1, 2, 5, 6, 7, 8, 9, 10, 11, 14).
// Start a server with the admin variables set, then run this against it:
//   BASE=http://localhost:3100 ADMIN_PATH=... ADMIN_USERNAME=... ADMIN_PASSWORD=... ADMIN_TOTP_SECRET=... \
//     node docs/testing/qa/admin-http.mjs
// ADMIN_PASSWORD is the plain password (only for this test; never store it anywhere).
import pw from 'playwright';
import crypto from 'node:crypto';
const { request } = pw;

const BASE = process.env.BASE || 'http://localhost:3100';

// These tests make deliberate failed sign-ins, which lock the IP they run from for 15 minutes.
// They refuse to run against a live site unless you explicitly accept that.
const LOCAL_BASE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(BASE);
if (!LOCAL_BASE && process.env.ALLOW_LIVE_FAILED_LOGINS !== '1') {
  console.log(`Refusing to run against ${BASE}: this test makes failed sign-ins on purpose. Use admin-live-check.mjs for a live site.`);
  process.exit(2);
}

const SECRET_PATH = process.env.ADMIN_PATH;
const USER = process.env.ADMIN_USERNAME;
const PASS = process.env.ADMIN_PASSWORD;
const TOTP = process.env.ADMIN_TOTP_SECRET;
const results = [];
const check = (id, name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${id} ${name}${!ok && detail ? `\n     ${detail}` : ''}`);

// RFC 6238 code for the current step, computed independently of the app code.
function totpNow(secret) {
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0; const out = [];
  for (const ch of secret.replace(/\s/g, '').toUpperCase()) {
    val = (val << 5) | alpha.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000 / 30)));
  const h = crypto.createHmac('sha1', Buffer.from(out)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 1e6).padStart(6, '0');
}

(async () => {
  const api = await request.newContext({ baseURL: BASE });
  const fakeIp = () => `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const login = (body, headers = {}) =>
    api.post(`/${SECRET_PATH}/api/login`, {
      data: body,
      headers: { origin: BASE, host: new URL(BASE).host, 'content-type': 'application/json', 'x-forwarded-for': fakeIp(), ...headers },
    });

  // ADM-1 / ADM-2: hidden paths look like ordinary missing pages.
  const direct = await api.get('/admin-internal');
  check('ADM-1a', '/admin-internal answers 404', direct.status() === 404, `status ${direct.status()}`);
  const directApi = await api.get('/admin-internal/api/data?view=me');
  check('ADM-1b', '/admin-internal API is 404 even without a session', directApi.status() === 404, `status ${directApi.status()}`);
  for (const p of ['/admin', '/login-admin', '/dashboard']) {
    const r = await api.get(p);
    check('ADM-2', `${p} is a normal 404`, r.status() === 404, `status ${r.status()}`);
  }
  const wrong = await api.get('/' + 'z'.repeat(32));
  check('ADM-2b', 'a wrong secret path is a normal 404', wrong.status() === 404, `status ${wrong.status()}`);

  // ADM-5: the panel is there at the secret path, with noindex headers and no data.
  const page = await api.get(`/${SECRET_PATH}`);
  const pageText = await page.text();
  // The form is drawn by the page's JavaScript, so the server HTML shows the loading line; the
  // real check that no data is in the HTML is below.
  check('ADM-5a', 'secret path serves the panel shell with no data in it', page.status() === 200 && /Loading|Admin login/.test(pageText) && !/owner-test|[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(pageText), `status ${page.status()}`);
  check('ADM-11a', 'panel page is noindex and not cached', /noindex/.test(page.headers()['x-robots-tag'] || '') && /no-store/.test(page.headers()['cache-control'] || ''));

  // The secret path must not appear in the public site.
  const home = await (await api.get('/')).text();
  check('ADM-5b', 'the secret path is not linked from the public home page', !home.includes(SECRET_PATH));

  // ADM-10: cross-site and non-JSON posts are refused and don't count as login attempts.
  const noOrigin = await api.post(`/${SECRET_PATH}/api/login`, { data: { username: USER }, headers: { 'content-type': 'application/json' } });
  check('ADM-10a', 'a POST without Origin is refused', noOrigin.status() === 403, `status ${noOrigin.status()}`);
  const foreign = await login({ username: USER, password: PASS, totp: totpNow(TOTP) }, { origin: 'https://evil.example' });
  check('ADM-10b', 'a POST from another site is refused', foreign.status() === 403, `status ${foreign.status()}`);
  const plain = await login({ username: USER, password: PASS, totp: totpNow(TOTP) }, { 'content-type': 'text/plain' });
  check('ADM-10c', 'a non-JSON POST is refused', plain.status() === 403, `status ${plain.status()}`);

  // ADM-6: wrong password and unknown username give the same answer.
  const badPass = await login({ username: USER, password: 'nope-nope-nope', totp: totpNow(TOTP) });
  const badUser = await login({ username: 'nobody-here', password: PASS, totp: totpNow(TOTP) });
  const bodyA = await badPass.json(), bodyB = await badUser.json();
  check('ADM-6a', 'wrong password and unknown user get the same generic message', badPass.status() === 401 && badUser.status() === 401 && bodyA.message === bodyB.message && bodyA.message === 'Login failed.', JSON.stringify([bodyA, bodyB]));

  // ADM-8: a correct login sets the locked-down session cookie.
  const ok = await login({ username: USER, password: PASS, totp: totpNow(TOTP) });
  const setCookie = ok.headers()['set-cookie'] || '';
  check('ADM-8a', 'correct password and code log in', ok.status() === 200, `status ${ok.status()} ${await ok.text()}`);
  for (const flag of ['HttpOnly', 'SameSite=Strict', `Path=/${SECRET_PATH}`, 'Max-Age=7200']) {
    check('ADM-8b', `session cookie has ${flag}`, setCookie.includes(flag), setCookie);
  }
  const cookie = setCookie.split(';')[0];

  // ADM-9: data needs the session. (No database in this test run, so a valid session gets the
  // "database_not_configured" answer, which proves the session check passed.)
  // A separate, cookie-less context: the login above stored its cookie in `api`'s jar.
  const anon = await request.newContext({ baseURL: BASE });
  const noCookie = await anon.get(`/${SECRET_PATH}/api/data?view=me`);
  check('ADM-9a', 'data without a session is 401', noCookie.status() === 401, `status ${noCookie.status()}`);
  const forged = await anon.get(`/${SECRET_PATH}/api/data?view=me`, { headers: { cookie: cookie.replace(/\.[^.]+$/, '.AAAA') } });
  await anon.dispose();
  check('ADM-9b', 'a forged cookie is 401', forged.status() === 401, `status ${forged.status()}`);
  const mine = await api.get(`/${SECRET_PATH}/api/data?view=me`, { headers: { cookie } });
  check('ADM-9c', 'a valid session is accepted', mine.status() === 200 && (await mine.json()).user === USER, `status ${mine.status()}`);
  check('ADM-11b', 'data responses are no-store and noindex', /no-store/.test(mine.headers()['cache-control'] || '') && /noindex/.test(mine.headers()['x-robots-tag'] || ''));
  const unknown = await api.get(`/${SECRET_PATH}/api/data?view=secrets`, { headers: { cookie } });
  check('ADM-9d', 'unknown data views are refused', unknown.status() === 400, `status ${unknown.status()}`);

  // ADM-14: logout clears the cookie.
  const out = await api.post(`/${SECRET_PATH}/api/logout`, { headers: { origin: BASE, host: new URL(BASE).host } });
  check('ADM-14', 'logout clears the session cookie', out.status() === 200 && /Max-Age=0/.test(out.headers()['set-cookie'] || ''));
  // ADM-14b: the token itself is revoked, so a copy of the old cookie no longer works.
  const anon2 = await request.newContext({ baseURL: BASE });
  const replay = await anon2.get(`/${SECRET_PATH}/api/data?view=me`, { headers: { cookie } });
  await anon2.dispose();
  check('ADM-14b', 'the logged-out cookie, replayed, is refused (401)', replay.status() === 401, `status ${replay.status()}`);

  // ADM-7: five failures from one IP lock it out, even for the correct password.
  const lockIp = fakeIp();
  for (let i = 0; i < 5; i++) await login({ username: USER, password: 'wrong-wrong-wrong', totp: '000000' }, { 'x-forwarded-for': lockIp });
  const locked = await login({ username: USER, password: PASS, totp: totpNow(TOTP) }, { 'x-forwarded-for': lockIp });
  check('ADM-7a', 'five failures lock the IP; the right password is refused during the lock', locked.status() === 429, `status ${locked.status()}`);
  const spoof = await login({ username: USER, password: PASS, totp: totpNow(TOTP) }, { 'x-forwarded-for': `1.1.1.1, ${lockIp}` });
  check('ADM-7b', 'a spoofed first x-forwarded-for entry does not dodge the lock', spoof.status() === 429, `status ${spoof.status()}`);

  console.log(results.join('\n'));
  const failed = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  await api.dispose();
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.log('ERR', e.message.split('\n')[0]);
  process.exit(1);
});
