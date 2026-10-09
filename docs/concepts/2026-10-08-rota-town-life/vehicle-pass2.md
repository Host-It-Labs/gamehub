# Vehicle lamps, second pass

Claude's desktop, phone and doubled crops were opened before this change. Small
dark cars read as unlit body silhouettes against purple-grey setts; the trains'
existing tiny white lenses give little indication of their leading end.

Keep the current 1950s vehicles, their lamp rims, lenses, body proportions and
all top-and-tail, wheel and traffic motion. Reuse the actual decoded GLB lamp
geometry: paired warm-white headlamps, red rear lenses, and the steam engines'
small lamps above the buffer beams. Do not inflate these details or create
real lights. Lamp emission fades from off in afternoon to plainly lit by dusk
0.5, with a stable threshold while the vehicle moves.

Only the outward end of each end engine lights the train. The leading engine
shows white, the trailing engine red; reversing the train swaps their roles
without moving or flipping its bodies. Car order, `pushed` and `Spec.flip`
determine which physical/model end points out. Coupling-side lenses stay dark.

Road headlights also paint a small, soft warm pool on the road directly ahead.
Use one shared instanced quad batch, orient it with the vehicle's road slope,
retain a narrow width inside its lane, and stop it before becoming a theatrical
searchlight. High/balanced tiers resolve a paired beam; low uses one simpler
pool. All tiers retain the vehicle and its lenses. No shadow maps, point lights,
textures or per-frame allocations are introduced by this lighting helper.

The fixed three-quarter camera and the phone's steep view are the acceptance
angles. Claude will render this second pass; neither new shader compilation nor
actual camera-scale brightness can be confirmed in this sandbox. Functional
tests will check the real model fittings, dusk fade, road-pool pose, reversal,
quality and reduced-motion integration without starting a server.

## Implementation and check

`vehicle-lights.ts` reuses the current GLBs' head/tail lens meshes. Six shared
lens materials cover road headlights/tails and white/red railway ends in both
model directions. Their emission uses the same persistent fade uniform as the
road pools: cubic smoothstep over dusk 0.12–0.48. Interior/coupling-side railway
lenses retain a dark glass colour. Model transform and geometry do not change.

Each road pool is 0.28–0.33 units long for the current street models and at most
0.12 wide, aligned with the vehicle's yaw and pitch. Its reach and width shrink
with a departing car. High/balanced resolve paired, softly spread beams; low
uses one soft beam. One instanced batch has a reusable 256-instance, 16 KB
matrix buffer. It adds two triangles per visible street vehicle, no new lens
triangles, no real lights, and no extra lens draws. No vectors, arrays,
materials or matrices are created by the new frame work. The renderer's old
per-frame live-ID `Set` and `poses().forEach` closure are also removed; the
existing read-only simulation `poses()` allocation remains unchanged.

A warmed Node CPU probe measured about **0.0037 ms per frame** for 28 pool
placements, including batch reset/finalization. This excludes traffic motion,
GPU upload and rasterization, and is not phone performance acceptance.

Six focused tests pass against the actual current vehicle GLB and renderer
modules. They verify dusk timing, real lens geometry and shared stable lighting,
external train-end selection, top-and-tail reversal without body motion,
bridge pitch and shrinking pool contact, quality, wheel spin, still scenes,
all 450 warm-up steps and resource cleanup. Scoped formatting, lint and diff
checks are clean. GPU shader compilation, final brightness and curved-road /
bridge-crest decal contact await Claude's second render review.

Root integration uses `Traffic.setDusk(d)`, `setQuality(tier)` and final
`dispose()`; regular `clear()` continues to reset traffic without disposing
its reusable lighting resources.
