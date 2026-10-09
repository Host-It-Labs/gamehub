# Cowboy review record

This is author and independent parent review, not user acceptance. The detailed
sources stay separate from the runtime copy. Exact original files, failed build
logs and rejected sources are retained in the task work directory.

## First source: rejected

Opened the complete `review/v1-fast` clay front, side, rear, three-quarter,
face, hands and bent-elbow views, plus material face, hands, figure and game
camera. Parent also opened clay front. The adult nose, cheek, jaw and connected
thumb/palm with four visible supporting fingers improved the character, but
the source had three concrete faults: pointed shoulder caps, rigid knee ring
cuts, and eyes that followed the socket surface and looked almost closed.
Hair relief also read as uniform cords. Version 1 is retained without further
edits. The slower initial Cycles front render is retained too.

## Second source: primary forms pass

Opened clay front, side, rear, three-quarter, face and hands, material figure,
face, hands, rifle and intended game camera at `review/v2`. The shoulder enters
under the coat yoke, with a broad cloth transition into its weighted sleeve.
Continuous charcoal trousers remove the knee cut, with restrained compression
folds at the joint and thigh tension. The side silhouette retains the felt
hat, adult face, heavy duster, long rifle, heel and spur. Hair now has a coherent
shell beneath sparse combed relief. The fitted eye lenses show their white,
iris and pupil through the lid opening; the rings remain a deliberate stylized
feature. The rifle still has a walnut wrist and fore-end, brass receiver,
lever, screws and clear two-hand contact.

Parent opened the full second-source contact sheet and independently found the
connected shoulders, trousers, alert eyes, mature jaw and fingers suitable.
Source motion and further joint/side evidence remain required before reduction.
The initial pose-render selector used the first armature after a second leg
armature was added and failed on the final elbow view; all preceding views and
the source export succeeded. The review tool now selects the sleeve rig and
records both skeletons explicitly. The failed log is retained.

The measured V2 export has 409,042 triangles, 27 glTF meshes, 16 materials,
two skins, a single `COLOR_0` channel, and 13,461,148 bytes. These are source
costs, not proposed runtime costs. Its SHA-256 is
`efaa5bdd3934b23d5a3d5a862b8129e19aaaaa331424c37ae44f072ae78d22ba`.

## Blink correction and full joint evidence

The source review exposed a compatibility issue before reduction: the skin
lid rims were joined to the head while the lenses closed with the eye controls.
V3 uses the recognized `eye-outline` labels to put both existing lid shapes on
each existing eye control, keeping geometry and proportions identical. Its
review set includes full blink, elbow flexion, knee flexion and a side rifle
view. Opened all five targeted images. Full blink closes the lid rims and
lenses together to thin lines; there are no empty round rims. A deep elbow
bend keeps continuous cloth to the rigid cuff, and about 54 degrees of knee
flexion retains a smooth trouser transition into the overlapping boot shaft.
The side view shows a coherent right grip and supporting fingers with the
rifle in front of the chest and duster. This knee pose deliberately tests range
without planted-foot constraints; it is not gait evidence. The full motion
still needs to be watched in the game renderer.

V3 remains 409,042 triangles and 16 materials, with two skins and 13,463,060
bytes. Its SHA-256 is
`2396a8edb4983205ae4a50cbbc621d082697a1368b73a0141e920e7b50952f44`.
The V3 source is saved before pose testing; the review poses do not overwrite
its native rest frames. Only one `COLOR_0` is exported.

The isolated V3 replacement passed four focused tests using the current
production animator and movement code: walking thigh/knee/ankle and accessory
motion, independent secondary joint ownership, head and rifle lever motion,
and every rifle/lever vertex outside the shirt and upper coat envelopes across
ready, lift, lower, reversals, carry, aim, fire and recovery at 30, 60 and
120 Hz. The test log is `logs/source-animation-v3.log`; duration was 17.2
seconds. These checks establish geometry and animation contracts, not live
visual acceptance. No movement source changes were needed.

Parent subsequently watched complete actual Arena source walking, turns,
attack and recovery for 16 seconds, plus two deployments for 6 seconds.
Recorded video and sequential frame sheets are retained beside its source
evidence. Shoulders, elbows, sleeves and trousers remained attached, both
rifle hand contacts and clearance stayed coherent, and boots held their
attachments. Parent explicitly passed the V3 source gate and authorized
the independent measured runtime copy. This is independent review, not
user acceptance.

## Portrait

V10-a is rejected and preserved. V10-b is the independent parent-reviewed
candidate: at 120 px the hat silhouette, adult face, blue shirt, sand coat,
two-hand rifle and brass remain clear, with painted planes matching existing
Arena card art. Both were freshly generated from exact saved text prompts,
without image references or edits. See `portraits.md` for source evidence.

## Runtime limits

The first runtime copy is retained at `review/runtime-v1`. It has 16,654
triangles and live continuous skinning. Opened its matching clay front,
side, quarter, face and hands plus material figure, face, hands and game
camera. The silhouette, fingers and hold remain clear, but uncontrolled
reduction facets on the face, hat and blue shirt cuffs weaken the source
finish. It is not the accepted runtime candidate. The next copy transfers
the approved sculpt's smooth surface normals onto the reduced topology;
it keeps the same triangle ceiling and native scale.

The original Cowboy is 17,200 triangles, 61 glTF meshes and 13 materials.
The 12,500 triangle count is a useful target if source quality survives, not
an existing Ranger test contract. The runtime copy must stay at or below
17,200 and keep real nonzero skin weights for both native shoulder and elbow
drivers. No gameplay or movement file is changed. Parent owns combined asset,
manifest and card mapping integration. Mobile GPU performance and physical
touch are not established by this offline source review.

## Reduced-copy corrections and final candidate

V2 preserved source normals across every material. Its face still had two
large polygon steps at the chin; applying organic source normals to hard
metal also weakened the receiver highlights. The parent opened its exact
source/runtime contact sheet and independently identified the chin and
hat-band loss. V2 stays intact in `review/runtime-v2` and its saved blend.

V3 isolated the head skin components so tiny ear relief could not consume
the skull's allocation. Source normals are transferred only to skin and
felt; hard metal, lenses and leather retain their own edge shading. A
normal diagnostic found all 2,939 head polygons smooth and zero normal
splitting at shared front vertices. Clearing transferred normals did not
remove the chin steps: reduced geometry, rather than the GLB exporter or
pigment channel, was responsible. Both probe artifacts and their logs are
retained. V3's exact rifle/lever and production movement checks passed.

V4 replaced unrestricted skull collapse with a regular cage sampled from
the exact approved anatomical profile. Loops now cross the chin pad,
labial fold, lips, nasal base, socket and brow. The hat's leather band gets
200 triangles instead of 64. Ear components lose 20 triangles each, and
each trouser loses ten; the approved body silhouette and joint weights
remain intact. V4 removed the chin steps but partially buried the mouth
line in one sparse face band. V5 relocates one hidden lower-neck ring to
the mouth crease, restoring the original closed expression at the same
cost. Earlier versions, including failed normal-mask and over-budget
attempts, are preserved with exact helper snapshots and build logs.

The author opened V5's front, side, rear, quarter, face, hand, rifle,
game-camera, bent-elbow, bent-knee and blink evidence. The regular face
loops retain a rounded chin and defined cheek planes; the hat band has a
continuous curved highlight. Lens/iris and receiver shading are clean.
Digits stay individually readable around both rifle contacts, and the
connected sleeves and trousers remain attached at the shown extremes.
The cloth cuffs retain some deliberate folds at close-up. The colored
eyelid rims close with the white lens, leaving a thin closed line. These
are author observations; independent parent runtime review follows below.

Matching-camera sheets are
`review/runtime-v5/author-source-runtime-v5-comparison.png` and
`review/runtime-v5/author-source-runtime-v5-pose-comparison.png`.
The V2 source stills show the same V3 primary forms; V3 source face,
blink and extreme poses are used where the control correction matters.
No camera rescaling or asset resizing is used for the comparisons.

The V5 independent copy is `master/ranger-runtime-v5.blend`; isolated GLB
is `public/3d/arena/dev/three-ranger-runtime-v5.glb`, SHA-256
`bbe973ddb53477ea43a875898196da5e516220b2f4bb5bb5cfed22e351640e40`.
Loaded cost is 17,184 triangles (17,187 base Blender triangles), 1,049,392
bytes, 63 rendered mesh primitives in 27 glTF mesh records, 16 materials,
two skins and four deforming meshes. This keeps the original 17,200
ceiling; the original was 61 primitives and 13 materials. There is one
exported vertex-color channel, `COLOR_0`. Scale remains one; loaded native
dimensions are `[0.63102055, 1.34197392, 0.59873830]`, consistent with the
authored source's silhouette rather than shrinking the asset.
The loaded distinct attribute arrays occupy 871,164 bytes, with 103,104
bytes of index arrays; these are geometry buffer costs, not measured full
GPU memory or device performance. The 63 visible mesh primitives imply
63 base material submissions per unbatched figure before shadow passes.

Exported sleeve weights are real on all four native drivers: upper-arm
L/R have 564/632 nonzero entries and means 0.522205/0.495728; forearm L/R
have 468/525 entries and means 0.716719/0.620528. The maximum weight-sum
error is 2.98e-8. Full per-part counts, weights, dimensions and channel
evidence are in `review/runtime-v5/loaded-runtime-measurements.json`.

The exact isolated V5 GLB passed the four focused current production
animation tests, including every rifle and lever vertex through walk,
carry, lift/lower, reversals, aim, fire and recovery at 30, 60 and 120 Hz.
Retained test and log: `runtime-v5-animation.test.mjs` and
`logs/runtime-v5-animation.log`. Movement code is unchanged. This is
numerical clearance and rig evidence; complete live runtime cycles are
reviewed independently by the parent before the default builder changes.
The current production exported-skin regression also passed against only
this exact V5 file: all bone indices and weights are valid, a cloned
skeleton contains independent bones and actually deforms, while posing
the clone preserves the source. Retained copy and log are
`runtime-v5-models.test.mjs` and `logs/runtime-v5-models.log` (one test).

## Final independent runtime pass

The parent opened both source/runtime comparison sheets and watched the
complete 16-second actual Arena walk, turn, lift, aim, fire and recovery
cycle, plus six seconds of deployment. Capture uses the production
`ArenaView.setCamera`; every sequential review sheet was opened. The
parent passed the clear chin/mouth planes and continuous hat, connected
sleeves/knees, and rifle clearance through the coat. Evidence is retained
at `review/runtime-v5/actual-final-runtime-walk-fire.webm`,
`actual-final-runtime-deploy.webm`, `final-runtime-sheet-{1,2,3}.png` and
`final-runtime-deploy-sheet.png`. This is independent root review, not
user acceptance.

After that pass, `figure_ranger.build` defaults to `build_runtime`, using
this independent V5 reduction. Detailed source creation is explicit with
`ARENA_SOURCE_MASTER=1` or the existing Ranger alias `RANGER_MASTER=1`.
The original source and reviewed editable V3 master remain preserved.
Owned default-builder AST syntax, whitespace lint and `git diff --check`
passed. No further model geometry change or rewrite of the accepted asset
followed acceptance.
The parent owns final bundle/manifest/card integration and viewport review;
physical touch and mobile GPU performance remain unmeasured here.

## Default factory parity

A read-only reproducibility check found that V5 reduction sampled pigment
with the saved head already at five degrees, whereas a fresh default build
sampled at zero degrees before the shared figure script applied its tilt.
World-position pigment could differ by up to 0.0566 in one channel near
the nose/lip. The parent authorized the smallest Ranger-only factory fix:
temporarily use the accepted five-degree pose during `reduce_copy`, and
restore the original Euler rotation in `finally`. The shared script still
adds its usual tilt exactly once. Pre-fix helper is preserved at
`master/runtime-v5-prefactory-pigment-parity-figure_ranger_runtime.py.txt`.

The isolated Blender factory diagnostic reconstructed only Ranger, with
no AO bake, rendering, export, or shared writes. All 27 mesh object names,
per-part triangle and loop counts, material selections and one `AO` color
attribute match the saved accepted V5 copy. Raw cost is exactly 17,187
triangles and 16 materials. Every compared local-coordinate/material
pigment sample matches exactly: maximum pigment error zero, no unmatched
samples. Both normal return and an injected reduction exception restore
the head to `[0,0,0]`; the `try/finally` path is exercised.

Evidence: `verify-runtime-parity.py`, `logs/runtime-v5-parity.log` and
`review/runtime-v5/default-builder-parity.json`. The accepted GLB remains
byte-identical at SHA-256
`bbe973ddb53477ea43a875898196da5e516220b2f4bb5bb5cfed22e351640e40`.
No runtime flag is needed for normal builds. Source flags must be unset;
the standard `figures.py` pipeline handles the final five-degree pose,
128-sample AO at distance 0.22, then the exported `finish_ao` hook. The
review-only `RANGER_RUNTIME_COPY` setting is unnecessary for the factory.
