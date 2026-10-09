# Visual review record

These are the root agent's observations after opening the actual source renders.
Technical checks and author self-review are recorded separately. None of these
reviews is a claim of user acceptance.

## Dino clay v1 and v2

Evidence: `work/arena/2026-10-04-rebuild/dino/v1-clay-*` and
`v2-clay-{front,side,rear,three-quarter,game}.png`; editable masters are retained
beside them.

- The horizontal trunk, forward skull and long rear tail establish a more
  recognizable tyrannosaur silhouette than the rejected upright figure.
- v1 failed: abrupt tail/hip transition, exposed round knee overlaps, a smooth
  capsule thigh and lower-leg seams. The game view did not expose face and limb
  structure usefully.
- v2 joins the tail, trunk and neck, but still fails secondary-form review:
  front knees read as disks, ankle cuts as collars, skull and tiny arms remain
  too smooth. Requested cranial/cheek/brow planes, thigh/tendon/hock landmarks,
  recessed knee overlaps and a fused leg-to-foot source before splitting.
- Requested honest portrait and landscape camera angles, an explicit uniform
  runtime scale comparison and a moving joint review before optimization.

## Dino clay v3

Opened `v3-clay-front.png`, `v3-clay-side.png`, `v3-clay-three-quarter.png`,
`v3-clay-landscape-50.png` and `v3-clay-game-55-front.png`.

- Primary shape passes: knee disks and ankle collars are removed; eye/brow and
  cheek planes have definition; tiny elbows bend; the horizontal body/tail
  balance reads as a tyrannosaur.
- Requested more restrained thigh/tendon/hock definition before finish. The
  anatomical surface remains fairly smooth in neutral clay.
- Proceed to deliberate scale hierarchy and distinct materials. Preserve the
  clay master and inspect extreme neck, jaw, tail and leg poses before runtime
  optimization. The foreshortened front view does not replace real portrait
  and landscape review.

## Sumo clay v1

Evidence: `work/arena/2026-10-04-rebuild/sumo/review/sumo-master-v1-clay-front.png`
and `sumo-master-v1-clay-side.png`; the connected editable body is retained in
`sumo/master/sumo-master-v1.blend`.

- Continuous skin is a better deformation foundation, with a weighted lower
  belly, proportionate head and substantial planted legs.
- Shape review fails: separate raised deltoid domes and capsule arm rhythm
  still look inflated. The pectoral groove is a straight shelf across the
  torso. Neck/face planes and hand thickness need stronger anatomical form.
- Requested lower, sloping connected shoulders; subtle biceps/triceps/elbow
  structure; arched softer pectoral transitions into the sternum; cheek,
  jaw, chin and nose planes; thumb-web/thenar/knuckle volume.
- The mawashi has a uniformly flared hard rim and a bulky knot. Requested
  tensioned folded cloth hugging the waist and a smaller credible knot.

## Sumo clay v2

Opened `sumo-master-v2-clay-{front,side,rear}.png` under the same review folder.

- Lower shoulder caps, tapered arms, a weighted lower belly and close-fitting
  cloth are substantially more human. The garment no longer reads as a bowl.
- A straight horizontal chest/back seam remains. The author traced it to a
  discontinuous cross-section power, not only the pectoral groove; it must be
  smoothed before finish.
- Requested smoother shoulder/body union, a helix rim and recessed ear cup,
  nostril/alar definition and restrained lower-leg tendon planes. A clearly
  flexed arm, face and hand close-ups remain required before optimization.
- Earlier v1 elbow deformation was measurable, but its chosen camera projected
  the arm down/behind the torso. That saved view alone did not demonstrate a
  convincing bent joint.

## Surface contract

The new models can use dedicated `skin`, `reptile` and `hair` surface families,
matched in Blender and Arena. Skin has restrained reflectance; reptile scales
use authored relief without the repeating leather normal; hair has authored
ridges. Existing figures retain their material families.

## Sumo clay v3 and v4

Opened v3 front, three-quarter, bent-arm front/side, hand-palm and head-chest;
then v4 front, three-quarter and hand-palm under the same review folder.

- The continuous chest/back section removes the earlier horizontal seam.
  Lower shoulders, tapered forearms, a weighted belly and adult facial planes
  pass primary anatomy review.
- The v2 elbow-to-hip sheet was a weight ownership defect. In v3 the clearly
  flexed elbow stays connected while the flank remains still; the source probe
  records zero movement across 43,420 unrelated flank vertices.
- Requested contained final repairs: separate the fused long fingers, soften
  the front ear edge and smooth the compressed inner-elbow transition.
- v4 improves the ears, but its palm close-up still exposes a bridge between
  two fingers. That detail has not passed; remove it before final source export.

## Sumo source v5

Opened v5 palm, three-quarter clay, bent-arm front/side and material
three-quarter. The finger bridge is gone. The flexed elbow remains connected,
with a plausible compressed crease and a stable flank; the hand retains each
finger. Restrained skin reflection, combed hair and close woven cloth pass
the source finish review. Full animation and exported skin behavior remain
to be checked in Arena before making the reduced runtime copy.

## Dino surface v4 and v5

Opened v4 three-quarter, side and face, then v5 three-quarter, face and side.

- v4 failed finish review: raised button-like scutes and hard rectangular
  pigment boundaries made the head look decorated and exposed joint cuts.
- v5's flatter irregular scutes, matte forest hide and soft ochre underside
  transitions pass the surface direction review. Fine scale detail remains
  subordinate to the skull, ribcage and tail silhouette.
- A source motion probe subsequently exposed rigid tail/neck cracks and knee
  gaps. The author is replacing those split surfaces with connected weighted
  skin. That deformation must pass review before runtime reduction.

## Dino connected skin v8

Opened loaded-step side/three-quarter, roar, turn and bite three-quarter.
The neck and tail cuts are closed; loaded legs and toes remain connected
without the earlier stretched webs. This is a source deformation pass, not a
grounded walking test. Requested a side view of the wide-open mouth's posterior
throat/hinge before accepting its interior finish; full Arena cycles remain.

## Dino export v9 and v11

The actual Arena v9 export failed: its painted primitive arrived with white
vertex colours, although Blender's studio renders showed the intended hide.
That candidate and its recorded walk are retained. The author moved pigment
and occlusion caches into non-exporting generic attributes, then exported
their combined result as the single `COLOR_0` channel.

Opened v11 mouth side and three-quarter. The hanging round oral backing is
gone; the dark throat is recessed behind the teeth and remains connected to
the lower jaw. Opened the actual v11 game views and recorded eight-second
walk/turn, bite/recovery and deployment cycles, then inspected their frame
sheets (`dino/v11-runtime-*-sheet.jpg`). The forest/ochre colours now reach
Arena, limbs stay connected through alternating steps and the head/jaw motion
retains the source silhouette. The source passes moving visual review and can
be reduced as a separate copy. Natural navigation, exact building contact and
the lighter copy's full-cycle comparison remain integration checks.

## Sumo moving source v5

Opened the actual Arena master walking and attacking views and eight-second
recordings under `sumo/review/sumo-master-v5-runtime-*`. The connected shoulder,
elbow and hands retain their shape through turns and alternating palm attacks;
the belly, face, hair and woven cloth remain distinct. The source passes these
moving cases. Its inherited 22 percent whole-body landing compression must be
replaced with a small weighted settling motion and reviewed in the game copy.
The raw export also exposed extra colour channels hiding the active occlusion;
the optimized copy must export only combined pigment and AO as `COLOR_0`.

## Portraits v9-b

Opened both full source images and the 90-pixel comparison with the current
deck. The horizontal forest-coloured Dino and the adult Sumo's open-palm pose
match the new anatomy. Their painted planes fit the deck better than the
preserved photorealistic v9-a candidates. Integrated only these two portraits
at 480 pixels; exact source paths and hashes are in `portrait-evidence.json`.
This is root visual review, not user acceptance.

## Dino runtime r2

Opened all five matched source/runtime views (side, three-quarter, face,
loaded-step and roar). The lighter copy retains the horizontal body, long
tail, skull and brow, jaw attachment, bent hocks and separate toes. Fine hide
relief is softer and the painted transition changes slightly; these are
accepted runtime tradeoffs at the intended field size, with the full source
retained. Recorded and opened the actual eight-second walking/turning and
bite/recovery sheets in `dino/r2-runtime-*-sheet.jpg`. The revised bite reaches
forward with a restrained torso pitch instead of dipping its nose into the
grass. Alternating loaded feet and the tail remain connected.

The normal builder now loads a separate versioned neutral runtime `.blend`.
Its positions, topology, custom normals, weights, pigment, material assignment
and bone rest frames match the reviewed reduction exactly. The detailed
procedural master remains editable. Independent AO rebakes are a separate
colour check, not a claim of byte-identical GLB regeneration.

The normal collector's final Dino export was opened again in Arena. Its matte
hide, mouth lining, teeth and pigment remain intentional after the ordinary
128-sample AO bake. The complete eight-second bite/recovery cycle passes;
geometry and rig equality connect this finish check to the reviewed r2 walk,
turn and landing cycles.

## Sumo runtime v7 and v8

Opened v7 close clay head/chest, palm, three-quarter and bent-arm side, plus
the matching v5 source palm, bent-arm and material views. The larger 24,000
triangle skin preserves adult face planes, shoulder and elbow volume and
separate rounded fingers more convincingly than the rejected small copies.
Opened the actual eight-second walk/turn, palm-attack/recovery and deployment
sheets; a 20-frame-per-second strike detail shows forward palm contact and
recovery. Shoulders and hands remain connected, loaded legs stay grounded,
and the small landing settle replaces the inherited inflatable compression.

v7 failed one finish detail: collapsing the hair erased its combed grooves.
v8 retains that exact skin and resamples the same detailed source hair, rather
than sculpting a different body. Opened its clay head/chest, palm and material
three-quarter against v5. The hair grooves and rounder nail plates pass this
finish review. The complete runtime copy has 34,227 triangles; the detailed
editable source remains separate. Maximum building-guard deformation, the
normal collector export and final integration are separate gates.

## Sumo maximum guard: source failure

Opened v8 maximum-guard clay front/side and material three-quarter, then the
identical v5 master clay front/side. The inward palms and flexed elbows remain
connected, but the compressed armpit projects as a flat hanging flap. It is
also present in the detailed source, so this is a source deformation failure,
not an acceptable reduction tradeoff. Requested a localized shoulder/armpit
weight transition or bounded corrective shape while preserving neutral
anatomy, free gait, face, hand and foot ownership. Exact tower clearance is
separate from this failed visual gate; the final repaired skin must pass both.

## Sumo repaired source v6 and runtime v9

Opened the matching v6 source and v9 runtime maximum-guard clay front/side,
plus runtime material three-quarter. A broad, smooth shoulder/armpit weight
transition replaces the earlier abrupt arm-ownership cutoff. The hanging flap
is gone; the compressed fold remains connected. Neutral positions, normals,
pigment and the distal hands/feet retain the reviewed anatomy. Opened the
eight-second v9 walking/turning sheet and the front palm-attack/recovery sheet.
The repaired shoulders remain connected through those free cycles.

The frozen neutral `sumo-runtime-v1.blend` matches v9 geometry, topology, custom
normals, weights, pigment, materials and all sixteen bone frames exactly before
AO. The ordinary collector's canonical export was opened under Arena's actual
light with `ArenaView.setCamera`, then recorded for eight seconds from the
front three-quarter view. Opened its 20-frame-per-second strike detail. Matte
skin, face, palms, combed hair and woven cloth pass the fresh AO finish check;
the palm strike and recovery retain their connected joints. Evidence is
`sumo/review/sumo-runtime-canonical-v1-front.jpg`, `*-front-attack.webm` and
`*-front-strike.jpg`. Later tower-contact guard angles remain a separate gate.

Earlier attempts to assign `view.camera` did not aim the dev bench: the camera
belongs to `view.world` and the view restores its base each frame. Those older
recordings remain useful for the motion visible in their default camera, but
are not evidence of the attempted custom angle. The canonical front recording
uses the actual `setCamera` method and confirms the requested view.

## Canonical integration

The two ordinary collector exports are integrated as `figures-88d2b5e6.glb`
(22,457,240 bytes). The merge used the latest concurrent `figures-b97920cb.glb`
as its base. All other twenty-three roots retain exact transforms, materials,
raw geometry/index/colour/morph buffers, skin joint names/order and inverse
bind matrices. Four posed comparisons also match every replacement skin
vertex: 48,424 checks for Dino and 61,664 for Sumo. Index renumbering is excluded
from the identity comparison; a separate existing-skin reindex fixture passes.

The runtime copies have 34,418 and 34,227 triangles respectively. Sumo's old
12,500 ceiling visibly lost face, fingers and hair; the current test allows
40,000 only for this independently reviewed replacement. Unchanged figures
keep their existing limits. The detailed source masters remain separate.

## Sumo reduction failures

The first reduction introduced dents, angular fingers and lost facial planes.
Later copies improved the topology and master-derived shading. Root opened
the actual v3 walking and alternating palm-attack recordings: shoulder,
elbow and hand connections remain intact and the matte finish reads well at
field scale. Close author comparisons still expose nose/chin and fingertip
defects in v3/v4, so those exports have not been selected for production.
Later copies reallocated detail to those important forms instead of relying
only on corrected normals.

Exact shipped-tower tests exposed a separate overlap of Sumo's hands during
natural passing and turning. It was confined to the arm-weighted geometry;
the torso had adequate clearance. The connected shoulder/elbow contact repair
preserves the model's body shape and scale. Its later review follows.

## Final Sumo hinge and contact poses

The inherited free slap and an early rear guard both used negative elbow
rotation. A close source hinge check showed reverse bending, so those motions
were rejected even where they cleared stone. The free slap now withdraws from
the shoulder and flexes the elbow forwards. Actual normal, Drummer-tempo,
30 fps and reduced-motion probes keep the elbows between .0902 and 1.2456
radians. First impact and attack interval remain unchanged.

Opened all four matched V6 source/canonical free poses: clay windup front and
side, clay impact three-quarter and material ready three-quarter. Shoulders,
elbows and palms remain connected. The fine source shoulder compression crease
is smoother in the runtime copy; its silhouette remains intact. Opened the
actual final eight-second front walk/turn, alternating attack/recovery and
landing sheets, plus the twenty-frame-per-second strike detail.

The positive rear coil initially brought the fingers into the thigh at inward
shoulder Z ±.50. Opened and rejected it. The final paired source/runtime
front/side/material views use shoulder X −.35, inward Z ±.25, elbow X +.50 and
wrist X +.15. The fingers remain outside the thigh with a normal elbow bend.
The forward guard retains shoulder X +.70, inward Z ±1.10, elbow X +1.50 and
wrist X +.15. No model shrinking, pivot relocation or body distortion was used
to obtain contact clearance.

The final rendered snapshots are combined in
[characters-in-arena.jpg](characters-in-arena.jpg). Each is a separately framed
close view, not a comparison at a common camera distance. Both use the shipped
canonical figures and Arena's ordinary lighting.

## Final moving contact repair

The forward-elbow motion exposed an unsafe fallback at a boosted diagonal
turn: a constant-width prism rejected both reviewed guard poses, then restored
the original palm pose. The renderer now uses that prism only as a fast broad
check, with the cached three-dimensional tapered shell and coping for uncertain
arm vertices. Rotated corner stones and the raised shield/crest are included
in the arm check; testing the plain shell alone missed those small protrusions.
Prediction uses the walking direction and pending facing before the eased yaw.
The actual clearance margin stays .04 tiles and the predictive margin .18.
No source shape, gameplay range, standing offset or reviewed guard maximum
changed.

The formerly failing full 1,200-frame boosted king-to-princess passing case
now has zero contained vertices, figure edge interiors and reverse tower
crossings. Its closest actual closed-mesh vertex gap is +.054021 tiles and
largest sampled arm Euler step .125690 radians. The separate diagonal
princess passing regression keeps its .2-radian step cap and a freely swinging
negative control. Root opened the final actual 23-second king-to-princess
passing recording: the guarded turn releases smoothly into free walking.
The camera occludes some arm detail; numerical full-mesh checks supply that
part of the contact evidence.

## Guard motion and CPU gate

The 32-case strict contact matrix passed all 19,440 sampled poses, but its
portrait king-to-princess case revealed a .484739-radian shoulder correction
at frame 792. Root reopened motion review rather than treating contact
clearance as proof of good animation. The .2-radian regression cap described
above applies to its diagonal princess fixture, not every natural trajectory.

The native M3 Pro/Node 22 arm64 CPU measurement also failed the runtime gate.
With 800 measured and 200 warm-up frames, the initial guard costs 4.799 ms
per near-wall Sumo and 22.328 ms in the hasted wall stress; the mixed four-Dino,
eight-Sumo update averages 20.364 ms, with p95 65.262 ms. This excludes loading,
world/GPU work, fixture advance and the expensive exact contact audit. Root
requested equivalent skin/point caching and early clearance checks, plus an
earlier smooth guard transition. Reviewed geometry, sampling points, actual
clearance margin and source guard maxima must be preserved.
