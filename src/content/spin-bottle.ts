/**
 * Hand-written prompts for Spin the Bottle. These are the built-in deck (used when the AI is
 * off or slow) and the style examples the AI copies, so they set the quality bar for the game.
 *
 * Rules every prompt follows, in every tone:
 * - Only about the person who got picked. Never "tell us X's secret", never targets a named player.
 * - No touching, kissing or physical contact with anyone else.
 * - No bodies, weight or looks; no caste, religion, region or politics; no money or salary.
 * - No alcohol, smoking, romance or sexual content.
 * - Nothing outside the room, nothing with heat, water, height or eating non-food.
 * - Phones only on the player's own phone, and they can always veto.
 * "Social" dares (posting) exist only in the adult tones; the game shows at most one per game.
 */

export const BOTTLE_TONES = ["kids", "family", "college", "office"] as const;
export type BottleTone = (typeof BOTTLE_TONES)[number];

export type BottleKind = "truth" | "dare";

export interface BottlePrompt {
  id: string;
  kind: BottleKind;
  text: string;
  /** Asks the player to post something on their own social media. Rare by design. */
  social?: boolean;
}

export const TONE_INFO: Record<BottleTone, { label: string; emoji: string; blurb: string; adult: boolean }> = {
  kids: { label: "Bacche", emoji: "🧒", blurb: "Silly dares, easy truths. Safe with little ones.", adult: false },
  family: { label: "Parivaar", emoji: "👨‍👩‍👧", blurb: "Cheeky but wholesome. Nani-approved.", adult: false },
  college: { label: "College Gang", emoji: "🎓", blurb: "Roast yourself, phone dares, chaos. For friends.", adult: true },
  office: { label: "Office Party", emoji: "💼", blurb: "Corporate satire for same-level colleagues.", adult: true },
};

type Deck = { truth: string[]; dare: string[]; social?: string[] };

const DECKS: Record<BottleTone, Deck> = {
  kids: {
    truth: [
      "If you could be any cartoon character for a day, who would you be?",
      "What's the silliest thing that ever made you laugh so hard you couldn't stop?",
      "Which vegetable would you ban from the whole world?",
      "If your pet (or dream pet) could talk, what would it complain about?",
      "What's the funniest thing a teacher ever said in class?",
      "If you were invisible for one hour, what would you do first?",
      "Which superhero power would be the most useless one to have?",
      "What's the weirdest food combination you secretly like?",
      "If you could swap lives with any grown-up here for a day, who? Why?",
      "What's one thing you pretend not to like, but actually love?",
      "What would you name a new flavour of ice cream?",
      "If you had a robot, what is the first chore you'd make it do?",
      "What's the best excuse you've ever given for not doing homework?",
      "Which animal do you think you'd be in a past life?",
      "If you ran the school for one day, what new rule would you make?",
      "Which cartoon character would be the worst babysitter?",
      "If you could only eat one food forever, what would it be?",
      "What's your signature dance move? Describe it, don't show it… yet.",
      "Who is the funniest person in your family, and why?",
      "If you could shrink to the size of an ant, where would you go first?",
    ],
    dare: [
      "Walk like a penguin across the room and back.",
      "Do your best monkey impression for 10 seconds.",
      "Say the alphabet backwards as fast as you can (Z, Y, X…).",
      "Talk like a robot until your next turn.",
      "Make the silliest face you can and hold it for 5 seconds.",
      "Sing 'Twinkle Twinkle' like an opera singer.",
      "Pretend to be a news reporter announcing that it's bedtime.",
      "Hop on one foot and count to 15.",
      "Act like a cat that just saw a cucumber.",
      "Do a slow-motion run across the room.",
      "Tell a joke. If nobody laughs, tell another one!",
      "Pretend the floor is lava and get to the nearest chair.",
      "Speak only in rhymes until your next turn.",
      "Show us your best superhero landing.",
      "Make animal sounds for three animals; everyone guesses which.",
      "Pretend to be a dinosaur ordering pizza.",
      "Do 5 jumping jacks while saying 'Bawaal!' each time.",
      "Act like a grandparent seeing a smartphone for the first time.",
      "Balance a cushion on your head and walk to the door.",
      "Be a mime stuck inside an invisible box for 10 seconds.",
    ],
  },
  family: {
    truth: [
      "What's the most dramatic thing you've done to get out of a family function?",
      "Which relative's WhatsApp forwards do you secretly enjoy?",
      "What's the one dish you claim you cooked but actually ordered?",
      "What's the silliest thing you got scolded for as a kid?",
      "Which Bollywood character are you, honestly?",
      "What's the worst gift you ever had to pretend to like?",
      "What is your most-used excuse to avoid a phone call?",
      "Which family tradition would you quietly cancel if you could?",
      "What's the longest you've gone without replying to the family group?",
      "If your life had a background song, what would play when you walk in?",
      "What's one thing you still can't do that everyone assumes you can?",
      "What's your most embarrassing school memory?",
      "Which TV serial have you watched way more of than you'd admit?",
      "What's the most useless thing you've ever bought online?",
      "If you could skip one festival chore forever, which one?",
      "Who in this family would win a reality show, and which show?",
      "What's the worst haircut you've ever had? Describe it fully.",
      "What's a 'rule' your parents made that you now follow yourself?",
      "What's your guilty-pleasure snack at 11 PM?",
      "What song do you sing loudest when you're alone at home?",
      "What's the biggest lie you told as a kid that you got away with?",
      "Rate your own driving out of 10. The room votes on whether you're lying.",
    ],
    dare: [
      "Give a 30-second wedding-sangeet speech for the snacks on the table.",
      "Do the full 'Good morning 🌸' uncle voice note, live.",
      "Do your best Bollywood villain laugh. The room rates it out of 10.",
      "Commentate the next 30 seconds of this room like a cricket match.",
      "Act out how you behave when the doorbell rings unexpectedly.",
      "Sell the nearest object to the room like a TV shopping channel host.",
      "Say a famous film dialogue in three different moods.",
      "Act like an aunty spotting someone she knows at a wedding.",
      "Hum a song with your mouth closed until someone guesses it.",
      "Do your best impression of yourself waking up on a Monday.",
      "Narrate what's happening right now like a nature documentary.",
      "Speak like a newsreader until your next turn.",
      "Show your best wedding baraat dance step for 10 seconds.",
      "Pitch a new family WhatsApp group name and defend it.",
      "Act out a TV-serial dramatic zoom: three slow head turns, with sound effects.",
      "Recite your favourite ad jingle from childhood.",
      "Give a two-line shayari about the snacks on the table.",
      "Pretend you are a tourist guide describing this room.",
      "Do a 15-second cooking show for making the perfect chai.",
      "Talk only in questions until your next turn.",
    ],
  },
  college: {
    truth: [
      "What's your most unhinged 2 AM Zomato order?",
      "What's the lamest excuse you've used to bunk class that actually worked?",
      "Which song do you have on repeat that you'd never admit to? Play 10 seconds of it.",
      "Who would you call first if you got arrested, and what would they say first?",
      "Rate your own cooking out of 10. The room votes on whether you're lying.",
      "What's the worst date you've ever been on?",
      "What's the most embarrassing thing in your search history this week? You can veto, but then you owe a dare.",
      "What's the dumbest thing you've done to impress someone?",
      "Which group chat would cause the most chaos if it got leaked?",
      "What's the longest you've pretended to understand something in class?",
      "What's a trend you followed that you now pretend never happened?",
      "What's your most dramatic 'I'm never doing this again' moment?",
      "What's the most money you've wasted on something you used once?",
      "Which app would be the most embarrassing to show your screen time for?",
      "What's the worst thing you've done to finish an assignment at 4 AM?",
      "What's your go-to excuse when you're late? Use it now, on us.",
      "Who here would survive a zombie apocalypse the longest, and why not you?",
      "What's your most cringe old profile picture? Describe it in detail.",
      "What's the weirdest thing you believed until embarrassingly recently?",
      "What's the pettiest reason you've stopped following someone?",
      "If your life were a Netflix show, what would the episode about this year be called?",
      "What's the biggest red flag you have, honestly?",
      "What's a compliment you got years ago that you still think about?",
      "Who here would you want with you on a 3-day trip with no phone signal?",
    ],
    dare: [
      "Commentate the next 60 seconds of this party like a cricket match.",
      "Do a WhatsApp uncle forwarding a 'Good morning 🌸' message, voice and all.",
      "Pitch a startup in 30 seconds. The room decides whether they'd invest ₹10.",
      "Show your 3rd most recent screenshot. You can veto one.",
      "Let the person on your left pick your phone wallpaper for the rest of the party.",
      "Read your last sent text out loud in a news-anchor voice. You can veto one chat.",
      "Do a dramatic movie-trailer voiceover about your morning today.",
      "Act out your morning routine in fast-forward, no words.",
      "Give a 30-second TED talk on why your favourite snack is superior.",
      "Do a fake motivational Instagram reel, live, about getting out of bed.",
      "Talk like a Bollywood hero in a slow-motion scene until your next turn.",
      "Let the room choose an emoji. Use it at the end of every sentence until your next turn.",
      "Roast yourself for 20 seconds. Nobody else is allowed to help.",
      "Recreate your most chaotic exam-hall face.",
      "Do a stand-up bit about the worst flatmate you can imagine. 30 seconds.",
      "Speak only in movie dialogues until your next turn.",
      "Show the most recent photo you took that you're willing to show. Explain it.",
      "Do your best impression of a professor taking attendance.",
      "Freestyle-rap four lines about the last thing you ate.",
      "Narrate this party like a true-crime documentary for 30 seconds.",
      "Read out your phone's last 3 autocorrect suggestions as a sentence.",
      "Do a dramatic 'acceptance speech' for winning Best Procrastinator.",
    ],
    social: [
      "Post a story: “Just found out I'm the funniest person in this room.” Keep it up for 1 hour.",
      "Send a “Good morning 🌸🙏” image to your most active group chat. No explanation allowed.",
      "Change your WhatsApp 'About' to something the room picks (you can veto twice) for 24 hours.",
      "Post a story of your best 'thinking face' with the caption “Deep thoughts.” 1 hour minimum.",
      "Set a song the room picks as your Instagram profile song for a day.",
      "Post a story poll: “Am I the main character?” Show the results at the next party.",
    ],
  },
  office: {
    truth: [
      "What's the longest you've pretended to be 'on mute'?",
      "Which corporate buzzword do you overuse? Use it in a sentence about your lunch.",
      "Which manager's catchphrase could you do in your sleep? Do it.",
      "What's the most useless meeting you've sat through, and how long did it go?",
      "What's your most-used fake excuse for leaving a call early?",
      "What's the longest you've let an email sit unread on purpose?",
      "What did you think this job would be like, versus what it is?",
      "What's the weirdest thing you've seen someone microwave in the pantry?",
      "What's your camera-off activity during long calls? Be honest.",
      "Which tool or portal do you hate the most, and why?",
      "What's your go-to face when you have no idea what's being discussed?",
      "What's the most passive-aggressive email phrase you've ever sent?",
      "If our team were a Bollywood movie, what would it be called?",
      "What would make you quit on the spot? Hypothetically.",
      "What's the worst 'team-building' activity you've ever done?",
      "Who here would survive longest in a meeting with no agenda?",
      "What's the most creative way you've avoided a 6 PM call?",
      "What's one thing the company does that makes zero sense to you?",
      "What's your secret productivity hack, or secret laziness hack?",
      "Which emoji do you use on Slack/Teams to mean 'I'm not doing that'?",
      "What's the worst date you've been on? Office-friendly version, please.",
      "What's the most 'corporate' thing you've caught yourself saying at home?",
      "Who here is secretly running the team? Wrong answers only.",
    ],
    dare: [
      "Present your weekend as a quarterly earnings report.",
      "Give a TED talk about the office pantry.",
      "Act out yourself on a 9 AM Monday call.",
      "Run a 30-second 'town hall' announcing that Fridays are cancelled.",
      "Write your own resignation letter as a Bollywood dialogue and read it out.",
      "Do your best impression of the boss joining a call late. (The boss isn't here.)",
      "Explain your job to the room like they're five years old. 30 seconds.",
      "Pitch a terrible new company perk with total confidence.",
      "Do a LinkedIn-influencer-style post, out loud, about losing at this game.",
      "Act out a meeting where everyone talks at once and nobody unmutes.",
      "Speak only in corporate jargon until your next turn.",
      "Do a 20-second roast of the appraisal process. Keep it about the process.",
      "Give a motivational speech to the coffee machine.",
      "Act out the face you make when someone says 'quick call?'.",
      "Do a slow-motion 'leaving office at 6 PM sharp' walk.",
      "Read your last sent work message out loud in a movie-trailer voice. Veto allowed.",
      "Recreate the 'you're on mute' moment with three different people's reactions.",
      "Announce the next team outing like a cricket commentator.",
      "Give a 3-slide pitch (with hand gestures) on why the weekend should be 3 days.",
      "Do an IT support call where the solution is always 'restart it'.",
    ],
    social: [
      "Draft a LinkedIn post: “Thrilled to announce I lost at Spin the Bottle 🚀.” Post it or read it aloud; the room picks.",
      "Set your Teams/Slack status to something the room picks (you can veto twice) until Monday 10 AM.",
      "Post a story: “Corporate by day, Spin the Bottle champion by night.” 1 hour minimum.",
      "Change your WhatsApp 'About' to “Let's take this offline” for 24 hours.",
    ],
  },
};

function build(tone: BottleTone): BottlePrompt[] {
  const deck = DECKS[tone];
  const out: BottlePrompt[] = [];
  deck.truth.forEach((text, i) => out.push({ id: `${tone}-t${i}`, kind: "truth", text }));
  deck.dare.forEach((text, i) => out.push({ id: `${tone}-d${i}`, kind: "dare", text }));
  (deck.social ?? []).forEach((text, i) => out.push({ id: `${tone}-s${i}`, kind: "dare", text, social: true }));
  return out;
}

export const BOTTLE_PROMPTS: Record<BottleTone, BottlePrompt[]> = {
  kids: build("kids"),
  family: build("family"),
  college: build("college"),
  office: build("office"),
};

export function isBottleTone(v: unknown): v is BottleTone {
  return typeof v === "string" && (BOTTLE_TONES as readonly string[]).includes(v);
}
