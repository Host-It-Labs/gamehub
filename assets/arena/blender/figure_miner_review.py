"""Review renders of the Miner's detailed source and runtime copy.

Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_miner_review.py -- OUTDIR STAGE VIEWS [--material]

STAGE: clay (the connected skin only), master (the full rigged source),
runtime (the reduced copy built from the master) or a .blend path holding a
`miner` root. VIEWS is a comma list of front, side, rear, three, threeback,
game, gameback, face, faceside, facethree, handR, handL, torso, boots,
plus poses `pose:<name>` with an optional camera `pose:<name>@three`
(figure_miner_poses.py). Each view writes OUTDIR/<view>.png (clay unless
--material). MINER_SAVE=<path.blend> saves the built stage.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bpy  # noqa: E402
import kit  # noqa: E402
import figure_miner_clay as mc  # noqa: E402
import figure_miner_sculpt as ms  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:]
out, stage, views = argv[0], argv[1], argv[2].split(",")
material = "--material" in argv
os.makedirs(out, exist_ok=True)
kit.reset(seed=33)
kit.TINTS["team3"] = (0.28, 0.45, 1.0)

if stage == "clay":
    root = ms.build_clay()
elif stage == "master":
    import figure_miner_rig as mr
    root = mr.build_master()
elif stage == "runtime":
    import figure_miner_runtime as mt
    root = mt.reduce_runtime(__import__("figure_miner_rig").build_master())
else:
    with bpy.data.libraries.load(stage, link=False) as (src, dst):
        dst.objects = list(src.objects)
    for o in dst.objects:
        if o and o.name not in bpy.context.scene.objects:
            bpy.context.collection.objects.link(o)
    root = bpy.data.objects["miner"]
if os.environ.get("MINER_SAVE"):
    bpy.ops.wm.save_as_mainfile(filepath=os.environ["MINER_SAVE"], compress=True)

import figure_miner_poses as mp  # noqa: E402

objects = kit.descendants(root)
rig = next((o for o in objects if o.type == "ARMATURE"), None)
mc.review_scene(size=(1000, 1000), engine=os.environ.get("MINER_ENGINE", "BLENDER_EEVEE"),
                samples=int(os.environ.get("MINER_SAMPLES", "48")))
if material:
    import figure_miner_paint as paint  # noqa: E402
    import figure_miner_runtime as runtime  # noqa: E402
    if not any(o.type == "MESH" and o.data.color_attributes.get(paint.LAYER) for o in objects):
        runtime.paint_all(root)
    for o in objects:
        if o.type == "MESH":
            if not o.data.color_attributes.get("AO"):
                kit.fill_ao([o])
            paint.combine(o)
mc.clay_override(not material, objects)

CAMS = {
    "front": ((0, 0, 0.66), 3.4, 6, 0, 1.50),
    "side": ((0, 0, 0.66), 3.4, 6, 90, 1.50),
    "rear": ((0, 0, 0.66), 3.4, 6, 180, 1.50),
    "three": ((0, 0, 0.66), 3.4, 12, 35, 1.50),
    "threeback": ((0, 0, 0.66), 3.4, 12, 145, 1.50),
    "game": ((0, 0.05, 0.62), 3.6, 55, 15, 1.62),
    "gameback": ((0, 0.05, 0.62), 3.6, 55, 195, 1.62),
    "face": ((0, 0.05, 1.12), 1.0, 4, 14, 0.30),
    "faceside": ((0, 0.0, 1.12), 1.0, 4, 80, 0.32),
    "facethree": ((0, 0.03, 1.12), 1.0, 8, 40, 0.31),
    "handR": ("handR", 0.6, 10, 60, 0.20),
    "handL": ("handL", 0.6, 10, -60, 0.20),
    "torso": ((0, 0.0, 0.80), 2.0, 8, 25, 0.62),
    "boots": ((0, 0.02, 0.14), 1.4, 20, 30, 0.42),
    "pick": ("pick", 1.0, 20, 70, 0.36),
    "pitfront": ((0.19, 0.02, 0.80), 1.0, 0, 20, 0.22),
    "pitside": ((0.19, 0.0, 0.80), 1.0, 0, 70, 0.22),
    "pitback": ((0.19, -0.02, 0.80), 1.0, 0, 160, 0.22),
    "hat": ((0, 0.0, 1.22), 1.0, 25, 30, 0.34),
    "nape": ((0, -0.03, 0.98), 1.0, 25, 180, 0.30),
    "collar": ((0, 0.03, 0.97), 1.0, 15, 20, 0.30),
}


def target(t):
    if not isinstance(t, str):
        return t
    if t == "pick":
        e1, e2, e3 = ms.hand_frame(1)
        return ms.grip_centre(1) + e2 * 0.45
    s = 1 if t.endswith("R") else -1
    if rig:
        names = ("miner" + t, "miner." + t)
        b = next(rig.pose.bones[n] for n in names if n in rig.pose.bones)
        p = rig.matrix_world @ b.head
        # Common-axis bones: local y is up; the fist hangs below the wrist.
        return p + (rig.matrix_world.to_3x3() @ (b.matrix.to_3x3() @ mc.V(0, -0.050, 0.010)))
    return ms.grip_centre(s)


for view in views:
    name = view
    pose = None
    if view.startswith("pose:"):
        spec = view[5:]
        pose, _, cam = spec.partition("@")
        cam = cam or "three"
        name = f"pose-{pose}-{cam}"
    else:
        cam = view
    if rig:
        prefix = "miner" if any(b.name.startswith("miner") and "." not in b.name for b in rig.pose.bones) else "miner."
        mc.pose_bones(rig, mp.POSES.get(pose, {}) if pose else {}, prefix)
    t, dist, el, az, ortho = CAMS[cam]
    mc.camera("review-cam", target(t), dist, el, az, ortho=ortho)
    mc.render(os.path.join(out, name + ".png"))
print("REVIEW DONE", out)
