"""The Cadets' detailed master (9 October 2026): palette, common-axis rig,
skin weights and assembly.

build_master() polygonises the suit (figure_archers_body.py, cached by the
hash of its sources), paints it by construction group, rigs and weights it
as one connected skin, builds both heads (figure_archers_head.py) under
`archers.lookA` (him) and `archers.lookB` (her, shipped at scale 0: see
work/arena/2026-10-08-roster/archers/requests.md), the shared face
controls, and the hard gear (figure_archers_gear.py) on their bones.

Joints (bones archers<part>, every one with the root's axes): torso
(lumbar) > chest > head; chest > clavL/R > armL/R > foreL/R > handL/R;
handR > weapon (the ray gun, with the `archers.muzzle` empty at its
emitter); chest > antenna (the pack's whip); legL/R > kneeL/R > footL/R.
Face controls archerseyeL/R > archerspupilL/R, archersbrowL/R,
archersmouth on the head bone.
"""
import hashlib
import json
import os
import re
import time
from pathlib import Path

import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_archers_sdf as S
import figure_archers_body as B
import figure_archers_head as H
import figure_archers_gear as G

R = "archers"
T = kit.tint
HERE = Path(__file__).resolve().parent
CACHE = HERE.parents[2] / "work" / "arena" / "2026-10-08-roster" / "archers" / "cache"
T0 = time.time()


def log(msg):
    print(f"CADET [{time.time() - T0:7.1f}s] {msg}", flush=True)


PAL = {
    "SUIT": "weave:" + T("cadet-suit", "#ebe5d5"),
    "TEAM": "weave:team",
    "RUBBER": "resin:" + T("cadet-rubber", "#bdb9ae"),
    "GLOVE": "hide:" + T("cadet-glove", "#efe8d5"),
    "BOOT": "resin:" + T("cadet-boot", "#efeadd"),
    "SOLE": "resin:" + T("cadet-sole", "#2b2c31"),
    "BELT": "hide:" + T("cadet-belt", "#26272c"),
    "GOLD": "gilt:" + T("cadet-gold", "#d4a645"),
    "CHROME": "chrome:" + T("cadet-chrome", "#d6dbe1"),
    "GUN_TEAM": "lacquer:team",
    "PACK": "lacquer:team",
    "SHELL": "lacquer:" + T("cadet-unit", "#e4e1d6"),
    "DIAL": "resin:" + T("cadet-dial", "#1d2430"),
    "RAY": "glow:" + T("cadet-ray", "#ff4232"),
    "AMBER": "glow:" + T("cadet-amber", "#ffb52a"),
    "GREEN": "glow:" + T("cadet-green", "#5ae07c"),
    "GRIP": "resin:" + T("cadet-grip", "#27282d"),
    "GLASS": "glass:" + T("cadet-glass", "#e6f5ff"),
    "DAM": "resin:" + T("cadet-dam", "#3b3d43"),
    "HOSE": "resin:" + T("cadet-hose", "#4b4e56"),
    "POUCH": "gilt:" + T("cadet-steel", "#a2abb5"),
    "EYE": "resin:" + T("cadet-eye", "#f3f0e8"),
    "IRIS": "resin:" + T("cadet-iris", "#4a3222"),
    "PUPIL": "resin:" + T("cadet-pupil", "#0d0a0a"),
    "BROW": "hair:" + T("cadet-brow", "#3a2415"),
    "MOUTH": "resin:" + T("cadet-mouth", "#4c2420"),
    "SKIN_A": "skin:" + T("cadet-skin-him", "#d99b75"),
    "SKIN_B": "skin:" + T("cadet-skin-her", "#e9b596"),
    "HAIR_A": "hair:" + T("cadet-hair-him", "#5b3520"),
    "HAIR_B": "hair:" + T("cadet-hair-her", "#6e3a1f"),
    "LIP_B": "skin:" + T("cadet-lips-her", "#b65448"),
}
G.PAL.update(PAL)

BODY_MATERIAL = {"suit": PAL["SUIT"], "team": PAL["TEAM"], "rubber": PAL["RUBBER"],
                 "glove": PAL["GLOVE"], "boot": PAL["BOOT"], "sole": PAL["SOLE"],
                 "belt": PAL["BELT"]}


def np_coords(obj):
    co = np.empty(len(obj.data.vertices) * 3)
    obj.data.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def source_hash(*names, extra=""):
    h = hashlib.sha1(extra.encode())
    for n in names:
        h.update((HERE / n).read_bytes())
    return h.hexdigest()[:12]


def cached(kind, build, *sources, extra=""):
    key = source_hash(*sources, extra=extra)
    path = CACHE / f"{kind}-{key}.npz"
    if path.exists():
        log(f"{kind} from cache {path.name}")
        with np.load(path) as saved:
            return {key: saved[key].copy() for key in saved.files}
    CACHE.mkdir(parents=True, exist_ok=True)
    arrays = build()
    np.savez_compressed(path, **arrays)
    for old in CACHE.glob(f"{kind}-*.npz"):
        if old != path:
            old.unlink()
    return arrays


def painted(name, a, groups, materials):
    obj = S.mesh_from_arrays(name, a["points"], a["quads"], a["tris"])
    me = obj.data
    names = []
    for g in groups:
        if materials[g] not in names:
            names.append(materials[g])
    for m in names:
        me.materials.append(kit.material(m))
    index = np.array([names.index(materials[g]) for g in groups])[a["groups"]]
    me.polygons.foreach_set("material_index", index.astype(np.int32))
    me.update()
    return obj


def body_object():
    h = float(os.environ.get("CADET_VOXEL", ".0018"))
    a = cached("body", lambda: B.build_arrays(h, log), "figure_archers_body.py", "figure_archers_sdf.py",
               extra=f"{h:.5f}")
    obj = painted(R + ".skin", a, B.GROUPS, BODY_MATERIAL)
    part = obj.data.attributes.new("cadet_part", "INT8", "POINT")
    part.data.foreach_set("value", a["parts"].astype(np.int8))
    log(f"suit: {len(obj.data.vertices)} vertices, {len(obj.data.polygons)} faces")
    return obj


def head_object(look):
    h = float(os.environ.get("CADET_HEAD_VOXEL", ".0009"))
    a = cached(f"head{look}", lambda: H.build_arrays(look, h, log), "figure_archers_head.py",
               "figure_archers_sdf.py", extra=f"{look}{h:.5f}")
    mats = {"skin": PAL["SKIN_" + look], "lip": PAL["LIP_B"] if look == "B" else PAL["SKIN_A"],
            "hair": PAL["HAIR_" + look]}
    obj = painted(f"cadet-head-{look}", a, H.GROUPS, mats)
    log(f"head {look}: {len(obj.data.vertices)} vertices")
    return obj


# ------------------------------------------------------------------ rig

def bone_table():
    t = {"torso": (B.WAIST, None), "chest": (B.CHEST, "torso"), "head": (B.NECK, "chest"),
         "weapon": (B.GUN_C, "handR"), "antenna": (G.ANTENNA_BASE, "chest")}
    for s, side in B.SIDES:
        t["clav" + side] = (B.CLAV[s], "chest")
        t["arm" + side] = (B.SHOULDER[s], "clav" + side)
        t["fore" + side] = (B.ELBOW[s], "arm" + side)
        t["hand" + side] = (B.WRIST[s], "fore" + side)
        t["leg" + side] = (B.HIP[s], None)
        t["knee" + side] = (B.KNEE[s], "leg" + side)
        t["foot" + side] = (B.ANKLE[s], "knee" + side)
    return t


def make_rig(root):
    data = bpy.data.armatures.new("Cadet anatomical joint frames")
    rig = bpy.data.objects.new("archers.skeleton", data)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    table = bone_table()
    for name, (pos, _) in table.items():
        b = data.edit_bones.new(R + name)
        b.head, b.tail = Vector(pos), Vector(pos) + Vector((0, 0, .06))
        b.use_connect = False
    for name, (_, parent) in table.items():
        if parent:
            data.edit_bones[R + name].parent = data.edit_bones[R + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "WIRE"
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k: [round(float(c), 5) for c in v[0]] for k, v in table.items()})
    return rig


SKIN_BONES = ["torso", "chest", "clavL", "clavR", "armL", "foreL", "handL", "armR",
              "foreR", "handR", "legL", "kneeL", "footL", "legR", "kneeR", "footR"]


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mesh_edges(obj):
    e = np.empty(len(obj.data.edges) * 2, dtype=np.int64)
    obj.data.edges.foreach_get("vertices", e)
    return e.reshape(-1, 2)


def smooth_weights(W, edges, n, iterations=10, lam=.5):
    deg = np.bincount(edges[:, 0], minlength=n) + np.bincount(edges[:, 1], minlength=n)
    deg = np.maximum(deg, 1)
    for _ in range(iterations):
        for k in range(W.shape[1]):
            w = W[:, k]
            s = np.bincount(edges[:, 0], weights=w[edges[:, 1]], minlength=n) + \
                np.bincount(edges[:, 1], weights=w[edges[:, 0]], minlength=n)
            W[:, k] = w * (1 - lam) + s / deg * lam
    return W


def body_weight_matrix(P, part):
    """Joint ownership of every suit vertex (columns SKIN_BONES)."""
    N = len(P)
    x, y, z = P.T
    col = {b: i for i, b in enumerate(SKIN_BONES)}
    W = np.zeros((N, len(SKIN_BONES)))
    trunk = part == B.PARTS.index("torso")
    cs = ss(.715, .855, z)
    # The seat stays with the pelvis longer than the front of the hip.
    back = np.clip((-y - .02) / .05, 0, 1)
    hip = ss(.500 - .050 * back, .600 - .060 * back, z)
    W[:, col["chest"]] = cs * trunk
    W[:, col["torso"]] = (1 - cs) * trunk
    side_r = ss(-.030, .030, x)
    for s, side in B.SIDES:
        share = side_r if s > 0 else 1 - side_r
        W[:, col["leg" + side]] += (1 - hip) * share * W[:, col["torso"]]
    W[:, col["torso"]] *= np.where(trunk, hip, 1)
    for s, side in B.SIDES:
        m = part == B.PARTS.index("leg" + side)
        kn = 1 - ss(B.KNEE[s][2] - .040, B.KNEE[s][2] + .040, z)
        ft = 1 - ss(B.ANKLE[s][2] - .010, B.ANKLE[s][2] + .045, z)
        W[:, col["torso"]] += m * hip * (1 - kn)
        W[:, col["leg" + side]] += m * (1 - hip) * (1 - kn)
        W[:, col["knee" + side]] += m * kn * (1 - ft)
        W[:, col["foot" + side]] += m * kn * ft
        # Arms.
        m = part == B.PARTS.index("arm" + side)
        sh, el, wr = B.SHOULDER[s], B.ELBOW[s], B.WRIST[s]
        nE = B.unit(B.UPPER[s] + B.FOREARM[s])
        d, _, _ = B.hand_frame(s)
        nW = B.unit(B.FOREARM[s] + d)
        fore = ss(-.030, .028, (P - el) @ nE)
        hand = ss(-.012, .016, (P - wr) @ nW)
        own = ss(-.036, .032, (P - sh) @ B.UPPER[s])
        W[:, col["arm" + side]] += m * own * (1 - fore)
        W[:, col["fore" + side]] += m * fore * (1 - hand)
        W[:, col["hand" + side]] += m * fore * hand
        W[:, col["clav" + side]] += m * (1 - own) * (1 - fore) * .65
        W[:, col["chest"]] += m * (1 - own) * (1 - fore) * .35
        # The trapezius, the top of the chest and back by the shoulder ride
        # with the clavicle; the suit right at the joint with the arm.
        clav = ss(.050, .140, s * x) * ss(.875, .965, z) * trunk * .75
        moved = W[:, col["chest"]] * clav
        W[:, col["chest"]] -= moved
        W[:, col["clav" + side]] += moved
        near = np.exp(-(np.linalg.norm(P - sh, axis=1) / .044) ** 2) * ss(.130, .168, s * x) * trunk
        for b in ("chest", "clav" + side, "torso"):
            mv = W[:, col[b]] * near * .6
            W[:, col[b]] -= mv
            W[:, col["arm" + side]] += mv
    total = W.sum(1)
    W[total < 1e-6, col["torso"]] = 1
    W /= W.sum(1)[:, None]
    return W


def write_weights(obj, W, names, step=1000):
    groups = {n: obj.vertex_groups.get(R + n) or obj.vertex_groups.new(name=R + n) for n in names}
    for k, n in enumerate(names):
        q = np.rint(np.clip(W[:, k], 0, 1) * step).astype(np.int64)
        idx = np.flatnonzero(q > 0)
        if not len(idx):
            continue
        order = idx[np.argsort(q[idx])]
        cuts = np.flatnonzero(np.diff(q[order])) + 1
        for batch in np.split(order, cuts):
            groups[n].add(batch.tolist(), float(q[batch[0]]) / step, "REPLACE")


def skin_to(obj, rig):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "OBJECT"
    obj.matrix_world = world
    mod = obj.modifiers.new("Linear anatomical skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False


def weight_body(obj, rig):
    P = np_coords(obj)
    part = np.empty(len(P), dtype=np.int8)
    obj.data.attributes["cadet_part"].data.foreach_get("value", part)
    W = body_weight_matrix(P, part)
    edges = mesh_edges(obj)
    arm = np.isin(part, [B.PARTS.index("armL"), B.PARTS.index("armR")])
    cross = (arm[edges[:, 0]] != arm[edges[:, 1]]) & (P[edges[:, 0], 2] < .835)
    log(f"arm/body contacts below the armpit: {int(cross.sum())} edges")
    W = smooth_weights(W, edges, len(P), iterations=12)
    W /= W.sum(1)[:, None]
    write_weights(obj, W, SKIN_BONES)
    obj["bodyWeights"] = json.dumps(dict(zip(SKIN_BONES, W.sum(0).round(1).tolist())))
    log("weights: " + obj["bodyWeights"])
    skin_to(obj, rig)
    return W


def bone_attach(o, rig, name):
    kit.refresh()
    world = o.matrix_world.copy()
    o.parent = rig
    o.parent_type = "BONE"
    o.parent_bone = R + name
    o.matrix_world = world
    return o


def attach_faces(pieces, rig):
    groups = {}
    for o in pieces:
        key = None
        m = re.fullmatch(r"cadet-(eye|iris|pupil|glint|brow)-(-?1)", o.name)
        if m:
            label, s = m.groups()
            side = "L" if s == "-1" else "R"
            key = {"eye": "eye", "iris": "pupil", "pupil": "pupil", "glint": "pupil",
                   "brow": "brow"}[label] + side
        elif o.name.startswith("cadet-mouth"):
            key = "mouth"
        groups.setdefault(key, []).append(o)
    nodes = {}
    for key in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        objs = groups.get(key)
        if not objs:
            continue
        o = kit.join(objs, R + key) if len(objs) > 1 else objs[0]
        o.name = R + key
        kit.apply_transform(o)
        pts = np_coords(o)
        lo, hi = pts.min(0), pts.max(0)
        centre, size = Vector((lo + hi) / 2), hi - lo
        if key.startswith("pupil"):
            axes = nodes["eye" + key[-1]].matrix_world.to_3x3()
        else:
            normal = Vector((centre.x * 3, 1, 0)).normalized()
            up = Vector((0, 0, 1))
            right = normal.cross(up).normalized()
            axes = Matrix((right, normal, up)).transposed()
        frame = Matrix.Translation(centre) @ axes.to_4x4()
        o.data.transform(frame.inverted())
        o.matrix_world = frame
        if key.startswith("pupil"):
            o.parent = nodes["eye" + key[-1]]
        else:
            o.parent, o.parent_type, o.parent_bone = rig, "BONE", R + "head"
        o.matrix_world = frame
        o["faceWidth"], o["faceHeight"] = max(.005, float(size[0])), max(.002, float(size[2]))
        nodes[key] = o
        kit.refresh()
    rig["faceContract"] = "archerseyeL/R -> archerspupilL/R; archersbrowL/R; archersmouth; centred surface frames"
    return nodes


def look_root(rig, look, shown):
    """An empty on the head bone carrying one look's head and hair."""
    e = kit.empty(f"{R}.look{look}", location=Vector(B.NECK))
    bone_attach(e, rig, "head")
    e["cadetLook"] = "him" if look == "A" else "her"
    return e


def assemble():
    root = kit.empty(R)
    root["masterBrief"] = "work/arena/2026-10-08-roster/archers/brief.md"
    body = body_object()
    rig = make_rig(root)
    weight_body(body, rig)
    log("suit weighted")
    # Heads: him (A, shown) and her (B, shipped at scale 0).
    for look in ("A", "B"):
        head = head_object(look)
        holder = look_root(rig, look, look == "A")
        kit.refresh()
        world = head.matrix_world.copy()
        head.parent = holder
        head.matrix_world = world
    face_sc = H.sculpt("A")
    attach_faces(H.controls(face_sc, PAL), rig)
    log("heads and face controls attached")
    # Gear on the chest: ring, dam, bubble, chest unit, pack, hoses.
    for make in (G.neck_ring, G.chest_unit, G.pack, G.hoses):
        bone_attach(make(log=log), rig, "chest")
    bone_attach(G.neck_dam(), rig, "chest")
    bone_attach(G.bubble(), rig, "chest")
    rod_bead, tip = G.antenna()
    for o in rod_bead:
        bone_attach(o, rig, "antenna")
    for make in (G.buckle, G.pouches):
        bone_attach(make(log=log), rig, "torso")
    gun = G.gun(log=log)
    bone_attach(gun, rig, "weapon")
    muzzle = kit.empty(R + ".muzzle", location=Vector(G.muzzle_point()))
    bone_attach(muzzle, rig, "weapon")
    log("gear attached")
    root["skinContract"] = "continuous linear skin; common joint axes; named bone attachments"
    root["unoptimized"] = True
    kit.refresh()
    return root


def hide_look_b(root):
    b = bpy.data.objects.get(R + ".lookB")
    if b is not None:
        b.scale = (0, 0, 0)
        kit.refresh()


def build_master():
    return assemble()


# ------------------------------------------------------------------ posing (review)

def runtime_quat(rx, ry, rz):
    """A joint turned by the game, in Blender axes: three.js applies Euler
    XYZ in its y-up frame (three y = Blender z, three z = Blender -y)."""
    from mathutils import Quaternion
    return (Quaternion((1, 0, 0), rx) @ Quaternion((0, 0, 1), ry) @
            Quaternion((0, 1, 0), -rz))


def pose_rig(rig, values):
    """Pose common-axis bones as the game would: {part: (x, y, z)}."""
    from mathutils import Quaternion
    for b in rig.pose.bones:
        b.rotation_mode = "QUATERNION"
        b.rotation_quaternion = Quaternion()
        b.location = (0, 0, 0)
    for name, angles in values.items():
        bone = rig.pose.bones.get(R + name)
        if bone is None:
            continue
        frame = bone.bone.matrix_local.to_quaternion()
        bone.rotation_quaternion = frame.inverted() @ runtime_quat(*angles) @ frame
    kit.refresh()


# Review poses in game terms (radians as the moves write them: arm x
# raises forward, arm z out (left negative), fore bends the elbow, knee
# negative bends the knee back).
POSES = {
    "neutral": {},
    "arm-forward-up": {"armR": (2.1, 0, 0.05), "foreR": (0.25, 0, 0), "clavR": (0, .1, .2),
                       "armL": (2.05, 0, -0.05), "foreL": (0.2, 0, 0), "clavL": (0, -.1, -.2)},
    "arm-out": {"armR": (0, 0, 1.75), "armL": (0, 0, -1.75), "clavR": (0, 0, .22), "clavL": (0, 0, -.22)},
    "deep-bends": {"foreR": (2.4, 0, 0), "foreL": (2.4, 0, 0),
                   "armR": (0.5, 0, 0), "armL": (0.5, 0, 0),
                   "legL": (1.25, 0, 0), "kneeL": (-2.05, 0, 0),
                   "legR": (-0.35, 0, 0), "kneeR": (-0.6, 0, 0)},
    # The aim: gun at the shoulder line in both hands (approximate; the
    # game solves it with reach()).
    "aim": {"armR": (1.45, 0, -.12), "foreR": (.35, 0, 0), "handR": (0, 0, -.25),
            "armL": (1.25, 0, .45), "foreL": (1.15, 0, 0), "chest": (0, .18, 0), "head": (0, -.12, 0)},
    "walk": {"legL": (0.45, 0, 0), "kneeL": (-0.25, 0, 0),
             "legR": (-0.35, 0, 0), "kneeR": (-0.55, 0, 0),
             "armL": (-0.35, 0, -0.06), "armR": (0.3, 0, 0.06),
             "foreL": (0.25, 0, 0), "foreR": (0.45, 0, 0), "torso": (0, 0.1, 0)},
}
