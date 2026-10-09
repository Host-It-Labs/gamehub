# Independent visual review

These observations come from the root opening the actual rendered artifacts.
They are source/export review, not a claim of user acceptance. Each detailed
master is retained before a separate runtime reduction.

## Viking source v2

Opened `work/arena/2026-10-04-vgm/viking/review-v2/clay-front.png`.

- The stocky stance, nasal helmet, constructed axe socket and separated grips
  preserve his identity and improve equipment construction.
- Finish fails: beard locks form a straight curtain, and the mantle reads as
  broad overlapping strips rather than clustered fur. Author independently
  identified these and is replacing both with varied flowing forms.
- Primary clothing still needs repair: shoulder/sleeve tops look inflated and
  abruptly cut, while wrist/bracer openings read as mechanical collars. Shape
  sloping shoulder transitions, contain seams through arm motion, and add
  restrained shirt tension connecting chest, armpits and waist.
- Requested both palm/thumb-web/shaft close-ups, side/rear views, a loaded
  step and extreme circular strike. No optimization acceptance yet.

## Gladiator baseline

Opened `work/arena/2026-10-04-vgm/gladiator/before/clay-front.png`.
The old shoulder domes are detached, arms are tubular, and the face and foot
details are coarse. The new source targets connected athletic anatomy and a
constructed shield; baseline render is retained for the later comparison.

## Preservation contract

The scoped merger's initial self-check preserves all 22 other roots and all
three supplied replacement roots. Final merge must repeat the checks against
the latest production bundle, including skin joints, weights and inverse bind
matrices, to retain concurrent Dino/Sumo and Cowboy/Samurai/Wizard work.

## Viking source v8

Root opened colour-front, clay-side, clay-rear and right-palm-thumb-web.
The corrected beard sits below and around the jaw instead of becoming a thin
forward wedge. Shoulders flow into the torso; broad tunic/skirt folds, volumetric
fur and connected palms establish the detailed source. Wood, forged steel,
stitching, cloth and hair remain distinct. Static source passes; moving-source
review and game-copy comparison remain required.

Root then inspected the actual-renderer recordings `viking-source-rage.webm`
and `viking-source-walk-attack.webm`, with sequential contact sheets in the
task's work directory. Walk, direction changes, stopping, anticipation, full
normal/rage spin and recovery keep both palms around the shaft, elbows and
shoulders connected, and the beard/fur/cloth attached. The corrected relaxed
carry holds the axe above the ground. Source v8 passes and a separate runtime
copy may now be reduced; matching source/runtime views are still required.

## Gladiator source v4

Root opened clay-front, clay-side, material-three-quarter and clay-sword-grip.
Connected athletic torso/shoulders and shaped knees/feet replace the baseline
ball joints. The curved shield, short gladius grip, layered skirt and strapped
sandals read clearly. Author found manica skin protrusion during extreme poses
and is refitting it before final source motion review.

## Medic source v8

Root opened material-three-quarter. Face/cap, adult female proportions, tonic,
satchel and full boot soles are convincing in the chosen miniature direction.
Skin visibly breaks through the uniform at both sleeves; source fails there.
V9 must fit and retain the full sewn garment before reduction.

## Review infrastructure and boundaries

The merger also passed a control using a weighted Sumo: all 22 other roots,
including skin joints and inverse bind matrices, preserve their canonical hash.
The first large baseline test run did not complete its Arena engine worker in
one hour; it was stopped, with its partial log retained. This is not a passed
full suite. Full source previews use a private lower frame cadence when
requested; geometry, skin weights, source scale and the game animator are intact.
The dense-source bench advances the real animator at a fixed 1/60 second per
rendered frame while slowing display cadence. This retains all motion phases while the dense source takes longer to draw;
it does not establish runtime speed or replace fresh-spawn checks. It is a motion review, not a frame
rate or mobile GPU performance claim; production timing is unchanged.

## Viking runtime v4

Root opened the same-camera front, side/rear clay, face/fur, forged axe and both
palm close-ups beside source v8. The earlier broken hem, projected metal normals
and collapsed wrap shading are corrected. The separate copy keeps the primary
silhouette, connected grips, helmet construction, fur volume and material
separation. Fine hidden tufts and crease density are reduced; the detailed
source remains intact.

Root then reviewed the complete actual-renderer walk/turn/stop/normal attack
recording and frontal rage recording, including every sequential review sheet.
Anticipation, full spin and recovery keep both grips attached and the blade
above the floor. Runtime v4 passes visual review. Its export has 18,888 triangles
and 64 primitives, below the original 19,676 triangles and 69 primitives.
Final combined-game checks, contact probes and production integrity checks are
still required before declaring the three-character integration complete.

The native tower probe subsequently found a contact failure despite the free
motion pass: the long haft/blade and left palm/forearm crossed the closed king
and princess stone during attacks. Deployment beside the king was clear.
The exact per-frame vertex and bidirectional-edge evidence is retained in
`viking-runtime-v4-contacts.json`. The model remains accepted; a Viking-specific
contact pose is required before production integration, preserving the two
physical grips, source proportions and full circular strike timing.

## Medic ownership and garment repair

V11 still showed long skin ribbons during the raised healing pose. V14 corrects
the exposed distal arm's accidental torso influence: neutral profile, full
garment, exposed elbow and grip are coherent, and the skin ribbons disappear.
Root nevertheless rejected the remaining straight fan of stretched cloth
facets below the armpit. The author traced it to a long accidental intersection
between the sleeve and shirt before volume fusion. The final source must retain
the authored outer forms with a true local shoulder junction, and pass the
raised view plus actual moving cycles before reduction.

Root opened V16 neutral, full raised and raised-elbow material views. The local
shoulder junction now removes the accidental long cloth bridge: smooth cream
cloth replaces the stretched fan, the brown edge seam disappears and the cuff
remains constructed. Static V16 passes. Root subsequently opened the complete
frontal healing, corrected walk/stop recovery and settled idle sheets, alongside
the earlier full rear cycle. The cuff and shoulder stay sewn throughout, the
vial remains attached and upright, and the arm returns from its healing gesture.
V16 source passes; a separate runtime topology may now be reduced and compared.

## Gladiator final garment fit

The complete v5 actual-renderer walk/turn/strike and shield loss/refill recordings
were reviewed, with stable anatomy, wrists, feet, shield and gladius. Extreme
rear/right waist views exposed a construction gap between belt and swinging
skirt panels. A local inner lining and fitted lower belt resolve the skin gap;
the source body buffers remain held. Final panel-to-belt attachment still needs
an independent affected-view and moving check before reducing the game copy.

Root opened final V8 rear clay, neutral material, extreme wind/thrust side and
rear-waist views, then both complete actual-renderer walk/turn/attack review
sheets. The skin gap and blue-panel clipping are gone; garment tops remain
seated at the waist while their lower panels swing. Held anatomy, gladius,
shield and wrist ownership remain coherent. Source V8 passes and a separate
runtime copy may now be reduced and compared.

Root compared runtime v3 against source V8 at matched neutral, rear, wind,
thrust and waist views. Anatomy and garment seating remain coherent; the boss
and curved shield lose too much surface quality and require private-copy
refinement. Native-cadence video beginning from a unit-only reset displayed
an initial collapsed pose before recovery. It does not establish a fresh-spawn
failure because the view's previous spring state remained. Fresh native
six-pose and 120-frame walk/turn/attack probes at the renderer's maximum
0.1-second step remain finite with coherent bounds (largest joint angle 1.55
radians); independent fresh-start browser evidence is still required.

The exact closed-stone probe also found intersections in the Gladiator's
close-range tower thrust. The sword, guard and small portions of the shield
crossed the stone during attacks; deployment beside the king was clear.
The source proportions and equipment grips remain held while the character's
contact pose is repaired. This is required before final motion acceptance.

## Future asset builds

The collector chooses the separate runtime builder for these three figures.
`ARENA_SOURCE_MASTER=1` still selects the detailed editable build. Reviewed
runtime roots carry an explicit AO flag and retain their character's finish;
the generic collector no longer rebakes them or adds a second head rest tilt.
Other figures continue through their existing build and material path.


## Runtime review and first-frame timing

Root accepted the Viking V4 runtime's neutral surfaces, grips and complete free
and rage cycles. The Gladiator V7 keeps the repaired source body and garment
construction; its curved shield now retains the smooth source silhouette and
boss. Matched material/clay and extreme-waist views pass.

The fresh browser startup exposed a separate timing fault: the first queued
animation timestamp could predate initialization's `performance.now()`, feeding
a negative delta into the springs. The lab and game now clamp elapsed steps to
zero through 0.1 seconds, and the lab clamps its start time to zero. A fresh
24-second browser cycle and the native maximum-step cycle remain coherent.

The Gladiator V7 clears all 4,320 sampled frames of the 24-case stone suite,
including bidirectional triangle-edge crossings. A 0.0176-tile foot dip remained
in fast stationary corner turns. An isolated sandal/toe contact correction is
being checked; its IK changes only the contacting leg and retains the foot's
orientation below the display scale.

Root rejected Medic runtime V2 after opening all eight matched comparison
images. The local cuff remains sewn, but the belt has become a thick rounded
band, skirt folds and hem have broad angular shading, and the satchel emblem,
bun, finger contours and tonic cross lose their clean constructed forms.
Component-specific runtime refinement is required; the detailed V16 source and
editable master remain held.


Root opened every sequential source tower/rage sheet and the runtime's normal,
rage, stationary turn, deployment and rage/reduced tower sheets. The Viking
retains its full circular strike and two physical grips while the overhead
guard clears the stone. All three native suites (normal, rage, rage/reduced)
clear their 24 cases and 4,320 frames; the source and runtime moving review pass.
The normal Viking collector's oriented geometry, normals, UV, AO, materials and
rest transforms match held V4 at the recorded export precision. The tracked
runtime snapshot freezes the accepted reduction and genuine AO; the procedural
source and separate reduction recipe remain editable.

The Gladiator's final contact suite passes after the sandal/toe IK correction:
24 cases, 4,320 frames, zero contained vertices, edge interiors or reverse
crossings. Its lowest ground vertex is -0.000000833 tile, inside the probe's
0.000001 tolerance. The formerly failing turn's lowest vertex is now positive.
Root also opened both fresh final free-cycle sheets; anatomy, garment seating,
shield and feet remain coherent. Dense thrust, near-stone and shield refill
moving review remain before final integration.

The focused renderer run completed 61 tests: 60 passed, one failed an existing
Dino assertion that its unconstrained chest must penetrate a tower. It is outside
these three figures and reflects the concurrent Dino geometry/contact work.
The earlier broad engine/bot run was interrupted before completion and is not
reported as a complete suite pass. Final integrated figure tests are still due.


The extra Gladiator shield-loss/refill probe found a separate passing case: the
spent shield's freer arm swing crossed a princess quoin by 0.0574 tile. The
character now steadies and tucks its actual shield hand near stone while the
spent shield still hangs freely away from it. Combat lifting remains tied to
shield HP. The exact former failure clears all 180 frames after this repair;
the full state-transition suite and affected moving review remain due.

Medic runtime V7 restores structured garment panels, flat bands, clean badges
and regular bun coils. Root opened all eight comparisons: the previous garment
and accessory failures are resolved. The eye outline and gripping knuckle
contours still lose too much shape, so local anatomy/face refinement remains
before approval. V7 measured 50,708 triangles and 53 exported primitives; the
old geometry ceiling is held until an accepted runtime's cost is measured.
All three detailed source exports and editable masters were rehashed and remain
exactly as approved in the recorded source-hash files.


Root opened all eight Medic V10 comparisons against the approved V16 source.
Smooth eye and eyelid ovals, curled gripping fingers, narrow crease bands and
raised elbow contours now retain the source forms. The structured clothing,
emblems, bun, belt and tonic also pass static review. V10 is frozen at 56,916
triangles pending full moving and cost acceptance; preserving local hand and
face anatomy justified the increase from the lower, rejected reductions.

The complete corrected Gladiator shield-loss/refill suite passes all 24 cases
and 4,320 frames with zero contained vertices, edge interiors, closed surface
crossings or open-detail crossings. Sole and head clearance remain within the
recorded acceptance tolerance. Visible corrected moving captures remain due.

The first Medic stone suite found healing-hand/tonic contact during a nearby
stationary turn, plus ground dips during turns. The source and runtime geometry
remain fixed; the Medic receives local stone-aware carriage and the same actual
weighted sole IK used by the Gladiator. The isolated formerly low turn now has
positive ground clearance. A final complete suite will follow the carriage fix.


Root opened every corrected Gladiator king-tower, dense strike and free
shield-loss/refill sheet. The full shield HP transition, planted steps and
recovery remain coherent; runtime V7 moving review passes. The normal collector
rebuild preserves POSITION, NORMAL and every COLOR stream exactly on all 55
referenced primitive corner sets. Remaining UV differences are at most
0.003819 repeats on untextured gilt; textured leather/helmet differences are
below 0.0000005. The raw lacquer preview color is remapped to the same live
team material by MaterialLibrary.dress. No accepted geometry changed.

The merged preview retains all 22 other character roots exactly and renders
these three together under real Arena light. A fresh native 120-frame probe at
the actual 0.1-second cap has finite poses and positive ground minima for all
three, with no spring reset. The original inventory probe counted all exported
primitives as direct submissions; this was corrected to reflect the hybrid
renderer: Medic has 12 direct skin primitives plus 41 rigid batch instances.

## Final Medic motion and measured runtime cost

Root opened the complete 36-second native walk/turn/stop/heal/recovery sheet,
the frontal repeated healing sheet and the 24-second idle sheet. The tailored
shoulders remain connected, the tonic follows the whole hand, the healing pulse
returns to a lowered carry, and both boots remain grounded. Final stone-aware
carriage adds only a small inward movement of the free hand near a tower.
Both final V3 contact suites pass 24 cases and 4,320 sampled frames each:
zero contained vertices, edge penetrations, closed surface crossings or open
detail crossings. The lowest ground sample is -0.000000857 tile, within the
0.000001-tile numerical tolerance; minimum head-bar clearance is positive.
This tests discrete 60 Hz poses against the retained stone meshes, not swept
continuous collision, shader wind or the live cannon and archer rigs.

The accepted runtime geometry and actual hybrid-renderer split are:

| Character | Triangles | Export primitives | Direct skin submissions | Rigid batch instances |
| --- | ---: | ---: | ---: | ---: |
| Viking | 18,888 | 64 | 0 | 64 |
| Gladiator | 19,149 | 55 | 5 | 50 |
| Medic | 56,916 | 53 | 12 | 41 |

Viking and Gladiator stay below their original triangle costs. Medic deliberately
retains more topology than the original 16,408-triangle copy: lower reductions
lost the oval eye rims, continuous hand creases, rounded elbow, thin belt,
medical emblems and combed bun. The frozen V10 is the separately reviewed
reduction of the held V16 source, not a change to that detailed master.

Paired native update/flush measurements use identical final movement/contact
source hashes, an Apple M3 Pro and 240 measured frames after 60 warmup frames.
Mean thread CPU milliseconds for original geometry → reviewed geometry:

| Fixture | Original | Reviewed |
| --- | ---: | ---: |
| Viking free | 0.087 | 0.139 |
| Gladiator free | 0.075 | 0.335 |
| Medic free | 0.057 | 0.914 |
| Medic near stone | 0.095 | 0.757 |
| Medic fast walk near stone | 0.120 | 1.134 |
| Six mixed units | 0.330 | 2.205 |

These include the current skin/sole posing and renderer flush, exclude setup,
fixture advancement, contact auditing and GPU rendering, and establish no mobile
GPU performance claim. The measured Medic cost is an explicit quality tradeoff.
Full evidence is in `work/arena/2026-10-04-vgm/final-runtime-cost.json`.

The close-range moving V3 capture then exposed a tipped tonic at the raised
pulse, despite the passing contact probe and old scalar pitch check. Ordered
body/chest/shoulder/elbow quaternion compensation now levels the whole wrist.
Root opened the corrected V4 near-stone sheet: the tonic remains upright,
fingers remain wrapped around its stem, the elbow and cuff stay connected,
and the arm lowers into its resting carry. The revised independent kinematics
check covers both shoulder pitch and roll. Both complete V4 suites repeat the
24-case, 4,320-frame pass with all four contact counts zero and the same floor
and positive head-bar tolerances. The actual maximum-step fresh-spawn probe
also remains finite and above ground for all three figures. V3 wrist evidence
is retained as the rejected reference; V4 is the final movement recipe.
