"""Neutral studio review renders of the Pirate (clay and material).

Blender -b --factory-startup -t 3 --python assets/arena/blender/figure_pirate_review.py -- \
    <out-dir> [views] [poses]

views: comma list of names below (default: the standard set); poses: comma
list of pose names in figure_pirate_kit.POSES, rendered in three-quarter
material and clay front/side. PIRATE_REVIEW_BUILD=body|master|runtime picks
what is built (default master); PIRATE_REVIEW_BLEND=<file.blend> reviews a
saved build instead; PIRATE_REVIEW_SAVE=<file.blend> saves the build.
Images are written as JPG.
"""
import math
import os
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit  # noqa: E402
import figure_pirate_kit as pk  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = Path(argv[0] if argv else "work/arena/2026-10-08-roster/pirate/review")
OUT.mkdir(parents=True, exist_ok=True)
WANT = argv[1].split(",") if len(argv) > 1 and argv[1] not in ("", "-") else None
POSES = argv[2].split(",") if len(argv) > 2 and argv[2] not in ("", "-") else []
SIZE = int(os.environ.get("PIRATE_REVIEW_SIZE", "900"))
SAMPLES = int(os.environ.get("PIRATE_REVIEW_SAMPLES", "20"))

blend = os.environ.get("PIRATE_REVIEW_BLEND")
if blend:
    bpy.ops.wm.open_mainfile(filepath=blend)
    root = bpy.data.objects[pk.R]
    keep = set(kit.descendants(root))
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    scene = bpy.context.scene
else:
    scene = kit.reset(41)
    kit.TINTS["team3"] = (0.28, 0.45, 1.0)
    mode = os.environ.get("PIRATE_REVIEW_BUILD", "master")
    if mode == "runtime":
        import figure_pirate
        root = figure_pirate.build()
    elif mode == "head":
        import figure_pirate_sculpt
        root = figure_pirate_sculpt.build_head_only()
    elif mode == "body":
        import figure_pirate_sculpt
        root = figure_pirate_sculpt.build_body_only()
    else:
        import figure_pirate_sculpt
        root = figure_pirate_sculpt.build_master()
    save = os.environ.get("PIRATE_REVIEW_SAVE")
    if save:
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(save).resolve()), compress=True)

kit.refresh()
kit.fill_ao([o for o in kit.descendants(root) if o.type == "MESH" and not o.data.color_attributes.get("AO")])
scene.render.engine = "CYCLES"
kit.gpu()
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x = scene.render.resolution_y = SIZE
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 86
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
world = scene.world or bpy.data.worlds.new("review")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.12, .13, .14, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .35


def material(name, colour, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*colour, 1)
    p.inputs["Roughness"].default_value = rough
    p.inputs["Specular IOR Level"].default_value = .25
    return m


clay = material("pirate review clay", (.33, .33, .34), .75)
floor_mat = material("pirate review floor", (.09, .10, .11), .95)
if "pirate review floor" not in bpy.data.objects:
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -.0005))
    plane = bpy.context.object
    plane.name = "pirate review floor"
    plane.data.materials.append(floor_mat)


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat("-Z", "Y").to_euler()


def light(name, at, power, size):
    d = bpy.data.lights.new(name, "AREA")
    d.energy, d.size, d.shape = power, size, "DISK"
    o = bpy.data.objects.new(name, d)
    scene.collection.objects.link(o)
    o.location = at
    aim(o, (0, 0, .75))


light("key", (-2.4, 3.2, 4.4), 190, 2.0)
light("fill", (3.1, 2.7, 2.3), 60, 2.6)
light("rim", (1.2, -3.1, 3.2), 120, 2.2)
cd = bpy.data.cameras.new("review")
camera = bpy.data.objects.new("review", cd)
scene.collection.objects.link(camera)
scene.camera = camera
cd.type, cd.clip_start, cd.clip_end = "ORTHO", .01, 200
rig = next((o for o in kit.descendants(root) if o.type == "ARMATURE"), None)

C = (0, .03, .68)
F = (0, .02, 1.150)
HR = tuple(pk.WRIST[1] + pk.V(.01, .03, -.04))
HL = tuple(pk.WRIST[-1] + pk.V(-.01, .03, -.04))
VIEWS = {
    "clay-front": ((0, 5, .68), C, 1.45, True),
    "clay-side": ((5, .03, .68), C, 1.45, True),
    "clay-rear": ((0, -5, .68), C, 1.45, True),
    "clay-three": ((3.0, 4.2, 2.4), C, 1.5, True),
    "clay-game": ((0, 2.9, 4.8), (0, .03, .66), 1.5, True),
    "clay-face": ((1.6, 4.4, 1.5), F, .30, True),
    "clay-face-front": ((0, 5, 1.16), F, .26, True),
    "clay-face-side": ((5, .02, 1.16), F, .30, True),
    "clay-hand-right": ((2.6, 2.4, .9), HR, .24, True),
    "clay-hand-left": ((-2.6, 2.4, .9), HL, .22, True),
    "clay-hand-right-in": ((-1.2, 3.0, .2), HR, .22, True),
    "clay-upper": ((1.4, 4.6, 1.6), (0, .02, .93), .62, True),
    "clay-seat": ((.8, -4.6, .9), (0, -.12, .61), .30, True),
    "mat-seat": ((.8, -4.6, .9), (0, -.12, .61), .30, False),
    "mat-three": ((3.0, 4.2, 2.4), C, 1.5, False),
    "mat-front": ((0, 5, .68), C, 1.45, False),
    "mat-rear": ((0, -5, .68), C, 1.45, False),
    "mat-side": ((5, .03, .68), C, 1.45, False),
    "mat-game": ((0, 2.9, 4.8), (0, .03, .66), 1.5, False),
    "mat-face": ((1.6, 4.4, 1.5), F, .30, False),
    "mat-face-front": ((0, 5, 1.16), F, .26, False),
    "mat-face-side": ((5, .02, 1.16), F, .30, False),
    "mat-face-low": ((1.2, 4.0, .5), F, .30, False),
    "mat-upper": ((1.4, 4.6, 1.6), (0, .02, .93), .62, False),
}
DEFAULT = ["clay-front", "clay-side", "clay-rear", "clay-three", "clay-game", "clay-face",
           "clay-hand-right", "clay-hand-left", "mat-three"]


def render(name, at, target, scale, use_clay):
    camera.location = at
    aim(camera, target)
    cd.ortho_scale = scale
    scene.view_layers[0].material_override = clay if use_clay else None
    path = OUT / f"{name}.jpg"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("REVIEW", path, flush=True)


for name in (WANT or DEFAULT):
    if name in VIEWS:
        render(name, *VIEWS[name])
for pose in POSES:
    if rig is None:
        break
    pk.pose_rig(rig, pk.POSES[pose])
    render(f"pose-{pose}-mat", (3.0, 4.2, 2.4), C, 1.7, False)
    render(f"pose-{pose}-clay-front", (0, 5, .75), (0, .03, .75), 1.7, True)
    render(f"pose-{pose}-clay-side", (5, .03, .75), (0, .03, .75), 1.7, True)
if rig is not None:
    pk.pose_rig(rig, {})
