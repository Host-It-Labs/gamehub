"""Upper spine and shoulder girdle for the frozen Sumo runtime copy.

9 October 2026. The reviewed neutral copy (runtime/sumo-runtime-v1.blend)
has one torso bone carrying head and arms, so a raised or reaching arm
pivoted on a fixed socket. This adds the shared `chest` and `clavL`/`clavR`
joints (moves/types.ts) without touching the reviewed geometry, normals or
pigment: an upper-spine bone splits the torso weights by height, and each
clavicle takes the trapezius, the top of the chest and a share of the
deltoid around the clavicle line, so troops.ts can shrug and bring the
shoulder forward with the arm. Bones keep the common +Z axes.

`lift_inner_thigh_ao` brightens the baked occlusion where the thighs meet
under the mawashi: that skin is hidden at rest but shows in the shiko and a
wide stance, where it read as a dark brown patch.
"""
import numpy as np
from mathutils import Vector

import bpy
import kit

TAIL = Vector((0, 0, 0.085))
CHEST = Vector((0, -0.01, 0.95))
CLAVICLE = {s: Vector((s * 0.07, -0.07, 1.115)) for s in (-1, 1)}
SHOULDER = {s: Vector((s * 0.316, -0.018, 1.148)) for s in (-1, 1)}


def ss(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t * t * (3 - 2 * t)


def segment_distance(points, a, b):
    a, b = np.array(a), np.array(b)
    d = b - a
    t = np.clip((points - a).dot(d) / d.dot(d), 0, 1)
    return np.linalg.norm(points - (a + t[:, None] * d), axis=1)


def add_bones(rig):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    chest = bones.new("sumochest")
    chest.head, chest.tail = CHEST, CHEST + TAIL
    chest.parent = bones["sumotorso"]
    bones["sumohead"].parent = chest
    for s, side in ((-1, "L"), (1, "R")):
        clav = bones.new("sumoclav" + side)
        clav.head, clav.tail = CLAVICLE[s], CLAVICLE[s] + TAIL
        clav.parent = chest
        bones["sumoarm" + side].parent = clav
    bpy.ops.object.mode_set(mode="OBJECT")


def reweight(skin, rig):
    names = [g.name for g in skin.vertex_groups]
    n = len(skin.data.vertices)
    weights = {name: np.zeros(n) for name in names}
    for v in skin.data.vertices:
        for entry in v.groups:
            weights[names[entry.group]][v.index] = entry.weight
    to_rig = rig.matrix_world.inverted() @ skin.matrix_world
    points = np.array([(to_rig @ v.co)[:] for v in skin.data.vertices])
    x, z = points[:, 0], points[:, 2]
    # Upper spine: the chest above the belly follows the new bone; the
    # waist, belly and mawashi line stay with the torso.
    share = ss(0.80, 0.99, z)
    weights["sumochest"] = weights["sumotorso"] * share
    weights["sumotorso"] = weights["sumotorso"] * (1 - share)
    for s, side in ((-1, "L"), (1, "R")):
        near = segment_distance(points, CLAVICLE[s], SHOULDER[s])
        around = 1 - ss(0.07, 0.22, near)
        lateral = ss(0.09, 0.27, x * s)
        upper = ss(0.94, 1.08, z)
        from_chest = weights["sumochest"] * around * lateral * upper * 0.7
        # The top of the deltoid rides with the shoulder blade.
        cap = ss(1.02, 1.16, z) * (1 - ss(0.05, 0.16, near))
        from_arm = weights["sumoarm" + side] * cap * 0.35
        weights["sumochest"] -= from_chest
        weights["sumoarm" + side] -= from_arm
        weights["sumoclav" + side] = from_chest + from_arm
    total = np.maximum(1e-6, sum(weights.values()))
    for name, raw in weights.items():
        group = skin.vertex_groups.get(name) or skin.vertex_groups.new(name=name)
        normalized = np.clip(raw / total, 0, 1)
        keep = np.flatnonzero(normalized > 1e-4)
        drop = np.flatnonzero(normalized <= 1e-4)
        if len(drop):
            group.remove(drop.tolist())
        for i in keep:
            group.add([int(i)], float(normalized[i]), "REPLACE")
    skin["girdleWeights"] = "chest split 0.80-0.99; clavicles around the clavicle line"


def add_girdle(root):
    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    skin = next(o for o in kit.descendants(root)
                if o.type == "MESH" and o.name == "sumo.skin")
    add_bones(rig)
    reweight(skin, rig)
    rig["girdle"] = "sumochest, sumoclavL, sumoclavR (9 October 2026)"
    kit.refresh()
    return root


def lift_inner_thigh_ao(root):
    skin = next((o for o in kit.descendants(root)
                 if o.type == "MESH" and o.name == "sumo.skin"), None)
    if not skin:
        return
    ao = skin.data.color_attributes.get("AO")
    if not ao:
        return
    to_rig = skin.parent.matrix_world.inverted() @ skin.matrix_world
    points = np.array([(to_rig @ v.co)[:] for v in skin.data.vertices])
    loops = np.empty(len(skin.data.loops), dtype=np.int32)
    skin.data.loops.foreach_get("vertex_index", loops)
    x, z = points[loops, 0], points[loops, 2]
    region = (1 - ss(0.13, 0.24, np.abs(x))) * ss(0.40, 0.50, z) * (1 - ss(0.66, 0.74, z))
    values = np.empty(len(ao.data) * 4, dtype=np.float32)
    ao.data.foreach_get("color", values)
    values = values.reshape(-1, 4)
    floor = 0.82
    lifted = np.maximum(values[:, :3], floor)
    values[:, :3] = values[:, :3] + (lifted - values[:, :3]) * region[:, None]
    ao.data.foreach_set("color", values.reshape(-1))
