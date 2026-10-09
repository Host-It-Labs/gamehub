"""The Inventor's skeleton, skin weights and master assembly.

Common-axis bones (each points +Z with the root's axes, as in
figure_sumo_sculpt.make_rig), so the game's radians mean what they mean for
rigid parts. Bones (game names drop the dot): torso (lower back and
belly), chest (upper spine), head, clavL/R (shoulder girdle), armL/R,
foreL/R (elbows), handL/R (wrists), weapon (the wand in the right fist),
legL/R, kneeL/R, footL/R, skirtL/R (the coat's tails, soft), hair and hat
(the left and right puffs, soft) and extra (the coil's ball, soft).

Skin weights follow the Miner's method (figure_miner_rig.py): arm ownership
by the arm's own connected skin below the armpit and a harmonic blend
round it, the deltoid and trapezius shared with clavicle and chest, the
elbow over a hand's width, the legs taking the seat progressively.
Garment shells take the barycentric weights of the skin beneath them; the
skirt hangs from the torso into its own tail bones.
"""

import json

import bpy
import numpy as np

import kit
import figure_miner_clay as mc
import figure_miner_sdf as sd
import figure_inventor_sculpt as ms
import figure_inventor_dress as md
import figure_inventor_gear as mg
from figure_miner_clay import V

R = "inventor"
BONES = ["torso", "chest", "head", "hair", "hat", "clavL", "clavR", "armL", "armR", "foreL", "foreR",
         "handL", "handR", "weapon", "legL", "legR", "kneeL", "kneeR", "footL", "footR",
         "skirtL", "skirtR", "extra"]
DEFORM = [b for b in BONES if b not in ("hair", "hat", "weapon", "extra")]
FACE = ["eyeL", "eyeR", "pupilL", "pupilR", "browL", "browR", "mouth"]
BALL_PIVOT = V(float(mg.COIL[0]), float(mg.COIL[1]), mg.COIL_TOP)


def pivots():
    p = {"torso": ms.WAIST, "chest": ms.CHEST, "head": ms.NECK, "weapon": ms.grip_centre(1),
         "hair": ms.to_head(md.PUFF_BASE[-1]), "hat": ms.to_head(md.PUFF_BASE[1]), "extra": BALL_PIVOT,
         "skirtL": ms.SKIRT[-1], "skirtR": ms.SKIRT[1]}
    parents = {"chest": "torso", "head": "chest", "hair": "head", "hat": "head", "weapon": "handR",
               "extra": "chest", "skirtL": "torso", "skirtR": "torso"}
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
    data = bpy.data.armatures.new("Inventor joint frames")
    rig = bpy.data.objects.new("inventor.skeleton", data)
    bpy.context.collection.objects.link(rig)
    rig.parent = root
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    pos, parents = pivots()
    for name in BONES:
        b = data.edit_bones.new("inventor." + name)
        b.head = pos[name]
        b.tail = pos[name] + V(0, 0, 0.06)
        b.roll = 0
        b.use_connect = False
        b.use_deform = name in DEFORM
    for name, par in parents.items():
        data.edit_bones["inventor." + name].parent = data.edit_bones["inventor." + par]
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


ARM_CUT = 0.845  # below this the hanging arm's skin is its own component


def harmonic(values, edges, region):
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
    for _ in range(600 if ms.FAST else 1400):
        acc = np.bincount(a, weights=v[b], minlength=m) + np.bincount(b, weights=v[a], minlength=m)
        v = np.where(is_free, acc / np.maximum(deg, 1), v)
    out = values.astype(np.float64).copy()
    out[verts] = v
    return out


def arm_components(P, edges):
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
            if len(members) > 200 and (P[members, 0] * s).mean() > 0.165:
                own[members] = True
        out[s] = own
    return out


def skin_weights(P, edges):
    """(n, len(DEFORM)) weights for skin points P (n, 3), edges (m, 2)."""
    comps = arm_components(P, edges)
    x, y, z = P.T
    n = len(P)
    W = {b: np.zeros(n) for b in DEFORM}
    head = ss(0.992, 1.055, z + 0.30 * y)
    W["head"] = head
    W["chest"] = ss(0.715, 0.845, z) * (1 - head)
    W["torso"] = (1 - ss(0.715, 0.845, z)) * (1 - head)
    for s, k in ((-1, "L"), (1, "R")):
        side = ss(-0.025, 0.025, x * s)
        hip, knee, ankle = ms.HIP[s], ms.KNEE[s], ms.ANKLE[s]
        u1, d1 = seg_param(P, hip, knee)
        u2, d2 = seg_param(P, knee, ankle)
        tl = np.where(d1 <= d2, u1 * 0.5, 0.5 + u2 * 0.5)
        legshare = side * (1 - ss(0.545, 0.665, z)) * (1 - ss(0.17, 0.26, np.abs(x)))
        kneeb = ss(0.43, 0.57, tl)
        foot = ss(0.985, 1.0, tl) * (1 - ss(0.085, 0.10, z))
        W["leg" + k] = legshare * (1 - kneeb)
        W["knee" + k] = legshare * kneeb * (1 - foot)
        W["foot" + k] = legshare * kneeb * foot
        for b in ("torso", "chest", "head"):
            W[b] = W[b] * (1 - legshare)
        sh, el, wr = ms.SHOULDER[s], ms.ELBOW[s], ms.WRIST[s]
        ua, da = seg_param(P, sh, el)
        uf, df = seg_param(P, el, wr)
        e1, e2, e3 = ms.hand_frame(s)
        along = (P - np.array(list(wr))) @ np.array(list(e1))
        dh = np.linalg.norm(P - np.array(list(wr + e1 * 0.045)), axis=1)
        ta = np.where(da <= df, ua * 0.5, 0.5 + uf * 0.5)
        dist = np.minimum(np.minimum(da, df), dh)
        radius = np.interp(ta, [0, 0.2, 0.42, 0.47, 0.55, 0.62, 0.8, 1.0],
                           [0.064, 0.060, 0.060, 0.046, 0.046, 0.052, 0.044, 0.042])
        near = 1 - ss(radius, radius + 0.016, dist)
        clear = ss(body_half_width(z) - 0.004, body_half_width(z) + 0.016, x * s)
        top = ss(0.85, 0.92, z)
        armshare = near * np.maximum(clear, top * ss(0.11, 0.18, x * s)) * (x * s > 0.09)
        gc = ms.grip_centre(s)
        _, dfist = seg_param(P, gc - e2 * 0.034, gc + e2 * 0.026)
        fist = (1 - ss(0.048, 0.056, dfist)) * (x * s > 0.13)
        own = comps[s]
        below = z < ARM_CUT
        armshare = np.where(below, own.astype(float), np.maximum(armshare, fist * (z < 0.66)))
        root = np.array(list(sh + (el - sh) * ((sh.z - ARM_CUT) / (sh.z - el.z))))
        horiz = np.hypot(x - root[0], y - root[1])
        region = (x * s > 0.06) & (z > 0.78) & (z < 0.94) & (horiz < 0.11)
        armshare = harmonic(armshare, edges, region)
        fore = ss(0.44, 0.56, ta)
        hand = np.maximum(ss(-0.010, 0.012, along) * (dh < 0.10) * (ta > 0.75), fist)
        W["arm" + k] = armshare * (1 - fore)
        W["fore" + k] = armshare * fore * (1 - hand)
        W["hand" + k] = armshare * fore * hand
        clav = 0.85 * ss(0.040, 0.11, x * s) * ss(0.87, 0.95, z) * (1 - head) * (1 - armshare) * (y > -0.12)
        for b in ("torso", "chest", "head", "leg" + k, "knee" + k, "foot" + k):
            W[b] = W[b] * (1 - armshare)
        W["chest"] = W["chest"] * (1 - clav)
        W["clav" + k] = clav
        cap = W["arm" + k] * top * (1 - ss(0.15, 0.22, x * s)) * 0.5
        W["arm" + k] = W["arm" + k] - cap
        W["clav" + k] = W["clav" + k] + cap
    M = np.stack([np.maximum(W[b], 0) for b in DEFORM], axis=1)
    M /= np.maximum(M.sum(axis=1, keepdims=True), 1e-9)
    return M


def skirt_weights(o):
    """The skirt hangs from the torso at its waist seam into its own tail
    bone by the seat; above the vent the back is shared by both."""
    pts, _ = sd.mesh_arrays(o)
    x, y, z = pts[:, 0].astype(np.float64), pts[:, 1], pts[:, 2].astype(np.float64)
    tail = ss(0.665, 0.585, z)
    right = ss(-0.02, 0.02, x)
    left_half = "skirt-1" in o.name or o.name.endswith("pocket-1")
    if "skirt" in o.name and "pocket" not in o.name:
        # A half's own tail bone below the vent; above it the two share.
        own = ss(md.VENT + 0.03, md.VENT - 0.005, z)
        right = own * (0.0 if left_half else 1.0) + (1 - own) * right
    M = np.zeros((len(pts), len(DEFORM)))
    M[:, DEFORM.index("torso")] = 1 - tail
    M[:, DEFORM.index("skirtR")] = tail * right
    M[:, DEFORM.index("skirtL")] = tail * (1 - right)
    return M


def boot_weights(o, s):
    pts, _ = sd.mesh_arrays(o)
    z = pts[:, 2].astype(np.float64)
    k = "L" if s < 0 else "R"
    foot = 1 - ss(0.075, 0.135, z)
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
        axes = bpy.data.objects["inventoreye" + name[-1]].matrix_world.to_3x3()
    else:
        from mathutils import Matrix
        normal = V(centre.x * 3, 1, 0).normalized()
        up = V(0, 0, 1)
        right = normal.cross(up).normalized()
        axes = Matrix((right, normal, up)).transposed()
    from mathutils import Matrix
    frame = Matrix.Translation(centre) @ axes.to_4x4()
    o.data.transform(frame.inverted())
    o.name = "inventor" + name
    o.matrix_world = frame
    if name.startswith("pupil"):
        o.parent = bpy.data.objects["inventoreye" + name[-1]]
    else:
        o.parent, o.parent_type, o.parent_bone = rig, "BONE", "inventor.head"
    o.matrix_world = frame
    o["faceWidth"] = max(0.006, size.x)
    o["faceHeight"] = max(0.003, size.z)
    kit.refresh()
    return o


# ------------------------------------------------------------- master

def muzzle_extra():
    """Where the zap leaves the wand: the emitter's tip in the weapon
    joint's frame, three.js axes (x right, y up, z back), figure units."""
    e1, e2, e3 = ms.hand_frame(1)
    tip = ms.grip_centre(1) + e1 * float(mg.MUZZLE[1]) + e2 * float(mg.MUZZLE[2])
    d = tip - ms.grip_centre(1)
    return [round(d.x, 4), round(d.z, 4), round(-d.y, 4)]


def build_master():
    root = kit.empty(R)
    skin, head_ref = ms.skin_clay(head_ref=True)
    skin.name = "inventor.skin"
    rig = make_rig(root)
    surf = mc.Surface(skin)
    pts, _ = sd.mesh_arrays(skin)
    edges = np.empty(len(skin.data.edges) * 2, dtype=np.int64)
    skin.data.edges.foreach_get("vertices", edges)
    Wskin = skin_weights(pts.astype(np.float64), edges.reshape(-1, 2))
    md.paint_regions(skin, Wskin, DEFORM)
    col = {b: i for i, b in enumerate(DEFORM)}
    armw = sum(Wskin[:, col[b + k]] for b in ("arm", "fore", "hand") for k in "LR")
    legw = sum(Wskin[:, col[b + k]] for b in ("leg", "knee", "foot") for k in "LR")
    headw = Wskin[:, col["head"]]
    sources = {"trunk": surf.subset(armw < 0.25), "arm": surf.subset(armw > 0.5),
               "leg": surf.subset(legw > 0.5), "head": surf.subset(headw > 0.5)}
    garments = md.garments(sources)
    garments += [(o, "trunk") for o in mg.straps(sources["trunk"])]
    skirt, _shape = md.skirt(sources["trunk"])
    mc.write_weights(skin, Wskin, DEFORM, rig, "inventor.")
    skin["continuousSkin"] = True
    for o, kind in garments:
        mc.write_weights(o, mc.copy_weights(o, sources[kind], Wskin, DEFORM), DEFORM, rig, "inventor.")
    for o in skirt:
        for p in o.data.polygons:
            p.use_smooth = True
        mc.write_weights(o, skirt_weights(o), DEFORM, rig, "inventor.")
    for s in (-1, 1):
        for o in md.boot(s):
            mc.write_weights(o, boot_weights(o, s), DEFORM, rig, "inventor.")
    # Head pieces are fitted to the unscaled head, then moved with it.
    head_surf = mc.Surface(head_ref)
    HM = ms.head_matrix()

    def placed(objs):
        for o in objs:
            o.data.transform(HM)
            o.data.update()
        return objs
    for o in placed([md.hair_cap()] + md.curls(head_surf) + md.goggles(head_surf) + md.eyelids()):
        mc.bone_attach(o, rig, "inventor.head")
    for s, bone in ((-1, "hair"), (1, "hat")):
        for o in placed([md.puff(s, 3 if s < 0 else 7), md.puff_tie(s)]):
            mc.bone_attach(o, rig, "inventor." + bone)
    attach_face(placed([md.mouth()])[0], rig, "mouth")
    for s in (-1, 1):
        attach_face(placed([md.brow(head_surf, s)])[0], rig, "brow" + ("L" if s < 0 else "R"))
    pairs = md.eyes()
    placed([o for o, _ in pairs])
    for o, name in pairs:
        if name.startswith("eye"):
            attach_face(o, rig, name)
    for o, name in pairs:
        if name.startswith("pupil"):
            attach_face(o, rig, name)
    bpy.data.objects.remove(head_ref, do_unlink=True)
    for o in mg.pack():
        mc.bone_attach(o, rig, "inventor.chest")
    for o in mg.ball():
        mc.bone_attach(o, rig, "inventor.extra")
    e1, e2, e3 = ms.hand_frame(1)
    wand, _ = mg.wand(np.array(list(ms.grip_centre(1))), np.array(list(e1)), np.array(list(e2)))
    for o in wand:
        mc.bone_attach(o, rig, "inventor.weapon")
    muzzle = kit.empty("inventor.muzzle", location=ms.grip_centre(1)
                       + e1 * float(mg.MUZZLE[1]) + e2 * float(mg.MUZZLE[2]))
    mc.bone_attach(muzzle, rig, "inventor.weapon")
    root["authorScale"] = 1.0
    root["skinContract"] = "continuous linear skin; common joint axes; chest and clavicles"
    root["muzzle"] = json.dumps({"part": "weapon", "offset": muzzle_extra()})
    root["unoptimized"] = True
    kit.refresh()
    return root
