# Ridge outcrops: authored source brief

The rejected outcrops read as purple boxes with flat roofs in the phone
camera. Rebuild their primary form: a low, uneven gritstone crag, with a
sloping scree skirt, two staggered shelves, a broken crown and small patches
of dry olive grass and muted heather. Bare warm grey stone dominates. There
is no continuous purple top and no rectangular parapet around the summit.

Each of the two variations occupies one 25 m square, expressed as one
Blender metre. The footprint stays inside ±0.497 on X/Y; the crown stays
below 0.40. The railway/road bore runs straight along local Y, open at both
ends, with half-width 0.18, spring 0.14 and arch rise 0.10. Portals are
individual sandstone arch stones bedded into the rock rather than miniature
building fronts. Routes and their clearances remain unchanged.

Variation A has a broad left shoulder and a rear crown; B has a taller
right-hand ledge and a lower split front shoulder. Each uses custom terrain
topology, fractured stone beds, sparse crest slabs and small plants. Do not
hide a weak form with textures. Keep an editable source and inspect clay,
front, gameplay (55 degrees), and steep phone (75 degrees) views before
replacing the two runtime roots.

Source: `assets/rota/blender/ridges.py`. Master and replacement subset:
`assets/rota/build/ridges-master.blend`, `work/rota-rework/new-ridges.glb`.
Only `outcrop_a` and `outcrop_b` are exported. The mill agent integrates them
through the existing archive replacement tool after independent review.

## Source review

The author opened the front, gameplay, steep phone and clay renders. The
first candidate fixed the purple roof but kept overly large plates sitting
on a smooth mound. The revised crest embeds the smaller broken beds and
uses two unequal angular rises and stepped flanks. Sparse heather occupies
the lower shoulders; the crown remains stone.

Narrowing the crest exposed part of the lining in candidate 2. The final
source enforces minimum rock cover around the actual arch profile. Embedded
crown beds also take the bore cut, so they cannot hang into the opening.
The corrected review set is `ridge-previews-v4/`; earlier sets remain as
comparison evidence, not runtime candidates.

The root agent independently opened A's gameplay/clay views and B's
phone/front views and accepted V4 for integration. This is an internal
visual review, not a claim of user approval. The final executable source
is `assets/rota/blender/ridges.py`; the detailed editable master is
`assets/rota/build/ridges-master.blend` and the accepted replacement roots
are in `work/rota-rework/new-ridges.glb`.

Saved-master validation on 17 October 2026:

| Root | X bounds | Y bounds | Highest point | Triangles |
| --- | --- | --- | --- | --- |
| outcrop_a | ±0.493 | ±0.488 | 0.355 | 6,244 |
| outcrop_b | ±0.493 | ±0.488 | 0.353 | 6,190 |

Each bore passes 91 rays through the full opening. Each roof passes 63
downward samples above the bore, with at least 0.0245 of rock over the
lining. `validate_clearance` asserts both contracts whenever the source is
rebuilt. These checks establish geometry, not runtime appearance; final
toon-renderer and viewport review belongs to the integrated game.

The module is safe to import into `works.py` without resetting its scene:
`build_outcrop(name, 31, 1)` makes A and `build_outcrop(name, 83, -1)` makes B.
Only the standalone `main` resets Blender and produces the source review.
