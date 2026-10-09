"""Separate Medic runtime copy, exact cameras and immutable-source evidence."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

import bpy
from mathutils import Quaternion, Vector

SOURCE = Path(__file__).resolve().parent
PROJECT = SOURCE.parents[2]
sys.path.insert(0, str(SOURCE))
import kit
import figure_medic_runtime as runtime

VERSION = os.environ.get("MEDIC_RUNTIME_VERSION", "v1")
BASE = PROJECT / "work/arena/2026-10-04-vgm/medic"
OUT = BASE / "runtime" / VERSION
OUT.mkdir(parents=True, exist_ok=True)
MASTER = BASE / "master/medic-master-v16.blend"
SOURCE_GLB = PROJECT / "public/3d/arena/dev/vgm-medic-source-v16.glb"
approved = {
    "master": "6f6332851fb6356af7d381fb1c8c0c80eff05fdea8e6673abc92c76e92b1c4b2",
    "glb": "92e79e17b9929268c01475a577040898d0f2e39caba0620cf59a23a59a56e96b",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


assert digest(MASTER) == approved["master"]
assert digest(SOURCE_GLB) == approved["glb"]
snapshot = OUT / "python"
snapshot.mkdir(exist_ok=True)
for name in ("kit.py", "figure_medic.py", "figure_medic_forms.py", "figure_medic_kit.py",
             "figure_medic_sculpt.py", "figure_medic_runtime.py", "figure_medic_runtime_review.py"):
    shutil.copy2(SOURCE / name, snapshot / name)

bpy.ops.wm.open_mainfile(filepath=str(MASTER))
root = bpy.data.objects["medic"]
keep = set(kit.descendants(root))
for o in list(bpy.data.objects):
    if o not in keep:
        bpy.data.objects.remove(o, do_unlink=True)
rig = next(o for o in keep if o.type == "ARMATURE")
scene = bpy.context.scene
engines = scene.render.bl_rna.properties["engine"].enum_items.keys()
scene.render.engine = next(n for n in engines if "EEVEE" in n)
scene.render.resolution_x = scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.world = bpy.data.worlds.new("Medic comparison neutral studio")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.12, .12, .12, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = .30

clay = bpy.data.materials.new("Honest neutral comparison clay")
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (.29, .30, .31, 1)
bsdf.inputs["Roughness"].default_value = .78
bsdf.inputs["Specular IOR Level"].default_value = .22
floor = bpy.data.materials.new("Matte comparison floor")
floor.use_nodes = True
floor.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.11, .115, .12, 1)
floor.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .95
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.006))
plane = bpy.context.object
plane.name = "Medic comparison floor"
plane.data.materials.append(floor)


def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def area(name, at, energy, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy, data.size, data.shape = energy, size, "DISK"
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = at
    aim(obj, (0, 0, .8))


area("Raking key", (-2.4, 2.6, 3.8), 110, 1.6)
area("Frontal fill", (2.8, 2.4, 2.2), 35, 2.8)
area("Rear separation", (1, -2.6, 3.3), 75, 2.2)
area("Top softbox", (-.4, -.4, 5.1), 35, 2)
data = bpy.data.cameras.new("Medic same source runtime camera")
camera = bpy.data.objects.new("Medic same source runtime camera", data)
scene.collection.objects.link(camera)
scene.camera = camera
data.type = "ORTHO"
data.clip_start, data.clip_end = .01, 200


def clear():
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion()
        b.location, b.scale = (0, 0, 0), (1, 1, 1)
    kit.refresh()


def pose(part, x=0, y=0, z=0):
    b = rig.pose.bones["medic" + part]
    frame = b.bone.matrix_local.to_quaternion()
    world = Quaternion((1, 0, 0), x) @ Quaternion((0, 0, 1), y) @ Quaternion((0, 1, 0), -z)
    b.rotation_quaternion = frame.inverted() @ world @ frame
    kit.refresh()


def heal():
    pose("armR", 1.75, 0, .14)
    pose("foreR", -.9)
    pose("handR", -.9, 0, -.14)
    pose("weapon", 0)
    pose("head", .16)
    pose("torso", .05)
    pose("armL", .12, 0, -.18)


def render(stage, name, at, target, scale, neutral=True):
    camera.location = at
    aim(camera, target)
    data.ortho_scale = scale
    scene.view_layers[0].material_override = clay if neutral else None
    path = OUT / f"medic-runtime-{VERSION}-{stage}-{name}.png"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    return str(path)


views = [
    ("clay-front", (0, 4.8, .69), (0, 0, .66), 1.40),
    ("clay-side", (4.8, 0, .69), (0, 0, .66), 1.40),
    ("clay-rear", (0, -4.8, .69), (0, 0, .66), 1.40),
    ("material-three-quarter", (2.8, 4.5, 2.1), (0, 0, .65), 1.40, False),
    ("material-face", (.55, 4.2, 1.23), (0, .014, 1.156), .36, False),
    ("clay-right-hand", (2.8, 4.2, 1.25), tuple(runtime.sculpt.HAND[1] + Vector((0, 0, .025))), .23),
]
raised = [
    ("material-heal", (2.2, 4.8, 1.8), (0, .06, .76), 1.60, False),
    ("material-heal-elbow", (3.7, 2.8, 1.6), (.18, .16, 1.10), .52, False),
]
files = []
clear()
if os.environ.get("MEDIC_RUNTIME_COMPARE_SOURCE", "1") == "1":
    files += [render("source", *v) for v in views]
    heal()
    files += [render("source", *v) for v in raised]
    clear()
print("MEDIC APPROVED SOURCE COMPARISONS READY", flush=True)
runtime.reduce_runtime(root)
runtime_path = OUT / f"medic-runtime-{VERSION}.blend"
scene.view_layers[0].material_override = None
bpy.ops.wm.save_as_mainfile(filepath=str(runtime_path))
glb_path = PROJECT / "public/3d/arena/dev" / f"vgm-medic-runtime-{VERSION}.glb"
kit.export([root], str(glb_path))
print("MEDIC EARLY RUNTIME READY", str(runtime_path), str(glb_path), flush=True)
files += [render("runtime", *v) for v in views]
heal()
files += [render("runtime", *v) for v in raised]
clear()
scene.view_layers[0].material_override = None
bpy.ops.wm.save_as_mainfile(filepath=str(runtime_path))
assert digest(MASTER) == approved["master"]
assert digest(SOURCE_GLB) == approved["glb"]
meshes = [o for o in kit.descendants(root) if o.type == "MESH"]
evidence = {
    "runtime": str(glb_path), "editableRuntime": str(runtime_path),
    "source": str(SOURCE_GLB), "approvedMaster": str(MASTER),
    "approvedHashes": approved, "sourceUnchanged": True,
    "runtimeTriangles": sum(runtime.triangles(o) for o in meshes),
    "runtimeMeshNodes": len(meshes), "sameCameraViews": files,
    "pythonSnapshot": str(snapshot), "arenaReviewedAO": 1,
    "aoContract": root["aoContract"], "normalCache": "MedicSourceNormals",
    "reduction": json.loads(root["runtimeReduction"]),
}
(OUT / "evidence.json").write_text(json.dumps(evidence, indent=2))
print("MEDIC RUNTIME REVIEW COMPLETE", json.dumps(evidence), flush=True)
