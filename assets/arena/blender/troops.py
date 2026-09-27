"""Arena's seven toy troops (the Cadet also guards the small towers), built
from jointed parts. The eighth card, the Meteor, is a spell (towers.py).

Each troop is an empty named after its card with child parts whose origins
sit on their joints, so the game can swing legs, arms and weapons in code:

  <id>            root, at the feet, facing +y (Blender)
    legL, legR    pivot at the hip
    torso         pivot at the waist
      head        pivot at the neck
      armL, armR  pivot at the shoulder
        weapon    (child of armR) pivot in the hand
        offhand   (child of armL) shield, bow or spell hand
    wingL, wingR  pivot at the wing root
    tail          pivot at the tail root (the Dino's swings)
    jaw           (child of head) pivot at the hinge
    spin          turns about the troop's forward axis (Blender y) through
                  its pivot: the Biplane's propeller, a Robot's wind-up key

Part names are prefixed with the troop id ("knight.armR"). One unit is one
metre and one arena tile; a Cadet stands about 1.3 m tall.

  Blender -b --factory-startup --python assets/arena/blender/troops.py -- out.glb [preview.png] [only]
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit  # noqa: E402

kit.reset(seed=21)
# "team", "team2" (dark) and "team3" (light) follow the side at runtime.
kit.TINTS["team3"] = (0.28, 0.45, 1.0)


import importlib  # noqa: E402

ORDER = ["archers", "ogre", "imps", "duelist", "ranger", "drake", "mage"]
only = None
argv = sys.argv
if "--" in argv and len(argv) > argv.index("--") + 3:
    only = argv[argv.index("--") + 3].split(",")
roots = []
for i, troop in enumerate(ORDER):
    # Import only what is built, so a troop file being edited elsewhere
    # never breaks the others.
    if only and troop not in only:
        continue
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        f"troop_{troop}.py")
    if not os.path.exists(path):
        continue
    r = importlib.import_module(f"troop_{troop}").build()
    r.location = (i * 1.6, 0, 0)
    roots.append(r)

meshes = [o for r in roots for o in kit.descendants(r) if o.type == "MESH"]
for r in roots:
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in kit.descendants(r) if o.type == "MESH")
    parts = sorted(o.name for o in kit.descendants(r) if o.type == "MESH")
    print(f"TROOP {r.name}: {tris} triangles, parts {parts}")
kit.bake_ao(meshes, samples=96, distance=0.25)
out = kit.out_path()
if len(argv) > argv.index("--") + 2 and argv[argv.index("--") + 2] != "-":
    preview = argv[argv.index("--") + 2]
    if only and len(roots) == 1:
        # Front, back and side at eye level, then the game's high camera.
        base = preview[:-4] if preview.endswith(".png") else preview
        for suffix, el, az, size in (("front", 18, 150, 900),
                                     ("back", 18, -30, 700),
                                     ("side", 12, 90, 700),
                                     ("game", 55, 180, 220)):
            kit.preview(f"{base}-{suffix}.png", roots, elevation=el,
                        azimuth=az, margin=1.08, size=size)
    else:
        kit.preview(preview, roots, elevation=22, azimuth=150, margin=1.05,
                    size=1400)
for r in roots:
    r.location = (0, 0, 0)
if out and out != "-":
    kit.export(roots, out)
