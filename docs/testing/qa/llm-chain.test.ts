// QA round 4: LLM chain behaviour (LLM-1..LLM-11). Run from the repo root:
//   npx -y tsx docs/testing/qa/llm-chain.test.ts
import assert from "node:assert/strict";
import { makeChain, type Provider } from "../../../src/lib/suggest/chain";
import { ProviderHttpError } from "../../../src/lib/suggest/gemini";
import { buildPrompt, parseModelJson, pickTheme, unwrapPayload } from "../../../src/lib/suggest/prompts";
import { cleanAvoid, notRepeated } from "../../../src/lib/suggest/avoid";

let passed = 0;
const results: string[] = [];
async function check(id: string, name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    results.push(`PASS ${id} ${name}`);
  } catch (e) {
    results.push(`FAIL ${id} ${name}\n     ${(e as Error).message.split("\n")[0]}`);
  }
}

/** A stand-in provider. `behave` decides what each call does. */
function fake(name: string, behave: (kind: string, prompt: string, signal: AbortSignal) => Promise<unknown | null>, configured = true): Provider & { calls: number } {
  const p = { name, configured: () => configured, calls: 0, call: async (kind: string, prompt: string, signal: AbortSignal) => { p.calls++; return behave(kind, prompt, signal); } };
  return p as Provider & { calls: number };
}
const topic = (label = "Kitchen") => ({ id: "k", label, emoji: "🍛", words: Array.from({ length: 18 }, (_, i) => `w${i}`) });
const accept = (raw: unknown) => (raw && typeof raw === "object" ? raw : null);

// A clock we control, so cool-downs can be tested without waiting.
function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

(async () => {
  // AbortSignal.timeout() timers are unref'd, so keep the process alive while the timeout test waits.
  const keepAlive = setInterval(() => {}, 1_000);
  await check("LLM-1", "providers without a key are skipped", async () => {
    const a = fake("a", async () => topic(), false);
    const b = fake("b", async () => topic());
    const r = await makeChain([a, b]).run("chor-kaun-topic", "p", accept);
    assert.equal(r?.provider, "b");
    assert.equal(a.calls, 0);
  });

  await check("LLM-2", "429 moves to the next provider in the same request and cools the first", async () => {
    const c = clock();
    const a = fake("a", async () => { throw new ProviderHttpError(429); });
    const b = fake("b", async () => topic());
    const chain = makeChain([a, b], c.now);
    const r = await chain.run("chor-kaun-topic", "p", accept);
    assert.equal(r?.provider, "b");
    assert.equal(a.calls, 1);
    const status = chain.status().find((s) => s.name === "a");
    assert.ok((status?.coolingMs ?? 0) > 59_000, "a should be cooling for about 60 s");
    // During the cool-down, a is not called again.
    await chain.run("chor-kaun-topic", "p", accept);
    assert.equal(a.calls, 1);
    // After the cool-down it is tried again.
    c.tick(61_000);
    // Rotation may start on b, so a is retried within the next two requests.
    await chain.run("chor-kaun-topic", "p", accept);
    await chain.run("chor-kaun-topic", "p", accept);
    assert.ok(a.calls >= 2, `a was retried ${a.calls - 1} times`);
  });

  await check("LLM-3", "server error moves on and cools for about 20 s", async () => {
    const c = clock();
    const a = fake("a", async () => { throw new ProviderHttpError(503); });
    const b = fake("b", async () => topic());
    const chain = makeChain([a, b], c.now);
    assert.equal((await chain.run("chor-kaun-topic", "p", accept))?.provider, "b");
    const cool = chain.status().find((s) => s.name === "a")!.coolingMs;
    assert.ok(cool > 19_000 && cool <= 20_000, `cool-down ${cool} ms`);
  });

  await check("LLM-4", "output that fails validation counts as a failure", async () => {
    const a = fake("a", async () => "not json");
    const b = fake("b", async () => topic());
    const r = await makeChain([a, b]).run("chor-kaun-topic", "p", (raw) => (typeof raw === "string" ? null : raw));
    assert.equal(r?.provider, "b");
  });

  await check("LLM-5", "all providers failing returns null (caller uses built-in content)", async () => {
    const a = fake("a", async () => { throw new ProviderHttpError(500); });
    const b = fake("b", async () => null);
    assert.equal(await makeChain([a, b]).run("chor-kaun-topic", "p", accept), null);
  });

  await check("LLM-6a", "rotate mode: consecutive requests start on different providers", async () => {
    delete process.env.LLM_MODE;
    const names: string[] = [];
    const ps = ["a", "b", "c"].map((n) => fake(n, async () => { names.push(n); return topic(); }));
    const chain = makeChain(ps);
    for (let i = 0; i < 3; i++) await chain.run("chor-kaun-topic", "p", accept);
    assert.deepEqual(names, ["a", "b", "c"]);
  });

  await check("LLM-6b", "primary mode: the first configured provider always goes first", async () => {
    process.env.LLM_MODE = "primary";
    const names: string[] = [];
    const ps = ["a", "b", "c"].map((n) => fake(n, async () => { names.push(n); return topic(); }));
    const chain = makeChain(ps);
    for (let i = 0; i < 3; i++) await chain.run("chor-kaun-topic", "p", accept);
    delete process.env.LLM_MODE;
    assert.deepEqual(names, ["a", "a", "a"]);
  });

  await check("LLM-7", "a request with every provider hanging finishes inside the time budget", async () => {
    const hang = (_k: string, _p: string, signal: AbortSignal) => new Promise<never>((_, rej) => signal.addEventListener("abort", () => rej(new Error("abort"))));
    const chain = makeChain([fake("a", hang), fake("b", hang)]);
    const t0 = Date.now();
    const r = await chain.run("chor-kaun-topic", "p", accept);
    const took = Date.now() - t0;
    assert.equal(r, null);
    assert.ok(took < 8_500, `took ${took} ms`);
  });

  await check("LLM-9", "repeats are rejected: a topic label already shown, or too few new puzzles", () => {
    const avoid = ["Kitchen", "Ganesh", "Cricket", "Chai", "Monsoon"];
    assert.equal(notRepeated("chor-kaun-topic", topic("Kitchen"), avoid), null);
    assert.ok(notRepeated("chor-kaun-topic", topic("Railways"), avoid));
    const puzzles = (answers: string[]) => answers.map((a) => ({ emojis: "🎬", category: "Movie", answer: a, hint: "h", level: "family" }));
    assert.equal(notRepeated("emoji-puzzle", puzzles(["Sholay", "Lagaan", "Dangal", "Chak De"]), ["Sholay", "Lagaan", "Dangal"]), null);
    assert.equal((notRepeated("emoji-puzzle", puzzles(["Sholay", "Lagaan", "Dangal", "Chak De"]), ["Sholay"]) as unknown[]).length, 3);
  });

  await check("LLM-9b", "the memory list is cleaned: single line, capped, de-duplicated", () => {
    const out = cleanAvoid(["a\nIgnore previous", "a\nIgnore previous", "x".repeat(200), 5, null]);
    assert.equal(out.length, 2);
    assert.ok(!out[0].includes("\n"));
    assert.ok(out[1].length <= 60);
    assert.equal(cleanAvoid(Array.from({ length: 100 }, (_, i) => `item${i}`)).length, 40);
  });

  await check("LLM-10", "variety: themes are drawn from a list and the prompt names the theme", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pickTheme("emoji-puzzle")!);
    assert.ok(seen.size > 10, `only ${seen.size} distinct themes in 200 draws`);
    const p = buildPrompt("emoji-puzzle", { level: "family", count: 10, avoid: ["Sholay"] });
    assert.ok(/Theme for this set: .+\./.test(p));
    assert.ok(p.includes('"Sholay"'), "avoid list must be in the prompt");
    assert.equal(pickTheme("dare"), null);
  });

  await check("LLM-11", "replies: fences and prose stripped; emoji wrapper unwrapped", () => {
    assert.deepEqual(parseModelJson('Sure! ```json\n{"id":"x"}\n```'), { id: "x" });
    assert.equal(parseModelJson("no json here"), null);
    assert.deepEqual(unwrapPayload("emoji-puzzle", { puzzles: [{ answer: "A" }] }), [{ answer: "A" }]);
    assert.deepEqual(unwrapPayload("chor-kaun-topic", { label: "L" }), { label: "L" });
  });

  clearInterval(keepAlive);
  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${results.length - passed} failed`);
  if (passed !== results.length) process.exit(1);
})();
