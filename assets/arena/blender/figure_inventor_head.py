"""The Inventor's head: a young Black woman's face in the collector's
cartoon style, fierce and focused; the hair pulled up into two big curly
puffs; the brass goggles pushed up on her forehead.

The skin (skull, face, ears, neck) is one fused connected surface; eyes,
pupils, brows and mouth are separate live face controls (faces.ts), and
lids, lashes, hair and goggles ride the head joint.
"""
import math

import numpy as np
from mathutils import Vector

import kit
import figure_inventor_mesh as M
from figure_inventor_mesh import g, ss, spow, interp_rows
from figure_inventor_body import (SKIN, HAIR, BRASS, LEATHER, LEATHER_DARK,
                                  TOP)

TAU = math.tau
T = kit.tint
WHITE = "resin:" + T("inventor-eye", "#efe6da")
IRIS = "resin:" + T("inventor-iris", "#4b2a17")
PUPIL = "resin:" + T("inventor-pupil", "#140c0a")
SHINE = "lacquer:" + T("inventor-shine", "#ffffff")
LASH = "hair:" + T("inventor-lash", "#120c0b")
MOUTH = "resin:" + T("inventor-mouth", "#3d1b19")
LENS = "lacquer:" + T("inventor-lens", "#78b2d2")
BAND = "weave:team"

# (z, half width, front depth, back depth, centre y) of the head.
HEAD = [(1.042, .012, .010, .010, .034), (1.047, .022, .018, .014, .032),
        (1.054, .031, .026, .019, .028), (1.063, .040, .033, .026, .024),
        (1.074, .048, .040, .036, .019), (1.087, .056, .047, .054, .015),
        (1.102, .062, .054, .072, .011), (1.120, .067, .061, .086, .008),
        (1.140, .0705, .067, .089, .006), (1.162, .0725, .071, .093, .005),
        (1.185, .073, .073, .095, .004), (1.206, .072, .071, .094, .003),
        (1.225, .068, .066, .089, .002), (1.241, .061, .057, .081, .001),
        (1.253, .050, .045, .068, 0.0), (1.262, .034, .030, .047, -.001),
        (1.267, .012, .010, .018, -.002)]
Z0, Z1 = HEAD[0][0], HEAD[-1][0]

# The eye opening in face angles: centre, half-width (degrees) and the lid
# lines (metres above and below the centre) across it, u = -1 at the inner
# corner to +1 at the outer. Fierce: the upper lid low and level, the outer
# corner lifted.
EYE_AD, EYE_Z, EYE_HW = 25.5, 1.1480, 16.0
TOP_LID = [(-1.0, .0003), (-.66, .0041), (-.27, .0060), (.20, .0062),
           (.63, .0050), (1.0, .0020)]
BOT_LID = [(-1.0, .0003), (-.66, -.0040), (-.27, -.0064), (.20, -.0068),
           (.63, -.0051), (1.0, .0020)]


def base_point(a, z):
    a, z = np.broadcast_arrays(np.asarray(a, float), np.asarray(z, float))
    W, F, B, cy = interp_rows(HEAD, z)
    sa, ca = np.sin(a), np.cos(a)
    p = np.where(ca >= 0, 2.45, 2.15)
    x = spow(sa, 2 / p) * W
    y = spow(ca, 2 / p) * np.where(ca >= 0, F, B) + cy
    return np.stack([x, y, z], axis=-1)


def mouth_z(A):
    return 1.0857 - .0009 * (np.asarray(A, float) / 16) ** 2


def lid(u, rows):
    rows = np.asarray(rows)
    return np.interp(u, rows[:, 0], rows[:, 1])


def eye_uv(ad, z):
    """Eye-opening coordinates: u across (inner -1 .. outer +1), the height
    above the eye's centre line, and which eye."""
    A = np.abs(ad)
    return (A - EYE_AD) / EYE_HW, np.asarray(z, float) - EYE_Z


def almond(ad, z, grow=0.0):
    """1 inside the eye opening, falling off softly outside it."""
    u, h = eye_uv(ad, z)
    top = lid(np.clip(u, -1, 1), TOP_LID) + grow
    bot = lid(np.clip(u, -1, 1), BOT_LID) - grow
    inside_v = ss(bot - .0012, bot + .0006, h) * (1 - ss(top - .0006, top + .0012, h))
    inside_u = 1 - ss(.93 + grow * 30, 1.10 + grow * 30, np.abs(u))
    return inside_v * inside_u


def features(ad, z, opening=True):
    """Outward displacement of the face's forms (ad: signed degrees)."""
    ad = np.asarray(ad, float)
    z = np.asarray(z, float)
    A = np.abs(ad)
    d = np.zeros(np.broadcast(ad, z).shape)
    # Nose: a low soft bridge, a rounded tip, broad alae and their creases.
    NH = np.interp(z, [1.099, 1.102, 1.106, 1.112, 1.120, 1.133, 1.148, 1.163],
                   [0, .0038, .0105, .0130, .0092, .0053, .0024, 0])
    NS = np.interp(z, [1.098, 1.106, 1.118, 1.138, 1.163], [10.5, 10.0, 7.6, 6.0, 6.5])
    d += NH * g(ad, 0, NS)
    d += .0032 * g(ad, 0, 7.0) * g(z, 1.1112, .0050)
    d += .0030 * g(A, 11.0, 3.4) * g(z, 1.1060, .0042)
    d -= .0011 * g(A, 15.0, 1.6) * g(z, 1.1072, .0065)
    d -= .0006 * g(A, 6.0, 2.0) * g(z, 1.1012, .0016)
    # The muzzle: the mouth sits on a rounded arch.
    d += .0035 * g(A, 0, 18.0) * g(z, 1.088, .011)
    # Lips: cupid's bow, the philtrum, a full lower lip, a firm set line.
    mz = mouth_z(A)
    zu = 1.0895 + .0003 * g(A, 4.5, 2.5) - .0006 * (A / 16) ** 2
    su = .0036 - .0012 * np.clip(A / 16, 0, 1.3) ** 2
    d += .0050 * g(ad, 0, 13.0) * g(z, zu, su)
    d += .0007 * g(ad, 0, 12.0) * g(z, zu + su * .95, .0010)
    d += .0009 * (g(ad, 3.0, 1.2) + g(ad, -3.0, 1.2)) * g(z, 1.0970, .0030)
    d -= .0007 * g(ad, 0, 1.5) * g(z, 1.0970, .0030)
    d += .0042 * g(ad, 0, 9.5) * g(z, 1.0975, .0055)
    zl = 1.0805 + .0005 * (A / 14) ** 2
    sl = .0042 - .0014 * np.clip(A / 14, 0, 1.3) ** 2
    d += (.0060 * g(ad, 0, 11.5) + .0008 * g(A, 6.0, 4.0)) * g(z, zl, sl)
    d -= .0032 * g(ad, 0, 16.5) * np.exp(-((z - mz) / .0015) ** 2)
    d -= .0013 * g(A, 17.5, 2.6) * g(z, 1.0857, .0035)
    d -= .0018 * g(ad, 0, 14.0) * g(z, 1.0712, .0032)
    # A rounded chin and a soft jaw.
    d += .0058 * g(ad, 0, 20.0) * g(z, 1.0555, .0085)
    d += .0018 * g(A, 68.0, 14.0) * g(z, 1.077, .012)
    # Full cheeks, cheekbones, young smile folds.
    d += .0048 * g(A, 34.0, 11.0) * g(z, 1.118, .012)
    d += .0042 * g(A, 50.0, 12.0) * g(z, 1.136, .010)
    fold = 14 + (1.106 - z) * 350
    d -= .0009 * g(A, fold, 2.2) * g(z, 1.098, .008)
    # The eye sockets and their openings, the brow drawn down: a frown.
    d -= .0060 * g(A, 25.5, 11.5) * g(z, 1.149, .0115)
    if opening:
        d -= .0068 * almond(ad, z, .0004)
    brow = 1.1700 - .0050 * g(A, 6, 7)
    d += (.0042 * np.exp(-((z - brow) / .0070) ** 2) * (1 - ss(30, 50, A)) *
          (.30 + .70 * ss(4, 15, A)))
    d -= .0008 * g(A, 3.4, 1.0) * g(z, 1.165, .0050)
    # Forehead and temples.
    d += .0020 * g(A, 22.0, 14.0) * g(z, 1.210, .020)
    d -= .0030 * g(A, 64.0, 9.0) * g(z, 1.185, .018)
    return d


def base_normal(ad, z):
    a = np.radians(np.asarray(ad, float))
    z = np.asarray(z, float)
    e = 1e-4
    du = base_point(a + e, z) - base_point(a - e, z)
    dv = base_point(a, z + e) - base_point(a, z - e)
    n = np.cross(du, dv)
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-12
    p = base_point(a, z)
    centre = np.stack([np.zeros_like(p[..., 0]), np.full_like(p[..., 0], .005),
                       np.clip(p[..., 2], 1.07, 1.24)], axis=-1)
    flip = np.sum((p - centre) * n, axis=-1) < 0
    n[flip] *= -1
    return n


def displaced(ad, z, opening=True, extra=0.0):
    ad = np.asarray(ad, float)
    z = np.asarray(z, float)
    p = base_point(np.radians(ad), z)
    n = base_normal(ad, z)
    return p + n * (features(ad, z, opening) + extra)[..., None]


def surface(ad, z, opening=True):
    return displaced(ad, z, opening), surface_normal(ad, z, opening=opening)


def surface_normal(ad, z, h=.05, hz=.0003, opening=True):
    ad = np.asarray(ad, float)
    z = np.asarray(z, float)
    du = displaced(ad + h, z, opening) - displaced(ad - h, z, opening)
    dv = displaced(ad, z + hz, opening) - displaced(ad, z - hz, opening)
    n = np.cross(du, dv)
    n /= np.linalg.norm(n, axis=-1, keepdims=True) + 1e-12
    q = displaced(ad, z, opening)
    centre = np.stack([np.zeros_like(q[..., 0]), np.full_like(q[..., 0], .005),
                       np.clip(q[..., 2], 1.07, 1.24)], axis=-1)
    flip = np.sum((q - centre) * n, axis=-1) < 0
    n[flip] *= -1
    return n


def skull():
    zs = np.concatenate([np.linspace(Z0, 1.06, 24)[:-1], np.linspace(1.06, 1.20, 170)[:-1],
                         np.linspace(1.20, Z1, 40)])
    ads = np.concatenate([np.linspace(-180, -60, 70, endpoint=False),
                          np.linspace(-60, 60, 260, endpoint=False),
                          np.linspace(60, 180, 70, endpoint=False)])
    AD, Z = np.meshgrid(ads, zs)
    P = displaced(AD, Z)
    return M.grid("inventor.head-sculpt", P, SKIN, cap0="pole", cap1="pole")


def neck():
    zs = np.linspace(.950, 1.100, 30)
    path = [(0, -.012 + .014 * (z - .95) / .15, z) for z in zs]
    rx = np.interp(zs, [.95, .99, 1.03, 1.06, 1.10], [.037, .034, .0318, .0315, .031])
    ry = np.interp(zs, [.95, .99, 1.03, 1.06, 1.10], [.035, .0315, .0302, .031, .032])
    return M.sweep("inventor.neck-sculpt", path, list(zip(rx, ry)), SKIN, n=64,
                   up=(1, 0, 0), caps=("flat", "flat"))


EAR_C = {s: (s * 86.0, 1.138) for s in (-1, 1)}


def ear(s):
    """A small ear: a C-shaped rolled helix round the hollow of the concha,
    the antihelix inside it, the tragus in front and a soft lobe; set at an
    angle to the skull so it stands off at the back."""
    ad, z = EAR_C[s]
    c = displaced(np.array(ad), np.array(z))
    n = base_normal(np.array(ad), np.array(z))
    up = np.array([0, -.26, 1.0])
    up /= np.linalg.norm(up)
    up -= n * up.dot(n)
    up /= np.linalg.norm(up)
    back = np.cross(up, n)
    if back[1] > 0:
        back = -back
    W, H = .0125, .0225
    rows_o, rows_i = [], []
    for r in np.linspace(0, 1, 30)[1:]:
        ro, ri = [], []
        for th in np.linspace(0, TAU, 72, endpoint=False):
            # th = 0 at the top, pi/2 at the back, pi at the lobe.
            sx, cy = math.sin(th), math.cos(th)
            x = (sx * W * (1.0 if sx > 0 else .70)) * r
            y = cy * H * r * (1.0 if cy > 0 else .92)
            helix_arc = ss(-.35, .15, sx + .55 * cy) if cy > -.6 else ss(.0, .6, sx)
            helix = .0040 * g(r, .87, .10) * helix_arc
            antihelix = .0016 * g(r, .55, .10) * ss(-.2, .4, sx) * (cy > -.75)
            concha = -.0020 * (1 - ss(.15, .55, r)) * ss(-.6, .2, sx)
            tragus = .0024 * g(r, .48, .14) * g(th, 1.5 * math.pi, .35)
            lobe = .0010 * g(cy, -1, .35) * ss(.4, .8, r)
            stand = .0026 * ss(-.3, 1.0, sx) * r
            h = .0018 + helix + antihelix + concha + tragus + lobe + stand
            ro.append(c + back * x + up * y + n * h)
            ri.append(c + back * x + up * y - n * .0040)
        rows_o.append(ro)
        rows_i.append(ri)
    o = M.solid_shell(f"inventor.ear-{s}", np.array(rows_o), np.array(rows_i), SKIN,
                      closed=True)
    return o


# ------------------------------------------------------------- eyes

def eye_patch(s, u, h, lift=0.0):
    """Points on the eye surface: the face as if it had no opening, sunk a
    little behind the lids, then rounded forward like an eyeball."""
    u = np.asarray(u, float)
    h = np.asarray(h, float)
    ad = s * (EYE_AD + u * EYE_HW)
    z = EYE_Z + h
    p = displaced(ad, z, opening=False)
    n = surface_normal(ad, z, opening=False)
    # The face normal at the eye's centre: the eyeball faces it.
    c = surface_normal(np.array([s * EYE_AD]), np.array([EYE_Z]), opening=False)[0]
    bulge = .0028 * np.clip(1 - u ** 2, 0, 1) * np.clip(1 - (h / .0075) ** 2, 0, 1)
    nn = n * .4 + c * .6
    nn /= np.linalg.norm(nn, axis=-1, keepdims=True)
    return p + nn * (bulge - .0016 + lift)[..., None], nn


def eye_white(s):
    us = np.linspace(-1.02, 1.02, 44)
    vs = np.linspace(0, 1, 18)
    U, Vv = np.meshgrid(us, vs)
    top = lid(np.clip(U, -1, 1), TOP_LID) + .0006
    bot = lid(np.clip(U, -1, 1), BOT_LID) - .0006
    Hh = bot + (top - bot) * Vv
    outer, nn = eye_patch(s, U, Hh)
    inner = outer - nn * .0014
    return M.solid_shell(f"inventor.eye-{s}", outer, inner, WHITE)


def pupil(s):
    """Iris, pupil and catchlight as one control: discs on the eye, clipped
    by the lids like a real iris."""
    parts = []
    # Metres to u across the opening at the eye's centre.
    k = 1 / (EYE_HW * .00108)
    for name, mat, r0, lift, off in (("iris", IRIS, .0068, .0003, (-.0008, -.0003)),
                                    ("pupil", PUPIL, .0030, .0006, (-.0008, -.0003)),
                                    ("shine", SHINE, .0011, .0009, (.0012, .0019))):
        ro, ri = [], []
        for rr in np.linspace(0, 1, 9)[1:]:
            a = np.linspace(0, TAU, 40, endpoint=False)
            x = off[0] + np.cos(a) * r0 * rr
            h = off[1] + np.sin(a) * r0 * rr
            u = x * k
            lo = lid(np.clip(u, -1, 1), BOT_LID) + .0003
            hi = lid(np.clip(u, -1, 1), TOP_LID) - .0002
            h = np.clip(h, lo, hi)
            o, nn = eye_patch(s, u, h, lift)
            ro.append(o)
            ri.append(o - nn * .0006)
        parts.append(M.solid_shell(f"inventor.{name}-{s}", np.array(ro), np.array(ri), mat,
                                   closed=True))
    return M.join(parts, f"inventor.pupil-{s}")


def lids(s):
    """Upper and lower lids (fused into the skin): a thick margin over the
    eye, rising into the socket."""
    out = []
    us = np.linspace(-1.12, 1.14, 46)
    for upper in (True, False):
        rows_o, rows_i = [], []
        for t in np.linspace(0, 1, 10):
            uu = np.clip(us, -1, 1)
            if upper:
                h = lid(uu, TOP_LID) + .0001 + t * .0062
                lift = .0038 * (1 - t) ** 1.3 + .0004
            else:
                h = lid(uu, BOT_LID) - .0001 - t * .0040
                lift = .0013 * (1 - t) ** 1.5 + .0002
            # Closing round the corners.
            corner = ss(.92, 1.13, np.abs(us))
            h = h * (1 - corner) + lid(np.sign(us), TOP_LID) * corner
            o, nn = eye_patch(s, us, h, lift)
            rows_o.append(o)
            rows_i.append(o - nn * .0042)
        out.append(M.solid_shell(f"inventor.lid-{'top' if upper else 'bottom'}-{s}",
                                 np.array(rows_o), np.array(rows_i), SKIN))
    return out


def lashes(s):
    """A dark lash line along the upper lid's margin with a flick at the
    outer corner (the winged liner of the portrait), a fine lower line."""
    us = np.linspace(-.92, 1.0, 34)
    h = lid(us, TOP_LID) + .0004
    pts, nn = eye_patch(s, us, h, .0041)
    pts = list(pts)
    up = np.array([0, 0, 1.0])
    out_dir = pts[-1] - pts[-4]
    out_dir /= np.linalg.norm(out_dir)
    pts.append(pts[-1] + out_dir * .0042 + up * .0020)
    pts = np.array(pts)
    t = np.linspace(0, 1, len(pts))
    w = .0006 + .0011 * ss(.15, .8, t) * (1 - ss(.94, 1.0, t))
    th = .0005 + .0005 * ss(.3, .9, t)
    top = M.sweep(f"inventor.lash-{s}", pts, list(zip(th, w)), LASH, n=10,
                  up=(0, 0, 1), caps=("dome", "dome"))
    us = np.linspace(.15, .98, 16)
    pts, _ = eye_patch(s, us, lid(us, BOT_LID) - .0005, .0016)
    low = M.sweep(f"inventor.lash-low-{s}", pts, [(.0003, .00035)] * len(pts), LASH, n=8,
                  up=(0, 0, 1), caps=("dome", "dome"))
    return [top, low]


BROW = [(6.0, 1.1588, .0035, .0019), (12.0, 1.1626, .0032, .0018),
        (20.0, 1.1664, .0028, .0016), (28.0, 1.1690, .0024, .0014),
        (36.0, 1.1696, .0019, .0012), (43.0, 1.1676, .0013, .0009),
        (48.5, 1.1650, .0004, .0004)]


def brow(s):
    """A thick brow lying on the brow ridge, its inner end drawn down."""
    rows = np.asarray(BROW)
    A = np.linspace(rows[0, 0], rows[-1, 0], 40)
    zc = np.interp(A, rows[:, 0], rows[:, 1])
    hh = np.interp(A, rows[:, 0], rows[:, 2])
    th = np.interp(A, rows[:, 0], rows[:, 3])
    ro, ri = [], []
    for v in np.linspace(-1, 1, 11):
        z = zc + v * hh
        ad = s * A
        p = displaced(ad, z)
        n = surface_normal(ad, z)
        # Hair-stroke ridges along the brow.
        stroke = .00018 * np.sin(v * 9 + A * .9)
        lift = th * np.sqrt(np.clip(1 - v * v, 0, 1)) * (1 - .15 * v) + .0002 + stroke
        ro.append(p + n * lift[:, None])
        ri.append(p - n * .0006)
    return M.solid_shell(f"inventor.brow-{s}", np.array(ro).transpose(1, 0, 2),
                         np.array(ri).transpose(1, 0, 2), HAIR)


def mouth_line():
    """The dark line between the lips, its corners set down a little."""
    A = np.linspace(-16.0, 16.0, 45)
    z = mouth_z(np.abs(A))
    half = .00080 * np.sqrt(np.clip(1 - (A / 16.0) ** 2, 0, 1)) + .00008
    ro, ri = [], []
    for v in np.linspace(-1, 1, 7):
        zz = z + v * half
        p = displaced(A, zz)
        n = surface_normal(A, zz)
        ro.append(p + n * .0003)
        ri.append(p - n * .0012)
    return M.solid_shell("inventor.mouth", np.array(ro).T.transpose(1, 2, 0)
                         if False else np.array(ro).transpose(1, 0, 2),
                         np.array(ri).transpose(1, 0, 2), MOUTH)


# ------------------------------------------------------------- hair

def hairline(A):
    A = np.asarray(A, float)
    return .0010 * np.sin(A * .31) + np.interp(A, [0, 14, 28, 40, 50, 58, 66, 74, 80, 88, 100, 112, 122, 140, 160, 180],
                     [1.207, 1.206, 1.201, 1.191, 1.176, 1.160, 1.150, 1.136, 1.146, 1.166,
                      1.166, 1.150, 1.122, 1.098, 1.085, 1.080])


PUFF = {s: np.array([s * .071, -.014, 1.284]) for s in (-1, 1)}
PUFF_R = .066


def hair_cap():
    """The pulled-up hair over the skull, combed from the hairline up to
    each puff, parted down the middle."""
    ads = np.linspace(-180, 180, 360, endpoint=False)
    A = np.abs(ads)
    z0 = hairline(A)
    side = np.where(ads >= 0, 1, -1)
    base = np.where(side[:, None] > 0, PUFF[1] - [0, 0, .045], PUFF[-1] - [0, 0, .045])
    rows = []
    for v in np.linspace(0, 1, 52)[:-1]:
        z = z0 + (Z1 - z0) * (1 - (1 - v) ** 1.4)
        q = displaced(ads, z)
        n = surface_normal(ads, z)
        th = .0003 + .0079 * ss(0, .45, v)
        # Grooves along the strands: lines of constant angle round the
        # nearer puff's base, so they all run up into it.
        rel = q - base
        phi = np.arctan2(rel[:, 1], rel[:, 0] * side)
        groove = .0011 * np.sin(phi * 46) * ss(.05, .3, v)
        # The centre part.
        part = (.0030 * g(ads, 0, 1.6) + .0030 * g(A, 180, 1.6)) * ss(.15, .5, v)
        rows.append(q + n * (th + groove - part)[:, None])
    top = np.array([0, -.002, Z1 + .0082])
    cap = M.grid("inventor.hair-cap", np.array(rows), HAIR, cap1=top)
    return M.solidify(cap, .0018)


def puff(s, seed):
    """A big round puff of tight curls: clustered coils over a sphere."""
    rng = np.random.default_rng(seed)
    o = M.icosphere(f"inventor.puff-{s}", PUFF_R, PUFF[s], HAIR, level=5)
    P = M.coords(o)
    c = PUFF[s]
    d = P - c
    r = np.linalg.norm(d, axis=1)
    u = d / r[:, None]
    # Coil clusters: about 170 rounded lumps on the surface.
    k = 95
    golden = math.pi * (3 - math.sqrt(5))
    i = np.arange(k)
    zc = 1 - 2 * (i + .5) / k
    rc = np.sqrt(1 - zc * zc)
    th = golden * i + rng.uniform(0, .4, k)
    centres = np.stack([rc * np.cos(th), rc * np.sin(th), zc], axis=1)
    centres += rng.normal(0, .05, centres.shape)
    centres /= np.linalg.norm(centres, axis=1, keepdims=True)
    # Overlapping soft lumps blended with a smooth maximum: hard-edged
    # lumps with gaps rendered as pits and holes in the puffs (9 October).
    size = rng.uniform(.26, .36, k)
    height = rng.uniform(.0040, .0068, k)
    soft = np.zeros(len(P))
    sharp = 700.0
    for j in range(k):
        dist = np.linalg.norm(u - centres[j], axis=1)
        bump = height[j] * np.clip(1 - (dist / size[j]) ** 2, 0, 1) ** 1.5
        soft += np.exp(sharp * bump)
    # log-sum-exp over the lumps (baseline exp(0) terms removed): a smooth
    # maximum, so neighbouring coils merge instead of leaving creases.
    lump = np.log(np.maximum(soft - (k - 1), 1)) / sharp + .0015
    # No fine coil texture: reduced to the runtime budget it broke into pits.
    fine = 0
    # Flatter where it meets the head, fuller at the top and outside.
    squash = 1 - .25 * ss(-.2, -.9, u[:, 2] * 1.0)
    rr = PUFF_R * squash + lump + fine
    M.set_coords(o, c + u * rr[:, None])
    return o


def puff_tie(s):
    c = PUFF[s] - np.array([s * .012, 0, .052])
    axis = np.array([s * .35, .0, 1.0])
    axis /= np.linalg.norm(axis)
    a = np.cross(axis, [0, 1, 0])
    a /= np.linalg.norm(a)
    b = np.cross(axis, a)
    ring = [c + (a * math.cos(t) + b * math.sin(t)) * .028 for t in np.linspace(0, TAU, 41)]
    return M.sweep(f"inventor.puff-tie-{s}", ring, [(.0032, .0052)] * 41, BAND, n=10,
                   up=tuple(axis), caps=(None, None))


def curls():
    """Corkscrew tendrils escaping at the temples and the nape, lying close
    against the skin."""
    out = []
    spots = [(-1, 67, .030, 0), (-1, 74, .022, 1), (1, 67, .030, 2), (1, 74, .022, 3),
             (-1, 158, .016, 4), (-1, 171, .013, 5), (1, 163, .015, 6), (1, 176, .012, 7)]
    for s_, A, length, k in spots:
        z0 = float(hairline(A)) + .002
        ts = np.linspace(0, 1, int(length / .0058 * 14) + 10)
        zs = z0 - ts * length
        ads = np.full_like(zs, s_ * A) + s_ * ts * (4 if A < 90 else -3)
        p = displaced(ads, zs)
        n = surface_normal(ads, zs)
        down = np.gradient(p, axis=0)
        down /= np.linalg.norm(down, axis=1, keepdims=True)
        side = np.cross(down, n)
        ang = ts * length / .0058 * TAU + k * 1.7
        rad = .0026 * (1 - .25 * ts)
        pts = p + n * (.0030 + np.cos(ang) * rad)[:, None] + side * (np.sin(ang) * rad)[:, None]
        rr = np.linspace(.00145, .0009, len(pts))
        out.append(M.sweep(f"inventor.curl-{k}", pts, list(rr), HAIR, n=8,
                           caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- goggles

def goggles():
    """Big brass goggles pushed up onto her hair, blue lenses catching the
    light, on a leather strap round her head."""
    out = []
    lenses = []
    tilt = math.radians(34)
    for s in (-1, 1):
        ad, z = s * 21.0, 1.213
        p = displaced(ad, z)
        n = surface_normal(ad, z)
        c = p + n * .0150
        axis = n * math.cos(.15) + np.array([0, 0, 1.0]) * math.sin(.15)
        axis = np.array([n[0] * .6, n[1] * math.cos(tilt), math.sin(tilt)])
        axis /= np.linalg.norm(axis)
        a = np.cross(axis, [0, 0, 1.0])
        if np.linalg.norm(a) < 1e-6:
            a = np.array([1.0, 0, 0])
        a /= np.linalg.norm(a)
        b = np.cross(axis, a)
        def ring(r, h):
            return [c + axis * h + (a * math.cos(t) + b * math.sin(t)) * r
                    for t in np.linspace(0, TAU, 49)]
        # Cup: a short brass cylinder, a rolled front bezel, a back gasket.
        rows_o = [ring(.0180, h) for h in np.linspace(-.008, .005, 6)]
        rows_i = [ring(.0146, h) for h in np.linspace(-.008, .005, 6)]
        out.append(M.solid_shell(f"inventor.goggle-cup-{s}", np.array(rows_o)[:, :-1],
                                 np.array(rows_i)[:, :-1], BRASS, closed=True))
        out.append(M.sweep(f"inventor.goggle-bezel-{s}", ring(.0168, .0060),
                           [.0026] * 49, BRASS, n=12, up=tuple(axis), caps=(None, None)))
        out.append(M.sweep(f"inventor.goggle-gasket-{s}", ring(.0175, -.0090),
                           [.0028] * 49, LEATHER_DARK, n=10, up=tuple(axis), caps=(None, None)))
        lens = []
        for rr in np.linspace(0, .0150, 8):
            lens.append([c + axis * (.0050 + .0020 * (1 - (rr / .0150) ** 2)) +
                         (a * math.cos(t) + b * math.sin(t)) * rr
                         for t in np.linspace(0, TAU, 48, endpoint=False)])
        lens = np.array(lens)
        back = lens - axis * .003
        out.append(M.solid_shell(f"inventor.goggle-lens-{s}", lens[1:], back[1:], LENS,
                                 closed=True))
        # Rivets round the bezel.
        for t in np.linspace(0, TAU, 6, endpoint=False):
            q = c + axis * .0035 + (a * math.cos(t) + b * math.sin(t)) * .0180
            out.append(M.ball(f"inventor.goggle-rivet-{s}-{t:.1f}", .0016, q, BRASS, seg=10, rings=5))
        lenses.append((c, axis, a, b))
    # The bridge between the cups.
    (c0, ax0, _, _), (c1, ax1, _, _) = lenses
    mid = (c0 + c1) / 2 + np.array([0, .004, .004])
    out.append(M.sweep("inventor.goggle-bridge", M.catmull([c0 + (c1 - c0) * .32, mid, c0 + (c1 - c0) * .68], 4),
                       [(.0032, .0020)] * 9, BRASS, n=10, up=(0, 1, 0), caps=("dome", "dome")))
    # The strap: from each cup's side round the back of the head.
    pts = []
    for A in np.linspace(-150, 150, 0):
        pass
    ads = np.concatenate([np.linspace(36, 180, 50), np.linspace(-180, -36, 50)[1:]])
    zz = np.interp(np.abs(ads), [36, 60, 90, 130, 180], [1.210, 1.205, 1.196, 1.188, 1.182])
    q = displaced(ads, zz) + surface_normal(ads, zz) * .0078
    strap = M.sweep("inventor.goggle-strap", q, [(.0020, .0062)] * len(q), LEATHER, n=8,
                    up=(0, 0, 1), caps=("flat", "flat"))
    out.append(strap)
    for s in (-1, 1):
        ad = s * 31
        q0 = displaced(np.array([s * 36.0]), np.array([1.210]))[0] + surface_normal(
            np.array([s * 36.0]), np.array([1.210]))[0] * .0078
        cup = lenses[0 if s < 0 else 1][0]
        out.append(M.sweep(f"inventor.goggle-strap-end-{s}", [q0, (q0 + cup) / 2, cup],
                           [(.0020, .0062)] * 3, LEATHER, n=8, up=(0, 0, 1), caps=("flat", "flat")))
    # A brass buckle on her left side.
    bq = displaced(np.array([-75.0]), np.array([1.205]))[0] + surface_normal(
        np.array([-75.0]), np.array([1.205]))[0] * .0098
    out.append(M.sweep("inventor.goggle-buckle", [bq + [0, -.006, -.006], bq + [0, -.006, .006],
                                                  bq + [0, .006, .006], bq + [0, .006, -.006],
                                                  bq + [0, -.006, -.006]],
                       [.0012] * 5, BRASS, n=8, caps=(None, None)))
    return out
