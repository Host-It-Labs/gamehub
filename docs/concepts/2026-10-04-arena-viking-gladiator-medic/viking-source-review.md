# Viking source, runtime and final review

The accepted Viking is a stocky adult Norse warrior with a short blue wool
tunic, a padded grey pelt mantle, ginger beard and two bound braids. His
riveted iron nasal helmet has no horns. The face has authored cheek, brow,
nose and jaw planes; the beard wraps the jaw and hangs in rounded tapered
locks. Cloth folds connect shoulders, armpits, waist and thigh tension.
Continuous palms, curled fingers and thumb webs enclose the actual ash haft.
The bearded axe has a hollow forged socket, broad blade faces and a narrow
working edge. Original gameplay identity, body scale and timing remain.

The parent independently accepted detailed source v8 before reduction, then
runtime v4 after matching static cameras and complete actual-renderer motion.
The subsequent close-tower motion correction also passed independent source
and runtime review on 5 October 2026. The source, runtime and portrait bytes
below are held. The parent owns selective production integration.

## Retained sources and measured cost

All work paths below are relative to the repository root.

| Artifact | Path | SHA-256 |
| --- | --- | --- |
| Detailed editable master | `work/arena/2026-10-04-vgm/viking/review-v8/viking-source-master.blend` | `40f32c24970668ca3e9c0e408405ece6c2c8a5f39c125f148140440199620351` |
| Detailed standalone GLB | `public/3d/arena/dev/vgm-viking-source-v8.glb` | `ae90f1113102dc7a2a0f749ad838e0ae1cc454de447c4420ff9e866f689c3f85` |
| Separate optimized master | `work/arena/2026-10-04-vgm/viking/runtime-v4/viking-runtime-copy.blend` | `6b2ea0756b0cb2f6ebb200bc575fe6d5a3ab249a315c3152ff2610fef5b19574` |
| Accepted runtime GLB | `public/3d/arena/dev/vgm-viking-runtime-v4.glb` | `9ec051c71f7f9664e88e931b7ce6860b1400ef335e119cfa91800905b306e8bc` |
| Tracked runtime data | `assets/arena/blender/figure_viking_runtime_v4.json.zlib` | `037e3ee141d140e0a9fa24f2fc540a2a46b7f32453ed8f07141348da2c7b3d93` |
| Fresh painted portrait | `assets/arena/cards/card-viking-v8-a.png` | `1687ab16ef790872653c144aa603f303f5ee0d9072ce3d29feb7b905454a5abd` |
| Exact portrait prompt | `docs/concepts/2026-10-04-arena-viking-gladiator-medic/portraits/viking-v8-a.txt` | `1367b279c9d4bbaa190a3c4751bdb38b3b7e4e4edf2fc138e233c64c05e6cd34` |

The detailed source has **1,410,326 exported triangles / 48,487,560 bytes**.
Dense continuous palm and beard sculpt unions account for much of that cost.
The full master retains hidden editable component guides. Runtime v4 has
**18,888 exported triangles / 64 material primitives / 20 materials /
1,210,660 bytes**, below the inherited **19,676 triangles / 69 primitives**.
Its Blender mesh reports 18,893 triangles before five degenerate triangles
are omitted by export. The retained v4 and the reconstruction both emit the
same head/beard validity warnings; all exported surfaces are preserved.

Exact source snapshots, masters, logs and review images remain in
`review-v8` and `runtime-v4`. Current private builders, moves, tests and cache
are frozen under `work/arena/2026-10-04-vgm/viking/final`. The machine-readable
delivery report is `final/viking-delivery.json`.

## Source reconstruction and runtime contract

`figure_viking.build()` and `build_master()` reconstruct the detailed source.
All 32 preexisting function/class definitions remain semantically identical
to accepted v8. `figure_viking_sculpt.py` remains byte-identical. The fresh
detailed rebuild in `source-identity-rebuild` preserves every position,
normal, UV and white AO stream and every oriented physical triangle; five
index streams differ only in ordering. See `source-identity-audit.json`.

`figure_viking.build_runtime()` lazily calls
`figure_viking_runtime_cache.restore()`. The tracked compressed data holds
the accepted runtime's mesh polygons, split edges, encoded corner normals,
UVs, genuine baked AO, materials, hierarchy and authored rest. It is
self-contained and does not load an ignored `.blend` file. Encoding the
actual `INT16_2D` normals avoids a second quantization when decoding and
reapplying them. Retaining the bake avoids scene-dependent or sampled AO
changes when other figures already occupy the build scene.

The returned root carries `arenaReviewedAO=1`, `arenaReviewedRestPose=1`,
`arenaAOSamples=64`, `arenaAODistance=0.17` and reviewed master/GLB/cache
hashes. Its five-degree head rest is included once. The normal collector
must skip generic head tilt and AO rebaking for this reviewed runtime root.
`build_runtime_recipe()` retains the procedural component reduction recipe
for future source edits; its new output requires review before replacing the
accepted snapshot. The current accepted geometry is held.

An isolated fresh cache export and the parent's normal Viking-only collector
produce SHA `c5921211dd5818e43b789eb3687f8134447fc44db48ccf07983357eaba530a50`.
All **256 position/normal/UV/AO streams are byte-exact**, every oriented
semantic triangle matches, and material JSON matches. Head/eye/pupil
transform arithmetic differs by at most `7.45e-9`. Root provenance metadata
changes the GLB file hash. Evidence: `runtime-cache-audit.json`,
`collector-reviewed-cache-parity.json`, the reconstruction scripts and logs.

## Joints and materials

The existing root/torso/head, paired shoulders and legs, knees, feet, beard,
skirt panels, brows, eyes, pupils and mouth remain. Explicit `foreL/R` and
`handL/R` joints preserve the bent-elbow hold; the axe is beneath `handR`.
The shoulders share height and depth. Equal x pitch lifts the complete hold
while forearms, wrists and weapon remain at their authored zero offsets.
Both hand nodes carry actual local `gripCentre` and `shaftRadius` metadata.
The offhand is 0.24 source units along the haft from its dominant grip.

Materials use existing `skin`, `hair`, `weave`, `hide`, `gilt` and small face
paint families. Skin and nails are warm matte surfaces; ginger hair and grey
fur have restrained highlights. Wool and cream bindings use cloth weave,
pouch/bracers use brown hide, and iron/bronze/bevel use worn metal finishes.
Authored geometry supplies broad folds, hair locks, seams and forged shape.
Source clay views have white AO to expose primary forms. Runtime retains
its genuine 64-sample, 0.17-distance vertex AO bake.

## Motion and tower contact correction

Normal attack still completes its circular sweep in 0.5 seconds; rage below
half health uses 0.4 seconds. The complete two-hand hold stays connected
during walking, stopping, winding, full spin, recovery, deployment, impact
and reduced motion. A modest shoulder carry outside the level spin prevents
the long blade striking the floor during gait compression and recovery.

The first native close-tower audit exposed substantial stone intersections
in the haft/blade and the left palm/forearm. `vikingStoneGuard()` now eases
the whole hold to a 2.15-radian overhead guard before its long blade reaches
nearby stone. Only that nearby pose braces the torso upright and cancels
the shared turn bank. Engine position, collision radius, model proportions,
full spin and attack timing are unchanged.

The Viking-only post-pose boot correction measures referenced posed sole
vertices, uses the existing leg IK and retains the sole orientation in model
coordinates below the global width/squash scale. This removes the prior
turning sole shear while keeping feet planted. Its status bar follows the
actual posed helmet bounds. These are isolated Viking call sites and helpers;
no general spring/physics or other character method is changed by this work.

Three final native suites each cover **24 cases × 180 frames**: king and
princess towers, portrait and landscape scales, straight/corner/back attacks,
rapid turning, passing and deployment. Normal, rage and rage/reduced each
report zero contained vertices, edge penetrations and reverse surface
crossings. Minimum ground values are `-1.75e-7`, `+1.37e-6` and `+8.32e-6`
respectively; the first is within the `1e-6` numerical tolerance. Minimum
helmet/bar clearance is positive in all suites (`+0.00696` or better).
See `tower-guard-final-standard-contacts.json`,
`tower-guard-final-rage-contacts.json` and
`tower-guard-final-rage-reduced-contacts.json`.

These audits use the real native renderer, animator, material cloning and
contact solve, with flat ground and canvas construction substituted for
GPU/browser work. They inspect every referenced posed vertex and both
triangle-edge directions at 60 Hz. They establish the recorded discrete
cases; they do not prove continuous swept contacts or mobile GPU performance.

## Independent visual review and focused checks

V2 source review rejected a beard curtain, paper pelt, inflated shoulder caps,
mechanical wrist openings and a barrel tunic. V4–v8 corrected those primary
forms, ending with a jaw-centred volumetric beard, rounded mantle and broad
cloth tension. V8 clay/colour front, side, rear, game, face/fur, both palm/thumb
webs, grip/axe and motion extremes passed independent review.

Runtime v1 lost primary silhouettes; v2 had jagged hem, broken wrap shading
and blade normals. Structured garment/wrap/blade topology and matching
component normals corrected those failures. V4 source/runtime same-camera
comparisons and complete free motion passed before tower contact testing.

The parent opened all three `source-tower-guard-rage-sequence-*.jpg` sheets
and all fifteen `tower-guard-{normal,rage,turn,deploy,rage-reduced}-sequence-*.jpg`
sheets. Together with previous free cycles, these passed final motion review:
the circular overhead attack, connected grip, planted turns and clear stone
remain convincing. Matching `.webm` recordings and browser samples are in
the Viking work folder. Correct grip measurements in weapon coordinates
cancel the global nonuniform figure scale; worst offhand error is `2.16e-8`
and worst dominant grip error is `4.11e-8` across those new samples.

Four focused tests pass: complete-state locked grip, original attack timing,
exported grip/pivot closure through high pitch and full yaw, and actual posed
sole contact excluding unused vertices. Scoped Viking lint and formatting
pass; the shared renderer is separately checked while concurrent agents own
their changes. Parent owns final combined game/asset/viewport verification.

The portrait is a fresh image generated from its retained written brief with
no image references. Parent independently accepted its helmet, two ginger
braids, two-hand grip, material separation, action and absence of lettering.
The exact original PNG and prompt are retained; portrait processing and map
integration belong to the parent.
