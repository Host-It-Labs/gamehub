"""The Cadets' two heads (9 October 2026): him (look A) and her (look B).

Both are signed-distance sculpts (figure_archers_sdf.py) in one shared
frame: the cranium, brow ridge, eye openings, nose bridge, mouth line and
neck are common, so the shared face controls (eyes, irises, brows and the
mouth slit) sit right on either face; the jaw, cheeks, nose, lips, chin
and hair are each look's own.

- Him: a broad square jaw and chin, a strong brow, a straight nose with a
  firm tip, thin lips set hard, short sides and a side-parted pompadour.
- Her: a narrower jaw tapering to a soft chin, high cheekbones, a smaller
  upturned nose, fuller painted lips, a chin-length bob with a deep side
  part, curling under at the ends.

The face looks a little down along the gun with a focused squint: the
upper lids cover the top of the irises, the lower lids are lifted, the
brows are drawn down to the nose.

+Y forward, Z up, metres. Pure numpy apart from the control meshes
(`controls()`, Blender).
"""
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import figure_archers_sdf as S  # noqa: E402
from figure_archers_sdf import (arc_tube, capsule, ellipsoid, frame, gauss, limb, ring,  # noqa: E402
                                round_cone, sstep, tube, vec)

TAU = math.tau


def V(*a):
    return np.array(a, dtype=float)


def unit(v):
    v = np.asarray(v, dtype=float)
    return v / np.linalg.norm(v)


HC = V(0, .000, 1.132)            # head centre (between the ears)
CHIN_Z = 1.030
CROWN_Z = 1.226
EYE = {s: V(s * .0290, .0612, 1.1328) for s in (-1, 1)}
EYE_RADII = (.0150, .0112, .0126)
LID_UPPER = (.0040, .0215)        # lid height over the eye's centre, arc radius
LID_LOWER = (-.0050, .0230)
LID_TILT = math.radians(4)
MOUTH = V(0, .0820, 1.0705)       # centre of the closed mouth's line
MOUTH_HALF = .0190


def eye_frame(s):
    """Columns: x outward (away from the nose), y the gaze (a touch outward
    of straight ahead and a little down, along the gun), z up."""
    gaze = unit(V(s * .10, 1, -.08))
    return frame(x_axis=vec((s, -s * .10, 0)), y_axis=gaze)


def almond(s, grow=0.0):
    """The lid aperture as a 2D distance (negative inside), extruded along
    the gaze."""
    c = EYE[s].astype(np.float32)
    R = eye_frame(s).astype(np.float32)
    up_h, up_r = LID_UPPER
    lo_h, lo_r = LID_LOWER
    ct, st = math.cos(LID_TILT), math.sin(LID_TILT)

    def fn(p):
        q = (p - c) @ R
        x, z = q[:, 0], q[:, 2]
        xr = x * ct - z * st
        zr = x * st + z * ct
        du = np.sqrt(xr ** 2 + (zr - (up_h - up_r)) ** 2) - up_r
        dl = np.sqrt(xr ** 2 + (zr - (lo_h + lo_r)) ** 2) - lo_r
        return np.maximum(du, dl) - grow
    return fn


def face_y(x):
    """How far the face's front falls back with |x| at mouth height."""
    return -10.0 * x * x


def mouth_line(x, look):
    """The closed mouth's line (z) at x: set hard, the corners turned a
    touch down."""
    u = np.clip(np.abs(x) / MOUTH_HALF, 0, 1)
    return MOUTH[2] - .0024 * u ** 2.2 + .0004 * gauss(u, 0, .25)


# ------------------------------------------------------------------ head

def skull(sc, look):
    P = "head"
    # The cranium and the face block, smoothly joined.
    sc.add(ellipsoid((0, -.012, 1.156), (.0690, .0835, .0800)), group="skin", part=P)
    sc.add(ellipsoid((0, .022, 1.104), (.0590, .0545, .0610)), k=.030, group="skin", part=P)
    # The side of the face, jaw ramus up to the ear: flat, not hollow.
    for s in (-1, 1):
        sc.add(ellipsoid((s * .0470, -.006, 1.103), (.0180, .0380, .0360)), k=.028, group="skin",
               part=P)
    # Forehead: broad and upright.
    sc.add(ellipsoid((0, .040, 1.175), (.0520, .0300, .0380)), k=.026, group="skin", part=P)
    # Brow ridge (shared: the brows are shared controls).
    for s in (-1, 1):
        sc.add(capsule((s * .0110, .0675, 1.1508), (s * .0440, .0565, 1.1555), .0090), k=.016,
               group="skin", part=P)
    sc.add(ellipsoid((0, .0690, 1.1480), (.0110, .0070, .0080)), k=.012, group="skin", part=P)


def lower_face(sc, look):
    P = "head"
    if look == "A":
        # A broad square jaw: the jaw line to a defined angle under each
        # ear, a strong chin block with a faint cleft.
        for s in (-1, 1):
            sc.add(round_cone((s * .0480, -.010, 1.072), (s * .0170, .0560, 1.040), .0118, .0125),
                   k=.026, group="skin", part=P)
            sc.add(ellipsoid((s * .0460, .028, 1.118), (.0200, .0200, .0150),
                             frame(x_axis=(s, -.35, 0), y_axis=(s * .35, 1, 0))), k=.022,
                   group="skin", part=P)
        sc.add(S.rounded_box((0, .0605, 1.0395), (.0215, .0130, .0135), .0110), k=.016, group="skin",
               part=P)
        sc.cut(capsule((0, .0738, 1.0330), (0, .0745, 1.0440), .0012), k=.004, group="skin")
        # Mouth area: a firm philtrum and muzzle.
        sc.add(ellipsoid((0, .0640, 1.0760), (.0255, .0190, .0200)), k=.020, group="skin", part=P)
    else:
        # A narrower jaw tapering to a soft rounded chin; high cheekbones.
        for s in (-1, 1):
            sc.add(round_cone((s * .0440, -.008, 1.078), (s * .0120, .0530, 1.044), .0100, .0102),
                   k=.026, group="skin", part=P)
            sc.add(ellipsoid((s * .0440, .032, 1.124), (.0205, .0195, .0140),
                             frame(x_axis=(s, -.40, 0), y_axis=(s * .40, 1, 0))), k=.020,
                   group="skin", part=P)
        sc.add(ellipsoid((0, .0590, 1.0420), (.0160, .0135, .0135)), k=.016, group="skin", part=P)
        sc.add(ellipsoid((0, .0630, 1.0770), (.0235, .0180, .0195)), k=.020, group="skin", part=P)


def eyes_cut(sc):
    """The almond openings cut through the face to the eyeball (a separate
    control fills each), a heavy upper lid fold and a soft lower lid."""
    P = "head"
    for s in (-1, 1):
        R = eye_frame(s)
        ap = almond(s)
        c, Rf = EYE[s].astype(np.float32), R.astype(np.float32)

        def opening(p, ap=ap, c=c, Rf=Rf):
            y = ((p - c) @ Rf)[:, 1]
            return np.maximum(ap(p), -(y + .0035))
        sc.cut(S.Shape(opening, EYE[s] - .03, EYE[s] + .03), k=.0015, group=None)
        fold = [EYE[s] + R @ V(-.0130, .0068, .0060), EYE[s] + R @ V(0, .0095, .0080),
                EYE[s] + R @ V(.0152, .0058, .0062)]
        sc.add(arc_tube(fold, [.0014, .0022, .0012]), k=.0045, group="skin", part=P)
        lower = [EYE[s] + R @ V(-.0108, .0088, -.0058), EYE[s] + R @ V(0, .0104, -.0068),
                 EYE[s] + R @ V(.0128, .0074, -.0050)]
        sc.add(arc_tube(lower, [.0011, .0018, .0010]), k=.0040, group="skin", part=P)


def nose(sc, look):
    P = "head"
    if look == "A":
        # Straight bridge, a firm rounded tip, full wings.
        sc.add(round_cone((0, .0725, 1.1440), (0, .0870, 1.1110), .0048, .0060), k=.010, group="skin",
               part=P)
        sc.add(ellipsoid((0, .0880, 1.1040), (.0100, .0082, .0082)), k=.0075, group="skin", part=P)
        wing, nost = (.0120, .0805, 1.0990), (.0068, .0850, 1.0960)
        wr = (.0072, .0066, .0060)
    else:
        # Smaller, the tip lifted a touch.
        sc.add(round_cone((0, .0720, 1.1430), (0, .0840, 1.1130), .0040, .0050), k=.010, group="skin",
               part=P)
        sc.add(ellipsoid((0, .0855, 1.1070), (.0082, .0070, .0070)), k=.0070, group="skin", part=P)
        wing, nost = (.0098, .0790, 1.1020), (.0056, .0830, 1.0990)
        wr = (.0060, .0056, .0052)
    for s in (-1, 1):
        R = frame(x_axis=(s, -.30, 0), y_axis=(s * .30, 1, 0))
        sc.add(ellipsoid((s * wing[0], wing[1], wing[2]), wr, R), k=.0055, group="skin", part=P)
        sc.cut(ellipsoid((s * nost[0], nost[1], nost[2]), (.0026, .0022, .0014)), k=.0012,
               group="skin")


def lips(sc, look):
    """A closed mouth set hard: the upper lip's bow, the fuller lower lip,
    the line between them carved (the dark `mouth` control sits in it)."""
    P = "head"
    xs = np.linspace(-MOUTH_HALF * 1.05, MOUTH_HALF * 1.05, 15)
    line = mouth_line(xs, look)
    u = np.abs(xs) / MOUTH_HALF
    group = "lip" if look == "B" else "skin"
    full = 1.35 if look == "B" else 1.0
    upper = [V(x, MOUTH[1] + face_y(x) + .0002, z + .0027 * full - .0008 * uu)
             for x, z, uu in zip(xs, line, u)]
    lower = [V(x, MOUTH[1] + face_y(x) + .0001, z - .0034 * full + .0012 * uu)
             for x, z, uu in zip(xs, line, u)]
    sc.add(arc_tube(upper, list((.0012 + .0016 * (1 - u ** 2)) * full)), k=.0040, group=group, part=P)
    sc.add(arc_tube(lower, list((.0016 + .0024 * (1 - u ** 2)) * full)), k=.0045, group=group, part=P)
    # The line between the lips, and a soft groove under the lower lip.
    cut = [V(x, MOUTH[1] + face_y(x) + .002, z) for x, z in zip(xs, line)]
    sc.cut(arc_tube(cut, list(.0007 + .0004 * (1 - u ** 2))), k=.0012, group=None)
    sc.cut(capsule((-.009, MOUTH[1] - .0010, MOUTH[2] - .0090), (.009, MOUTH[1] - .0010, MOUTH[2] - .0090),
                   .0018), k=.0045, group="skin")
    # The philtrum.
    for s in (-1, 1):
        sc.add(capsule((s * .0035, MOUTH[1] + .0002, MOUTH[2] + .0040),
                       (s * .0028, MOUTH[1] + .0008, MOUTH[2] + .0150), .0012), k=.004, group="skin",
               part=P)


def ears(sc, look):
    P = "head"
    for s in (-1, 1):
        R = frame(x_axis=(s, .12, 0), z_axis=(0, -.22, 1))
        c = V(s * .0670, -.010, 1.1220)
        sc.add(ellipsoid(c, (.0068, .0148, .0222), R), k=.0055, group="skin", part=P)
        sc.cut(ellipsoid(c + V(s * .0055, .0022, -.0008), (.0032, .0080, .0114), R), k=.0022,
               group="skin")
        sc.add(ellipsoid(c + V(s * .0011, .0036, -.0182), (.0042, .0053, .0057), R), k=.004,
               group="skin", part=P)


def neck(sc):
    P = "head"
    sc.add(limb([(0, -.016, .968), (0, -.012, 1.020), (0, -.006, 1.078)],
                [(0, .0400, .0390, .0430), (.5, .0368, .0362, .0405), (1, .0360, .0352, .0395)]),
           k=.016, group="skin", part=P)


# ------------------------------------------------------------------ hair

def hairline_mask(front_z, temple_z, back_z, side_drop=0.0):
    """Hair only above a line round the head: front_z at the forehead,
    temple_z at the temples, back_z at the nape (negative = inside)."""
    def fn(p):
        x, y, z = p[:, 0] - HC[0], p[:, 1] - HC[1], p[:, 2]
        ang = np.arctan2(x, y)          # 0 front, +-pi back
        a = np.abs(ang)
        line = np.where(a < 1.25, front_z + (temple_z - front_z) * sstep(0.0, 1.25, a) ** 1.2,
                        temple_z + (back_z - temple_z) * sstep(1.25, 2.6, a) - side_drop * gauss(a, 1.55, .25))
        return line - z
    return fn


def hair_him(sc):
    """Short tidy sides and back, a side-parted pompadour swept up and back
    from the forehead (the part on his left)."""
    P = "head"
    cap = ellipsoid((0, -.010, 1.162), (.0745, .0900, .0790))
    mask = S.Shape(hairline_mask(1.188, 1.150, 1.096, side_drop=.018))
    # The ears stay clear.
    def ear_clear(p):
        d = np.full(len(p), 1.0)
        for s in (-1, 1):
            c = V(s * .0670, -.010, 1.1220)
            q = p - c
            d = np.minimum(d, np.sqrt((q[:, 0] / 1.6) ** 2 + (q[:, 1] / 1.0) ** 2 + (q[:, 2] / 1.15) ** 2) - .024)
        return -d
    sc.add(S.intersect(cap, mask, S.Shape(ear_clear), k=.004), k=.004, group="hair", part=P)
    # The pompadour: a full wave lifted over the forehead, highest a little
    # right of the part, rolling back over the crown.
    sc.add(ellipsoid((.008, .030, 1.214), (.052, .046, .026),
                     frame(x_axis=(1, 0, 0), y_axis=(0, 1, .25))), k=.016, group="hair", part=P)
    sc.add(ellipsoid((.010, .058, 1.200), (.042, .022, .020),
                     frame(x_axis=(1, .05, 0), y_axis=(0, 1, .55))), k=.012, group="hair", part=P)
    sc.add(ellipsoid((.000, -.012, 1.222), (.058, .062, .020)), k=.020, group="hair", part=P)
    # The part on his left, combed grooves sweeping up and back to his right.
    part_line = [V(-.026, .052, 1.205), V(-.030, .010, 1.226), V(-.028, -.040, 1.222)]
    sc.cut(arc_tube(part_line, [.0016, .0018, .0014]), k=.0016, group="hair")
    for i, off in enumerate(np.linspace(-.016, .046, 8)):
        lift = .012 * gauss(off, .012, .03)
        pts = [V(off - .006, .068 - abs(off) * .2, 1.196 + lift * .4), V(off + .002, .040, 1.226 + lift),
               V(off + .010, .002, 1.236 + lift * .5), V(off + .012, -.040, 1.226)]
        sc.cut(arc_tube(pts, [.0011, .0014, .0013, .0010]), k=.0014, group="hair")
    for s in (-1, 1):
        for i, z in enumerate(np.linspace(1.112, 1.180, 5)):
            pts = [V(s * .072, .030, z), V(s * .078, -.020, z + .006), V(s * .066, -.068, z + .010)]
            sc.cut(arc_tube(pts, [.0009, .0011, .0009]), k=.0012, group="hair")


def hair_her(sc):
    """A chin-length bob with a deep side part on her left, swept across
    the forehead, full at the sides and curling under at the ends."""
    P = "head"
    shell = ellipsoid((0, -.012, 1.150), (.0820, .0960, .0880))
    # The face's opening: the hair frames the face from the temples down to
    # the jaw, the fringe swept across the forehead.
    def face_open(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        fringe = 1.176 + .016 * sstep(-.02, .05, x) - .010 * gauss(x, -.020, .020)
        width = .053 - .006 * sstep(1.06, 1.14, z)
        # Inside the window (negative): within the width, below the fringe
        # and in front. The fringe term had its sign flipped, so the shell
        # covered her whole face below the fringe (9 October).
        opening = np.maximum(np.maximum(np.abs(x) - width, z - fringe), -(y - .005))
        return -opening
    lower = S.half_space((0, 0, 1.050), (0, .25, -1))
    sc.add(S.intersect(shell, S.Shape(face_open), lower, k=.004), k=.006, group="hair", part=P)
    # Volume at the crown and the side part's swell.
    # Both volumes stay above the fringe line: unclipped and widely blended
    # they spilled hair over her brow and eyes (9 October).
    above = S.half_space((0, 0, 1.180), (0, 0, -1))
    sc.add(S.intersect(ellipsoid((.012, -.004, 1.214), (.064, .074, .028)), above, k=.003),
           k=.010, group="hair", part=P)
    sc.add(S.intersect(ellipsoid((.030, .040, 1.196), (.050, .040, .024),
                                 frame(x_axis=(1, 0, -.2), y_axis=(0, 1, .2))), above, k=.003),
           k=.008, group="hair", part=P)
    # The ends curling under round the jaw and nape.
    for s in (-1, 1):
        # Tucked into the shell's hem rather than loops beside the chin.
        sc.add(arc_tube([V(s * .082, -.018, 1.062), V(s * .084, -.030, 1.058), V(s * .078, -.060, 1.060),
                         V(s * .040, -.098, 1.064), V(0, -.104, 1.066)],
                        [.007, .010, .011, .010, .009]), k=.012, group="hair", part=P)
    # The part on her left and waves combed from it.
    sc.cut(arc_tube([V(-.024, .056, 1.205), V(-.028, .010, 1.230), V(-.026, -.050, 1.224)],
                    [.0014, .0018, .0014]), k=.0016, group="hair")
    for i, off in enumerate(np.linspace(-.012, .060, 7)):
        # Grooves stay on the fringe, above its edge: carried down to 1.13
        # they cut hair-coloured streaks across her brow and eyes (9 Oct).
        pts = [V(-.024, .056 - i * .004, 1.207), V(off * .6, .062, 1.204 - i * .002),
               V(off, .056, 1.196 + .004 * (off > .03))]
        sc.cut(arc_tube(pts, [.0010, .0013, .0013, .0010]), k=.0014, group="hair")
    for s in (-1, 1):
        for i, a in enumerate(np.linspace(1.05, 2.6, 7)):  # sides only, off the cheeks
            top = V(s * .060 * math.sin(a) * 1.1, -.012 + .080 * math.cos(a), 1.215)
            mid = V(s * .088 * math.sin(a), -.012 + .098 * math.cos(a), 1.130)
            low = V(s * .086 * math.sin(a), -.012 + .094 * math.cos(a), 1.072)
            sc.cut(arc_tube([top, mid, low], [.0010, .0013, .0011]), k=.0015, group="hair")


def sculpt(look):
    sc = S.Sculpt(f"cadet head {look}")
    skull(sc, look)
    lower_face(sc, look)
    eyes_cut(sc)
    nose(sc, look)
    lips(sc, look)
    ears(sc, look)
    neck(sc)
    if look == "A":
        hair_him(sc)
    else:
        hair_her(sc)
    return sc


GROUPS = ["skin", "lip", "hair"]
REGION = ((-.105, -.125, .962), (.105, .118, 1.250))


def build_arrays(look, h=.0009, log=print):
    sc = sculpt(look)
    lo, hi = REGION
    points, quads, tris = S.mesh_arrays(sc, h, lo=lo, hi=hi, log=log)
    faces = np.concatenate([quads, np.c_[tris, tris[:, 2:3]]]) if len(tris) else quads
    tri_mask = np.r_[np.zeros(len(quads), bool), np.ones(len(tris), bool)]
    corners = points[faces]
    centres = np.where(tri_mask[:, None], corners[:, :3].mean(1), corners.mean(1))
    groups = sc.classify(centres, GROUPS, "group")
    # A clean hairline instead of nearest-primitive labels, which left
    # jagged skin/hair patches where the surfaces blend (9 October).
    groups = np.where(groups == GROUPS.index("lip"), groups, hairline(look, centres))
    return dict(points=points, quads=quads, tris=tris, groups=groups)


def hairline(look, centres):
    """Hair or skin for each face centre from the look's own hairline."""
    skin, hair = GROUPS.index("skin"), GROUPS.index("hair")
    x, y, z = centres[:, 0], centres[:, 1], centres[:, 2]
    if look == "A":
        above = hairline_mask(1.188, 1.150, 1.096, side_drop=.018)(centres) < 0
        ears = np.zeros(len(centres), bool)
        for s in (-1, 1):
            q = centres - V(s * .0670, -.010, 1.1220)
            ears |= np.sqrt((q[:, 0] / 1.6) ** 2 + q[:, 1] ** 2 + (q[:, 2] / 1.15) ** 2) < .026
        return np.where(above & ~ears, hair, skin)
    # Her bob: everything above the hem, except the face window below the
    # swept fringe.
    fringe = 1.176 + .016 * sstep(-.02, .05, x) - .010 * gauss(x, -.020, .020)
    width = .053 - .006 * sstep(1.06, 1.14, z)
    window = (np.abs(x) < width) & (z < fringe) & (y > .005)
    above_hem = z > 1.052 + .25 * y
    return np.where(above_hem & ~window, hair, skin)


def project(sc, origins, dirs, reach=.06, steps=36):
    origins = np.asarray(origins, float)
    dirs = np.asarray(dirs, float)
    lo = np.zeros(len(origins))
    hi = np.full(len(origins), reach)
    for _ in range(steps):
        mid = (lo + hi) / 2
        inside = sc.at(origins + dirs * mid[:, None]) < 0
        lo = np.where(inside, mid, lo)
        hi = np.where(inside, hi, mid)
    return origins + dirs * ((lo + hi) / 2)[:, None]


def gradient(sc, p, e=.0006):
    p = np.asarray(p, float)
    g = np.zeros_like(p)
    for j in range(3):
        d = np.zeros(3)
        d[j] = e
        g[:, j] = sc.at(p + d) - sc.at(p - d)
    return g / np.maximum(np.linalg.norm(g, axis=1), 1e-9)[:, None]


# ------------------------------------------------------------------ controls (Blender)

def _mesh(name, verts, faces, material):
    import bpy
    import kit
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(map(float, v)) for v in verts], [], [tuple(map(int, f)) for f in faces])
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(kit.material(material))
    me.shade_smooth()
    return obj


def _recalc(obj):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.shade_smooth()
    return obj


def grid_faces(rows, cols, closed=False):
    faces = []
    cc = cols if closed else cols - 1
    for i in range(rows - 1):
        for j in range(cc):
            a = i * cols + j
            b = i * cols + (j + 1) % cols
            faces.append((a, b, b + cols, a + cols))
    return faces


def ellipsoid_mesh(name, centre, radii, R, material, seg=32, rings=16):
    verts = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        for j in range(seg):
            ph = TAU * j / seg
            local = np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph),
                              math.cos(th)]) * radii
            verts.append(np.asarray(centre) + R @ local)
    return _recalc(_mesh(name, verts, grid_faces(rings + 1, seg, closed=True), material))


def eye_disc(name, s, radius, lift, material, offset=(0.0, 0.0), rings=8, seg=32):
    """A disc conforming to the eyeball's front, centred at `offset`
    (x outward, z up in the eye's frame)."""
    R = eye_frame(s)
    rx, ry, rz = (r + lift for r in EYE_RADII)
    pts = []
    ox, oz = offset
    for i in range(rings + 1):
        rho = radius * i / rings
        for j in range(seg if i else 1):
            th = TAU * j / seg
            x, z = ox + rho * math.cos(th), oz + rho * math.sin(th)
            y = ry * math.sqrt(max(0.0, 1 - (x / rx) ** 2 - (z / rz) ** 2))
            pts.append(EYE[s] + R @ np.array([x, y, z]))
    faces = [(0, 1 + (j + 1) % seg, 1 + j) for j in range(seg)]
    for i in range(1, rings):
        a0 = 1 + (i - 1) * seg
        a1 = 1 + i * seg
        for j in range(seg):
            faces.append((a0 + j, a0 + (j + 1) % seg, a1 + (j + 1) % seg, a1 + j))
    return _mesh(name, pts, faces, material)


def eyes(pal):
    out = []
    for s in (-1, 1):
        R = eye_frame(s)
        ball = ellipsoid_mesh(f"cadet-eye-{s}", EYE[s], np.array(EYE_RADII), R, pal["EYE"])
        # The gaze converges a touch on the target ahead, a little down.
        look = (-.0012, -.0004)
        iris = eye_disc(f"cadet-iris-{s}", s, .0074, .00030, pal["IRIS"], look)
        pupil = eye_disc(f"cadet-pupil-{s}", s, .0034, .00055, pal["PUPIL"], look)
        glint = eye_disc(f"cadet-glint-{s}", s, .0012, .00075, pal["EYE"],
                         (look[0] - .0024, look[1] + .0022), rings=3, seg=12)
        out += [ball, iris, pupil, glint]
    return out


def brows(sc, pal):
    """Thick brows on the shared brow ridge, drawn down to the nose and
    rising to the outer corner: focus, not anger."""
    out = []
    for s in (-1, 1):
        n = 16
        ts = np.linspace(0, 1, n)
        xs = s * (.0085 + .0400 * ts)
        zs = 1.1500 + .0085 * ts - .0034 * (ts - .45) ** 2 * 4
        origins = np.stack([xs * .4, np.full(n, .02), zs], 1)
        dirs = np.stack([xs * .6, np.full(n, .075), np.zeros(n)], 1)
        dirs /= np.linalg.norm(dirs, axis=1)[:, None]
        surf = project(sc, origins, dirs, reach=.09)
        nrm = gradient(sc, surf)
        pts = surf + nrm * .0006
        widths = .0046 - .0024 * ts ** 1.5
        depths = .0016 - .0005 * ts
        verts, seg = [], 10
        for i in range(n):
            tan = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
            tan /= np.linalg.norm(tan)
            nn = nrm[i] - tan * (nrm[i] @ tan)
            nn /= np.linalg.norm(nn)
            up = np.cross(tan, nn)
            if up[2] < 0:
                up = -up
            for j in range(seg):
                ang = TAU * j / seg
                verts.append(pts[i] + up * math.cos(ang) * widths[i] + nn * math.sin(ang) * depths[i])
        faces = grid_faces(n, seg, closed=True)
        base = len(verts)
        verts += [pts[0], pts[-1]]
        faces += [(base, (j + 1) % seg, j) for j in range(seg)]
        last = (n - 1) * seg
        faces += [(base + 1, last + j, last + (j + 1) % seg) for j in range(seg)]
        out.append(_recalc(_mesh(f"cadet-brow-{s}", verts, faces, pal["BROW"])))
    return out


def mouth_slit(pal):
    """The dark line between the lips (the `mouth` control: faces.ts opens
    it by scaling it up)."""
    n = 17
    xs = np.linspace(-MOUTH_HALF * .98, MOUTH_HALF * .98, n)
    line = mouth_line(xs, "A")
    u = np.abs(xs) / MOUTH_HALF
    half = .0007 + .0005 * (1 - u ** 2)
    verts = []
    for x, z, hh in zip(xs, line, half):
        y = MOUTH[1] + face_y(x) - .0006
        verts += [(x, y, z + hh), (x, y + .0011, z), (x, y, z - hh), (x, y - .0024, z)]
    faces = grid_faces(n, 4, closed=True)
    faces += [(0, 1, 2, 3)[::-1], tuple((n - 1) * 4 + j for j in range(4))]
    return _recalc(_mesh("cadet-mouth", verts, faces, pal["MOUTH"]))


def controls(sc, pal):
    """All face control meshes in world space, named for attach_faces."""
    return eyes(pal) + brows(sc, pal) + [mouth_slit(pal)]
