# Codex job C — balance the night route

Diner's campaign was rebuilt as a roguelite on 8 October 2026 (read
`docs/concepts/2026-10-08-diner-car/brief.md`, "The run", and `docs/diner.md`,
"Campaign"). The rules are in `lib/games/diner/engine.ts` (shift simulation),
`lib/games/diner/campaign.ts` (run, `shiftConfig` difficulty curve,
settlement, Garage, Motel, Workshop), `lib/games/diner/campaign-content.ts`
(equipment, Workshop upgrades and prices) and `lib/games/diner/road.ts`
(forks, rewards, `gasFor`). `lib/games/diner/bot.ts` is a greedy waiter.

## Goals

1. **Make the bot a fair stand-in for a good player** with the new tools:
   two (or three) hands, the heat-lamp pass, the coffee urn (pour for a
   waiting party below 65% patience), the jukebox (play it when several
   parties are low), Dash (when the walk is long). It must still spot
   mimics only by outfits, never by peeking. Keep `botInput`/`playShift`
   signatures; tests in `tests/diner*.test.mjs` must keep passing.
2. **Write a run simulator** `scripts/diner/balance.mjs`: plays whole runs
   (forks chosen by a simple policy: prefer gear/rare when healthy, Motel or
   life when hurt, Garage when it can afford something), with a `pause`
   parameter (ticks between actions: 20 ≈ a sharp player, 36 ≈ a careful
   newcomer) and Workshop ranks, many seeds, reporting the distribution of
   stops reached, lives lost per stop, wallet, tokens per run, which forks
   and equipment were taken.
3. **Tune the numbers** (only numeric constants in `shiftConfig`, `gasFor`,
   `GEAR_PRICE`, `patchPrice`, `UPGRADES` costs, token formula in
   `settleShift`) to hit, over at least 40 seeds each:
   - careful newcomer (pause 36), no upgrades: median death at stop 4–6;
   - sharp player (pause 20), no upgrades: about half reach the leg-2 boss
     (stop 10); few beat the night;
   - sharp player with the full Workshop: at least half beat the third boss;
   - a newcomer's first run earns enough tokens for the cheapest upgrade;
     maxing the Workshop takes about 20–30 runs for a sharp player;
   - gas matters: a run that skips medals must feel the wallet by leg 2;
   - every place and every boss is survivable and none is a free pass
     (report per-place lives lost).
4. Keep the shape of the rules (no new mechanics), keep it deterministic.

## Constraints

- Only edit `lib/games/diner/bot.ts`, numeric constants in the files named
  above, `scripts/diner/balance.mjs`, and files under
  `docs/concepts/2026-10-08-diner-car/balance/`. Do not touch any 3D,
  `components/`, CSS or the engine's rules (if a rule seems wrong, say so in
  your report instead).
- Other sessions share this working tree: never `git stash`, checkout,
  reset, commit or push. Format only your files with `npx oxfmt <paths>`.
- Run `node --experimental-strip-types --test tests/diner*.test.mjs` before
  finishing; all must pass.
- Write `docs/concepts/2026-10-08-diner-car/balance/report.md`: the bot
  changes, the simulation method, before/after tables, the final numbers,
  and anything that still looks off.
