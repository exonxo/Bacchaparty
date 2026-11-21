import { callGemini, ProviderHttpError } from "./gemini";
import { callOpenAICompat } from "./openai-compat";
import { buildPrompt, unwrapPayload } from "./prompts";
import type { SuggestKind } from "./types";

/**
 * Tries the free LLM providers in turn. A provider that fails is skipped for a while, so a
 * rate-limited free tier doesn't slow every request. The first provider to return a payload
 * that passes `accept` wins; if none does, the caller uses its built-in content.
 *
 * Keys are read from the server environment only. Nothing here is sent to the browser.
 */

export const TOTAL_BUDGET_MS = 8_000;
const PER_CALL_MS = 6_000;
const COOL_RATE_LIMIT_MS = 60_000;
const COOL_ERROR_MS = 20_000;
const COOL_BAD_OUTPUT_MS = 10_000;

export interface Provider {
  name: string;
  configured: () => boolean;
  call: (kind: SuggestKind, prompt: string, signal: AbortSignal) => Promise<unknown | null>;
}

const env = (k: string) => process.env[k]?.trim() || undefined;

const PROVIDERS: Provider[] = [
  {
    name: "gemini",
    configured: () => !!env("GEMINI_API_KEY"),
    call: (kind, prompt, signal) => callGemini(env("GEMINI_API_KEY")!, kind, prompt, signal),
  },
  {
    name: "groq",
    configured: () => !!env("GROQ_API_KEY"),
    call: (_kind, prompt, signal) =>
      callOpenAICompat({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: env("GROQ_API_KEY")!,
        model: env("GROQ_MODEL") ?? "llama-3.3-70b-versatile",
        prompt,
        signal,
        jsonMode: true,
      }),
  },
  {
    name: "openrouter",
    configured: () => !!env("OPENROUTER_API_KEY"),
    call: (_kind, prompt, signal) =>
      callOpenAICompat({
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: env("OPENROUTER_API_KEY")!,
        model: env("OPENROUTER_MODEL") ?? "meta-llama/llama-3.3-70b-instruct:free",
        prompt,
        signal,
        jsonMode: false,
        extraHeaders: { "X-Title": "BAWAAL" },
      }),
  },
  {
    name: "cloudflare",
    configured: () => !!env("CF_ACCOUNT_ID") && !!env("CF_API_TOKEN"),
    call: (_kind, prompt, signal) =>
      callOpenAICompat({
        url: `https://api.cloudflare.com/client/v4/accounts/${env("CF_ACCOUNT_ID")}/ai/v1/chat/completions`,
        apiKey: env("CF_API_TOKEN")!,
        model: env("CF_MODEL") ?? "@cf/meta/llama-3.1-8b-instruct",
        prompt,
        signal,
        jsonMode: false,
      }),
  },
];

export interface ChainResult {
  data: unknown;
  provider: string;
  ms: number;
}

/** Builds a chain over a provider list. The app uses one instance; tests build their own with stand-ins. */
export function makeChain(providers: Provider[], now: () => number = Date.now) {
  const coolUntil = new Map<string, number>();
  let rotation = 0;

  const cool = (name: string, ms: number) => coolUntil.set(name, now() + ms);

  /** Configured providers that aren't cooling down, in the order to try them this time. */
  const order = (): Provider[] => {
    const t = now();
    const ready = providers.filter((p) => p.configured() && (coolUntil.get(p.name) ?? 0) <= t);
    if (ready.length < 2 || env("LLM_MODE") === "primary") return ready;
    // "rotate" (default): each request starts with a different provider, so every free quota gets used.
    const start = rotation++ % ready.length;
    return [...ready.slice(start), ...ready.slice(0, start)];
  };

  return {
    status: () =>
      providers.map((p) => ({ name: p.name, configured: p.configured(), coolingMs: Math.max(0, (coolUntil.get(p.name) ?? 0) - now()) })),
    /**
     * Runs the providers until one returns output that `accept` approves. `accept` returns the
     * cleaned value, or null to reject it (and move on to the next provider).
     */
    async run(kind: SuggestKind, prompt: string, accept: (raw: unknown) => unknown | null): Promise<ChainResult | null> {
      const started = now();
      const deadline = started + TOTAL_BUDGET_MS;
      for (const p of order()) {
        const left = deadline - now();
        if (left < 1_000) break;
        const t0 = now();
        try {
          const raw = await p.call(kind, prompt, AbortSignal.timeout(Math.min(PER_CALL_MS, left)));
          const data = raw == null ? null : accept(unwrapPayload(kind, raw));
          if (data != null) return { data, provider: p.name, ms: now() - t0 };
          cool(p.name, COOL_BAD_OUTPUT_MS);
        } catch (e) {
          const status = e instanceof ProviderHttpError ? e.status : 0;
          cool(p.name, status === 429 ? COOL_RATE_LIMIT_MS : COOL_ERROR_MS);
        }
      }
      return null;
    },
  };
}



const defaultChain = makeChain(PROVIDERS);
export const providerStatus = defaultChain.status;
export const runChain = defaultChain.run;
export { buildPrompt };
