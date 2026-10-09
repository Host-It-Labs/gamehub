# Reviewed Dino runtime source

`dino-runtime-v1.blend` is the separate, versioned runtime copy of the detailed
v11 T-rex sculpt. It fixes the neutral geometry reviewed in `runtime-r2.blend`
and exported as `dino-runtime-r2.glb` (SHA256
`21dd8d88249d9228b3b43f340c9f26b46908d1dbf5346ab3278396ae6a60d02e`).
It is not a replacement for the editable detailed sculpt:
`figure_ogre.build_master()` reproduces that source, and the preserved v11 master,
source snapshots, rejected reductions, brief and matched camera/pose evidence
are in `work/arena/2026-10-04-rebuild/dino/`.

The copy has 34,418 triangles. Its continuous skin uses 23,000; the remaining
budget protects separate teeth/claws, orbital lids, jaw/lining and unequal
embedded scutes. The matching comparison passes independent parent static review
provisionally at field scale, and the complete revised forward-bite cycle also
passes that moving review. Fine scale relief is visibly smoother than the master;
the larger scales and primary anatomy remain. Complete moving/browser/contact
review is recorded separately and must not be inferred from these counts.

Normal `figure_ogre.build()` appends this neutral source with `link=False`, then
the ordinary collector bakes AO and runs `figure_ogre.finish_ao()`. The file
contains native geometry, custom normals, normalized bone weights, retained
generic `DinoPigment` vectors and a neutral-white `AO` layer. Only the combined
pigment × freshly baked AO exports as `COLOR_0`. There are no image textures,
external linked libraries or add-on dependencies.

The copy contains the `.48` inner `ogre.art-scale` root. It deliberately contains
no `.78` wrapper; `figures.py` adds the ordinary `.78` `ogre.visual` wrapper once.
The master stays full authoring size. Do not reduce the file again, add another
scale, change the anatomy to fit building bounds, or silently regenerate the
canonical copy during a normal build. Procedural collapse from separate dense
source runs can choose slightly different vertices/topology; a reviewed cache
keeps the independently reviewed neutral copy reproducible.

## Exact normal-build evidence

`figure_ogre_verify_cache.py` verifies the neutral copy against the reviewed
`runtime-r2.blend`. Positions, loop/triangle indices, custom normals, normalized
weights, generic pigment, material assignment and bone rest/neutral transforms
match exactly. The wrapper reconstruction has zero world-transform error.
The recorded audit is `runtime-cache-verification.json` in the preserved review
folder. The source file SHA256 is
`5343892f716f2f365076e1bba92d1bb3146eb5b1de9115fc6509f834d992f9c4`.

A fresh isolated invocation of the ordinary `figures.py` collector also matches
all 22 exported geometry primitives exactly, including positions, indices,
normals, weights, material tints and all 16 bone world frames. It produces
34,418 triangles, 18,018 vertices, 7 materials and 1,067,032 bytes. Its SHA256 is
`2813f66a050f07b1c270458526dc8ebd606d55e7a4fc3be487c5c40f22af9a5c`.
The comparison is `runtime-canonical-v1-equality.json`. `COLOR_0` differs from
the temporary r2 export because the ordinary collector rebakes AO with 128
samples instead of the review export's 64; the retained source pigment is exact.
On the main reptile skin the colour RMS difference is .00105 and maximum .03677;
the maximum over every attachment is .46307 at a tooth primitive, with .02547
RMS there. This rebaked finish needs the final browser review alongside contact.

```sh
PYTHONDONTWRITEBYTECODE=1 ARENA_FIGURES=ogre /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 3 --python assets/arena/blender/figures.py -- work/arena/2026-10-04-rebuild/dino/runtime-canonical-v1.glb - ogre
```

## Regeneration after a new source review

Run these from the repository root with Blender 5.2.2 (the current source tool).
Use a new version/basename to preserve every reviewed source and candidate.

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_ogre_review.py -- work/arena/2026-10-04-rebuild/dino/vNEXT side,front,rear,three-quarter --materials
```

Review the detailed clay/materials and complete source animation first. Create
a separate runtime copy only after the source passes that gate:

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_ogre_runtime_review.py -- work/arena/2026-10-04-rebuild/dino/vNEXT-master.blend work/arena/2026-10-04-rebuild/dino/runtime-NEXT
```

Run `figure_ogre_compare.py` for both the source and neutral runtime blend with
the same camera list `side,three-quarter,face,loaded-step,roar`. Inspect those
images and the actual exported moving game cycles independently. Once accepted,
freeze that exact neutral copy to a new versioned source file:

```sh
PYTHONDONTWRITEBYTECODE=1 /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_ogre_cache.py -- work/arena/2026-10-04-rebuild/dino/runtime-NEXT.blend assets/arena/blender/runtime/dino-runtime-vNEXT.blend
```

Update only `CANONICAL_CACHE` in `figure_ogre_runtime.py` after review, record the
provenance, and verify mesh positions/indices/weights/normals/pigment and joint
transforms against the accepted neutral source. A fresh ordinary AO bake may
change `COLOR_0`; document it separately rather than changing the source paint.
