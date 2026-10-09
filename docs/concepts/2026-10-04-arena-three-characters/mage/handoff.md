# Wizard handoff

Source V5 and independent runtime V11 passed root anatomy, material and real
Arena motion review. The fresh painted card passed full-source and 90 px deck
review. These are independent review gates, not user acceptance.

## Accepted assets

- Detailed editable source: `work/arena/2026-10-04-three-characters/mage/v5/mage-master-v5.blend`.
- Exact runtime: `work/arena/2026-10-04-three-characters/mage/v11/mage-runtime-v11.glb`.
- Exact runtime editable copy: `work/arena/2026-10-04-three-characters/mage/v11/mage-runtime-v11.blend`.
- Same isolated dev bytes: `public/3d/arena/dev/three-mage-master-v11.glb`.
- Portrait: `assets/arena/cards/card-mage-v8-a.png`, opaque 1254 square; exact prompts in this directory.
- Source/render comparisons: `mage/v11/comparison-*.png`, full source evidence V4/V5 and complete fifteen-view runtime evidence V11.

The runtime has 18,431 triangles against the original 18,548 ceiling, 38 mesh
nodes, 54 primitives, 15 materials and 964,740 bytes. SHA256:
`1711ddbc9f7235fea5307d42254726979b937ab9f5e28beddc0c1b559e6413ac`.
One skin has 21 common-axis bones, six weighted node owners and eleven rendered
skin primitives. Maximum normalized-weight error is 2.98e-8. Mixed arm/forearm
vertices are L244/142 and R273/173. Only COLOR_0 exports. Native source pivots
remain unchanged; authored scale stays 1.0.

## Builder and motion

`figure_mage.build()` defaults to the independently reduced runtime;
`MAGE_MASTER=1` or `ARENA_SOURCE_MASTER=1` explicitly returns the full detailed
source. The owned neutral cache is
`assets/arena/blender/runtime/mage-runtime-v11.blend`; it keeps the exact reviewed
geometry, sampled normals, pigment and weights. `MAGE_REBUILD_RUNTIME=1`
explicitly regenerates a procedural copy for renewed comparison/review.
`build_legacy()` preserves the original implementation. V12/V13 retain the
fresh procedural verification, including the private cache-reset harness fix.
The final cached default/master check is V14: its fresh default export is
byte-for-byte identical to accepted V11 and the explicit source is 444,882
triangles/118 meshes. `default-v11-parity.json` records exact JSON/binary parity.
All 21 pose bases are neutral on load; the head is bone `magehead`, so no stored
review tilt is applied twice. The existing shared dotted-object tilt lookup
does not change this armature bone.

The Mage-only late solver in `moves/mage.ts` reads final body/forearm transforms,
tests every physical silver-shoe vertex against terrain, converges within a
twenty-pass bound and validates final reachable contact. Every wrist correction
is shared with handR. Deliberate overhead casts remain airborne. Root owns the
post-placeBody hook and all shared bundle, manifest, renderer and card mapping
integration.

## Final integration repairs

Root subsequently delegated the narrow hybrid renderer repair: rigid parts of
every skin figure remain in material/layout batches, while only SkinnedMesh
geometry keeps independent unit clones. Clone attachments map by traversal index,
retain child traversal, and share their final posed world matrices with their
batches. Colour/flutter/xray and removal/disposal cover both paths. Source art
and accepted runtime bytes are unchanged.

The actual phone game review then exposed uninitialized Mage fidget state when
the first stationary draw already had at least 0.05 seconds of idle time. Its
NaN torso pose hid the entire upper figure. Fresh fidget state now initializes
regardless of that first frame's duration. The preserved original fails the new
phone-scale regression; final focused checks pass **23/23**, plus typecheck and
scoped lint. Final `moves/mage.ts` SHA256 is
`c8c2567b665574cea977891cec62a4d01ecf0d8e070b27b85ab14b1bb788f028`.

Root forced the same 0.1-second first draw in actual ArenaGame at 390×844 and
opened `integration/game-phone-slow-start-fixed.png` and
`integration/game-phone-wizard-selected.png`. Both complete Wizards remain
visible after 48.5 seconds idle with finite poses and zero/4.44e-16 staff contact
gaps. Root accepted the repair. Detailed cause, failure preservation and checks
are in `mage/phone-idle-fix.md`; hybrid ownership evidence is in
`mage/hybrid-handoff.md` under the work evidence root.

## Validation and preservation

The exact runtime passes production flat/fidget/airborne-cast and 900-frame
bridge regressions, three focused candidate motion/weight checks, independent
clone deformation proof, scoped lint and typecheck. Evidence, SHA/costs, CPU
pass counts and exact logs are in V11. Private mean/max solver passes are bridge
2.33/11, walk 1.89/2, casts 1.27/3, idle 2.09/3. Physical clearance stays within
0.2 mm and hand/staff world-matrix gap is zero.

Original source, private kit, motion and card are retained under originals/V0.
Rejected source/runtime iterations V1–V10 remain intact, including failed bake
diagnostics. The pre-bridge solver snapshot and failing mutant demonstrate the
terrain regression; the source mutant disabling the late solver demonstrates
the casting regression. No tests or original ceilings were weakened.

Own changed files are `figure_mage.py`, new `figure_mage_sculpt.py`,
`figure_mage_runtime.py`, `figure_mage_surface.py`, `figure_mage_review.py`,
the owned neutral runtime cache,
`moves/mage.ts`, new `tests/arena-mage-rebuild.test.mjs`, the portrait source,
and this Mage concept/evidence directory. The later root-authorized repair also
changes only the TroopRenderer/Part sections of shared `troops.ts`, one rigid
compatibility test in `tests/arena-models.test.mjs`, and new
`tests/arena-hybrid-renderer.test.mjs`. Other concurrent changes are preserved.
Root performs final shared integration and browser checks.
