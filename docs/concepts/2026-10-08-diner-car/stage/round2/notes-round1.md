# Diner car stage — source brief and review

Task size: large. Only `diner-car.ts`, `places.ts`, `stage.ts` and this review
folder are owned here. No Git mutations or shared renderer changes.

## Asset briefs (written before modeling)

- Car: a long railway-derived chrome lunch car, with smoothly rounded ends,
  ribbed stainless skirt, cherry belt, cream rolled roof, individual framed
  warm windows and a custom tubular DINER marquee. Long open side faces +z.
  Stage coordinates are metres; car local x is centred, rear wall faces +z.
  Stage awning lifts above the 2.35 m machine clearance and stays behind the
  working edge. Closed map car retains the same proportions and silhouette.
- Truck: a short wheelbase cab-over, nose toward -x, cream crown over mint
  pressed panels; split windscreen, fenders, grille, whitewalls, mirrors,
  amber clearance lights, hitch toward +x. Rounded engineering, not cubes
  with a coat of paint. Wheels and hitch have declared pivots/attachment points.
- Patio: a calm muted cherry/cream checked portable deck at y=0, channelled
  mint benches around chrome pedestal tables, low perimeter rails with the
  exact left entrance gap, slim arched jukebox and warm festoon bulbs. No
  new obstacle inside the gameplay rectangle outside the contract's booths
  and jukebox. The host stand and planting stay outside the walking edge.
- Truck stop: sodium-orange petrol canopy, tall winged highway sign, tanks,
  trailer ribs and moving distant traffic on a continuous asphalt apron.
- Drive-in: broad cyan silver-screen silhouette, a sculpted graphic film,
  curved rows of pastel parked cars, projector kiosk and blue light beam.
- Fairground: candy-coloured Ferris wheel with upright gondolas, tented
  carousel and striped big-top, warm bulbs and turning rides.
- Harbour: teal water and timber pier, tapered striped lighthouse with a
  sweeping light, curved little fishing boats and sheltered shore buildings.
- Old Town: asymmetric brick shopfronts, ornamental gables, a clock tower,
  iron street lamps and a paved square. Clock hands keep time.
- Moon Mile: layered violet sandstone mesas, slanted radio dish with a real
  concave bowl, a retro rocket motel marker and a low cratered moon.
- Garage/Motel map stops: a mint service bay with lifted bonnet and tool sign;
  an L-shaped cream motel with cherry neon and a pool. Strong unique silhouettes.

High detail is the editable source; low detail changes sampling and minor
surface details only. Materials supplied by the caller are borrowed. Owned
emissive clones and any procedural textures must be disposed separately.

## Integration API

Implemented without a contract edit:

```ts
buildDinerCar(materials, { detail: 'stage' | 'map', upgrades?, quality? })
buildTruck(materials, { detail: 'stage' | 'map', upgrades?, quality? })
buildPlace(materials, place, { detail: 'stage' | 'map', quality? })
buildMapStop(materials, 'garage' | 'motel')
buildStage(materials, { place, tables, upgrades, quality })
```

The vehicle API was exported early for the parallel route job. Both vehicle
builders return `group`, `landmarks`, `wheels`, `hitch`, `update(cues)` and
idempotent `dispose()`. Place builders return `group`, `landmarks`,
`update(cues)` and `dispose()`. `buildStage` implements the existing `BuildStage`.

Vehicles use a centred x datum; -x is the truck's nose and the car's tow end.
The long serving side faces +z. Stage car serving side is z=0 and map car is
centred on z=0. Nominal body datum is y=0; the route grounds the actual minimum
bounds before scaling. Stage car tyres meet the asphalt at y=-0.24. Truck is
parked beside it, unhooked. Axle pivots roll around local z; vehicle updates
only own the lamps, so the route can animate those pivots independently.
The attachment points are local; transform a cloned `hitch` through the
group's `localToWorld` when connecting the rig. No renderer, camera, DOM or
global lighting is created by these builders.

The stage counter front is z=1.4 and its worktop is y=0.93. Every named
machine volume stays clear above it to y=2.35, including with all upgrades.
Seat crowns are exactly y=0.47; laminate table tops are y=0.755. Seats and
backs stay inside the declared booth footprints. Only `options.tables`
builds furniture; duplicate or unopened indexes do not create extra booths.
The gate uses the exact left gap, swings outwards, and the host stand stays
outside the walking rectangle. The jukebox stays within its declared radius.
Galley shelves and the menu sit behind the counter's working depth; the
fridge is beside the left end on a supported pad, clear of the car shell and
the coffee spot.

The raised awning has a short upswept projection to preserve the machine
sightline. The open car's roof and window wall use a service cutaway that
keeps the galley visible from the steep phone camera. The map car keeps its
full closed silhouette and warm window row. Spare tyres, the bigger neon,
jukebox and folded/wider patio are visible upgrade variants; gas can, atlas
and lucky dice add restrained small details. Machine and waiter upgrades
remain the caller's responsibility.

`landmarks` includes complete car/awning/sign extents, each place's hero top,
the fridge and the edge planters/poles. Bigger Patio adds its outer edge.
This lets the existing `fitDinerCamera` protect them without changing the
shared camera code. Ground planes continue 180 m across the surroundings;
Harbour uses continuous water and a pier beneath the deck.

## What was reviewed and fixed

Reviewed the car and truck at stage/high and map/low detail in neutral clay
from front, side, rear and three-quarter, then in colour. The rounded body,
end doors, framed oval lights, stainless fluting, enamel belt and cream roof
read as one carriage. The truck has a distinct rounded cab-over silhouette,
split dark glazing, separate headlights/grille, whitewalls, mirrors,
clearance lamps and hitch. Clay treats glass as opaque; use colour for the
openings and window hierarchy.

Reviewed all six stages with all five booths at 1280×720 and 390×844, plus
matching low-detail views. The responsive source cameras use the **same
framing function and insets as the lab**: 36° wide / 52° portrait, 96/24 px
desktop top/bottom and 150/170 px phone top/bottom, 16 px sides. A second
complete set uses a fixed 44° elevation, as requested in the brief.
The checker is muted cherry/cream, with 80 cm tiles and thin grout; the
bright signs and place silhouettes stay away from the clear five-booth deck.
The DINER lettering, raised awning and edge planter silhouettes fit both sizes.

Concrete corrections from source review and independent review:

- Added shaped service doors, portholes, handles and vents to formerly bare
  end faces; changed truck glazing from transparent-over-chrome to dark gloss.
- Corrected tyre/asphalt contact and put every domed hub on the outside.
- Moved backdrop landmarks behind the car, rather than through its roof;
  protected their tops in the framing input. Moon is a tilted distant disc,
  independent of electrical power, and stays round near the mean game angle.
- Separated the clock dial/case from its roof eaves and lifted the stage tower
  to clear the diner roof in both the desktop and phone views.
- Preserved cinema blue when applying screen flicker; the film is a physical
  graphic of a rocket, moon and layered hills, with no downloaded texture.
- Kept parked cinema cars and semi trailers outside the car's body footprint;
  grounded patio planters/light poles and supported the fridge/host stand.
- Replaced abstract carousel capsule mounts with carved horse profiles,
  posed legs, heads/ears, manes/tails, saddles, eyes and reins. The Garage's
  wrench is a shaped sign, with an open jaw and separate handle.
- Kept lighthouse/dish/rocket rigs out of static batches, so their updates
  still affect visible geometry; added instance-buffer disposal for gondolas.
- Replaced hundreds of bevelled paving slabs with shallow simple cobbles;
  they preserve the square's pattern while removing unnecessary triangles.

Reviewed the eight map vignettes together: pole sign/pumps, movie screen,
Ferris/carousel, lighthouse/boat, clock/shop, dish/mesa/rocket, service bay and
motel/pool. Each is a compact landmark composition, with no duplicate diner
or per-stop ground mat. The route owns their scale and surrounding terrain.

Extra all-upgrade colour views show both vehicle details and the low-quality
Fairground at both sizes. The larger marquee, two truck spare tyres,
transported jukebox, patio parts, gas can, dice and atlas keep the same material
hierarchy as the plain rig. The unfolded extension also fits the phone frame.

Fairground and Harbour contact sheets sample 0, 2.5, 5 and 7.5 seconds. They
show the rotating rim with upright gondolas, turning carousel, outward gate,
sweeping lighthouse beam and boat motion. Truck-stop traffic, cinema flicker,
clock hands and radio scanning are deterministic time-based rigs. Reduced
motion freezes time-driven poses and pulses; gate cues still set the access
state. Brownouts dim powered emissive clones and all three local point lights;
rush and jukebox cues add small pulses. The moon stays lit as a celestial body.

An independent reviewer read the contract and all three builders and inspected
the source renders. Their concrete wheel, screen, resource, clock and horse
findings were addressed. This is an independent **source review**, not user
artistic approval or a substitute for the runtime review.
The final follow-up confirmed the complete Old Town dial at both sizes and
both 44° views, and found no remaining major source-render or upgrade defect.

## Measured budgets

All five booths, plain car. Counts include the entire place, deck, counter,
truck and scenery. Main counts are all visible mesh submissions before
frustum culling. Conservative counts add every eligible mesh again for one
shadow pass. Post-processing, machines, people and effects belong to the
integrating view and are not included. These are analytical Three.js geometry
counts, **not** `renderer.info` measurements.

| Place | High main calls / triangles | High + shadow calls / triangles | Low main calls / triangles | Low + shadow calls / triangles |
| --- | ---: | ---: | ---: | ---: |
| Truck stop | 21 / 94,428 | 33 / 174,378 | 21 / 53,860 | 33 / 98,714 |
| Drive-in | 18 / 98,732 | 27 / 182,122 | 18 / 55,644 | 27 / 101,938 |
| Fairground | 27 / 110,668 | 45 / 207,918 | 27 / 60,884 | 45 / 113,550 |
| Harbour | 32 / 96,372 | 50 / 180,638 | 32 / 56,508 | 50 / 106,270 |
| Old Town | 17 / 101,468 | 27 / 188,302 | 17 / 58,564 | 27 / 108,974 |
| Moon Mile | 21 / 92,990 | 34 / 169,026 | 21 / 55,038 | 34 / 98,322 |

All-upgrade Fairground: high **27 / 112,376** main,
**45 / 211,334** with a shadow pass; low **27 / 61,824** main,
**45 / 115,430** with a shadow pass. High limit: 140 calls / 450k triangles.
Low limit: 70 calls / 180k triangles. Both remain inside the requested bounds.
Each stage adds **three non-shadow point lights**. Largest procedural texture
is **256×256** (low checker: 128×128). Static geometry merges per material;
gondolas are instanced and moving rigs retain their pivots. Borrowed shared
surface materials and maps are retained.

Full machine-clearance, finite-attribute, deterministic-geometry and reduced
motion checks passed for all six places in both qualities. Owned geometry,
material, texture and instance-buffer disposal events fire exactly once;
repeated `dispose()` is harmless and caller materials survive. The focused
strict TypeScript configuration and lint checks passed for the three modules.

## Evidence and reproduction

- [Review gallery](review/index.html): all stages, high/low and 44° controls,
  vehicle clay/colour sheets, map contact sheet, motion sheets and budgets.
- `review/source-{car|truck}-{stage|map}-clay-{front|side|rear|three-quarter}.png`
  and corresponding `-colour.png`: 20 source vehicle renders.
- `review/source-{place}-{1280x720|390x844}.png`: the 12 high responsive views.
- `review/source-{place}-low-{size}.png`: 12 matched low views.
- `review/source-{place}-44deg-{size}.png`: the 12 fixed 44° views.
- `review/source-upgraded-*.png`: all-upgrade colour views of both vehicle
  details and the low-detail Fairground at both sizes.
- `review/source-map-*.png` and `source-map-contact.png`: all eight stops.
- `review/source-motion-{fairground|harbour}-sheet.png`: motion contact sheets.
- [Raw source measurements](review/source-budget.json),
  [validation log](review/source-check.log),
  [browser blocker log](review/browser-check.log).
- `sources/*.glb`: review-only exports of the current procedural master.
  Raster maps are omitted from these exporter snapshots. Runtime uses only
  the three TypeScript builders, not those GLBs.

From the repository root:

```sh
npx tsc -p docs/concepts/2026-10-08-diner-car/stage/tsconfig.json --pretty false
npx oxlint components/game/diner/diner-car.ts components/game/diner/places.ts components/game/diner/stage.ts
node docs/concepts/2026-10-08-diner-car/stage/check-source.mjs
node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs all
node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs low
node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs fixed44
node docs/concepts/2026-10-08-diner-car/stage/render-source.mjs upgrades
node docs/concepts/2026-10-08-diner-car/stage/review-contact.mjs
```

`review.mjs` is the headless Chrome/CDP runtime capture runner for the existing
server. It visits every requested place and quality at `/diner/lab`, captures
`renderer.info`, the vehicles and motion, and writes into this review folder.
It starts a private review browser, never another server on 3017.

## Still weak or unverified

The CPU fallback approximates enamel/chrome light and reflections and samples
the real checker/surface maps, but omits WebGL normal maps, shadows, point-light
contributions and bloom. It cannot establish real chrome reflections, glass
sorting, contact shadows, neon exposure, frame rate or device GPU behaviour.
The source clay set has limited ambient shadow, so shallow seams are faint.
Background mounts, distant trailers and small map vignettes are intentionally
compact rather than close-up hero models. Cars behind the screen and shop roofs
at the edges are expendable surrounding scenery; only the hero landmarks are
protected by the scene fit.

The first lab visit showed the placeholder and a preliminary car import.
Final browser review could not complete: computer-use calls timed out,
headless Chrome aborted in macOS application registration, headless shell
failed sandbox initialization, and direct local requests returned `EPERM`.
Blender also crashed in Metal initialization. See the captured blocker log.
No final browser/touch/mobile performance pass is claimed. Full moving cycles
and occupied gameplay with Claude's people, machines and bubbles still need
review in the integrated WebGL scene. The final environment is handed over as
reviewed source with those runtime checks explicitly outstanding.

**Contract changes needed: none.** Only the three owned modules and review
artefacts under this folder were written. No Git mutation was performed.
