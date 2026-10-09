"""Serial, private master/source/runtime review stages for the roster rebuild.

Blender --python figure_inventor_stages.py -- master|source|runtime|runtime-review v3
The detailed master is saved before any transient render simplification.
Reduction requires a root-signed source gallery; export uses the separate
collector after a root-signed runtime gallery. All output stays in work/.
"""
import gc
import importlib
import json
import math
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
R = Path(__file__).stem.split("_")[1]
gate = importlib.import_module("figure_" + R + "_gates")
BASE, VERSION = gate.BASE, gate.VERSION

import bpy
import numpy as np
from mathutils import Quaternion, Vector
import kit
import figure_folk_kit as geo

EXTREMES = {
    "arm-forward": {"armR": (2.10, 0, 0), "foreR": (.18, 0, 0), "clavR": (0, .08, .15)},
    "arm-side": {"armL": (0, 0, -1.75), "clavL": (0, 0, -.15)},
    "elbow-deep": {"armR": (.58, 0, .1), "foreR": (2.40, 0, 0)},
    "knee-deep": {"legL": (1.05, 0, 0), "kneeL": (-2.10, 0, 0), "footL": (.70, 0, 0)},
}
FACES = ("eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth")


def objects(root):
    return kit.descendants(root)


def bone(rig, name):
    result = rig.pose.bones.get(R + "." + name) or rig.pose.bones.get(R + name)
    if result is None:
        raise RuntimeError("Missing anatomical bone " + name)
    return result


def neutral(rig):
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
        b.scale = (1, 1, 1)
    kit.refresh()


def pose(rig, values):
    neutral(rig)
    for name, angles in values.items():
        b = bone(rig, name)
        frame = b.bone.matrix_local.to_quaternion()
        b.rotation_quaternion = frame.inverted() @ geo.runtime_quat(*angles[:3]) @ frame
        if len(angles) == 4:
            b.location = frame.inverted() @ Vector((0, 0, angles[3]))
    kit.refresh()


def look(root, selected):
    if R != "archers":
        return
    for key in ("A", "B"):
        holder = bpy.data.objects[R + ".look" + key]
        holder.scale = (1, 1, 1) if key == selected else (0, 0, 0)
        for obj in objects(holder):
            obj.hide_render = key != selected
    kit.refresh()


def topology(obj):
    parent = list(range(len(obj.data.vertices)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for edge in obj.data.edges:
        a, b = (find(int(i)) for i in edge.vertices)
        if a != b:
            parent[b] = a
    return len({find(i) for i in range(len(parent))})


def drop_slivers(obj, limit=64):
    """Delete loose islands of a few vertices the voxel mesher can leave
    beside a thin form (one of 8 vertices at the Inventor's wrist, 9 Oct):
    the connected skin must be a single piece."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen, doomed = set(), []
    for v in bm.verts:
        if v.index in seen:
            continue
        stack, island = [v], [v]
        seen.add(v.index)
        while stack:
            x = stack.pop()
            for e in x.link_edges:
                w = e.other_vert(x)
                if w.index not in seen:
                    seen.add(w.index)
                    stack.append(w)
                    island.append(w)
        if len(island) < limit:
            doomed.extend(island)
    if doomed:
        bmesh.ops.delete(bm, geom=doomed, context="VERTS")
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()
    print("DROPPED SLIVER VERTICES", len(doomed), flush=True)


def geometry(root):
    meshes = [o for o in objects(root) if o.type == "MESH"]
    skin = bpy.data.objects[R + ".skin"]
    rows = [{"name": o.name, "vertices": len(o.data.vertices),
             "triangles": sum(len(p.vertices) - 2 for p in o.data.polygons)} for o in meshes]
    return {"triangles": sum(row["triangles"] for row in rows),
            "meshNodes": len(rows), "parts": rows,
            "skinConnectedComponents": topology(skin)}


def bounds(root):
    dg = bpy.context.evaluated_depsgraph_get()
    low, high = np.full(3, np.inf), np.full(3, -np.inf)
    for obj in objects(root):
        if obj.type != "MESH" or obj.hide_render:
            continue
        ev = obj.evaluated_get(dg)
        if not len(ev.data.vertices):
            continue
        points = np.empty(len(ev.data.vertices) * 3, dtype=np.float32)
        ev.data.vertices.foreach_get("co", points)
        matrix = np.array(ev.matrix_world)
        world = points.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]
        low = np.minimum(low, world.min(0))
        high = np.maximum(high, world.max(0))
    if not np.isfinite(low).all():
        raise RuntimeError("Cannot measure a figure with no visible vertices")
    # Matches Box3.setFromObject(..., true) on the shipped GLB, rather than
    # enlarging rotated hands/tools through transformed box corners.
    return Vector(low), Vector(high)


def measurements(root):
    lo, hi = bounds(root)
    result = {"min": list(lo), "max": list(hi), "width": hi.x - lo.x,
              "depth": hi.y - lo.y, "height": hi.z - lo.z}
    baseline = json.loads((BASE / "baseline.json").read_text())
    result["baselineDelta"] = {key: result[key] / baseline[key] - 1
                               for key in ("width", "depth", "height")}
    result["withinEightPercent"] = all(abs(v) <= .08 for v in result["baselineDelta"].values())
    return result


def validate(root):
    rig = next(o for o in objects(root) if o.type == "ARMATURE")
    for child, par in (("chest", "torso"), ("head", "chest"),
                       ("clavL", "chest"), ("clavR", "chest"),
                       ("armL", "clavL"), ("armR", "clavR"),
                       ("foreL", "armL"), ("foreR", "armR"),
                       ("handL", "foreL"), ("handR", "foreR"),
                       ("weapon", "handR")):
        if bone(rig, child).parent != bone(rig, par):
            raise RuntimeError("Invalid common-axis skeleton relationship: " + child)
    frame = bone(rig, "torso").bone.matrix_local.to_3x3()
    for b in rig.data.bones:
        other = b.matrix_local.to_3x3()
        if max(abs(frame[i][j] - other[i][j]) for i in range(3) for j in range(3)) > 1e-5:
            raise RuntimeError("Bone does not share the common frame: " + b.name)
    for name in FACES:
        obj = bpy.data.objects.get(R + name)
        if obj is None:
            raise RuntimeError("Missing live face control " + R + name)
        if name.startswith("pupil") and obj.parent != bpy.data.objects[R + "eye" + name[-1]]:
            raise RuntimeError("Pupil is not parented to its blinking eye")
    if root.get("sourceFingerprint") != gate.fingerprints()["sourceFingerprint"]:
        raise RuntimeError("This saved model predates the current sculpt sources")
    return rig


def transient_copy(root):
    """Bound only this render process; the detailed saved blend is untouched."""
    runtime = importlib.import_module("figure_" + R + "_runtime")
    meshes = [o for o in objects(root) if o.type == "MESH"]
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            if mod.type == "ARMATURE":
                continue
            if mod.type == "SUBSURF":
                mod.render_levels = mod.levels
            while obj.modifiers[0] != mod:
                bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
    fixed = bpy.data.objects[R + ".skin"]
    targets = {o: min(runtime.triangles(o), 120000 if o is fixed else
                     18000 if o.name.startswith("cadet-head-") else
                     6000 if "puff" in o.name else 1800) for o in meshes}
    spare = 240000 - targets[fixed]
    flexible = sum(n for o, n in targets.items() if o is not fixed)
    if flexible > spare:
        for o in targets:
            if o is not fixed:
                targets[o] = max(8, int(targets[o] * spare / flexible))
    for obj, target in targets.items():
        if R == "inventor":
            surface = runtime.source_surface(obj.data) if runtime.triangles(obj) > target else None
            runtime.collapse(obj, target)
            if surface:
                normal = runtime.sampled_normals(obj.data, surface)
                obj.data.normals_split_custom_set_from_vertices(normal.tolist())
                del surface
        else:
            runtime.decimate(obj, target)
            runtime.apply_normals(obj)
    for data in list(bpy.data.meshes):
        if data.users == 0:
            bpy.data.meshes.remove(data)
    gc.collect()
    kit.refresh()
    gate.memory("transient-render-geometry")


def studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 3
    scene.cycles.device = "CPU"
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 5
    scene.cycles.diffuse_bounces = 2
    scene.cycles.glossy_bounces = 2
    scene.cycles.transparent_max_bounces = 8
    scene.render.use_persistent_data = False
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new(R + " neutral studio")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.16, .17, .19, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .40
    for name, at, energy, size in (("key", (-2.3, 2.8, 3.7), 110, 2),
                                  ("fill", (2.5, 2.5, 2.1), 42, 2.4),
                                  ("rim", (.8, -2.5, 3.1), 85, 2)):
        data = bpy.data.lights.new(R + "-review-" + name, "AREA")
        obj = bpy.data.objects.new(data.name, data)
        scene.collection.objects.link(obj)
        obj.location = at
        data.energy, data.size = energy, size
        obj.rotation_euler = (Vector((0, 0, .8)) - obj.location).to_track_quat("-Z", "Y").to_euler()
    kit.box(R + "-review-floor", (200, 200, .01), (0, 0, -.006), mat="plain:grey", grid=False)
    data = bpy.data.cameras.new(R + " honest review camera")
    camera = bpy.data.objects.new(data.name, data)
    scene.collection.objects.link(camera)
    scene.camera = camera
    data.type, data.clip_start, data.clip_end = "ORTHO", .01, 200
    clay = bpy.data.materials.new(R + " review neutral clay")
    clay.use_nodes = True
    p = clay.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (.36, .38, .39, 1)
    p.inputs["Roughness"].default_value = .78
    p.inputs["Specular IOR Level"].default_value = .22
    glass = bpy.data.materials.new(R + " review clear glass")
    glass.use_nodes = True
    nt = glass.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    mix = nt.nodes.new("ShaderNodeMixShader")
    clear = nt.nodes.new("ShaderNodeBsdfTransparent")
    reflection = nt.nodes.new("ShaderNodeBsdfGlossy")
    reflection.inputs["Roughness"].default_value = .06
    fresnel = nt.nodes.new("ShaderNodeFresnel")
    fresnel.inputs["IOR"].default_value = 1.3
    nt.links.new(fresnel.outputs[0], mix.inputs[0])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(reflection.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return scene, camera, clay, glass


def motion_record(version):
    record = json.loads((BASE / ("review-poses-" + version + ".json")).read_text())
    if any(record.get(k) != v for k, v in gate.fingerprints().items()):
        raise RuntimeError("Run the current private probe-next.mjs before rendering")
    return record


def review(root, stage, version):
    out = BASE / (stage + "-" + version)
    out.mkdir(parents=True, exist_ok=True)
    path = out / "render-index.json"
    index = {"stage": stage, "version": version, "complete": False,
             "renders": {}, **gate.fingerprints()}
    path.write_text(json.dumps(index, indent=2) + "\n")
    motion = motion_record(version)
    rig = validate(root)
    neutral(rig)
    look(root, "A")
    index["measurements"] = measurements(root)
    index["measurementsByLook"] = {}
    for selected in (("A", "B") if R == "archers" else ("A",)):
        look(root, selected)
        index["measurementsByLook"][selected] = measurements(root)
    look(root, "A")
    index["geometry"] = geometry(root)
    index["masterSHA256"] = gate.file_hash(gate.artifact("master", version))
    if stage == "runtime":
        index["runtimeSHA256"] = gate.file_hash(gate.artifact("runtime", version))
    if stage == "source":
        transient_copy(root)
        # The shared kit material multiplies by the "AO" corner colours,
        # which the detailed master has not baked yet: without a layer every
        # material render came out black (9 October). Paint the runtime's
        # pigment where it has one and use white AO for review only.
        rt = importlib.import_module("figure_" + R + "_runtime")
        if hasattr(rt, "paint_all"):
            rt.paint_all(root)
            rt.finish_ao(root)
        for obj in objects(root):
            if obj.type == "MESH" and obj.data.color_attributes.get("AO") is None:
                ao = obj.data.color_attributes.new("AO", "BYTE_COLOR", "CORNER")
                ao.data.foreach_set("color", np.ones(len(ao.data) * 4, dtype=np.float32))
                obj.data.color_attributes.active_color = ao
                obj.data.color_attributes.render_color_index = list(obj.data.color_attributes).index(ao)
    scene, camera, clay, glass = studio()
    slots = {o: list(o.data.materials) for o in objects(root) if o.type == "MESH"}
    # materials.clear() resets every face to slot 0, so keep each face's
    # index and put it back after swapping (9 October: a multi-material
    # body otherwise rendered entirely in its first material).
    indices = {}
    for o in slots:
        values = np.empty(len(o.data.polygons), dtype=np.int32)
        o.data.polygons.foreach_get("material_index", values)
        indices[o] = values
    glass_meshes = [o for o, mats in slots.items() if any(m and m.name.startswith("glass:") for m in mats)]

    def render(name, az, el, target=None, scale=None, material=False, size=640, clear_face=False):
        for obj, mats in slots.items():
            obj.data.materials.clear()
            for m in mats:
                obj.data.materials.append(glass if m and m.name.startswith("glass:") else m if material else clay)
            obj.data.polygons.foreach_set("material_index", indices[obj])
        for obj in glass_meshes:
            obj.hide_render = clear_face
        lo, hi = bounds(root)
        at = Vector(target) if target is not None else (lo + hi) / 2
        az, el = math.radians(az), math.radians(el)
        camera.location = at + Vector((math.sin(az) * math.cos(el) * 3,
                                        math.cos(az) * math.cos(el) * 3, math.sin(el) * 3))
        camera.rotation_euler = (at - camera.location).to_track_quat("-Z", "Y").to_euler()
        if scale is None:
            inv = camera.rotation_euler.to_quaternion().inverted()
            projected = [inv @ Vector((x, y, z)) for x in (lo.x, hi.x)
                         for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
            scale = max(max(p[k] for p in projected) - min(p[k] for p in projected) for k in (0, 1)) * 1.15
        camera.data.ortho_scale = scale
        scene.cycles.samples = 24 if material else 12
        scene.render.resolution_x = scene.render.resolution_y = size
        image_path = out / (name + ".jpg")
        gate.memory(name + "-before")
        scene.render.filepath = str(image_path)
        bpy.ops.render.render(write_still=True)
        gate.memory(name + "-after")
        index["renders"][str(image_path.relative_to(BASE))] = gate.file_hash(image_path)
        path.write_text(json.dumps(index, indent=2) + "\n")
        for obj in glass_meshes:
            obj.hide_render = False

    for selected in (("A", "B") if R == "archers" else ("A",)):
        prefix = selected.lower() + "-" if R == "archers" else ""
        look(root, selected)
        neutral(rig)
        for name, az, el in (("front", 0, 8), ("side", 90, 8), ("rear", 180, 8),
                            ("three", 35, 15), ("game", 35, 55)):
            render(prefix + "clay-" + name, az, el)
        face = (0, .045, 1.15)
        render(prefix + "clay-face", 8, 8, face, .36, clear_face=True)
        for side, az in (("L", -65), ("R", 65)):
            target = rig.matrix_world @ bone(rig, "hand" + side).head + Vector((0, .015, -.035))
            render(prefix + "clay-hand-" + side.lower(), az, 10, target, .23)
        for name, values in {**EXTREMES, **motion["poses"]}.items():
            pose(rig, values)
            render(prefix + "clay-" + name, 90 if name == "elbow-deep" else 35, 12)
        for name in ("aim", "impact", "follow-through"):
            pose(rig, motion["poses"][name])
            render(prefix + "material-" + name, 35, 15, material=True)
        pose(rig, motion["poses"]["aim"])
        hands = (bone(rig, "handL").head + bone(rig, "handR").head) * .5
        target = rig.matrix_world @ hands + Vector((0, .035, -.020))
        render(prefix + "material-aim-hands", 25, 18, target, .38, material=True)
        neutral(rig)
        render(prefix + "material-three", 35, 15, material=True)
        render(prefix + "material-rear", 155, 12, material=True)
        render(prefix + "material-face", 8, 8, face, .36, material=True)
        render(prefix + "material-face-unhelmeted", 8, 8, face, .36, material=True, clear_face=True)
        render(prefix + "material-game", 35, 55, material=True)
        render(prefix + "material-small-game", 35, 55, material=True, size=192)
        render(prefix + "material-phone-game", 35, 70, material=True, size=192)
    neutral(rig)
    look(root, "A")
    for obj, mats in slots.items():
        obj.data.materials.clear()
        for m in mats:
            obj.data.materials.append(m)
        obj.data.polygons.foreach_set("material_index", indices[obj])
    if any(index.get(k) != v for k, v in gate.fingerprints().items()):
        raise RuntimeError("Sources changed during this render job; rerun the complete set")
    index.update({"complete": True, "inspected": False, "masterUntouched": True,
                  "transientGeometryOnly": stage == "source", "renderGeometry": geometry(root),
                  "memory": gate.memory("gallery-finished")})
    path.write_text(json.dumps(index, indent=2) + "\n")
    print("ROOT REVIEW TEMPLATE", gate.gate_template(stage, version), flush=True)


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    action, version = args[0], gate.version_name(args[1] if len(args) > 1 else VERSION)
    BASE.mkdir(parents=True, exist_ok=True)
    guard = gate.start_memory_guard()
    bpy.context.preferences.filepaths.save_version = 0
    try:
        if action == "master":
            for stage in ("source", "runtime"):
                out = BASE / (stage + "-" + version)
                out.mkdir(parents=True, exist_ok=True)
                (out / "render-index.json").write_text(json.dumps({"complete": False, "renders": {}}) + "\n")
            before = gate.fingerprints()
            motion_record(version)
            kit.reset(seed=33)
            kit.TINTS["team3"] = (.28, .45, 1.0)
            rig_module = importlib.import_module("figure_" + R + "_rig")
            root = rig_module.build_master()
            drop_slivers(bpy.data.objects[R + ".skin"])
            root["sourceFingerprint"] = before["sourceFingerprint"]
            root["sourceVersion"] = version
            look(root, "A")
            for obj in objects(root):
                obj.hide_render = False
            validate(root)
            gate.memory("detailed-master-built")
            if gate.fingerprints() != before:
                raise RuntimeError("Sources changed while building the master")
            keep = set(objects(root))
            for obj in list(bpy.data.objects):
                if obj not in keep:
                    bpy.data.objects.remove(obj, do_unlink=True)
            bpy.ops.wm.save_as_mainfile(filepath=str(gate.artifact("master", version)), compress=True)
            print("MASTER SAVED", gate.artifact("master", version), flush=True)
        elif action in ("source", "runtime-review"):
            stage = "source" if action == "source" else "runtime"
            bpy.ops.wm.open_mainfile(filepath=str(gate.artifact("master" if stage == "source" else "runtime", version)))
            review(bpy.data.objects[R], stage, version)
        elif action == "runtime":
            gate.require_review("source", version)
            before = gate.fingerprints()
            bpy.ops.wm.open_mainfile(filepath=str(gate.artifact("master", version)))
            root = bpy.data.objects[R]
            validate(root)
            runtime = importlib.import_module("figure_" + R + "_runtime")
            runtime.reduce_runtime(root)
            runtime.finalize_copy(root)
            if gate.fingerprints() != before:
                raise RuntimeError("Sources changed during runtime reduction")
            for key, value in before.items():
                root[key] = value
            root["runtimeVersion"] = version
            gate.memory("runtime-reduced")
            runtime.save_runtime(root, gate.artifact("runtime", version))
        else:
            raise ValueError("Use master, source, runtime or runtime-review")
    finally:
        guard.set()


if __name__ == "__main__":
    main()
