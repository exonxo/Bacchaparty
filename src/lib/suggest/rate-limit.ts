/** Lightweight in-memory rate limit + response cache (per server instance). */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 12;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 80;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

type CacheEntry = { expires: number; payload: string };
const cache = new Map<string, CacheEntry>();

function pruneCache() {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expires <= now) cache.delete(k);
  }
  while (cache.size > CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
    else break;
  }
}

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

export function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  try {
    return JSON.parse(hit.payload);
  } catch {
    cache.delete(key);
    return undefined;
  }
}

export function cacheSet(key: string, value: unknown) {
  pruneCache();
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, payload: JSON.stringify(value) });
}

export function cacheKey(kind: string, context: unknown): string {
  return `${kind}:${JSON.stringify(context)}`;
}
