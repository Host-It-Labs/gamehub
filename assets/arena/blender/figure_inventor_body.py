"""The Inventor's body and garments as authored forms (master sculpt).

A young woman in a cobalt coverall top and dark trousers, a white cotton
lab coat with its sleeves rolled to below the elbow, long cobalt rubber
gauntlets, a leather belt and lace-up work boots. Blender metres, +Y
forward, Z up, feet on z = 0, her right at +X. Each garment is built from
closed solids and fused by voxel union into one connected surface, so it
bends at the shoulders, elbows, wrists, hips, knees and ankles.

Angles: a = 0 is the front (+Y), a = +pi/2 her right (+X).
"""
import math

import numpy as np
from mathutils import Vector

import kit
import figure_inventor_mesh as M
from figure_inventor_mesh import g, ss, spow, interp_rows

TAU = math.tau
T = kit.tint

# ------------------------------------------------------------- paint

SKIN = "skin:" + T("inventor-skin", "#7d4b2f")
HAIR = "hair:" + T("inventor-hair", "#1c1412")
COAT = "weave:" + T("inventor-coat", "#f1eee6")
SEAM = "weave:" + T("inventor-coat-seam", "#d9d4c8")
TOP = "weave:team"
TROUSERS = "weave:team2"
GLOVE = "rubber:team"
LEATHER = "hide:" + T("inventor-leather", "#6b4026")
LEATHER_DARK = "hide:" + T("inventor-leather-dark", "#3c2519")
SOLE = "rubber:" + T("inventor-sole", "#2a2320")
LACE = "weave:" + T("inventor-lace", "#d8c7a4")
BRASS = "gilt:" + T("inventor-brass", "#c99a46")
COPPER = "gilt:" + T("inventor-copper", "#c4683a")
BUTTON = "resin:" + T("inventor-button", "#e9e3d4")

# ------------------------------------------------------------- joints

def V(*a):
    return Vector(a[0] if len(a) == 1 else a)


HIP = {s: V(s * .072, 0.0, .620) for s in (-1, 1)}
KNEE = {s: V(s * .078, .014, .355) for s in (-1, 1)}
ANKLE = {s: V(s * .084, -.006, .088) for s in (-1, 1)}
WAIST = V(0, -.010, .735)
CHEST = V(0, -.014, .860)
NECK = V(0, -.008, 1.030)
CLAV = {s: V(s * .022, .030, .952) for s in (-1, 1)}
SHOULDER = {s: V(s * .152, -.004, .932) for s in (-1, 1)}
UPPER, FORE = .215, .195
_A = {s: V(s * .139, .070, -.988).normalized() for s in (-1, 1)}
_F = {s: V(s * .100, .340, -.935).normalized() for s in (-1, 1)}
ELBOW = {s: SHOULDER[s] + _A[s] * UPPER for s in (-1, 1)}
WRIST = {s: ELBOW[s] + _F[s] * FORE for s in (-1, 1)}
SKIRT = {s: V(s * .060, -.004, .725) for s in (-1, 1)}


def hand_frame(s):
    """(f, u, n) at the wrist: f along the hand, u toward the thumb, n out
    of the palm (palms face the thighs)."""
    f = _F[s].copy()
    u = (V(0, 1, 0) - f * f.y).normalized()
    n = (u.cross(f) * s).normalized()
    return f, u, n


# ------------------------------------------------------------- the torso

# (z, half width, front depth, back depth, centre y) of the coverall top.
TORSO = [(.680, .112, .068, .076, 0.0), (.720, .102, .064, .068, 0.0),
         (.750, .099, .063, .066, 0.0), (.785, .105, .067, .067, .002),
         (.820, .114, .071, .070, .003), (.855, .121, .073, .074, .003),
         (.885, .125, .071, .077, .001), (.910, .126, .067, .077, -.001),
         (.932, .122, .062, .074, -.003), (.952, .108, .056, .067, -.004),
         (.967, .086, .050, .059, -.005), (.980, .060, .044, .050, -.006),
         (.992, .044, .040, .042, -.006)]


def torso_point(a, z, extra=0.0):
    """The coverall top's surface (numpy over a and z)."""
    a, z = np.broadcast_arrays(np.asarray(a, float), np.asarray(z, float))
    W, F, B, cy = interp_rows(TORSO, z)
    p = 2.25 + .25 * ss(.80, .92, z)
    sa, ca = np.sin(a), np.cos(a)
    depth = np.where(ca >= 0, F, B)
    x = spow(sa, 2 / p) * (W + extra)
    y = spow(ca, 2 / p) * (depth + extra)
    ad = np.degrees(np.abs((a + math.pi) % TAU - math.pi))
    front = ca > 0
    # A modest bust, the sternum between, a soft fold beneath.
    bust = .016 * g(z, .850, .028) * (g(x, .050, .034) + g(x, -.050, .034))
    y = y + np.where(front, bust - .003 * g(x, 0, .012) * g(z, .85, .05), 0)
    y = y - np.where(front, .0025 * g(z, .826, .010) * (g(x, .05, .03) + g(x, -.05, .03)), 0)
    # Shoulder blades and the spine's groove at the back.
    blade = .007 * g(z, .895, .035) * (g(x, .058, .030) + g(x, -.058, .030))
    spine = .003 * g(x, 0, .010) * ss(.77, .82, z) * (1 - ss(.93, .96, z))
    y = y - np.where(~front, blade - spine, 0)
    # The armpit hollow beneath the shoulder keeps the hanging arm clear.
    x = x - np.sign(x) * .011 * g(z, .880, .040) * g(ad, 90, 22)
    return np.stack([x, y + cy, z], axis=-1)


def torso_grid(z0, z1, rows, cols, extra=0.0, a0=0.0, a1=TAU):
    zs = np.linspace(z0, z1, rows)
    As = np.linspace(a0, a1, cols, endpoint=(a1 - a0) < TAU - 1e-6)
    A, Z = np.meshgrid(As, zs)
    return torso_point(A, Z, extra)


def yoke(name, mat, grow=0.0):
    """The trapezius and shoulder top: a flattened tube from the neck to
    each shoulder, which the voxel union blends into the torso."""
    out = []
    for s in (-1, 1):
        path = M.catmull([V(s * .020, -.010, .982), V(s * .072, -.009, .968),
                          V(s * .118, -.007, .949), V(s * .145, -.006, .936)], 6)
        def radius(t, a, grow=grow):
            rz = .024 + .004 * t + grow
            ry = .046 - .004 * t + grow
            return np.sqrt(1 / ((np.cos(a) / rz) ** 2 + (np.sin(a) / ry) ** 2))
        out.append(M.sweep(f"{name}-{s}", path, radius, mat, n=32,
                           up=(0, 0, 1), caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- the top

def coverall_top():
    """The cobalt coverall top, visible inside the open coat: a fitted shell
    over the front and sides, the mock collar round the neck and its two
    small collar points."""
    rows, cols = 90, 120
    zs = np.linspace(.720, .985, rows)
    As = np.linspace(-1.25, 1.25, cols)
    A, Z = np.meshgrid(As, zs)
    outer = torso_point(A, Z, 0.0)
    inner = torso_point(A, Z, -.010)
    shell = M.solid_shell("inventor.top-shell", outer, inner, TOP)
    collar = []
    zs = np.linspace(.968, 1.006, 14)
    ring = []
    for z in zs:
        t = (z - .968) / .038
        r = .041 - .0025 * t + .0012 * math.sin(t * math.pi)
        ring.append([(math.sin(a) * r, -.006 + math.cos(a) * r * .97 + .002, z)
                     for a in np.linspace(0, TAU, 72, endpoint=False)])
    outer = np.array(ring)
    inner = outer.copy()
    inner[..., 0] *= .82
    inner[..., 1] = (inner[..., 1] + .006) * .82 - .006
    collar.append(M.solid_shell("inventor.top-collar", outer, inner, TOP,
                                closed=True))
    # Fused into one cobalt top (front panel, yoke and mock collar).
    pieces = [shell] + collar + yoke("inventor.top-yoke", TOP, -.004)
    top = M.fuse("inventor.top", pieces, .0016, TOP, .4, 2)
    return top


def placket_and_points():
    """The coverall's front placket seam and collar points (rigid details)."""
    out = []
    path = [torso_point(0, z, .0012) for z in np.linspace(.765, .955, 26)]
    out.append(M.sweep("inventor.top-placket", path, [(.0016, .0016)] * len(path),
                       TOP, n=8, caps=("dome", "dome")))
    for s in (-1, 1):
        base = np.array([s * .012, .043, .978])
        pts = np.array([base, base + [s * .020, .006, -.020], base + [s * .030, .002, -.010],
                        base + [s * .036, -.006, .004]])
        out.append(M.sweep(f"inventor.top-point-{s}", M.catmull(pts, 4),
                           [(.0035, .0016)] * 13, TOP, n=10, up=(0, 1, 0),
                           caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- trousers

PELVIS = [(.570, .084, .040, .048, -.004), (.582, .104, .056, .064, -.004),
          (.600, .116, .064, .074, -.004), (.625, .122, .068, .080, -.004),
          (.655, .123, .070, .082, -.004), (.690, .117, .069, .080, -.002),
          (.725, .108, .066, .074, 0.0), (.760, .102, .064, .068, 0.0),
          (.790, .100, .063, .066, 0.0)]


def pelvis_point(a, z, extra=0.0):
    a, z = np.broadcast_arrays(np.asarray(a, float), np.asarray(z, float))
    W, F, B, cy = interp_rows(PELVIS, z)
    p = 2.3
    sa, ca = np.sin(a), np.cos(a)
    x = spow(sa, 2 / p) * (W + extra)
    y = spow(ca, 2 / p) * (np.where(ca >= 0, F, B) + extra) + cy
    # The seat: two rounded glutes either side of the back seam.
    back = ca < 0
    seat = .010 * g(z, .640, .040) * (g(x, .06, .04) + g(x, -.06, .04))
    y = y - np.where(back, seat, 0)
    return np.stack([x, y, z], axis=-1)


def leg_path(s, z_end=.155):
    h, k, a = HIP[s], KNEE[s], ANKLE[s]
    pts = M.catmull([h + V(0, 0, .035), (h + k) / 2 + V(0, .004, 0), k,
                     (k + a) / 2 + V(0, -.004, 0), a], 12)
    return pts[pts[:, 2] >= z_end - 1e-6]


def trousers():
    """High-waisted dark work trousers: the seat, and two straight legs with
    a little room at the knee, hemmed over the boots."""
    zs = np.linspace(.570, .795, 48)
    As = np.linspace(0, TAU, 96, endpoint=False)
    A, Z = np.meshgrid(As, zs)
    pelvis = M.grid("inventor.trouser-seat", pelvis_point(A, Z), TROUSERS,
                    cap0="pole", cap1="pole")
    legs = []
    for s in (-1, 1):
        path = leg_path(s)
        z = path[:, 2]
        # Thigh, knee, calf; a straight wide hem.
        rx = np.interp(z, [.155, .19, .26, .33, .37, .45, .55, .66],
                       [.046, .045, .047, .046, .047, .052, .057, .060])
        ry = np.interp(z, [.155, .19, .26, .33, .37, .45, .55, .66],
                       [.048, .047, .050, .048, .049, .054, .059, .062])
        legs.append(M.sweep(f"inventor.trouser-leg-{s}", path,
                            list(zip(rx, ry)), TROUSERS, n=48, up=(1, 0, 0),
                            caps=("flat", "flat")))
    return M.fuse("inventor.trousers", [pelvis] + legs, .0022, TROUSERS, .45, 3)


def cargo_pockets():
    """A bellows pocket on each thigh's outer side, its flap and snap."""
    out = []
    for s in (-1, 1):
        h, k = HIP[s], KNEE[s]
        for part, (z0, z1, depth) in (("bag", (.405, .50, .006)),
                                      ("flap", (.488, .515, .009))):
            rows = []
            for z in np.linspace(z0, z1, 10):
                t = (h.z - z) / (h.z - k.z)
                c = h.lerp(k, t)
                r = float(np.interp(z, [.37, .45, .55], [.047, .052, .057]))
                row = []
                for ang in np.linspace(math.radians(55), math.radians(115), 14):
                    nx, ny = math.sin(ang) * s, math.cos(ang)
                    row.append((c.x + nx * (r + .0012), c.y + ny * (r + .0012), z))
                rows.append(row)
            outer = np.array(rows)
            nrm = outer.copy()
            nrm[..., 2] = 0
            cxy = np.array([[[h.lerp(k, (h.z - zz) / (h.z - k.z)).x,
                              h.lerp(k, (h.z - zz) / (h.z - k.z)).y, 0]
                             for _ in range(outer.shape[1])] for zz in outer[:, 0, 2]])
            d = nrm - cxy
            d /= np.linalg.norm(d, axis=-1, keepdims=True)
            o = outer + d * depth
            i = outer - d * .002
            out.append(M.solid_shell(f"inventor.cargo-{part}-{s}", o, i, TROUSERS))
        c = h.lerp(k, (h.z - .500) / (h.z - k.z))
        at = np.array([c.x + s * .062, c.y + .006, .500])
        out.append(M.ball(f"inventor.cargo-snap-{s}", .0042, at, BRASS,
                          scale=(.55, 1, 1), seg=16, rings=8))
    return out


# ------------------------------------------------------------- the coat

def coat_open(z):
    """The coat's front edge angle at height z (radians from the front)."""
    return np.interp(z, [.42, .55, .65, .74, .80, .88, .93, .975],
                     [.50, .50, .48, .46, .50, .50, .42, .32])


# (z, half width, front depth, back depth) of the coat: easy over the bust,
# straight at the waist, a gentle A-line to the hem.
COAT_ROWS = [(.420, .166, .097, .115), (.450, .163, .096, .114), (.500, .158, .094, .112),
        (.550, .153, .092, .110), (.600, .148, .090, .107), (.640, .142, .088, .104),
        (.680, .135, .085, .099), (.720, .129, .083, .093), (.760, .127, .084, .089),
        (.800, .131, .088, .088), (.840, .137, .092, .089), (.880, .140, .086, .090),
        (.915, .139, .076, .088), (.940, .132, .068, .082), (.958, .118, .061, .074),
        (.970, .098, .056, .067), (.980, .070, .050, .058)]


def coat_point(a, z, extra=0.0):
    """The coat's outer surface."""
    a, z = np.broadcast_arrays(np.asarray(a, float), np.asarray(z, float))
    W, F, B = interp_rows(COAT_ROWS, z)
    sa, ca = np.sin(a), np.cos(a)
    p = 2.25 + .15 * ss(.80, .92, z)
    front = ca >= 0
    x = spow(sa, 2 / p) * (W + extra)
    y = spow(ca, 2 / p) * (np.where(front, F, B) + extra) - .002
    ad = np.degrees(np.abs((a + math.pi) % TAU - math.pi))
    # The bust lifts the fronts, the blades round the back.
    y = y + np.where(front, .010 * g(z, .850, .040) * g(np.abs(x), .055, .040), 0)
    y = y - np.where(~front, .005 * g(z, .895, .040) * g(np.abs(x), .058, .035), 0)
    # Soft folds: hanging from the bust and the seat, more toward the hem.
    hang = 1 - ss(.55, .78, z)
    fold = (.0032 * np.sin(a * 8 + 1.2 + .6 * np.sin(a * 3)) * hang +
            .0018 * np.sin(a * 13 - .4) * hang * hang +
            .0012 * np.sin(a * 5 - .4) * g(z, .70, .05) * (ca < 0))
    # The hem's turned-up band.
    fold += .0012 * g(z, .445, .006)
    nrm = np.stack([sa, ca, np.zeros_like(a)], axis=-1)
    return np.stack([x, y, z], axis=-1) + nrm * fold[..., None]


def coat_panel(name, z0, z1, a0, a1, rows, cols, thick=.0055):
    zs = np.linspace(z0, z1, rows)
    out, inn = [], []
    for z in zs:
        lo = a0(z) if callable(a0) else a0
        hi = a1(z) if callable(a1) else a1
        As = np.linspace(lo, hi, cols)
        out.append(coat_point(As, z))
        inn.append(coat_point(As, z, -thick))
    return M.solid_shell(name, np.array(out), np.array(inn), COAT)


def sleeve_path(s):
    sh, el, wr = SHOULDER[s], ELBOW[s], WRIST[s]
    end = el.lerp(wr, .36)
    pts = M.catmull([sh + V(-s * .040, -.004, .010), sh + V(-s * .004, 0, -.006),
                     sh.lerp(el, .5), el, el.lerp(wr, .2), end], 8)
    return pts


def sleeve(s):
    path = sleeve_path(s)
    n = len(path)
    seg = np.linalg.norm(np.diff(path, axis=0), axis=1)
    t = np.concatenate([[0], np.cumsum(seg)]) / seg.sum()
    r = np.interp(t, [0, .10, .22, .45, .62, .78, .90, 1.0],
                  [.036, .043, .041, .038, .037, .036, .035, .034])
    def radius(tt, ang):
        rr = np.interp(tt, t, r)
        # Rolled cuff: a thick turned-back band with a groove.
        cuff = .0075 * ss(.86, .89, tt) - .0016 * g(tt, .935, .012)
        # Gathered folds in the crook of the elbow and over the forearm.
        crook = .0024 * np.sin(ang * 4 + tt * 30) * g(tt, .62, .08)
        drape = .0018 * np.sin(ang * 3 - tt * 18) * g(tt, .35, .14)
        return rr + cuff + crook + drape
    up = (0, 0, 1)
    return M.sweep(f"inventor.sleeve-{s}", path, radius, COAT, n=56, up=(1, 0, 0),
                   caps=("dome", "flat"))


def coat():
    """The lab coat: open front, a back vent, sleeves rolled up below the
    elbow. One connected cotton surface."""
    upper = coat_panel("inventor.coat-upper", .600, .980,
                       coat_open, lambda z: TAU - coat_open(z), 120, 180)
    right = coat_panel("inventor.coat-tail-r", .420, .620,
                       coat_open, math.pi - .028, 40, 96)
    left = coat_panel("inventor.coat-tail-l", .420, .620,
                      math.pi + .028, lambda z: TAU - coat_open(z), 40, 96)
    shoulders = yoke("inventor.coat-yoke", COAT, .006)
    sleeves = [sleeve(s) for s in (-1, 1)]
    coat = M.fuse("inventor.coat", [upper, right, left] + shoulders + sleeves,
                  .0021, COAT, .45, 3)
    return coat


def forearm_skin(s):
    el, wr = ELBOW[s], WRIST[s]
    pts = [el.lerp(wr, t) for t in np.linspace(.22, .56, 10)]
    r = np.linspace(.0275, .0255, 10)
    return M.sweep(f"inventor.forearm-{s}", pts, list(zip(r, r * .92)), SKIN,
                   n=40, up=(0, 1, 0), caps=("dome", "dome"))


# ------------------------------------------------------------- gauntlets

def finger_chain(base, f, u, n, bar_c, bar_r, lengths, radius, start_bend=0.0):
    """Joint positions of a finger wrapping a bar whose axis is along u.
    Each phalanx bends (toward n, about u) just enough to stay on the bar."""
    pts = [np.array(base)]
    d = np.array(f)
    rot_axis = np.array(u)
    def rot(v, ang):
        k = rot_axis
        return (v * math.cos(ang) + np.cross(k, v) * math.sin(ang) +
                k * k.dot(v) * (1 - math.cos(ang)))
    # Rotation sense: from f toward n about u.
    sense = 1 if np.cross(rot_axis, f).dot(n) > 0 else -1
    d = rot(d, sense * start_bend)
    want = bar_r + radius + .0006
    for L in lengths:
        best = None
        for ang in np.linspace(0, math.radians(110), 111):
            dd = rot(d, sense * ang)
            end = pts[-1] + dd * L
            rel = end - bar_c
            rel -= rot_axis * rel.dot(rot_axis)
            err = abs(np.linalg.norm(rel) - want)
            if best is None or err < best[0] - 1e-9:
                best = (err, dd, end)
            if np.linalg.norm(rel) < want:
                break
        _, d, end = best
        pts.append(end)
    return np.array(pts)


HAND_SCALE = 1.18


def hand_parts(s, grip_r=.0125, grip_scale=1.0):
    """A gloved hand closed round a bar along u, plus its gauntlet cuff.
    The hand is drawn a little large, as cartoon hands are. Returns
    (pieces, bar centre, frame); the bar's radius is grip_r * HAND_SCALE."""
    f, u, n = hand_frame(s)
    f, u, n = np.array(f), np.array(u), np.array(n)
    w = np.array(WRIST[s])
    pieces = []
    # The palm: superellipse sections from the wrist to the knuckles.
    rows = []
    ts = np.linspace(-.012, .058, 30)
    for t in ts:
        width = float(np.interp(t, [-.012, 0, .025, .050, .058], [.019, .020, .0235, .0255, .0235]))
        th = float(np.interp(t, [-.012, 0, .02, .045, .058], [.0115, .0118, .0122, .0105, .0090]))
        ring = []
        for a in np.linspace(0, TAU, 48, endpoint=False):
            x = spow(math.cos(a), 2 / 2.6) * width
            y = spow(math.sin(a), 2 / 2.4) * th
            # Thenar pad on the thumb side of the palm; knuckle ridge.
            y += .0042 * g(x, width * .55, .010) * g(t, .016, .014) * (y > 0)
            y -= .0012 * g(t, .050, .006) * (y < 0) * (1 - np.cos(x / width * 4 * math.pi)) * .5
            ring.append(w + f * t + u * x + n * y)
        rows.append(ring)
    pieces.append(M.grid(f"inventor.palm-{s}", np.array(rows), GLOVE,
                         cap0="pole", cap1="pole"))
    # The bar the hand closes on, its centre in front of the palm.
    bar_c = w + f * .040 + n * (.0122 + grip_r * .92)
    fingers = [(.0172, (.0225, .0150, .0125), .0059),
               (.0058, (.0240, .0160, .0130), .0061),
               (-.0058, (.0228, .0152, .0124), .0058),
               (-.0170, (.0190, .0125, .0108), .0052)]
    for i, (off, lengths, r) in enumerate(fingers):
        base = w + f * (.054 - .003 * abs(off) / .017) + u * off - n * .0015
        chain = finger_chain(base, f, u, n, bar_c + u * off, grip_r * grip_scale,
                             lengths, r, start_bend=.25)
        path = M.catmull(chain, 6)
        def radius(tt, ang, r=r):
            # Knuckle swell at each joint, a rounded fingertip.
            return r * (1 + .10 * g(tt, .0, .08) + .08 * g(tt, .48, .06) +
                        .06 * g(tt, .78, .05) - .10 * ss(.9, 1.0, tt))
        pieces.append(M.sweep(f"inventor.finger-{s}-{i}", path, radius, GLOVE,
                              n=20, up=tuple(n), caps=("dome", "dome")))
    # The thumb: from the thenar round the far side of the bar.
    t0 = w + f * .010 + u * .016 + n * .006
    t1 = t0 + f * .014 + u * .012 + n * .010
    t2 = bar_c + u * .019 + f * .004 - n * .002
    t3 = bar_c + u * .012 + f * .016 - n * .006
    path = M.catmull([t0, t1, t2, t3], 6)
    pieces.append(M.sweep(f"inventor.thumb-{s}", path,
                          lambda tt, ang: .0074 * (1.12 - .25 * tt), GLOVE,
                          n=20, up=tuple(n), caps=("dome", "dome")))
    for o in pieces:
        P = M.coords(o)
        M.set_coords(o, w + (P - w) * HAND_SCALE)
    bar_c = w + (bar_c - w) * HAND_SCALE
    # The gauntlet cuff up the forearm, flared and rolled at its top.
    el = np.array(ELBOW[s])
    rows = []
    for k in np.linspace(0, 1, 30):
        c = w + (el - w) * (k * .58) - f * .002
        rx = float(np.interp(k, [0, .25, .7, .92, 1], [.0240, .0252, .0300, .0350, .0365]))
        ry = float(np.interp(k, [0, .25, .7, .92, 1], [.0190, .0202, .0255, .0305, .0320]))
        roll = .0035 * g(k, .975, .03)
        ring = [c + u * (math.cos(a) * (rx + roll)) + n * (math.sin(a) * (ry + roll))
                for a in np.linspace(0, TAU, 56, endpoint=False)]
        rows.append(ring)
    pieces.append(M.grid(f"inventor.cuff-{s}", np.array(rows), GLOVE,
                         cap0="pole", cap1="pole"))
    return pieces, bar_c, (f, u, n)


def gauntlet(s, grip_r):
    pieces, bar_c, frame = hand_parts(s, grip_r)
    glove = M.fuse(f"inventor.glove-{s}", pieces, .0009, GLOVE, .35, 2)
    return glove, bar_c, frame


def wrist_strap(s):
    """A leather strap round the gauntlet's wrist with a brass buckle."""
    f, u, n = hand_frame(s)
    w = WRIST[s]
    c = w - f * .010
    out = []
    ring = []
    for a in np.linspace(0, TAU, 49):
        ring.append(c + u * (math.cos(a) * .0242) + n * (math.sin(a) * .0196))
    out.append(M.sweep(f"inventor.strap-{s}", ring, [(.0055, .0017)] * len(ring),
                       LEATHER, n=8, up=tuple(f), caps=(None, None)))
    back = c - n * .0215
    frame = [u, f, -n]
    buckle = []
    for x0, y0, x1, y1 in ((-.0065, -.0065, .0065, -.0065), (.0065, -.0065, .0065, .0065),
                           (.0065, .0065, -.0065, .0065), (-.0065, .0065, -.0065, -.0065)):
        a = back + u * x0 + f * y0 - n * .0018
        b = back + u * x1 + f * y1 - n * .0018
        buckle.append(M.sweep(f"inventor.strap-buckle-{s}-{len(buckle)}", [a, b],
                              [.0013, .0013], BRASS, n=8, caps=("dome", "dome")))
    out += buckle
    return out


# ------------------------------------------------------------- boots

def boot(s):
    """A lace-up leather work boot: a cushioned sole and heel, a rounded toe
    cap, the shaft to above the ankle. Returns (upper, sole, toe cap)."""
    a = ANKLE[s]
    out = math.radians(7) * s
    fwd = V(math.sin(out), math.cos(out), 0)
    side = V(fwd.y, -fwd.x, 0)
    origin = V(a.x, a.y, 0)
    rows = []
    ys = np.linspace(-.058, .114, 46)
    for yy in ys:
        # Width and height along the foot (heel to toe).
        w = float(np.interp(yy, [-.058, -.044, -.02, .03, .065, .094, .114],
                            [.019, .030, .032, .033, .035, .030, .009]))
        top = float(np.interp(yy, [-.060, -.050, -.035, -.010, .020, .045, .070, .100, .122],
                              [.075, .150, .185, .190, .180, .118, .072, .052, .028]))
        ring = []
        for ang in np.linspace(0, TAU, 56, endpoint=False):
            sx = math.cos(ang)
            sz = math.sin(ang)
            x = spow(sx, 2 / 2.6) * w
            zc = (top + .016) / 2
            hz = (top - .016) / 2
            z = zc + spow(sz, 2 / 2.4) * hz
            # Inner arch.
            z += .006 * g(yy, .015, .03) * (x * s < 0) * (sz < 0)
            ring.append(origin + fwd * yy + side * x + V(0, 0, z))
        rows.append(ring)
    upper = M.grid(f"inventor.boot-{s}", np.array(rows), LEATHER, cap0="pole", cap1="pole")
    # Shaft opening and collar at the top.
    collar = []
    for ang in np.linspace(0, TAU, 49):
        collar.append(origin + V(0, 0, .189) + fwd * (-.008 + .030 * math.cos(ang)) +
                      side * (.038 * math.sin(ang)))
    shaft = M.sweep(f"inventor.boot-collar-{s}", collar, [(.0035, .0045)] * len(collar),
                    LEATHER_DARK, n=10, up=(0, 0, 1), caps=(None, None))
    # Sole and heel.
    srows = []
    for yy in np.linspace(-.062, .118, 40):
        w = float(np.interp(yy, [-.062, -.05, -.02, .03, .065, .094, .118],
                            [.022, .032, .034, .035, .037, .032, .011]))
        ring = []
        for ang in np.linspace(0, TAU, 40, endpoint=False):
            x = spow(math.cos(ang), 2 / 3.0) * (w + .0025)
            hz = .0105 if yy < -.005 else .0080
            zc = .0105 if yy < -.005 else .0080
            z = zc + spow(math.sin(ang), 2 / 3.0) * hz
            ring.append(origin + fwd * yy + side * x + V(0, 0, max(.0005, z)))
        srows.append(ring)
    sole = M.grid(f"inventor.sole-{s}", np.array(srows), SOLE, cap0="pole", cap1="pole")
    # The toe cap: a stitched, darker overlay.
    trows = []
    for yy in np.linspace(.058, .116, 14):
        w = float(np.interp(yy, [.058, .066, .094, .116], [.0355, .0358, .0305, .010]))
        top = float(np.interp(yy, [.058, .075, .098, .116], [.094, .070, .051, .029]))
        ring = []
        for ang in np.linspace(0, TAU, 56, endpoint=False):
            x = spow(math.cos(ang), 2 / 2.6) * (w + .0012)
            zc = (top + .016) / 2
            hz = (top - .016) / 2 + .0012
            z = zc + spow(math.sin(ang), 2 / 2.4) * hz
            ring.append(origin + fwd * yy + side * x + V(0, 0, z))
        trows.append(ring)
    cap = M.grid(f"inventor.toecap-{s}", np.array(trows), LEATHER_DARK, cap0="pole", cap1="pole")
    return upper, sole, cap, shaft, (origin, fwd, side)


def laces(s, frame):
    origin, fwd, side = frame
    out = []
    eyelets = []
    for k, yy in enumerate(np.linspace(-.004, .056, 5)):
        top = float(np.interp(yy, [-.035, -.010, .020, .045, .070], [.185, .190, .180, .120, .075]))
        z = top + .0010
        for sx in (-1, 1):
            p = origin + fwd * yy + side * (sx * .0105) + V(0, 0, z - .001)
            eyelets.append((k, sx, p))
            out.append(M.ball(f"inventor.eyelet-{s}-{k}-{sx}", .0022, p, BRASS,
                              scale=(1, 1, .6), seg=12, rings=6))
    for k in range(4):
        a = next(p for kk, sx, p in eyelets if kk == k and sx == -1)
        b = next(p for kk, sx, p in eyelets if kk == k + 1 and sx == 1)
        c = next(p for kk, sx, p in eyelets if kk == k and sx == 1)
        d = next(p for kk, sx, p in eyelets if kk == k + 1 and sx == -1)
        for name, p, q in (("x", a, b), ("y", c, d)):
            mid = (p + q) / 2 + V(0, 0, .0022)
            out.append(M.sweep(f"inventor.lace-{s}-{k}-{name}", [p, mid, q],
                               [.0013] * 3, LACE, n=8, caps=("dome", "dome")))
    # A small bow at the top.
    top = origin + fwd * (-.006) + V(0, 0, .197)
    for sx in (-1, 1):
        loop = [top, top + side * (sx * .010) + fwd * .006 + V(0, 0, .004),
                top + side * (sx * .016) + V(0, 0, .002), top + side * (sx * .008) - fwd * .002]
        out.append(M.sweep(f"inventor.bow-{s}-{sx}", M.catmull(loop, 4), [.0012] * 13,
                           LACE, n=8, caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- the belt

def belt():
    """A broad leather belt over the trouser waist, a square brass buckle and
    its tongue, belt loops."""
    out = []
    zs = np.linspace(.742, .778, 8)
    As = np.linspace(0, TAU, 128, endpoint=False)
    A, Z = np.meshgrid(As, zs)
    outer = pelvis_point(A, Z, .0055)
    inner = pelvis_point(A, Z, -.001)
    out.append(M.solid_shell("inventor.belt", outer, inner, LEATHER, closed=True))
    c = pelvis_point(0, .760, .0072)
    frame = c.copy()
    for x0, z0, x1, z1 in ((-.021, -.021, .021, -.021), (.021, -.021, .021, .021),
                           (.021, .021, -.021, .021), (-.021, .021, -.021, -.021)):
        a = frame + np.array([x0, 0, z0 * .62])
        b = frame + np.array([x1, 0, z1 * .62])
        out.append(M.sweep(f"inventor.buckle-{len(out)}", [a, b], [(.0034, .0026)] * 2,
                           BRASS, n=10, up=(0, 1, 0), caps=("dome", "dome")))
    out.append(M.sweep("inventor.buckle-tongue", [frame + [-.021, .002, 0], frame + [.005, .003, 0]],
                       [.0019, .0016], BRASS, n=8, caps=("dome", "dome")))
    for k, a in enumerate((-2.0, -1.2, 1.2, 2.0, math.pi)):
        p0 = pelvis_point(a, .738, .0068)
        p1 = pelvis_point(a, .782, .0068)
        out.append(M.sweep(f"inventor.loop-{k}", [p0, (p0 + p1) / 2 + np.array([0, 0, 0]), p1],
                           [(.0018, .0040)] * 3, TROUSERS, n=8, up=(0, 0, 1),
                           caps=("dome", "dome")))
    return out
