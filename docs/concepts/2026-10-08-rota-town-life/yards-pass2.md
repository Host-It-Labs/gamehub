# Rota domestic yards and crossing structure, second pass

8 October 2026. Written procedural source brief, before modeling. The
high-fidelity-3d skill was read again for this pass. Geometry changes are
limited to `town-life.ts` and `crossings.ts`; the pedestrian planner,
crossing safety, camera, assets and playing board remain their existing work.

## Evidence and the actual failure

Inspected Claude's `work/rota-life/review1/p1-final-9000.png`,
`p1-phone-10000.png`, `b1.png` and `b3.png`. Desktop and phone show the town
clearly enough to see long, vacant grey strips between rows. In `b1.png`
the two back-to-back terrace pairs lack plot boundaries and domestic
structures; the existing tiny washing lines are too sparse to describe
the households. Level-crossing decks at the town ring read as flat pale
or olive patches, while gates and signals are small enough to disappear
into the general rail detail. This is a failure of structure and silhouette,
not a reason to enlarge the residents or alter the camera.

## Source geometry brief

Keep the one-square/25 m scale. Work only behind actual paired, opposed
terrace rows and within their common frontage. Use the measured rear-wall
gap, never a fixed yard guessed beyond an unpaired house. Near the site,
low brick garden divisions run from the house backs to a capped rear wall.
Introduce short wooden gates, slate-capped privies with recessed side doors,
coal bunkers with dark, uneven heaps, small flagstone paths and washing
pegged between two posts. Household differences are stable and restrained:
brick ranges from soot brown to muted red, caps sandstone, slate blue grey,
doors faded sage or brown, clothes warm linen with a few grey blue garments.
No lawn ornaments or saturated props. Nothing crosses the site boundary,
occupies a pavement, or expands into the exit routes.

A privy is about 1.2 m square and 2 m tall, a coal bunker about 1.25 m wide
and 0.65 m tall. Yard walls are about 1.1 m tall with distinct coping.
The narrow gaps require side-facing privy doors opening into the wider plot,
rather than doors with no clearance against the house back. Washing posts
stand about 1.8 m tall, with recognizable sheets, shirts and short trousers.
The desktop's 49 degree view and phone's steep view should both read the
low roof shapes, capped walls and varied yard objects at their actual size.

Level crossings retain their current placement and height/safety contract.
Make rail-deck timber planks, flange gaps, darker board ends, fasteners and
stone/sett edges distinct. Keep existing raised/lowered hinge matrices and
instance ownership. Add a modest white framed barrier above the striped
boom, with a circular red reflector facing either approach. Engineering
forms must remain crisp: collars, posts, signal hoods, rail gaps and painted
barrier surfaces. This is a small pedestrian crossing, not a vehicle bridge.

## Integration and review contract

Merge static fittings by material; instance the existing moving barrier
geometry. Cloth still uses one GPU time uniform and fixed pegged tops.
Use the shared procedural materials, preserve low-tier stability, and add
no per-frame geometry, object allocation, lighting or simulation work.
The source geometry remains detailed at every tier; incidental washing and
bird detail may reduce while walls, privies and crossing structure remain.

No local rendering or listener is authorized for this pass. The inspected
images above establish the defect, not acceptance of the new geometry.
Claude's next desktop/phone render and motion review must judge the result.

## Implementation and validation evidence

Implemented source geometry in `town-life.ts` and `crossings.ts`. The yard
planner measures opposed rows and their shared frontage, fills the first
perimeter terrace before outer blocks, and caps the result at 300 plots.
Brick party walls have separate sandstone coping. Privies have actual open
wall construction around recessed side doors, a slate lean roof and vent;
coal bunkers have plank sides and a faceted dark heap. Short wooden gates
break shared rear boundaries. Small stone paths lead out from house backs.
Washing avoids privy plots and has fixed pegged tops and shaped garments.

The crossing has alternating timber boards, darker exposed board ends,
small bolt heads and jointed stone/sett edges. Both rail flange gaps remain
open. The existing moving arm gains a white frame and round red reflector;
its hinge transforms, admission rules, warning, dwell and occupancy behavior
are unchanged. Shared `Materials.tiled()` supplies the surface structure and
the world's late-light floor. Supplied materials remain owned by the world;
isolated constructors own and dispose their fallback material cache.

Offline Node construction of the actual ground/scenery, without added
off-site rivers, produced:

| Map | Yard plots | Perimeter plots | Washing lines | Yard triangles | Crossing triangles |
| --- | ---: | ---: | ---: | ---: | ---: |
| Meadow | 300 | 240 | 44 | 73,920 | 26,568 |
| Harbour | 300 | 180 | 44 | 73,140 | 22,140 |
| Ridge | 300 | 248 | 44 | 72,028 | 26,568 |
| Capital | 300 | 252 | 44 | 72,396 | 35,424 |

Yards use seven merged batches plus one bird batch; crossings use ten
batches including the local halo. Neither change adds per-frame geometry,
object allocation or CPU loops: yard motion keeps its single time uniform,
and gates retain their existing matrix updates. High/balanced/low draw
44/28/14 washing lines with both cloth and support geometry reduced together.
Walls, roofs, bunkers and crossing structure remain at all tiers. Yard
construction measured 39–82 ms in Node after the existing scenery generation;
these are CPU/source figures, not phone or GPU acceptance.

Targeted `node --test tests/rota-yard-details.test.mjs
tests/rota-neighbourhood.test.mjs` passed all nine tests. The new geometry
check walks actual generated vertices on all four maps: none enters the
site, house footprints or physical exit corridors. Further checks protect
rail flange gaps, deck height, framed gates, tier reductions and shared
material lifetime. Existing crossing tests still verify warnings, both
traffic directions, wagons, restarting vehicles, pedestrian occupancy,
reopening dwell and reduced-motion flashing. Only the owned TypeScript and
test files were formatted. Root will coordinate the full typecheck and
requested broader suite.

The new geometry has not been rendered locally. Claude's second desktop,
phone and motion review is still required to judge density, period
silhouettes, small-scale crossing legibility, late-light balance and phone
GPU cost. The four first-pass images above were inspected to identify the
defects; they are not evidence of acceptance of this second pass.
