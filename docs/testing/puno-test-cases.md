# Puno — interaction test cases and findings

Tested on a phone-sized touch browser (Chromium with real touch events: `touchStart` → `touchMove` → `touchEnd`) at 390×844 and 360×740, host phone plus three test-mode bots, demo mode. Date: 12 Nov 2026.

## Findings (before fixes)

| # | Area | What happened | Severity |
|---|---|---|---|
| F1 | Swipe to play | Swiping up on a playable card does nothing unless the card was tapped first. Nothing on screen says a tap is needed first. The finger just scrolls the hand sideways. | Blocker |
| F2 | Tap to select | Cards overlap by ~58%. Tapping the middle of a card hits the card lying on top of it, so the wrong card is selected. | Major |
| F3 | No button path | Playing a card *only* works by dragging. There is no tap-to-play or button, so keyboard, switch-access and many grandparents can't play. | Major |
| F4 | Unplayable card | Tapping a card you can't play does nothing at all — no shake, no hint. | Minor |
| F5 | Ek Bacha | The "Ek Bacha!" button only shows on your turn with 2 cards. Once you're down to 1 card (when the rules let you call it), the button disappears, so you can always be caught. | Major (rules bug) |
| F6 | Hand layout | Hand cards are 168×238px, so only ~4 of 7 fit and the bottom third is hidden under the player bar. A "+N · swipe" chip floats over the table. | Major |
| F7 | Small controls | Pass, Ek Bacha and Pakdo buttons are 32px tall (below 44px); player-bar names are 8px and table labels 9px. | Minor |
| F8 | Card look | Saturated red/yellow/green/blue cards with a tilted white oval and the game's name across the centre, four-quadrant wild cards and a black deck reading the name closely copy an existing branded card game's trade dress. | Must change |

## Test cases

Each case: steps → expected result. "Playable" = a card the game marks as playable on your turn.

### Playing cards
1. **Swipe up plays** — on your turn, put a finger on a playable card and swipe up ~80px → the card flies to the pile, your count drops by 1, the pile shows it.
2. **Quick flick plays** — short (~35px) but fast upward flick on a playable card → plays.
3. **Small drag cancels** — drag a playable card up ~20px slowly and release → it springs back, nothing is played.
4. **Sideways swipe scrolls** — with more cards than fit, swipe left/right on the hand → the hand scrolls, no card is played or lifted.
5. **Tap selects** — tap a playable card → it lifts and a big "Phenko" button appears.
6. **Tap again plays** — tap the lifted card again, or tap "Phenko" → it's played.
7. **Tap hits the visible card** — tap the visible strip of any card in the fan → that card (not its neighbour) reacts.
8. **Unplayable card** — tap or swipe a card you can't play → it shakes, a short hint says why, nothing is sent.
9. **Not your turn** — swipe a card when it isn't your turn and you have no jump-in card → it shakes; nothing is sent.
10. **Jump-in** — when you hold an exact match of the pile out of turn, swipe it up → it's played as a jump.

### Wild cards
11. **Rang Badal by swipe** — swipe a Rang Badal up → colour sheet opens; the card stays in the hand until a colour is chosen.
12. **Pick colour** — choose a colour → the card flies to the pile and the table shows that colour.
13. **Cancel colour** — close the sheet without choosing → the card is still in the hand, nothing is sent.
14. **Chaar Le by button** — tap a Chaar Le, tap "Phenko", choose a colour → played.

### Draw and pass
15. **Draw** — on your turn tap the deck → one card flies into your hand; "Pass" appears if you can't or don't want to play it.
16. **Pass** — tap Pass → turn moves on.
17. **Deck only on your turn** — tap the deck when it isn't your turn → nothing happens.

### Ek Bacha and Pakdo
18. **Call at 2 cards** — on your turn with 2 cards, "Ek Bacha!" is visible; tap it → the table note says you called it.
19. **Call at 1 card** — play down to 1 card without calling → "Ek Bacha!" is still available to you until someone catches you.
20. **Catch** — when another player is at 1 card and hasn't called → "Pakdo!" appears; tap it → they draw 2.

### Timer and turns
21. **Turn indicator** — on your turn "Teri baari!" shows with a vibration; otherwise the current player's name shows.
22. **Timeout** — let the 20s timer run out → the game draws for you and moves on.

### Layout and accessibility
23. **No page scroll sideways** at 360 and 390 wide.
24. **All buttons ≥ 44px** tall and wide.
25. **Readable text** — no text under 11px on the play screen.
26. **Reduced motion** — with reduced motion on, plays still work and nothing bounces.
27. **Original card look** — no tilted oval with the game name, no four-quadrant wild, no black name-branded deck.

## Results after fixes

Run with real touch events at 390×844 and 360×740 (host + 3 bots), plus a set-up hand for the wild and Ek Bacha cases (host + 1 phone).

| Case | 390×844 | 360×740 |
|---|---|---|
| 1 Swipe up plays (no tap first) | Pass | Pass |
| 4 Sideways swipe scrolls the hand, plays nothing | Pass | Pass |
| 5 Tap selects + Phenko button appears | Pass | Pass |
| 6 Phenko plays | Pass | Pass |
| 7 Tap hits the visible card | Pass | Pass |
| 8 Unplayable card shakes + says why | Pass | Pass |
| 11 Wild swipe opens colour sheet, card stays in hand | Pass | — |
| 12/14 Pick colour plays the wild (tap → Phenko → colour) | Pass | — |
| 13 Closing the sheet plays nothing | Pass | — |
| 15 Draw shows Pass when nothing to play | Pass | — |
| 18 After calling Ek Bacha, Pakdo disappears for others | Pass | — |
| 19 Ek Bacha still available at 1 card | Pass | — |
| 20 Other player sees Pakdo | Pass | — |
| 23 No sideways page scroll | Pass | Pass |
| 24 Buttons ≥ 44px | Pass | Pass |
| 25 No text under 11px | Pass | Pass |
| 27 No game name on card faces | Pass | Pass |

Not covered yet: 2 (quick flick — covered by the same threshold code as 1), 3, 9, 10 (jump-in), 16/17, 21, 22 (timeout), 26 (reduced motion), and real iOS/Android devices.

## What changed
- **Gestures (F1–F4):** each hand card handles its own pointer gesture — an upward swipe or quick flick throws a playable card straight away; sideways movement is left to the browser so the hand scrolls; a tap lifts the card and shows a big "Phenko" button (tapping the lifted card again also plays it); a card you can't play shakes and a line says why (not your turn, stack pending, or no colour/number match). Cards are keyboard-focusable buttons with labels.
- **Ek Bacha (F5):** the button shows on your turn at 2 cards and stays available at 1 card until you call it or get caught.
- **Layout (F6, F7):** hand cards are 124×176 and spaced to fit the phone (7 cards fit at 390px); the fan is gentler so neighbouring cards don't cover each other's tap area; action buttons are 48px; text is at least 11px.
- **Look (F8):** number cards show the number on a round cream badge; Rang Badal is a rangoli flower on cream; Chaar Le is on cream; the deck is turmeric paper with a printed lattice and a wax seal — no name on cards; colours are muted paper inks.

## Round 2 (13 Nov 2026): drag to the pile, card art, Rishtedaar

### New test cases
28. **Drag to the pile** — on your turn, drag a playable card up: it lifts out of the hand and follows your finger; the pile shows a dashed outline. Over the pile it says "Yahan chhodo"; let go → the card is played.
29. **Drop elsewhere** — drag a card up a little and let go away from the pile → it slides back into the hand, nothing is played.
30. **Flick still plays** — a quick upward flick plays the card without reaching the pile.
31. **Wild by drag** — drag a Rang Badal / Chaar Le / Rishtedaar onto the pile → the colour sheet opens; pick a colour → it's played, even after a slow drop.
32. **Playable cards lift** — on your turn (or when you can jump in), playable cards sit higher and the rest fade; when it isn't your move, the hand is shown plain.
33. **Suit patterns** — each colour carries its own pattern and corner mark (Haldi marigold, Sindoor bindi, Mehndi leaf, Neel peacock eye), so cards can be told apart without colour.
34. **Action art** — Ruk Ja raised palm, Ulta rickshaw U-turn, Do Le two chits, Chaar Le four laddoos, Rishtedaar two relatives swapping.
35. **Pile** — the last 8 cards lie scattered and peek out; a new card slaps down with a thud and a puff of dust (no slap or dust with reduced motion).
36. **Rishtedaar rules** — play it on anything (not on a +2/+4 stack), pick a colour, and your hand swaps with the player sitting opposite (the other player in a 2-player game). Both players' Ek Bacha calls reset. Playing it as your last card wins without a swap.
37. **Rishtedaar notice** — both swapped players get a message and a buzz; the table note and the TV say who swapped with whom.

### Results
| Case | 390×844 | 360×740 |
|---|---|---|
| 28 Drag onto the pile plays it, "Yahan chhodo" shows | Pass | Pass |
| 29 Short drag away from the pile returns the card | Pass | Pass |
| 32 Playable cards sit higher than unplayable | Pass | Pass |
| 4 Sideways swipe still scrolls, plays nothing | Pass | Pass |
| 36 Rishtedaar rules (2, 3, 4, 5 players; last card; stack) | Pass (script, 38 checks) | — |
| 37 Swap shown on table and TV | Pass (seen in a bot game) | — |
| Whole-app sweep (overflow, text size, tap targets, popups, script errors) | Pass | — |

Not covered yet: 30 on its own, 31 by touch (the code path is shared with tap → Phenko → colour, which passes), 35 with reduced motion, real iOS/Android devices.
