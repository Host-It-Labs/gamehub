# Folio — a puzzle roguelike on one winding trail

Folio is a cooperative puzzle roguelike for **one to three players**. Open its box in Gamehub or visit `/folio`. Every stop on the trail is one famous daily game, played by its original rules. Losing a game costs the crew one of its two shared lives.

## Tables

- **Your name is asked once**, on the Folio page, and is the name the crew sees at that table. It is stored per table, so one person can use different names at different tables. A guest's first table also creates their guest session.
- **Seats are chosen up front**: Solo, 2 or 3 players. A solo run starts at once. A 2- or 3-seat table opens a lobby with an invitation link; the run begins automatically when the last seat is taken. The host can also start early, which locks the table at the players already seated.
- **Once started, invitation seats are locked**: only members can act. A table host can explicitly continue a saved run with their table, adding its players up to three combined members without resetting progress. An invitation link opened by a non-member shows the table (host, seats taken) before they enter a name.
- **Several runs at once**: each table is its own run with its own random route. "Your runs" on the Folio page lists every unfinished table; finished runs and practice are behind "Show finished".
- **Deleting a run** (trash control beside it, in the setup box and on the Folio page) asks for confirmation first. It removes the run from your list; at a shared table the others keep playing, and the run itself is deleted once nobody is left in it. Relic desks work the same way.

## The run

- **Endless.** The trail has no summit: acts keep coming until the crew loses its second puzzle. (Changed 25 September 2026; it used to end after four acts.)
- **Difficulty.** The setup picks where the run starts: Easy, Medium or Hard. There are four levels (easy, medium, hard, very hard) and each act is one level harder than the one before, then very hard for every act after that: Easy plays easy → medium → hard → very hard → very hard…; Medium starts at medium; Hard plays hard, then very hard from the first boss on. Levels change content (harder words, fewer Sudoku givens, denser mines), never the original allowances.
- **The map.** Acts of three puzzle rounds and a boss. The map always holds the act in play and the next one; each boss beaten draws another act. Only the current section is displayed, starting with the first; there are no future-act tabs. The HUD shows difficulty and round without act numbers. Three lanes, edges to the same or a neighbouring lane, and every pair of neighbouring lanes is linked by exactly one diagonal, so paths never cross and no stop hangs off a single lane. Every node shows its game. There are no rest stops: the only route decision is which games to play.
- **Bosses.** The last round of each act is a single boss node every lane converges on: the harder published variant of one of the games (see the table), at the act's level. A boss never repeats any of the three bosses before it.
- **Lives.** Two shared lives: the crew may lose one puzzle. A lost puzzle, or giving up, costs a life, and nothing restores one. A second loss ends the run; the score is how far the crew climbed.
- **After a boss** the crew may change one thing on the trail ahead, or leave it as it is. Three offers, all small: strike one of two games from every later stop (each replacement is shown before choosing), or swap one stop of the next act for another game. Replacements never repeat a game on their row or on a linked stop. Strikes stop being offered once six games are left, so every row can still be filled; new acts skip struck games. There are no other supplies, clues or hints: none of the originals has them.
- **Practice** plays a single puzzle of any game, normal or boss variant, outside any run.

## The ten games

Every game has a native way to lose, which is what makes it fit a lives-based run. Each is an original adaptation: rules and feel follow the published game; puzzles, words and art are Folio's own.

| Folio           | Inspired by              | Loses after               | Boss variant                                 |
| --------------- | ------------------------ | ------------------------- | -------------------------------------------- |
| Word guess      | Wordle                   | 6 guesses                 | Hard mode (revealed hints must be reused)    |
| Connections     | Connections              | 4 mistakes                | Purple week: red-herring sets, 3 mistakes    |
| Quad words      | Quordle                  | 9 guesses                 | Sequence: boards unlock in order, 10 guesses |
| Waffle          | Waffle                   | 15 swaps (solvable in 10) | Deluxe: 7×7, 25 swaps (solvable in 20)       |
| Country outline | Worldle                  | 6 guesses                 | Far corners: rare countries, rotated outline |
| Hidden equation | Mathler                  | 6 guesses                 | Hard Mathler: 8 characters                   |
| Sudoku          | Sudoku (Sudoku.com rule) | 3 mistakes                | Expert: 22–25 givens, advanced techniques    |
| Minesweeper     | Minesweeper              | 1 mine                    | Intermediate: 16×16, 40 mines                |
| Nonogram        | Picross / Nonogram.com   | 3 mistakes                | Big picture: 15×15                           |
| Codebreaker     | Mastermind               | 10 rows                   | Super code: 5 pegs, 8 colours, 12 rows       |

### Levels

Word guess and Quad words draw answers from four equal tiers ranked by how many other answers share four letters in place (the _IGHT trap), repeated letters and rare letters. Connections, Country outline, Sudoku, Minesweeper, Mathler and Codebreaker have their own graded content per level. **Very hard** is: the red-herring Purple week sets with the usual four mistakes, the rare countries upright, Expert Sudoku, a 12×12 field with 28 mines, a quotient chained with another product or quotient, and a code that always repeats a colour. Waffle and Nonogram have only three graded tiers, so their very hard is their hard.

### What changed from the first edition (22 September 2026)

The first edition drew its list from [Tom’s Guide’s Wordle alternatives](https://www.tomsguide.com/news/wordle-alternatives). Four of its games have **no way to lose** in the original, so Folio had invented allowances that made them feel wrong: **Typeshift** (column shift), **Spelling Bee**, **Strands** and **Redactle**. They were replaced by four of the most widely played puzzle formats that do have a native loss rule: **Sudoku** (three-mistake rule of the popular apps), **Minesweeper**, **Nonogram** (three-life rule of the popular apps) and **Mastermind**. This is a judgement about fit and fame, **not an audited popularity ranking**.

Other fidelity fixes from that edition: the shared clue system was removed; Worldle uses type-ahead search over every country instead of a dropdown of twelve; Waffle is the real 5×5 six-word board with Waffle's own colouring instead of a clued 3×3 square; Wordle and Quordle have the full grid and colour-keyed keyboards; Mathler accepts commutative answers.

## Content and sources

- **Words.** Accepted guesses are the five-letter entries of the ENABLE word list (public domain, via [github.com/dolph/dictionary](https://github.com/dolph/dictionary)), so plurals and inflections are accepted. Answers are 800 hand-picked common words (`lib/games/folio/words.ts`).
- **Countries.** 173 outlines and label points from [Natural Earth 1:110m admin-0](https://github.com/nvkelso/natural-earth-vector) (public domain), built by `scripts/folio-countries.mjs`. Distances are between label points. The four crudest small outlines are guessable but never answers.
- **Authored banks**, each with a generator or checker script and tests: Connections (`groups-data.ts`, 30 puzzles, checked by hand for a single solution), Waffle (`waffle-data.ts`, 58 regular and 16 deluxe boards, `scripts/folio-waffle-bank.mjs`; every scramble's minimum is proven exactly 10 or 20), Sudoku (`sudoku-data.ts`, 60 per tier graded by a human-technique solver, `scripts/folio-sudoku-bank.mjs`, transformed per seed), Nonogram (`nonogram-data.ts`, 34 named pictures, all solvable by line logic alone, `scripts/folio-nonogram-check.mjs`). Minesweeper boards are generated on the first click and retried until a logic solver clears them without guessing. Mathler equations and Mastermind codes are generated from the seed.

## Architecture

- `lib/games/folio/kind.ts` is the contract every game implements on the server: `make` (from level, boss flag and seed), `move` (throw to reject for free; return cost and whether solved), `reveal` (copy the solution into the view at the end) and two test drills, `win` and `lose`. Views are public; secrets never leave the server until reveal. Modules live in `lib/games/folio/kinds/` and are **server only**.
- `lib/games/folio/engine.ts` owns the run: map generation, difficulty, lobby start, puzzle loop, lives, post-boss edits. `server/folio.ts` owns tables, seats, names and commands (atomic SQLite transaction, expected revision, idempotent request IDs, stale-teammate rejection).
- The client shell is `components/game/folio.tsx` (hub, lobby, map, sheet, verdict) and `folio-map.tsx`. Each game's UI is `components/game/folio-kinds/<kind>.tsx`, receiving `KindProps` and rendering inside `.folio-play-area`, a CSS size container, so boards size themselves with `cq` units and never scroll the page.
- **Dev lab:** `/folio/lab?kind=word&level=1&boss=0&seed=7` on the dev server runs any game module in the browser with win/lose step buttons. It is compiled out of production builds.
- **Saves** are `version: 3` (the four-act rules). Runs from earlier unreleased editions (`version: 1` and `2`) are hidden from the list and answer 410 if opened. No database migration was needed; seats and difficulty live in the run state.

## Presentation

Cobalt ink on butter-yellow paper with vermilion accents, matching the box cover. The background plates (`public/art/folio/`) were generated for this edition from written prompts only; prompts, the four candidates and the export script are in `docs/concepts/2026-09-22-folio/background/`. Landscape A and portrait A were chosen for their newsprint-and-crossword mountain faces, which echo the cover. Animations (tile flips, pops, shakes, cascades, reveal flourishes, the marching path on the map, the verdict stamp) are all disabled under reduced motion.

The library box opens Folio's setup in the shared open-box modal (`components/game/folio-box.tsx`): name, seats, starting difficulty, practice list and up to two runs to continue. Starting a run goes to `/folio/<token>`; leaving a run returns to the library. `/folio` remains as a direct page. The cover is `box-folio-blind-v2` (23 September 2026, prompts in `docs/concepts/2026-09-23-folio-relic-covers/`).

## Verification (22 September 2026)

- Repository tests pass, including the engine/server suite (`tests/folio.test.mjs`: map invariants over 300 seeds, difficulty per act, perfect runs to the summit on every difficulty, two-loss defeat with no healing, post-boss edits, lobby/seat locking, per-table names, stale commands, retries, reopen, v1 retirement, HTTP flow) and one suite per game (`tests/folio-<kind>.test.mjs`: every level and boss over 25+ seeds solves within and loses at its allowance, no secret leaks, malformed moves change nothing, content invariants).
- Each game was played in the dev lab at desktop size and 375×667 by the agent that built it. The shell (hub, 2-seat lobby filled by a second guest, auto-start, lock-out of a third, map choice, a lost puzzle, return to the map) was exercised in the in-app browser.
- **Not done:** real-device touch testing, screen-reader passes, human difficulty and pacing tests, multi-browser co-op play of every game.

## Table continuity (26 September 2026)

The table reuses the library setup and saved-run picker. Continue attaches the same saved run; it does not copy or restart it. Existing members stay and the combined membership must fit three seats. Practice and finished runs cannot be attached. The game keeps a live connection to its originating table: Menu → Table settings lets the creator return everyone to the lobby or close the table, while the run stays saved. Keyboard drafts are unchanged. Folio's background stays fixed instead of breathing in and out.
