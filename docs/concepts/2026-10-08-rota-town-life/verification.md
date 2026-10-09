# Rota town life: implementation and handoff

First-pass record. The subsequent Claude screenshot review and implemented
corrections are recorded in [second-pass.md](second-pass.md); use that handoff
for the current lighting, resident and yard budgets.

8 October 2026. Large scene change. Implemented against the high-fidelity-3d
skill, the mill-town brief and the specified Rota DESIGN sections. No local
server, browser, screenshots or WebGL rendering were used, as requested.
The procedural source brief is [brief.md](brief.md). Visual acceptance belongs
to Claude's desktop/phone render review and the subsequent feedback pass.

## What changed

| Files                                                               | Implementation                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `three/people.ts`, `lib/games/rota/people.ts`                       | Authored, instanced residents with fitted coats, flat caps, headscarves, a child, a terrier and leash, and a sprung coach pram. Adults are 0.068–0.074 units tall. Connected limbs, planted stance, bending knees, weight transfer, counter-swinging arms and pram handle contact. Persistent walk/pause/turn/enter/inside/exit/kerb state; companions follow the same crossing height profile. |
| `lib/games/rota/neighbourhood.ts`                                   | Shared physical back-lane constants; terrain-aware pavement paths, real terrace door points, lamp placements, road/rail crossing sites, height profiles and conservative traffic clearance. Pure planning and safety logic.                                                                                                                                                                     |
| `three/crossings.ts`                                                | Cream zebra stripes, black/white Belisha poles and flashing amber globes. Rail crossings have timber decks with railhead/flange gaps, ramps, white/red lifting gates, iron posts and paired hooded red signals. Merged fixed fittings; instanced gates and lenses.                                                                                                                              |
| `three/world.ts`                                                    | Attaches residents, crossings, lamps and yard life outside the board. Reads existing mover poses without mutating the simulation. Drives dusk, quality and disposal. Adds household chimney smoke. Preserves the existing camera, projection and tap targets.                                                                                                                                   |
| `three/window-lights.ts`, `three/materials.ts`                      | Finds connected openings in decoded model geometry once; keeps real glazing, frames and mullions. Individual GPU lighting schedules, amber interiors, gathered curtains and fanlights. Applies to old town and growing buildings. Fixed gas lamps stagger their dusk thresholds; moving headlights use a stable threshold.                                                                      |
| `three/scenery.ts`                                                  | Procedural terraces gain sandstone surrounds/sills, sash bars, painted doors, separate fanlights and individually lit panes in five merged meshes. Door locations match the walk planner.                                                                                                                                                                                                       |
| `three/lanterns.ts`, `three/growth.ts`                              | Instanced warm pavement pools for old-town and growing lamps. Growing chimneys gain smoke. Building-rise updates compact the persistent list in place.                                                                                                                                                                                                                                          |
| `lib/games/rota/daylight.ts`, `three/ground.ts`                     | A retargetable 2.2-second dusk transition, three palette anchors, bright blue-hour ground and surface lighting floors, and cooler water. Ground, route geometry and gameplay highlight logic retain their existing positions.                                                                                                                                                                   |
| `three/ink.ts`                                                      | A short warm-emissive halo inside the existing ink pass, with no added render target or postprocessing pass. Crisp ink and gameplay marks retain their existing treatment.                                                                                                                                                                                                                      |
| `three/town-life.ts`, `three/smoke.ts`, `lib/games/rota/quality.ts` | Up to 18 yard washing lines, restrained GPU cloth motion, 8/5/0 tiny birds and cooler fog-aware smoke. Ambient budgets adapt with the existing renderer tiers.                                                                                                                                                                                                                                  |

`three/` above means `components/game/rota/three/`. New tests are
`tests/rota-{neighbourhood,people,town-life}.test.mjs`.

The protected traffic, asset, board/table UI, CSS, loading, GLB, manifest,
Docker-ignore and traffic-test files were not edited by this task. Existing
shared-tree changes remain in place, including the pre-existing `BoardView.dusk`
field. No new GLB or raster assets, UI text, ports or dev servers were added.

## Placement and crossing choice

The primary walk follows the inner pavement of the old-town RING back lane,
1.387 units beyond the site edge: `RING - LANE_HALF - 0.018`. Additional walks
follow up to four nearby residential row fronts, within 3.4 units of the site.
The planner samples terrain and rejects housing footprints, water, off-site
rivers and tunnel mounds. Side walks stop before unprotected junctions.
Residents distribute across the available paths by length and deterministic
seeds. They visit real facade doors, rather than vanishing at arbitrary points.
Ordinary pavement feet rest on the existing terrain shader; raised road and
rail approaches use explicit continuous height profiles.

Walking routes never run along player-built streets or exit roads, and remain
outside every board square. They cross exit corridors transversely. Crossing
sites derive from the actual non-pier `exitSegments`: road exits receive zebras,
rail exits receive level crossings. The offline initial-layout probe found
five residential routes per map, 10–16 crossing sites and 19–27 lamps. Actual
dry arcs and reachable door counts depend on the map and off-site river layout.

At 8.3 Hz, the world reads `traffic.sim.movers` and `sim.poses(m)` once per mover,
including every wagon. It expands axle poses to body overhangs, respects pushed
train direction, and uses conservative speed/restart estimates. Rail warnings
start with at most 12 seconds of clearance; road danger blocks admission at
one second. Each walker also needs enough clearance for its entire crossing,
both companion envelopes and 1.5 seconds of margin. New walkers wait behind
the kerb. Admitted walkers finish; gate arms remain raised until they and their
companions clear. Rail signals hold for the rear wagon and a 1.4-second clear
dwell before reopening. Amber beacons alternate at 0.55 seconds, red signal
pairs at 0.43 seconds; gate travel takes about 0.8 seconds.

## Dusk mapping

| Property                  | Dusk 0    | Dusk 0.5  | Dusk 1    |
| ------------------------- | --------- | --------- | --------- |
| Sun colour                | `#ffdcaa` | `#ffc68b` | `#ffb172` |
| Sun intensity             | 2.5       | 1.85      | 1.2       |
| Sun height / reach        | 0.95      | 0.625     | 0.30      |
| Sky fill colour           | `#e9e2d4` | `#ccd4dc` | `#c0d3ee` |
| Ground fill colour        | `#8f8272` | `#948d84` | `#93949e` |
| Hemisphere intensity      | 1.5       | 1.7       | 1.9       |
| Haze colour               | `#e4d6bd` | `#a0a8ad` | `#6d829a` |
| Background                | `#e4d6bd` | `#969ca4` | `#3d5675` |
| Environment intensity     | 0.5       | 0.55      | 0.6       |
| Ghost emissive intensity  | 0.40      | 0.525     | 0.65      |
| Ink halo strength uniform | 0.025     | 0.085     | 0.145     |
| Expected lit panes        | about 2%  | about 37% | about 72% |

Sun X/Z remain `-0.95 * reach` and `-0.45 * reach`; `reach = size * 0.75 + 4`.
Colours interpolate with smoothstep between the three anchors. Changes to the
match value ease from the current hour over 2.2 seconds; repeated view updates
do not restart that fade. The first view, reduced-motion scene and snapshots
use the requested hour immediately.

Exposure remains 1 and the original three-tone ramp stays intact. Sky fill
increases as the sun lowers. Dressed surfaces receive a small colour-preserving
emissive floor (`0.12 * dusk`), and the playable ground gets `0.09 * dusk`.
The grid, targets and red loose-end marks retain their original highlight
logic. This is a deliberately bright early blue hour; its actual visual
readability still needs the requested dusk-1 render review.

Individual window cycles last 38–124 seconds with soft transitions and stable
per-opening/per-building seeds. Fixed lamp lenses brighten at staggered dusk
thresholds; faint fog-aware warm pools rest on the pavement. Crossing lamps
increase from 1.9 to 3.0 strength. The ink halo samples only HDR warm colours
above 1.4, excluding cream stone/chalk and red gameplay marks. It adds eight
colour taps at high, four at balanced and none at low, inside the existing pass.

## Cost and motion budget

| Budget                         | High          | Balanced      | Low           |
| ------------------------------ | ------------- | ------------- | ------------- |
| Visible residents              | 28            | 18            | 10            |
| Resident matrix update rate    | 60 Hz         | 30 Hz         | 20 Hz         |
| Resident drawn triangles       | about 36,814  | about 24,206  | about 14,106  |
| Resident main batches          | 17            | 17            | 17            |
| Resident coat shadow batches   | 3             | 3             | 0             |
| Birds                          | 8             | 5             | 0             |
| Smoke puffs per chimney        | 7             | 5             | 3             |
| Extra full-screen halo samples | 8             | 4             | 0             |
| Resident CPU tick, Node probe  | about 0.11 ms | about 0.07 ms | about 0.05 ms |

The legacy lite option caps visible residents at 20. All 28 resident simulation
states persist so tier changes do not reset activity; the same-direction
pavement queue scan is bounded at 28 squared. Matrices, colours, transforms,
crossing state, occupancy and the 256-body sensor buffer are reused. Resident
matrix buffers total about 33 KB per drawing update. Door/path scans are
bounded by the planned routes. No temporary vectors or arrays are created by
the new frame loops. The existing read-only `poses()` API allocates its own
result arrays only at the sensor cadence.

Crossings use nine main batches at high/balanced and eight at low, with about
15,432–20,576 triangles across the sampled maps. A Node crossing-animation
probe measured about 0.002–0.003 ms per tick. Sensing costs
`crossings * sensed bodies` at 8.3 Hz; its wall time is not included in that
animation figure. Yard fittings/clothes/birds add three main batches, two at
low; lamp pools add one instanced quad batch each for old town and growing town.
Window scheduling, cloth, bird motion and smoke animation run in shaders with
shared time/dusk uniforms. There are no new point lights or bloom buffers.

The CPU figures are local Node measurements of these subsystems, not browser
frame time, GPU time or physical-phone performance. Reduced motion freezes
walking, birds, cloth, smoke, window switching and flashing; requested dusk and
crossing safety still update. Existing quality adaptation remains responsible
for sustained frame-pressure reductions and recovery.

## Verification and remaining review

Passed:

- `node --test tests/rota-growth.test.mjs tests/rota-routes.test.mjs tests/rota-quality.test.mjs tests/rota.test.mjs`: 47/47.
- `node --test tests/rota-town-life.test.mjs tests/rota-people.test.mjs tests/rota-neighbourhood.test.mjs`: 19/19.
- `npx tsc --noEmit -p .`: clean, exit 0.
- Scoped `npx oxlint` for the 16 runtime files and three new test files: clean.
- `npx oxfmt` only the task's files; scoped `git diff --check`: clean.

Tests cover all-map off-board pavement/crossing planning, water cuts, reachable
doors, approach/rear-wagon clearance, admission and gate occupancy, long
resident state runs, scale/foot planting/pram contact, ramp heights, still and
quality behavior, retargetable dusk, real quantized building apertures and
stable moving vehicle lighting. Real current GLBs were read without modifying
them. Shader hooks and geometry were inspected without a GPU.

Claude still needs to render desktop and phone at dusk 0, 0.5 and 1 and inspect
window/lamp emission, haze and ink; every built route, loose-end mark, ghost and
target; silhouettes at actual zoom; full walking/door/crossing/gate cycles;
and performance on the three tiers. Browser shader compilation, artistic
quality, physical touch and phone GPU acceptance have not been verified.
Opposing pedestrians' narrow-pavement passing also needs visual review.
