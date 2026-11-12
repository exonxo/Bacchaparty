/** Lightweight in-memory rate limit + in-flight de-duplication (per server instance). */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Identical concurrent requests on this instance share one in-flight promise. */
const inflight = new Map<string, Promise<unknown>>();

export function rateLimitKey(ip: string, roomCode: string | undefined): string {
  return roomCode ? `room:${roomCode.toUpperCase()}` : `ip:${ip}`;
}

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + RATE_WINDOW_MS };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= RATE_MAX;
}

export function inflightKey(kind: string, context: unknown): string {
  return `${kind}:${JSON.stringify(context)}`;
}

export async function runDeduped<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = run().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}
