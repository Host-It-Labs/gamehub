# Visual review

The root reviews the actual artifacts independently of each author. These
observations describe local review and do not claim user acceptance.

## Baseline

Opened the current Arena lineup at
`/arena/lab?only=ranger,duelist,mage&mode=idle`; screenshot retained under
`work/arena/2026-10-04-three-characters/baseline/lineup.jpg`.

- Cowboy's duster, hat and rifle communicate his identity. His cheeks, face
  and exposed sleeve transitions remain simple and rounded; the hands need
  defined curled fingers and a believable grip.
- Samurai's meaningful plate/lacing construction is worth retaining. The
  low-section face, fist volumes and rounded sleeve transitions need stronger
  anatomy and connected motion. Preserve sword clearance and both hilt grips.
- Wizard's hat, beard and staff silhouette remain recognizable. His face
  and casting fingers need deliberate planes; robe/sleeve joints and actual
  planted boot motion must survive the new rig.

Native sources measured from the preserved GLB:

| Character | Triangles | Meshes | Material definitions |
| --- | ---: | ---: | ---: |
| Cowboy | 17,200 | 61 | 13 |
| Samurai | 19,140 | 90 | 16 |
| Wizard | 18,548 | 54 | 13 |

The existing 12,500 triangle check applies to the eight newer human figures,
not these three. Their measured original counts are the runtime ceilings;
lower counts are useful only if source quality survives the reduction. Masters
are unrestricted before visual review.

The baseline asset/face/skin tests pass 18 checks, with one exported-skin check
skipped because the current production bundle has no skins yet. This confirms
the existing runtime contract; it does not validate the forthcoming sources.

## Source and runtime reviews

### First source review

Opened Cowboy v1, Samurai v2 and Wizard v2 front clay renders at their full
review size. These candidates are retained and are not accepted for reduction.

- Cowboy has stronger adult facial planes and separated curled fingers. The
  sleeve caps rise above the coat shoulders, the rigid knee seams remain
  obvious, and the hollow eye sockets make him look sleepy. Refine the shoulder
  entry, connected trousers and actual eye/lid construction.
- Samurai retains the plate construction and both katana grips. The dark
  collar/strap openings need a credible tucked under-robe. His hakama thighs
  read as smooth inflated puffs: narrow the silhouette and add long box pleats
  and local knee tension. Fit the whole banner, crest and soles in review views.
- Wizard's fingers and boots are clearer, but parallel beard ridges have no
  hierarchy and the smooth torso resembles an inflated vest. Use a few primary
  beard locks with subordinate relief, cloth tension at the belt/shoulders,
  and side views of the bent hat. Verify the staff-following wrist in motion.

Opened Samurai v2 in the actual renderer from the normal game camera and a
closer frontal camera. The direct skinned model renders opaque with its
materials; the distant reverse camera was occluded by the field and showed the
intended x-ray silhouette. The closer review avoids that occluder. Full motion
and final source acceptance follow the refinements above.

### Cowboy source v3: passes for reduction

Opened the v2 front/side/rear/three-quarter clay set, face and grip close-ups,
and coloured figure/face/hands. The shoulders slope into the coat; trousers
have connected knee deformation and local tension. Eyeballs, adult jaw planes
and separated rifle fingers remain clear. Opened v3 bent-elbow, bent-knee,
side-rifle, open-eye and fully closed blink views. Lid rims follow the existing
eye controls without empty rings during closure.

Recorded the detailed v3 source in the actual Arena components in Chrome:
16 seconds of alternating walk/turn/attack/recovery, then six seconds of
repeating deployments, with the same three-quarter camera. Opened the full
sequential review sheets derived from those videos. Cloth remains connected;
both grips follow the rifle; coat clearance, planted boots and landing recovery
remain coherent. The 409,042-triangle master passes for an independent game
copy. The game copy still requires matching-camera review and the 17,200
triangle ceiling.

The separate source CPU diagnostics pass rifle/lever clearance at 30, 60 and
120 Hz, gait/secondary ownership and head/lever activity. These checks support
the observed motion; they do not replace it. The isolated review page uses the
actual ArenaLab/ArenaGame components and a separate dependency cache. The
in-app browser and two existing preview servers stalled; Chrome is responsive.

### Samurai source v3/v4

Opened v3 clay front/side/rear/three-quarter, face/grips and overhead/cleave/coil
poses. Narrower pleated hakama and the tucked collar resolve the first review.
The extreme poses exposed a black oval and small forearm armour intersections.
The author identified the oval as an unattached obsolete studio object, absent
from the filtered export, and removed it in v4. Armour receives actual clearance
from the robe. Material and actual-motion review remain required.

### Wizard source v4

Opened clay front/side/rear/three-quarter, face and staff grip, coloured figure,
face and casting palm, cast and loaded-step views. Unequal primary beard locks,
tailored chest/belt tension, the side-profile hat bend and separate digits
resolve the earlier structural concerns. Cloth, charcoal, leather, metal and
hair have distinct finish. The round nail caps need a small refinement. Actual
moving staff-grip/gait review remains required before reduction.

### Samurai source v5: passes for reduction

Opened the coloured face, both hilt grips and whole three-quarter figure, plus
clay coil/overhead and coloured overhead views. The visor lip clears the gold
helmet band. Armour clears the connected sleeves, long pleats survive loaded
knees, and the complete crest, banner and soles retain their original bounds.

Recorded the actual v5 source for 16 seconds of walk, turn, cut and recovery
and six seconds of deployment. Opened every sequential review sheet from the
full-margin recordings. Both hands stay on the katana, sleeves and knee/ankle
transitions stay connected, and the planted stance reads coherently. The
1,522,224-triangle source passes for an independent game copy. Its reduction
still needs matching-camera review and the 19,140-triangle ceiling.

### Wizard source v5: passes for reduction after planting correction

Opened the refined tapered nail plates, casting palm and whole figure. The
new hand control follows the staff's exact frame. Recorded 16 seconds of
walk/turn/cast/recovery and six seconds of deployment in the actual renderer;
opened the complete sequential review sheets. The boots, sleeves, beard and
gripping fingers remain coherent. Resetting the review bench position and
using a wider camera resolves the earlier cropped/drifting review capture.

A longer actual-runtime CPU check sampled 3,721 frames through deployment,
walking, alternating casts, four idle fidgets and a hit. Hand/staff world
frames agree, but the staff shoe reaches 0.167 world units below the ground
during a leaning fidget. The inherited planting calculation runs before final
body and foot-solved transforms. The source's anatomy and materials pass;
the first reduction gate waited for a correction based on the final posed
staff frame, a meaningful regression and another moving review.

The final correction runs for the live Wizard after body placement, using
cached shoe vertices and the actual forearm world frame. It preserves the
intentional lift/cast and moves the closed hand by the identical correction.
The new production regression passes deployment, walking, alternating casts,
all four fidgets and contact checks; disabling only the late correction in a
private copy makes that regression fail on a casting shoe below the ground.

Recorded and opened the complete corrected source: 16 seconds of the four
native fidgets (selected explicitly on the dev bench) and 16 seconds of
walking, turning, alternating casts and recovery. The camera uses
`ArenaView.setCamera`; changing `world.camera` directly is overwritten by the
view's next frame. Full recordings and all sequential sheets are retained.
The staff shoe stays planted when reachable, the overhead cast remains free,
and cloth, boots and gripping fingers remain coherent. The source passes
for an independent game copy within its original 18,548-triangle ceiling.

### Samurai game copy v2: studio comparison passes

Opened exact V5/game-copy face, both hilt grips, whole figure and overhead
comparisons. The first reduction's triangular lacquer/gold intrusions are
gone. The helmet's 1,656 lacquer/gold triangles and standing collar are kept
exactly from the source. The mature face, connected pleated garment, complete
banner and native scale survive at 19,079 exported triangles. Final actual
moving and integrated-game review follow.

### Cowboy game copy v5: studio and motion pass

Opened the matching source/game-copy detail and posed comparisons. The regular
face cage keeps the chin and mouth crease; the felt hat remains continuous.
Recorded 16 seconds of actual walk, turn, rifle lift, aim, firing and recovery,
then six seconds of repeating deployment using `ArenaView.setCamera`. Opened
all sequential sheets. Sleeves and knees remain connected, both grips stay
coherent and the rifle clears the duster. The 17,184-triangle copy passes;
the source and earlier rejected reductions remain preserved.

### Samurai game copy v2: motion passes

Recorded the exact final export for 16 seconds of walking, turning, cuts and
recovery and six seconds of repeating deployment. Opened all sequential
sheets. The gold helmet band, crest and banner remain complete, both fists
stay on the hilt, and pleats, sleeves and tabi retain their connected stance.
This independent motion gate passes; integration checks follow.

### Wizard terrain and reduction review

An independent production-terrain probe found 22.5 mm of staff-shoe penetration
on the curved bridge approach after the initial three-pass correction. An
additional solve nearly removes it: this needs bounded convergence and final
contact validation, plus a real bridge regression. Flat-ground tests alone
did not establish terrain contact.

Wizard reductions v9 and v10 are rejected before integration: v9 breaks the
gold hem stripes into patches; v10 keeps the stripes but loses the cloth folds
between them. The source stays approved, while the separate game copy is
being revised with structured cloth sampling. Rejected artifacts are retained.

### Wizard game copy v11: studio and motion pass

Opened matching source/game-copy front, side, rear, face, cloth, palm, grip,
loaded-step and casting views. Sampling the authored skirt formula keeps its
ordered folds and both continuous gold hem stripes. The source's mature face,
separate digits, bent hat and native scale remain readable at 18,431 triangles.

Recorded the actual final copy for 16 seconds of walking, turns, alternating
casts and recovery, 16 seconds of all four native fidgets, and six seconds of
repeating arrival/landing. Opened every sequential sheet. A closer fidget
capture logs all four selections; the wider recordings retain the complete
silhouette. Sleeves and boots remain connected, the hand follows the staff,
and intentional airborne casts remain intact. Both production regressions
also pass against this exact candidate: the flat/fidget cycle and 900-frame
curved bridge approach. The game copy passes independent review.

The bridge correction selects the lowest terrain clearance across the whole
shoe and iterates to a tolerance with a 20-pass upper bound. Independent source
verification finds a worst gap of -0.0001995 within the 0.0002 tolerance and
zero hand/staff separation. A private runtime probe averages 2.33 passes on
the bridge (maximum 11), and about two in ordinary motion. Disabling only the
terrain correction makes the bridge regression fail. These CPU probes are
not a mobile GPU or physical-touch benchmark.

### Integration

Merged the three approved roots into the latest production figure bundle and
selected the three independently reviewed fresh portraits. The merger compares
transforms, materials, raw geometry, colours, indices, skin weights and inverse
binds: all 22 other roots retain their exact input content. Previous bundles,
original art, source masters and rejected candidates remain preserved.
Hashes and portrait provenance are in `integration-evidence.json`.

### Hybrid rendering and measured cost

Rigid faces, equipment and costume parts remain in the existing batched
renderer. Only genuinely weighted surfaces render as individual skins. Each
unit keeps its own joints, skin palettes and attachment matrices; traversal
indices distinguish duplicate leaf names. Regression checks cover clone
ownership, mixed material batches, frost, cloth, team silhouettes and cleanup.
An independent review also exercised 72 Samurai copies, capacity growth,
repeated removal and disposal of 88 owned bone textures without disposing
shared geometry or materials.

At 1280 × 720, render pixel ratio 1 and HQ, the same six-unit idle scene uses
676 calls versus 503 with the three original rigid figures. Sending every new
surface individually had cost 1,896 calls. The final figures retain slightly
fewer triangles and geometry attribute bytes than their originals. The
measured CPU animation/WebGL submission cost averages 8.01 ms across 90 frames,
with 11.7 ms at the 95th percentile, during concurrent desktop work. This is
not a GPU timer, a phone benchmark or a measured frame-rate improvement. See
`integration/render-costs.json` and `integration/model-costs.json`.

### Wizard slow first-frame correction

Final phone review found a persistent missing torso, face, hat and robe. This
was a real invalid pose: a newly created stationary Wizard whose first frame
lasts at least 0.05 seconds skipped the old idle initializer. An undefined
fidget time multiplied by zero still produced NaN and poisoned every torso
descendant, while the legs remained finite. The initializer now also runs for
fresh memo state. The regression fails the preserved original source and
passes at first-frame durations 0.05, 0.1 and 0.25, followed by ordinary idle
frames at the actual phone scale.

Root reproduced the failure through the production `ArenaView.frame` with a
0.1-second first frame, then reviewed that exact case after the fix. Both
Wizard silhouettes stay complete after 48 seconds of idle, every model world
matrix remains finite, and the staff shoe remains on the ground. The rejected
and corrected phone screenshots are retained under the integration work
folder. No model regeneration was needed for this animation correction.

### Final verification and remaining boundary

The final five focused files pass 29/29 checks. The character/gait animation
selection passes 7/7 and the related combat/lockstep selection passes 6/6.
Typecheck, repository lint, production asset validation and the production
build pass after the idle fix. Root reviewed the actual game at 390 × 844,
768 × 1024 and 1280 × 720. The complete models, fresh hand portraits, navigation
and elixir fit; phone Wizard selection opens its stats without changing the
field camera. The phone and desktop documents have no whole-page overflow.
These are browser pointer checks; physical touch and mobile GPU performance
were not measured.

Root opened every sequential sheet from the final slow and haste recordings:
weapons and wrists remain attached, garments follow the joints and the Wizard
keeps his complete robe. A reduced-motion recording shows scattered geometry
during its first few seconds before settling, so that capture is not accepted
as a clean startup pass. Independent CPU/GPU-palette checks of cold starts,
teleports, media changes and all rigid batch instances remain finite, but do
not explain that visual transient. A fresh first-frame capture without unit
mutations is prepared. Browser automation then reported that the Mac is
locked; this last startup check awaits unlocking and is still pending.

The wider repository test run is not green. Its initial result was 1,093/1,148
passing, including 41 failures caused by sandbox listener permissions and an
old face-parent assertion corrected in this rework. The listener rerun with
access passes 87/88; the remaining Arena replay deployment failure is outside
the selected-character changes. Other failures include concurrently rebuilt
figures that had not yet been integrated, engine contact/placement assertions
and a Diner allowlist expectation. The exact snapshot and scopes are retained
in `integration/test-boundaries.json`; the focused passes do not claim full
repository acceptance.

## Cowboy portrait v10-b

Opened `card-ranger-v10-b.png` at full size and the preserved 120-pixel
old/v10-a/v10-b comparison. The hat, adult face, saturated blue shirt,
sand duster, supporting left hand and brass rifle remain readable. Painted
planes fit the current deck and material contrast survives the thumbnail.
Select v10-b; retain the more realistic v10-a candidate. This portrait review
does not yet validate the corresponding 3D source.

## Samurai portrait v10-a

Opened the second independent Samurai source and its 90-pixel view. The mature
face, cobalt lacquer, ivory lacing, separate fists and katana remain legible.
The full gold crest is uncut, with a tight top margin. The back banner remains
distinct from the helmet. Select `card-duelist-v10-a.png`; retain the first
photographic candidate with its cropped crest.

## Wizard portrait v8-a

Opened the second independent source and its 90-pixel deck comparison. The
complete bent hat, weathered face, silver beard, open palm/flame and amber
crystal retain their silhouettes. Subdued cobalt and charcoal painted planes
fit the new Dino/Sumo art. Select `card-mage-v8-a.png`; retain the realistic
first candidate with its clipped hat.
