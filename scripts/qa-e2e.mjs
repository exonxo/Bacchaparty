#!/usr/bin/env node
/**
 * Local demo-mode E2E smoke test (one browser context → BroadcastChannel works).
 * Usage: BASE_URL=http://localhost:3000 node scripts/qa-e2e.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "testing", "e2e-run");
const MOBILE = { width: 393, height: 852 };
const HOST_VIEW = { width: 1280, height: 900 };

const GAMES = [
  { id: "chor-kaun", name: "Chor Kaun?" },
  { id: "housie", name: "Housie (Tambola)" },
  { id: "emoji-picture", name: "Emoji Picture" },
  { id: "charades", name: "Dumb Charades" },
  { id: "antakshari", name: "Antakshari Battle" },
  { id: "draw-guess", name: "Draw & Guess" },
  { id: "kaun-banega-champion", name: "Kaun Banega Champion" },
  { id: "raja-mantri", name: "Raja Mantri Chor Sipahi" },
  { id: "odd-word-out", name: "Odd Word Out" },
  { id: "ludo-yatra", name: "Ludo Yatra" },
  { id: "sound-guru", name: "Sound Guru" },
  { id: "jaldi-bolo", name: "Jaldi Bolo" },
];

const results = { games: {}, flows: [], errors: [] };

function log(msg) {
  process.stdout.write(`${new Date().toISOString()} ${msg}\n`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function bodyText(page) {
  try {
    return await page.locator("body").innerText({ timeout: 5000 });
  } catch {
    return "";
  }
}

async function joinPlayer(context, code, name, index) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => results.errors.push({ who: name, type: "pageerror", msg: e.message }));
  await page.goto(`${BASE}/join`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ n, idx }) => {
      sessionStorage.setItem(
        "bacchaparty-me",
        JSON.stringify({ id: `bot-${idx}-${Date.now()}`, name: n, avatar: "cat" })
      );
    },
    { n: name, idx: index }
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#player-name").waitFor({ state: "visible" });
  await page.waitForFunction(() => {
    try {
      const raw = sessionStorage.getItem("bacchaparty-me");
      return raw && JSON.parse(raw).name;
    } catch {
      return false;
    }
  });
  await page.waitForFunction(
    () => (document.getElementById("player-name")?.value ?? "").trim().length > 0,
    { timeout: 10000 }
  );
  await page.locator("#room-code").click();
  await page.locator("#room-code").fill("");
  await page.locator("#room-code").pressSequentially(code, { delay: 30 });
  await page.waitForFunction(
    (c) => {
      const el = document.getElementById("room-code");
      return el && el.value.length === 4;
    },
    code,
    { timeout: 5000 }
  );
  await page.getByRole("button", { name: "Chalo, join karo", exact: true }).click();
  await page.waitForURL(`**/room/${code}/play`, { timeout: 25000, waitUntil: "domcontentloaded" });
  await page.getByText(/Aa gaye|game chun|Party dhoondh/).first().waitFor({ timeout: 20000 });
  return page;
}

async function setupHost(context) {
  const host = await context.newPage();
  host.setDefaultTimeout(20000);
  host.on("pageerror", (e) => results.errors.push({ who: "host", type: "pageerror", msg: e.message }));
  await host.setViewportSize(HOST_VIEW);
  await host.goto(`${BASE}/host`, { waitUntil: "networkidle" });
  await host.waitForURL(/\/room\/[A-Z]{4}\/host/, { timeout: 30000 });
  const m = host.url().match(/\/room\/([A-Z]{4})\/host/);
  const code = m[1];
  const nameInput = host.locator("#player-name");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("HostPro");
    await host.getByRole("button", { name: "Open the lobby", exact: true }).click();
  }
  await host.getByText(/Waiting for friends|Kaun kaun aaya/).first().waitFor({ timeout: 25000 });
  return { host, code };
}

async function waitLobby(host) {
  await host.getByRole("button", { name: "Back to lobby" }).click().catch(() => {});
  const sheet = host.getByRole("button", { name: "End game" });
  if (await sheet.isVisible().catch(() => false)) {
    await sheet.click();
  }
  await host.getByText(/Aaj kya khelein|Host/).first().waitFor({ timeout: 15000 });
}

async function startGame(host, gameName) {
  const tile = host.getByRole("button", { name: new RegExp(gameName, "i") }).first();
  await tile.click({ timeout: 10000 });
  await host.getByRole("button", { name: /Shuru karo/i }).waitFor({ timeout: 10000 });
  const startBtn = host.getByRole("button", { name: /Shuru karo/i });
  const disabled = await startBtn.isDisabled();
  const warning = await host.locator("text=/Needs at least|Max |Coming soon/").innerText().catch(() => "");
  if (disabled) return { started: false, warning };
  await startBtn.click();
  await host.waitForTimeout(1500);
  return { started: true, warning };
}

async function endGame(host) {
  const home = host.getByRole("button", { name: "Back to lobby" });
  if (await home.isVisible().catch(() => false)) {
    await home.click();
    await host.getByRole("button", { name: "End game" }).click();
    await host.waitForTimeout(800);
  }
}

async function exerciseGame(id, host, players, code) {
  const g = GAMES.find((x) => x.id === id);
  const entry = { id, name: g?.name, started: false, actions: [], bugs: [], status: "FAIL" };
  try {
    await waitLobby(host);
    const { started, warning } = await startGame(host, g.name);
    entry.warning = warning;
    if (!started) {
      entry.status = warning ? "PARTIAL" : "FAIL";
      entry.note = warning || "Could not start";
      results.games[id] = entry;
      await shot(host, `blocked-${id}`);
      return;
    }
    entry.started = true;
    await shot(host, `start-${id}-host`);

    // Generic: wait for any game UI
    await host.waitForTimeout(2000);
    for (const [i, p] of players.entries()) {
      await shot(p, `start-${id}-p${i}`);
    }

    const hostAct = async (re, name) => {
      const btn = host.getByRole("button", { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        entry.actions.push(`host:${name}`);
        await host.waitForTimeout(600);
        return true;
      }
      return false;
    };

    const playerAct = async (pi, re, name) => {
      const btn = players[pi].getByRole("button", { name: re }).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        entry.actions.push(`p${pi}:${name}`);
        await players[pi].waitForTimeout(600);
        return true;
      }
      return false;
    };

    switch (id) {
      case "housie":
        await hostAct(/Next number/i, "next");
        await hostAct(/Next number/i, "next");
        await players[0].locator("button").filter({ hasText: /^\d+$/ }).first().click().catch(() => {});
        entry.actions.push("p0:mark");
        break;
      case "chor-kaun":
        await host.waitForTimeout(3000);
        await playerAct(0, /peek|hold|envelope/i, "peek");
        await hostAct(/next|vote|reveal|end/i, "advance");
        break;
      case "emoji-picture":
        await players[0].locator('input[type="text"]').first().fill("test");
        await players[0].getByRole("button", { name: /send|submit|answer/i }).first().click().catch(() => {});
        entry.actions.push("p0:guess");
        await host.waitForTimeout(3000);
        break;
      case "charades":
        await playerAct(0, /Got it|Pass|start/i, "charades");
        await host.waitForTimeout(2000);
        break;
      case "antakshari":
        await playerAct(0, /Valid|Challenge|Give up/i, "antakshari");
        break;
      case "draw-guess":
        await players[0].locator("canvas").first().click({ position: { x: 50, y: 50 } }).catch(() => {});
        await players[1].locator('input[type="text"]').first().fill("samosa").catch(() => {});
        entry.actions.push("draw+guess");
        break;
      case "kaun-banega-champion":
        await players[0].getByRole("button").filter({ hasText: /^[A-D]$/ }).first().click().catch(() => {});
        await hostAct(/next|reveal|lock/i, "kbc");
        break;
      case "raja-mantri":
        await playerAct(0, /Raja|reveal/i, "raja");
        await host.waitForTimeout(2000);
        break;
      case "odd-word-out":
        await host.waitForTimeout(2500);
        await playerAct(0, /vote/i, "vote");
        break;
      case "ludo-yatra":
        await playerAct(0, /Roll/i, "roll");
        await host.waitForTimeout(1500);
        break;
      case "sound-guru":
        await playerAct(0, /Reveal|Done/i, "sound");
        await players[1].locator('input[type="text"]').first().fill("whistle").catch(() => {});
        break;
      case "jaldi-bolo":
        await players[0].locator('input[type="text"]').first().fill("Amitabh").catch(() => {});
        await host.waitForTimeout(3000);
        break;
      default:
        break;
    }

    const stuck = await bodyText(host);
    if (/error|undefined|NaN|Cannot read/i.test(stuck)) {
      entry.bugs.push({ severity: "high", text: stuck.slice(0, 200) });
    }
    await endGame(host);
    for (const p of players) {
      await p
        .getByText(/game chun|Aa gaye|picking/i)
        .first()
        .waitFor({ timeout: 15000 })
        .catch(async () => {
          entry.bugs.push({ severity: "med", text: `Player at ${p.url()} may not be back in lobby` });
        });
    }
    entry.status = entry.bugs.some((b) => b.severity === "high") ? "FAIL" : entry.actions.length ? "PASS" : "PARTIAL";
    if (!entry.actions.length) entry.note = "Started but no game-specific actions matched";
  } catch (e) {
    entry.bugs.push({ severity: "high", text: e.message });
    entry.status = "FAIL";
    await shot(host, `error-${id}`).catch(() => {});
  }
  results.games[id] = entry;
}

async function testSharedFlows(context, host, players, code) {
  // Wrong code (demo always exists — note in report)
  const wrong = await context.newPage();
  await wrong.setViewportSize(MOBILE);
  await wrong.goto(`${BASE}/join`);
  await wrong.locator("#room-code").fill("ZZZZ");
  await wrong.locator("#player-name").fill("Wrong");
  await wrong.getByRole("button", { name: "Chalo, join karo", exact: true }).click();
  await wrong.waitForTimeout(1500);
  const demoWrong = await wrong.getByText(/No party with that code/).isVisible().catch(() => false);
  results.flows.push({
    name: "wrong-code-local",
    ok: !demoWrong,
    note: demoWrong ? "Shows error in demo (unexpected)" : "Demo mode accepts any code — production differs",
  });
  await wrong.close();

  // Leave player
  const p = players[0];
  await p.getByRole("button", { name: "Leave party" }).click();
  await p.getByRole("button", { name: /Leave party|haan/i }).last().click();
  await p.waitForURL("**/", { timeout: 10000 }).catch(() => {});
  results.flows.push({
    name: "player-leave",
    ok: p.url().includes("/join") || p.url().endsWith("/"),
  });
  await shot(p, "after-leave");

  // Rejoin
  await p.goto(`${BASE}/join`);
  await p.locator("#room-code").fill(code);
  await p.locator("#player-name").fill("BotA");
  await p.getByRole("button", { name: "Chalo, join karo", exact: true }).click();
  await p.waitForURL(`**/room/${code}/play`, { timeout: 15000 });
  results.flows.push({ name: "player-rejoin", ok: true });

  // Host refresh mid-lobby
  await host.reload();
  await host.getByText(/Kaun kaun|Waiting/).first().waitFor({ timeout: 20000 });
  results.flows.push({ name: "host-refresh-lobby", ok: true });

  // Remove player
  await host.getByRole("button", { name: /Remove BotB/i }).click();
  await host.getByRole("button", { name: "Remove" }).click();
  await players[1].getByText(/removed you|can't rejoin/i).waitFor({ timeout: 15000 }).catch(() => {});
  const kicked = await players[1].getByText(/removed you/).isVisible().catch(() => false);
  results.flows.push({ name: "host-remove-player", ok: kicked });
  await shot(players[1], "kicked-player");

  // Too few for raja-mantri with 3 bots (one removed) — open sheet
  await host.locator("text=Raja").first().click();
  const needs4 = await host.getByText(/Needs at least 4|Exactly 4/i).first().isVisible().catch(() => false);
  const startDisabled = await host.getByRole("button", { name: /Shuru karo/i }).isDisabled();
  results.flows.push({ name: "too-few-players-raja", ok: needs4 || startDisabled });
  await host.keyboard.press("Escape").catch(() => {});
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  context.setDefaultTimeout(20000);

  const { host, code } = await setupHost(context);
  log(`Room ${code}`);
  const names = ["BotA", "BotB", "BotC", "BotD"];
  const players = [];
  for (let i = 0; i < names.length; i++) {
    players.push(await joinPlayer(context, code, names[i], i));
    await host.waitForTimeout(800);
  }
  await shot(host, "lobby-4-players");
  results.flows.push({ name: "lobby-join-4", ok: players.length === 4 });

  for (const g of GAMES) {
    log(`Testing ${g.id}`);
    await exerciseGame(g.id, host, players, code);
  }

  await testSharedFlows(context, host, players, code);

  // Home and /games
  const home = await context.newPage();
  await home.setViewportSize(MOBILE);
  await home.goto(BASE);
  await shot(home, "home-mobile");
  await home.goto(`${BASE}/games`);
  await shot(home, "games-mobile");
  results.flows.push({ name: "home-and-games", ok: true });
  await home.close();

  await writeFile(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await browser.close();
  log(`Done — results in ${OUT}/results.json`);
  const summary = Object.entries(results.games).map(([id, r]) => `${id}: ${r.status}`).join(", ");
  log(summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
