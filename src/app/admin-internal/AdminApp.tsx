"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AccountPanel, AuditPanel, ContentPanel, FlagsPanel, FunnelPanel, HealthPanel, QuotaPanel, RoomPanel } from "./AdminPower";

/**
 * The admin panel UI. It only shows the login form until the server confirms a session.
 * API calls go to the same secret path the page was opened from (middleware rewrites them).
 */

type Tab = "overview" | "users" | "content" | "flags" | "games" | "llm" | "health" | "funnel" | "room" | "audit" | "logins";
type Session = "checking" | "out" | "in";

const base = () => (typeof window === "undefined" ? "" : window.location.pathname.replace(/\/+$/, ""));

async function api<T>(view: string, extra = ""): Promise<T> {
  const res = await fetch(`${base()}/api/data?view=${view}${extra}`, { cache: "no-store", credentials: "same-origin" });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "failed");
  return json;
}

export function AdminApp() {
  const [session, setSession] = useState<Session>("checking");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    api<{ user: string }>("me")
      .then(() => setSession("in"))
      .catch(() => setSession("out"));
  }, []);

  if (session === "checking") return <p className="p-6 text-sm text-[#6b6258]">Loading…</p>;
  if (session === "out") return <Login onDone={() => setSession("in")} />;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">BAWAAL admin</h1>
        <button
          className="rounded border-2 border-[#1e1a17] px-3 py-1 text-sm font-bold"
          onClick={async () => {
            await fetch(`${base()}/api/logout`, { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin" });
            setSession("out");
          }}
        >
          Log out
        </button>
      </header>
      <nav className="mb-4 flex flex-wrap gap-2">
        {(["overview", "users", "content", "flags", "games", "llm", "health", "funnel", "room", "audit", "logins"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded border-2 border-[#1e1a17] px-3 py-1 text-sm font-bold capitalize ${tab === t ? "bg-[#1e1a17] text-[#fbf6ee]" : ""}`}
          >
            {t === "llm" ? "LLM" : t}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview onAuthLost={() => setSession("out")} />}
      {tab === "users" && (<><Users onAuthLost={() => setSession("out")} /><AccountPanel /></>)}
      {tab === "content" && <ContentPanel />}
      {tab === "flags" && <FlagsPanel />}
      {tab === "health" && <HealthPanel />}
      {tab === "funnel" && <FunnelPanel />}
      {tab === "room" && <RoomPanel />}
      {tab === "audit" && <AuditPanel />}
      {tab === "games" && <Games onAuthLost={() => setSession("out")} />}
      {tab === "llm" && (<><Llm onAuthLost={() => setSession("out")} /><QuotaPanel /></>)}
      {tab === "logins" && <Logins onAuthLost={() => setSession("out")} />}
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${base()}/api/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ username, password, totp }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (res.ok && json.ok) {
        setPassword("");
        setTotp("");
        onDone();
      } else {
        setMsg(json.message ?? "Login failed.");
      }
    } catch {
      setMsg("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded border-2 border-[#1e1a17] bg-white px-3 py-2";
  return (
    <form onSubmit={submit} className="mx-auto mt-16 flex max-w-sm flex-col gap-3 p-4" autoComplete="off">
      <h1 className="text-xl font-extrabold">Admin login</h1>
      <input className={input} placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      <input className={input} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      <input className={input} inputMode="numeric" pattern="[0-9]{6}" placeholder="6-digit code" value={totp} onChange={(e) => setTotp(e.target.value)} autoComplete="one-time-code" required />
      <button disabled={busy} className="rounded border-2 border-[#1e1a17] bg-[#f2b632] px-3 py-2 font-extrabold disabled:opacity-50">
        {busy ? "Checking…" : "Log in"}
      </button>
      {msg && <p role="alert" className="text-sm font-bold text-[#c23a22]">{msg}</p>}
    </form>
  );
}

/** Loads a view; if the session has expired, sends the page back to the login form. */
function useView<T>(view: string, extra: string, onAuthLost: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    api<T>(view, extra)
      .then(setData)
      .catch((e: Error) => {
        if (e.message === "unauthorized") onAuthLost();
        else setError(e.message === "database_not_configured" ? "Database not connected for the admin panel. Check the server settings." : "Could not load this view.");
      });
  }, [view, extra, onAuthLost]);
  useEffect(() => load(), [load]);
  return { data, error, reload: load };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border-2 border-[#1e1a17] bg-white p-3">
      <div className="text-xs font-bold uppercase text-[#6b6258]">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function Overview({ onAuthLost }: { onAuthLost: () => void }) {
  const { data, error } = useView<Record<string, unknown>>("overview", "", onAuthLost);
  if (error) return <p className="text-sm text-[#c23a22]">{error}</p>;
  if (!data) return <p className="text-sm">Loading…</p>;
  const providers = (data.providers ?? {}) as Record<string, number>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Stat label="Users" value={String(data.users_total ?? 0)} />
      <Stat label="Signups, 7 days" value={String(data.users_7d ?? 0)} />
      <Stat label="Signups, 30 days" value={String(data.users_30d ?? 0)} />
      <Stat label="Accounts signed in, 7 days" value={String(data.last_signin_7d ?? 0)} />
      <Stat label="Rooms (all time)" value={String(data.rooms_total ?? 0)} />
      <Stat label="Rooms, 7 days" value={String(data.rooms_7d ?? 0)} />
      <Stat label="Hosts (made a room)" value={String(data.hosts_total ?? 0)} />
      <Stat label="Sign-in methods" value={Object.entries(providers).map(([k, v]) => `${k} ${v}`).join(", ") || "—"} />
    </div>
  );
}

function Users({ onAuthLost }: { onAuthLost: () => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [applied, setApplied] = useState("");
  const extra = `&q=${encodeURIComponent(applied)}&page=${page}`;
  const { data, error } = useView<{ email: string; provider: string; signed_up: string; last_sign_in: string | null; rooms_hosted: number }[]>("users", extra, onAuthLost);
  return (
    <div>
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setApplied(search.trim());
        }}
      >
        <input className="flex-1 rounded border-2 border-[#1e1a17] bg-white px-3 py-2" placeholder="Search email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="rounded border-2 border-[#1e1a17] px-3 font-bold">Search</button>
      </form>
      {error && <p className="text-sm text-[#c23a22]">{error}</p>}
      {!data && !error && <p className="text-sm">Loading…</p>}
      {data && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[#1e1a17]">
                <th className="py-2">Email</th>
                <th>Sign-in</th>
                <th>Signed up</th>
                <th>Last login</th>
                <th>Rooms</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.email + u.signed_up} className="border-b border-[#1e1a17]/20">
                  <td className="py-2 pr-2 break-all">{u.email}</td>
                  <td>{u.provider}</td>
                  <td>{new Date(u.signed_up).toLocaleDateString()}</td>
                  <td>{u.last_sign_in ? new Date(u.last_sign_in).toLocaleDateString() : "—"}</td>
                  <td>{u.rooms_hosted}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center">No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-2">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded border-2 border-[#1e1a17] px-3 disabled:opacity-40">
              Previous
            </button>
            <span className="text-sm">Page {page + 1}</span>
            <button disabled={data.length < 50} onClick={() => setPage((p) => p + 1)} className="rounded border-2 border-[#1e1a17] px-3 disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Games({ onAuthLost }: { onAuthLost: () => void }) {
  const { data, error } = useView<{ totalSample: number; byGame: Record<string, { d7: number; d30: number }>; byDay: Record<string, number> }>("games", "", onAuthLost);
  if (error) return <p className="text-sm text-[#c23a22]">{error}</p>;
  if (!data) return <p className="text-sm">Loading…</p>;
  const rows = Object.entries(data.byGame).sort((a, b) => b[1].d30 - a[1].d30);
  const days = Object.entries(data.byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14);
  const max = Math.max(1, ...days.map(([, n]) => n));
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h2 className="mb-2 font-extrabold">Games started</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-[#1e1a17]">
              <th className="py-2">Game</th>
              <th>7 days</th>
              <th>30 days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([g, v]) => (
              <tr key={g} className="border-b border-[#1e1a17]/20">
                <td className="py-1">{g}</td>
                <td>{v.d7}</td>
                <td>{v.d30}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3">No games started in the last 30 days.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div>
        <h2 className="mb-2 font-extrabold">Last 14 days (UTC dates)</h2>
        <ul className="space-y-1 text-sm">
          {days.map(([d, n]) => (
            <li key={d} className="flex items-center gap-2">
              <span className="w-24 tabular-nums">{d}</span>
              <span className="h-3 bg-[#f2b632]" style={{ width: `${(n / max) * 70}%` }} />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Llm({ onAuthLost }: { onAuthLost: () => void }) {
  const { data, error } = useView<{
    total: number;
    fallbackRate: number;
    providers: Record<string, { count: number; fallback: number; avgMs: number }>;
    live: { name: string; configured: boolean; coolingMs: number }[];
  }>("llm", "", onAuthLost);
  if (error) return <p className="text-sm text-[#c23a22]">{error}</p>;
  if (!data) return <p className="text-sm">Loading…</p>;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Suggestions, 7 days" value={data.total} />
        <Stat label="Built-in fallback" value={`${data.fallbackRate}%`} />
        <Stat label="Providers used" value={Object.keys(data.providers).length} />
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b-2 border-[#1e1a17]">
            <th className="py-2">Provider</th>
            <th>Served</th>
            <th>Fallback</th>
            <th>Avg ms</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.providers).map(([name, v]) => (
            <tr key={name} className="border-b border-[#1e1a17]/20">
              <td className="py-1">{name}</td>
              <td>{v.count}</td>
              <td>{v.fallback}</td>
              <td>{v.avgMs}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h2 className="mb-2 font-extrabold">Providers on this server instance</h2>
        <ul className="space-y-1 text-sm">
          {data.live.map((p) => (
            <li key={p.name}>
              {p.name}: {p.configured ? (p.coolingMs > 0 ? `cooling for ${Math.ceil(p.coolingMs / 1000)} s` : "ready") : "no key set"}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Logins({ onAuthLost }: { onAuthLost: () => void }) {
  const { data, error } = useView<{ created_at: string; ip: string; ok: boolean; reason: string }[]>("logins", "", onAuthLost);
  if (error) return <p className="text-sm text-[#c23a22]">{error}</p>;
  if (!data) return <p className="text-sm">Loading…</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b-2 border-[#1e1a17]">
          <th className="py-2">When</th>
          <th>IP</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>
        {data.map((r, i) => (
          <tr key={i} className="border-b border-[#1e1a17]/20">
            <td className="py-1">{new Date(r.created_at).toLocaleString()}</td>
            <td className="break-all">{r.ip}</td>
            <td>{r.ok ? "ok" : `failed (${r.reason})`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
