"""Private source/runtime review driver. Run from repository root in Blender.

--stage source builds and saves the detailed master, then clay/material JPGs.
--stage runtime loads that master AFTER recorded source visual review,
reduces a copy, bakes CPU AO, freezes one runtime file, and writes matched JPGs.
--stage runtime-review reopens the candidate for focused additional views.
--stage export-candidate exports only the dev GLB; runtime acceptance remains
a separate record. No shipped manifest or shared asset is written here.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Quaternion, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_folk_kit as fk
import figure_jetpack_sculpt as sculpt
import figure_jetpack_runtime as runtime

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument("--stage", choices=("source", "runtime", "runtime-review", "export-candidate"), required=True)
parser.add_argument("--only", default="", help="Comma-separated review view names, otherwise all")
parser.add_argument("--resolution", type=int, default=960)
parser.add_argument("--samples", type=int, default=24)
args = parser.parse_args(argv)
if args.stage == "runtime" and args.only:
    parser.error("Build the full matched runtime set; use runtime-review --only for additional views")

WORK, MASTER, CACHE = runtime.WORK, runtime.SOURCE, runtime.RUNTIME
WORK.mkdir(parents=True, exist_ok=True)
runtime_info = None
# Fail before loading/reducing/freezing a copy when the pose evidence is stale.
phase_path = WORK / "c2-motion-review-poses.json"
if not phase_path.is_file():
    raise FileNotFoundError("Current shared-reach phase fixture is missing: " + str(phase_path))
phase_fixture = json.loads(phase_path.read_text())
for key, file in (("sourceRigSHA256", HERE / "figure_jetpack_sculpt.py"),
                  ("parkedMoveSHA256", WORK / "moves-jetpack-codex.ts"),
                  ("reachSHA256", runtime.PROJECT / "components/game/arena/moves/reach.ts")):
    if phase_fixture.get(key) != runtime.file_hash(file):
        raise RuntimeError("Jetpack phase fixture is stale for " + file.name +
                           "; run the Jetpack c4-motion-check.mjs first")
phases = phase_fixture["phases"]
if args.stage == "source":
    kit.reset(seed=47)
    root = sculpt.build_master()
    root["jetpackSourceFingerprint"] = runtime.source_fingerprint()
    root["jetpackSourceRevision"] = "v3"
    runtime.validate_rig(root)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(MASTER))
    info = runtime.metrics(root)
    info["sourceFingerprint"] = runtime.source_fingerprint()
    info["sourceRevision"] = "v3"
    (WORK / "source-metrics-v3.json").write_text(json.dumps(info, indent=2) + "\n")
    prefix = "source-v3"
elif args.stage == "runtime":
    runtime.require_review("source", runtime.source_fingerprint())
    if not MASTER.exists():
        raise RuntimeError("Jetpack detailed master is missing; run --stage source first")
    bpy.ops.wm.open_mainfile(filepath=str(MASTER))
    root = bpy.data.objects.get(sculpt.R)
    if not root or root.get("jetpackSourceFingerprint") != runtime.source_fingerprint():
        raise RuntimeError("Jetpack saved master is stale for the reviewed private source")
    runtime.reduce_runtime(root)
    runtime.bake_neutral_ao(root)
    runtime_info = runtime.freeze_candidate(root)
    prefix = "runtime-" + runtime.REVISION
else:
    kit.reset(seed=47)
    # Use the same clean-material loader as the ordinary figures collector.
    from figure_jetpack import build
    root = build()
    prefix = "runtime-" + runtime.REVISION

if args.stage == "export-candidate":
    path = runtime.PROJECT / f"public/3d/arena/dev/jetpack-{runtime.REVISION}.glb"
    kit.export([root], str(path))
    data = {"path": str(path.relative_to(runtime.PROJECT)), "sha256": runtime.file_hash(path),
            "runtime": str(CACHE.relative_to(runtime.PROJECT)),
            "runtimeSHA256": runtime.file_hash(CACHE), "visualAcceptance": False,
            **runtime.metrics(root)}
    (WORK / f"dev-export-{runtime.REVISION}.json").write_text(json.dumps(data, indent=2) + "\n")
    print("JETPACK DEV CANDIDATE", json.dumps(data), flush=True)
    raise SystemExit(0)

scene = bpy.context.scene
scene.render.threads_mode, scene.render.threads = "FIXED", 3
scene.render.engine = "CYCLES"
scene.cycles.device, scene.cycles.samples = "CPU", args.samples
scene.render.resolution_x = scene.render.resolution_y = args.resolution
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.quality = 91
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
world = scene.world or bpy.data.worlds.new("__jetpack-review-world")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.19, .23, .29, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = .45

clay = bpy.data.materials.new("__jetpack-clay")
clay.use_nodes = True
bsdf = clay.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Base Color"].default_value = (.53, .55, .57, 1)
bsdf.inputs["Roughness"].default_value = .80
scene.view_layers[0].material_override = clay

floor_material = bpy.data.materials.new("__jetpack-review-floor-material")
floor_material.use_nodes = True
floor_bsdf = floor_material.node_tree.nodes.get("Principled BSDF")
floor_bsdf.inputs["Base Color"].default_value = (.14, .17, .20, 1)
floor_bsdf.inputs["Roughness"].default_value = .92
floor = kit.box("__jetpack-review-floor", (100, 100, .01), (0, 0, -.012), grid=False)
floor.data.materials.append(floor_material)


def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def light(name, position, energy, size):
    data = bpy.data.lights.new("__jetpack-review-" + name, "AREA")
    data.energy, data.shape, data.size = energy, "DISK", size
    obj = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(obj)
    obj.location = position
    aim(obj, (0, 0, .78))


light("key", (-2.2, 3.3, 4.5), 190, 2.2)
light("fill", (2.5, 2.0, 2.8), 75, 2.6)
light("rim", (.8, -3.0, 3.2), 150, 2.0)
camera_data = bpy.data.cameras.new("__jetpack-review-camera")
camera = bpy.data.objects.new(camera_data.name, camera_data)
scene.collection.objects.link(camera)
camera_data.type, camera_data.clip_start, camera_data.clip_end = "ORTHO", .01, 100
scene.camera = camera
rig = runtime.validate_rig(root)


def set_pose(values=None, body=None):
    root.location, root.rotation_euler = (0, 0, 0), (0, 0, 0)
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"
        bone.rotation_quaternion = Quaternion()
        bone.location = (0, 0, 0)
    for name, angles in (values or {}).items():
        bone = rig.pose.bones.get(sculpt.R + "." + name)
        if not bone:
            raise ValueError("Unknown Jetpack review joint: " + name)
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted() @ fk.runtime_quat(*angles[:3]) @ frame
        if len(angles) > 3:
            bone.location = frame.inverted() @ Vector((0, 0, angles[3]))
    if body:
        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = fk.runtime_quat(-body.get("lean", 0), 0, body.get("roll", 0))
        root.location.z = body.get("lift", 0)
        root.location.y = body.get("lunge", 0)
    kit.refresh()


neutral = {}
# Static current shared-reach goals replace the old rig's hand-authored
# attack angles. They do not represent actual renderer spring frames.
wind, impact, recovery = (phases[name]["pose"] for name in ("wind", "impact", "recovery"))

views = [
    ("clay-front", (0, 3.1, 1.05), (0, 0, .70), 1.60, neutral, True),
    ("clay-side", (3.1, 0, 1.04), (0, 0, .70), 1.60, neutral, True),
    ("clay-rear", (0, -3.1, 1.05), (0, 0, .70), 1.60, neutral, True),
    ("clay-three", (2.6, 3.0, 1.7), (0, 0, .70), 1.64, neutral, True),
    ("clay-game55", (2.3, 3.1, 6.21), (0, 0, .70), 1.52, neutral, True),
    ("clay-face", (.35, 2.5, 1.43), (0, .025, 1.189), .35, neutral, True),
    ("clay-face-profile", (2.5, .25, 1.40), (0, .020, 1.190), .35, neutral, True),
    ("clay-handL", (-1.8, 2.0, .72), (-.215, .057, .507), .24, neutral, True),
    ("clay-handR", (1.8, 2.0, .73), (.215, .067, .505), .29, neutral, True),
    ("clay-handR-back", (1.8, -1.6, .70), (.215, .067, .505), .29, neutral, True),
    ("clay-forward120", (2.0, 3.0, 1.60), (0, .16, .87), 1.70,
     {"clavR": (.15, .13, .10), "armR": (1.944, 0, 0), "foreR": (.12, 0, 0)}, True),
    ("clay-out100", (0, 3.1, 1.25), (0, 0, .81), 1.85,
     {"clavR": (0, 0, .16), "armR": (0, 0, 1.585), "foreR": (.13, 0, 0)}, True),
    ("clay-elbow140", (2.5, 2.0, 1.20), (0, .10, .87), 1.70,
     {"armR": (.90, 0, .13), "foreR": (2.21, 0, 0), "handR": (.12, 0, 0)}, True),
    ("clay-knee120", (3.0, .5, 1.2), (0, -.06, .66), 1.67,
     {"legR": (.73, 0, 0), "kneeR": (-2.094, 0, 0), "footR": (.30, 0, 0)}, True),
    ("clay-wind", (2.4, 3.0, 1.60), (0, .12, .72), 1.75, wind, True),
    ("clay-impact", (2.4, 3.0, 1.60), (0, .12, .72), 1.75, impact, True),
    ("clay-recovery", (2.4, 3.0, 1.60), (0, .12, .72), 1.75, recovery, True),
    ("clay-wind-side", (3.1, 0, 1.04), (0, .10, .75), 1.70, wind, True),
    ("clay-impact-side", (3.1, 0, 1.04), (0, .10, .75), 1.70, impact, True),
    ("clay-recovery-side", (3.1, 0, 1.04), (0, .10, .75), 1.70, recovery, True),
    ("clay-impact-grip", (1.5, 2.3, 1.10), (.225, .435, .79), .40, impact, True),
    ("material-three", (2.6, 3.0, 1.70), (0, 0, .70), 1.64, neutral, False),
    ("material-face", (.35, 2.5, 1.43), (0, .025, 1.189), .35, neutral, False),
    ("material-face-profile", (2.5, .25, 1.40), (0, .020, 1.190), .35, neutral, False),
    ("clay-hair-rear", (2.2, -2.5, 1.53), (0, -.012, 1.205), .35, neutral, True),
    ("material-hair-rear", (2.2, -2.5, 1.53), (0, -.012, 1.205), .35, neutral, False),
    ("material-handR", (1.8, 2.0, .73), (.215, .067, .505), .29, neutral, False),
    ("material-handR-back", (1.8, -1.6, .70), (.215, .067, .505), .29, neutral, False),
    ("clay-collar", (1.6, 2.0, 1.28), (0, -.006, 1.045), .39, neutral, True),
    ("material-collar", (1.6, 2.0, 1.28), (0, -.006, 1.045), .39, neutral, False),
    ("clay-collar-rear", (-1.6, -2.0, 1.28), (-.07, -.10, 1.022), .39, neutral, True),
    ("material-collar-rear", (-1.6, -2.0, 1.28), (-.07, -.10, 1.022), .39, neutral, False),
    ("material-exhaust", (1.8, -2.0, 1.0), (0, -.193, .654), .48, neutral, False),
    ("material-game55", (2.3, 3.1, 6.21), (0, 0, .70), 1.52, neutral, False),
    ("material-impact", (2.4, 3.0, 1.60), (0, .12, .72), 1.75, impact, False),
    ("material-impact-grip", (1.5, 2.3, 1.10), (.225, .435, .79), .40, impact, False),
]
selected = set(args.only.split(",")) if args.only else None
records = []
for name, at, target, scale, values, use_clay in views:
    if selected and name not in selected:
        continue
    phase = phases.get(name.split("-", 2)[1], {})
    set_pose(values, phase.get("body"))
    scene.view_layers[0].material_override = clay if use_clay else None
    # Clay reveals the anatomy beneath glass; material views include the
    # complete transparent shell. This distinction is recorded below.
    for obj in kit.descendants(root):
        if obj.get("clearHelmet"):
            obj.hide_render = use_clay
    camera.location, camera_data.ortho_scale = at, scale
    aim(camera, target)
    path = WORK / f"{prefix}-{name}.jpg"
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    records.append({"file": path.name, "clay": use_clay, "glassIncluded": not use_clay,
                    "camera": list(at), "target": list(target), "orthoScale": scale,
                    "poses": values, "body": phase.get("body"),
                    "poseKind": "static shared-reach numerical goal" if phase else "static source range/neutral",
                    "inspected": False})
    print("JETPACK REVIEW", path, flush=True)
set_pose()
for obj in kit.descendants(root):
    if obj.get("clearHelmet"):
        obj.hide_render = False
scene.view_layers[0].material_override = None
metadata = {"sourceFingerprint": runtime.source_fingerprint(), "views": records,
            "inspectionPending": True, "stage": args.stage,
            "sourceRevision": root.get("jetpackSourceRevision"),
            "motionFixture": phase_path.name,
            "motionFixtureKind": "static shared-reach goals, not renderer spring frames",
            "notEvidenceOf": ["in-game moving cycles", "physical touch", "GPU performance"]}
(WORK / f"{prefix}-review-views.json").write_text(json.dumps(metadata, indent=2) + "\n")
if runtime_info is not None:
    runtime_info["runtimeStageComplete"] = True
    runtime_info["requiredRenders"] = [record["file"] for record in records]
    runtime_info["visualAcceptance"] = False
    runtime.RUNTIME_METRICS.write_text(json.dumps(runtime_info, indent=2) + "\n")
gate_path = runtime.review_path("source" if args.stage == "source" else "runtime")
if args.stage in ("source", "runtime") or not gate_path.exists():
    template = {"accepted": False, "sourceFingerprint": runtime.source_fingerprint(),
                "sourceRevision": "v3",
                "inspected": [], "observations": [],
                "requiredRenders": [record["file"] for record in records],
                "remaining": ["Open every required JPG and fix concrete failures"]}
    if CACHE.exists() and args.stage != "source":
        template["runtimeSHA256"] = runtime.file_hash(CACHE)
        template["runtimeRevision"] = runtime.REVISION
        template["runtimeRecipeFingerprint"] = runtime.recipe_fingerprint()
    gate_path.write_text(json.dumps(template, indent=2) + "\n")
print("JETPACK ART REVIEW PENDING", str(gate_path), flush=True)
