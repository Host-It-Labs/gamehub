"""Arena's collector figures: hand-painted miniatures for the diorama
(docs/concepts/2026-09-26-arena-retheme/diorama.md). They replace the older
troop models one by one: the game takes a figure from figures.glb when one
is built for that id and falls back to troops.glb otherwise.

Same part contract as troops.py (an empty named after the id, at the feet,
facing +y, with jointed children "<id>.<part>"). Ids:

  guard     the longbow archer standing on each small tower
  duelist   the Samurai
  ogre      the Dino
  archers   the Cadets (two per card)
  imps      the Robots (three per card)
  ranger    the Cowboy
  drake     the Biplane
  mage      the Wizard

One file per figure, `figure_<id>.py`, with a build() that returns the root.

  Blender -b --factory-startup --python assets/arena/blender/figures.py -- out.glb [preview.png] [only]
"""

import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.reset(seed=33)
# "team", "team2" (dark) and "team3" (light) follow the side at runtime.
kit.TINTS["team3"] = (0.28, 0.45, 1.0)

ORDER = ["guard", "duelist", "ogre", "archers", "imps", "ranger", "drake",
         "mage"]
only = None
argv = sys.argv
if "--" in argv and len(argv) > argv.index("--") + 3:
    only = argv[argv.index("--") + 3].split(",")
roots = []
for i, figure in enumerate(ORDER):
    # Import only what is built, so a figure being edited elsewhere never
    # breaks the others.
    if only and figure not in only:
        continue
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        f"figure_{figure}.py")
    if not os.path.exists(path):
        continue
    r = importlib.import_module(f"figure_{figure}").build()
    r.location = (i * 2.4, 0, 0)
    roots.append(r)

meshes = [o for r in roots for o in kit.descendants(r) if o.type == "MESH"]
for r in roots:
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in kit.descendants(r) if o.type == "MESH")
    parts = sorted(o.name for o in kit.descendants(r) if o.type == "MESH")
    print(f"FIGURE {r.name}: {tris} triangles, parts {parts}")
kit.bake_ao(meshes, samples=128, distance=0.22)
out = kit.out_path()
if len(argv) > argv.index("--") + 2 and argv[argv.index("--") + 2] != "-":
    preview = argv[argv.index("--") + 2]
    if only and len(roots) == 1:
        # Front, back and side at eye level, then the game's high camera.
        base = preview[:-4] if preview.endswith(".png") else preview
        for suffix, el, az, size in (("front", 14, 150, 1100),
                                     ("back", 14, -30, 800),
                                     ("side", 10, 90, 800),
                                     ("game", 55, 180, 260)):
            kit.preview(f"{base}-{suffix}.png", roots, elevation=el,
                        azimuth=az, margin=1.08, size=size)
    else:
        kit.preview(preview, roots, elevation=18, azimuth=150, margin=1.05,
                    size=1600)
for r in roots:
    r.location = (0, 0, 0)
if out and out != "-":
    kit.export(roots, out)
