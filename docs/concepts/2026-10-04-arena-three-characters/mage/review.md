# Wizard source review

Root review is independent artistic review, not user acceptance. The source
author opens and checks evidence before handing it over. No runtime reduction
starts before the detailed source passes root review.

## Original and source v2

The original source, private kit and move module are preserved under
`work/arena/2026-10-04-three-characters/mage/originals`. Source v0 front/side and
native GLB are retained in `mage/v0`. The original has hard sleeve cuts, a
single solid grip, a smooth beard oval and sharply faceted skirt sections.

Opened v2 clay front, side and rear. Its source is 443,970 triangles, 116
editable mesh components, 16 materials and 14,396,776 GLB bytes. The native
waist/shoulder/elbow/wrist/staff frames are preserved; measured knee and ankle
frames are restored exactly. Boot visibility, separate gripping fingers and
continuous sleeve/cape/hat topology are improvements. The beard still reads
as uniform parallel cords and the torso as a smooth inflated vest.

The root opened clay-front and rejected the source in this state. Requested
four to seven main beard locks with subordinate ridges, clear cheek/chin and
moustache transition, restrained cloth tension from belt/shoulder/armholes,
and a credible visible hat bend. Full side/rear/hand/cast and moving evidence
remain required. Clay and pose review now uses neutral-lit Eevee so it does
not compete with the other tasks' long Cycles work.

## Source v3 refinements

Fixed the lock frame's width/depth swap. Seven unequal broad beard masses
curve into different tails, with subordinate longitudinal ridges; short
cheek-to-chin locks and a fuller moustache bridge into them. The chest has a
tailored flatter section with sloped shoulders and authored diagonal folds
from the belt and armholes. Elbow compression aligns with the real bend
plane. The separate handR wrist frame shares the exact staff pivot and follows
its turn/slide with the same spring, retaining grip contact over casts.

The v3 source bake was stopped after its native process sample showed repeated
Cycles object-bake initialization. Its exact sculpture/review helpers, build
log and process sample are preserved. The source was rebuilt as v4 with direct
neutral Eevee evidence and authored pigment. Root approved retaining that
pigment with actual renderer lighting rather than another long AO bake.

## Source v4 review

The full set of fifteen clay, material, face, grip, palm, fabric, intended-game
camera, cast and loaded-step images is preserved in `mage/v4`. Its editable
master is 445,490 triangles, 118 mesh components, 15 materials and 14,460,084 GLB
bytes. `mage-master-v4-before-ao.blend` and the final editable
`mage-master-v4.blend` are retained alongside the filtered native Mage GLB.

The source author opened front/side/rear, finish, face, grip, palm, fabric,
cast and loaded-step views. The seven unequal beard locks now have distinct
curves and tails; chest tension, separated boots, bent felt hat and connected
sleeves read clearly. The finish differentiates cobalt cloth, charcoal mantle,
leather, silver, old gold and skin. At macro scale the casting-hand nails remain
too round and the tightly flexed elbow still has a smooth surface; these are
recorded limits, not hidden by thumbnail views.

The root independently opened the primary full set and accepted the anatomy
and material source on 4 October.

## V5 nail correction and staff motion

V5 reads the exact saved V4 master and replaces only four round nail objects
with thin, tapered plates aligned to the dorsal side of the curled fingertips.
The source author and root opened the new palm close-up; the raised dots are
gone. V5 retains 444,882 triangles, 118 mesh components, 15 materials and
14,443,924 GLB bytes. V4 is preserved exactly.

The root recorded and independently reviewed complete real Arena walking,
turning, casting, recovery and deployment. Its form/material source passed.
An additional 3,721-frame CPU diagnostic through the real TroopView found
that the inherited side-plane staff solver ignored the final sprung chest,
rolled body and foot-solved pelvis. The physical shoe dipped below terrain
during some fidgets although the gripping wrist remained aligned to it.

The new Mage-only late solver reads the final forearm world matrix and actual
silver shoe vertices, samples terrain there, retains the original bounded
wrist slide and applies every correction equally to handR. Deliberate taps and
overhead sweeps remain free; a recovering raised fist remains lifted until
the staff can reach ground. Root owns its small post-placeBody shared hook.

`tests/arena-mage-rebuild.test.mjs` passes against exact isolated V5. It checks
physical shoe contact and the complete wrist/staff world transforms through
deployment, walking, ten seconds of alternating casts and 45 seconds of idle,
including tap, toss, peering and staff lean. A private copy disabling only the
late solver fails on a casting shoe at -0.07975 world height; the exact mutant
and failed log are retained. Final source CPU diagnostics are preserved in
`v5/source-staff-ik-diagnostic.json` and `v5/source-runtime-final-tests.log`.
The root independently opened the corrected sixteen-second sequence of all
four fidgets and sixteen seconds of walking, turning, alternating casts and
recovery. The actual source movies and complete sequential sheets are retained
as `v5/actual-source-final-*` and `v5/final-*-sheet-*`. Ground contact when
reachable, free raised casts, hand contact and connected garments passed.
The source form, material and motion gate is complete before reduction.

## Independent runtime copy

The original runtime ceiling is 18,548 triangles. The unrestricted V5 remains
unchanged. The runtime helper
collapses neutral mesh topology before the armature, keeps real sleeve/cape/
felt weights, preserves material boundaries and samples source surface normals.
Rigid accessories are consolidated only within the same bone/material;
expressive face controls and the physical staff shoe remain independent.
Authored pigment and actual lighting are retained without another long bake.

V6 stopped before export when Blender invalidated a vertex-group handle after
collapse; its exact helper snapshot and failed log are retained. The helper
now retains the group name and reacquires its new handle. V7/V8 measured
19,188 triangles: material-boundary protection retained more skirt geometry
than expected. Their exact logs/helpers and V8 rejected blend are preserved.

V9 used softer seam preference and measured 17,937 triangles, 38 meshes,
15 materials and 934,832 bytes. The author rejected its visible jagged gold
hem polygons. V10 recovered geometry from less visible surfaces and restored
hard seams at 18,534 triangles and 981,288 bytes, but the free cloth faces
between locked seams collapsed into concave petals. The author rejected that
shape; both full evidence sets and editable copies are retained.

V11 samples the exact source skirt formula with regular connected rows, keeping
all source material-transition rows. This preserves the ordered drape, the
continuous front seam and both complete hem bands. Other surfaces retain
sampled source normals and the reviewed independent reduction. Its measured
GLB is 18,431 triangles, 38 mesh nodes, 54 primitives, 15 materials and 964,740
bytes. One 21-bone skin has six weighted node owners and eleven rendered skin
primitives. Maximum weight-normalization error is 2.98e-8. Actual mixed sleeve
vertices include armL 244, foreL 142, armR 273 and foreR 173. Only COLOR_0 exports.
The exact SHA256 is
`1711ddbc9f7235fea5307d42254726979b937ab9f5e28beddc0c1b559e6413ac`.

The author opened front/side/rear, face, both hands, finish, cast, loaded-step
and intended-camera evidence. Source/runtime pairs use identical cameras,
lighting and poses. Root independently passed the studio silhouette, ordered
folds, face, hand, hat and material comparison. Actual runtime motion remains
the final gate before changing the default builder.

## Bridge contact regression

Independent Samurai review found a separate late-solver defect on the curved
bridge deck: selecting the lowest world-space shoe vertex ignored a higher
vertex with smaller clearance above sloped terrain. Three iterations also
stopped before contact converged. The pre-bridge solver is preserved in V11.

The corrected solver selects the minimum `y - groundAt(x,z)` across every
physical shoe vertex, converges with a bounded twenty-pass loop and validates
actual final contact before reporting staffCanPlant. It preserves deliberately
lifted casts and copies each correction to handR without per-frame allocation.
The production regression checks all physical shoe vertices over 900 walking
frames from the real bridge approach. A private pre-bridge mutant fails with
58.5 mm penetration at frame 20; its source and failed log are retained.

The exact V11 passes both production regressions and all three private candidate
checks for full motion, normalized real weights and wrist contact. An independent
clone proof moves a driven sleeve vertex by 48.6 mm while the other clone moves
zero. Private transpilation instrumentation, without production edits, measures
mean/max solver passes: bridge 2.33/11, ordinary walk 1.89/2, casting 1.27/3,
long idle 2.09/3. Minimum physical clearance stays within the 0.2 mm tolerance.
Samurai independently verified source V5 across all 900 frames: worst clearance
-0.0001995, 764 reachable plants including 197 bridge contacts, exact zero
wrist/staff matrix gap. Original frame 48 and 221 penetrations are corrected.

## Final root runtime review

Root independently opened matching source/runtime front, side, rear, face,
cloth, palm, grip, cast and loaded-step evidence, then recorded the exact V11
in real Arena. Complete sixteen-second walking/turning/alternating-cast/recovery,
sixteen-second four-fidget and six-second arrival/deployment sequences and every
sequential sheet were reviewed. Connected sleeves and stepping boots, readable
face/hands, ordered folds and two hem stripes, mirrored staff grip and deliberate
airborne casts passed. Root also independently ran both exact candidate production
regressions, 2/2 passing. This completes the runtime quality gate; it is not user
acceptance. The accepted V11 GLB remains unchanged.

The default `figure_mage.build()` now loads the exact independent runtime from
the owned neutral `assets/arena/blender/runtime/mage-runtime-v11.blend`. Either
`ARENA_SOURCE_MASTER=1` or `MAGE_MASTER=1` explicitly builds the detailed source.
`build_legacy()` retains the original implementation and debug poses remain
available. `MAGE_REBUILD_RUNTIME=1` explicitly regenerates a procedural runtime
for comparison/review. V12/V13 verified the fresh procedural copy's exact
18,431 cost and both production regressions, and the explicit source's
444,882 triangles/118 meshes. The first two-stage private harness reset
invalidated shared image-cache handles; only that private harness was repaired.
Its failed log and first successful export remain preserved.

Symmetric flame and small book-corner collapse ties differed after fresh
construction, so the final default uses the owned exact neutral cache. V14
fresh export is byte-for-byte identical to accepted V11: exact SHA, JSON,
binary geometry, materials, normals, colors and weights. The full explicit
source flag also passes. All 21 pose bases are neutral; no studio head pose or
debug tilt survives into the default. The current shared dotted-object head
tilt lookup does not alter the native `magehead` armature bone. No broad figure
rebuild, shared-kit change, AO bake or production GLB overwrite was performed.

## Portrait review

The first independent source is retained in
`originals/card-mage-v1-source.png`: it was too realistically rendered and
cropped the hat. The fresh second generation is
`assets/arena/cards/card-mage-v8-a.png`, 1254 square, opaque. The source author
and root opened the full image and `v1/portrait-deck-90.png`.
Its complete bent hat, mature readable face, open palm/flame and crystal staff
pass portrait review. Subdued painted cobalt/charcoal matches the fresh
Dino/Sumo deck. Both exact written prompts are retained in this folder.
