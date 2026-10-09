# Dino and Sumo: fresh figures and matching portraits

**Status: rejected by the user.** Dino still read as a large chicken and Sumo
as an inflated figure with awkward arms. The measurements below describe
that rejected version. The subsequent [quality-first rebuild](../2026-10-04-arena-quality-rebuild/brief.md)
supersedes this design; technical checks did not establish artistic acceptance.
The earlier contact measurements used a rounded-footprint approximation. A
later check against the actual closed coping meshes found a remaining Dino
overlap. They are historical results, not the current collision acceptance
gate; the quality rebuild repeats contact against the exported stone geometry.

4 October 2026. The user rejected both previous character designs and asked
for complete new sculpts. Build and render from the written character briefs
below. Both card portraits were also generated independently with the built-in
imagegen tool, from exact saved text prompts and without image references.
Preserve all earlier artwork and the original sculpt sources and figure bundle.

## Dino

An appealing, powerful tyrannosaur collectible in polished jade, with a warm
ivory throat and belly, restrained cobalt team accents, and large amber eyes.
Recognizable T-rex anatomy: enormous rounded rectangular skull, short neck,
two tiny clawed arms, muscular thighs, articulated calves and three broad toes.
An expressive alert face has shaped brows, a broad snout and a few clearly
sculpted ivory teeth. Remove the busy gold edged armour, horns, tiny scale
tiles and muddy surface grain. The body has an athletic flowing profile. A
short tail curls nearly vertically above its rear hip, inside the torso's
horizontal clearance, so its bulk cannot trail across neighbouring buildings.

Preserve bite, roar, expressive eyes, the named three-link tail, hips, knees
and ankles. Keep its established inner 0.78 scale. Shared normals and rounded
knee overlaps soften moving seams. Paint full cage rings before subdivision
for smooth tail bands. Limit tail animation travel for this short upright
sculpt; retain gentle fidgets without the previous long-tail swings.

## Sumo

A dignified, robust adult wrestler with a strong broad chest and shoulders,
thick proportioned thighs, substantial calves and planted bare feet. Shape the
pectoral muscles, soft abdomen and waist as a continuous sculpt; avoid a ball
body with tiny limbs. Warm satin skin, a deep cobalt silk mawashi with layered
folds, an orderly ivory sagari fringe, and oiled black hair folded into a
compact topknot. A calm focused adult face has a wide angular jaw, bright clear
eyes, strong brows and a closed mouth. Large open palms carry the slap.

Preserve torso, head, shoulders, elbows, wrists, hips, knees, ankles, hair and
fringe joints and the grounded alternating palm strike. Continuous limb cages,
shared split normals and hidden joint overlaps soften elbow and knee seams.
Keep material contrast readable from the high mobile camera. Avoid caricatured
teeth, puffed cheeks, a tiny head and segmented spheres.

## Portraits

Keep the existing square painted action-card language: bold chunky cartoon
forms, readable faces, soft cel shading and a simple fully opaque backdrop of
the character's era. One character fills about 85–90% of the picture, eyes on
the action beyond the frame, with quiet top-left background for the cost badge.
No text, card frame or UI. Dino charges in a Cretaceous fern jungle; Sumo drives
a palm strike across an Edo-period clay ring. Match the new jade/ivory/amber
T-rex and angular adult Sumo with cobalt mawashi and ivory fringe.

Selected sources are `assets/arena/cards/card-ogre-v8-a.png` and
`card-sumo-v8-a.png`, opaque 1024×1024 PNGs. The built-in tool returned 1254×1254
originals; these are retained untouched under the work directory. The first
Sumo candidate was too realistic for the existing set. Retain it as
`card-sumo-v8-a-fail-1.png`; a new independent generation from the revised
written style brief supplies the selected version. No previous image was
passed into the retry. Exact prompts are in `prompts/` beside this brief.

Production portraits use the existing 480×480 Lanczos3 WebP, quality 86,
effort 6. Only the ogre and sumo card manifest entries and their source mapping
changed. The other 22 card entries, textures and models stayed equal during
this card update. All earlier source images were retained. Original public
files were left in place during integration for the root task's asset cleanup.

## Figure bounds and integration evidence

The final GLB is `/3d/arena/models/figures-ac58b110.glb`, 21,744,972 bytes.
SHA-256:
`ac58b11091c81fded569fd5868e21a9bdaca4ccf95a8a6f06f4ac020cb81284c`.
Filtered exports contain 18,838 Dino triangles and 12,310 Sumo triangles,
keeping Sumo below the existing 12,500-triangle person budget.

These are exact vertex measurements of the neutral exported figures, after
their existing inner scaling. Core includes the torso, thighs, calves and
feet; it excludes striking arms, Dino's snout and its tail. Horizontal radius
is measured from vertex positions, rather than a bounding-box diagonal.
Maximum portrait horizontal scale is 3.1211 × 1.12 = 3.495632.

| Figure region                     | Native radius | Maximum portrait radius |
| --------------------------------- | ------------: | ----------------------: |
| Dino core, including planted feet |      0.364107 |                1.272786 |
| Dino torso                        |      0.320801 |                1.121404 |
| Entire upright Dino tail          |      0.353078 |                1.234232 |
| Sumo core, including planted feet |      0.370467 |                1.295015 |
| Sumo torso                        |      0.345647 |                1.208254 |

Native Dino core bounds are x −0.362493…0.362493, height
0.000780…1.272032, depth −0.303055…0.319780. Its complete upright tail bounds
are x −0.102027…0.102027, height 0.934056…1.508367, depth
0.138532…0.352729. Native Sumo core bounds are x −0.345591…0.345591, height
0.007014…1.256474, depth −0.287608…0.314173.

The compact merge replaces only the ogre and sumo scene roots. The other 23
roots preserve exact node transforms, material definitions, accessor contracts,
and raw geometry, index and AO buffer bytes: archers, balloon, bee, beekeeper,
diver, drake, drummer, duelist, explorer, firefighter, gladiator, guard, gunner,
imps, inventor, jetpack, linebacker, mage, medic, miner, pirate, ranger, viking.
The merged bundle is 517,160 bytes smaller than the original. Detailed native
bounds, merge equality and portrait evidence are stored beside this brief.

## Validation and review boundary

56 of 56 focused tests pass across figures, models, faces, gait, walk,
animation, October motion and September motion. After portrait integration,
the nine figure and model asset checks pass again. The Ogre move and asset
mapping script pass scoped lint; the modified source and manifest diff has no
whitespace errors.
Portraits were compared against the previous set at 240 pixels and inspected
at the 90-pixel hand size. Both are fully opaque; faces, silhouettes and the
key colour/material cues remain readable.

The reviewer measured actual TroopView walking/IK geometry on the final merged
GLB, over 240 frames per case at portrait horizontal scale 3.495. Unconstrained
feet extend farther than the neutral core:

| Figure feet | Normal walk radius | Haste walk radius |
| ----------- | -----------------: | ----------------: |
| Dino        |             1.3661 |            1.4918 |
| Sumo        |             1.4314 |            1.4992 |

These are free-walk measurements and do not establish building clearance.
The renderer now constrains contacting feet with joint IK, preserves each
ankle's pitch and heading, and limits body lean against standing stone. The
body's path centre stays unchanged. The final 17 animation tests pass, including
actual-geometry checks for all ground troops at normal, haste and 1.62× Quest
speeds, rounded corners, sustained turns and reverse-facing attacks. Negative
controls reproduce the previous Drummer toe and Dino/Samurai torso overlaps;
distant and destroyed towers preserve the original free poses.

The final posed-vertex probe measures minimum Dino torso clearance +0.00833
and foot clearance +0.01111; Sumo torso +0.09571 and feet +0.19724. The checked
Samurai coat clears by +0.00872. Lean corrections in these cases stay below
2.9° for Dino and Sumo and 5.3° for Samurai. Reproduction and detailed results
are in `work/arena/2026-10-04-contact/probe-contact.mjs` and
`posed-contact.json`. These probes cover flat-ground torso and foot geometry;
flying figures and corpse fades retain their existing animation.

Browser review uses the actual Arena game at phone, tablet and landscape
sizes. A 390×844 drag shows the same stats as a selected card and clears them
when canceled; page dimensions match the viewport. Responsive mouse input and
keyboard access were checked. Physical touch was not available in this browser.

The integrated Arena suite passes 219 of 219 tests with two files running at
once. The fully parallel run hit the draft fixture's shortened 400 ms pick
deadline during heavy geometry tests. The test clock now allows 1.5 seconds
for its live API assertions and still picks for the silent guest. The production
draft clock keeps its existing value. Typecheck, global lint, scoped formatting,
asset checks and the production build pass. Localhost access is required for
online fixtures and the build's route pre-renderer.

A compiled same-realm CPU probe, after warmup and without GPU rendering,
measures contact at about 0.11–0.19 ms per unit per frame. In the most costly
checked cases, the contact solver adds about 0.03–0.06 ms over free poses.
These desktop CPU measurements are not mobile frame-rate acceptance. Detailed
measurements are in `work/arena/2026-10-04-contact/native-cpu-probe.json`.

Original backups, filtered exports, build logs, studio front/side/back renders,
thumbnail comparisons, merge script and test log remain in
`work/arena/2026-10-04-figures/`. Studio renders show the previously reviewed core
and face; the last Dino export only compacts its tail and the last Sumo export
only shortens toe reach. Browser review uses the final merged asset.
