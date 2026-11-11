#!/usr/bin/env node
/** Shorter game cycle: start → one action → end lobby for each game. */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "testing", "e2e-run");
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

const report = {};

async function joinPage(context, code, name, idx) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(`${BASE}/join`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ n, i }) => sessionStorage.setItem("bacchaparty-me", JSON.stringify({ id: `q-${i}`, name: n, avatar: "cat" })),
    { n: name, i: idx }
  );
  await page.reload();
  await page.waitForFunction(() => document.getElementById("player-name")?.value?.trim());
  await page.locator("#room-code").click();
  await page.locator("#room-code").pressSequentially(code, { delay: 25 });
  await page.getByRole("button", { name: "Chalo, join karo", exact: true }).click();
  await page.waitForURL(`**/room/${code}/play`, { waitUntil: "domcontentloaded" });
  return page;
}

async function endToLobby(host) {
  const home = host.getByRole("button", { name: "Back to lobby" });
  if (await home.isVisible().catch(() => false)) {
    await home.click();
    await host.getByRole("button", { name: "End game", exact: true }).click();
  }
  await host.getByText("Aaj kya khelein?").waitFor({ timeout: 15000 });
}

async function tryClick(page, re) {
  const b = page.getByRole("button", { name: re }).first();
  if (await b.isVisible().catch(() => false)) {
    await b.click();
    return true;
  }
  return false;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const host = await ctx.newPage();
  await host.setViewportSize({ width: 1280, height: 900 });
  await host.goto(`${BASE}/host`, { waitUntil: "networkidle" });
  await host.waitForURL(/\/room\/([A-Z]{4})\/host/);
  const code = host.url().match(/\/room\/([A-Z]{4})\/host/)[1];
  await host.locator("#player-name").fill("HostPro");
  await host.getByRole("button", { name: "Open the lobby", exact: true }).click();
  await host.getByText("Aaj kya khelein?").waitFor();
  const players = [];
  for (const [i, n] of ["BotA", "BotB", "BotC", "BotD"].entries()) {
    players.push(await joinPage(ctx, code, n, i));
    await host.waitForTimeout(500);
  }

  for (const g of GAMES) {
    const row = { status: "FAIL", notes: [], errors: [] };
    try {
      await host.getByRole("button", { name: new RegExp(g.name.replace(/[()]/g, "\\$&"), "i") }).click();
      const start = host.getByRole("button", { name: /Shuru karo/i });
      if (await start.isDisabled()) {
        const w = await host.locator("text=/Needs at least|Max /").innerText().catch(() => "");
        row.status = "PARTIAL";
        row.notes.push(w || "start disabled");
        await host.keyboard.press("Escape");
        report[g.id] = row;
        continue;
      }
      await start.click();
      await host.waitForTimeout(2000);
      const inGame = await host.getByRole("button", { name: "Back to lobby" }).isVisible();
      if (!inGame) {
        row.notes.push("Never entered playing phase");
        report[g.id] = row;
        continue;
      }
      if (g.id === "housie") await tryClick(host, /Next number/i);
      if (g.id === "emoji-picture") await tryClick(host, /Reveal answer/i);
      if (g.id === "charades") await tryClick(host, /Start turn|Got it/i);
      if (g.id === "kaun-banega-champion") await tryClick(host, /HostPro|BotA/);
      if (g.id === "ludo-yatra") {
        for (const p of players) {
          if (await tryClick(p, /Roll/i)) break;
        }
      }
      if (g.id === "antakshari") await tryClick(players[0], /Valid/i);
      await endToLobby(host);
      const lobby = await host.getByText("Aaj kya khelein?").isVisible();
      row.status = lobby ? "PASS" : "PARTIAL";
      if (!lobby) row.notes.push("Host stuck after end");
      await host.screenshot({ path: path.join(OUT, `cycle-${g.id}.png`) });
    } catch (e) {
      row.errors.push(e.message);
      row.status = "FAIL";
      await host.screenshot({ path: path.join(OUT, `fail-${g.id}.png`) }).catch(() => {});
      try {
        await endToLobby(host);
      } catch {}
    }
    report[g.id] = row;
    console.log(g.id, row.status, row.notes.join(";"));
  }

  // mid-game host refresh on housie
  const hres = { ok: false };
  try {
    await host.getByRole("button", { name: /Housie/ }).click();
    await host.getByRole("button", { name: /Shuru karo/i }).click();
    await host.waitForTimeout(1500);
    await tryClick(host, /Next number/i);
    await host.reload();
    await host.waitForTimeout(3000);
    hres.ok = await host.getByRole("button", { name: "Back to lobby" }).isVisible();
    await endToLobby(host);
  } catch (e) {
    hres.error = e.message;
  }
  report._hostRefreshMidGame = hres;

  await writeFile(path.join(OUT, "game-cycle.json"), JSON.stringify(report, null, 2));
  await browser.close();
}

main();
