import type { Level } from "@/lib/types";

/** Word-boundary patterns — avoids false positives like "Essex" for "sex". */
const SEXUAL = /\b(?:sex|sexual|nude|naked|porn|porno|explicit|erotic|orgasm|fetish|hentai|xxx|molest|rape|grope)\b/i;
const ALCOHOL = /\b(?:alcohol|alcoholic|beer|wine|vodka|whiskey|whisky|rum|gin|tequila|brandy|champagne|intoxicated|hangover|chug(?:ging)?|drunk(?:en)?|booze|liver\s*damage)\b/i;
const DRUGS = /\b(?:cocaine|heroin|meth|marijuana|cannabis|opioid|narcotic|overdose|stoned|joint|bong|snort(?:ing)?)\b/i;
const DRUGS_LOOSE = /\b(?:drug|drugs|weed|high)\b/i;
const SECRETS_MONEY = /\b(?:pin\s*code|password|passcode|otp|one[- ]time|credit\s*card|debit\s*card|bank\s*account|account\s*number|ifsc|upi\s*pin|cvv|ssn)\b/i;
const HARM_VIOLENCE = /\b(?:suicide|self[- ]harm|kill\s+yourself|murder|stab(?:bing)?|shoot(?:ing)?|gun\s*to)\b/i;
const PIN_KISS_NEIGHBOR =
  /\b(?:share\s+your\s+pin|tell\s+(?:us\s+)?your\s+password|kiss(?:\s+a)?\s+neighbor|kiss\s+the\s+person\s+next)\b/i;

export type SafetyContext = {
  level?: Level;
  audience?: "family" | "mixed";
};

/**
 * Returns true when text should be dropped from AI suggestions.
 * Adult-themed wording is allowed only when level is `adults` (emoji) or audience is `mixed`.
 */
export function isUnsafeSuggestText(text: string, ctx: SafetyContext = {}): boolean {
  const t = text.trim();
  if (!t) return true;
  const allowMature = ctx.level === "adults" || ctx.audience === "mixed";

  if (SEXUAL.test(t)) return true;
  if (!allowMature && (ALCOHOL.test(t) || DRUGS.test(t) || DRUGS_LOOSE.test(t))) return true;
  if (SECRETS_MONEY.test(t)) return true;
  if (HARM_VIOLENCE.test(t)) return true;
  if (PIN_KISS_NEIGHBOR.test(t)) return true;
  return false;
}
