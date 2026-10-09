# Trivia tower: authored architectural miniature

Written before modeling, 4 October 2026. This source implements William's request
for detailed animated 3D Tower elements within Trivia's warm measuring desk.

## Subject and proportions

Each player builds a collectible sandstone observatory. Its personality is
precise, curious and a little celebratory: a satisfying machined foot, an arcade
on every earned tier, a copper-bound teal roof, a small glazed lantern and a
real cloth pennant. It must read as coherent architecture at a six-player phone
size, rather than an arrangement of plain colored blocks.

The tower is centered on x/z, y-up, with the base touching y=0. Its widest base
is about 1.25 units, the stone tower is about 0.9 units wide, base height is 0.35
and every earned floor is exactly one 0.38-unit arcade tier. The editable master
supports zero to twenty floors in new matches, and up to twenty-five for older
five-round saves. The narrow rhythm of repeated cornices remains
countable while a stronger lacquer band on each fifth tier marks a group of
five. The crown never substitutes for an earned floor.

## Structural landmarks

- A stepped octagonal lacquer and brass foot, rounded stone curb, inset eight
  point compass relief, and three shallow front stair treads. The stairs are
  integral to the foundation, not floating against it.
- Each tier has a continuous gently tapered stone drum; eight dark arched
  window niches with thick extruded archivolts and stone voussoirs; small paired
  columns; a sloped cornice with a sharp brass edge; and long vertical ribs at
  the corner angles. Arches and horizontal belts must read from three quarters.
- The crown has an open-looking glazed lantern, projecting roof eaves, a curved
  patinated teal dome, intentional copper ribs following the dome's curvature,
  a turned brass finial, and a raised flagpole with attachment rings.
- The cloth tapers to a swallow tail, has a hem and a broad warm cream symbol.
  Its geometry already carries folds at rest; moving fabric stays attached to
  the pole and has progressively greater motion toward the free edge.

## Materials and detail hierarchy

Primary surfaces are soft ivory sandstone (roughness around 0.78), warm pale
stone cut faces, dark honey lacquer (around 0.35), oxidized teal roof (around
0.55), warm copper ribs and polished brass inlay. Windows are recessed dark
teal with muted seat-colored enamel, not emissive lights. The seat color occurs
in measured bands, window shutters and the pennant. It never recolors all stone.
Stone has restrained authored course variation and beveled edges; metal has
clear specular lines; cloth is opaque, double-sided and rough. Do not add random
noise or identical bumps to every surface.

The first read is the tower's taper, repeating projecting tiers and domed crown.
The second is paired columns, arch silhouettes and roof ribs. The third is
individual wedge stones, brass inlay, cloth stitching and relief. Preserve the
editable construction and curves; runtime improvements must be based on
observed cost after the silhouette has been reviewed.

## Motion and integration contract

`createTriviaTower(color, maxFloors = 20)` returns `root`, `floors`, `crown`,
`flag`, `floorHeight`, `baseHeight`, `wave(timeSeconds, reducedMotion)` and
`dispose()`. The root contains all components. Floors are initially hidden and
their group positions are `baseHeight + index * floorHeight`; every tier's
authored geometry runs from local y=0 to y=floorHeight. The scene owns visibility,
placement and all requestAnimationFrame work. The crown starts at baseHeight
and the scene moves it to `baseHeight + visibleFloors * floorHeight`.

For a new floor the scene may lift the roof before dropping the whole tier from
above, settle it with one small weight-bearing rebound, then lower the roof.
The tower never stretches to represent a new floor. Cloth movement is subtle
and propagates from its fixed edge. `wave` accepts reduced motion and restores
the quiet authored rest shape. Shadow casting and receiving are enabled on the
architectural meshes; no private lighting or color management is installed here.

## Required review and limits

Review front, side, rear, silhouette/clay and close crown/window views under
neutral lighting; then a three-quarter desk camera at six-player portrait scale
and a full new-floor cycle. Look for clipped roof silhouettes, collapsed arches,
metal that looks like plastic, floating stairs and fabric detaching from its
pole. The parent owns real-scene screenshots and motion review before acceptance.
Count triangles and meshes for the authored source once code exists. Passing
geometry/type checks is evidence of valid construction, not visual approval or
physical mobile GPU performance.

## Authored source measurements

The finished code was measured with Three.js 0.186.0. Bounding boxes below only
include visible meshes; `Box3.setFromObject` also includes hidden tiers and
therefore must not drive the scene's camera fit directly.

| Visible tiers | Meshes / color-pass draws | Triangles | Height |
| ------------- | ------------------------- | --------- | ------ |
| 0             | 8                         | 23,480    | 1.414  |
| 1             | 11                        | 56,856    | 1.794  |
| 5             | 23                        | 190,360   | 3.314  |
| 20            | 68                        | 691,000   | 9.014  |

Width is 1.129 and depth is 1.160 at every height. The ordinary tier is 33,376
triangles across three finish meshes. The source shares those exact geometries
between tiers instead of allocating a separate vertex buffer per floor. Shadow
passes add renderer work beyond the color-pass mesh counts above. Six maximum
towers therefore represent 4,146,000 submitted source triangles; measure the
actual scene before deciding on a runtime copy. No LOD or decimation has been
performed before visual review.

Verified construction evidence: the tower's standalone TypeScript check and
Oxlint pass; positions and normals are finite; octagonal profile side normals
face outwards; repeated disposal is safe. Two sampled moving cloth poses reach
0.02854 units of free-edge movement while the pole edge stays fixed. Reduced
motion restores the exact authored rest positions.

## Source visual review

The root and tower author independently opened the parent scene's
[front](review/tower-source-front.jpg), [side](review/tower-source-side.jpg),
[rear](review/tower-source-rear.jpg) and [clay](review/tower-source-clay.jpg)
images. The source has a coherent octagonal foundation and countable arcade
rhythm; columns, actual arch recesses and projecting cornices remain distinct.
The crown has an uninterrupted silhouette, a materially separate teal roof and
copper ribs, and attached cloth/pole. Stairs meet the foundation. No obvious
silhouette clipping, floating architectural parts or weak primitive joins were
visible in these views. The clay view has fairly soft contrast, so source
closeups remain useful when judging small relief.

The root accepted these source forms for runtime comparison. This records
technical and artistic review by the agents, not user approval. Complete motion,
phone-scale readability and physical mobile GPU performance still require the
parent scene's review.

## Optional settled-floor instancing

`batchSettledTowerFloors(tower)` preserves the original editable source factory,
per-floor group positions, drop hooks, every geometry buffer and material. It
returns `root`, `sync(settledFloorCount)`, `release()` and `dispose()`. Its empty
root attaches inside `tower.root`, initially hidden. The scene sets the usual
floor-group visibility and calls `sync` after construction settles. The helper
snapshots the first settled visible tiers in tower-local space, hides only their
source mesh children, and submits the identical geometry/material as instances.
The crown and flag remain dynamic.

`release()` hides the instances and restores the original source-child
visibility before another drop. `sync(0)` also restores source visibility and
draws no instances. Decreasing and increasing counts rebuild accurate instance
bounds. `dispose()` releases the instance matrix buffers without disposing the
shared source geometry/material; `tower.dispose()` calls it automatically.
Repeated release/disposal is safe. The source factory shares the unchanged stone
and brass masters between ordinary and milestone tiers; only the enamel belt
requires a different geometry. Therefore there are at most four floor batches.

| Visible tiers | Source draws | Settled draws | Identical triangles |
| ------------- | ------------ | ------------- | ------------------- |
| 0             | 8            | 8             | 23,480              |
| 1             | 11           | 11            | 56,856              |
| 3             | 17           | 11            | 123,608             |
| 5             | 23           | 12            | 190,360             |
| 20            | 68           | 12            | 691,000             |

These are measured color-pass mesh counts, excluding the shared desk and other
scene objects. Six twenty-floor towers drop from 408 to 72 color-pass draws
(82.4% fewer), with the same 4,146,000 submitted triangles. Shadow passes also
benefit from instancing. This reduces draw overhead; it does not claim a
reduction in fragment work or geometry fidelity.

Standalone validation exercised counts 0, 1, 3, 5, 20, then shrinking to 3 and 0
and growing back to 20. Triangle totals match in every source/batch comparison.
Exact source geometry and material identities are retained. Root translation,
rotation and nonuniform scale plus a rotated/scaled settled tier yielded a
maximum source/instance world-matrix difference of 0.000000259 units (the
instance buffer's float32 rounding). Two hundred full twenty-tier sync calls
averaged 0.225 ms in local Node; the scene only needs a sync when construction
settles. Standalone TypeScript and Oxlint pass. Actual renderer pixel comparison
and physical GPU performance are the parent's remaining verification steps.

## Integrated review

The parent subsequently reviewed identical-source and runtime renders, full
build/settle/cloth motion, six-player portrait framing and neutral clay lighting.
The [final implementation record](verification.md) contains the actual-renderer
evidence and measured draw reduction. Physical GPU profiling remains untested.
