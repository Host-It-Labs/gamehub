# Codex job A — the diner car and the shift stage

You are building the **places** half of Diner's 3D overhaul. Claude builds the
other half (machines on the counter, food, people, effects, lighting, camera,
all UI) at the same time in the same working tree. Read these first:

1. `/Users/williamguinaudie/.codex/skills/high-fidelity-3d/SKILL.md` —
   mandatory for this job (AGENTS.md). Follow it: brief, clay forms first,
   materials, motion, honest review renders, then optimise.
2. `docs/concepts/2026-10-08-diner-car/brief.md` — the design. The world
   section is your target.
3. `components/game/diner/stage-contract.ts` — the interface you implement.
4. `lib/games/diner/layout.ts` — gameplay geometry you must respect (counter
   spots `COUNTER_X`, `COUNTER_Z`, `TABLES` with `BOOTH_HX`/`boothHz`,
   `QUEUE`, `DOOR_GAP`/`DOOR_IN`/`DOOR_OUT`, `JUKEBOX`, `W`, `D`, `FRONT_Z`).
5. For style and technique precedent only: `components/game/diner/kit.ts`,
   `materials.ts`, `interior-furniture.ts`, `roadside.ts`, the room half of
   `models.ts` (`buildShell`), and `docs/diner.md` "Look". Everything is
   modelled in TypeScript with three.js (no GLB files, no Blender sources in
   the runtime); keep that approach.

## What William said

The graphics feel low quality; the route map's diners "seem just placed next
to each other", nothing is stylised or alive. He approved: **your diner is a
chrome 1950s diner car towed down a highway at night**. At each stop it parks
and opens its long side onto a patio where the shift is played, and the place
around it changes from stop to stop.

## Deliverables (you own these files; create them)

1. `components/game/diner/diner-car.ts`
   - `buildDinerCar(materials, { detail: 'stage' | 'map', upgrades })` → the
     streamlined diner car: rounded chrome ends, cherry enamel stripe, a row
     of warm windows, rooftop neon DINER sign, a swing-up awning along the
     long side, wheels/skirting, steps, small details that sell it (rivets,
     vents, chrome trim, lamps). `detail: 'stage'` is the opened-up version
     used behind the counter (awning up, side open); `'map'` is closed and
     small on the route map.
   - `buildTruck(materials, { detail })` → a rounded 1950s cab-over truck in
     cream and mint that tows the car (hitch, headlights that can glow,
     grille, mirrors, mudflaps).
   - Workshop upgrades show on the car/truck (`CarUpgrades` in the contract):
     spare tires on the truck, a brighter/larger neon sign, the jukebox, a
     wider patio. Keep every variant tasteful; the plain car must already look
     finished.
   - Build the car FIRST and commit nothing (see "Working tree"); the route
     map job (Codex job B) imports it from this file. Export a stable API as
     soon as the first version renders, then refine.

2. `components/game/diner/places.ts`
   - `buildPlace(materials, place: PlaceId, { detail: 'stage' | 'map' })` for
     the six places in `lib/games/diner/road.ts` (`truckstop`, `drivein`,
     `fairground`, `harbour`, `oldtown`, `moonmile`), plus
     `buildMapStop(materials, kind: 'garage' | 'motel')` for the map only.
   - Stage scale: the scenery that surrounds the patio and rises behind the
     car (see the table in the brief: pumps and trailers and a pole sign; a
     glowing movie screen and parked cars; Ferris wheel and carousel; pier,
     water, lighthouse, boats; brick shopfronts and clock tower; desert,
     mesas, radio dish, rocket sign). Each returns `{ group, update(cues),
     dispose }` with its own living motion (wheel turns, beam sweeps, screen
     flickers, boats bob, signs blink, a few distant figures or cars move).
   - Map scale: small vignettes of the same places that read at a glance from
     the route map's camera (one strong landmark silhouette each).

3. `components/game/diner/stage.ts` — export `buildStage` (type `BuildStage`
   in the contract). It assembles, for one shift:
   - the car seen from its open side: the counter (worktop at
     `STAGE.counterTop`, front face at `COUNTER_Z`), the car's interior back
     wall above the counter (windows onto the place behind, shelves, menu
     board, the fridge somewhere that does not block a counter spot), the
     raised awning and roof with the DINER sign;
   - the patio inside the play rectangle `x 0..W, z COUNTER_Z..FRONT_Z`: a
     chequered deck (cherry and cream stays the diner's signature; it must
     stay calm enough that guests, plates and puddles read on a phone), the
     booths at `TABLES` (open slots only; seats and table tops at
     `STAGE.seatTop`/`STAGE.tableTop`), a low rail along the left, right and
     front edges with the entrance gap at `DOOR_GAP` on the left (a host stand
     and a swinging gate there, animated by `cues.gate`), the jukebox at
     `JUKEBOX`, planters, string lights on poles (kept high and to the edges:
     they must never hide a guest or a bubble);
   - the place around it via `buildPlace(..., 'stage')`, continuous to every
     edge of the widest and tallest screens (the camera is orthographic, front
     view tilted 36–52°; portrait phones show a lot above the car, wide
     screens show the sides);
   - `update(cues)`: brownouts dim/flicker all lights (`cues.power`), rush
     pulses signs, gate swing, jukebox glow, the place's motion; everything
     still under `cues.reduced`.
   - `landmarks`: points the camera must keep (the roof sign's top, the
     awning's ends).

## Do NOT build (Claude owns these)

The machines and fixtures on the counter (grill, fryer, shake machine, pie
case, sink, bin, heat-lamp pass, coffee urn): leave every counter spot in
`COUNTER_X` free from `STAGE.counterTop` up to `STAGE.machineCeiling`, across
the spot's width (`SPOT_HALF` each side) and the worktop's depth. Also not:
food, plates, coins, guests, waiters, the goo mimic, particles, the global
lights, camera, bloom/post-processing, DOM. Do not edit `view.ts`,
`framing.ts`, `models.ts`, `kit.ts`, `materials.ts`, `fx.ts`, `people*.ts`,
any `.tsx`/`.css`, or anything under `lib/`. If you need a contract change,
write it at the end of your report instead of editing the contract.

## Constraints

- Lights: the view owns the sun (the only shadow caster), hemisphere fill and
  bloom. Your stage may add at most 4 point/spot lights without shadows; use
  emissive materials for bulbs, neon, windows and screens (they will bloom).
- Budget on the shift screen (it also draws guests and effects at 60 fps on
  phones): `quality: 'high'` ≤ 140 draw calls and ≤ 450k triangles for the
  whole stage including the place; `'low'` ≤ 70 draw calls and ≤ 180k
  triangles. Merge static geometry per material (see `Kit`), instance
  repeats. Procedural textures ≤ 1024², created once and disposed.
- Gameplay readability first: the deck, booths and rail are calm and clear;
  the spectacle lives in the car, the sign and the place around.
- `dispose()` frees every geometry, material and texture you create.
- Deterministic: no `Math.random()` at build time (seeded helpers only).
- TypeScript strict; match the surrounding code style; format only your own
  files with `npx oxfmt <paths>` (never `npm run format`).

## Working tree

Other Claude sessions edit unrelated parts of this repository concurrently.
Never `git stash`, `git checkout --`, reset, commit or push. Only create and
edit the files listed above, plus review artefacts under
`docs/concepts/2026-10-08-diner-car/stage/` (renders, scripts, notes).

## Review evidence (required)

Before you call it done, render and inspect, and leave the images in
`docs/concepts/2026-10-08-diner-car/stage/review/`:

- the car and truck: clay front/side/rear/three-quarter and colour, at stage
  and map detail;
- each of the six places at stage scale behind the opened car, in colour, from
  the game's camera (front view, ~44° tilt) at 390×844 and 1280×720 framing,
  with the patio and booths;
- one short motion capture or contact sheet showing the living motion;
- draw calls/triangles for each place at both qualities.

The 10-04 fidelity pass rendered reviews with a Node exporter plus Blender
(`docs/concepts/2026-10-04-diner-fidelity/interior/export-review.mjs`,
`render-review.py`) and headless Chrome; reuse either approach. Write
`docs/concepts/2026-10-08-diner-car/stage/notes.md`: your brief per asset,
what you inspected, what you fixed, what is still weak.

Claude will integrate `buildStage` into `view.ts` and review your renders in
the running game; expect concrete visual feedback.
