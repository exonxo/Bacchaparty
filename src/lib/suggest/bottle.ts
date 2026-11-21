import { BOTTLE_PROMPTS, TONE_INFO, type BottlePrompt, type BottleTone } from "@/content/spin-bottle";
import { randomId, shuffle } from "@/lib/util";
import { isUnsafeSuggestText } from "./safety";

/**
 * Spin the Bottle: the AI prompt, the rule checks every AI prompt must pass, and the built-in
 * fallback. The checks run in code on the server and again on the host's device, so a model
 * that ignores its instructions still can't put a banned prompt on the TV.
 */

export interface BottleBatch {
  truths: string[];
  dares: string[];
  social: string[];
}

/* ---------- rules, enforced in code ---------- */

/** Banned in every tone, adults included. */
const ALWAYS: RegExp[] = [
  // Touching or targeting another person physically.
  /\b(?:kiss|kisses|kissing|lick|hug|hugs|cuddle|touch|touches|tickle|slap|spank|massage|sit\s+on|lap)\b/i,
  // Sexual or body talk.
  /\b(?:strip|undress|underwear|bra|naked|nude|shirtless|sexy|hot(?:test)?\s+person|flirt|seduc\w*|make\s*out|hook\s*up|body\s*count|virgin|boob\w*|butt|chest)\b/i,
  /\b(?:fat|weight|skinny|ugly|ugliest|bald|short(?:est)?\s+person|dark(?:est)?\s+skin|fair(?:est)?\s+skin|looks\s+like|attractive|body)\b/i,
  // Identity and politics.
  /\b(?:caste|religion|religious|hindu|muslim|christian|sikh|jain|god|temple|mosque|church|politic\w*|modi|bjp|congress|election|vote\s+for|accent\s+of)\b/i,
  // Drinking, smoking, substances (even for adults: the game can't tell who's sober or underage).
  /\b(?:shot|shots|drink|drinks|drinking|sip|alcohol|beer|wine|vodka|whisk(?:e)?y|rum|daru|peg|smoke|smoking|cigarette|vape|hookah|weed|drunk|tipsy)\b/i,
  // Physical danger and leaving the room.
  /\b(?:outside|balcony|roof|terrace|street|neighbou?r|climb|jump\s+off|fire|lighter|candle|knife|ice\s+cube|hot\s+sauce|chilli|mirchi|eat\s+(?:a\s+)?(?:raw|spoon)|hold\s+your\s+breath|blindfold\w*)\b/i,
  // Money and private data.
  /\b(?:salary|salaries|pay\s*slip|ctc|hike|increment|bank|password|pin|otp|upi|loan|debt|net\s*worth)\b/i,
  // Exes, crushes on people in the room, secrets about others.
  /\b(?:ex|exes|ex-\w+|crush\s+(?:on|in)\s+(?:someone|anyone)\s+(?:here|in\s+this\s+room))\b/i,
  /\b(?:their|his|her)\s+(?:secret|phone|crush)\b/i,
  /\b\w+['’]s\s+(?:secrets?|crush|phone|chats?|messages?|search\s+history)\b/i,
  /\bsecret\s+about\s+(?:someone|anyone|a\s+person)\b/i,
  // Contacting a specific outside person.
  /\b(?:call|text|message|dm|ping|voice\s*note)\s+(?:your\s+)?(?:mom|mum|mother|dad|father|parents?|boss|manager|crush|ex|teacher|hr|landlord)\b/i,
];

/** Asking someone to post or send something: allowed only on social dares in the adult tones.
 *  Talking about a reel or a group chat is fine; doing something on one is not. */
const SOCIAL_ACTION: RegExp[] = [
  /\b(?:post|posts|posting|upload\w*|share|send|set|change|update|put)\b[^.?!]{0,60}\b(?:story|stories|reel|instagram|insta|linkedin|twitter|tweet|facebook|snapchat|status|bio|profile|group\s*chat|whatsapp|dp)\b/i,
  /\bpost\s+(?:it|this|a|an|on|that)\b/i,
  /\bgo\s+live\b/i,
];
/** Social dares must never show other people or the company. */
const SOCIAL_EXTRA = /\b(?:tag|mention|selfie\s+with|photo\s+of\s+(?:someone|everyone|the\s+group)|company\s+name|@)\b/i;

const KIDS_FAMILY: RegExp[] = [
  /\b(?:crush|date|dating|boyfriend|girlfriend|romantic|romance|love\s+life|married\s+to|propose|flirt\w*)\b/i,
  /\b(?:search\s+history|screen\s*time|last\s+(?:sent\s+)?text|gallery|screenshot)\b/i,
];
const KIDS_ONLY: RegExp[] = [/\b(?:secret|embarrass\w*|scold\w*|lie|lied|cried|scary|scariest)\b/i];

const OFFICE: RegExp[] = [
  /\b(?:crush|dating\s+(?:someone|a\s+colleague)|office\s+romance|attracted|would\s+you\s+date|marry|boyfriend|girlfriend)\b/i,
  /\b(?:appraisal\s+rating|rating\s+of|performance\s+review\s+of|job\s+hunt\w*|interviewing|resume|cv|notice\s+period|resign(?:ing)?\s+soon|layoff\w*|fired)\b/i,
];

function rulesFor(tone: BottleTone): RegExp[] {
  if (tone === "kids") return [...ALWAYS, ...KIDS_FAMILY, ...KIDS_ONLY];
  if (tone === "family") return [...ALWAYS, ...KIDS_FAMILY];
  if (tone === "office") return [...ALWAYS, ...OFFICE];
  return ALWAYS;
}

/** True when this prompt text breaks a rule for the tone. `social` marks a posting dare. */
export function breaksBottleRules(text: string, tone: BottleTone, social = false): boolean {
  const t = text.trim();
  if (t.length < 12 || t.length > 220) return true;
  // A real player name would only come from the model; prompts use {player} or "you".
  if (/[<>]|https?:|www\./i.test(t)) return true;
  if (isUnsafeSuggestText(t, { level: TONE_INFO[tone].adult ? "adults" : tone === "kids" ? "kids" : "family" })) return true;
  if (rulesFor(tone).some((r) => r.test(t))) return true;
  if (social) {
    if (!TONE_INFO[tone].adult) return true;
    if (SOCIAL_EXTRA.test(t)) return true;
  } else if (SOCIAL_ACTION.some((r) => r.test(t))) {
    // Posting only ever comes through the rare social slot, never as a normal dare.
    return true;
  }
  return false;
}

/* ---------- validation of an AI batch ---------- */

function cleanList(raw: unknown, tone: BottleTone, social: boolean, max: number, seen: Set<string>): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const text = String(typeof item === "object" && item && "text" in item ? (item as { text: unknown }).text : item)
      .replace(/\s+/g, " ")
      .trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key) || breaksBottleRules(text, tone, social)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/** Keeps only the prompts that pass the rules. Null when too few survive to be worth using. */
export function validateBottleBatch(raw: unknown, tone: BottleTone): BottleBatch | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const truths = cleanList(o.truths, tone, false, 15, seen);
  const dares = cleanList(o.dares, tone, false, 15, seen);
  const social = TONE_INFO[tone].adult ? cleanList(o.social, tone, true, 3, seen) : [];
  if (truths.length + dares.length < 6) return null;
  return { truths, dares, social };
}

/** Removes prompts this device has already seen. */
export function freshBottleBatch(batch: BottleBatch, avoid: string[]): BottleBatch | null {
  if (!avoid.length) return batch;
  const seen = new Set(avoid.map((a) => a.toLowerCase()));
  const keep = (l: string[]) => l.filter((t) => !seen.has(t.toLowerCase().slice(0, 60)));
  const out = { truths: keep(batch.truths), dares: keep(batch.dares), social: keep(batch.social) };
  return out.truths.length + out.dares.length >= 6 ? out : null;
}

export function bottleKeys(batch: BottleBatch): string[] {
  return [...batch.truths, ...batch.dares, ...batch.social].map((t) => t.toLowerCase().slice(0, 60));
}

/** A batch from the built-in deck, used when every AI service fails. */
export function fallbackBottleBatch(tone: BottleTone): BottleBatch {
  const deck = BOTTLE_PROMPTS[tone];
  const pick = (f: (p: BottlePrompt) => boolean, n: number) => shuffle(deck.filter(f)).slice(0, n).map((p) => p.text);
  return {
    truths: pick((p) => p.kind === "truth", 12),
    dares: pick((p) => p.kind === "dare" && !p.social, 12),
    social: pick((p) => !!p.social, 2),
  };
}

/** Turns a batch into prompts the game can queue. */
export function batchToPrompts(batch: BottleBatch): BottlePrompt[] {
  return [
    ...batch.truths.map((text) => ({ id: `ai-${randomId(8)}`, kind: "truth" as const, text })),
    ...batch.dares.map((text) => ({ id: `ai-${randomId(8)}`, kind: "dare" as const, text })),
    ...batch.social.map((text) => ({ id: `ai-${randomId(8)}`, kind: "dare" as const, text, social: true })),
  ];
}

/* ---------- the AI prompt ---------- */

const TONE_BRIEF: Record<BottleTone, string> = {
  kids:
    "Audience: children aged 6-12 with their parents. Truths are light and imaginative (favourite things, what-ifs). Dares are silly and physical-only-for-yourself: animal noises, funny walks, accents, tiny dances. No secrets, no embarrassment, no crushes, nothing scary, no phones.",
  family:
    "Audience: an Indian family gathering, grandparents to teenagers. Cheeky, warm, a little teasing about yourself: relatives' WhatsApp forwards, wedding functions, TV serials, chai, aunties, Bollywood. No romance or dating, no phones, nothing that would embarrass someone in front of their parents.",
  college:
    "Audience: Indian college friends, 18-25. It must be genuinely funny, not lame: specific, self-roasting, chaotic. Hostel life, 2 AM Zomato, bunking, assignments, group chats, situationships about yourself, Bollywood, cricket. Phone dares are allowed on the player's OWN phone with a veto (screenshots, last text, wallpaper). Truths can be about your own dating stories. Never about another player's secrets, never mean, never about bodies or looks.",
  office:
    "Audience: Indian corporate colleagues of the SAME level, at a party outside the office (no managers present). Genuinely funny corporate satire: meetings, 'you're on mute', Jira, appraisals as a process, pantry, buzzwords, LinkedIn culture, Monday calls. Roasting the boss, the company, clients and processes is fine. Group picks are fine if playful or flattering ('who here would survive longest without coffee?'). Your own dating stories are fine. NEVER: dating or crushes involving colleagues, salary or rating numbers, job hunting or resigning plans, negative remarks about a named colleague.",
};

const RULES = [
  "Every prompt is only about the person who was picked. Use 'you'. Never use real names; never ask them to reveal someone else's secret.",
  "Never: touching or kissing anyone, sexual content, bodies/weight/looks, caste/religion/politics/region, alcohol/smoking/drugs, money/salary/passwords, exes, leaving the room, fire/heat/water/heights, eating non-food, contacting a specific outside person (ex, boss, parent, crush).",
  "Normal truths and dares must not involve posting on social media.",
  "Keep each prompt under 160 characters, in simple English with a little Hinglish flavour where natural.",
  "Specific beats generic: 'What's your most unhinged 2 AM Zomato order?' beats 'What's your favourite food?'.",
];

export function buildBottlePrompt(tone: BottleTone, avoid: string[]): string {
  const deck = BOTTLE_PROMPTS[tone];
  const examples = shuffle(deck.filter((p) => !p.social)).slice(0, 10).map((p) => `- (${p.kind}) ${p.text}`);
  const socialExamples = deck.filter((p) => p.social).slice(0, 3).map((p) => `- ${p.text}`);
  const adult = TONE_INFO[tone].adult;
  const parts = [
    "You write prompts for Spin the Bottle (truth or dare) in BAWAAL, an Indian party game app.",
    TONE_BRIEF[tone],
    ...RULES,
    "Match the style and humour of these examples, but write NEW ones (do not copy them):",
    ...examples,
  ];
  if (adult) {
    parts.push(
      "Also write 2 rare 'social' dares: the player posts something harmless about THEMSELVES on their own account, for a limited time, with no other people, no tags, and no company name. Examples:",
      ...socialExamples,
    );
  }
  if (avoid.length) parts.push(`Do NOT repeat or closely resemble these (already shown): ${JSON.stringify(avoid.slice(0, 30))}.`);
  parts.push(
    `Reply with ONLY one JSON object, no prose: {"truths": ["14 truths"], "dares": ["14 dares"]${adult ? ', "social": ["2 social dares"]' : ""}}`,
  );
  return parts.join("\n");
}
