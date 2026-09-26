# Lucky — puzzle scratch tickets and a ticket factory

Lucky (internal ID `relic`, called Relic until 25 September 2026) is one shared scratch-ticket room for one to three people. Every ticket book is a small puzzle printed under foil, in the spirit of LinkedIn's daily games, and every ticket is bought: a careful player wins, a careless one loses. Harder levels open once a book has been played. `/expedition/<token>`, invitations, guest identities and saved desks are unchanged; `/relic` now leads to the library. The dart game, forge and bell tower of the first prototype are still refunded once at their old prices.

## Layout

Three tabs sit at the top centre beside the shared purse: **Tickets**, **Factory** and **Upgrades**. Back/name and progress stay top left; sound, rules, fullscreen and Menu stay top right. Watch opens a live, read-only view of another player’s ticket, including saved scratch strokes and payouts. Players and the invitation are also accessible from the Menu. Every tab fits one viewport. Text is kept to names, numbers and prices; rules live in How to play.

A desk link (`/expedition/<token>`) shows the desk art while it loads and, for an invited player, a small name card over it. There is no menu page of its own any more: `/relic` leads to the library, where Lucky's box opens and lists the desks.

## Tickets: the shelf and the ticket in your hand

- **Shelf** (left; a strip on portrait phones): each open book shows its painted ticket, name, the price of one ticket at the chosen level and three level pips (I, II, III). Locked levels show a lock and say how many more tickets open them. The next locked book shows its price and is bought in order; later books are hidden entries with prices. While a ticket is being scratched the shelf waits.
- **Your hand**: there is no table. Every player holds one ticket, always open on a spotlit felt stage. Buying a ticket from the shelf puts it in your hand. The rail beside it (below on phones) shows the hearts left. The moment the ticket is over it pays by itself: the rest of the seals show what they hid, the payout counts up with its extras (Jackpot, Star, Quick, Refund) and the net win or loss, and **Again** buys the same book and level. With nothing in hand the stage shows the last book played and **Buy**.
- **Price**: a ticket costs half of what a careful player wins with it on average (`ticketPrice`: prize unit × the careful player's units with the plain ×3 jackpot × `PRICE_SHARE`). A perfect ticket roughly doubles its price; a messy one loses. Richer prizes raise prizes and prices together; the jackpot, stars, streaks, hearts, quick hands and the shop tilt the odds. When the purse cannot pay for one, Lucky Seven I is free (`houseTicket`), so a desk can never get stuck.

## The books

Every book has three levels. A level opens after 8 and 25 finished tickets of that book, shared by the desk (sooner with Early print); a player can always pick an easier level. Levels multiply every prize ×1, ×2 and ×4 (more with Mastery), and bring bigger grids and fewer allowed mistakes. Level I is no longer a warm-up: every book starts with a real puzzle.

| Book         | Price | Puzzle                                                                                                                                                                                             | Levels                                                           | A perfect ticket       |
| ------------ | ----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------- |
| Lucky Seven  |  free | Find the hidden 7s. Every other seal pays a coin and shows an arrow toward the nearest 7; each costs a miss. Once every 7 is found, the misses left scratch themselves and pay.                    | 4×4, 1 seven, 4 misses → 5×5, 2 sevens, 5 → 6×5, 3 sevens, 5     | every 7 found          |
| Twins        |    4K | The ticket splits into side-by-side pairs printed with the same number, in exactly one way. Scratch a seal, then its twin; a wrong second seal is a mistake and spends its own twin.               | 5×4 with 3 numbers, 3 → 6×4 with 3, 2 → 6×4 with 2, 2            | every pair matched     |
| Garden       |  300K | Zip: start at 1 and draw one path through orthogonal neighbours, numbered seals in order, never across a hedge. A wrong step costs a heart.                                                        | 4×4, 4 numbers, 2 hedges, 2 → 5×5, 5, 4 hedges, 2 → 6×6, 6, 6, 1 | every seal on the path |
| Ladder       |   80M | Higher or lower: the bottom card is printed; on each rung scratch ▲ if the next card is higher or ▼ if lower. Every card of the small deck appears once, so counting helps. Higher rungs pay more. | 5 rungs, deck 1–9, 3 → 7 rungs, 1–12, 3 → 9 rungs, 1–15, 2       | every rung right       |
| Gold Mine    |    3B | Minesweeper: an entrance seal is open; numbers count the dynamite around a seal, empty ground opens its neighbours, dynamite ends the dig.                                                         | 5×5, 4 → 6×6, 7 → 7×7, 11                                        | every gem dug          |
| Sun & Moon   |    3T | Tango: each row and column holds as many suns as moons, never three alike in a line; = and × signs join equal and opposite seals. Printed seals give exactly one answer. Scratch only the moons.   | 6×6, 3 mistakes → 6×6 with 3 signs, 2 → 6×6 with 8 signs, 2      | every moon             |
| Sea Chart    |   3Qa | Battleships: edge numbers count ship parts per row and column; ships never touch. Water is a miss; a sunk ship pays a bonus.                                                                       | 6×6 [3,2,2,1], 4 → 6×6 [4,3,2,2,1], 4 → 7×7 [4,3,3,2,2,1,1], 4   | every ship sunk        |
| Crown Jewels | 150Qa | Queens: one crown in every row, column and colour, never touching. The region map has exactly one answer.                                                                                          | 6×6, 3 → 7×7, 2 → 8×8, 2                                         | every crown            |

`lib/games/relic/books.ts` holds the generators, `openSeal` (the rule applied when a seal comes open), `sealLocked` (Ladder rungs above the one being played, the card column, marked dynamite) and `settled` (nothing left to win). Twins, Sun & Moon and Crown Jewels are generated with solvers that prove a unique answer; Crown Jewels repairs its region map, cell by cell, until only the planted answer is left. `suggest` is a careful player that sees only what the ticket shows (it reads the unique answer of the logic books and counts cards on the Ladder); the tests, the factory averages and the prices use it.

Revealed seals show glossy prize symbols with their coin value; paid seals glow gold, golden seals pay ×10, mistakes carry a red cross, and seals shown at the end are dimmed. Foil clues (Twins numbers on their own foil colours, Garden numbers, Ladder ▲/▼, Crown colours, marked dynamite) are printed on the foil and wear away with it; hedges, signs, the Garden route and the Sea Chart counts stay above it. Locked Ladder rungs sit under a darker foil the coin cannot cut.

## Payout

`prize units × book value × level multiplier × 2^Richer prizes × 2^Golden touch × 1.5^book prizes × Collector`, then × the jackpot for a perfect ticket (×3, upgradable to ×20), × the star payout for a star ticket (×5 → ×12), the hot-streak bonus, +quick hands for a ticket finished within `8 s + 0.8 s per seal`, and +heart bonus for every heart left. Insurance returns part of what a ticket lost. A ticket is settled on the server as soon as `openSeal` ends it, inside the stroke command that caused it.

## Upgrades

Forty upgrades in six branches, drawn as little trees of medallions side by side (one branch at a time with path tabs on narrow screens). An upgrade opens once the one before it has a rank; nodes two steps away show only as a "?" silhouette. Every rank is a big step with its own price, and each upgrade's ranks are spread across the whole game (`span` in `UPGRADES`).

- **Scratching**: Bigger coin (×1.35 → ×2.8), Thin foil (72% → a touch), Quick hands (+25% → +100% for a fast ticket).
- **Luck**: Second chance (+1 mistake per rank), Star tickets (2% → 22%), Golden seal (15% → 80% chance of a ×10 seal), Bright stars (star ×5 → ×12), Hot streak.
- **Payouts**: Richer prizes (prizes and prices ×2, twelve ranks), Jackpot (×3 → ×20), Heart bonus (+5% → +35% per heart left), Golden touch (×2 everything, four ranks), Mastery (level II and III pay more), Collector (+5% per book on the shelf per rank).
- **Shop**: Bulk discount (−10% → −40%), Insurance (25% → 75% of a loss back), Lucky draw (5% → 25% free tickets), Early print (levels open sooner).
- **Books**: each book on the shelf gets its own prize upgrade (×1.5 per rank) and a helper: Hot and cold (misses show the distance to the nearest 7), Matchmaker (pairs printed open), Garden map (more numbers), Safety rope (wrong guesses forgiven), Metal detector (dynamite marked and locked), Almanac (more printed suns and moons), Sonar (ship parts shown) and Royal decree (a crown shown).
- **Factory** (after the factory is built): Fast printers and Fast bots (×1.5 per rank), Salesmanship (factory sales ×1.4 per rank), Clever bots (bot skill 50% → 90%), Wholesale (machines −20% per rank), Bigger floor (8×5 → 16×9).

## Factory

The factory is still bought once for 1K and shared by the desk; its tickets cost nothing. It is drawn with painted top-down machines (`public/art/lucky/factory/`, cut by `scripts/optimize-lucky-factory-art.mjs` from the sheet in `docs/concepts/2026-09-25-lucky-factory/`) on a tiled enamel floor in a brass frame. Belts run, and the tickets riding them are the books' own painted tickets; a scratched ticket carries a gold coin, stars glow, gilded and stamped tickets show it, and bundles stack. A machine at a dead end shows a red mark; a queue behind a slow bot does not. Printers print the chosen book at its highest open level and show it; scratch bots play a ticket at their skill and the cashier sells it at `botReward` (the careful-player average from `AVERAGES`, × bot skill, with the jackpot weighted by the perfect rate). Star tickets pay the star payout. **A placed machine can be dragged to any empty cell** (`factory-move`), keeping what it holds; a tap still selects it to turn, remove or change it. Everything else (belts, splitters, lamps, ink wells, stampers, gilders, charms, bundlers, 500 ms ticks, active time only) is unchanged; see `lib/games/relic/factory.ts`.

## Pacing

The pacing test plays a careful player who buys the newest book they can afford (three seconds per ticket plus a second or two per seal, faster with coin and foil upgrades), simple straight factory lines and the cheapest upgrade. It opens the factory in about 3 minutes, Twins in about 5, Garden in about 14, Ladder in about 22, Gold Mine in about 50 minutes, Sun & Moon in about 1½ hours, Sea Chart in about 2½ and Crown Jewels in about 4 hours. People will be slower, and sloppy play loses money on tickets.

## Saves

Version 4. Version 3 desks keep everything except the free tickets that lay on the tables, which are retired; every player starts with an empty hand. Version 1 and 2 desks keep their unlocked books and ticket counts, mapped by shelf position (Pocket Change → Lucky Seven, Silver Ribbons → Twins, Secret Garden → Garden, Twin Moons → Ladder, Copper Grain → Gold Mine, Lantern → Sun & Moon, Golden Atlas → Sea Chart, Crown Jewels → Crown Jewels). Every old upgrade rank is refunded at its old price except the factory floor, which keeps its size. The factory keeps its machines; printers and tickets on belts are mapped to the new books. Unfinished old tickets are retired.

## Artwork

Each book is a differently shaped painted ticket with its own print style: a 1950s fairground ticket with a tear-off stub (Lucky Seven), twin art deco arches (Twins), a scalloped Victorian seed packet (Garden), a tall Swiss-poster tower (Ladder), a riveted octagonal mine sign (Gold Mine), a round celestial medallion (Sun & Moon), a torn parchment chart (Sea Chart) and a jewelled heraldic shield (Crown Jewels). The prize symbols are one generated 4×4 sheet. The square cover and the 3:1 lid carry the exact title "Lucky". Prompts, logs and choices are in `docs/concepts/2026-09-25-lucky-tickets/`; source PNGs and the rejected variants are in the art archive beside the repo. `scripts/optimize-lucky-art.mjs` trims each ticket, measures its empty play panel by flood fill into `components/game/relic-scratch-art.ts`, rebuilds the symbol sheet with clear gutters and writes the covers. The desk background plates are unchanged.

## Persistence and authority

The browser predicts foil erasure and the book rules for immediate response; the server repeats the same bitmap calculation and `openSeal` from bounded stroke points. Commands name the ticket and the stroke sequence; retries are idempotent through request IDs; no client submits a payout. SQLite transactions serialize shared purchases.

## Reference and validation

The user-provided [Scritchy Scratchy Steam description](https://store.steampowered.com/app/3948120/Scritchy_Scratchy/) informed the tactile scratch/reveal/upgrade loop, LinkedIn's daily games (Zip, Tango, Queens) the book puzzles, and the request for big, game-changing upgrades the upgrade ladders. There is no real-money gambling.

`tests/relic-scratch.test.mjs` covers stroke geometry, automatic payout, ticket prices and the house ticket, one ticket per hand, insurance and lucky draws, levels, every book's generator and rule (including unique answers for Twins, Sun & Moon and Crown Jewels) and helpers, golden seals, the factory averages against the careful player, book prices and upgrade ranks, version 1, 2 and 3 migration, the factory and moving machines, per-member server hands, retries, active time and the pacing run. `scripts/relic-smoke.mjs` is the production smoke. `scripts/relic-browser-qa.mjs` still targets an older interface.

## Table continuity (26 September 2026)

The library and table share one setup dialog with New desk and Continue. Continuing attaches the same saved desk, preserving coins, tickets, books, factory and upgrades. All existing members plus the table must fit three seats; a failed attachment adds nobody. Menu → Table settings stays connected to the originating table so its creator can bring everyone back to the lobby or close the table without deleting the desk.
