# Relic — scratch tickets and a ticket factory

Relic is now one shared scratch-ticket room for one to six people. The dart game, forge, bell tower, guardians and room-unlock controls have been removed. `/relic`, expedition invitations, guest identities and saved shared purses remain compatible. Old room purchases and upgrade ranks are refunded once at their original prices; old collections remain stored.

## Layout

Three tabs sit at the top centre beside the shared purse: **Tickets**, **Factory** and **Upgrades**. Back/name and progress stay top left; sound, rules, fullscreen, Menu and Others stay top right. Every tab fits one viewport. Text is kept to names, numbers and one-line hints; rules live in the How to play overlay.

## Tickets

The book shelf is on the left (a horizontal strip on portrait phones). Unlocked books are chosen for the next ticket; the next locked book shows its price and is bought with coins, in order. Later books stay visible as locked shelf entries with their prices. There is one scratching tool, the coin. Hold and rub; keyboard users move with the arrows and hold Space.

| Book           | Price | Rule printed on the foil                                       |
| -------------- | ----: | -------------------------------------------------------------- |
| Pocket Change  |  free | Luck only                                                      |
| Silver Ribbons |   600 | Each row left to right                                         |
| Secret Garden  |   50K | Follow the numbered trail                                      |
| Twin Moons     |    2M | Reveal matching marks in pairs                                 |
| Copper Grain   |   80M | Rub along each arrow                                           |
| Lantern        |    3B | Warm seals surround the lantern; find it first                 |
| Golden Atlas   |  150B | Numbered route along arrows                                    |
| Crown Jewels   |    8T | Numbers count neighbouring crowns; find the three crowns first |

Hints are printed on the foil and wear away with it. Following the rule adds a technique bonus; nothing is lost for ignoring it. Tickets are free. Landscape tickets use the painted ticket face with seals inside x 7–93%, y 25–91%; portrait phones use a taller ticket with the painted title band on top.

## Factory

The factory is bought once (1K) and is shared by the whole desk. The floor starts at 8 × 5 and grows to 16 × 9 through the Bigger floor upgrade. Players place every machine themselves: pick a part on the left, click a cell, press R or the rotate button to turn it, drag to draw belts (each belt points toward the next cell of the drag), use the eraser to remove parts for a full refund, and right-click to turn a placed machine. Tall screens show the same floor turned a quarter clockwise.

Printers print blank tickets of their chosen book. Scratch bots scratch one at a time, and bigger books take longer. Cashiers sell scratched tickets, two a second, and refuse blank ones, which then block the belt. Splitters share tickets between their front and sides. Lamps (bots) and ink wells (printers) boost the machines they touch. Stampers and gilders multiply ticket value before or after scratching, charms add star tickets to touching printers, and bundlers pack three scratched tickets into one worth ×1.5. Each extra machine of a kind costs more.

`lib/games/relic/factory.ts` runs the simulation in 500 ms ticks. The server runs it only for confirmed active time; the browser runs the same deterministic step between snapshots for smooth motion, and each snapshot replaces the prediction. Time counts as active while the page is visible and focused, so an open factory keeps running without input. There is no offline income.

## Upgrades

Five paths span the full width: Scratching, Luck, Payouts, Technique and Factory. Each card names the single number it changes and shows it now and after the next rank. Each upgrade needs one rank of the card before it. The selected card's sentence and Buy button sit in a bar along the bottom. Narrow or short screens show one path at a time with path tabs.

## Pacing

A test plays a simple strategy: six manual tickets a minute, straight factory lines, and the cheapest upgrade. It reaches Silver Ribbons in about 6 minutes, Twin Moons in about 40, Copper Grain in about an hour and Crown Jewels after about 10 hours. A player who uses lamps, splitters and stampers will be faster.

## Saves

Version 1 saves keep their unlocked books; every other atlas rank is refunded at its original price. Old room saves are still refunded as before.

## Feedback and artwork

The desk uses original warm teal/copper workshop plates, generated independently for landscape and portrait. Every gameplay seal is a DOM/canvas layer on the paper ticket; painted scenery contains no interactive targets. The square library cover includes the exact Relic title. Sources, exact prompts, revised candidates, WebP exports, crop geometry and hashes are preserved in `docs/concepts/2026-09-22-relic-scratch/art/`. The current cover is `box-relic-scratch-v2` (23 September 2026, prompts in `docs/concepts/2026-09-23-folio-relic-covers/`). The library box opens Relic in the shared open-box modal (`components/game/relic-box.tsx`) with saved desks and a new-desk form; leaving a desk returns to the library, and `/relic` remains as a direct page.

Web Audio generates motion-dependent paper/metal friction, reveal chimes, coin payouts, paper changes and upgrade tones after a user gesture. Muting persists locally, and pointer release, blur, hidden pages and unmount stop friction. Animated foil shavings and reveal pops respect reduced motion. Actual device audio and subjective tactile feel still require hands-on review.

`GameNavigation` / `GameProgress` keep the back/name and progress at top left, with Menu above Others at top right. The ticket fits one viewport independently of overlays. Compact portrait and short landscape arrangements prioritize the scratch field. Extreme zoom below 600×551 uses an explicit local play-area scrolling fallback.

## Persistence and authority

`lib/games/relic/scratch.ts` owns the scratch geometry, ticket generation, rewards and upgrade rules. The browser predicts foil erasure for immediate response; the server repeats the same bitmap calculation from bounded stroke points. Commands specify ticket IDs and exact stroke sequences. Prizes are awarded only after confirmed complete coverage. SQLite transactions serialize shared purchases; per-request receipts make retries idempotent. No client submits a payout or technique score.

## Reference and validation

The user-provided [Scritchy Scratchy Steam description](https://store.steampowered.com/app/3948120/Scritchy_Scratchy/) informed the tactile scratch/reveal/upgrade loop. Relic uses original artwork, ticket rules, progression and a shared workshop setting. There is no real-money gambling.

Automated tests cover stroke geometry, every book rule including lantern and crown clues, ordered paid books, every upgrade rank, factory flow, blocking, adjacency boosts, atomic building and refunds, printer books, v1 save migration, per-member tickets, receipts, active-only factory time and the pacing run.

`scripts/relic-browser-qa.mjs` still targets the previous atlas-and-press interface and needs rewriting before use.

Validation on 22 September 2026 (factory redesign): the full 475-test suite passed. Headless checks in an isolated worktree and database covered desktop 1440×900, phone 390×844 and short landscape 844×390 with no page scrolling, mouse scratching, building a working factory line, and the upgrades bar. Real touch, device sound and long-session pacing have not had a human playtest.
