/** In-memory closed-room codes when Supabase is not configured (local demo). */

const store = () => {
  const g = globalThis as typeof globalThis & { __bacchaDemoClosed?: Set<string> };
  return (g.__bacchaDemoClosed ??= new Set<string>());
};

export function markDemoPartyClosed(code: string) {
  store().add(code.toUpperCase());
}

export function isDemoPartyClosed(code: string) {
  return store().has(code.toUpperCase());
}
