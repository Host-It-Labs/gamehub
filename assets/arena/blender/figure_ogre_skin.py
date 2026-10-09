"""Continuous Dino skin with the existing named anatomical joint contract."""

import json

import bpy
import numpy as np
from mathutils import Vector

import kit
import figure_ogre_kit as fk
import figure_folk_kit as hk


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def make_rig(root, hip, neck, tail_pivots, jaw):
    data = bpy.data.armatures.new("Dino anatomical joint frames")
    rig = bpy.data.objects.new("ogre.skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    positions = {"torso": hip, "head": neck, "jaw": jaw}
    parents = {"head": "torso", "jaw": "head"}
    for i, pivot in enumerate(tail_pivots):
        name = "tail" if i == 0 else f"tail{i + 1}"
        positions[name] = pivot
        parents[name] = "torso" if i == 0 else "tail" if i == 1 else f"tail{i}"
    for sx, suffix in ((-1, "L"), (1, "R")):
        for name, pivot, parent in (
                ("leg", (sx * .32, -.36, 1.34), None),
                ("knee", (sx * .345, .18, .76), "leg" + suffix),
                ("foot", (sx * .305, -.15, .29), "knee" + suffix),
                ("arm", (sx * .265, .39, 1.48), "torso"),
                ("fore", (sx * .32, .57, 1.235), "arm" + suffix)):
            positions[name + suffix] = Vector(pivot)
            if parent:
                parents[name + suffix] = parent
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, pivot in positions.items():
        bone = data.edit_bones.new("ogre." + name)
        bone.head = pivot
        bone.tail = Vector(pivot) + Vector((0, 0, .075))
        bone.use_connect = False
    for name, parent in parents.items():
        data.edit_bones["ogre." + name].parent = data.edit_bones["ogre." + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "WIRE"
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k: list(v) for k, v in positions.items()})
    return rig


def segment_distance(P, a, b):
    a, b = np.asarray(a), np.asarray(b)
    d = b - a
    t = np.clip((P - a) @ d / np.dot(d, d), 0, 1)
    return np.linalg.norm(P - a - t[:, None] * d, axis=1)


def weight_skin(obj, rig):
    P, _ = fk.arrays(obj)
    x, y, z = P.T
    W = {bone.name.removeprefix("ogre."): np.zeros(len(P)) for bone in rig.data.bones}
    head = smooth(.395, .72, y)
    tail = 1 - smooth(-.98, -.64, y)
    second = 1 - smooth(-1.82, -1.39, y)
    third = 1 - smooth(-2.56, -2.18, y)
    W["torso"] = (1 - tail) * (1 - head)
    W["head"] = (1 - tail) * head
    W["tail"] = tail * (1 - second)
    W["tail2"] = tail * second * (1 - third)
    W["tail3"] = tail * second * third
    for sx, suffix in ((-1, "L"), (1, "R")):
        upper = smooth(.15, .285, x * sx) * (1 - smooth(1.21, 1.57, z))
        upper *= smooth(-.91, -.70, y) * (1 - smooth(.47, .70, y))
        # Every distal leg/toe vertex belongs wholly to the limb. A lateral
        # proximal-thigh mask applied to the innermost toes leaves torso
        # influence there and stretches the foot into a hanging web.
        distal = (1 - smooth(1.02, 1.25, z)) * smooth(-.01, .01, x * sx)
        distal *= smooth(-.96, -.72, y) * (1 - smooth(.72, 1.06, y))
        share = np.maximum(upper, distal)
        knee = 1 - smooth(.685, .855, z)
        foot = 1 - smooth(.242, .342, z)
        for key in W:
            W[key] *= 1 - share
        W["leg" + suffix] += share * (1 - knee)
        W["knee" + suffix] += share * knee * (1 - foot)
        W["foot" + suffix] += share * knee * foot
        shoulder = (sx * .265, .39, 1.48)
        elbow = (sx * .32, .57, 1.235)
        wrist = (sx * .29, .735, 1.27)
        tip = (sx * .29, .86, 1.235)
        dist = np.minimum.reduce((segment_distance(P, shoulder, elbow),
                                  segment_distance(P, elbow, wrist),
                                  segment_distance(P, wrist, tip)))
        arm = smooth(.10, .21, x * sx) * (1 - smooth(.075, .105, dist))
        arm *= (y > .33) & (y < .92) & (z > 1.05) & (z < 1.57)
        fore = smooth(.505, .625, y)
        for key in W:
            W[key] *= 1 - arm
        W["arm" + suffix] += arm * (1 - fore)
        W["fore" + suffix] += arm * fore
    # Four influences are the glTF/Three.js skinning contract.
    names = list(W)
    weights = np.stack([W[name] for name in names], axis=1)
    order = np.argsort(weights, axis=1)
    keep = np.zeros_like(weights, dtype=bool)
    keep[np.arange(len(P))[:, None], order[:, -4:]] = True
    weights *= keep
    weights /= np.maximum(np.sum(weights, axis=1)[:, None], 1e-9)
    for i, name in enumerate(names):
        group = obj.vertex_groups.new(name="ogre." + name)
        q = np.rint(np.clip(weights[:, i], 0, 1) * 1000).astype(int)
        for value in np.unique(q[q > 0]):
            group.add(np.flatnonzero(q == value).tolist(), float(value) / 1000, "REPLACE")
    mod = obj.modifiers.new("Continuous anatomical skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False
    obj.parent = rig
    obj["continuousSkin"] = True
    obj["weightRegions"] = "torso,head,tail,tail2,tail3,legL,legR,kneeL,kneeR,footL,footR,armL,armR,foreL,foreR"
    kit.shade(obj, 75)
    kit.uv_box(obj, small=True)


def bone_attach(obj, rig, part):
    kit.refresh()
    before = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "BONE"
    obj.parent_bone = "ogre." + part
    obj.matrix_world = before
    kit.refresh()
    return obj


def weight_oral(obj, rig):
    """The posterior mucosa follows the mandible while the palate stays put."""
    P, _ = fk.arrays(obj)
    jaw = 1 - smooth(1.602, 1.778, P[:, 2])
    for name, weights in (("head", 1 - jaw), ("jaw", jaw)):
        group = obj.vertex_groups.new(name="ogre." + name)
        q = np.rint(weights * 1000).astype(int)
        for value in np.unique(q[q > 0]):
            group.add(np.flatnonzero(q == value).tolist(), float(value) / 1000, "REPLACE")
    mod = obj.modifiers.new("Head to mandible mucosa", "ARMATURE")
    mod.object = rig
    obj.parent = rig
    obj["oralLining"] = "recessed concave throat, weighted head-to-jaw"
    kit.shade(obj, 75)
    kit.uv_box(obj, small=True)


def apply_pose(root, pose):
    """Apply the runtime's common joint axes to bones and rigid facial parts."""
    for rig in kit.descendants(root):
        if rig.type != "ARMATURE":
            continue
        for bone in rig.pose.bones:
            key = bone.name.removeprefix("ogre.")
            if key not in pose:
                continue
            frame = bone.bone.matrix_local.to_quaternion()
            rotation = hk.runtime_quat(*pose[key])
            bone.rotation_mode = "QUATERNION"
            bone.rotation_quaternion = frame.inverted() @ rotation @ frame
    hk.apply_runtime(root, pose)
