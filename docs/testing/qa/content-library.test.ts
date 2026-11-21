// Content library: the app-side helpers (no database). Run from the repo root:
//   npx -y tsx docs/testing/qa/content-library.test.ts
import assert from "node:assert/strict";
import { EMOJI_PUZZLES } from "../../../src/content/emoji-picture";
import { itemsFrom, normText, pickFromLibrary, pickPlan, saveToLibrary, shapeServed } from "../../../src/lib/suggest/library";
import { csvCell } from "../../../src/lib/admin/queries";
import { GROQ_DEFAULT_MODEL, OPENROUTER_DEFAULT_MODEL, providerStatus } from "../../../src/lib/suggest/chain";
import { knownFlags, LLM_PROVIDERS } from "../../../src/lib/admin/flags";

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

(async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  await check("LIB-1", "normalising matches the database rule for English text", () => {
    assert.equal(normText("  Sholay!! "), "sholay");
    assert.equal(normText("Dil  Chahta-Hai"), "dil chahta hai");
  });
  await check("LIB-2", "emoji picks ask for a full round from the allowed levels", () => {
    const p = pickPlan("emoji-puzzle", { level: "kids", count: 8, avoid: ["Sholay!"] });
    assert.deepEqual(p.categories, ["kids"]);
    assert.equal(p.count, 8);
    assert.equal(p.min, 8);
    assert.deepEqual(p.excludeNorms, ["sholay"]);
    assert.deepEqual(pickPlan("emoji-puzzle", { level: "adults" }).categories, ["family", "adults"]);
    assert.deepEqual(pickPlan("emoji-puzzle", { level: "nope" }).categories, ["kids", "family"]);
  });
  await check("LIB-3", "topic picks exclude topic ids; dare picks use the audience", () => {
    assert.deepEqual(pickPlan("chor-kaun-topic", { excludeTopicIds: ["rivers"] }).excludeIds, ["rivers"]);
    assert.deepEqual(pickPlan("dare", { audience: "mixed" }).categories, ["mixed"]);
    assert.deepEqual(pickPlan("dare", {}).categories, ["family"]);
  });
  await check("LIB-4", "built-in puzzles used to pad an AI reply are not saved to the library", () => {
    const builtin = EMOJI_PUZZLES[0]!;
    const ai = { emojis: "🚂🌧️💃", category: "Song", answer: "Chaiyya Chaiyya Test", hint: "On a train roof", level: "family" as const };
    const items = itemsFrom("emoji-puzzle", [ai, builtin]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.key, "Chaiyya Chaiyya Test");
    assert.equal(items[0]!.category, "family");
  });
  await check("LIB-5", "topics are keyed by label and dares by text and audience", () => {
    const t = itemsFrom("chor-kaun-topic", { id: "rivers", label: "Rivers", emoji: "🌊", words: ["Ganga"] });
    assert.equal(t[0]!.key, "Rivers");
    assert.equal(t[0]!.category, "any");
    const d = itemsFrom("dare", { text: "Sing a lullaby in a villain voice." }, { audience: "mixed" });
    assert.equal(d[0]!.category, "mixed");
  });
  await check("LIB-6", "served rows are re-checked by the same validators as AI output", () => {
    assert.equal(shapeServed("dare", [{ data: { text: "short" } }], {}), null);
    assert.deepEqual(shapeServed("dare", [{ data: { text: "Do a slow-motion cricket shot." } }], {}), { text: "Do a slow-motion cricket shot." });
    assert.equal(shapeServed("chor-kaun-topic", [], {}), null);
  });
  await check("LIB-7", "with no database the library steps aside (null) instead of failing", async () => {
    assert.equal(await pickFromLibrary("dare", {}, { userId: "00000000-0000-0000-0000-000000000000" }), null);
    assert.equal(await saveToLibrary("dare", [{ category: "family", key: "x", data: { text: "x" } }], "llm:groq"), null);
  });
  await check("LIB-8", "CSV cells are quoted and formulas are defused", () => {
    assert.equal(csvCell('He said "hi"'), '"He said ""hi"""');
    assert.equal(csvCell("=HYPERLINK(1)"), `"'=HYPERLINK(1)"`);
    assert.equal(csvCell({ a: 1 }), '"{""a"":1}"');
    assert.equal(csvCell(null), '""');
  });
  await check("LIB-9", "Groq is first in the chain, with defaults that can be overridden", () => {
    assert.equal(providerStatus()[0]!.name, "groq");
    assert.equal(LLM_PROVIDERS[0], "groq");
    assert.ok(GROQ_DEFAULT_MODEL.length > 0 && OPENROUTER_DEFAULT_MODEL.length > 0);
  });
  await check("LIB-10", "providers without keys are reported as not configured", () => {
    for (const k of ["GROQ_API_KEY", "OPENROUTER_API_KEY", "GEMINI_API_KEY", "CF_API_TOKEN"]) delete process.env[k];
    assert.ok(providerStatus().every((p) => p.configured === false));
  });
  await check("LIB-11", "the library has its own kill switch", () => {
    assert.ok(knownFlags().includes("library"));
  });

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${results.length - passed} failed`);
  process.exit(passed === results.length ? 0 : 1);
})();
