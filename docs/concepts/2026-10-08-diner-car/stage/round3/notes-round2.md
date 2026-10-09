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
