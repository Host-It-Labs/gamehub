# Lucky — puzzle scratch tickets and a ticket factory

Lucky (internal ID `relic`, called Relic until 25 September 2026) is one shared scratch-ticket room for one to six people. Every ticket book is a small puzzle printed under foil, in the spirit of LinkedIn's daily games: simple at first, harder levels once a book has been played. `/relic`, `/expedition/<token>`, invitations, guest identities and saved desks are unchanged. The dart game, forge and bell tower of the first prototype are still refunded once at their old prices.

## Layout

Three tabs sit at the top centre beside the shared purse: **Tickets**, **Factory** and **Upgrades**. Back/name and progress stay top left; sound, rules, fullscreen and Menu stay top right. Players and the invitation are in the Menu. Every tab fits one viewport. Text is kept to names, numbers and one-line hints; rules live in How to play.

## Tickets: the shelf, the table and one ticket held up

- **Shelf** (left; a strip on portrait phones): each open book shows its painted ticket, name, one-line rule, a + to lay a ticket on your table and three level pips (I, II, III). Locked levels show a lock and say how many more tickets open them. The next locked book shows its price and is bought in order; later books are hidden entries with prices.
- **Table**: your tickets lie on a felt spread, slightly tilted, up to twelve at a time. Each shows its level, a star badge for star tickets and a dot once started. A first desk starts with three Lucky Seven tickets.
- **Held ticket**: tapping a ticket lifts it over the table (the whole stage on phones). The rail beside it (below on phones) shows the hearts left. The moment the ticket is over it pays by itself: the rest of the seals show what they hid, the payout counts up, a perfect ticket says **Jackpot ×n**, and **Next** (with how many of the same book wait on the table) or **Another** (lays and opens a new one of the same book and level) carries on. There is no collect step. Escape or × goes back to the table.

## The books

Every book has three levels. A level opens after 8 and 25 finished tickets of that book, shared by the desk; a player can always pick an easier level. Levels multiply every prize ×1, ×2 and ×4, and bring bigger grids and fewer allowed mistakes.

| Book         | Price | Puzzle                                                                                                                                                                                           | Levels                                                              | A perfect ticket       |
| ------------ | ----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------- |
| Lucky Seven  |  free | Find the hidden 7s. Every other seal pays a coin and shows an arrow toward the nearest 7; each costs one scratch, the 7 costs none.                                                              | 3×3, 3 misses → 4×4, 4 → 5×5, 5 with two 7s                         | every 7 found          |
| Twins        |    4K | Each seal's arrow points along a straight line to its twin. Scratch twins one after the other; a wrong second seal is a mistake.                                                                 | 4×3, twins adjacent, 3 → 4×4, up to 2 apart → 5×4, up to 4 apart, 2 | every pair matched     |
| Garden       |  300K | Zip: start at 1 and draw one path through orthogonal neighbours, numbered seals in order, never across a hedge. A wrong step ends the walk.                                                      | 3×3 with 3 numbers → 4×4 with 4 → 5×5 with 5 and 5 hedges           | every seal on the path |
| Ladder       |   80M | Every number must be higher than the last. The foil colour tells the band (cool to hot); each step up pays one more.                                                                             | 2×4, 4 bands, 4 steps → 3×4, 4 bands, 6 → 3×5, 3 bands, 6           | the step goal reached  |
| Gold Mine    |    3B | Minesweeper: an entrance seal is open; numbers count the dynamite around a seal, empty ground opens its neighbours, dynamite ends the dig.                                                       | 4×4, 2 → 5×5, 4 → 6×6, 7                                            | every gem dug          |
| Sun & Moon   |  1.5T | Tango: each row and column holds as many suns as moons, never three alike in a line; = and × signs join equal and opposite seals. Printed seals give exactly one answer. Scratch only the moons. | 4×4, 3 mistakes → 6×6, 2 → 6×6 with 8 signs and minimal givens, 2   | every moon             |
| Sea Chart    |  400T | Battleships: edge numbers count ship parts per row and column; ships never touch. Water is a miss; a sunk ship pays a bonus.                                                                     | 5×5 [3,2,2], 5 misses → 6×6 [4,3,2,2], 5 → 6×6 [3,3,2,2,1,1], 4     | every ship sunk        |
| Crown Jewels |   4Qa | Queens: one crown in every row, column and colour, never touching. The region map has exactly one answer.                                                                                        | 5×5, 3 → 6×6, 3 → 7×7, 2                                            | every crown            |

`lib/games/relic/books.ts` holds the generators, `openSeal` (the rule applied when a seal comes open) and `settled` (nothing left to win). Sun & Moon and Crown Jewels are generated with solvers that prove a unique answer. `suggest` is a careful player that sees only what the ticket shows (it reads the unique answer of the two logic books); the tests and the factory averages use it.

Revealed seals show glossy prize symbols (sevens, cherries, bells, clovers, coins, stars, moons, suns, gems, gold, dynamite, roses, ships, crowns, horseshoes) with their coin value; paid seals glow gold, mistakes carry a red cross, and seals shown at the end are dimmed. Foil clues (Twins arrows, Garden numbers, Ladder bands, Crown colours) are printed on the foil and wear away with it; hedges, signs, the Garden route and the Sea Chart counts stay above it.

## Payout

`prize units × book value × level multiplier × 2^Richer prizes × 2^Golden touch`, then × the jackpot for a perfect ticket (×3, upgradable to ×20), ×5 for a star ticket and the hot-streak bonus. Every seal that counts adds its prize units; sunk ships add a bonus. A ticket is settled on the server as soon as `openSeal` ends it, inside the stroke command that caused it.

## Upgrades

Four paths, each rank a large step with its own price, spread over the whole game (`prices` in `UPGRADES`):

- **Scratching**: Bigger coin (×1.35, ×1.75, ×2.2), Thin foil (a seal opens at 72%, 50%, 30%, then at a touch).
- **Luck**: Second chance (+1 allowed mistake per rank, up to +3), Star tickets (2% → 22% chance of ×5), Hot streak (+10%, +25%, +50% per perfect ticket in a row, up to ten).
- **Payouts**: Richer prizes (×2 per rank, twelve ranks), Jackpot (×3 → ×5, ×8, ×12, ×20), Golden touch (×2 everything, four ranks).
- **Factory** (after the factory is built): Fast printers and Fast bots (×1.5 per rank), Clever bots (bot skill 50% → 100%), Bigger floor (8×5 → 16×9).

## Factory

The factory is still bought once for 1K and shared by the desk. Printers print the chosen book at its highest open level; scratch bots play a ticket at their skill and the cashier sells it at `botReward` (the careful-player average from `AVERAGES`, × bot skill, with the jackpot weighted by the perfect rate). Star tickets pay ×5. Everything else (belts, splitters, lamps, ink wells, stampers, gilders, charms, bundlers, 500 ms ticks, active time only) is unchanged; see `lib/games/relic/factory.ts`.

## Pacing

The pacing test plays a careful player (three seconds per ticket plus a second or two per seal, faster with coin and foil upgrades), simple straight factory lines and the cheapest upgrade. It opens the factory in about 2 minutes, Twins in about 5, Garden in about 13, Ladder in about 21, Gold Mine in about an hour, Sun & Moon in about 2 hours, Sea Chart in about 3½ and Crown Jewels in about 5½ hours. People will be slower.

## Saves

Version 3. Version 1 and 2 desks keep their unlocked books and ticket counts, mapped by shelf position (Pocket Change → Lucky Seven, Silver Ribbons → Twins, Secret Garden → Garden, Twin Moons → Ladder, Copper Grain → Gold Mine, Lantern → Sun & Moon, Golden Atlas → Sea Chart, Crown Jewels → Crown Jewels). Every old upgrade rank is refunded at its old price except the factory floor, which keeps its size. The factory keeps its machines; printers and tickets on belts are mapped to the new books. Unfinished old tickets are retired.

## Artwork

Each book is a differently shaped painted ticket with its own print style: a 1950s fairground ticket with a tear-off stub (Lucky Seven), twin art deco arches (Twins), a scalloped Victorian seed packet (Garden), a tall Swiss-poster tower (Ladder), a riveted octagonal mine sign (Gold Mine), a round celestial medallion (Sun & Moon), a torn parchment chart (Sea Chart) and a jewelled heraldic shield (Crown Jewels). The prize symbols are one generated 4×4 sheet. The square cover and the 3:1 lid carry the exact title "Lucky". Prompts, logs and choices are in `docs/concepts/2026-09-25-lucky-tickets/`; source PNGs and the rejected variants are in the art archive beside the repo. `scripts/optimize-lucky-art.mjs` trims each ticket, measures its empty play panel by flood fill into `components/game/relic-scratch-art.ts`, rebuilds the symbol sheet with clear gutters and writes the covers. The desk background plates are unchanged.

## Persistence and authority

The browser predicts foil erasure and the book rules for immediate response; the server repeats the same bitmap calculation and `openSeal` from bounded stroke points. Commands name the ticket and the stroke sequence; retries are idempotent through request IDs; no client submits a payout. SQLite transactions serialize shared purchases.

## Reference and validation

The user-provided [Scritchy Scratchy Steam description](https://store.steampowered.com/app/3948120/Scritchy_Scratchy/) informed the tactile scratch/reveal/upgrade loop, LinkedIn's daily games (Zip, Tango, Queens) the book puzzles, and the request for big, game-changing upgrades the upgrade ladders. There is no real-money gambling.

`tests/relic-scratch.test.mjs` covers stroke geometry, automatic payout, tables and levels, every book's generator and rule (including unique answers for Sun & Moon and Crown Jewels), the factory averages against the careful player, prices and upgrade ranks, version 1 and 2 migration, the factory, per-member server tables, retries, active time and the pacing run. `scripts/relic-smoke.mjs` is the production smoke. `scripts/relic-browser-qa.mjs` still targets an older interface.
