"use client";
import { useEffect, useState, type FormEvent } from "react";
import { THEME_CHIPS, THEME_MAX, cleanTheme } from "@/lib/suggest/theme";

/**
 * Power-admin views: account lookup and actions, content review, kill switches, funnel, quota,
 * health, room inspector and the audit log. Every write goes through the action endpoint, which
 * audits it first and asks for the authenticator code for destructive actions.
 */

const base = () => (typeof window === "undefined" ? "" : window.location.pathname.replace(/\/+$/, ""));

export async function view<T>(name: string, extra = ""): Promise<T> {
  const res = await fetch(`${base()}/api/data?view=${name}${extra}`, { cache: "no-store", credentials: "same-origin" });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "failed");
  return json;
}

export async function act(action: string, body: Record<string, unknown> = {}): Promise<{ ok: boolean; error?: string } & Record<string, unknown>> {
  const res = await fetch(`${base()}/api/action`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ action, ...body }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string } & Record<string, unknown>;
  return { ...json, ok: res.ok && json.ok };
}

const box = "rounded border-2 border-[#1e1a17] bg-white p-3";
const input = "w-full rounded border-2 border-[#1e1a17] bg-white px-3 py-2 text-sm";
const button = "rounded border-2 border-[#1e1a17] px-3 py-1 text-sm font-bold disabled:opacity-40";
const danger = "rounded border-2 border-[#c23a22] bg-[#c23a22] px-3 py-1 text-sm font-bold text-white disabled:opacity-40";

function Msg({ text, bad }: { text: string | null; bad?: boolean }) {
  if (!text) return null;
  return <p role="status" className={`text-sm font-bold ${bad ? "text-[#c23a22]" : "text-[#2f7d4f]"}`}>{text}</p>;
}

/** Required topic for anything the AI makes from the admin panel: free text plus quick picks. */
function ThemePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== "" && !cleanTheme(value);
  return (
    <div className="w-full space-y-1">
      <label className="block text-sm">
        <span className="font-bold">Theme (required)</span>
        <input className={input} value={value} maxLength={THEME_MAX} placeholder="e.g. Bollywood movies" onChange={(e) => onChange(e.target.value)} />
      </label>
      <div className="flex flex-wrap gap-1">
        {THEME_CHIPS.map((c) => (
          <button key={c.label} type="button" className={`${button} ${value === c.label ? "bg-[#f2b632]" : ""}`} onClick={() => onChange(c.label)}>{c.label}</button>
        ))}
      </div>
      {bad && <p className="text-xs text-[#c23a22]">Use 3–{THEME_MAX} letters, numbers and spaces, naming a topic only.</p>}
    </div>
  );
}

const REASON_TEXT: Record<string, string> = {
  emojis: "emoji missing or not only emoji", answer: "answer missing or too long", hint: "hint missing or gives the answer away",
  category: "off theme", level: "wrong level", unsafe: "unsafe", shape: "unreadable", duplicate: "repeated", invalid: "unusable",
  not_from_list: "not one of the movies", no_new_topic: "no new topic left", extra: "more than asked",
  skipped_by_ai: "story not suitable", answer_not_in_source: "answer not in the story", checker_unsure: "check: not sure",
  checker_disagrees: "check: different answer", quote_not_in_source: "check: quote not in the story", not_checked: "check failed",
  no_time_to_check: "no time to check", no_answer: "AI did not answer",
};

/** "Made 10 · kept 7 · rejected 3 (off theme 2, no answer 1)". */
function madeKeptText(r: Record<string, unknown>): string {
  const reasons = Object.entries((r.reasons as Record<string, number>) ?? {})
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${REASON_TEXT[k] ?? k} ${n}`)
    .join(", ");
  return `Made ${r.made ?? 0} · kept ${r.kept ?? 0} · rejected ${r.rejected ?? 0}${reasons ? ` (${reasons})` : ""}`;
}

/** " News: NewsAPI 70 headlines, Bharat News API down (timeout); 120 filtered out." */
function newsSourcesText(r: Record<string, unknown>): string {
  const src = r.sources as Record<string, { ok: boolean; count: number; error?: string }> | undefined;
  if (!src) return "";
  const one = (name: string, s?: { ok: boolean; count: number; error?: string }) =>
    !s ? "" : s.ok ? `${name} ${s.count} headlines` : `${name} unavailable (${s.error ?? "error"})`;
  return ` News: ${[one("NewsAPI", src.newsapi), one("Bharat News API", src.bharat)].filter(Boolean).join(", ")}; ${r.blocked ?? 0} filtered out before the AI.`;
}

/* ---------------- Account lookup and actions ---------------- */

export function AccountPanel() {
  const [email, setEmail] = useState("");
  const [id, setId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const find = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setDetail(null);
    try {
      const r = await view<{ id: string }>("find", `&email=${encodeURIComponent(email.trim())}`);
      setId(r.id);
      await load(r.id);
    } catch (err) {
      setBad(true);
      setMsg((err as Error).message === "not_found" ? "No account with that email." : "Lookup failed.");
    }
  };

  const load = async (accountId: string) => {
    const d = await view<Record<string, unknown>>("user", `&id=${accountId}`);
    setDetail(d);
  };

  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Account</h2>
      <form className="flex gap-2" onSubmit={find}>
        <input className={input} type="email" placeholder="Email of the account" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className={button}>Find</button>
      </form>
      <Msg text={msg} bad={bad} />
      {detail && id && <AccountDetail id={id} detail={detail} onChanged={() => load(id)} />}
    </div>
  );
}

function AccountDetail({ id, detail, onChanged }: { id: string; detail: Record<string, unknown>; onChanged: () => void }) {
  const [totp, setTotp] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [exported, setExported] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const rooms = (detail.rooms as { code: string; created_at: string }[]) ?? [];
  const banned = Boolean(detail.bannedUntil) && new Date(detail.bannedUntil as string).getTime() > Date.now();
  const email = (detail.email as string) ?? "";

  const exportJson = () => {
    // The export is the account record and its rooms, downloaded to this device. The view itself is audited.
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bawaal-account-${id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
  };

  const run = async (action: string, body: Record<string, unknown>, done: string) => {
    setMsg(null);
    const r = await act(action, { id, ...body });
    setBad(!r.ok);
    setMsg(r.ok ? done : `Not done: ${r.error ?? "error"}`);
    if (r.ok) onChanged();
  };

  return (
    <div className={`${box} space-y-3 text-sm`}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-bold">Email</dt><dd className="break-all">{email || "—"}</dd>
        <dt className="font-bold">Name</dt><dd>{(detail.name as string) || "—"}</dd>
        <dt className="font-bold">Sign-in</dt><dd>{detail.provider as string}</dd>
        <dt className="font-bold">Signed up</dt><dd>{new Date(detail.signedUp as string).toLocaleDateString()}</dd>
        <dt className="font-bold">Last sign-in</dt><dd>{detail.lastSignIn ? new Date(detail.lastSignIn as string).toLocaleDateString() : "—"}</dd>
        <dt className="font-bold">Status</dt><dd>{banned ? "Disabled" : "Active"}</dd>
        <dt className="font-bold">Rooms</dt><dd>{rooms.length} shown (newest first)</dd>
      </dl>
      <ul className="list-disc pl-5">
        {rooms.slice(0, 10).map((r) => (
          <li key={r.code + r.created_at}>{r.code} · {new Date(r.created_at).toLocaleDateString()}</li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button className={button} onClick={exportJson}>Export account (JSON)</button>
        {!banned && (
          <button className={danger} onClick={() => run("user.disable", { totp }, "Account disabled. It can't sign in until re-enabled.")} disabled={!totp}>
            Disable
          </button>
        )}
        {banned && <button className={button} onClick={() => run("user.enable", {}, "Account enabled.")}>Enable</button>}
      </div>
      <label className="block">
        <span className="font-bold">Authenticator code (needed to disable or delete)</span>
        <input className={input} inputMode="numeric" pattern="[0-9]{6}" value={totp} onChange={(e) => setTotp(e.target.value)} autoComplete="one-time-code" />
      </label>

      <details className="rounded border border-[#c23a22] p-2">
        <summary className="cursor-pointer font-bold text-[#c23a22]">Delete this account permanently</summary>
        <div className="mt-2 space-y-2">
          <p>Deleting removes the sign-in account and its {rooms.length} room record(s). It can&apos;t be undone. Export first.</p>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={exported} onChange={(e) => setExported(e.target.checked)} />
            I have exported this account.
          </label>
          <label className="block">
            <span className="font-bold">Type the account&apos;s email to confirm</span>
            <input className={input} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} />
          </label>
          <button
            className={danger}
            disabled={!exported || !totp || confirmEmail.trim().toLowerCase() !== email.toLowerCase()}
            onClick={() => run("user.delete", { totp, confirmEmail, exportAcknowledged: exported }, "Account deleted.")}
          >
            Delete permanently
          </button>
        </div>
      </details>
      <Msg text={msg} bad={bad} />
    </div>
  );
}

/* ---------------- Content review ---------------- */

interface PendingItem {
  id: string; // uuid
  game_id: string;
  level: string;
  source: string;
  created_at: string;
  data: { answer?: string; hint?: string; emojis?: string; category?: string; alt?: string[]; theme?: string };
}

export function ContentPanel() {
  const [data, setData] = useState<{ pending: PendingItem[]; approved: number; rejected: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState("family");
  const [theme, setTheme] = useState("");

  const load = () =>
    view<{ pending: PendingItem[]; approved: number; rejected: number }>("content")
      .then(setData)
      .catch(() => setErr("Could not load the review queue."));
  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setMsg("Asking the AI services…");
    const r = await act("content.generate", { count, level, theme });
    setMsg(r.ok ? `${madeKeptText(r)} via ${r.provider}; ${r.stored} new in the queue.` : `Not generated: ${r.error}${r.made != null ? ` · ${madeKeptText(r)}` : ""}`);
    load();
  };

  return (
    <div className="mt-6 space-y-4">
      <h2 className="font-extrabold">Content review</h2>
      <p className="text-sm">
        Generated puzzles wait here. Only approved items are served to hosts, and only when the AI services fail or are switched off.
        Approved: {data?.approved ?? "—"} · Rejected: {data?.rejected ?? "—"} · Waiting: {data?.pending.length ?? "—"}
      </p>
      <div className={`${box} flex flex-wrap items-end gap-2`}>
        <ThemePicker value={theme} onChange={setTheme} />
        <label className="text-sm">Count<select className={input} value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[3, 5, 10].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <label className="text-sm">Level<select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="kids">kids</option><option value="family">family</option><option value="adults">adults</option>
        </select></label>
        <button className={button} onClick={generate} disabled={!cleanTheme(theme)}>Generate emoji puzzles</button>
      </div>
      <Msg text={msg} />
      {err && <p className="text-sm text-[#c23a22]">{err}</p>}
      {data?.pending.map((item) => <PendingRow key={item.id} item={item} onDone={load} />)}
      {data && data.pending.length === 0 && <p className="text-sm">Nothing waiting for review.</p>}
    </div>
  );
}

function PendingRow({ item, onDone }: { item: PendingItem; onDone: () => void }) {
  const [answer, setAnswer] = useState(item.data.answer ?? "");
  const [hint, setHint] = useState(item.data.hint ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (decision: "approve" | "reject") => {
    const r = await act("content.review", { id: item.id, decision, edits: decision === "approve" ? { answer, hint } : undefined });
    if (r.ok) onDone();
    else setMsg(`Not saved: ${r.error}`);
  };
  return (
    <div className={`${box} space-y-2 text-sm`}>
      <p className="text-xs text-[#6b6258]">{item.game_id} · {item.level} · from {item.source}{item.data.theme ? ` · theme: ${item.data.theme}` : ""}</p>
      <p className="text-2xl">{item.data.emojis}</p>
      <label className="block"><span className="font-bold">Answer</span><input className={input} value={answer} onChange={(e) => setAnswer(e.target.value)} /></label>
      <label className="block"><span className="font-bold">Hint</span><input className={input} value={hint} onChange={(e) => setHint(e.target.value)} /></label>
      <div className="flex gap-2">
        <button className={button} onClick={() => decide("approve")} disabled={!answer.trim()}>Approve</button>
        <button className={danger} onClick={() => decide("reject")}>Reject</button>
      </div>
      <Msg text={msg} bad />
    </div>
  );
}

/* ---------------- Content library ---------------- */

interface NewsCounts {
  total: number;
  live: number;
  expired: number;
  bySource: Record<string, number>;
  newest: string | null;
}

interface LibraryRow {
  game_id: string;
  kind: string;
  category: string;
  lang: string;
  total: number;
  active: number;
  added7d: number;
  served: number;
  from_admin: number;
}

const LIBRARY_KINDS: { kind: string; label: string; max: number }[] = [
  { kind: "emoji-puzzle", label: "Emoji Picture puzzles", max: 50 },
  { kind: "chor-kaun-topic", label: "Chor Kaun topics", max: 5 },
  { kind: "dare", label: "Dares", max: 5 },
  { kind: "kbc-question", label: "KBC news questions", max: 10 },
];

export function LibraryPanel() {
  const [data, setData] = useState<{ total: number; active: number; servedTotal: number; viewers30d: number; rows: LibraryRow[]; news?: NewsCounts | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [kind, setKind] = useState("emoji-puzzle");
  const [count, setCount] = useState(10);
  const [level, setLevel] = useState("family");
  const [theme, setTheme] = useState("");
  const [busy, setBusy] = useState(false);
  const [listKey, setListKey] = useState(0);
  const max = LIBRARY_KINDS.find((k) => k.kind === kind)?.max ?? 5;

  const load = () =>
    view<{ total: number; active: number; servedTotal: number; viewers30d: number; rows: LibraryRow[]; news?: NewsCounts | null }>("library")
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e: Error) => setErr(e.message === "database_not_configured" ? "Database not connected." : "Could not load the library (has 0010 been run?)."));
  useEffect(() => {
    load();
  }, []);

  const generate = async () => {
    setBusy(true);
    setMsg({ text: "Asking the AI services… this can take up to a minute.", bad: false });
    const r = await act("library.generate", { kind, count: Math.min(count, max), level, audience: "family", theme });
    setBusy(false);
    setMsg(
      r.ok
        ? { text: `${madeKeptText(r)}. ${r.stored} new in the library, ${r.duplicates} already there. Rejected items were not saved.${newsSourcesText(r)}`, bad: false }
        : { text: `Not generated: ${r.error}${r.made != null ? ` · ${madeKeptText(r)}` : ""}${newsSourcesText(r)}`, bad: true },
    );
    load();
    setListKey((k) => k + 1);
  };

  return (
    <div className="mt-6 space-y-4">
      <h2 className="font-extrabold">Content library</h2>
      <p className="text-sm">
        Everything the AI makes is kept here and served again to other hosts. A host isn&apos;t shown the same item again for 30 days.
        The AI is asked only when the library has nothing new for that host.
      </p>
      <p className="text-sm">
        Items: {data?.total ?? "—"} · Switched on: {data?.active ?? "—"} · Times served: {data?.servedTotal ?? "—"} · Hosts served (30 days): {data?.viewers30d ?? "—"}
      </p>
      {data?.news && (
        <p className="text-sm">
          KBC news questions: {data.news.live} being served · {data.news.expired} expired (older than about 60 days, no longer served) · by source:{" "}
          {Object.entries(data.news.bySource).map(([k, v]) => `${k} ${v}`).join(", ") || "none yet"}
        </p>
      )}
      {err && <p className="text-sm text-[#c23a22]">{err}</p>}
      {data && (
        <table className="w-full text-left text-sm">
          <thead>
            <tr><th>Game</th><th>Kind</th><th>Category</th><th>Items</th><th>On</th><th>Added (7 days)</th><th>Served</th><th>From admin</th></tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={`${r.game_id}-${r.kind}-${r.category}-${r.lang}`} className="border-t border-[#1e1a17]/20">
                <td>{r.game_id}</td><td>{r.kind}</td><td>{r.category}</td>
                <td className="tabular-nums">{r.total}</td><td className="tabular-nums">{r.active}</td><td className="tabular-nums">{r.added7d}</td>
                <td className="tabular-nums">{r.served}</td><td className="tabular-nums">{r.from_admin}</td>
              </tr>
            ))}
            {data.rows.length === 0 && <tr><td colSpan={8}>The library is empty. It fills up as hosts play, or use Generate more.</td></tr>}
          </tbody>
        </table>
      )}
      <div className={`${box} flex flex-wrap items-end gap-2`}>
        <ThemePicker value={theme} onChange={setTheme} />
        <label className="text-sm">Game<select className={input} value={kind} onChange={(e) => setKind(e.target.value)}>
          {LIBRARY_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select></label>
        <label className="text-sm">How many (max {max})<input className={input} type="number" min={1} max={max} value={Math.min(count, max)}
          onChange={(e) => setCount(Math.max(1, Math.min(max, Math.round(Number(e.target.value) || 1))))} /></label>
        {kind === "emoji-puzzle" && (
          <label className="text-sm">Level<select className={input} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="kids">kids</option><option value="family">family</option><option value="adults">adults</option>
          </select></label>
        )}
        <button className={button} onClick={generate} disabled={busy || !cleanTheme(theme)}>Generate more</button>
        <a className={button} href={`${base()}/api/data?view=library_csv`} download>Download CSV</a>
      </div>
      {msg && <Msg text={msg.text} bad={msg.bad} />}
      <TopupBox onRan={() => {
        load();
        setListKey((k) => k + 1);
      }} />
      <LibraryItems key={`${kind}-${listKey}`} kind={kind} onChanged={load} />
    </div>
  );
}

interface TopupInfo {
  ranAt: string;
  ok: boolean;
  detail: { trigger?: string; done?: boolean; made?: number; kept?: number; rejected?: number; stored?: number; skipped?: string;
    emoji?: { movies?: number; kept?: number }; chor?: { movie?: number; ai?: number }; dare?: { kept?: number };
    news?: { kept?: number; fetched?: number; sources?: Record<string, { ok: boolean; error?: string }> } };
}

function topupText(t: TopupInfo | null): string {
  if (!t) return "No top-up has run yet.";
  const d = t.detail;
  const when = new Date(t.ranAt).toLocaleString();
  if (d.skipped) return `Last top-up ${when} (${d.trigger ?? "?"}): skipped, ${d.skipped}.`;
  return `Last top-up ${when} (${d.trigger === "admin" ? "button" : "weekly"}): made ${d.made ?? 0} · kept ${d.kept ?? 0} · rejected ${d.rejected ?? 0} · ${d.stored ?? 0} new in the library ` +
    `(emoji ${d.emoji?.kept ?? 0} from ${d.emoji?.movies ?? 0} movies, Chor Kaun ${d.chor?.movie ?? 0} movie + ${d.chor?.ai ?? 0} AI, dares ${d.dare?.kept ?? 0}, KBC news ${d.news?.kept ?? 0} from ${d.news?.fetched ?? 0} headlines${
      d.news?.sources ? Object.entries(d.news.sources).filter(([, v]) => !v.ok).map(([k, v]) => `; ${k} unavailable (${v.error ?? "error"})`).join("") : ""})${d.done ? "" : " · not finished: tries again tonight"}.`;
}

/** Weekly automatic top-up: last run, and a button to run it now. */
function TopupBox({ onRan }: { onRan: () => void }) {
  const [t, setT] = useState<TopupInfo | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const load = () => view<{ lastTopup: TopupInfo | null }>("health").then((h) => setT(h.lastTopup ?? null)).catch(() => setT(null));
  useEffect(() => {
    load();
  }, []);
  const run = async () => {
    setBusy(true);
    setMsg({ text: "Topping up… this takes up to a minute.", bad: false });
    const r = await act("library.topup");
    setBusy(false);
    const res = r.result as { ok?: boolean; skipped?: string } | undefined;
    setMsg(r.ok && res?.ok ? { text: "Top-up finished.", bad: false } : { text: `Top-up did not run: ${res?.skipped ?? r.error ?? "failed"}`, bad: true });
    load();
    onRan();
  };
  return (
    <div className={`${box} space-y-2 text-sm`}>
      <p className="font-bold">Weekly top-up</p>
      <p>Once a week, after the nightly clean-up, the library adds about 40 popular Indian movie puzzles (titles from TMDB, emoji from the AI), a few Chor Kaun topics (about a third movie titles), a couple of dares and about 10 KBC news questions (from NewsAPI and the Bharat News API, checked against the story, served for about 60 days). Only items that pass the checks are saved.</p>
      <p>{t === undefined ? "Loading…" : topupText(t)}</p>
      <button className={button} onClick={run} disabled={busy}>Run top-up now</button>
      {msg && <Msg text={msg.text} bad={msg.bad} />}
    </div>
  );
}

interface LibraryEntry {
  id: number;
  category: string;
  theme?: string | null;
  text_key: string;
  source: string;
  active: boolean;
  served_count: number;
  created_at: string;
  expires_at?: string | null;
  data: { emojis?: string; answer?: string; hint?: string; label?: string; words?: string[]; text?: string;
    q?: string; a?: string; w?: string[]; news?: { source?: string; headline?: string; date?: string; url?: string; outlet?: string } };
}

/** Newest items of one game, with a switch to stop serving any one of them. */
function LibraryItems({ kind, onChanged }: { kind: string; onChanged: () => void }) {
  const [page, setPage] = useState(0);
  const [d, setD] = useState<{ total: number; pageSize: number; items: LibraryEntry[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = () =>
    view<{ total: number; pageSize: number; items: LibraryEntry[] }>("library_items", `&kind=${encodeURIComponent(kind)}&page=${page}`)
      .then((r) => {
        setD(r);
        setErr(null);
      })
      .catch(() => setErr("Could not load the items."));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, page]);
  const toggle = async (item: LibraryEntry) => {
    const r = await act("library.set_active", { id: item.id, active: !item.active });
    if (!r.ok) setErr(`Not changed: ${r.error}`);
    load();
    onChanged();
  };
  const label = LIBRARY_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  return (
    <div className="space-y-2">
      <h3 className="font-bold">{label}: newest first ({d?.total ?? "—"})</h3>
      <p className="text-xs text-[#6b6258]">Deactivated items stay in the library and the CSV but are never served. You can switch them back on.</p>
      {err && <p className="text-sm text-[#c23a22]">{err}</p>}
      {d?.items.map((item) => (
        <div key={item.id} className={`${box} flex items-start justify-between gap-3 text-sm ${item.active ? "" : "opacity-60"}`}>
          <div className="min-w-0 space-y-1">
            {kind === "emoji-puzzle" && (
              <p><span className="text-2xl">{item.data.emojis}</span> <b>{item.data.answer}</b>{item.data.hint ? ` · ${item.data.hint}` : ""}</p>
            )}
            {kind === "chor-kaun-topic" && (
              <p><b>{item.data.label}</b>: {(item.data.words ?? []).join(", ")}</p>
            )}
            {kind === "dare" && <p>{item.data.text}</p>}
            {kind === "kbc-question" && (
              <>
                <p><b>{item.data.q}</b></p>
                <p>✓ {item.data.a} · ✗ {(item.data.w ?? []).join(" · ")}</p>
                <p className="text-xs">
                  From {item.data.news?.source === "bharat" ? "Bharat News API" : item.data.news?.outlet ?? "NewsAPI"}, {item.data.news?.date}:{" "}
                  {item.data.news?.url ? <a className="underline" href={item.data.news.url} target="_blank" rel="noopener noreferrer">{item.data.news?.headline}</a> : item.data.news?.headline}
                  {item.expires_at ? ` · served until ${new Date(item.expires_at).toLocaleDateString()}` : ""}
                </p>
              </>
            )}
            <p className="text-xs text-[#6b6258]">
              #{item.id} · {item.category}{item.theme ? ` · theme: ${item.theme}` : ""} · {item.source} · served {item.served_count}× · {new Date(item.created_at).toLocaleDateString()}{item.active ? "" : " · off"}
            </p>
          </div>
          <button className={item.active ? danger : button} onClick={() => toggle(item)}>{item.active ? "Deactivate" : "Reactivate"}</button>
        </div>
      ))}
      {d && d.items.length === 0 && <p className="text-sm">No items yet for this game.</p>}
      {d && d.total > d.pageSize && (
        <div className="flex gap-2">
          <button className={button} disabled={page === 0} onClick={() => setPage(page - 1)}>Newer</button>
          <button className={button} disabled={(page + 1) * d.pageSize >= d.total} onClick={() => setPage(page + 1)}>Older</button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Kill switches ---------------- */

export function FlagsPanel() {
  const [flags, setFlags] = useState<{ key: string; enabled: boolean; note: string | null }[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = () => view<{ key: string; enabled: boolean; note: string | null }[]>("flags").then(setFlags).catch(() => setMsg("Could not load switches."));
  useEffect(() => {
    load();
  }, []);
  const toggle = async (key: string, enabled: boolean) => {
    const r = await act("flag.set", { key, enabled, note: enabled ? "" : "switched off from the admin panel" });
    setMsg(r.ok ? `${key} is now ${enabled ? "on" : "off"}. It can take up to 30 seconds to apply.` : `Not changed: ${r.error}`);
    load();
  };
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Switches</h2>
      <p className="text-sm">Switching a game off hides it from hosts. Switching a provider off stops calls to it. Switching &quot;suggest&quot; off stops all AI calls and the content library; approved and built-in content still works. Switching &quot;library&quot; off stops serving and saving library items (the AI is asked every time).</p>
      <Msg text={msg} />
      <ul className="space-y-2">
        {flags?.map((f) => (
          <li key={f.key} className={`${box} flex items-center justify-between gap-3 text-sm`}>
            <span className="font-mono">{f.key}</span>
            <button className={f.enabled ? button : danger} onClick={() => toggle(f.key, !f.enabled)}>{f.enabled ? "On · switch off" : "Off · switch on"}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Funnel, quota, health, room, audit ---------------- */

export function FunnelPanel() {
  const [d, setD] = useState<{ signedUp: number; createdRoom: number; cameBack7d: number; cohorts: { week: string; signups: number; hosted: number; cameBack: number }[] } | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    view<typeof d>("funnel").then(setD).catch(() => setErr(true));
  }, []);
  if (err) return <p className="text-sm text-[#c23a22]">Could not load the funnel.</p>;
  if (!d) return <p className="text-sm">Loading…</p>;
  const pct = (n: number) => (d.signedUp ? `${Math.round((n / d.signedUp) * 100)}%` : "—");
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Funnel</h2>
      <ol className="space-y-1 text-sm">
        <li>Signed up: <b>{d.signedUp}</b></li>
        <li>Created a room: <b>{d.createdRoom}</b> ({pct(d.createdRoom)})</li>
        <li>Came back more than 7 days after signing up (latest sign-in): <b>{d.cameBack7d}</b> ({pct(d.cameBack7d)})</li>
      </ol>
      <p className="text-xs text-[#6b6258]">Games started are not linked to accounts, so the funnel stops at room creation. Weeks are UTC.</p>
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b-2 border-[#1e1a17]"><th className="py-1">Week of</th><th>Signups</th><th>Hosted</th><th>Came back</th></tr></thead>
        <tbody>
          {d.cohorts.map((c) => (
            <tr key={c.week} className="border-b border-[#1e1a17]/20"><td className="py-1">{c.week}</td><td>{c.signups}</td><td>{c.hosted}</td><td>{c.cameBack}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuotaPanel() {
  const [q, setQ] = useState<{ day: string; counts: Record<string, number>; limits: Record<string, number | null> } | null>(null);
  useEffect(() => {
    view<typeof q>("quota").then(setQ).catch(() => setQ(null));
  }, []);
  if (!q) return null;
  const names = ["gemini", "groq", "openrouter", "cloudflare"];
  return (
    <div className="mt-6 space-y-2">
      <h2 className="font-extrabold">Quota today ({q.day}, UTC)</h2>
      <p className="text-xs text-[#6b6258]">Counts successful calls made by this app. Each provider&apos;s own dashboard is the authority; set QUOTA_&lt;NAME&gt;_DAILY in Vercel to see the bar.</p>
      <ul className="space-y-2 text-sm">
        {names.map((n) => {
          const used = q.counts[n] ?? 0;
          const limit = q.limits[n];
          const share = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
          return (
            <li key={n} className={box}>
              <div className="flex justify-between"><span className="font-bold">{n}</span><span>{used}{limit ? ` / ${limit}` : " (no limit set)"}</span></div>
              {share !== null && (
                <div className="mt-1 h-3 rounded bg-[#1e1a17]/10"><div className={`h-3 rounded ${share >= 80 ? "bg-[#c23a22]" : "bg-[#f2b632]"}`} style={{ width: `${share}%` }} /></div>
              )}
              {share !== null && share >= 80 && <p className="mt-1 text-xs font-bold text-[#c23a22]">Above 80% of the daily limit.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function HealthPanel() {
  const [h, setH] = useState<{ lastPurge: { ranAt: string; ok: boolean; detail: Record<string, unknown> } | null; lastTopup?: TopupInfo | null; suggestionsLastHour: number; fallbacksLastHour: number; errorsLastHour: number } | null>(null);
  const [err, setErr] = useState(false);
  const load = () => view<typeof h>("health").then(setH).catch(() => setErr(true));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (err) return <p className="text-sm text-[#c23a22]">Could not load health.</p>;
  if (!h) return <p className="text-sm">Loading…</p>;
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Health</h2>
      <div className={`${box} text-sm`}>
        <p className="font-bold">Nightly purge</p>
        <p>{h.lastPurge ? `${new Date(h.lastPurge.ranAt).toLocaleString()} · ${h.lastPurge.ok ? "succeeded" : "failed"}` : "Has not run yet (or the cron isn't scheduled)."}</p>
        {h.lastPurge?.ok && <p className="text-xs">Removed (counts): {Object.entries(h.lastPurge.detail).map(([k, v]) => `${k} ${String(v)}`).join(", ")}</p>}
      </div>
      <div className={`${box} text-sm`}>
        <p className="font-bold">Library top-up</p>
        <p>{topupText(h.lastTopup ?? null)}</p>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className={box}><div className="text-xs">AI calls, last hour</div><div className="text-2xl font-extrabold">{h.suggestionsLastHour}</div></div>
        <div className={box}><div className="text-xs">Fallbacks, last hour</div><div className="text-2xl font-extrabold">{h.fallbacksLastHour}</div></div>
        <div className={box}><div className="text-xs">Route errors, last hour</div><div className="text-2xl font-extrabold">{h.errorsLastHour}</div></div>
      </div>
      <button className={button} onClick={load}>Refresh</button>
    </div>
  );
}

export function RoomPanel() {
  const [code, setCode] = useState("");
  const [data, setData] = useState<{ rooms: { code: string; host_email: string | null; created_at: string; closed_at: string | null }[]; note: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const look = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      setData(await view<typeof data>("room", `&code=${encodeURIComponent(code.trim().toUpperCase())}`));
    } catch {
      setData(null);
      setMsg("No room with that code in the database (rooms are removed after 7 days).");
    }
  };
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Room inspector (read-only)</h2>
      <form className="flex gap-2" onSubmit={look}>
        <input className={input} maxLength={4} placeholder="Room code" value={code} onChange={(e) => setCode(e.target.value)} />
        <button className={button}>Look up</button>
      </form>
      <Msg text={msg} bad />
      {data && (
        <div className={`${box} text-sm space-y-2`}>
          {data.rooms.map((r) => (
            <p key={r.created_at + r.code}>{r.code} · host {r.host_email ?? "unknown"} · created {new Date(r.created_at).toLocaleString()} · {r.closed_at ? `closed ${new Date(r.closed_at).toLocaleString()}` : "open"}</p>
          ))}
          <p className="text-xs text-[#6b6258]">{data.note}</p>
        </div>
      )}
    </div>
  );
}

export function AuditPanel() {
  const [rows, setRows] = useState<{ at: string; actor: string; action: string; target: string | null; details: Record<string, unknown>; ip: string | null }[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    view<typeof rows>("audit").then(setRows).catch(() => setErr(true));
  }, []);
  if (err) return <p className="text-sm text-[#c23a22]">Could not load the audit log.</p>;
  if (!rows) return <p className="text-sm">Loading…</p>;
  return (
    <div className="mt-6 space-y-3">
      <h2 className="font-extrabold">Audit log</h2>
      <p className="text-xs text-[#6b6258]">Every admin action and every read of personal data. Kept for 365 days.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b-2 border-[#1e1a17]"><th className="py-1">When</th><th>Who</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-[#1e1a17]/20 align-top">
                <td className="py-1 whitespace-nowrap">{new Date(r.at).toLocaleString()}</td>
                <td>{r.actor}</td>
                <td>{r.action}</td>
                <td className="break-all">{r.target ?? "—"}</td>
                <td className="break-all">{Object.keys(r.details ?? {}).length ? JSON.stringify(r.details) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
