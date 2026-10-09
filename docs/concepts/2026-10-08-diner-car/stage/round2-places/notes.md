# Places round 2 — source handoff

Only `components/game/diner/places.ts` was changed by this delegated job. The
root job owns the diner, truck, patio and final canonical review set. The
`buildPlace` and `buildMapStop` signatures, landmark contracts, cue handling
and material ownership contract remain unchanged. No contract change is needed.

The mandatory high-fidelity-3d skill, original brief, prior stage notes,
round-2 feedback and all twelve supplied runtime screenshots were read and
inspected before authoring. No Blender, browser session, server, Git mutation
or other source-file edit was performed by this job.

## Environment work

- Truckstop now has authored cracked asphalt, parking stripes, kerbs, drain,
  oil stains and puddles; a window-lit service hall with roof vents and steam;
  more ribbed trailers, tyre stacks, crates and a pump island clear of the
  hitch. Its upper highway and foreground access road carry moving cars.
  Walkers, a cook in an apron/toque and flying birds inhabit the district.
- Drive-in has continuous gravel and speaker-post rows, 28 added middle/far
  cars and three foreground cars, plus the six original cars. Sedans have
  shaped window and roof panels and occupied side/front windscreens. A lit
  concession hall and projection kiosk relate the rows to the screen.
  Screen colour is cyan `#82bdcc` at 2.5 gain, with the existing film graphic
  and restrained flicker preserved.
- Fairground has connected timber midway approaches, eight striped stalls,
  a foreground ticket booth, supported flutter flags and cable pennants,
  families with smaller children and a small dachshund. A low figure-eight
  coaster supplies structured upper-band rails/supports; the existing Ferris
  wheel, upright cabins and carousel remain the main animated landmarks.
- Harbour has continuous textured rippling water with animated moon-glitter,
  a broad plank apron and side piers, bollards/ropes/nets/cargo, four outer
  moored boats and two nearer upper-band boats in addition to the three
  bobbing boats. Sheds and a rocky headland form the upper composition.
  Sheds on the raised headland have retaining plinths; pier walkers and bench
  sit at the common plank-top datum −0.045 m, headland walkers at 0.83 m.
  The rear lamps/pools at z −7.8 sit on the side strips x −7.3/17.4; their
  plinth bottoms touch the same −0.045 m plank top. Other lamp rows retain
  their original locations and heights.
- Old Town has irregular authored cobbles, raised pavements/kerbs, two rows
  of varied gabled shop façades with window interiors, lamps/pools, benches
  and a tiered foreground fountain. Walkers follow streets/pavements. The
  clock landmark moved right by 0.58 m to clear the larger DINER sign. The
  left pavement/kerbs omit z −3.3…0.15 for the hitched truck and its nearby
  walker stays on the remaining pavement. Both sidewalk loops stay within
  z 2.6…5.0, clear of the lamp rows and z 6.5/−16.5 benches.
- Moon Mile has rippled violet sand, layered rocks, cactus/scrub islands,
  an observatory/generator outpost, a lit rocket motel, diagonal long upper
  highway and foreground approach with moving cars. Wire poles and perched
  birds, lamps and pedestrians give the desert district life and scale.
  Curve-following traffic uses opposite ±0.85 m normal offsets for the two
  directions; each body's headlights share its exact instance transform.
  A common 2.8 speed preserves same-direction phase spacing around the curved
  loop; straight-road traffic retains its prior speed variation.

All six compact map places also gained meaningful secondary pieces: service
shop/tyres/crate, concession/speaker posts, ticket stall/pennants, shed/pier
cargo, shop/bench/fountain, and outpost/cactus/rocks respectively. Their hero
silhouettes remain distinct and no per-stop floor tile or duplicate diner was
added. Garage/motel builders retain their API and use the same owned night
glow treatment.

## Materials, motion and ownership

Ground surfaces own deterministic 256² high / 128² low colour and normal
DataTextures. World-scale repetition retains legible asphalt aggregate,
gravel, trampled grass, mortar, water ripples and violet sand. Window trims,
interiors, roofing and night paint values supply structured forms before
sampling is reduced. Radial pools use one instanced additive plane batch and
a 64² RGBA texture; steam owns a 48² Gaussian texture. No point light was
added. Plank light pools are above the plank top, not under the apron.

Each place owns a glow-material clone with gain 3. Shop-window luminance is
1.248 and stall-window luminance 1.227 in linear RGB. The movie-screen tint at
2.5 gain has luminance 1.138, above the supplied 0.9 bloom threshold while
retaining cyan. This verifies source values, not the actual bloom result.

District static geometry is merged per material and receives lighting/shadows
without casting another large district shadow. Its `userData.dynamic` marker
only exempts an already merged group from root rebatching; it does not imply
animation. Existing nearby heroes retain their prior shadow policy. People
share a merged, vertex-coloured authored figure and instanced transforms;
limb geometry, water, flags, steam, glitter and traffic update deterministically.
All time-driven motion freezes under reduced motion.

Nested instance buffers, geometry, owned material clones and every owned
texture are disposed exactly once. Borrowed materials/textures remain owned
by the caller. Both consecutive `dispose()` calls are safe.

## Measured source budgets

`budget.json` records whole-stage source counts with five tables and plain
upgrades after the final contact fixes. Main totals count submitted geometry
without culling. Shadow totals additionally count every eligible caster in
one conservative shadow pass. These are analytical Three.js source counts;
they are not `renderer.info`, measured GPU frame time or device performance.
Caller machines/people/FX and postprocessing are outside this stage contract.

| Place | High main calls / triangles | High with shadow | Low main calls / triangles | Low with shadow |
| --- | ---: | ---: | ---: | ---: |
| Truckstop | 33 / 150,806 | 42 / 251,838 | 33 / 83,178 | 42 / 133,898 |
| Drive-in | 31 / 209,638 | 40 / 321,966 | 31 / 115,154 | 40 / 172,402 |
| Fairground | 42 / 178,712 | 60 / 298,724 | 42 / 97,548 | 60 / 156,232 |
| Harbour | 48 / 177,970 | 66 / 284,022 | 48 / 99,030 | 66 / 154,914 |
| Old Town | 30 / 165,728 | 40 / 270,108 | 30 / 86,428 | 40 / 138,624 |
| Moon Mile | 40 / 154,136 | 53 / 252,946 | 40 / 84,564 | 53 / 134,826 |

Worst plain-stage source totals with one shadow pass are 66 calls, 321,966
high triangles and 172,402 low triangles, within 140/450k high and 70/180k
low. Root's final audit covers all-upgrade combinations and is the canonical
final budget report; these figures are a snapshot of the parent builders
at the time this delegated check ran.

## Review and checks

`review/source-{place}-{1280x720|390x844}.png` contains this job's interim
matched-camera source views. All twelve were inspected. The initial empty
phone bands led to nearer highway/coaster/headland/boat composition and
foreground approach details. Truckstop, Fairground, Harbour and Moon Mile
were inspected again after those revisions. All eight compact-map source
images and their contact sheet were inspected. Later final contact changes,
cyan screen tint, supporting flag masts and clock separation are covered by
the root job's final renders/independent source review, not those interim files.

The CPU renderer approximates lighting and does not reproduce WebGL fog,
normal maps, bloom, point-light falloff or physical transparency. Runtime
screenshots supplied by Claude are the observed failure reference, not
proof of the revised night result. Root's final clay/material high/low,
matched wide/phone, 44° and motion review set provides the final source evidence.

After the root render pass, this job also opened all twelve final low wide/
phone views, all six four-frame motion sheets and the final map contact sheet.
The phone highways/coaster/boat bands, foreground approaches, cyan film
graphic and separated clock remain readable at low detail. Motion review
identified the Moon Mile opposite traffic paths sharing a centreline and
Old Town sidewalk walkers reaching the benches; both concerns were sent to
root and corrected on its explicit final instruction. The independent root
review also found the rear Harbour lamp row over water; only that row was
moved onto side piers with grounded plinths. These fixes add no triangles or
draw submissions. The root job regenerates their final views after the stable
source handoff.

The full-loop check also reproduced same-direction traffic meeting at t 60
under the previous varied speeds. Root authorized a common speed for curved
traffic only. A complete 26.79-second curved loop, t 60 and later samples now
have nonintersecting same-direction vehicle bounds and exactly matching
body/headlamp transforms, at both qualities.

The author regenerated and opened the corrected Moon Mile, Old Town and
Harbour high source views at both 1280×720 and 390×844 under this folder.
The car and landmark framing stays stable; Old Town walkers are separated
from bench volumes and the rear Harbour lamps visibly stand on the side
piers. Opposite traffic physical separation is additionally verified at the
previous overlap time; the low-angle source camera can naturally occlude one
passing car with another without their geometry intersecting.

Validation after final contact changes passed:

- Scoped strict TypeScript project and `oxlint` for `places.ts`.
- All 24 place × stage/map × high/low combinations have finite geometry,
  owned textures ≤1024², identical reduced-motion transforms/vertices/instance
  matrices at times 0 and 90, exact single owned-resource disposal and zero
  borrowed-material disposals. Script: `check-places.mjs`.
- Whole-stage source budget script for all six places × both qualities.
- Specific checks exercise the previously overlapping opposing traffic at
  times 3–4, one entire curved-traffic loop plus the t 60 same-direction
  regression, exact lamp/body transforms, an entire sampled Old Town walking
  loop and rear Harbour plinth vertices at the side-pier top, at high and low.

Claude still needs to inspect the revised actual WebGL night scenes in the
lab: lit windows/screen/neon and pools; high/low on phones and wide screens;
walking/traffic/flag/water motion and reduced motion; actual `renderer.info`
and device frame time; and visibility/clearance with the caller's real kitchen,
chefs, patrons, dish bubbles and upgrade fixtures. No source API change is
requested.
