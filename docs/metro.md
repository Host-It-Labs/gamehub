# Metro

A flip-and-draw metro game, built on 25 October 2026 at William's request:
"a kind of replication" of Next Station: Berlin, which he really likes. The
rules and scoring follow that game closely; the name, the city, the map, the
look, the card art and the covers are Gamehub's own. Internal id `metro`,
public name **Metro** (plain, said the same way in most languages;
provisional until William picks a name). It sits in the library's Quick games
shelf, after Rota.

## Rules in one screen

- **Four rounds, four lines.** Everyone draws on their own map of the same
  city. Each round you build one line in a new colour (terracotta, cobalt,
  olive, saffron). Alone the colours come in a random order; at a table each
  seat starts one colour on from its neighbour, so nobody shares a colour in a
  round of up to four.
- **Two banks, two starts.** A river splits the city into the **Moon** bank
  (west) and the **Sun** bank (east). Each colour has two departure stations,
  one on each bank, painted in its colour and sharing a shape.
- **Cards.** Eleven cards: five Moon cards and five Sun cards (circle, square,
  triangle, diamond and a star for any shape) and the railway **switch**. Each
  turn a card turns over and everyone may draw one section from an end of that
  bank's line to the next station of that shape, straight along a dotted guide
  (rows, columns and the diagonal avenues). Drawing is optional; Done locks
  the turn.
- **Never** cross a line (any colour), pass through a station, draw a hop
  twice (any colour), or visit a station twice on one line.
- **Star:** any shape; the station reached gets a box (a grand station).
- **Switch:** the next card turns over too. Draw one section on each half of
  the line, from any of its stations (a branch), to that card's shape; two
  anywhere on a joined line. A star after the switch boxes both stations.
- **Joining.** Meet your other half at any of its stations: the line becomes
  one, and from then on every card works on either bank.
- **The round ends** on the turn the fifth card of either bank turns over
  (five to nine turns).
- **Scoring.** A line scores the districts it passes through times the most
  stations it has in a single district, plus 10 if it joins both starts; two
  halves that never met score apart, without the 10. At the end a station on
  2, 3 or 4 lines scores 2, 5 or 9, and a boxed one counts twice. Ties go to
  the best single line.

## The city

One map, `city`: a 10 × 12 grid of tiles with 56 stations, 14 of each shape
(7 a bank), in twelve districts: four main districts a bank, stepped down the
map, and a single-station district in each corner. Every main district holds
all four shapes and exactly one departure station. Guides run along every row
and column and along diagonal avenues every third step, so the diagonals are
a designed network rather than everywhere. Each colour's starts are five to
seven steps apart across the river. The layout came from an annealing search
(even shapes per bank, degree two or more everywhere, average degree about
4.4, starts with three or more neighbours) and was then fixed by hand (the `city` layout in `lib/games/metro/map.ts`). Never reorder the strings
without a new rules version: station ids are their row-major order.

## Extensions (each one mechanic, either or both)

- **Goals:** two of five are drawn at the start, 10 each to everyone who
  reaches them by the end: Whole districts (every station of two main
  districts on your lines), Grand line (one colour through three boxed
  stations), Grand tour (boxed stations in six districts), Far corners
  (interchanges in two corner districts), Whole city (all twelve districts).
- **Express:** each round has a bonus, the same for everyone, four of five a
  match: Peek (everyone sees the next card), Outskirts (a corner district
  counts as three for this line), Double (the busiest district counts twice
  for this line), Repeat (the switch goes back into the pile once), Parallel
  (you may draw beside another colour's section between the same two
  stations; never in the first round).

## Play

- **Solo:** 1–6 seats, you and up to five bots (easy, medium, hard), saved on
  this device (`gamehub.metro.v1`). Bots draw in the background from what they
  may see; their turn in progress stays hidden, as at a table. Not rated yet.
- **Learn:** a practice match alone with a five-step coach (read the card,
  draw a section, Done, join the starts, scoring), then a real match.
- **Online:** the table admin opens Metro's box at a table and presses Play;
  everyone at the table is seated, bots fill the chosen seat count, and the
  table moves on to `/metro/<token>`. Rooms live in SQLite (`metro_rooms`,
  created on first use) and survive a restart. Each seat draws in private and
  locks its turn with Done; the next card turns once every seat has. There is
  no host Next: nothing waits once the choices are locked, as in Rota. A
  person away 45 seconds has a bot draw their turn; they take the seat back on
  return. The table admin starts another match from the results.

## Look

A sunlit tiled metro hall (see the 25 October 2026 section of DESIGN.md):
cobalt azulejo wall, a terracotta floor under the dock, the map as a panel of
white glazed tiles in a limestone frame with the city painted in cobalt and
the districts in glaze washes; cards are painted tiles that turn over, the
cards flipped this round sit in a wooden rack, the score is a paper ticket,
goals and the round's bonus are brass plaques, players wear enamel line
roundels in their colour of the round. One light, a skylight high on the
left. Optima for display, Seravek for text.

## Code

- `lib/games/metro/map.ts`: the city layout strings, `buildMap` (stations,
  districts, guide-line hops, the hops each hop crosses), `edgeBetween`.
- `lib/games/metro/score.ts`: sections, line scores, interchanges, goals and
  their progress, the final score.
- `lib/games/metro/engine.ts`: cards and deck, state, moves (`draw`, `undo`,
  `done`, `reopen`), legal draws (`fromStations`, `legalDraws`), turn and
  round resolution, Express, `observe` (hides others' turn in play and the
  pile's order but for Peek's top card), validation (`isMetroGame`).
- `lib/games/metro/bot.ts`: prices each way to use the turn by the line as it
  stands, interchanges, free room at the ends, the chance of joining before
  the round ends (fewest free hops against the turns left) and goal progress;
  Hard also averages the best reply to every card that may still turn.
- `lib/games/metro/room.ts`: `MetroView`, `MetroLaunch`.
- `server/metro.ts`, `server/metro-bot-worker.ts`: online rooms (built by
  Codex after Rota's).
- `components/game/metro/`: the table (`metro-table.tsx`), the tiled map
  (`metro-map.tsx`, SVG), card and shape art (`metro-art.tsx`), rules, setup
  box, solo and online controllers, `metro.css`; `metro-lab.tsx` is the dev
  bench at `/metro/lab` (`?seats=3&turns=14&ext=goals,express&seed=7`,
  `turns=99` plays to the end); in development `window.metroLab` plays your
  turn (`auto`), plans it (`plan`) or plays one move (`play`).
- `lib/games/sound/books/metro.ts`: tile taps, a brush of paint, a tile
  turning over, the two-tone station chime when a line joins, a train going
  through at the end of a round.
- Covers: `docs/concepts/2026-10-25-metro-covers` (prompts, sources, review);
  `node scripts/optimize-metro-art.mjs` makes the delivery files.
- Tests: `tests/metro.test.mjs` (the city, the deck, drawing, loops and
  crossings, the switch, scoring, interchanges, round length, colour order,
  privacy, Peek, saves, bots in every setup), `tests/metro-online.test.mjs`
  (launch, privacy, idempotent commands, away seats, a whole match, restart,
  again).
- Balance: `node --experimental-strip-types scripts/metro-balance.mjs 4 hard 8 goals,express`.

## Balance (bot simulations, 25 October 2026; not proof of human balance)

| Setup | Total | Range | Lines | Interchanges | Goals | Joined lines |
| --- | --- | --- | --- | --- | --- | --- |
| Hard, alone (12) | 106.1 | 89–135 | 77.9 | 28.2 | – | 1.3 of 4 |
| Medium, alone (12) | 94.5 | 73–109 | 68.5 | 26.0 | – | 0.8 |
| Easy, alone (12) | 63.3 | 49–88 | 46.7 | 16.7 | – | 0.3 |
| Hard, 4 seats (6) | 108.6 | 74–147 | 79.4 | 29.2 | – | 1.2 |
| + Goals | 110.8 | 76–131 | 75.4 | 32.1 | 3.3 | 0.8 |
| + Express | 131.6 | 91–166 | 92.6 | 39.0 | – | 0.8 |
| + both | 132.9 | 91–181 | 98.8 | 29.5 | 4.6 | 1.2 |

The original's solo scale reads 111–130 as a well-led project, which Hard
bots reach about half the time. Express adds about 23 points, close to the 25
the original takes off a solo score played with it. Limits: the bots plan one
turn ahead (Hard two) and under-chase Goals (about 4 of 20 points), so a
thoughtful person should beat Hard bots.
