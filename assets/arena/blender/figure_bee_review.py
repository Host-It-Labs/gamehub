"""External Blender source/frozen-copy review for Bee, JPG evidence only.

PYTHONDONTWRITEBYTECODE=1 Blender -b --factory-startup --python this_file
The Codex sandbox crashes before Python; run in the integrating root's
working native Blender environment. Writes only Bee-owned paths.
"""
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
from figure_bee_sculpt import build_master, build_runtime_source, save_asset

PROJECT = HERE.parents[2]
OUT = PROJECT / "work/arena/2026-10-08-roster/bee"
MASTER = OUT / "bee-master-v2.blend"
RUNTIME = HERE / "runtime/bee-runtime-v2.blend"
VIEWS = {
    "front": ((0, 1, .14), (0, 0, .166), .49),
    "side": ((1, 0, .07), (0, 0, .166), .49),
    "rear": ((0, -1, .14), (0, 0, .166), .49),
    "three": ((1, 1, .56), (0, 0, .166), .49),
    "game": ((0, 1, math.tan(math.radians(55))), (0, 0, .166), .49),
    "face": ((.12, 1, .17), (0, .16, .204), .17),
    "feet": ((1, .45, .10), (0, .03, .11), .19),
}


def studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 90
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Bee honest neutral studio")
    scene.world.use_nodes = True
    world = scene.world.node_tree.nodes["Background"]
    world.inputs[0].default_value = (.16, .17, .18, 1)
    world.inputs[1].default_value = .38
    for name, at, energy, size in (
            ("Bee soft key", (-.55, .65, 1.15), 26, .65),
            ("Bee frontal fill", (.65, .60, .50), 9, .80),
            ("Bee rim", (.25, -.75, .80), 18, .55)):
        data = bpy.data.lights.new(name, "AREA")
        data.energy, data.size, data.shape = energy, size, "DISK"
        obj = bpy.data.objects.new(name, data)
        scene.collection.objects.link(obj)
        obj.location = at
        obj.rotation_euler = (Vector((0,0,.16))-obj.location).to_track_quat("-Z", "Y").to_euler()
    data = bpy.data.cameras.new("Bee orthographic review")
    data.type = "ORTHO"
    camera = bpy.data.objects.new("Bee orthographic review", data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    clay = bpy.data.materials.new("Bee neutral clay")
    clay.use_nodes = True
    shader = clay.node_tree.nodes["Principled BSDF"]
    shader.inputs["Base Color"].default_value = (.30, .31, .32, 1)
    shader.inputs["Roughness"].default_value = .82
    shader.inputs["Specular IOR Level"].default_value = .20
    return scene, camera, clay


def render(scene, camera, clay, path, view, material=False, wide=False):
    direction, center, span = VIEWS[view]
    if wide:
        center, span = (0,.01,.138), .64
    camera.location = Vector(center)+Vector(direction).normalized()*1.2
    camera.rotation_euler = (Vector(center)-camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = span
    scene.view_layers[0].material_override = None if material else clay
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def poses(root, values):
    for obj in kit.descendants(root):
        if obj.type == "EMPTY" and obj != root:
            obj.rotation_euler = (0,0,0)
    for part, (x,y,z) in values.items():
        # Convert the move API's Three axes to Blender common axes.
        obj = bpy.data.objects["bee."+part]
        obj.rotation_euler = (x,-z,y)
    kit.refresh()


records = []
for stage, builder, path in (("master", build_master, MASTER),
                              ("runtime", build_runtime_source, RUNTIME)):
    kit.reset(808)
    root = builder()
    save_asset(root, path)
    folder = OUT / "blender-review"
    folder.mkdir(parents=True,exist_ok=True)
    scene, camera, clay = studio()
    for view in VIEWS:
        render(scene, camera, clay, folder/f"{stage}-clay-{view}.jpg", view)
    render(scene, camera, clay, folder/f"{stage}-material-three.jpg", "three", material=True)
    for name, values, view in (
            ("wing-up", {"wingL": (0,0,-.9), "wingR": (0,0,.9)}, "front"),
            ("wing-down", {"wingL": (0,0,.5), "wingR": (0,0,-.5)}, "front"),
            ("sting", {"tail": (2.52,0,0), "tail2": (.04,0,0),
                       "armL": (.28,0,-.42), "armR": (.28,0,.42),
                       "extra": (.18,0,.42), "extra2": (.18,0,-.42)}, "side")):
        poses(root, values)
        render(scene, camera, clay, folder/f"{stage}-clay-{name}.jpg", view, wide=True)
    poses(root, {})
    points = [obj.matrix_world@v.co for obj in kit.descendants(root)
              if obj.type == "MESH" for v in obj.data.vertices]
    lo = [min(p[j] for p in points) for j in range(3)]
    hi = [max(p[j] for p in points) for j in range(3)]
    records.append({"stage": stage, "path": str(path),
                    "triangles": root["sourceTriangles"], "min": lo, "max": hi,
                    "dimensions": [hi[j]-lo[j] for j in range(3)]})
(OUT/"blender-build-measurements.json").write_text(json.dumps(records,indent=2))
print(json.dumps(records,indent=2))
