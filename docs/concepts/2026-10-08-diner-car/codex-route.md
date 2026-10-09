# Codex job B — the route map

You are rebuilding Diner's campaign **route map** as part of the 3D overhaul.
Codex job A builds the diner car and the places at the same time; Claude
builds the run logic and all the DOM around your scene. Read these first:

1. `/Users/williamguinaudie/.codex/skills/high-fidelity-3d/SKILL.md` —
   mandatory (AGENTS.md). Follow it: brief, forms first, materials, motion,
   honest review renders, then optimise.
2. `docs/concepts/2026-10-08-diner-car/brief.md` — the design ("The world",
   "The run").
3. `components/game/diner/route-contract.ts` — the API you implement
   (`CreateRouteWorld`, exported as `createRouteWorld` from
   `campaign-world.ts`).
4. `lib/games/diner/road.ts` — the run's road: three legs, each columns of
   2, 3, 3, 2 forks and a boss, connected by `next`; stop kinds (shift, boss,
   garage, motel), places, rewards, busy pips, gas. `makeRoad(seed)` builds a
   sample map. A run's map is different every run.
5. Codex job A's brief, `docs/concepts/2026-10-08-diner-car/codex-stage.md`:
   it delivers `buildDinerCar`/`buildTruck` in `diner-car.ts` and
   `buildPlace(materials, place, { detail: 'map' })` / `buildMapStop` in
   `places.ts`. Use them for the car and the stop vignettes; until they exist,
   build against the documented signatures with your own temporary stand-ins
   inside your files, and switch when job A's exports land (check the files
   periodically). Do not edit job A's files.
6. Precedent only (it is being replaced): the current
   `campaign-world-models.ts` and `campaign-world.ts`, and the screenshot
   `docs/concepts/2026-10-04-diner-fidelity/review/campaign-route-1280x720-final.png`.

## What William said

"The 3D world doesn't make sense: these diners seem to just be placed next to
each other … it's not very well stylised, it doesn't feel very lively." He
approved: the diner is one chrome diner car towed by a truck down a highway
through the night, stopping at places.

## The scene

- **One continuous night landscape** that a highway crosses from left to right
  (or along a gentle S-curve) in three regions: **desert** (leg 1: mesas,
  cacti, a railway, telegraph poles), **coast** (leg 2: a bay, a pier town,
  hills, a lighthouse headland), **the Moon Mile** (leg 3: violet dunes, radio
  telescopes, a huge moon low over the horizon). The regions blend into each
  other; no islands floating in a void, no repeated tiles.
- **The road network follows the run's graph.** Each column of a leg is a
  junction where the highway forks into 2–3 roads, each to one stop; roads
  rejoin toward the next column as the graph's `next` edges say; every leg
  narrows to its boss. Place the nodes procedurally from `(leg, col, lane)` so
  any generated map draws correctly; overtime legs (index ≥ 3) reuse the
  third region (loop the car back to the start of the Moon Mile, or extend it
  — your call, but keep it continuous).
- **Every stop is a small vignette** of its place (`buildPlace(.., 'map')`)
  or Garage/Motel (`buildMapStop`), sitting beside its road with a lay-by.
  Bosses get a larger, unmistakable set piece (a bus depot for Last Bus, a
  floodlit grand hotel or theatre for The Critic, a giant moon-dish
  observatory for Midnight Feast).
- **The car** (truck + diner car) is parked at `state.at`, or at the start of
  the road. When `at` changes it drives there along the roads (2–3 s, eased,
  wheels turning, headlights on, a dust or exhaust trail), then the camera
  settles on the new choices.
- **State on the map**: driven roads glow warm; the roads to `state.choices`
  are lit and their stops pulse gently; stops beyond are present but quieter
  (night-dimmed, no labels); visited stops show the car already left (lights
  out, a closed sign). Labels and fork cards are DOM (Claude): give accurate
  `anchor()` points above each stop's landmark.
- **Alive**, everywhere, cheaply: traffic with headlights and tail lights on
  the highway, a freight train in the desert, the Ferris wheel turning, the
  lighthouse beam sweeping, boats bobbing, blinking neon, drifting clouds and
  their shadows, twinkling stars, an occasional shooting star, water shimmer.
  All motion stops under reduced motion.
- **Stylised, premium**: chunky readable forms with soft bevels, warm bulbs and
  neon blooming against deep indigo, cool moonlight, gentle fog in the
  distance. The diner's cherry/cream/mint/chrome palette belongs to the car;
  each place keeps its own accent (see the brief).

## Camera and interaction

- Orthographic or a long-lens perspective, ¾ view from the south, slightly
  tilted; `view('leg')` frames the car and its current choices inside
  `options.safeArea()` (the DOM panel covers the rest: on phones the bottom
  ~40%, on wide screens the right ~32%); `view('night')` frames the whole
  road. Drag pans along the road (clamped), the wheel/pinch and `zoomBy`
  zoom within limits. Tapping a stop in `state.choices` calls `onPick(id)`.
- Portrait phones (390×844) and wide desktops (1280×720, 1920×1080) must both
  look composed, with no empty void at any edge.

## Files

You own and may rewrite: `components/game/diner/campaign-world.ts`,
`components/game/diner/campaign-world-models.ts`, and any new
`components/game/diner/route-*.ts` scene modules you create (except
`route-contract.ts`, which is Claude's: propose changes in your report).
Review artefacts go in `docs/concepts/2026-10-08-diner-car/route/`.

Do not edit anything else: not `diner-road-map.tsx`, `diner-campaign.tsx`,
`diner-lab.tsx`, CSS, `lib/`, job A's `diner-car.ts`/`places.ts`/`stage.ts`.
Claude will replace the old `createCampaignWorld` callers; you may drop that
export once `createRouteWorld` works.

## Checking your work

`/diner/lab?scene=route&seed=7&path=0-0-1,0-1-1` (dev server at
http://localhost:3017, already running; do not start another on that port)
mounts `createRouteWorld` with a generated map; `&view=night` shows the whole
road; `window.dinerLab` exposes `{ world, map }`. Drive it with headless
Chrome (`--enable-gpu --use-angle=metal`, a private debugging port) at
390×844, 1280×720 and 1920×1080.

## Constraints

- Budget: ≤ 220 draw calls and ≤ 600k triangles on desktop at the night view;
  instance repeated props (trees, cacti, poles, traffic); procedural textures
  ≤ 1024²; render at ≤ 30 fps when only ambience moves; stop rendering when
  the page is hidden; pause motion under reduced motion.
- Deterministic scene from the map seed (seeded helpers; no `Math.random()`).
- `dispose()` frees everything. TypeScript strict. Format only your own files
  with `npx oxfmt <paths>` (never `npm run format`).
- Other Claude sessions edit unrelated parts of this repository: never
  `git stash`, `git checkout --`, reset, commit or push.

## Review evidence (required)

Leave in `docs/concepts/2026-10-08-diner-car/route/review/`: the night view and
leg views at the three sizes for two different seeds; a drive captured as a
contact sheet; a reduced-motion still; draw calls/triangles. Write
`notes.md`: your brief, what you inspected, what you fixed, what is still weak.
