export function shuffle<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomId(len = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Room codes avoid look-alike letters (no I, O, 0, 1). */
export function makeRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Lower-case, strip accents/punctuation/extra spaces, for answer matching. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ऀ-ॿ ]/g, " ")
    .replace(/\b(the|a|an)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** Forgiving match: ignores case/punctuation and allows small typos. */
export function answerMatches(guess: string, answers: readonly string[]): boolean {
  const g = normalize(guess);
  if (!g) return false;
  return answers.some((ans) => {
    const a = normalize(ans);
    if (!a) return false;
    if (g === a) return true;
    const allowed = a.length <= 4 ? 0 : a.length <= 8 ? 1 : 2;
    return levenshtein(g, a) <= allowed;
  });
}

export const AVATARS = ["🦁", "🐯", "🐘", "🦚", "🐒", "🐄", "🐍", "🦜", "🐢", "🐻", "🐼", "🐸", "🐙", "🦄", "🐨", "🐧", "🦊", "🐝"];
