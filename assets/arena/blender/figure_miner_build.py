"""Build the Miner's detailed master, or reduce a saved master to the runtime
copy. Two separate Blender runs, one after the other, keep each under a few
GB of memory (one process doing both peaked near 6 GB):

  Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_miner_build.py -- master MASTER.blend
  Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_miner_build.py -- runtime MASTER.blend RUNTIME.blend

`master` sculpts, dresses and rigs the full source and saves it compressed;
`runtime` opens that file, reduces it (figure_miner_runtime.reduce_runtime)
and freezes the neutral runtime copy to RUNTIME.blend (normally
assets/arena/blender/runtime/miner-runtime-vN.blend, after review).
MINER_FAST=1 makes a quick coarse master for trials.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
stage, master_path = argv[0], os.path.abspath(argv[1])

if stage == "master":
    import kit  # noqa: E402
    kit.reset(seed=33)
    kit.TINTS["team3"] = (0.28, 0.45, 1.0)
    import figure_miner_rig as mr  # noqa: E402
    root = mr.build_master()
    skin = bpy.data.objects["miner.skin"]
    tris = sum(len(p.vertices) - 2 for o in kit.descendants(root) if o.type == "MESH" for p in o.data.polygons)
    print("MINER MASTER", len(skin.data.vertices), "skin vertices,", tris, "triangles", flush=True)
    os.makedirs(os.path.dirname(master_path), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0  # no .blend1 beside it
    bpy.ops.wm.save_as_mainfile(filepath=master_path, compress=True)
    print("MINER MASTER SAVED", master_path, os.path.getsize(master_path), flush=True)
elif stage == "runtime":
    bpy.ops.wm.open_mainfile(filepath=master_path)
    import figure_miner_runtime as mt  # noqa: E402
    root = bpy.data.objects["miner"]
    mt.reduce_runtime(root)
    mt.freeze(root, os.path.abspath(argv[2]))
else:
    raise SystemExit("stage must be master or runtime")
