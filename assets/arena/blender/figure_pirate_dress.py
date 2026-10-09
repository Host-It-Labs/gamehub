"""The Pirate's garments, hair and props (9 October 2026), and the master's
assembly (assemble): the body, rig, weights, face controls and every
attachment on its bone.

Head: a cobalt bandana tied at the back (its tails are the soft `hair`
part), a black felt tricorne with gold-edged turned-up walls (`hat`), the
hair pulled tight under the bandana and one long braid (`tail`, `tail2`,
`tail3`), gold hoops.
Body: a long dark waistcoat (bodice skinned with the shirt; its skirts
are the soft `skirtL`/`skirtR` halves), a striped cobalt-and-cream sash
knotted at the left hip (its tails are `extra`), a flintlock tucked in
the sash, brass buttons, and the cutlass (`weapon`) in the right fist.
"""
import math

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_pirate_body as B
import figure_pirate_kit as pk
from figure_pirate_body import V, unit, rot


# ------------------------------------------------------------ mesh helpers

def mesh(name, verts, faces, material, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(map(int, f)) for f in faces])
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    if isinstance(material, str):
        obj.data.materials.append(kit.material(material))
    else:
        for m in material:
            obj.data.materials.append(kit.material(m))
    if smooth:
        me.shade_smooth()
    return obj


def grid(name, P, material, closed=False, flip=False):
    """A quad surface from a rows x cols x 3 array; closed wraps the
    columns."""
    P = np.asarray(P, float)
    rows, cols = P.shape[:2]
    verts = P.reshape(-1, 3)
    faces = []
    cc = cols if closed else cols - 1
    for i in range(rows - 1):
        for j in range(cc):
            a = i * cols + j
            b = i * cols + (j + 1) % cols
            f = (a, b, b + cols, a + cols)
            faces.append(tuple(reversed(f)) if flip else f)
    return mesh(name, verts, faces, material)


def fix_normals(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    return obj


def solidify(obj, thickness, offset=-1.0, rim=True):
    mod = obj.modifiers.new("cloth thickness", "SOLIDIFY")
    mod.thickness = thickness
    mod.offset = offset
    mod.use_rim = rim
    mod.use_even_offset = True
    kit.apply(obj)
    return obj


def subdivide(obj, levels=1):
    mod = obj.modifiers.new("smooth", "SUBSURF")
    mod.levels = mod.render_levels = levels
    kit.apply(obj)
    return obj


def tube(name, path, radii, material, seg=12, caps=True, up=(0, 0, 1), flat=1.0, closed=False):
    """A tube along `path` (N x 3) with per-point radius (or (w, d) pairs:
    w across `up`-perpendicular, d along the normal); round caps."""
    path = np.asarray(path, float)
    n = len(path)
    radii = [r if isinstance(r, (tuple, list)) else (r, r * flat) for r in radii]
    verts = []
    upv = np.asarray(up, float)
    prev_side = None
    for i in range(n):
        if closed:
            tan = path[(i + 1) % n] - path[(i - 1) % n]
        else:
            tan = path[min(i + 1, n - 1)] - path[max(i - 1, 0)]
        tan /= np.linalg.norm(tan)
        side = np.cross(tan, upv)
        if np.linalg.norm(side) < 1e-6:
            side = prev_side if prev_side is not None else np.cross(tan, [1, 0, 0])
        side /= np.linalg.norm(side)
        prev_side = side
        nrm = np.cross(side, tan)
        w, d = radii[i]
        for j in range(seg):
            a = math.tau * j / seg
            verts.append(path[i] + side * math.cos(a) * w + nrm * math.sin(a) * d)
    faces = []
    for i in range(n if closed else n - 1):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            a2 = ((i + 1) % n) * seg + j
            b2 = ((i + 1) % n) * seg + (j + 1) % seg
            faces.append((a, b, b2, a2))
    if caps and not closed:
        base = len(verts)
        t0 = path[1] - path[0]
        t1 = path[-1] - path[-2]
        verts.append(path[0] - t0 / np.linalg.norm(t0) * min(radii[0]) * .6)
        verts.append(path[-1] + t1 / np.linalg.norm(t1) * min(radii[-1]) * .6)
        faces += [(base, (j + 1) % seg, j) for j in range(seg)]
        last = (n - 1) * seg
        faces += [(base + 1, last + j, last + (j + 1) % seg) for j in range(seg)]
    return fix_normals(mesh(name, verts, faces, material))


def ellipsoid_mesh(name, centre, radii, R, material, seg=24, rings=12):
    verts = []
    centre = np.asarray(centre, float)
    for i in range(1, rings):
        th = math.pi * i / rings
        for j in range(seg):
            ph = math.tau * j / seg
            local = np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph),
                              math.cos(th)]) * radii
            verts.append(centre + R @ local)
    top = len(verts)
    verts.append(centre + R @ np.array([0, 0, radii[2]]))
    verts.append(centre + R @ np.array([0, 0, -radii[2]]))
    faces = []
    for i in range(rings - 2):
        for j in range(seg):
            a = i * seg + j
            b = i * seg + (j + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    faces += [(top, (j + 1) % seg, j) for j in range(seg)]
    last = (rings - 2) * seg
    faces += [(top + 1, last + j, last + (j + 1) % seg) for j in range(seg)]
    return fix_normals(mesh(name, verts, faces, material))


def torus(name, centre, axis, R, r, material, seg=32, rseg=10):
    axis = unit(axis)
    u = unit(np.cross(axis, [0, 0, 1] if abs(axis[2]) < .9 else [1, 0, 0]))
    v = np.cross(axis, u)
    verts = []
    for i in range(seg):
        a = math.tau * i / seg
        c = np.asarray(centre) + (u * math.cos(a) + v * math.sin(a)) * R
        radial = u * math.cos(a) + v * math.sin(a)
        for j in range(rseg):
            b = math.tau * j / rseg
            verts.append(c + (radial * math.cos(b) + axis * math.sin(b)) * r)
    faces = []
    for i in range(seg):
        for j in range(rseg):
            a = i * rseg + j
            b = i * rseg + (j + 1) % rseg
            c2 = ((i + 1) % seg) * rseg + (j + 1) % rseg
            d = ((i + 1) % seg) * rseg + j
            faces.append((a, b, c2, d))
    return fix_normals(mesh(name, verts, faces, material))


def join(objs, name):
    return kit.join(objs, name)


def uv_simple(obj):
    """A world-scale planar UV set (the shared tiles' relief needs one,
    and kit.drape's `Wave` set must come second)."""
    me = obj.data
    if me.uv_layers:
        return obj
    layer = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        co = me.vertices[loop.vertex_index].co
        layer.data[loop.index].uv = (co.x * 4 + co.y * 2, co.z * 4)
    return obj


# ------------------------------------------------------------------ head

HEAD_C = V(0, -.012, 1.172)


def bandana_edge(theta):
    """World z of the bandana's lower edge at azimuth theta (0 = front)."""
    c = np.cos(theta)
    return 1.2010 - .0030 * np.sin(theta) ** 2 - .038 * np.maximum(0, -c) ** 1.6


def head_rays(theta, z):
    """Unit rays from the head centre towards azimuth theta and height z."""
    r = .085
    e = np.arcsin(np.clip((z - HEAD_C[2]) / r, -.99, .99))
    return np.stack([np.sin(theta) * np.cos(e), np.cos(theta) * np.cos(e), np.sin(e)], -1)


def head_surface(hs, theta, z):
    dirs = head_rays(theta, z)
    flat = dirs.reshape(-1, 3)
    pts = B.project(hs, np.repeat(HEAD_C[None], len(flat), 0), flat, reach=.14)
    nrm = B.gradient(hs, pts)
    return pts.reshape(dirs.shape), nrm.reshape(dirs.shape)


def bandana(hs):
    cols, rows = 96, 22
    th = np.linspace(0, math.tau, cols, endpoint=False)
    T, Rr = np.meshgrid(th, np.linspace(0, 1, rows), indexing="xy")
    z0 = bandana_edge(T)
    Z = z0 + (1.272 - z0) * (1 - (1 - Rr) ** 1.3)
    pts, nrm = head_surface(hs, T, Z)
    knot_th = math.pi + .25
    near_knot = np.exp(-((np.angle(np.exp(1j * (T - knot_th)))) / .55) ** 2) * np.exp(-((Z - 1.165) / .05) ** 2)
    folds = .0021 * np.sin(T * 26 + Rr * 5) * near_knot + .0005 * np.sin(T * 9 + Rr * 7)
    # Soft horizontal ripples where the cloth wraps the forehead and sides.
    folds += .0007 * np.sin(Rr * 22 + T * 2) * np.exp(-(Rr / .45) ** 2)
    off = .0058 + folds + .0020 * near_knot
    P = pts + nrm * off[..., None]
    obj = grid("pirate-bandana", P[:-2], pk.TEAM, closed=True, flip=True)
    mod = obj.modifiers.new("cloth thickness", "SOLIDIFY")
    mod.thickness, mod.offset, mod.use_even_offset = .0022, -1, False
    kit.apply(obj)
    # The rolled lower hem.
    edge = P[0]
    hem = tube("pirate-bandana-hem", edge, [(.0016, .0011)] * cols, pk.TEAM, seg=8, closed=True)
    return [obj, hem], pts, nrm


def bandana_knot_and_tails(hs):
    th = math.pi + .25
    p, n = head_surface(hs, np.array([th]), np.array([1.163]))
    p, n = p[0], n[0]
    K = p + n * .010
    side = unit(np.cross(n, [0, 0, 1]))
    knot = [ellipsoid_mesh("pirate-knot-a", K + side * .007, (.0105, .0080, .0085),
                           frame_of(n, side), pk.TEAM),
            ellipsoid_mesh("pirate-knot-b", K - side * .007 - V(0, 0, .002), (.0095, .0075, .0080),
                           frame_of(n, -side), pk.TEAM)]
    tails = []
    for i, (length, width, swing) in enumerate(((.082, .022, -.35), (.066, .019, .25))):
        rows, cols = 12, 5
        P = np.zeros((rows, cols, 3))
        start = K + side * (.004 if i == 0 else -.004) - V(0, 0, .004)
        for r in range(rows):
            t = r / (rows - 1)
            # Hanging down and back, flaring a little, a soft S.
            d = unit(V(math.sin(swing) * .6, -.45, -1))
            c = start + d * length * t + n * .004 * math.sin(t * math.pi) + \
                side * .006 * math.sin(t * math.pi * 1.6 + i)
            w = width * (.65 + .35 * t)
            across = unit(side * math.cos(swing * t) + n * .25 * math.sin(t * 2.4 + i))
            for c2 in range(cols):
                u = c2 / (cols - 1) - .5
                # The end is cut on the bias.
                cut = (u + .5) * .012 * t ** 6
                P[r, c2] = c + across * u * w + V(0, 0, cut)
        tail = grid(f"pirate-bandana-tail-{i}", P, pk.SASH_TEAM)
        solidify(tail, .0018, offset=0)
        tails.append(tail)
    return knot, tails


def frame_of(n, side):
    n = unit(n)
    side = unit(side - n * (side @ n))
    up = np.cross(n, side)
    return np.stack([side, n, up], 1)


HAT_BASE = V(0, -.011, 1.217)
HAT_TILT = math.radians(6)   # tipped back: the front point lifted


def hat_frame():
    return rot([1, 0, 0], HAT_TILT)


def hat_point(local):
    return HAT_BASE + hat_frame() @ np.asarray(local)


def brim_outline(theta):
    c3 = np.cos(3 * theta)
    return .128 * (1 + .22 * c3 + .10 * np.maximum(0, c3) ** 6)


def hat():
    A, Bb = .0830, .0975     # crown base half-width, half-depth
    Rm = hat_frame()
    # Crown: a rounded dome.
    prof = [(1.0, 0.0), (1.0, .020), (.985, .036), (.94, .052), (.84, .064), (.64, .073),
            (.36, .078), (.0, .0795)]
    cols = 72
    th = np.linspace(0, math.tau, cols, endpoint=False)
    P = []
    for f, z in prof:
        ring = np.stack([A * f * np.sin(th), Bb * f * np.cos(th), np.full(cols, z)], -1)
        # A shallow dent along the top, front to back.
        dent = -.004 * np.exp(-(A * f * np.sin(th) / .02) ** 2) * (z > .06)
        ring[:, 2] += dent
        P.append(ring)
    P = np.array(P)
    P = HAT_BASE + P @ Rm.T
    crown = grid("pirate-hat-crown", P[:-1], pk.FELT, closed=True, flip=True)
    me = crown.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    n = len(prof) - 2
    top = [bm.verts[n * cols + j] for j in range(cols)]
    c = bm.verts.new(tuple(P[-1].mean(0)))
    for j in range(cols):
        bm.faces.new((top[j], top[(j + 1) % cols], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    subdivide(crown, 1)
    # Brim: turned up into three walls; the corners point front and back.
    cols, rows = 144, 16
    th = np.linspace(0, math.tau, cols, endpoint=False)
    rho0 = np.sqrt((A * np.sin(th)) ** 2 + (Bb * np.cos(th)) ** 2) * .985
    Rr = brim_outline(th)
    H = .044 * (1 - .52 * np.cos(3 * th))
    Q = []
    for i in range(rows):
        t = i / (rows - 1)
        rho = rho0 + (Rr - rho0) * np.sin(t * math.pi / 2)
        z = H * (1 - np.cos(t * math.pi / 2)) + .002 - .002 * t
        Q.append(np.stack([rho * np.sin(th), rho * np.cos(th), z], -1))
    Q = np.array(Q)
    Q = HAT_BASE + Q @ Rm.T
    brim = grid("pirate-hat-brim", Q, pk.FELT, closed=True)
    solidify(brim, .0042, offset=0)
    edge = Q[-1]
    trim = tube("pirate-hat-trim", edge, [.0030] * cols, pk.GOLD, seg=8, closed=True)
    return [crown, brim, trim]


def hair(hs):
    cols, rows = 120, 14
    th = np.linspace(-math.pi, math.pi, cols, endpoint=False)
    a = np.degrees(np.abs(th))
    z_top = bandana_edge(th) + .006
    z_low = np.interp(a, [0, 44, 56, 64, 72, 79, 103, 120, 150, 180],
                      [1.21, 1.205, 1.172, 1.152, 1.160, 1.183, 1.183, 1.140, 1.105, 1.092])
    z_low = np.minimum(z_low, z_top - .001)
    T, Rr = np.meshgrid(th, np.linspace(0, 1, rows), indexing="xy")
    Z = z_top + (z_low - z_top) * Rr
    pts, nrm = head_surface(hs, T, Z)
    span = (z_top - z_low)[None, :]
    # Pulled tight back towards the nape: comb ridges along the pull.
    ridge = .00055 * np.sin(T * 70 + Rr * 3) + .00025 * np.sin(T * 151)
    thick = (.0034 + ridge) * np.clip((1 - Rr) * 4, 0, 1) ** .6 * (span > .004)
    P = pts + nrm * thick[..., None]
    obj = grid("pirate-hair", P, pk.HAIR, closed=True, flip=True)
    # Wavy locks escaping the bandana at the temples, in front of the ears.
    curls = []
    for s in (-1, 1):
        for k, (a0, z0, length, r0) in enumerate(((60, 1.199, .034, .0026), (67, 1.197, .026, .0022))):
            ts = np.linspace(0, 1, 14)
            th0 = s * np.radians(a0 + 6 * ts)
            zz = z0 - length * ts
            p, n = head_surface(hs, th0, zz)
            wave = np.sin(ts * math.pi * 2.2 + k) * .0028
            side = np.cross(n, [[0, 0, 1]] * len(ts))
            side /= np.linalg.norm(side, axis=1)[:, None]
            pts_c = p + n * (.0016 + .0008 * np.sin(ts * math.pi))[:, None] + side * wave[:, None] * s
            curls.append(tube(f"pirate-lock-{s}-{k}", pts_c, list(r0 * (1 - .75 * ts) + .0005),
                              pk.HAIR, seg=8))
    # The gather at the nape that feeds the braid.
    gather = ellipsoid_mesh("pirate-hair-gather", V(0, -.0905, 1.106), (.020, .012, .016),
                            np.eye(3), pk.HAIR)
    return [obj, gather] + curls


def braid():
    """Three-strand braid: alternating lobes down the back, a cobalt tie
    and a tuft. Returns the three segments (tail, tail2, tail3)."""
    path = np.array([[0, -.0965, 1.096], [0, -.1045, 1.030], [0, -.1085, .955],
                     [0, -.1100, .870], [0, -.1090, .770]])
    from figure_pirate_sdf import catmull
    dense, length = catmull(path, 200)
    n = 28
    segs = {0: [], 1: [], 2: []}
    core = []
    for i in range(n):
        t = (i + .5) / n * .93
        j = int(t * 200)
        c = dense[j]
        tan = unit(dense[min(j + 1, 200)] - dense[max(j - 1, 0)])
        side = (-1) ** i
        taper = 1 - .32 * t
        back = unit(np.cross(tan, V(1, 0, 0)))
        if back[1] > 0:
            back = -back
        Rl = rot(back, side * math.radians(38)) @ np.stack([V(1, 0, 0), back, -tan], 1)
        lobe = ellipsoid_mesh(f"pirate-braid-lobe-{i}", c + V(side * .0062 * taper, 0, 0),
                              (.0142 * taper, .0088 * taper, .0080 * taper), Rl, pk.HAIR,
                              seg=16, rings=8)
        z = c[2]
        seg = 0 if z > pk.BRAID[1].z else 1 if z > pk.BRAID[2].z else 2
        segs[seg].append(lobe)
    # A core fills between the stitches.
    zs = dense[:, 2]
    for k, (hi, lo) in enumerate(((2.0, pk.BRAID[1].z - .004), (pk.BRAID[1].z + .004, pk.BRAID[2].z - .004),
                                  (pk.BRAID[2].z + .004, dense[int(.95 * 200), 2]))):
        idx = np.flatnonzero((zs <= hi) & (zs >= lo))[::4]
        if len(idx) > 2:
            pts = dense[idx]
            t = idx / 200
            segs[k].append(tube(f"pirate-braid-core-{k}", pts, list(.0074 * (1 - .32 * t)), pk.HAIR,
                                seg=10))
    end = dense[int(.95 * 200)]
    tie = torus("pirate-braid-tie", end, V(0, -.08, 1), .0086, .0036, pk.TEAM, seg=20, rseg=8)
    tuft = []
    for k in range(7):
        ang = (k - 3) * .22
        p0 = end + V(0, 0, -.002)
        pts = [p0 + V(math.sin(ang) * .002, -.001 * math.cos(k), 0),
               p0 + V(math.sin(ang) * .008, -.003, -.016),
               p0 + V(math.sin(ang) * .013, -.002 + .002 * math.sin(k), -.034)]
        from figure_pirate_sdf import catmull as cm
        line, _ = cm(pts, 10)
        tuft.append(tube(f"pirate-tuft-{k}", line, list(np.linspace(.0030, .0006, len(line))),
                         pk.HAIR, seg=6))
    segs[2] += [tie] + tuft
    return [join(segs[k], f"pirate-braid-{k}") for k in range(3)]


def hoops():
    out = []
    for s in (-1, 1):
        c = V(s * .0768, -.0075, 1.1215)
        out.append(torus(f"pirate-hoop-{s}", c, V(1, .15 * s, 0), .0105, .0016, pk.GOLD,
                         seg=28, rseg=8))
    return out


def head_wear():
    hs = B.head_only()
    parts, _, _ = bandana(hs)
    knot, tails = bandana_knot_and_tails(hs)
    out = parts + knot + tails + hat() + hair(hs) + braid() + hoops()
    return out


# ------------------------------------------------------------------ body

import figure_pirate_sdf as S  # noqa: E402
from figure_pirate_sdf import Limb, sstep  # noqa: E402


def interp(z, zs, vs):
    return np.interp(z, zs, vs)


def x_edge(z):
    """Half-width of the waistcoat's open front at height z."""
    return np.interp(z, [.70, .80, .88, .94, .985, 1.02], [.024, .027, .033, .045, .056, .060])


class Field:
    """A numpy field wrapped as an SDF Shape with bounds."""

    def __init__(self, fn, lo, hi):
        self.shape = S.Shape(fn, lo, hi)


def waistcoat_bodice_sculpt():
    ts = B.torso_only()
    inner, outer = .0030, .0088

    def fn(p):
        d = ts.at(p)
        shell = np.maximum(d - outer, inner - d)
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = .0012
        keep = shell
        keep = S.smax(keep, .716 - z, k)                                   # under the sash
        front = np.where(y > 0, x_edge(z) - np.abs(x), -1.0)               # open front
        keep = S.smax(keep, front, k)
        neck = .053 - np.sqrt(x * x + ((y + .016) * 1.05) ** 2)
        keep = S.smax(keep, np.where(z > .965, neck, -1.0), k)            # neck hole
        for s in (-1, 1):
            q = (p - np.array([s * .145, -.012, .933])) / np.array([.050, .068, .082])
            hole = 1 - np.sqrt((q * q).sum(1))
            keep = S.smax(keep, hole * .05, k)                             # armholes
        return keep
    sc = S.Sculpt("pirate waistcoat bodice")
    sc.add(S.Shape(fn, (-.16, -.12, .70), (.16, .13, 1.03)), group="coat", part="torso")
    return sc


SKIRT_PATH = [(0, .002, .420), (0, .000, .600), (0, -.004, .762)]


def skirt_rows():
    zs = [.762, .730, .690, .660, .630, .600, .520, .430]
    return [((z - .42) / .342, w, f, b) for z, w, f, b in zip(
        zs, [.108, .127, .143, .156, .160, .160, .161, .163],
        [.077, .081, .085, .088, .089, .090, .094, .097],
        [.074, .097, .120, .139, .146, .146, .141, .137])]


def skirt_detail(t, ang):
    # Soft flutes falling from the waist, deepest at the hem (t = 0).
    hem = (1 - t) ** 1.6
    return (.0034 * np.sin(ang * 7 + .5) + .0016 * np.sin(ang * 13 + 1.7)) * hem * \
        (1 - .6 * np.maximum(0, np.cos(ang)) ** 4)


def skirt_limb():
    return Limb(SKIRT_PATH, sorted(skirt_rows()), skirt_detail, samples=40,
                caps=(False, False), power=2.0)


def skirt_opening(z):
    return np.interp(z, [.42, .55, .66, .762], [.092, .072, .050, .030])


def waistcoat_skirt_sculpt():
    body = skirt_limb()
    thick = .0052

    def fn(p):
        d = body(p)
        shell = np.maximum(d, -(d + thick))
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        k = .0014
        ang = np.arctan2(x, y + .002)
        hem = .458 + .050 * np.maximum(0, np.cos(ang)) ** 3     # the fronts cut away
        keep = S.smax(shell, z - .760, k)
        keep = S.smax(keep, hem - z, k)
        keep = S.smax(keep, np.where(y > 0, skirt_opening(z) - np.abs(x), -1.0), k)
        keep = S.smax(keep, np.where(y < 0, .0022 - np.abs(x), -1.0), .0006)  # centre back seam
        return keep
    sc = S.Sculpt("pirate waistcoat skirt")
    # Bounds well clear of the widest section: Sculpt culls outside them.
    sc.add(S.Shape(fn, (-.21, -.18, .40), (.21, .14, .78)), group="coat", part="torso")
    return sc


def sdf_object(name, sc, h, material, lo, hi, log=print):
    pts, quads, tris = S.mesh_arrays(sc, h, lo=lo, hi=hi, log=log)
    obj = S.mesh_from_arrays(name, pts, quads, tris)
    obj.data.materials.append(kit.material(material))
    return obj


def surface_on(ts, origins, dirs, reach=.2):
    pts = B.project(ts, origins, dirs, reach=reach)
    return pts, B.gradient(ts, pts)


def waistcoat(log=print):
    bodice = sdf_object("pirate-waistcoat", waistcoat_bodice_sculpt(), .0013, pk.COAT,
                        (-.17, -.12, .70), (.17, .13, 1.03), log)
    skirt = sdf_object("pirate-skirt", waistcoat_skirt_sculpt(), .0014, pk.COAT,
                       (-.21, -.18, .40), (.21, .14, .78), log)
    # Split the skirt into its two halves at the centre back seam.
    halves = []
    for s, side in ((-1, "L"), (1, "R")):
        o = skirt.copy()
        o.data = skirt.data.copy()
        bpy.context.scene.collection.objects.link(o)
        bm = bmesh.new()
        bm.from_mesh(o.data)
        kill = [v for v in bm.verts if v.co.x * s < 0]
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.to_mesh(o.data)
        bm.free()
        o.name = f"pirate-skirt-{side}"
        halves.append(o)
    bpy.data.objects.remove(skirt, do_unlink=True)
    # Brass buttons down both fronts.
    ts = B.torso_only()
    buttons = []
    for s in (-1, 1):
        for z in (.835, .875, .915, .952):
            x = s * (x_edge(z) + .0085)
            o, n = surface_on(ts, np.array([[x * .3, .0, z]]), np.array([unit(V(x * .7, .09, 0))]))
            c = o[0] + n[0] * .0098
            buttons.append(button(f"pirate-coat-button-{s}-{z}", c, n[0], .0052))
    skirt_buttons = {"L": [], "R": []}
    body = skirt_limb()
    for s_, side in ((-1, "L"), (1, "R")):
        for z in (.700, .640):
            x = s_ * (skirt_opening(z) + .010)
            dirn = unit(V(x, .095, 0))
            org = V(0, 0, z)
            lo, hi = 0.0, .3
            for _ in range(40):
                m = (lo + hi) / 2
                if body((org + dirn * m)[None].astype(np.float32))[0] < 0:
                    lo = m
                else:
                    hi = m
            c = org + dirn * lo + dirn * .0020
            skirt_buttons[side].append(button(f"pirate-skirt-button-{side}-{z}", c, dirn, .0050))
    return bodice, buttons, halves, skirt_buttons


def button(name, c, n, r):
    n = unit(n)
    side = unit(np.cross(n, [0, 0, 1]))
    R = np.stack([side, np.cross(n, side) * -1, n], 1)
    o = ellipsoid_mesh(name, c, (r, r, r * .45), R, pk.BRASS, seg=14, rings=6)
    return o


def sash(log=print):
    """The striped sash wound over the waistcoat: a full band with rolled
    edges, diagonal cobalt-and-cream stripes, knotted at the left hip."""
    ts = B.torso_only()
    cols, rows = 128, 12
    z_bot, z_top = .711, .809
    shear = .62                       # columns per row: the stripes' slant
    stripe = 8
    prof_t = np.linspace(0, 1, rows)
    # Cross-section: from tucked under at the bottom, out over the band,
    # back under at the top.
    zc = z_bot + (z_top - z_bot) * (.5 - .5 * np.cos(prof_t * math.pi))
    out = np.sin(prof_t * math.pi) ** .45
    P = np.zeros((rows, cols, 3))
    centre = []
    for i in range(rows):
        th = (np.arange(cols) + i * shear) / cols * math.tau
        dirs = np.stack([np.sin(th), np.cos(th), np.zeros(cols)], 1)
        org = np.tile(V(0, -.004, zc[i]), (cols, 1))
        surf, nrm = surface_on(ts, org, dirs, reach=.2)
        fold = .0016 * np.sin(th * 3 + zc[i] * 60) + .0010 * np.sin(th * 11 - zc[i] * 140)
        knot_bulge = .004 * np.exp(-((np.angle(np.exp(1j * (th + 1.85)))) / .5) ** 2)
        off = .0140 + out[i] * (.0062 + fold + knot_bulge) + (1 - out[i]) * .0005
        P[i] = surf + nrm * off[:, None]
    obj = grid("pirate-sash", P, [pk.TEAM, pk.BAND_CREAM], closed=True, flip=True)
    me = obj.data
    idx = np.array([((j // stripe) % 2) for i in range(rows - 1) for j in range(cols)], dtype=np.int32)
    me.polygons.foreach_set("material_index", idx)
    me.update()
    fix_normals(obj)
    return obj


def stripe_faces(obj, fn):
    me = obj.data
    centres = np.empty(len(me.polygons) * 3)
    me.polygons.foreach_get("center", centres)
    centres = centres.reshape(-1, 3)
    me.polygons.foreach_set("material_index", fn(centres).astype(np.int32))
    me.update()


def sash_knot_and_tails():
    K = pk.V(pk.SASH_KNOT)
    K = np.array(K)
    out_dir = unit(V(-1, .25, 0))
    R = np.stack([unit(V(.25, 1, 0)), out_dir * -1, V(0, 0, 1)], 1)
    knots = []
    for k, (off, r, tilt) in enumerate(((V(0, 0, .010), (.025, .019, .019), .5),
                                          (V(.006, .016, -.012), (.021, .016, .017), -.6))):
        o = ellipsoid_mesh(f"pirate-sash-knot-{k}", K + off + out_dir * .014, r,
                           rot(out_dir, tilt) @ R, [pk.TEAM, pk.BAND_CREAM], seg=24, rings=12)
        stripe_faces(o, lambda c: (np.floor((c[:, 2] * 1.0 + c[:, 1] * .6) / .009) % 2))
        knots.append(o)
    tails = []
    for k, (length, width, swing, dz) in enumerate(((.190, .046, -.10, 0), (.150, .040, .22, -.004))):
        rows, cols = 18, 6
        P = np.zeros((rows, cols, 3))
        start = K + out_dir * .030 + V(.012 * (k - .5), .008 * k, -.014 + dz)
        down = unit(V(-.10 + swing * .3, .05 + .12 * k, -1))
        across = unit(np.cross(down, out_dir))
        for r in range(rows):
            t = r / (rows - 1)
            c = start + down * length * t + out_dir * (.010 * math.sin(t * math.pi) + .022 * t)
            w = width * (.75 + .25 * t)
            twist = rot(down, .35 * math.sin(t * 2.2 + k))
            ac = twist @ across
            for cc in range(cols):
                u = cc / (cols - 1) - .5
                # Diagonal stripes come from shearing the rows along the tail.
                P[r, cc] = c + ac * u * w + down * u * w * .55 + out_dir * .002 * math.cos(u * 6 + t * 9)
        tail = grid(f"pirate-sash-tail-{k}", P, [pk.SASH_TEAM, pk.SASH_CREAM])
        me = tail.data
        idx = np.array([(r // 2) % 2 for r in range(rows - 1) for _ in range(cols - 1)], dtype=np.int32)
        me.polygons.foreach_set("material_index", idx)
        me.update()
        solidify(tail, .0030, offset=0)
        # Fringe at the end.
        fr = []
        for f in range(7):
            u = f / 6 - .5
            b0 = P[-1, 0] + (P[-1, -1] - P[-1, 0]) * (u + .5)
            fr.append(tube(f"pirate-sash-fringe-{k}-{f}", [b0, b0 + down * .010 + out_dir * .001,
                                                           b0 + down * .018],
                           [.0012, .0011, .0007], pk.SASH_CREAM, seg=5))
        tails.append(join([tail] + fr, f"pirate-sash-tails-{k}"))
    return knots, tails


def pistol():
    """A flintlock tucked through the sash at the front left: the barrel
    behind the sash (the muzzle peeks out under it), the lock, guard and a
    curved walnut grip with a brass butt cap rising out of it and leaning
    away from the body, towards her right hand."""
    ts = B.torso_only()
    surf, n = surface_on(ts, np.array([[-.040, 0, .800]]), np.array([unit(V(-.45, 1, 0))]))
    n0 = n[0]
    anchor = surf[0] + n0 * .0118
    X = unit(V(-.18, 0, -1))
    X = unit(X - n0 * (X @ n0) - n0 * .14)       # down the barrel, butt leaning out
    Z = unit(n0 - X * (n0 @ X))
    Y = np.cross(Z, X)

    k = 1.55

    def L(x, y, z=0.0):
        return anchor + (X * x + Y * y + Z * z * .9) * k

    M = np.stack([X, Y, Z], 1)
    parts = []
    parts.append(tube("pirate-pistol-barrel", [L(0, 0), L(.128, 0)], [.0060, .0052], pk.DARKSTEEL,
                      seg=12))
    parts.append(torus("pirate-pistol-muzzle", L(.126, 0), X, .0054, .0015, pk.BRASS, seg=14, rseg=6))
    parts.append(tube("pirate-pistol-forestock", [L(-.004, -.006, -.001), L(.108, -.005, -.001)],
                      [(.0068, .0058), (.0058, .0050)], pk.WOOD, seg=10, up=tuple(Z)))
    # The grip sweeps back and away from the barrel line to the butt.
    from figure_pirate_sdf import catmull
    line, _ = catmull([L(.004, -.007), L(-.020, -.016), L(-.044, -.030), L(-.064, -.044)], 16)
    radii = [(.0070 + .0040 * t, .0062 + .0022 * t) for t in np.linspace(0, 1, len(line))]
    parts.append(tube("pirate-pistol-grip", line, radii, pk.WOOD, seg=12, up=tuple(Z)))
    gdir = unit(line[-1] - line[-4])
    parts.append(ellipsoid_mesh("pirate-pistol-butt", line[-1] + gdir * .005, (.0118, .0145, .0090),
                                np.stack([np.cross(Z, gdir), gdir, Z], 1), pk.BRASS, seg=16, rings=8))
    # Lock plate, frizzen and hammer on the outer side.
    parts.append(ellipsoid_mesh("pirate-pistol-lock", L(.006, -.002, .0055), (.0175, .0062, .0024),
                                M, pk.BRASS, seg=14, rings=6))
    parts.append(tube("pirate-pistol-hammer", [L(-.004, .002, .006), L(-.010, .012, .006),
                                               L(-.004, .019, .006)], [.0026, .0021, .0027],
                      pk.DARKSTEEL, seg=8))
    parts.append(tube("pirate-pistol-frizzen", [L(.014, .002, .005), L(.016, .013, .005)],
                      [.0022, .0018], pk.DARKSTEEL, seg=6))
    # Trigger guard and trigger under the breech.
    parts.append(torus("pirate-pistol-guard", L(.006, -.019), Z, .0085, .0014, pk.BRASS,
                       seg=16, rseg=6))
    parts.append(tube("pirate-pistol-trigger", [L(.004, -.011), L(.009, -.019)], [.0014, .0011],
                      pk.DARKSTEEL, seg=6))
    return join(parts, "pirate-pistol")


def shirt_buttons():
    ts = B.torso_only()
    out = []
    for z in (.835, .885, .935):
        o, n = surface_on(ts, np.array([[0, 0, z]]), np.array([[0, 1.0, 0]]))
        out.append(button(f"pirate-shirt-button-{z}", o[0] + n[0] * .0018, n[0], .0036))
    # The collar's button at the throat.
    c = V(.0042, .0478, 1.030)
    out.append(button("pirate-collar-button", c, unit(V(.05, 1, 0)), .0034))
    return out


# ------------------------------------------------------------------ cutlass

def cutlass():
    """Brass-hilted cutlass: dark wrapped grip, D knuckle bow and a shell
    guard, a broad curved blade with a clipped point; edge forward/down,
    the blade curving back up towards the spine."""
    g = unit(np.array(B.GRIP_DIR))
    d, n, a = B.hand_frame(1)
    u = unit(d - g * (d @ g))            # from the wrist side towards the fingers' wrap
    w = np.cross(g, u)                    # across the blade's flat
    C = np.array(B.FIST)
    parts = []
    # Grip: barrel-shaped, leather wrapped with brass wire bands.
    gl = [C - g * .044, C - g * .020, C + g * .010, C + g * .038]
    parts.append(tube("pirate-cutlass-grip", gl, [(.0098, .0118), (.0108, .0128), (.0108, .0128),
                                                  (.0100, .0120)], pk.GRIP, seg=14, up=tuple(w)))
    for t in np.linspace(-.036, .030, 6):
        parts.append(torus(f"pirate-cutlass-wire-{t:.3f}", C + g * t, g, .0112, .0011, pk.BRASS,
                           seg=16, rseg=5))
    # Pommel and ferrule.
    parts.append(ellipsoid_mesh("pirate-cutlass-pommel", C - g * .050, (.0118, .0118, .0090),
                                np.stack([w, u, g], 1), pk.BRASS, seg=16, rings=8))
    parts.append(torus("pirate-cutlass-ferrule", C + g * .041, g, .0108, .0026, pk.BRASS,
                       seg=16, rseg=6))
    # Knuckle bow round the backs of the fingers.
    bow = [C + g * .046 + u * .010, C + g * .036 + u * .028, C + g * .004 + u * .036,
           C - g * .030 + u * .030, C - g * .049 + u * .010]
    from figure_pirate_sdf import catmull
    line, _ = catmull(bow, 24)
    parts.append(tube("pirate-cutlass-bow", line, [(.0026, .0040)] * len(line), pk.BRASS, seg=8,
                      up=tuple(w)))
    # Shell guard: a dished oval plate at the blade's root.
    G = C + g * .048
    sh = []
    rows, cols = 6, 28
    for i in range(rows):
        r = i / (rows - 1)
        ring_pts = []
        for j in range(cols):
            ang = math.tau * j / cols
            ru, rw = .026 * r, .020 * r
            p = G + u * (math.cos(ang) * ru + .005 * r) + w * math.sin(ang) * rw - g * .017 * r * r
            ring_pts.append(p)
        sh.append(ring_pts)
    shell = grid("pirate-cutlass-shell", np.array(sh), pk.BRASS, closed=True)
    solidify(shell, .0022, offset=0)
    parts.append(shell)
    # Blade: from the guard, curving back towards the spine (-u).
    L = .405
    ns = 34
    secs = []
    for i in range(ns):
        t = i / (ns - 1)
        sdist = .004 + L * t
        centre = G + g * sdist - u * (.20 * sdist ** 2)
        tang = unit(g - u * (.40 * sdist))
        uu = unit(u - tang * (u @ tang))
        width = .031 + .012 * sstep(.0, .75, t) - .005 * sstep(.75, 1, t)
        # The clipped point: the spine sweeps down to the edge at the tip.
        clip = sstep(.80, 1.0, t) ** 1.3
        spine_off = -width * .38 + width * .86 * clip
        edge_off = width * .62
        if i == ns - 1:
            spine_off = edge_off - .0008
        th_sp = .0042 * (1 - .55 * t) * (1 - clip * .8)
        # Profile across: spine (two corners), fuller, flats, bevel, edge.
        prof = [(spine_off, th_sp * .5), (spine_off + (edge_off - spine_off) * .18, th_sp * .46),
                (spine_off + (edge_off - spine_off) * .30, th_sp * .32),
                (spine_off + (edge_off - spine_off) * .42, th_sp * .44),
                (spine_off + (edge_off - spine_off) * .72, th_sp * .38),
                (edge_off, .00025)]
        loop = [centre + uu * o + w * h for o, h in prof] + \
            [centre + uu * o - w * h for o, h in reversed(prof[1:-1])] + \
            [centre + uu * prof[0][0] - w * prof[0][1]]
        secs.append(loop)
    secs = np.array(secs)
    blade = grid("pirate-cutlass-blade", secs, pk.STEEL, closed=True)
    me = blade.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    m = secs.shape[1]
    for ring_i, cap in ((0, G), (ns - 1, None)):
        bm.verts.ensure_lookup_table()
        vs = [bm.verts[ring_i * m + j] for j in range(m)]
        c = bm.verts.new(tuple(np.mean([v.co for v in vs], 0)))
        for j in range(m):
            bm.faces.new((vs[j], vs[(j + 1) % m], c))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    me.update()
    kit.shade(blade, 35)
    parts.append(blade)
    return join(parts, "pirate-cutlass")


# ------------------------------------------------------------------ rig

def bone_table():
    t = {"torso": (pk.WAIST, None), "chest": (pk.CHEST, "torso"), "head": (pk.NECK, "chest"),
         "hat": (pk.HAT, "head"), "hair": (pk.BANDANA_KNOT, "head"),
         "tail": (pk.BRAID[0], "head"), "tail2": (pk.BRAID[1], "tail"),
         "tail3": (pk.BRAID[2], "tail2"),
         "skirtL": (pk.SKIRT[-1], "torso"), "skirtR": (pk.SKIRT[1], "torso"),
         "extra": (pk.SASH_KNOT, "torso"), "weapon": (pk.FIST, "handR")}
    for s, side in pk.SIDES:
        t["clav" + side] = (pk.CLAV[s], "chest")
        t["arm" + side] = (pk.SHOULDER[s], "clav" + side)
        t["fore" + side] = (pk.ELBOW[s], "arm" + side)
        t["hand" + side] = (pk.WRIST[s], "fore" + side)
        t["leg" + side] = (pk.HIP[s], None)
        t["knee" + side] = (pk.KNEE[s], "leg" + side)
        t["foot" + side] = (pk.ANKLE[s], "knee" + side)
    return t


def make_rig(root):
    data = bpy.data.armatures.new("Pirate anatomical joint frames")
    rig = bpy.data.objects.new("pirate.skeleton", data)
    bpy.context.scene.collection.objects.link(rig)
    rig.parent = root
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    table = bone_table()
    for name, (pos, _) in table.items():
        b = data.edit_bones.new(pk.R + name)
        b.head, b.tail = Vector(pos), Vector(pos) + Vector((0, 0, .06))
        b.use_connect = False
    for name, (_, parent) in table.items():
        if parent:
            data.edit_bones[pk.R + name].parent = data.edit_bones[pk.R + parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    rig.show_in_front = True
    data.display_type = "WIRE"
    rig["arenaCommonAxes"] = True
    import json
    rig["anatomicalPivots"] = json.dumps({k: list(v[0]) for k, v in table.items()})
    return rig


SKIN_BONES = ["torso", "chest", "head", "clavL", "clavR", "armL", "foreL", "handL", "armR",
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
    """Joint ownership of every body vertex (columns SKIN_BONES)."""
    N = len(P)
    x, y, z = P.T
    col = {b: i for i, b in enumerate(SKIN_BONES)}
    W = np.zeros((N, len(SKIN_BONES)))
    PARTS = B.PARTS
    trunk = (part == PARTS.index("head")) | (part == PARTS.index("torso"))
    hs = ss(1.018, 1.070, z)
    cs = ss(.800, .935, z)
    # The seat stays with the pelvis longer than the front of the hip.
    back = np.clip((-y - .02) / .04, 0, 1)
    hip = ss(.565 - .065 * back, .665 - .075 * back, z)
    W[:, col["head"]] = hs * trunk
    W[:, col["chest"]] = (1 - hs) * cs * trunk
    W[:, col["torso"]] = (1 - hs) * (1 - cs) * trunk
    side_r = ss(-.028, .028, x)
    for s, side in pk.SIDES:
        share = side_r if s > 0 else 1 - side_r
        lw = (1 - hip) * share * trunk
        W[:, col["leg" + side]] += lw * W[:, col["torso"]]
    W[:, col["torso"]] *= np.where(trunk, hip, 1)
    for s, side in pk.SIDES:
        m = part == PARTS.index("leg" + side)
        kn = 1 - ss(B.KNEE[s][2] - .036, B.KNEE[s][2] + .036, z)
        ft = 1 - ss(B.ANKLE[s][2] - .012, B.ANKLE[s][2] + .034, z)
        W[:, col["torso"]] += m * hip * (1 - kn)
        W[:, col["leg" + side]] += m * (1 - hip) * (1 - kn)
        W[:, col["knee" + side]] += m * kn * (1 - ft)
        W[:, col["foot" + side]] += m * kn * ft
        # Arms.
        m = part == PARTS.index("arm" + side)
        sh, el, wr = B.SHOULDER[s], B.ELBOW[s], B.WRIST[s]
        nE = unit(B.UPPER[s] + B.FOREARM[s])
        d, _, _ = B.hand_frame(s)
        nW = unit(B.FOREARM[s] + d)
        fore = ss(-.028, .026, (P - el) @ nE)
        hand = ss(-.013, .015, (P - wr) @ nW)
        own = ss(-.032, .030, (P - sh) @ B.UPPER[s])
        W[:, col["arm" + side]] += m * own * (1 - fore)
        W[:, col["fore" + side]] += m * fore * (1 - hand)
        W[:, col["hand" + side]] += m * fore * hand
        W[:, col["clav" + side]] += m * (1 - own) * (1 - fore) * .65
        W[:, col["chest"]] += m * (1 - own) * (1 - fore) * .35
        # The trapezius, the top of the chest and back by the shoulder ride
        # with the clavicle; the skin right at the joint with the arm.
        clav = ss(.040, .118, s * x) * ss(.900, .985, z) * trunk * .75
        moved = W[:, col["chest"]] * clav
        W[:, col["chest"]] -= moved
        W[:, col["clav" + side]] += moved
        near = np.exp(-(np.linalg.norm(P - sh, axis=1) / .036) ** 2) * ss(.112, .142, s * x) * trunk
        for b in ("chest", "clav" + side, "torso"):
            mv = W[:, col[b]] * near * .6
            W[:, col[b]] -= mv
            W[:, col["arm" + side]] += mv
    total = W.sum(1)
    W[total < 1e-6, col["torso"]] = 1
    W /= W.sum(1)[:, None]
    return W


def write_weights(obj, W, names, step=1000):
    groups = {n: obj.vertex_groups.get(pk.R + n) or obj.vertex_groups.new(name=pk.R + n)
              for n in names}
    for k, n in enumerate(names):
        q = np.rint(np.clip(W[:, k], 0, 1) * step).astype(np.int64)
        idx = np.flatnonzero(q > 0)
        if not len(idx):
            continue
        order = idx[np.argsort(q[idx])]
        cuts = np.flatnonzero(np.diff(q[order])) + 1
        for batch in np.split(order, cuts):
            groups[n].add(batch.tolist(), float(q[batch[0]]) / step, "REPLACE")


def weight_body(obj, rig, log=print):
    P = pk.np_coords(obj)
    part = np.empty(len(P), dtype=np.int8)
    obj.data.attributes["pirate_part"].data.foreach_get("value", part)
    W = body_weight_matrix(P, part)
    edges = mesh_edges(obj)
    arm = np.isin(part, [B.PARTS.index("armL"), B.PARTS.index("armR")])
    cross = (arm[edges[:, 0]] != arm[edges[:, 1]]) & (P[edges[:, 0], 2] < .86)
    log(f"arm/body contacts below the shoulder: {int(cross.sum())} edges")
    W = smooth_weights(W, edges, len(P), iterations=12)
    W /= W.sum(1)[:, None]
    write_weights(obj, W, SKIN_BONES)
    obj["bodyWeights"] = json.dumps(dict(zip(SKIN_BONES, W.sum(0).round(1).tolist())))
    log("weights: " + obj["bodyWeights"])
    skin_to(obj, rig)
    return W


def skin_to(obj, rig):
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.parent_type = "OBJECT"
    obj.matrix_world = world
    mod = obj.modifiers.new("Linear anatomical skin", "ARMATURE")
    mod.object = rig
    mod.use_deform_preserve_volume = False


def transfer_weights(target, body, W, part, allowed_parts, k=4):
    """Skin a garment from the nearest body vertices of the allowed parts."""
    from mathutils.kdtree import KDTree
    P = pk.np_coords(body)
    mask = np.isin(part, [B.PARTS.index(p) for p in allowed_parts])
    idx = np.flatnonzero(mask)
    tree = KDTree(len(idx))
    for i, j in enumerate(idx):
        tree.insert(P[j], i)
    tree.balance()
    T = pk.np_coords(target)
    out = np.zeros((len(T), W.shape[1]))
    for i, p in enumerate(T):
        hits = tree.find_n(p, k)
        ws = np.array([1 / max(h[2], 1e-5) for h in hits])
        rows = W[[idx[h[1]] for h in hits]]
        out[i] = (rows * ws[:, None]).sum(0) / ws.sum()
    out /= np.maximum(out.sum(1), 1e-9)[:, None]
    write_weights(target, out, SKIN_BONES)
    return out


def bone_attach(o, rig, name):
    kit.refresh()
    world = o.matrix_world.copy()
    o.parent = rig
    o.parent_type = "BONE"
    o.parent_bone = pk.R + name
    o.matrix_world = world
    return o


def attach_faces(pieces, rig):
    import re
    groups = {}
    for o in pieces:
        key = None
        m = re.fullmatch(r"pirate-(eye|iris|pupil|glint|brow)-(-?1)", o.name)
        if m:
            label, s = m.groups()
            side = "L" if s == "-1" else "R"
            key = {"eye": "eye", "iris": "pupil", "pupil": "pupil", "glint": "pupil",
                   "brow": "brow"}[label] + side
        elif o.name.startswith(("pirate-mouth", "pirate-teeth", "pirate-tongue")):
            key = "mouth"
        groups.setdefault(key, []).append(o)
    nodes = {}
    for key in ("eyeL", "eyeR", "browL", "browR", "mouth", "pupilL", "pupilR"):
        objs = groups.get(key)
        if not objs:
            continue
        o = kit.join(objs, pk.R + key) if len(objs) > 1 else objs[0]
        o.name = pk.R + key
        kit.apply_transform(o)
        pts = pk.np_coords(o)
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
            o.parent, o.parent_type, o.parent_bone = rig, "BONE", pk.R + "head"
        o.matrix_world = frame
        o["faceWidth"], o["faceHeight"] = max(.005, float(size[0])), max(.002, float(size[2]))
        nodes[key] = o
        kit.refresh()
    rig["faceContract"] = "pirateeyeL/R -> piratepupilL/R; piratebrowL/R; piratemouth; centred surface frames"
    return nodes


def drape_part(obj):
    uv_simple(obj)
    kit.drape(obj)
    return obj


import json  # noqa: E402


def assemble(body_object, log=print):
    import figure_pirate_face as face
    root = kit.empty(pk.R)
    body = body_object()
    rig = make_rig(root)
    W = weight_body(body, rig, log)
    part = np.empty(len(body.data.vertices), dtype=np.int8)
    body.data.attributes["pirate_part"].data.foreach_get("value", part)
    hs = B.head_only()
    attach_faces(face.controls(hs), rig)
    log("face controls attached")
    # Head wear.
    parts, _, _ = bandana(hs)
    for o in parts:
        bone_attach(o, rig, "head")
    knot, tails = bandana_knot_and_tails(hs)
    for o in knot:
        bone_attach(o, rig, "head")
    for o in tails:
        drape_part(o)
        bone_attach(o, rig, "hair")
    for o in hat():
        bone_attach(o, rig, "hat")
    for o in hair(hs):
        bone_attach(o, rig, "head")
    for o, b in zip(braid(), ("tail", "tail2", "tail3")):
        bone_attach(o, rig, b)
    for o in hoops():
        bone_attach(o, rig, "head")
    log("head wear attached")
    # Waistcoat: the bodice skinned with the torso, the skirts on their bones.
    bodice, buttons, halves, skirt_buttons = waistcoat(log)
    bodice = join([bodice] + buttons, "pirate-waistcoat")
    transfer_weights(bodice, body, W, part, ("torso", "head"))
    skin_to(bodice, rig)
    for o, side in zip(halves, ("L", "R")):
        o = join([o] + skirt_buttons[side], f"pirate-skirt-{side}")
        bone_attach(o, rig, "skirt" + side)
    log("waistcoat attached")
    s = sash(log)
    bone_attach(s, rig, "torso")
    knots, stails = sash_knot_and_tails()
    for o in knots:
        bone_attach(o, rig, "torso")
    for o in stails:
        drape_part(o)
        bone_attach(o, rig, "extra")
    bone_attach(pistol(), rig, "torso")
    for o in shirt_buttons():
        bone_attach(o, rig, "chest")
    bone_attach(cutlass(), rig, "weapon")
    log("sash, pistol, buttons and cutlass attached")
    root["masterBrief"] = "work/arena/2026-10-08-roster/pirate/review.md"
    root["skinContract"] = "continuous linear skin; common joint axes; named bone attachments"
    root["unoptimized"] = True
    kit.refresh()
    return root
