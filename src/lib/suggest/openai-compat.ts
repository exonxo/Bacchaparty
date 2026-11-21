import { ProviderHttpError } from "./gemini";
import { parseModelJson } from "./prompts";

/**
 * Calls any OpenAI-compatible chat endpoint (Groq, OpenRouter, Cloudflare Workers AI).
 * Returns the parsed JSON reply, or null if the reply isn't JSON.
 */
export async function callOpenAICompat(opts: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  signal: AbortSignal;
  jsonMode: boolean;
  extraHeaders?: Record<string, string>;
}): Promise<unknown | null> {
  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: "You write short, family-friendly party game content. Reply with JSON only." },
      { role: "user", content: opts.prompt },
    ],
    temperature: 1.1,
    max_tokens: 1800,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(opts.url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}`, ...(opts.extraHeaders ?? {}) },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) throw new ProviderHttpError(res.status);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content;
  if (!text) return null;
  return parseModelJson(text);
}
