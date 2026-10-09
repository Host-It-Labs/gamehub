# Diner stage — round 3 WebGL corrections

9 October 2026. Medium task: a focused revision of the existing stage, following
[Claude’s round 3 feedback](feedback-round-3.md). Read, in order, the mandatory
high-fidelity-3d skill, job brief, previous notes and round 3 feedback; then
personally opened all twelve supplied occupied-shift WebGL views and both
contact sheets in `review/round3/`. The written
[revision brief](round3/asset-brief.md) preceded the source edits. An independent
reviewer also read the skill and reviewed the before/after evidence and code.

Only `components/game/diner/places.ts`, `components/game/diner/stage.ts` and
files under this stage folder changed. `diner-car.ts` is byte-for-byte unchanged
from the starting snapshot. No Blender or prohibited Git operation was run.
The existing development server was used without launching another. The
shared tree's unrelated and concurrent changes were preserved.

## Five feedback fixes

1. **Large-surface glare.** Broad place windows, stall interiors, pump fascia,
   the Old Town clock face and cinema film have their own bounded material
   path. Their gain is capped at **1.12**, including rush, flicker and
   brownouts. Small lamps/neon retain the round 2 high-gain glow. Shop panes
   use amber vertex gradients with dark edges/lintels, wood mullions and
   retained shelf silhouettes; upper windows receive the same treatment.
   The cinema has a cool blue gradient/vignette texture and readable rocket,
   moon and hill shapes. Its film glows no longer inherit the bulb material.
   The pump canopy paint is less pale and its luminous fascia uses the
   bounded path. Caller bloom/exposure settings are unchanged.
2. **Harbour beam.** Shortened the stage cone from 17 m to **7.5 m**, narrowed
   it to a 1.05 m radius and reduced its opacity to 0.035 before power cues.
   A 64² alpha map fades the beam rapidly to zero at its broad end. The
   sweep points seaward throughout its cycle; 721 sampled poses at both
   qualities put the frontmost vertex at **z=-4.691**, behind the lighthouse
   and clear of the car, truck, pier and deck. Transparent double-sided
   rendering uses a single pass to avoid doubling both glare and calls.
3. **FUEL separation.** Moved the stage pole sign from `(3.3, 0, -3.25)` to
   **`(15.3, 0, 0.2)`**, to the right of the car. Its whole board lies beyond
   x=13.4. Kept the previous central camera-envelope landmark so the side
   sign cannot enlarge the portrait framing and shrink the playable patio.
   It reads separately on desktop and sits naturally outside the phone crop.
   The map vignette keeps its compact original placement.
4. **Warm worktop.** Added a cream laminate skin with a deterministic 256²
   texture of sparse taupe and dusty-red mineral chips, a restrained
   clearcoat and soft edge. The chrome slab beneath remains the exposed
   front/edge trim. The complete top is still exactly **y=.93**; every counter
   appliance volume remains clear. The occupied shift confirms appliances
   rest on the new surface rather than float above or cut into it.
5. **Moon Mile relief.** Replaced the white emissive disc/raised blobs with
   sculpted crater bowls, low raised rims, maria, fine value variation and
   raking-light vertex shading. The final moon is a soft grey-lilac standard
   material with emissive intensity **.18**, independent of electrical power.
   Craters were composed on the exposed upper/right face and strengthened
   after the first fresh WebGL review still read too flat. High has about
   .101 m of recessed bowl relief and .035 m rims; low preserves about .094 m
   and .035 m. Its footprint/landmark and the road/scenery remain unchanged.

## Preserved round 2 work and interface

The rolled roof, raised monitor and clerestory, standing seams, cowl vents,
DINER marquee, chasing bulbs, turquoise underline, festoons, coupled cab-over
truck/hitch, five booth footprints, menus and shelves, ground materials,
district detail, moving neighbours/traffic/rides and raised Harbour pier are
retained. Nothing was flattened, globally zoomed out or removed to meet
budgets. The root compared all six before/after views; the independent review
found no further actionable defect in the five requested repairs.

Builder signatures and returned fields are unchanged. Counter front z=1.4,
top y=.93, machine ceiling y=2.35, booth/queue/entrance/jukebox coordinates,
selected-booth behaviour and truck/trailer attachment remain unchanged.
Static batches and instances retain the existing structure. New materials
and procedural textures are owned and disposed exactly once; borrowed caller
materials survive. Reduced motion freezes rigs, instances and deformed
geometry. Powered broad surfaces dim on brownouts; the moon stays celestial.

## Fresh review evidence

[WebGL review gallery](review/round3-fixes/index.html),
[desktop contact sheet](review/round3-fixes/sheet-desktop.jpg) and
[portrait contact sheet](review/round3-fixes/sheet-phone.jpg) contain actual
Chrome WebGL captures from the existing `/diner/lab?scene=stage` route. The
root inspected every place at **1280×720** and **390×844**, using the current
lab framing (36° desktop / 52° phone), the existing night rig, ACES exposure 1
and bloom strength .38 / threshold .92. The viewport override was cleared
after review. No camera, lights or post-processing code changed.

These twelve stage views include the opened car, all five booths, surroundings
and scenery figures. Their worktop is empty because the stage builder does
not own appliances. A separate
[occupied Drive-in view](review/round3-fixes/webgl-occupied-drivein-1280x720.jpg)
was opened through `scene=shift&place=drivein&tools=1` and inspected with
appliances, the player and the normal HUD. It verifies the warm worktop and
blue cinema in the integrating game. All-place occupied gameplay, physical
touchscreen use and mobile GPU/frame-rate acceptance were not tested.

The earlier vehicle clay/material and living-motion sheets remain in
`review/round2/`; this round does not remodel either vehicle. Claude's original
fourteen round 3 images remain untouched in `review/round3/`. Editable
TypeScript is the runtime source; review-only GLBs are in `sources/round3/`.
The exporter omits colour/normal/roughness maps, so use WebGL captures for
material judgement. The material textures are authored procedurally in code;
no image-generation references or edits were used.

## Final stage budgets

The source audit counts the full scene before frustum culling, plus one shadow
pass, including the additional main pass required by transparent double-sided
materials unless `forceSinglePass` is set. Five booths are present. This is
the owned stage budget; appliances, actors, view lights and caller
post-processing belong to the integrating view. The lab's bloom/composer adds
14 screen passes, recorded separately in the renderer report.

| Place | High main calls / triangles | High + shadow | Low main calls / triangles | Low + shadow |
| --- | ---: | ---: | ---: | ---: |
| Truck stop | 36 / 150,964 | 46 / 252,296 | 36 / 83,208 | 46 / 134,036 |
| Drive-in | 34 / 209,802 | 44 / 322,430 | 34 / 115,190 | 44 / 172,546 |
| Fairground | 44 / 179,768 | 63 / 300,080 | 44 / 97,980 | 63 / 156,772 |
| Harbour | 50 / 177,510 | 69 / 283,862 | 50 / 98,698 | 69 / 154,690 |
| Old Town | 32 / 162,756 | 43 / 267,628 | 32 / 84,864 | 43 / 137,360 |
| Moon Mile | 42 / 161,252 | 56 / 260,362 | 42 / 82,496 | 56 / 132,866 |

All upgrades are also audited for **all six places at both qualities**:

| Place | High + shadow, all upgrades | Low + shadow, all upgrades |
| --- | ---: | ---: |
| Truck stop | 46 / 255,712 | 46 / 135,916 |
| Drive-in | 44 / 325,846 | 44 / 174,426 |
| Fairground | 63 / 303,496 | 63 / 158,652 |
| Harbour | 69 / 287,278 | 69 / 156,570 |
| Old Town | 43 / 271,044 | 43 / 139,240 |
| Moon Mile | 56 / 263,778 | 56 / 134,746 |

Conservative peaks are **high 69 calls / 325,846 triangles**, against
140 / 450,000; **low 69 / 174,426**, against 70 / 180,000. Harbour sets the
call peak and Drive-in the triangle peak. Low has one call and 5,574 triangles
of margin. Stage-owned lights remain **3**, all without shadows, against 4;
the largest stage-owned texture is **256²**, against 1024².

Actual WebGL renderer measurements include stage + shadow and frustum culling.
Low with all upgrades measured Truck stop 46 / 135,916, Drive-in 43 / 174,402,
Fairground 62 / 158,592, Harbour 69 / 156,570, Old Town 43 / 139,240 and
Moon Mile 52 / 133,522. The conservative source totals remain the budget gate.
Full data: [source audit](review/round3-fixes/source-budget.json) and
[renderer observations](review/round3-fixes/renderer-budgets.json).

## Validation and handoff

- Strict scoped TypeScript, lint and formatting checks: pass.
- `check-source.mjs` with `DINER_REVIEW_ROUND3=1`: pass. Covers high/low,
  plain/all-upgrade stages, map builds, deterministic finite geometry,
  coincident hitch points, exact machine clearances, raised ground/pool
  contact, reduced-motion freezing and exactly-once owned-resource disposal.
- [Feedback check](round3/check-feedback.mjs): pass. Exercises bounded glow
  over 96 time samples and power/reduced-motion combinations at both qualities,
  721 complete beam poses, recessed crater geometry and power independence,
  sign separation/framing and exact laminate support height.
- `tests/diner-visuals.test.mjs`: **6/6 pass**. Existing layout/geometry,
  texture, actor rig and resource-lifetime tests; no unrelated tests added.
- Scoped `git diff --check`: pass. Since the three continued modules are
  untracked shared work, formatting and snapshot comparison also cover them.
- Root WebGL inspection: all twelve desktop/portrait stage views plus one
  occupied shift. Independent read-only source/visual review: no remaining
  actionable defect in this revision. Physical touch/GPU checks are separate.

Logs and numeric feedback results are in `round3/`; starting source snapshots,
the written brief, source delta and final artifact hashes are preserved there.
The gallery is reproducible with `node stage/round3/review-gallery.mjs` from
the concept directory, or the full repo-relative path from the repository root.
No contract change is requested. Broader gameplay/camera/lighting integration
remains Claude's scope; the next external review can use the current modules
and the occupied renderer rather than relying on exported GLB materials.

---

The previous round 2 record is retained below; its budgets and source-only
review claims describe that earlier revision. An exact starting copy also
lives in [round3/notes-round2.md](round3/notes-round2.md).

# Diner stage — round 2 source review

9 October 2026. Large task. This revision follows
[Claude’s round 2 feedback](feedback-round-2.md). The root read the mandatory
high-fidelity-3d skill, original job brief and previous notes, then opened all
12 supplied `review/runtime-{place}-{1280x720|390x844}.png` WebGL images before
modeling. Those night views exposed empty surroundings, a plain roof, weak
bulbs and a detached truck. The earlier record is preserved in
[round2/notes-round1.md](round2/notes-round1.md).

Only `components/game/diner/diner-car.ts`, `places.ts`, `stage.ts` and artifacts
in this folder were edited. No Blender, server launch, camera/lighting edit or
Git mutation was performed. CPU review is the agreed process for this round;
Claude supplies the next real WebGL review.

## Asset briefs and resulting forms

The written briefs preceded this revision:
[vehicle and patio brief](round2/asset-brief.md) and
[surroundings brief](round2-places/brief.md). High geometry remains the editable
procedural source; low reduces sampling while preserving the forms.

- **Car:** the long chrome/cherry lunch-car silhouette now has a rolled roof
  with cream shoulders, a raised dark monitor, glazed clerestory strips,
  transverse standing seams, chrome gutters, cowl vents and a louvred unit.
  The DINER marquee is a large framed enamel board with actual bent neon
  tubes, ceramic standoffs, turquoise underline and 54 chasing perimeter bulbs.
  The closed map car keeps this same construction and warm window row.
- **Truck:** the rounded cream/mint cab-over retains its split windscreen,
  grille, mirrors, whitewalls and amber lamps. It parks straight at the car’s
  tow end, nose out. Both declared attachment points meet exactly; the car has
  an A-frame drawbar and safety chain. The nominal surface is y=-0.24; Harbour
  uses its raised pier instead. Headlights glow and a soft forecourt pool
  anchors them to the ground.
- **Patio/galley:** the calm cherry/cream checker and five booth footprints
  remain. The counter front gains recessed cherry enamel panels and chrome
  seams. Three framed menu boards, pantry shelves/tins, tile seams, utensils
  and warm hood/under-shelf lamps sit behind the appliance clearances. Proper
  poles carry catenary cables, ceramic sockets and pear-shaped lamps along
  both sides and beyond the front edge, with no cable crossing the deck.
- **Truck stop:** cracked asphalt, worn bays, kerbs, oil stains and reflected
  neon puddles connect pumps, trailers, tanks, tyre racks and a lit service
  hall to a visible highway. Moving traffic, walking neighbours, an aproned
  cook, vent steam and perched wire birds make it inhabited.
- **Drive-in:** gravel rows contain occupied parked cars, speaker posts and
  concessions/projection buildings with lit interiors. The cinema screen has
  a cyan glowing film with a rocket, moon and hills; ground pools and distant
  walkers fill the margins.
- **Fairground:** trampled grass, connected timber midway boards, awned
  stalls, ticket booth, bunting and a small coaster surround the Ferris wheel
  and carved-horse carousel. Families, supported fluttering flags and a dog
  with a wagging tail give the approaches life.
- **Harbour:** a broad plank pier wraps the patio with bollards, ropes, nets,
  stacked crates, benches and sailors. Moored boats fill the near water;
  swells and moon-glitter lead to a rocky headland, raised sheds and the
  sweeping lighthouse. Pier decals and people use the actual raised surface.
- **Old Town:** irregular cobbles, kerbs and raised pavements connect detailed
  warm shop interiors, awnings, benches, lamps and a tiered fountain. Walkers
  occupy the square. A lowered parking cutout receives the coupled truck;
  the clock tower sits clear of the larger DINER board.
- **Moon Mile:** rippled violet sand, layered rock/scrub/cactus islands,
  observatory hill and illuminated rocket motel form a night desert. Two long
  road ribbons and moving headlights occupy the visible upper and foreground
  bands. An outpost’s windows and pools create small warm oases.

Map vignettes retain one clear landmark each and add a few matching scene
pieces: service shop/pumps, concession/cars, ticket stall/bunting,
harbour shed/mooring, shop/fountain/bench, observatory outpost/scrub. Garage and
Motel still provide compact service-bay and neon/pool silhouettes. They use no
per-stop floor mats or duplicate diner cars.

## Source review and corrections

The root inspected the vehicle clay front/side/rear/three-quarter and colour
views at stage and map detail, the uncropped coupled rig, all six places at
desktop and phone sizes, the map contact sheet and the motion samples. An
independent source reviewer checked composition, the contract, bloom values,
ground contact, motion ownership and disposal.

Specific findings led to these fixes:

- Raised the monitor cap so it no longer buried the clerestory; raised the
  DINER board so the roof no longer covered its lower neon strokes.
- Kept the front festoon outside the playfield and below the last booth/guest
  sightline in the game cameras. Larger bulbs and HDR gain replace faint dots.
- Filled the phone’s previously empty upper/foreground bands with visible
  roads, occupied rows, boats, stalls, headland buildings and approaches.
- Corrected bloom values using actual linear colour calculations. Shop windows
  `#d4a46a × 3` have luminance 1.248; stall windows `#d2a368 × 3` have 1.227.
  The screen’s cyan `#82bdcc × 2.5` gives 1.138, above the 0.9 threshold while
  preserving contrast with the lighter film graphic. Root vehicle/patio lamps
  use HDR gains around 2.6–3.5. These calculations establish source values,
  not final WebGL exposure.
- Put Harbour lamp-pool decals above its boards rather than below them.
  Grounded its walkers on planks/headland and Old Town walkers on pavements.
  Lifted the Harbour rig 0.195 m onto the pier, derived truck XYZ from the two
  attachment points, and matched the pier apron height under its outer tyres.
- The machine-clearance audit caught a marker light entering the coffee space
  after that lift. Its mounting moved down into the lower enamel belt; the
  worktop and all appliance volumes remain unchanged.
- Shifted the Old Town clock/tower 0.58 m right, including its hands and camera
  landmark, to expose the complete dial beyond the larger marquee.
- Added supports beneath the flags and retaining plinths beneath raised sheds.
- Moved the two rear Harbour lamps/pools from open water onto the side pier
  strips, with their bases on the planks. Separated opposing Moon Mile traffic
  into two lanes, used a common speed to prevent same-lane loop overtaking,
  and kept Old Town walking loops clear of benches and the bay.

The source cameras use the current lab framing: 36° desktop / 52° phone,
1280×720 and 390×844, desktop insets 96/24 px, phone 150/170 px, 16 px sides.
A second complete set uses the requested fixed 44° elevation. Low and high
share these cameras; the detailed source was not made smaller to meet budgets.

Motion sheets sample all six places at 0, 2.5, 5 and 7.5 seconds. They show
walking/traffic, turning rides and upright cabins, steam, flags, dog tail,
water/glitter/boats, lighthouse sweep, clock hands, radio scan, cinema flicker,
marquee chase and the entrance gate. Reduced motion freezes object poses,
instance matrices and deformed geometry. Gate cues still set the access state.
Brownouts dim powered glows/pools and the three local lights; celestial
moonlight/glitter stays independent of electrical power.

## API and gameplay contract

The stable builder signatures are unchanged:

```ts
buildDinerCar(materials, { detail: 'stage' | 'map', upgrades?, quality? })
buildTruck(materials, { detail: 'stage' | 'map', upgrades?, quality? })
buildPlace(materials, place, { detail: 'stage' | 'map', quality? })
buildMapStop(materials, 'garage' | 'motel')
buildStage(materials, { place, tables, upgrades, quality })
```

Vehicle results retain `group`, `landmarks`, `wheels`, `hitch`, `update` and
idempotent `dispose`. The truck’s local hitch is now `(1.95, .3, 0)`;
the car’s is `(-6.7, .08, zCentre)`. Transform these points through their
groups when attaching the rig. Wheel rotation remains around local z for
the route. `CAR_DIMENSIONS.roof` is 3.3 m; the complete marquee top is separately
protected by the car’s landmarks. Harbour car position includes the pier lift
and its landmarks include that same translation.

The gameplay rectangle, counter front z=1.4, worktop y=.93, machine ceiling
y=2.35, seat crowns y=.47, table tops y=.755, selected-booth behaviour,
entrance gap, queue and jukebox stay unchanged. Counter appliances, including
the pie display already implemented in Claude’s `stations.ts`, remain the
integrating view’s models. Source stage-only renders therefore have an empty
worktop. Shelves and menus remain behind z=.05.

Ground textures are authored once per place instance and include colour and
normal detail. Static geometry is merged by material, repeats and extras are
instanced, and moving rigs retain their pivots. Distant district batches receive
light/shadows but do not spend the deck’s shadow pass; near hero props do.
Caller materials/maps are borrowed. Owned materials, textures, geometries and
instance buffers are disposed exactly once.

## Measured budgets

| Place | High main calls / triangles | High + shadow calls / triangles | Low main calls / triangles | Low + shadow calls / triangles |
| --- | ---: | ---: | ---: | ---: |
| Truck stop | 33 / 150,806 | 42 / 251,838 | 33 / 83,178 | 42 / 133,898 |
| Drive-in | 31 / 209,638 | 40 / 321,966 | 31 / 115,154 | 40 / 172,402 |
| Fairground | 42 / 178,712 | 60 / 298,724 | 42 / 97,548 | 60 / 156,232 |
| Harbour | 48 / 177,970 | 66 / 284,022 | 48 / 99,030 | 66 / 154,914 |
| Old Town | 30 / 165,728 | 40 / 270,108 | 30 / 86,428 | 40 / 138,624 |
| Moon Mile | 40 / 154,136 | 53 / 252,946 | 40 / 84,564 | 53 / 134,826 |

All-upgrade variants were checked in **all six places at both qualities**.
Worst conservative all-upgrade totals: high **66 calls / 325,382 triangles**; low **66 / 174,282**.
Harbour sets the call peak; Drive-in sets the triangle peak.


Analytical Three.js source counts include every mesh/instance of the complete
owned stage with all five booths, before frustum culling. Conservative totals
add one full eligible shadow pass. Machines, gameplay guests/effects and
post-processing belong to Claude’s view. These are not `renderer.info` or GPU
timing measurements. Limits: high 140 calls / 450,000 triangles; low 70 /
180,000. Each stage adds three non-shadow point lights, and the largest texture
is 256×256 (low surfaces 128×128).

All checks passed. The audit covers every place at both qualities, plain and
all-upgrade variants,
machine clearance, exact hitch coincidence, decal heights, finite geometry and
instance data, deterministic rebuilds, reduced-motion buffer/rig freeze, and
exactly-once owned-resource cleanup with borrowed resources retained. Scoped
strict TypeScript and lint passed for the three owned modules. The separate
place audit also covers all 24 stage/map/quality combinations.
Specific contact checks and 161 samples of the full curved traffic loop also
passed; the earlier same-direction collision at t=60 is resolved. The final
independent source recheck found no further actionable defect in the corrected
Harbour, Old Town or Moon Mile views.

## Evidence and reproduction

- [Round 2 review gallery](review/round2/index.html): source stages, high/low
  and 44° controls, all vehicle clay/colour sheets, uncropped rig, eight map
  vignettes, six motion sheets, upgrades and budget table. It links the supplied
  WebGL baseline for comparison.
- [Source budget data](review/round2/source-budget.json) and
  [source audit log](review/round2/source-check.log).
- [TypeScript log](round2/typecheck.log) and [lint log](round2/lint.log).
- [Final manifest](round2/final-manifest.json): source hashes, evidence image
  hashes/sizes, passed checks and conservative budget peaks.
- `sources/round2/*.glb` are review-only snapshots of the procedural source;
  they omit raster maps. Runtime continues to use the TypeScript builders.
- `round2/*.before.txt` preserve the pre-revision source files.

From the repository root:

```sh
npx tsc -p docs/concepts/2026-10-08-diner-car/stage/tsconfig.json --pretty false
npx oxlint components/game/diner/diner-car.ts components/game/diner/places.ts components/game/diner/stage.ts
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/check-source.mjs
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs all
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs low
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs fixed44
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs upgrades
DINER_REVIEW_ROUND2=1 node docs/concepts/2026-10-08-diner-car/stage/review-contact.mjs
```

## Remaining runtime review and Claude handoff

CPU renders approximate PBR and sample the actual colour/alpha textures and
instance colours. They omit WebGL point-light contribution, shadows, normal
maps, fog, reflections and bloom. They cannot establish final night exposure,
chrome response, physical touch, complete moving cycles or mobile frame rate.
No such runtime acceptance is claimed.

The straight truck is genuinely hitched, but most of it crops at the left edge
on portrait phones; the full uncropped rig is provided for physical review.
It remains secondary scenery to preserve the deck’s established phone size.
Small background people and compact map vignettes are authored for play scale,
not close-up character inspection.

Claude needs to:

1. Capture round 3 WebGL views of all six places at both sizes/qualities with
   the new night lighting. Check bloom/exposure and occupied gameplay with
   appliances, guests, waiter bubbles, gate, front festoon and coupled truck.
   Review full decorative cycles, reduced motion and brownouts in that view.
2. Preserve nested source instances in the route map. In
   `campaign-world-models.ts`, `addSource()` treats an `InstancedMesh` as one
   ordinary mesh and its update composes only `source.matrixWorld`. That drops
   the Ferris wheel’s eight cabin transforms/colours, leaving one cabin at the
   origin. Flatten stop × source instances, compose each `source.instanceMatrix`
   after `source.matrixWorld`, and combine source colours with stop tint.
   `route-geometry.ts` `normaliseAsset()` must also include instance-transformed
   bounds. Direct map vignette renders already preserve these instances.
3. Check the route’s active emissive multiplier (currently 3.2) against the
   source glow gain of 3; the combined gain is about 9.6 and may need exposure
   tuning in the actual map renderer.

**Contract changes needed: none.** The route fixes above concern the caller’s
existing instance/material integration, outside this job’s file ownership.
