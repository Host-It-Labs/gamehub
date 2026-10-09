# Rota town life: second-pass source brief

8 October 2026. Large visual correction, grounded in Claude's real-GPU first
review. Inspected all six supplied PNGs in `work/rota-life/review1/`:
`p1-r1-9000`, `p1-r4-9000`, `p1-final-9000`, `p1-phone-10000`, `b1` and `b3`.
Round 2 and round 5 retain warm brick, grey slate and clear routes. At dusk 1
the roofs and streets become blue/purple, narrow hard shadow stripes dominate
the yards, cars lack warm road light, gas lanterns are tiny points, people
disappear into the pavement and the broad rear courts are largely empty.

Preserve the existing grade through dusk 0.55. Later, move to a desaturated
cool sky with warm grey ground fill and brighter colour-faithful midtones.
Keep brick, slate, setts and grass recognisable as their own materials. Retain
the three-tone ramp, exposure and crisp ink, red loose ends and target colours.
The sun stays above 20 degrees and contributes much less at the finish; its
shadow intensity fades with it. Avoid long evening stripes rather than using
darkness to hide them.

Keep the successful windows, fanlights, beacons, train arrangements, washing,
smoke and crossing behavior. Street vehicles get warm head lamps, red rear
lamps and a small road-ahead pool. Outer train ends carry white/red signals
according to travel direction; coupling ends do not illuminate the wagons.
Gas lanterns gain warm pavement pools and a restrained soft head halo.
Lighting uses shared materials and additive instanced decals, never real
point lights or broad new postprocessing passes.

Residents retain their authored anatomy and planted walk, with the requested
1.3x scale for this fixed camera, lighter wool/macintosh colours, a few scarf
accents and a tiny contact shadow. Prioritise dry near ring/frontage routes in
every quality tier and include the larger companions in crossing clearance.
Rear courts gain low brick boundaries, copings, privies, coal stores and more
washing, with alley openings and daylight over the walls. Rail decks show
individual weathered planks, white paint and red discs clearly at play size.

No camera, DOM projection, taps, gameplay, traffic simulation, assets, server
or UI changes. All new fittings remain off the site; only growing-town and
existing traffic lighting accompany their on-board objects. Preserve still
behavior and tier budgets. No temporary objects in the added frame loops.
Claude owns the next actual render; this pass does not launch a server.

## Implemented second pass

1. The original grade remains exact through dusk 0.55. A late smoothstep then
   moves sky fill, haze and ground fill toward neutral cool grey and warm grey.
   Slate and cobble shaders preserve more of their material hue; late surface
   and ground lighting floors raise the midtones without changing targets,
   route geometry or the red loose-end logic.
2. Sun elevation stays above 26 degrees. Late direct illumination fades to
   0.38, hemisphere fill reaches 2.35, and shadow strength falls to 0.16. The
   shadow radius moves from 1 to 3; the existing shadow tier remains in charge.
3. `Traffic.setDusk()` controls shared warm headlight and red tail materials on
   the existing vehicle lenses. External engine ends use physical car order,
   `pushed` and `Spec.flip` to select leading white and trailing red lights.
   Coupling-side lamps remain dark. One instanced additive batch paints short
   warm road beams, with simpler falloff on low quality. Wheel motion,
   top-and-tail orientation and warm-up fast-forward retain their behavior.
4. Existing old-town and growing gas lamps get stronger 0.34-unit soft warm
   pavement pools and 0.052-unit camera-facing halos at the actual lamp heads.
   Both stagger their dusk fade; the extra head-halo batch hides on low quality.
5. Residents and companions use the requested 1.3 presentation scale, with
   lighter cream, grey and sage coats, red/green scarf accents, and one soft
   contact-shadow batch. Eight of the first ten residents are distributed on
   four new paved frontage walks 0.20 units outside the site, visible inside
   the phone's existing crop. Real door approaches and clipped exit corridors
   govern the paths; the original ring and outer walks remain available.
   Unprotected path ends and door approaches reserve a 0.10-unit turn margin
   for the enlarged pram's 0.0897-unit envelope. Protected crossings retain
   their original admission and walking behavior.
6. Rail decks now show separate weathered timber boards, dark end grain,
   fasteners and jointed sett borders. Existing barriers gain white frames and
   round red discs. Rail flange gaps, walking height profiles, warnings,
   occupancy and gate transforms keep their existing contracts.
7. The nearest actual opposed terrace backs define up to 300 bounded domestic
   plots per map. Merged capped brick walls, gates, slate-roofed privies with
   recessed doors, coal bunkers and stone paths divide the rear strips. Up to
   44 washing lines reduce to 28/14 at balanced/low while the plot structure
   stays intact. Details follow measured house footprints rather than filling
   unrelated ground with guessed yards.

## Lighting values and cost

| Property             | Dusk 0    | Dusk 0.5  | Dusk 1    |
| -------------------- | --------- | --------- | --------- |
| Sun colour           | `#ffdcaa` | `#ffc68b` | `#ffd0a1` |
| Sun height / reach   | 0.95      | 0.625     | 0.52      |
| Sun intensity        | 2.5       | 1.85      | 0.38      |
| Sky colour           | `#e9e2d4` | `#ccd4dc` | `#d6dcdf` |
| Ground fill          | `#8f8272` | `#948d84` | `#b7ad9e` |
| Hemisphere intensity | 1.5       | 1.7       | 2.35      |
| Shadow strength      | 1         | 1         | 0.16      |
| Haze                 | `#e4d6bd` | `#a0a8ad` | `#89959d` |
| Background           | `#e4d6bd` | `#969ca4` | `#5f6f7d` |

The 2.2-second dusk transition, exposure 1, three-tone ramp, individual window
schedules and existing ink glow remain. Vehicle lamps fade from 0.12 to 0.48;
gas-lamp heads/pools are effectively on by about 0.5. The late correction is
`smoothstep(0.55, 1, dusk)`, with colour interpolation in Three's linear space.

The added loops reuse persistent matrices and uniforms. Vehicle beams add one
instanced quad batch and at most 256 transforms (normally a few dozen); a
28-pool Node probe measured about 0.004 ms. Lamp halos, yard geometry and
material corrections add no per-frame CPU loops. Residents retain the
28/18/10 count and 60/30/20 Hz drawing cadence; the revised high-tier Node
probe measured about 0.08–0.10 ms. Their geometry uses 18 instanced batches
plus one static flag-strip batch. Yards use eight batches and about 72–74k
triangles across actual map layouts, crossings ten and about 22–35k. These
figures describe source/CPU cost, not browser frame time or phone GPU cost.
No real vehicle/lamp lights, extra render targets or new raster/GLB assets.

## Validation and next render

Passed on the final runtime tree:

- `node --test tests/rota-growth.test.mjs tests/rota-routes.test.mjs tests/rota-quality.test.mjs tests/rota.test.mjs tests/rota-town-life.test.mjs`: **54/54**.
- `node --test tests/rota-people.test.mjs tests/rota-neighbourhood.test.mjs tests/rota-vehicle-lights.test.mjs tests/rota-yard-details.test.mjs`: **24/24**.
- `npx tsc --noEmit -p .`: clean, exit 0.
- Scoped `npx oxlint` on all fourteen changed runtime files and four changed/new test files: clean.
- `npx oxfmt` only this pass's files; scoped `git diff --check`: clean.

The tests check late-only grade timing, sun elevation and shadow/fill fades,
shared fog-aware lighting and material ownership, real vehicle fittings and
reversed train lights, bridge slopes, warm-up and wheels, planted scaled
residents, all-tier near-path coverage, enlarged companion turn/crossing
clearance, yard footprint bounds, washing budgets and open rail flange gaps.

The supplied first-pass screenshots were inspected; no server was started.
The new grade and geometry have not been rendered in this sandbox. Claude's
next desktop/phone dusk 0/0.5/1 render must judge material hue, route/mark/grass
readability, lamp and vehicle glow, shadow softness, resident visibility and
rear-yard density. Motion review must check train direction lights and prams
near turns; GPU shader compilation and physical-phone smoothness remain
unverified here.

Detailed subsystem evidence: [residents](people-pass2.md),
[vehicle lights](vehicle-pass2.md), [yards and crossings](yards-pass2.md).
