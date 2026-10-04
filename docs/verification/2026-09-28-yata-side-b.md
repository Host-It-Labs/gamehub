# Yata: three-round Side B — 28 September 2026

## Behavior

- New-game menus read **After Hours — Beginner · 2 rounds** and **Side B — Intermediate · 3 rounds**.
- After Hours keeps its rules, point values, supply, extensions and playing layout.
- New Side B games deal three six-dish hands: 18 picks per seat, from 108 unique cards (18 of each kind), sufficient for six players. Passing alternates left, right, left.
- Customer Orders offers three new recipes each round, nine distinct offers per match. Market Seasons features every dish once in each of three rounds. Orders count only their own six picks; the two stall permits still persist for the whole match and cap at six points each.
- The `menuRounds: 3` saved-state marker distinguishes new Side B matches. Existing unmarked two-round saves retain their duration, supply, forecasts, offers and scoring. Practice, online views, persisted matches, progress and help use the same duration.
- Bots plan across all 18 picks. Stalls without orders no longer attempt to score an absent order. Hard Yata bots sample the actual six-dish supply instead of the Nox deck.
- Side B groups completed orders into one receipt with an inspectable, round-by-round history. Phones place it above Undo and reserve a fixed action area. Short phones use shorter tickets; the hand still reserves both rows. Long desktop player names contract before wrapping into the round pill. All opponent orders remain available in Others.

## Balance decision

Retain the six existing Side B scoring rules and extension values. The extra round adds opportunities to complete Bao pairs and Coconut triples while retaining the risks of leftovers, excess Chilli, unsupported Rice and competition for the Roti bonus. None of these rewards compound with the round number. Stall rewards remain capped; orders and seasons grow with the number of picks.

Reproduce the comparison with:

```sh
node --experimental-strip-types scripts/yata-balance.mjs
```

The audit plays 40 seeds for each duration, seat count and extension setting: 480 medium-bot matches total. A legacy-shaped two-round Side B match supplies the baseline. Values below are mean total points per player.

| Seats | Two rounds, base | Three rounds, base | Two rounds, all extensions | Three rounds, all extensions |
| --- | ---: | ---: | ---: | ---: |
| 2 | 42.92 | 62.80 | 59.88 | 88.79 |
| 3 | 42.87 | 62.94 | 61.27 | 89.83 |
| 6 | 42.36 | 61.08 | 61.55 | 89.45 |

Base totals rise about 44–47% for 50% more picks. Orders, stalls and seasons together account for about 30–31% of the new total, compared with about 29–31% before. The script also reports average picks and points for each dish. These are deterministic bot observations, not proof of optimal strategy or human balance; human playtesting remains valuable.

## Verification

- Full suite: **647 tests passed**. Dedicated coverage checks all five seat counts and all eight extension combinations, 18 picks per seat, card conservation, private pending choices, round-local bonuses, saving each move, malformed third-round data, old two-round saves, hard-bot supply, and online practice/reload/private submissions.
- Typecheck and production build passed. Initial sandboxed runs could not bind temporary localhost servers (`listen EPERM`); rerunning with local-port permission passed.
- Full-project lint reports one unrelated error in the concurrently edited `components/game/arena/materials.ts` (`unbound-method`, line 261). Changed Yata files pass lint.
- Chrome tab/site muted throughout interaction. A reversible fixture used the separate `127.0.0.1:3017` origin; existing saved matches were backed up and restored.
- Browser views: 320×568, 390×664, 390×844, 768×1024 and 1536×730. Six seats, deliberately long names, all extensions, two settled orders plus three new choices, history opening/closing and Others were checked. No whole-page overflow in these playing views. The 320×568 board plates measured about 82×57 px after reflow.
- At 390×664, the board stage stayed `[0, 92, 390, 246]`, the controls `[8, 348, 286, 114]`, and the hand `[8, 472, 374, 182]` from six cards through one card, including locking the third order. The eighteenth pick ended the match at Round 3 / 3 with three settled orders.
- At the 1229×584 CSS viewport (approximately a 1536×730 window at 125% zoom), the inspected board, hand and controls stayed inside the viewport. This was viewport emulation, not a native browser zoom gesture.
- A coarse-pointer 844×390 emulation displayed the portrait-only rotate screen. This does not establish real-device orientation locking or fullscreen behavior.

Physical touch, real-device fullscreen/orientation, live human multiplayer and human balance acceptance were not tested. Artwork and camera source geometry are unchanged. Unrelated Arena and Mora work remains intact.
