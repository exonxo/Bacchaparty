// KBC news questions: filtering, the two-step AI pipeline, validation, saving and the in-game pick.
// No database and no network: NewsAPI, the Bharat News API and the AI provider are fake fetches.
// Run from the repo root:
//   npx -y tsx docs/testing/qa/kbc-news.test.ts
import assert from "node:assert/strict";
import {
  answerInSource, fetchBharat, fetchNewsapi, isGeneralNewsTheme, makeNewsQuestions, NEWS_EXPIRY_DAYS, prefilter, saveNews, type Article,
} from "../../../src/lib/suggest/news";
import { validateKbcQuestion, validateKbcQuestions } from "../../../src/lib/suggest/validate";
import { itemsFrom, LIBRARY_KINDS, shapeServed } from "../../../src/lib/suggest/library";
import { newsFor, newsLabel, NEWS_RUNGS, pickQuestion, type NewsQuestion } from "../../../src/games/kaun-banega-champion/questions";
import { KBC_QUESTIONS } from "../../../src/content/kbc";
import { runTopup } from "../../../src/lib/suggest/topup";

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

const today = new Date().toISOString();
const day = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

// --- Fake sources ------------------------------------------------------------------------------------
const NEWSAPI_ARTICLES = [
  { title: "Neeraj Chopra wins gold at the Diamond League final in Brussels - NDTV Sports", description: "Neeraj Chopra won the javelin gold with a best throw of 90.2 metres.", url: "https://www.ndtv.com/sports/neeraj", publishedAt: today, source: { name: "NDTV Sports" } },
  { title: "Man arrested after murder in a Delhi market", description: "Police said the accused was held.", url: "https://example.in/a", publishedAt: today, source: { name: "X" } },
  { title: "ISRO launches a new weather satellite from Sriharikota", description: "The satellite lifted off from Sriharikota on Tuesday morning.", url: "https://www.thehindu.com/isro", publishedAt: today, source: { name: "The Hindu" } },
  { title: "Mumbai to host the national chess championship in December", description: "The national chess championship will be held in Mumbai this December.", url: "https://www.indiatoday.in/chess", publishedAt: today, source: { name: "India Today" } },
  { title: "Kerala win the Santosh Trophy football title at home", description: "Kerala beat Bengal in the final.", url: "https://www.thehindu.com/kerala", publishedAt: today, source: { name: "The Hindu" } },
  { title: "Live updates: India vs Australia third Test day two", description: "Follow the action.", url: "https://example.in/live", publishedAt: today, source: { name: "X" } },
  { title: "Old story about a museum opening in Kolkata long ago", description: "The museum opened.", url: "https://example.in/old", publishedAt: day(60), source: { name: "X" } },
  { title: "[Removed]", description: "", url: "https://example.in/r", publishedAt: today, source: { name: "[Removed]" } },
];
const BHARAT = [
  { state: "Assam", last_updated: today, headlines: ["Kaziranga National Park records rise in rhino numbers", "Flood waters rise in two districts"] },
  { state: "Goa", last_updated: today, headlines: ["Goa to host the International Film Festival of India again"] },
];

let newsapiMode: "ok" | "refused" | "down" = "ok";
let bharatMode: "ok" | "down" = "ok";
let checkerMode: "honest" | "unsure" = "honest";
const providerCalls: string[] = [];
const sourceCalls: string[] = [];

/** What the fake AI writes for each headline it is shown (by a word in the headline). */
const WRITE: Record<string, { keep: boolean; q?: string; a?: string; w?: string[]; category?: string }> = {
  Neeraj: { keep: true, q: "Which Indian athlete won javelin gold at the Diamond League final in Brussels?", a: "Neeraj Chopra", w: ["Kishore Jena", "Arshad Nadeem", "Annu Rani"], category: "Sports" },
  ISRO: { keep: true, q: "From which launch site did ISRO launch its new weather satellite?", a: "Sriharikota", w: ["Thumba", "Kourou", "Baikonur"], category: "Science" },
  Mumbai: { keep: true, q: "Which city will host the national chess championship in December?", a: "Pune", w: ["Chennai", "Kolkata", "Delhi"], category: "Sports" },
  Kerala: { keep: false },
  Kaziranga: { keep: true, q: "Which national park in Assam has recorded a rise in rhino numbers?", a: "Kaziranga", w: ["Manas", "Jim Corbett", "Gir"], category: "Environment" },
  Goa: { keep: true, q: "Which state will host the International Film Festival of India again?", a: "Goa", w: ["Kerala", "Maharashtra", "Karnataka"], category: "Entertainment" },
};
/** The fake checker answers wrongly for the ISRO question, so it must be rejected. */
const CHECKER_WRONG = new Set(["From which launch site did ISRO launch its new weather satellite?"]);

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://newsapi.org/")) {
    sourceCalls.push("newsapi");
    if (new Headers(init?.headers).get("x-api-key") !== "test-news-key") return Response.json({ status: "error", code: "apiKeyInvalid" }, { status: 401 });
    if (newsapiMode === "refused") return Response.json({ status: "error", code: "corsNotAllowed", message: "Requests from the browser are not allowed on the Developer plan" }, { status: 426 });
    if (newsapiMode === "down") throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
    return Response.json({ status: "ok", totalResults: NEWSAPI_ARTICLES.length, articles: NEWSAPI_ARTICLES });
  }
  if (url.startsWith("https://bharat-news-api.vercel.app/")) {
    sourceCalls.push("bharat");
    return bharatMode === "down" ? new Response("Service Unavailable", { status: 503 }) : Response.json(BHARAT);
  }
  if (url.startsWith("https://api.groq.com/")) {
    const body = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
    const prompt = body.messages.map((m) => m.content).join("\n");
    providerCalls.push(prompt.includes("You check quiz questions") ? "check" : "write");
    let reply: unknown;
    if (prompt.includes("You check quiz questions")) {
      const checks = [...prompt.matchAll(/^(\d+)\. Source: (".*")\n {3}Question: (".*")\n {3}Options: (.*)$/gm)].map((m) => {
        const source = JSON.parse(m[2]) as string;
        const q = JSON.parse(m[3]) as string;
        const opts = [...m[4].matchAll(/([ABCD])\) ("(?:[^"\\]|\\.)*")/g)].map((o) => ({ letter: o[1], text: JSON.parse(o[2]) as string }));
        if (checkerMode === "unsure") return { i: Number(m[1]), pick: "unsure", quote: "" };
        const right = opts.find((o) => source.includes(o.text));
        const pick = CHECKER_WRONG.has(q) ? opts.find((o) => o !== right)! : right;
        return { i: Number(m[1]), pick: pick?.letter ?? "unsure", quote: right ? right.text : "" };
      });
      reply = { checks };
    } else {
      const lines = [...prompt.matchAll(/^(\d+)\. \[(\d{4}-\d{2}-\d{2})\] (".*")$/gm)];
      reply = {
        items: lines.map((m) => {
          const text = JSON.parse(m[3]) as string;
          const key = Object.keys(WRITE).find((k) => text.includes(k));
          const w = key ? WRITE[key] : { keep: false };
          return { i: Number(m[1]), keep: w.keep, skip_reason: w.keep ? "" : "not suitable", q: w.q ?? "", a: w.a ?? "", w: w.w ?? [], difficulty: 4, category: w.category ?? "India", level: "family" };
        }),
      };
    }
    return Response.json({ choices: [{ message: { content: JSON.stringify(reply) } }] });
  }
  return realFetch(input, init);
}) as typeof fetch;

(async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  for (const k of ["GEMINI_API_KEY", "OPENROUTER_API_KEY", "CF_API_TOKEN", "CF_ACCOUNT_ID", "NEWSAPI_KEY"]) delete process.env[k];

  // Sources
  await check("SRC-1", "NewsAPI without a key is reported as not configured and not called", async () => {
    const r = await fetchNewsapi();
    assert.deepEqual(r.report, { ok: false, count: 0, error: "not_configured" });
    assert.equal(sourceCalls.length, 0);
  });
  process.env.NEWSAPI_KEY = "test-news-key";
  await check("SRC-2", "NewsAPI articles are tidied: outlet suffix cut, [Removed] dropped, https links only", async () => {
    const r = await fetchNewsapi();
    assert.equal(r.report.ok, true);
    assert.equal(r.articles.length, (NEWSAPI_ARTICLES.length - 1) * 2, "two family queries, [Removed] dropped");
    assert.equal(r.articles[0].headline, "Neeraj Chopra wins gold at the Diamond League final in Brussels");
    assert.equal(r.articles[0].outlet, "NDTV Sports");
    assert.equal(r.articles[0].source, "newsapi");
  });
  await check("SRC-3", "a theme narrows NewsAPI to one query; general themes don't", async () => {
    const n = sourceCalls.length;
    await fetchNewsapi("Cricket");
    assert.equal(sourceCalls.length - n, 1);
    assert.equal(isGeneralNewsTheme("Current affairs"), true);
    assert.equal(isGeneralNewsTheme(" news "), true);
    assert.equal(isGeneralNewsTheme(undefined), true);
    assert.equal(isGeneralNewsTheme("Cricket"), false);
  });
  await check("SRC-4", "NewsAPI refusing a production server comes back as its error code, not an exception", async () => {
    newsapiMode = "refused";
    const r = await fetchNewsapi();
    newsapiMode = "ok";
    assert.deepEqual(r.report, { ok: false, count: 0, error: "corsNotAllowed" });
  });
  await check("SRC-5", "NewsAPI timing out is reported as timeout", async () => {
    newsapiMode = "down";
    const r = await fetchNewsapi();
    newsapiMode = "ok";
    assert.equal(r.report.error, "timeout");
  });
  await check("SRC-6", "Bharat headlines are read per state; a 503 is reported, not thrown", async () => {
    const r = await fetchBharat();
    assert.equal(r.articles.length, 3);
    assert.equal(r.articles[0].source, "bharat");
    assert.equal(r.articles[0].description, "");
    bharatMode = "down";
    const d = await fetchBharat();
    bharatMode = "ok";
    assert.deepEqual(d.report, { ok: false, count: 0, error: "http_503" });
  });

  // Filtering
  await check("PRE-1", "crime, live blogs, old stories, disasters and repeats are dropped before the AI", async () => {
    const na = await fetchNewsapi();
    const bh = await fetchBharat();
    const r = prefilter([...na.articles, ...bh.articles], new Set());
    const heads = r.kept.map((a) => a.headline);
    assert.ok(!heads.some((h) => /murder|Live updates|Old story|Flood/.test(h)), heads.join(" / "));
    assert.ok(heads.includes("ISRO launches a new weather satellite from Sriharikota"));
    assert.equal(r.repeats, NEWSAPI_ARTICLES.length - 1, "second query's copies");
    assert.equal(r.blocked, 4);
  });
  await check("PRE-2", "headlines already in the library are not used again", () => {
    const a: Article = { source: "bharat", headline: "Goa to host the International Film Festival of India again", description: "", date: today.slice(0, 10) };
    const r = prefilter([a], new Set(["goa to host the international film festival of india again"]));
    assert.equal(r.kept.length, 0);
    assert.equal(r.repeats, 1);
  });
  await check("PRE-3", "the answer must appear in the source, word by word", () => {
    assert.equal(answerInSource("Neeraj Chopra", "Neeraj Chopra won the javelin gold"), true);
    assert.equal(answerInSource("Pune", "The championship will be held in Mumbai"), false);
    assert.equal(answerInSource("90.2 metres", "a best throw of 90.2 metres"), true);
    assert.equal(answerInSource("", "anything"), false);
  });

  // Validation
  const good = {
    q: "Which city will host the national chess championship in December?", a: "Mumbai", w: ["Pune", "Chennai", "Delhi"], step: 4, level: "family", category: "Sports",
    news: { source: "newsapi", headline: "Mumbai to host the national chess championship in December", date: "2026-11-10", url: "https://www.indiatoday.in/chess", outlet: "India Today" },
  };
  await check("VAL-1", "a well-formed news question passes with its source", () => {
    const v = validateKbcQuestion(good);
    assert.ok(v);
    assert.equal(v.news?.source, "newsapi");
    assert.equal(v.news?.url, "https://www.indiatoday.in/chess");
  });
  await check("VAL-2", "bad questions are rejected", () => {
    assert.equal(validateKbcQuestion({ ...good, q: "Which city hosts it" }), null, "no question mark");
    assert.equal(validateKbcQuestion({ ...good, w: ["Pune", "Pune", "Delhi"] }), null, "repeated option");
    assert.equal(validateKbcQuestion({ ...good, w: ["mumbai", "Pune", "Delhi"] }), null, "answer repeated as a wrong option");
    assert.equal(validateKbcQuestion({ ...good, w: ["Pune", "Delhi"] }), null, "three wrong options needed");
    assert.equal(validateKbcQuestion({ ...good, step: 11 }), null, "difficulty 1 to 10");
    assert.equal(validateKbcQuestion({ ...good, level: "kids" }), null, "no kids level");
    assert.equal(validateKbcQuestion({ ...good, news: undefined }), null, "source required");
    assert.equal(validateKbcQuestion({ ...good, news: { ...good.news, source: "blog" } }), null, "known sources only");
    assert.equal(validateKbcQuestion({ ...good, news: { ...good.news, date: "10 Nov" } }), null, "ISO date");
  });
  await check("VAL-3", "non-https links are dropped, unknown categories are left out", () => {
    const v = validateKbcQuestion({ ...good, category: "Gossip", news: { ...good.news, url: "javascript:alert(1)" } });
    assert.ok(v);
    assert.equal(v.news?.url, undefined);
    assert.equal(v.category, undefined);
  });
  await check("VAL-4", "the library serves news questions to KBC and checks them again on the way out", () => {
    assert.ok(LIBRARY_KINDS.includes("kbc-question"));
    assert.equal(validateKbcQuestions([good, good, { q: "bad" }])?.length, 1);
  });

  // Pipeline
  process.env.GROQ_API_KEY = "test-groq";
  await check("GEN-1", "the pipeline keeps only questions the checker confirms from the source", async () => {
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    const qs = r.questions.map((q) => q.q);
    assert.deepEqual(qs.sort(), [
      "Which Indian athlete won javelin gold at the Diamond League final in Brussels?",
      "Which national park in Assam has recorded a rise in rhino numbers?",
      "Which state will host the International Film Festival of India again?",
    ]);
    assert.equal(r.stats.reasons.answer_not_in_source, 1, "Pune is not in the Mumbai story");
    assert.equal(r.stats.reasons.checker_disagrees, 1, "ISRO question");
    assert.equal(r.stats.reasons.skipped_by_ai, 1, "Kerala");
    assert.deepEqual(providerCalls.slice(-2), ["write", "check"]);
    assert.equal(r.stats.kept, 3);
    assert.equal(r.stats.sources.newsapi.ok, true);
    assert.equal(r.stats.sources.bharat.ok, true);
  });
  await check("GEN-2", "items carry the source, the article date, a 60-day expiry and the level as category", async () => {
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    for (const it of r.items) {
      const news = it.data.news as { date: string; source: string };
      assert.equal(it.category, "family");
      assert.equal(Date.parse(it.expires_at!) - Date.parse(news.date), NEWS_EXPIRY_DAYS * 86400_000);
      assert.equal(it.theme, undefined, "no theme for general news");
    }
    const t = await makeNewsQuestions({ want: 1, theme: "Sports", deadline: Date.now() + 20_000 });
    assert.ok(t.items.length <= 1);
    if (t.items[0]) assert.equal(t.items[0].theme, "Sports");
  });
  await check("GEN-3", "when the checker is unsure nothing is kept", async () => {
    checkerMode = "unsure";
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    checkerMode = "honest";
    assert.equal(r.items.length, 0);
    assert.equal(r.stats.reasons.checker_unsure, 4, "every question that reached the check");
  });
  await check("GEN-4", "with NewsAPI refused, Bharat headlines still make questions", async () => {
    newsapiMode = "refused";
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    newsapiMode = "ok";
    assert.equal(r.stats.sources.newsapi.error, "corsNotAllowed");
    assert.equal(r.items.length, 2);
    assert.ok(r.questions.every((q) => q.news?.source === "bharat"));
  });
  await check("GEN-5", "with both sources down there are no AI calls", async () => {
    newsapiMode = "down";
    bharatMode = "down";
    const n = providerCalls.length;
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    newsapiMode = "ok";
    bharatMode = "ok";
    assert.equal(r.items.length, 0);
    assert.equal(providerCalls.length, n);
  });
  await check("GEN-6", "past the deadline no AI call is started", async () => {
    const n = providerCalls.length;
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() - 1 });
    assert.equal(r.items.length, 0);
    assert.equal(providerCalls.length, n);
  });
  await check("GEN-7", "never more than asked", async () => {
    const r = await makeNewsQuestions({ want: 2, deadline: Date.now() + 20_000 });
    assert.equal(r.items.length, 2);
    assert.equal(r.stats.reasons.extra, 1);
  });
  await check("GEN-8", "saving tags each item news:newsapi or news:bharat", async () => {
    const r = await makeNewsQuestions({ want: 10, deadline: Date.now() + 20_000 });
    const saved: Record<string, number> = {};
    const n = await saveNews(r.items, async (items, source) => {
      saved[source] = items.length;
      return items.length;
    });
    assert.deepEqual(saved, { "news:newsapi": 1, "news:bharat": 2 });
    assert.equal(n, 3);
    assert.equal(await saveNews(r.items, async () => null), null, "a failed save is reported");
  });

  // In the game
  const news: NewsQuestion[] = [
    { q: "News question one for the family?", a: "A1", w: ["B1", "C1", "D1"], step: 3, level: "family", news: { source: "newsapi", headline: "h1", date: "2026-11-06", outlet: "The Hindu" } } as NewsQuestion,
    { q: "News question two for adults?", a: "A2", w: ["B2", "C2", "D2"], step: 6, level: "adults", news: { source: "bharat", headline: "h2", date: "2026-11-07" } } as NewsQuestion,
  ];
  await check("GAME-1", "news shows on every other rung with a dated label, the bank fills the rest", () => {
    assert.deepEqual([...NEWS_RUNGS], [1, 3, 5, 7, 9]);
    const q0 = pickQuestion("adults", 1, [], news, 0);
    assert.equal(q0.news, undefined, "first rung is from the bank");
    const q1 = pickQuestion("adults", 2, [], news, 1);
    assert.ok(q1.news?.startsWith("📰 In the news"));
    assert.equal(q1.options[q1.answer], q1.q.includes("one") ? "A1" : "A2");
    assert.equal(newsLabel(news[0].news!), "📰 In the news · 6 Nov 2026 · The Hindu");
    assert.equal(newsLabel(news[1].news!), "📰 In the news · 7 Nov 2026");
  });
  await check("GAME-2", "kids never get news; family gets family news only; used ones aren't repeated", () => {
    assert.equal(newsFor("kids", news).length, 0);
    assert.deepEqual(newsFor("family", news).map((q) => q.q), ["News question one for the family?"]);
    for (let i = 0; i < 20; i++) assert.equal(pickQuestion("kids", 2, [], news, 1).news, undefined);
    const used = news.map((q) => q.q);
    const q = pickQuestion("adults", 4, used, news, 3);
    assert.equal(q.news, undefined, "falls back to the bank");
    assert.ok(KBC_QUESTIONS.adults.some((b) => b.q === q.q));
  });
  await check("GAME-3", "stored rows are checked again when served; expiry is kept out of the question", () => {
    const served = shapeServed("kbc-question", [{ data: good }, { data: { q: "broken" } }], { level: "adults" }) as unknown[];
    assert.equal(served.length, 1);
    assert.equal(shapeServed("kbc-question", [{ data: { q: "broken" } }], { level: "adults" }), null);
    const items = itemsFrom("kbc-question", [{ ...good, expires_at: "2027-01-09T00:00:00.000Z" }]);
    assert.equal(items[0].expires_at, "2027-01-09T00:00:00.000Z");
    assert.equal("expires_at" in items[0].data, false);
    assert.equal(items[0].category, "family");
  });

  // Top-up guard
  await check("TOP-1", "without the database the top-up is skipped before any news is fetched", async () => {
    const n = sourceCalls.length;
    const r = await runTopup("admin", 5000);
    assert.equal(r.skipped, "database_not_configured");
    assert.equal(sourceCalls.length, n);
  });

  console.log(results.join("\n"));
  console.log(`\n${passed} passed, ${results.length - passed} failed`);
  process.exit(results.length - passed ? 1 : 0);
})();
