"""The Miner's skeleton, skin weights and master assembly.

Common-axis bones (each points +Z with the root's axes, as in
figure_sumo_sculpt.make_rig), so the game's radians mean what they mean for
rigid parts. Bones (game names drop the dot): torso (lower back and
belly), chest (upper spine), head, hat, clavL/R (shoulder girdle), armL/R,
foreL/R (elbows), handL/R (wrists), weapon (the pick in the right fist),
legL/R, kneeL/R, footL/R.

Skin weights are authored from the anatomy: arm ownership follows the
distance to the arm's own line, so the flank never moves with a raised
arm; the deltoid and trapezius share arm, clavicle and chest; the elbow
blends over a hand's width; legs take the seat and hips progressively.
Garment shells take the barycentric weights of the skin beneath them.
"""

import json

import bpy
import numpy as np
from mathutils import Matrix

import kit
import figure_miner_clay as mc
import figure_miner_sculpt as ms
import figure_miner_dress as md
import figure_miner_props as mp
import figure_miner_sdf as sd
from figure_miner_clay import V

R = "miner"
BONES = ["torso", "chest", "head", "hat", "clavL", "clavR", "armL", "armR", "foreL", "foreR",
         "handL", "handR", "weapon", "legL", "legR", "kneeL", "kneeR", "footL", "footR"]
DEFORM = [b for b in BONES if b not in ("hat", "weapon")]
FACE = ["eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth"]


def pivots():
    p = {"torso": ms.WAIST, "chest": ms.CHEST, "head": ms.NECK, "hat": ms.HAT,
         "weapon": ms.grip_centre(1)}
    parents = {"chest": "torso", "head": "chest", "hat": "head", "weapon": "handR"}
    for s, k in ((-1, "L"), (1, "R")):
        p["clav" + k] = ms.CLAV[s]
        p["arm" + k] = ms.SHOULDER[s]
        p["fore" + k] = ms.ELBOW[s]
        p["hand" + k] = ms.WRIST[s]
        p["leg" + k] = ms.HIP[s]
        p["knee" + k] = ms.KNEE[s]
        p["foot" + k] = ms.ANKLE[s]
        parents.update({"clav" + k: "chest", "arm" + k: "clav" + k, "fore" + k: "arm" + k,
                        "hand" + k: "fore" + k, "knee" + k: "leg" + k, "foot" + k: "knee" + k})
    return p, parents


def make_rig(root):
    data = bpy.data.armatures.new("Miner joint frames")
    rig = bpy.data.objects.new("miner.skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    pos, parents = pivots()
    for name in BONES:
        b = data.edit_bones.new("miner." + name)
        b.head = pos[name]
        b.tail = pos[name] + V(0, 0, 0.06)
        b.roll = 0
        b.use_connect = False
        b.use_deform = name in DEFORM
    for name, par in parents.items():
        data.edit_bones["miner." + name].parent = data.edit_bones["miner." + par]
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type = "STICK"
    rig.show_in_front = True
    rig["arenaCommonAxes"] = True
    rig["anatomicalPivots"] = json.dumps({k: list(v) for k, v in pos.items()})
    return rig


# ------------------------------------------------------------- weights

def ss(lo, hi, x):
    return mc.ss(lo, hi, x)


def seg_param(P, a, b):
    a, b = np.array(list(a)), np.array(list(b))
    ab = b - a
    u = np.clip((P - a) @ ab / (ab @ ab), 0, 1)
    d = np.linalg.norm(P - (a + u[:, None] * ab), axis=1)
    return u, d


def body_half_width(z):
    rows = ms.BODY
    return np.interp(z, [r[0] for r in rows], [r[1] for r in rows])


ARM_CUT = 0.830  # below this the hanging arm's skin is its own component


def harmonic(values, edges, region, reach=0.05):
    """Relax values over the mesh inside region (Jacobi iterations of the
    graph Laplacian), holding everything outside fixed: a smooth blend
    between the fixed values that follows the surface."""
    free = np.flatnonzero(region)
    if not len(free):
        return values
    used = region[edges[:, 0]] | region[edges[:, 1]]
    e = edges[used]
    verts = np.unique(e)
    local = np.full(len(values), -1)
    local[verts] = np.arange(len(verts))
    a, b = local[e[:, 0]], local[e[:, 1]]
    m = len(verts)
    deg = np.bincount(a, minlength=m) + np.bincount(b, minlength=m)
    v = values[verts].astype(np.float64)
    is_free = region[verts]
    iters = 1400 if not ms.FAST else 600
    for _ in range(iters):
        acc = np.bincount(a, weights=v[b], minlength=m) + np.bincount(b, weights=v[a], minlength=m)
        v = np.where(is_free, acc / np.maximum(deg, 1), v)
    out = values.astype(np.float64).copy()
    out[verts] = v
    return out


def arm_components(P, edges):
    """Per side, the skin vertices of the arm's own connected component
    below the armpit: the recess keeps the hanging arm and fist apart from
    the flank and thigh there, so topology says exactly which is which."""
    out = {}
    for s in (-1, 1):
        keep = (P[:, 0] * s > 0.10) & (P[:, 2] > 0.38) & (P[:, 2] < ARM_CUT)
        e = edges[keep[edges[:, 0]] & keep[edges[:, 1]]]
        parent = np.arange(len(P))

        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        for a, b in e:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[ra] = rb
        idx = np.flatnonzero(keep)
        roots = np.array([find(i) for i in idx])
        own = np.zeros(len(P), dtype=bool)
        for r in np.unique(roots):
            members = idx[roots == r]
            if len(members) > 200 and (P[members, 0] * s).mean() > 0.21:
                own[members] = True
        out[s] = own
    return out


def skin_weights(P, edges):
    """(n, len(DEFORM)) weights for skin points P (n, 3), edges (m, 2)."""
    comps = arm_components(P, edges)
    x, y, z = P.T
    n = len(P)
    W = {b: np.zeros(n) for b in DEFORM}
    # Spine: lower back and belly, upper chest, neck into head.
    # The head owns everything above a plane slanting under the chin, so
    # the jaw turns with it and the nape bends.
    head = ss(0.995, 1.060, z + 0.30 * y)
    W["head"] = head
    W["chest"] = ss(0.700, 0.850, z) * (1 - head)
    W["torso"] = (1 - ss(0.700, 0.850, z)) * (1 - head)
    for s, k in ((-1, "L"), (1, "R")):
        side = ss(-0.03, 0.03, x * s)
        # Legs take the trousers below the hips and part of the seat.
        hip, knee, ankle = ms.HIP[s], ms.KNEE[s], ms.ANKLE[s]
        u1, d1 = seg_param(P, hip, knee)
        u2, d2 = seg_param(P, knee, ankle)
        tl = np.where(d1 <= d2, u1 * 0.5, 0.5 + u2 * 0.5)
        legshare = side * (1 - ss(0.470, 0.600, z)) * (1 - ss(0.20, 0.30, np.abs(x)))
        kneeb = ss(0.43, 0.57, tl)
        foot = ss(0.985, 1.0, tl) * (1 - ss(0.085, 0.10, z))
        W["leg" + k] = legshare * (1 - kneeb)
        W["knee" + k] = legshare * kneeb * (1 - foot)
        W["foot" + k] = legshare * kneeb * foot
        for b in ("torso", "chest", "head"):
            W[b] = W[b] * (1 - legshare)
        # Arms own what is near the arm's own line and clear of the trunk.
        sh, el, wr = ms.SHOULDER[s], ms.ELBOW[s], ms.WRIST[s]
        ua, da = seg_param(P, sh, el)
        uf, df = seg_param(P, el, wr)
        e1, e2, e3 = ms.hand_frame(s)
        along = (P - np.array(list(wr))) @ np.array(list(e1))
        dh = np.linalg.norm(P - np.array(list(wr + e1 * 0.05)), axis=1)
        ta = np.where(da <= df, ua * 0.5, 0.5 + uf * 0.5)
        dist = np.minimum(np.minimum(da, df), dh)
        radius = np.interp(ta, [0, 0.15, 0.45, 0.5, 0.6, 1.0], [0.075, 0.072, 0.062, 0.056, 0.060, 0.050])
        near = 1 - ss(radius, radius + 0.018, dist)
        clear = ss(body_half_width(z) - 0.004, body_half_width(z) + 0.016, x * s)
        top = ss(0.83, 0.90, z)
        armshare = near * np.maximum(clear, top * ss(0.12, 0.20, x * s)) * (x * s > 0.10)
        # The fist itself: everything round the grip's line belongs to it.
        gc = ms.grip_centre(s)
        _, dfist = seg_param(P, gc - e2 * 0.040, gc + e2 * 0.032)
        # Wide enough for the thumb over the haft, short of the thigh.
        fist = (1 - ss(0.056, 0.064, dfist)) * (x * s > 0.15)
        # Below the armpit the arm and fist are their own skin (topology).
        # Round the armpit, where arm and flank join, the share is relaxed
        # into a smooth harmonic blend over the mesh: all arm down the arm,
        # nothing down the flank, the soft shoulder above, and no seam.
        own = comps[s]
        below = z < ARM_CUT
        armshare = np.where(below, own.astype(float), np.maximum(armshare, fist * (z < 0.66)))
        root = np.array(list(sh + (el - sh) * ((sh.z - ARM_CUT) / (sh.z - el.z))))
        horiz = np.hypot(x - root[0], y - root[1])
        region = (x * s > 0.06) & (z > 0.765) & (z < 0.93) & (horiz < 0.125)
        armshare = harmonic(armshare, edges, region)
        fore = ss(0.44, 0.56, ta)
        hand = np.maximum(ss(-0.010, 0.014, along) * (dh < 0.11) * (ta > 0.75), fist)
        W["arm" + k] = armshare * (1 - fore)
        W["fore" + k] = armshare * fore * (1 - hand)
        W["hand" + k] = armshare * fore * hand
        # Clavicle: trapezius and the deltoid's top.
        clav = 0.85 * ss(0.045, 0.12, x * s) * ss(0.86, 0.95, z) * (1 - head) * (1 - armshare) * (y > -0.12)
        for b in ("torso", "chest", "head", "leg" + k, "knee" + k, "foot" + k):
            W[b] = W[b] * (1 - armshare)
        W["chest"] = W["chest"] * (1 - clav)
        W["clav" + k] = clav
        cap = W["arm" + k] * top * (1 - ss(0.17, 0.24, x * s)) * 0.5
        W["arm" + k] = W["arm" + k] - cap
        W["clav" + k] = W["clav" + k] + cap
    M = np.stack([np.maximum(W[b], 0) for b in DEFORM], axis=1)
    M /= np.maximum(M.sum(axis=1, keepdims=True), 1e-9)
    return M


def boot_weights(o, s):
    pts, _ = sd.mesh_arrays(o)
    z = pts[:, 2].astype(np.float64)
    k = "L" if s < 0 else "R"
    foot = 1 - ss(0.075, 0.140, z)
    M = np.zeros((len(pts), len(DEFORM)))
    M[:, DEFORM.index("foot" + k)] = foot
    M[:, DEFORM.index("knee" + k)] = 1 - foot
    return M


# ------------------------------------------------------------- faces

def attach_face(o, rig, name):
    """A face control in a centred surface frame on the head bone."""
    kit.apply(o)
    kit.apply_transform(o)
    pts = [v.co.copy() for v in o.data.vertices]
    lo = V(*(min(p[j] for p in pts) for j in range(3)))
    hi = V(*(max(p[j] for p in pts) for j in range(3)))
    centre, size = (lo + hi) / 2, hi - lo
    if name.startswith("pupil"):
        axes = bpy.data.objects["minereye" + name[-1]].matrix_world.to_3x3()
    else:
        normal = V(centre.x * 3, 1, 0).normalized()
        up = V(0, 0, 1)
        right = normal.cross(up).normalized()
        axes = Matrix((right, normal, up)).transposed()
    frame = Matrix.Translation(centre) @ axes.to_4x4()
    o.data.transform(frame.inverted())
    o.name = "miner" + name
    o.matrix_world = frame
    if name.startswith("pupil"):
        o.parent = bpy.data.objects["minereye" + name[-1]]
    else:
        o.parent, o.parent_type, o.parent_bone = rig, "BONE", "miner.head"
    o.matrix_world = frame
    o["faceWidth"] = max(0.006, size.x)
    o["faceHeight"] = max(0.003, size.z)
    kit.refresh()
    return o


# ------------------------------------------------------------- master

def build_master():
    root = kit.empty(R)
    skin = ms.skin_clay()
    skin.name = "miner.skin"
    rig = make_rig(root)
    surf = mc.Surface(skin)
    pts, _ = sd.mesh_arrays(skin)
    edges = np.empty(len(skin.data.edges) * 2, dtype=np.int64)
    skin.data.edges.foreach_get("vertices", edges)
    Wskin = skin_weights(pts.astype(np.float64), edges.reshape(-1, 2))
    root["neckline"] = json.dumps(md.set_neckline(md.neckline(surf)))
    md.paint_regions(skin, Wskin, DEFORM)
    col = {b: i for i, b in enumerate(DEFORM)}
    armw = sum(Wskin[:, col[b + k]] for b in ("arm", "fore", "hand") for k in "LR")
    legw = sum(Wskin[:, col[b + k]] for b in ("leg", "knee", "foot") for k in "LR")
    sources = {"trunk": surf.subset(armw < 0.25), "arm": surf.subset(armw > 0.5),
               "leg": surf.subset(legw > 0.5)}
    garments = md.garments(sources)
    mc.write_weights(skin, Wskin, DEFORM, rig, "miner.")
    skin["continuousSkin"] = True
    for o, kind in garments:
        mc.write_weights(o, mc.copy_weights(o, sources[kind], Wskin, DEFORM), DEFORM, rig, "miner.")
    for s in (-1, 1):
        for o in md.boot(s):
            mc.write_weights(o, boot_weights(o, s), DEFORM, rig, "miner.")
    for o in [md.moustache(surf), md.hair(surf)] + md.eyelids():
        mc.bone_attach(o, rig, "miner.head")
    attach_face(mc.join(md.mouth(), "miner.mouth-parts"), rig, "mouth")
    for s in (-1, 1):
        attach_face(md.brow(surf, s), rig, "brow" + ("L" if s < 0 else "R"))
    pairs = md.eyes()
    for o, name in pairs:
        if name.startswith("eye"):
            attach_face(o, rig, name)
    for o, name in pairs:
        if name.startswith("pupil"):
            attach_face(o, rig, name)
    for o in mp.hat():
        mc.bone_attach(o, rig, "miner.hat")
    e1, e2, e3 = ms.hand_frame(1)
    pick = mp.pick_local()
    mp.place(pick, ms.grip_centre(1) - e2 * mp.GRIP_R_AT, e1, e2)
    for o in pick:
        mc.bone_attach(o, rig, "miner.weapon")
    root["authorScale"] = 1.0
    root["skinContract"] = "continuous linear skin; common joint axes; chest and clavicles"
    root["unoptimized"] = True
    kit.refresh()
    return root
