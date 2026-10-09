# Codex — read-only code review of Claude's half (9 October 2026)

Review for **correctness bugs** (crashes, wrong rules, broken saves, desyncs,
stale state, resource leaks, accessibility regressions), then simplification
opportunities. Read-only: do not edit any file; report findings with file,
line, a concrete failing scenario and a suggested fix, most severe first.

Context: `docs/concepts/2026-10-08-diner-car/brief.md` and `docs/diner.md`.

Files to review (other changes in the working tree belong to other work):

- Rules: `lib/games/diner/engine.ts` (hands, `actionFor` give/take/start
  priority, `mayStart` demand rule, pass, coffee, jukebox, dash, lanes,
  validation `isMatch`/`isDinerConfig`), `lib/games/diner/road.ts`,
  `lib/games/diner/campaign.ts`, `lib/games/diner/campaign-content.ts`,
  `lib/games/diner/room.ts` (online wire: hands, lead, dash flag),
  `lib/games/diner/art.ts`.
- Client: `components/game/diner/diner-store.ts`, `diner-campaign.tsx`,
  `diner-road-map.tsx`, `diner-equipment.tsx`, `diner-game.tsx`, `view.ts`,
  `stations.ts`, `food.ts`, `lighting.ts`, `session.ts`, `online.ts`,
  `icons.tsx`, `upgrades-shown.ts`, `diner-lab.tsx`, `diner-rules.tsx`,
  `sound.ts`.
- Tests: `tests/diner*.test.mjs`.

Things worth checking in particular: online prediction with the new player
fields; save validation accepting every reachable run state and rejecting
broken ones; settlement paying once; the drive delay before a shift opens;
the 3D view not being rebuilt on unrelated re-renders; disposal of
everything the view now creates (composer, bloom, counter, stage, rig,
pass props); co-op claims in the bot.
