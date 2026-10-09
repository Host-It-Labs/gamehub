"""Serial staged Robots review and collector export, only owned outputs.

source -> root source gate -> runtime -> root runtime gate -> activate-loader.
export-candidate is allowed before runtime acceptance for real-renderer QA;
collector-export requires runtime acceptance. Both use the unchanged shared
collector with a process-local builder override, never a shipped file edit.
"""
import argparse
import hashlib
import json
import math
import os
import resource
import runpy
import subprocess
import sys
import types
from pathlib import Path

import bpy
from mathutils import Quaternion, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kit
import figure_folk_kit as geo
import figure_imps_sculpt as sculpt
import figure_imps_runtime as runtime

R, WORK = runtime.R, runtime.WORK


def memory(stage):
    raw = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    peak = raw if sys.platform == "darwin" else raw * 1024
    limit = float(os.environ.get("IMPS_MEMORY_LIMIT", "8"))
    if not 0 < limit <= 8: raise ValueError("Memory guard must be positive and at most 8 GiB")
    try:
        current = int(subprocess.check_output(["ps", "-o", "rss=", "-p", str(os.getpid())], text=True).strip()) * 1024
    except (OSError, ValueError, subprocess.SubprocessError): current = None
    print("IMPS_MEMORY", stage, "peakGiB", round(peak / 1024**3, 3),
          "rssGiB", round(current / 1024**3, 3) if current is not None else "unknown", flush=True)
    if max(peak, current or 0) > limit * 1024**3:
        raise MemoryError("Robots exceeds its memory guard at " + stage)


def set_pose(root, rig, values=None, body=None):
    root.rotation_mode = "QUATERNION"; root.rotation_quaternion = Quaternion()
    root.location = (0, 0, 0); root.scale = (1, 1, 1)
    for bone in rig.pose.bones:
        bone.rotation_mode = "QUATERNION"; bone.rotation_quaternion = Quaternion()
        bone.location = (0, 0, 0); bone.scale = (1, 1, 1)
    for name, angles in (values or {}).items():
        bone = rig.pose.bones.get(R + "." + name)
        if not bone: raise ValueError("Unknown authored review joint " + name)
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted() @ geo.runtime_quat(*angles[:3]) @ frame
        if len(angles) > 3:
            bone.location = frame.inverted() @ Vector((0, 0, angles[3]))
    if body:
        root.rotation_quaternion = geo.runtime_quat(-body.get("lean", 0), body.get("yawKick", 0), body.get("roll", 0))
        root.location = (0, body.get("lunge", 0), max(0, body.get("lift", 0)))
        # Clockwork hop motion stays above the floor; explicit knee joints
        # handle the mechanical bend rather than burying the whole root.
        if body.get("lift", 0) < 0:
            raise ValueError("Clockwork motion uses positive hops and explicit leg joints; no negative whole-root lift")
    kit.refresh()


def studio(args):
    scene = bpy.context.scene; scene.render.engine = "CYCLES"
    scene.cycles.device, scene.cycles.samples = "CPU", args.samples
    scene.cycles.use_denoising = True
    scene.render.threads_mode, scene.render.threads = "FIXED", 3
    scene.render.resolution_x = scene.render.resolution_y = args.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"; scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.quality = 89; scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    world = bpy.data.worlds.new("__" + R + "-review-world"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (.20, .22, .25, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = .40
    clay = bpy.data.materials.new("__" + R + "-clay"); clay.use_nodes = True
    bsdf = clay.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (.45, .47, .49, 1)
    bsdf.inputs["Roughness"].default_value = .80; bsdf.inputs["Specular IOR Level"].default_value = .22
    def aim(obj, target): obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()
    for name, at, energy, size in (("key", (-2.5, 3.1, 4.1), 175, 2.4),
                                  ("fill", (2.7, 2.2, 2.4), 75, 2.5), ("rim", (.6, -2.7, 3.3), 130, 2.0)):
        data = bpy.data.lights.new("__" + R + "-" + name, "AREA"); data.energy, data.size = energy, size
        obj = bpy.data.objects.new(data.name, data); scene.collection.objects.link(obj)
        obj.location = at; aim(obj, (0, 0, .40))
    data = bpy.data.cameras.new("__" + R + "-review-camera")
    data.type, data.clip_start, data.clip_end = "ORTHO", .01, 100
    camera = bpy.data.objects.new(data.name, data); scene.collection.objects.link(camera); scene.camera = camera
    floor = kit.box("__" + R + "-review-floor", (40, 40, .010), (0, 0, -.009), grid=False)
    mat = bpy.data.materials.new("__" + R + "-review-floor-material"); mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (.15, .17, .19, 1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = .94
    floor.data.materials.append(mat)
    return scene, camera, clay, aim


def views():
    full, span = (0, -.015, .410), 1.02
    return [
        ("clay-front", 0, 8, full, span, {}, True),
        ("clay-side", 90, 8, full, span, {}, True),
        ("clay-rear", 180, 8, full, span, {}, True),
        ("clay-three", 35, 14, full, span, {}, True),
        ("clay-game55", 35, 55, full, span, {}, True),
        ("clay-face", 5, 8, (0, .086, .641), .265, {}, True),
        ("clay-handL", -65, 12, (-.191, .115, .218), .205, {}, True),
        ("clay-handR", 65, 12, (.191, .115, .218), .205, {}, True),
        ("clay-forward120", 35, 14, full, span, {"armR": (2.09, 0, 0), "foreR": (.05, 0, 0)}, True),
        ("clay-out100", 0, 10, full, 1.15, {"armR": (0, 0, 1.74), "foreR": (.05, 0, 0)}, True),
        ("clay-elbow140", 90, 10, full, span, {"armR": (.45, 0, 0), "foreR": (1.89, 0, 0)}, True),
        ("clay-knee120", 90, 10, full, span, {"legR": (.70, 0, 0), "kneeR": (-2.09, 0, 0), "footR": (.25, 0, 0)}, True),
        ("clay-pincer-open", 35, 15, (.0, .115, .230), .53, {"offhand": (-.50, 0, 0), "weapon": (-.50, 0, 0)}, True),
        ("clay-key", 180, 10, (0, -.225, .425), .30, {"spin": (0, 0, -.8)}, True),
        ("material-three", 35, 14, full, span, {}, False),
        ("material-front", 0, 8, full, span, {}, False),
        ("material-rear", 180, 8, full, span, {}, False),
        ("material-face", 5, 8, (0, .086, .641), .265, {}, False),
        ("material-game55", 35, 55, full, span, {}, False),
        ("clay-trio", 35, 55, (0, 0, .410), 1.46, {}, True, None, True),
        ("material-trio", 35, 55, (0, 0, .410), 1.46, {}, False, None, True),
    ]


def review_trio(root):
    """Two temporary full rig clones, never saved or collector-exported.

    The card's native formation offsets are [0,.45],[-.5,-.35],[.5,-.35]
    in world units. Divide the horizontal offsets by figureDimensions(1.75),
    which currently gives 1.75*1.12 on each horizontal axis;
    Three's forward -z is Blender +y. The original occupies the front seat.
    """
    originals = kit.descendants(root)
    copies = []
    scale = 1.75 * 1.12
    root.location = (0, .45 / scale, 0)
    for side in (-1, 1):
        mapping = {}
        for obj in originals:
            clone = obj.copy()
            if obj.type == "ARMATURE": clone.data = obj.data.copy()
            clone.name = "__imps-review-trio-" + str(side) + "-" + obj.name
            bpy.context.scene.collection.objects.link(clone)
            mapping[obj] = clone; copies.append(clone)
        for obj, clone in mapping.items():
            if obj.parent in mapping: clone.parent = mapping[obj.parent]
            for mod in clone.modifiers:
                if mod.type == "ARMATURE" and mod.object in mapping: mod.object = mapping[mod.object]
        mapping[root].location = (side * .5 / scale, -.35 / scale, 0)
    kit.refresh()
    return copies


def sample_views():
    path = WORK / "review-poses-v1.json"
    if not path.is_file(): raise RuntimeError("Run the owned motion audit before rendering " + str(path))
    record = json.loads(path.read_text())
    if record.get("motionSHA256") != runtime.file_hash(WORK / "moves-imps-next.ts"):
        raise RuntimeError("Motion review poses are stale; rerun motion-audit.mjs")
    if record.get("sourceSculptSHA256") != runtime.file_hash(HERE / "figure_imps_sculpt.py"):
        raise RuntimeError("Motion review rig is stale")
    return [("clay-" + name, 35, 14, (0, -.015, .410), 1.08, value["joints"], True, value["body"])
            for name, value in record["poses"].items()]


def write_index(prefix, records, only):
    identity = {"sourceFingerprint": runtime.fingerprint(), "masterSHA256": runtime.file_hash(runtime.MASTER),
                "motionSHA256": runtime.file_hash(WORK / "moves-imps-next.ts")}
    if prefix.startswith("runtime"):
        identity.update(runtimeSHA256=runtime.file_hash(runtime.COPY), reducerSHA256=runtime.file_hash(HERE / "figure_imps_runtime.py"))
    path = WORK / (prefix + "-review-views.json")
    prior = json.loads(path.read_text()) if path.is_file() else {}
    same = all(prior.get(k) == v for k, v in identity.items())
    previous = prior.get("views", []) if only and same else []
    merged = {item["file"]: item for item in previous + records}
    required = [prefix + "-" + item[0] + ".jpg" for item in views() + sample_views()]
    info = {**identity, "views": list(merged.values()), "required": required,
            "inspectionPending": True, "motionSHA256": runtime.file_hash(WORK / "moves-imps-next.ts"),
            "notEvidenceOf": ["real renderer moving cycles", "physical touch", "mobile GPU", "visual acceptance"]}
    path.write_text(json.dumps(info, indent=2) + "\n")
    stage = "source" if prefix.startswith("source") else "runtime"
    gate_path = WORK / (stage + "-review-gate-v1.json")
    old = json.loads(gate_path.read_text()) if gate_path.is_file() else {}
    evidence = {name: runtime.file_hash(WORK / name) for name in merged}
    if (not old or any(old.get(k) != v for k, v in identity.items()) or old.get("evidenceHashes") != evidence):
        gate = {"accepted": False, "reviewer": "", **identity, "evidenceHashes": evidence,
                "inspected": [], "observations": [], "remaining": ["Root: open all required JPGs and review forms, skin and contacts"]}
        if old: gate["previousReview"] = {k: v for k, v in old.items() if k != "previousReview"}
        gate_path.write_text(json.dumps(gate, indent=2) + "\n")


def collector_export(reviewed):
    if reviewed: runtime.require_review("runtime")
    else: runtime.require_review("source")
    out = WORK / ("imps-collector-v1.glb" if reviewed else "imps-candidate-v1.glb")
    # The full collector has its reset/AO/export conventions. Override only
    # this process's builder import, so it exports the staged frozen copy
    # while the filesystem's shipped builder remains fully working.
    builder = types.ModuleType("figure_imps")
    builder.build = lambda root_name=R: runtime.load_frozen(root_name, reviewed=reviewed)
    sys.modules["figure_imps"] = builder
    os.environ["ARENA_FIGURES"] = R
    sys.argv = [str(HERE / "figures.py"), "--", str(out), "-"]
    runpy.run_path(str(HERE / "figures.py"), run_name="__main__")
    root = bpy.data.objects[R]; info = runtime.metrics(root)
    info.update(glb=out.name, sha256=runtime.file_hash(out), runtimeSHA256=runtime.file_hash(runtime.COPY), collectorExport=True)
    (WORK / ("collector-export-v1.json" if reviewed else "candidate-export-v1.json")).write_text(json.dumps(info, indent=2) + "\n")
    memory("collector-exported"); print("IMPS COLLECTOR", out, flush=True)


def activate_loader():
    runtime.require_review("runtime")
    installed = HERE / "runtime/imps-runtime-v1.blend"
    if not installed.is_file() or runtime.file_hash(installed) != runtime.file_hash(runtime.COPY):
        raise RuntimeError("Root must install the identical reviewed frozen bytes before switching the loader")
    current = HERE / "figure_imps.py"
    baseline = json.loads((WORK / "loader-baseline-v1.json").read_text())
    next_path = WORK / "figure_imps-loader-next.py"
    content = next_path.read_text()
    if runtime.file_hash(current) == runtime.file_hash(next_path): return
    if runtime.file_hash(current) != baseline["sha256"]:
        raise RuntimeError("Another session changed the shipped loader; inspect it before switching")
    # The reviewed copy already exists. This is the single explicit switch,
    # deliberately unavailable while only unbuilt source files exist.
    current.write_text(content)
    print("IMPS reviewed frozen loader activated", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--stage", required=True, choices=("source", "source-review", "runtime", "runtime-review",
                        "export-candidate", "collector-export", "activate-loader"))
    parser.add_argument("--only", default=""); parser.add_argument("--resolution", type=int, default=768)
    parser.add_argument("--samples", type=int, default=20)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if not 128 <= args.resolution <= 1200 or not 1 <= args.samples <= 64:
        raise ValueError("Moderate review resolution/samples required")
    WORK.mkdir(parents=True, exist_ok=True); bpy.context.preferences.filepaths.save_version = 0
    memory("start")
    if args.stage == "activate-loader": activate_loader(); return
    if args.stage in ("collector-export", "export-candidate"):
        collector_export(reviewed=args.stage == "collector-export"); return
    if args.stage == "source":
        kit.reset(seed=29); root = sculpt.build_master(memory); root["sourceFingerprint"] = runtime.fingerprint()
        memory("source-built"); runtime.validate(root); info = runtime.metrics(root)
        if info["triangles"] > runtime.SOURCE_CEILING: raise ValueError("Master exceeds bounded source triangle ceiling")
        # Save only neutral editable asset objects, before adding studio data.
        bpy.ops.wm.save_as_mainfile(filepath=str(runtime.MASTER), compress=True)
        info["masterSHA256"] = runtime.file_hash(runtime.MASTER)
        (WORK / "source-metrics-v1.json").write_text(json.dumps(info, indent=2) + "\n")
        prefix = "source-v1"
    elif args.stage == "runtime":
        root = runtime.reduce_master(memory); prefix = "runtime-v1"
    elif args.stage == "source-review":
        bpy.ops.wm.open_mainfile(filepath=str(runtime.MASTER)); root = bpy.data.objects[R]
        if root.get("sourceFingerprint") != runtime.fingerprint(): raise RuntimeError("Saved source is stale")
        prefix = "source-v1"
    else:
        kit.reset(seed=29); root = runtime.load_frozen(reviewed=False); prefix = "runtime-v1"
    rig = runtime.validate(root); scene, camera, clay, aim = studio(args)
    items = views() + sample_views(); wanted = set(args.only.split(",")) if args.only else None
    if wanted and wanted - {item[0] for item in items}: raise ValueError("Unknown requested views")
    records = []
    for item in items:
        name, az, el, target, span, values, clay_view = item[:7]
        if wanted and name not in wanted: continue
        body = item[7] if len(item) > 7 else None; set_pose(root, rig, values, body)
        copies = review_trio(root) if len(item) > 8 and item[8] else []
        az, el = math.radians(az), math.radians(el)
        camera.location = Vector(target) + Vector((math.sin(az) * math.cos(el) * 3,
                                                   math.cos(az) * math.cos(el) * 3, math.sin(el) * 3))
        camera.data.ortho_scale = span; aim(camera, target)
        scene.view_layers[0].material_override = clay if clay_view else None
        path = WORK / (prefix + "-" + name + ".jpg"); scene.render.filepath = str(path)
        memory(name + "-before"); bpy.ops.render.render(write_still=True); memory(name + "-after")
        records.append({"file": path.name, "clay": clay_view, "camera": list(camera.location),
                        "target": target, "orthoScale": span, "joints": values, "body": body, "inspected": False})
        print("IMPS REVIEW", path, flush=True)
        # A timeout keeps the completed view records for a focused resume.
        write_index(prefix, records, wanted)
        for clone in reversed(copies): bpy.data.objects.remove(clone, do_unlink=True)
    set_pose(root, rig); scene.view_layers[0].material_override = None
    write_index(prefix, records, wanted)


if __name__ == "__main__": main()
