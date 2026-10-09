"""Preserve and render the full Viking sculpt; reduction is a separate mode.

Blender -b -t 2 --python .../figure_viking_review.py -- <review-dir> <source.glb>
Each run writes unique logs outside this script.  Source components are kept
hidden in the editable master, and only the root is selected for GLB export.
"""

import json
import math
import os
import shutil
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_viking
import figure_viking_kit as vk

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0]).resolve()
glb = Path(args[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
runtime = os.environ.get("VIKING_REVIEW_RUNTIME") == "1"
if runtime:
    os.environ.pop("VIKING_ARCHIVE", None)
else:
    os.environ["VIKING_ARCHIVE"] = "1"
kit.reset(seed=33)
kit.TINTS["team3"] = (.28, .45, 1.)
root = figure_viking.build_runtime() if runtime else figure_viking.build_master()
head = bpy.data.objects["viking.head"]
if not root.get("arenaReviewedRestPose"):
    head.rotation_euler.x += math.radians(5)
kit.refresh()
meshes = [ob for ob in kit.descendants(root) if ob.type == "MESH"]
if runtime:
    if not root.get("arenaReviewedAO"):
        kit.bake_ao(meshes, samples=64, distance=.17)
else:
    kit.fill_ao(meshes)


def bounds():
    points = [o.matrix_world@v.co for o in meshes for v in o.data.vertices]
    return (Vector(tuple(min(v[i] for v in points) for i in range(3))),
            Vector(tuple(max(v[i] for v in points) for i in range(3))))


lo, hi = bounds()
master = out / ("viking-runtime-copy.blend" if runtime else "viking-source-master.blend")
bpy.ops.wm.save_as_mainfile(filepath=str(master))
for name in ("figure_viking.py", "figure_viking_kit.py", "figure_viking_sculpt.py",
             "figure_viking_review.py", "figure_viking_runtime.py"):
    shutil.copy2(HERE/name, out/name)
kit.export([root], str(glb))
print("VIKING_SOURCE_READY", str(glb), flush=True)

scene = bpy.context.scene
scene.render.engine = os.environ.get("VIKING_REVIEW_ENGINE", "CYCLES")
if scene.render.engine == "CYCLES":
    kit.gpu()
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = "PNG"
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("Viking neutral studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.18, .205, .23, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .48
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def area(name, p, watts, size, colour):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.shape, data.size, data.color = watts, "DISK", size, colour
    o = bpy.data.objects.new(name, data)
    scene.collection.objects.link(o)
    o.location = p
    o.rotation_euler = (V_TARGET-Vector(p)).to_track_quat("-Z", "Y").to_euler()


V_TARGET = Vector((0, 0, .75))
area("Viking key", (-2.1, 3.2, 4.3), 290, 3.3, (1, .93, .85))
area("Viking fill", (2.6, 1.5, 2.4), 115, 2.8, (.83, .9, 1))
area("Viking rim", (0, -2.7, 3), 230, 2.6, (.95, .98, 1))
floor = kit.box("Viking review ground", (200, 200, .025), (0, 0, -.024),
                "plain:grey", grid=False)
floor.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.125, .14, .155, 1)
data = bpy.data.cameras.new("Viking honest orthographic camera")
data.type = "ORTHO"
cam = bpy.data.objects.new("Viking camera", data)
scene.collection.objects.link(cam)
scene.camera = cam


def render(name, az, el=8, target=(0, .04, .67), scale=1.65, size=1000):
    selected = os.environ.get("VIKING_REVIEW_VIEWS")
    if selected and name not in selected.split(","):
        return
    a, e = math.radians(az), math.radians(el)
    target = Vector(target)
    cam.location = target + Vector((math.sin(a)*3.4*math.cos(e),
                                     math.cos(a)*3.4*math.cos(e), 3.4*math.sin(e)))
    cam.rotation_euler = (target-cam.location).to_track_quat("-Z", "Y").to_euler()
    data.ortho_scale = scale
    scene.render.resolution_x = size
    scene.render.resolution_y = size
    scene.render.filepath = str(out/f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("VIKING_REVIEW_IMAGE", scene.render.filepath, flush=True)


saved = {o: list(o.data.materials) for o in meshes}
clay = bpy.data.materials.new("Viking uniform neutral clay")
clay.diffuse_color = (.55, .55, .55, 1)
clay.use_nodes = True
clay.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.43, .43, .43, 1)
clay.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .84
for o in meshes:
    for i in range(len(o.data.materials)):
        o.data.materials[i] = clay
for name, az, el in (("clay-front", 0, 0), ("clay-side", 90, 0)):
    render(name, az, el)
for o in meshes:
    for i, mat in enumerate(saved[o]):
        o.data.materials[i] = mat
render("colour-front", 0, 8)
render("right-palm-thumb-web", -58, -5, target=(.14, .19, .745), scale=.265, size=1200)
render("left-palm-thumb-web", 36, -8, target=(-.025, .32, .60), scale=.28, size=1200)
render("face-and-fur", -12, 6, target=(0, .02, 1.114), scale=.53, size=1300)
render("grip-and-axe", -35, 14, target=(-.05, .24, .59), scale=1.04, size=1200)
render("rear-construction", 175, 9, target=(0, -.02, .84), scale=.86, size=1200)
for o in meshes:
    for i in range(len(o.data.materials)):
        o.data.materials[i] = clay
for name, az, el in (("clay-rear", 180, 0), ("clay-game", -18, 55)):
    render(name, az, el)
for o in meshes:
    for i, mat in enumerate(saved[o]):
        o.data.materials[i] = mat
for name, az, el in (("colour-rear", 180, 8), ("colour-side", 90, 8), ("colour-game", -18, 55)):
    render(name, az, el)
rest = {o: o.rotation_quaternion.copy() if o.rotation_mode == "QUATERNION"
        else o.rotation_euler.to_quaternion() for o in kit.descendants(root)}
for pose in ("walk", "walk2", "wind", "spin", "rage"):
    for o, q in rest.items():
        o.rotation_mode = "QUATERNION"
        o.rotation_quaternion = q
    vk.apply_runtime(root, figure_viking.POSES[pose])
    render(f"pose-{pose}", -25, 12, scale=1.86)
for o, q in rest.items():
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = q
kit.refresh()
# The initial source export is high resolution, not an optimized production
# asset. Genuine AO follows independent primary-form review.
kit.export([root], str(glb))
blob = glb.read_bytes()
length, tag = struct.unpack_from("<II", blob, 12)
gltf = json.loads(blob[20:20+length])
report = {
    "master": str(master), "sourceGLB": str(glb), "optimized": runtime,
    "triangles": sum(gltf["accessors"][p.get("indices", p["attributes"]["POSITION"])]["count"]//3
                     for m in gltf["meshes"] for p in m["primitives"]),
    "editableTriangles": sum(vk.tris(o) for o in meshes), "bytes": len(blob),
    "bounds": {"min": list(lo), "max": list(hi)},
    "materials": sorted({m.name for o in meshes for m in o.data.materials}),
    "jointNames": [o.name for o in kit.descendants(root)],
    "newJoints": ["foreL", "foreR", "handL", "handR"],
    "gltfMaterials": [m.get("name") for m in gltf["materials"]],
    "ao": "genuine 64-sample bake" if runtime else "plain white for honest anatomy review; genuine bake follows review",
    "rig": "purpose-authored overlapping knee/ankle; connected bent two-hand arm hold",
}
(out/("runtime-report.json" if runtime else "source-report.json")).write_text(json.dumps(report, indent=2))
print("VIKING_SOURCE_REPORT", json.dumps(report), flush=True)
