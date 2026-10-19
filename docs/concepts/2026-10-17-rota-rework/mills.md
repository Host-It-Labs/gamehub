# Rota mill rebuild — 17 October 2026

The rejected mills currently read as a long box and a short box with the same
low gable roof. Their facades repeat small, flat windows and continuous pale
horizontal stripes. The vacant Mills square is a brown rubble tile dominated
by a full-height, striped chimney. The new work changes those structures.

The large spinning mill is a northern textile works with two parallel slate
roofs, deep arched window bays between brick pilasters, a taking-in bay, and a
stepped water tower. The smaller weaving mill has two asymmetric north-light
roof ridges and a separate hoist bay. Roof identity must survive the steep
phone camera. Both keep warm iron-red brick, blue charcoal slate, restrained
sandstone sills, dark teal glazing and weathered green loading doors. Mullions
are finer than structural piers; masonry and slate stay matte.

The chimney is a true tapered circular stack, with a square engineering-brick
base, a corbelled brick crown and dark reinforcement hoops. Pale horizontal
stripes are removed. The vacant mill site becomes a deliberate reclaimed yard:
brick footings, a paved loading apron, and a low engine-house remnant with a
short stack at the back. Its middle stays empty and readable as a buildable
square. There is no loose ball-shaped vegetation or scattered rubble confetti.

Integration: one game square is 25 metres; Blender Z is up, the front is -Y,
and the exported glTF uses Y up. Keep the current root names and footprint
bounds: big mill 0.8 × 0.34 × 0.66, small mill 0.42 × 0.30 × 0.44.
Chimneys retain the freestanding root and nominal one-unit height so the
existing smoke anchor remains valid. The mill-site stack is deliberately
shorter, as the site has no smoke anchor. Review at 55° and near-plan game
angles, in front/rear views, and in the real toon/ink renderer.

Editable source is `assets/rota/blender/works.py`; retained Blender master
and uncompressed subset GLB are written under `assets/rota/build`. Only the
four rebuilt asset roots are replaced in the shipped works archive, preserving
the stations and other unrelated pieces. Compression follows visual review.

## Inspected result

Reviewed the before/after 55° views in `previews/`, then rear, 76° phone
and neutral clay views. The large mill's twin roofs and raised water tower
remain distinct from both sides. Its piers support deep arched bays instead
of a flat wall of repeated marks. The smaller mill's two north-light ridges
stay visible from above; the loading bay is attached to the facade. The
round chimney tapers continuously and has an open flue, without pale bands.
The reclaimed site's middle is open; its boiler room and short chimney sit
inside the back corner. Parent review also inspected the four after views
before runtime integration. The root agent then inspected the real renderer
at `/rota/lab?map=meadow&rounds=4&ext=towns&seats=6`; the model author also
opened `work/rota-rework/meadow-tablet.png`. The twin roofs and tank towers
remain legible, the low site has a clear open centre, and neither hides the
board's active cells. Physical-device GPU performance is not established by
this desktop browser evidence.

| Asset | Bounds (X × depth × height) | Triangles |
| --- | --- | ---: |
| Large mill | 0.796 × 0.327 × 0.650 | 13,682 |
| Small mill | 0.416 × 0.287 × 0.395 | 4,068 |
| Chimney | 0.080 × 0.080 × 1.003 | 596 |
| Mill site | 0.780 × 0.780 × 0.404 | 1,514 |

The 19 unrelated Works roots retain exactly the same geometry arrays,
indices, attributes, materials and transforms. Compression changes storage
only; no mesh simplification was needed. The mill-only Works archive grew
from 1,296,472 to 1,547,392 bytes, with the other three archive hashes
unchanged. Asset, growth and town-life tests all pass (11 tests), including
sub-millimetre position accuracy, window lighting and footprint clearances.

## Rebuild

```sh
ROTA_ONLY=mill_big,mill_small,chimney,mill_site \
ROTA_MASTER=assets/rota/build/mills-master.blend \
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \
  --python assets/rota/blender/works.py -- assets/rota/build/mills.glb \
  docs/concepts/2026-10-17-rota-rework/previews/after.png
/Applications/Blender.app/Contents/MacOS/Blender \
  -b assets/rota/build/mills-master.blend \
  --python assets/rota/blender/review_mills.py
node scripts/rota-replace-models.mjs works assets/rota/build/mills.glb
node scripts/rota-assets.mjs
node --test tests/rota-assets.test.mjs tests/rota-growth.test.mjs \
  tests/rota-town-life.test.mjs
```

The saved Blender file contains hidden `*-editable-parts` collections with
individual architectural parts, alongside the joined runtime meshes.

## Final combined archive

After independent review, the two Ridge V4 outcrops were merged with these
four mill roots. The final archive is `works-51f1f67e.glb` (1,704,436 bytes);
all 17 remaining Works roots retain their exact geometry, attributes,
indices, materials and transforms. `works.py` imports the new Ridge builder
for normal full rebuilds and runs its 91 bore rays and 63 roof-cover checks
per outcrop. A fresh build through that path passes both, with a minimum
0.0245 of rock over the tunnel lining. See `ridges.md` for the rock source
and its reviewed candidate history.
