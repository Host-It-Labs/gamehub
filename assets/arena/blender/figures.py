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
  pirate    the Pirate          viking    the Viking
  gladiator the Gladiator       medic     the Medic
  miner     the Miner           balloon   the Balloon
  inventor  the Inventor        gunner    the Gunner
  diver     the Diver           sumo      the Sumo
  linebacker the Linebacker     beekeeper the Beekeeper
  drummer   the Drummer         firefighter the Firefighter
  jetpack   the Jetpack         explorer  the Explorer
  bee       the Beekeeper's bees (a spawned troop, no card)

ARENA_FIGURES=guard,ranger limits a build to those ids (a figure still
being written elsewhere then never breaks the others).

Viking, Gladiator and Medic normally export their reviewed runtime copies.
ARENA_SOURCE_MASTER=1 selects their detailed editable source instead. Their
runtime builders preserve the reviewed rest pose and pigment/AO recipe.

One file per figure, `figure_<id>.py`, with a build() that returns the root.

  Blender -b --factory-startup --python assets/arena/blender/figures.py -- out.glb [preview.png] [only]
"""

import math
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402
import articulation

kit.reset(seed=33)
# "team", "team2" (dark) and "team3" (light) follow the side at runtime.
kit.TINTS["team3"] = (0.28, 0.45, 1.0)

ORDER = ["guard", "duelist", "ogre", "archers", "imps", "ranger", "drake",
         "mage", "pirate", "viking", "gladiator", "medic", "miner", "balloon",
         "inventor", "gunner",
         # The eight of 1 October 2026 (figure_folk_kit.py) and the bee.
         "diver", "sumo", "linebacker", "beekeeper", "drummer",
         "firefighter", "jetpack", "explorer", "bee"]
if os.environ.get("ARENA_FIGURES"):
    ORDER = [f for f in ORDER if f in os.environ["ARENA_FIGURES"].split(",")]
only = None
argv = sys.argv
if "--" in argv and len(argv) > argv.index("--") + 3:
    only = argv[argv.index("--") + 3].split(",")
roots = []
finishers = []
ao_roots = []
reviewed_figures = {"viking", "gladiator", "medic"}
for i, figure in enumerate(ORDER):
    # Import only what is built, so a figure being edited elsewhere never
    # breaks the others.
    if only and figure not in only:
        continue
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        f"figure_{figure}.py")
    if not os.path.exists(path):
        continue
    builder = importlib.import_module(f"figure_{figure}")
    # Keep the independently reviewed detailed source accessible, and make
    # ordinary asset builds use its separately reviewed game topology.
    if figure in reviewed_figures and os.environ.get("ARENA_SOURCE_MASTER") != "1":
        r = builder.build_runtime()
    else:
        r = builder.build()
    articulation.legs(r, figure)
    # Readability comes from larger features, not a craned-back neck.
    head = next((o for o in kit.descendants(r)
                 if o.name == f"{figure}.head"), None)
    if head and figure not in reviewed_figures:
        head.rotation_euler.x += math.radians(
            {"ogre": 0, "sumo": 0, "drake": 4, "imps": 4}.get(figure, 5))
    if figure == "ogre":
        # An inner visual root survives the runtime's shared figure scaling.
        # Every limb/joint and the placement preview shrink together.
        children = list(r.children)
        visual = kit.empty("ogre.visual")
        kit.parent(visual, r)
        for child in children:
            kit.parent(child, visual)
        visual.scale = (0.78, 0.78, 0.78)
    r.location = (i * 2.4, 0, 0)
    roots.append(r)
    if r.get("arenaReviewedAO"):
        # These runtime builders carry the authored, reviewed AO/pigment
        # recipe. A generic rebake would change their accepted materials.
        continue
    ao_roots.append(r)
    finish = getattr(builder, "finish_ao", None)
    if finish:
        finishers.append((finish, r))

meshes = [o for r in ao_roots for o in kit.descendants(r) if o.type == "MESH" and len(o.data.polygons)]
for r in roots:
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in kit.descendants(r) if o.type == "MESH")
    parts = sorted(o.name for o in kit.descendants(r) if o.type == "MESH")
    print(f"FIGURE {r.name}: {tris} triangles, parts {parts}")
if meshes:
    kit.bake_ao(meshes, samples=128, distance=0.22)
for finish, root in finishers:
    # An authored pigment layer can combine with freshly baked AO without
    # changing the source palette or the other figures' vertex data.
    finish(root)
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
