# Yata Tokyo table servings — fresh modeled cartoon renders

The user requested actual 3D dishes on the table that keep the current cards'
cartoon style, ingredients, portion size, vessel and arrangement. The existing
card illustrations remain the visual authority. They are observation sources;
neither they nor any older render are image textures or generation inputs.

Observed card sources in the repository:

- `public/art/optimized/yata-counter-lane-0-v3.webp` — five puffy crescents,
  broad toasted faces, cream pleats, sparse large green garnish, white oval
  plate with a cobalt-blue rim.
- `public/art/optimized/yata-counter-lane-1-v3.webp` — a full bowl of thick
  golden wavy noodles, one large tilted half egg left, large green scallion
  rings at centre, large cream fishcake with a pink spiral right, prominent
  dark-green nori rectangle at back, royal-blue bowl with broad cream waves.
  Broth is visible mainly in narrow gaps.
- `public/art/optimized/yata-counter-lane-2-v3.webp` — three densely packed
  bamboo skewers, each with three large caramel chicken bites and two lime
  leek sections; compact charcoal tray; handles face the lower right.
- `public/art/optimized/yata-counter-lane-3-v3.webp` — chunky yellow half
  moons left/back, seeded cucumber cuts front, broad faceted pink ginger
  folds right, lime-green square tray.
- `public/art/optimized/yata-counter-lane-4-v4.webp` — six closely packed
  Takoyaki balls in two rows, rich brown sauce, thick ivory mayo, sparse large
  green/pink toppings, a gold angular paper boat and one toothpick.
- `public/art/optimized/yata-counter-lane-5-v4.webp` — three skewers, each
  pink, cream, then green; chunky lightly faceted rounds, broad graphic
  highlights, square white tray with a cobalt-blue rim, lower-right handles.

## Rendering brief

Build every food item and vessel as fresh geometry: parametric crescent
surfaces, lathed vessels, swept rounded noodle/mayo curves, modeled vegetable
slices/seeds, folded ginger facets, rounded chicken/Dango forms and separate
modeled graphic highlights. Keep saturated clean areas of color, broad
deliberate normal-directed cel bands and dark charcoal contours on silhouettes
and overlaps. Use rich caramel shadows and large smooth ivory graphic glints
for the chicken and Takoyaki. Remove photographic textures, noise, bump,
specular glare and subsurface scattering. Keep portions at card scale.

Use one orthographic camera, elevation47°, scale3.1, target(0,0,0.48), and
transparent PNG output. Freestyle outlines are4.3px at720px, scaled with render
resolution. Camera-ray-only emission isolates the cel colors from indirect
illumination. Non-camera rays encounter a dark diffuse opaque closure.

The contact shadow is a separate bounded elliptical mesh under each vessel.
Its radial shader uses smooth alpha falloff to exactly zero at the perimeter;
it is excluded from Freestyle. Cycles' shadow catcher was removed after it
produced high-alpha ambient contributions at the frame edges. No exported PNG
is edited to hide that issue, and no previous image is reused.

## Reproducible source and final command

Recipe: `tokyo_toon.py`. It imports the existing `dishkit.py` geometry helpers.
The final recipe SHA-256 is:

`5cc6739ea0d9cbe21634807e0c784e1a0b91c6b00ea968664e1c40e8581aefc1`

The following command was run from this chat's workspace:

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python work/yata-card-match/tokyo_toon.py -- --kit-dir /Users/williamguinaudie/Documents/code/gamehub/assets/yata/blender --out work/yata-card-match/rendered-v2 --size 1200 --samples 96
```

After integration alongside `dishkit.py`, production rendering uses:

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python assets/yata/blender/tokyo_toon.py -- --out assets/yata/renders/tokyo-toon-v2 --size 1200 --samples 96
```

Each raw1200×1200 PNG has a neighboring JSON audit with the exact recipe hash,
Blender version, render settings, model/curve counts, measured semantic object
inventory and material node types. The recipe aborts if object counts differ
or any image, procedural noise/Voronoi, bump or Principled material is found.
`alpha-audit.json` records the final raw outer-border transparency check.

There is no ImageGen prompt or image-edit history: these are fresh still
renders of reproducible 3D models made from the written brief above.
