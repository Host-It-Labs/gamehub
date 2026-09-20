# Roka, Talo and Soma

Implemented as replacement games under the stable internal IDs `orin`, `vela`, and `miro`. Old prototype saves are rejected via `rules: 2`; old prototype engine/component files remain unreferenced historical material. No extensions are available for these games.

## What ships

- Roka: 2–4 cooperative seats, two actions per turn, visible eruption forecast, cargo capacity, rescue/delivery, protection and towing. The target scales 8/10/11 with crew size. The rescue ends after ten watches; all boats must return.
- Talo: four seats, alternating Blue/Red teams, simultaneous reusable actions, contested pickup priority that rotates, gates, raids/guarding, passes and deliveries. A shared thirteen-point relic pool and seven-point victory threshold avoid final ties. The three-point crown unlocks in round five.
- Soma: 4–6 seats, one private saboteur, simultaneous move/work decisions, room repairs, supplies, guarding, forensic inspections and five sabotage charges. Four rooms are needed; each requires 3/4/5 repairs with 4/5/6 players. Starting integrity is 14/12/11. The crew has fourteen watches. All players stay in the game.

Everyone can communicate freely. These rules do not require a private team voice channel. No new voice service is added.

## Architecture and privacy

`lib/games/adventures` owns the deterministic rules, legal moves, bots, lessons, source art geometry and material sound effects. `standalone/registry.ts` adapts the games to solo persistence and server tables. The server validates seat, match, phase, allowed move and decision key. Requests are idempotent. Simultaneous submissions accept an older table revision only while the same decision is active.

Observations hide other players' commitments, RNG state, unrevealed roles, sabotage reserves and uninspected evidence. The last-action field is also masked until resolution. Bots receive their own filtered observations. End-game roles are revealed for explanation.

The existing invite, guest, lobby, configuration, SSE, reconnect and bot scheduling paths now support all three adventures. Public catalog entries use the new names/art. Shared tutorial clocks move only bots; humans retain their own decisions.

## Tutorials

All six games now use isolated practice state. Solo practice does not overwrite a saved match and does not resume as a real save. Bot/autoplay clocks wait for Advance time. Back/Next explain the game while players can experiment. Finishing or skipping starts a newly seeded game with scores and decisions cleared. Adventure lessons additionally supply contextual reset states. Shared practice uses a new match ID when the real match begins.

## Artwork and audio

Six fresh source plates and three transparent tokens are preserved with their exact prompts in this directory. Runtime uses optimized WebP copies. Landscape/portrait camera fitting reuses `frameScene` and `WorldScene`, using measured source locations and complete landmark bounds; docks do not change the scene. Portrait Soma transposes the graph so room adjacencies stay valid. Fullscreen remains optional and user-triggered; reduced motion disables motion.

Each game has two original synthesized stereo ambient beds and three sparse accents, layered by the existing randomized crossfade player. Material-specific action cues are synthesized at runtime. See `audio.md`; no old world's soundscape is reused.

## Validation (2026-09-20)

- Full suite: 533 tests passing, including all-human/mixed bot server games, stale simultaneous commands, rejected duplicates, private views, live HTTP/SSE and fresh tutorial starts.
- Production build, TypeScript and lint pass.
- Complete-landmark geometry checks cover desktop, portrait phones, short landscape phones, tablets and fractional zoom-sized viewports.
- 1,750 deterministic hard-bot simulations, 250 per supported game/seat-count combination: no stalled games. Roka wins: 64.4% / 70.8% / 79.6% at 2/3/4 seats. Talo Blue wins 57.2%, Red42.8%, no ties. Soma crew wins54.0% /47.2% /41.6% at4/5/6 seats. Reproduce with `node --experimental-strip-types scripts/benchmark-adventures.mjs`.

These simulations test the implemented heuristics and catch gross imbalances. They do not establish human balance, enjoyment or intended game duration. Browser, touch, screen-reader and audible device acceptance were not performed. The source plates and tokens were visually inspected; runtime browser rendering was not.
