# Sumo runtime source

`sumo-runtime-v1.blend` is the frozen neutral artist copy of the reviewed V9
Sumo. It contains only the local Sumo hierarchy, with no linked libraries,
image textures or add-ons. `figure_sumo.build()` appends this file; it does
not rerun decimation. `figure_sumo.build_master()` retains the editable
detailed sculpt. The preserved V5 master and V6 shoulder repair are under
`work/arena/2026-10-04-rebuild/sumo/master/`.

The 1.22 author scale is already baked into the source once. The standard
collector adds no Sumo head pitch. The native neutral GLB bounds are
X −0.632357 to +0.632360, Y +0.009758 to +1.705572, and Z −0.308647 to
+0.300932. These dimensions must not be used to compensate for a reduction
defect by changing gameplay scale.

| Runtime contents | Count |
| --- | ---: |
| Connected skin triangles | 24,000 |
| Total triangles | 34,227 |
| Mesh nodes / exported primitives | 17 |
| Skin skeletons | 1 |
| Common-frame driver bones | 16 |
| Live face controls | 7 |

The earlier 12,500-triangle copies degraded facial planes and rounded
fingers in identical close views. V7's larger connected skin retained those
forms; V8 restored the detailed source's combed hair relief and nail curves.
V9 changes only local shoulder/armpit weights to remove a projecting sheet
in the maximum inward arm guard. Neutral positions, indices, normals and
paint are unchanged from V8. Hand/foot ownership and all joint frames are
unchanged. The larger total was accepted after those comparisons and actual
Arena motion review; preserving anatomy takes precedence over the former
budget.

The skeleton remains beneath `sumo`, with named common-frame drivers:
`sumotorso`, `sumohead`, `sumohair`, `sumoextra`, plus
`sumoarmL/R`, `sumoforeL/R`, `sumohandL/R`, `sumolegL/R`,
`sumokneeL/R`, and `sumofootL/R`. The seven face controls are
`sumoeyeL/R`, `sumopupilL/R`, `sumobrowL/R` and `sumomouth`.
Fixed cloth, hair, nails and facial attachments stay on their authored bones.
Skin uses the matte `skin` material family, hair uses `hair`, and the mawashi
uses `weave`.

The canonical file contains one white `AO` color attribute per mesh. Tissue
paint is retained separately as the non-color `SumoPigmentCache` point vector
attribute; source normals have their own non-color vector cache. The normal
collector bakes fresh occlusion and calls `figure_sumo.finish_ao()` to combine
it with that unchanged pigment. Only the combined `COLOR_0` is exported.
This prevents a white color channel from hiding the intended painted layer.

Build the isolated figure through the ordinary collector from the repository
root:

```sh
PYTHONDONTWRITEBYTECODE=1 ARENA_FIGURES=sumo \
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 2 \
  --python assets/arena/blender/figures.py \
  -- public/3d/arena/dev/sumo-runtime-canonical-v1.glb - sumo
```

`sumo-runtime-v1-provenance.json` records the canonical SHA256 and source
repair. The native append comparison in
`work/arena/2026-10-04-rebuild/sumo/master/runtime-cache-verification.json`
checks exact positions, loops/indices, custom normals, skin ownership,
pigment caches, materials, modifiers, bone rest frames and object transforms
before AO. The actual Three loader comparison in
`runtime-canonical-v1-equality.json` checks every indexed exported triangle
corner against V9, including normals and weights, and all 16 joint frames.
It passes with zero geometry differences. Fresh AO changes shading and some
vertex splits: the skin's color RMS difference is 0.016805, with larger rare
corner differences. That numerical comparison does not replace final
material-view review.

Parent review has passed the V9 repaired source/runtime guard pair and actual
walk/turn and alternating palm-strike cycles. The smaller deployment settle
also passed a complete V7 Arena cycle. The ordinary collector's fresh AO
passed a close actual Arena material view and moving strike review.

The final front-wall recoil uses shoulder X −0.35, inward Z ±0.25, elbow
X +0.50 and wrist X +0.15, with the other axes at rest. The author and parent
opened identical source/collector front, side and material views; the runtime
views also passed independent review. The elbow direction is plausible and
the fingertips stay outside the thigh.
The lateral guard remains shoulder X +0.70, inward Z ±1.10, elbow X +1.50
and wrist X +0.15. Both keep the approved neutral anatomy and joint frames.

The inherited free slap had reverse elbow coils. `moves/sumo.ts` now draws
back from the shoulder with positive elbow flexion and restrained palm turn,
retaining alternating hands, hit timing, speed and grounded deployment. The
actual TroopView/canonical-skin probe covers normal speed, tempo 1.35, 30 fps
and reduced motion. Sampled elbow flex stays positive, from 0.0902 to 1.2456
radians; the 30 fps minimum is 0.1393. The parent reviewed complete updated
eight-second Arena walk/turn, strike and grounded landing cycles, plus close
20 fps impact detail. The author and parent also opened all four matched
static source/collector windup, impact and ready views. They retain normal
elbows and connected shoulders/hands; fine source shoulder compression
ripples smooth in the runtime with the silhouette retained. Those snapshots
use actual upper-body angles with neutral lower-body placement; they are a
focused anatomy check, not a full animation fixture.
The reviewer owns the final moving tower contact matrix on the updated free
goals. That gate remains separate from this frozen neutral source.
