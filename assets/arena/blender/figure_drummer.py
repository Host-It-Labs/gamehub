"""The Drummer (figure id `drummer`) as a collector's miniature: a
Napoleonic regimental drummer in hand-painted resin, who never fights and
beats the time for his friends.

Drummers wore their regiment's colours reversed: a white coatee with a
team-colour plastron, collar and cuffs and light team lace chevrons up the
sleeves, short tails at the back; team trousers, black gaiters and shoes;
a bell-topped team shako with white cords, a brass plate and a white
pompom (not the Gunner's black stovepipe); a brass snare drum with team
hoops and white rope on his left hip, slung from a white strap; a stick in
each fist over the drum head.

Parts (figures.py has the contract), none with a rest rotation:

  drummer         root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: coat, strap
      head        pivot at the neck: head and shako
      extra       the drum, pivot at its strap hook on the left hip
      armL, armR  pivots on the shoulders, the upper arms
        foreL/R   pivots at the elbows
          offhand (left) / weapon (right): the sticks, pivots in the
                  fists (+x lifts the tip)

DRUMMER_POSE=<name> turns the parts as the game would before the previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp
from mathutils import Matrix

R = "drummer"
T = kit.tint

SKIN = fk.SKINS["fair"]
HAIR = fk.HAIRS["brown"]
COAT = fk.WHITE
FACING = fk.TEAM
LACE = fk.TEAM3
TROUSER = fk.TEAM2
SHAKO = fk.TEAM2
GAITER = fk.DARK
WOOD = "lacquer:" + T("drummer-stick", "#c48a4c")

HIP_X, HIP_Z = 0.088, 0.615
WAIST = V(0, 0, 0.67)
SH_X, SH_Z = 0.175, 0.985
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.035)
UPPER, FORE = 0.25, 0.225
HEAD_DZ = 0.012

BODY = [(0.6, 0.128, 0.1, 0.1), (0.66, 0.126, 0.096, 0.094),
        (0.73, 0.132, 0.1, 0.092), (0.81, 0.146, 0.108, 0.096),
        (0.88, 0.16, 0.11, 0.104), (0.94, 0.166, 0.104, 0.106),
        (0.975, 0.15, 0.09, 0.094), (1.005, 0.1, 0.07, 0.07),
        (1.03, 0.055, 0.05, 0.05)]
BODY_P = 2.35

# The drum: centre, axis (up through the batter head), radius, depth.
DRUM_C = V(-0.07, 0.19, 0.6)
DRUM_AX = V(0.18, 0.22, 1).normalized()
DRUM_R, DRUM_H = 0.125, 0.12
HOOK = V(-0.12, 0.1, 0.68)
TOP = DRUM_C + DRUM_AX * DRUM_H / 2


def body_point(a, z, extra=0.0):
    return fk.ring_point(BODY, BODY_P, a, z, extra)


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-trouser{sx}", [hip + V(0, 0, 0.05),
                                      lerp(hip, knee, 0.5), knee,
                                      lerp(knee, ankle, 0.2)],
                 [0.066, 0.062, 0.054, 0.052], TROUSER, n=12)]
    # Black gaiters from below the knee, buttoned on the outside.
    top = lerp(knee, ankle, 0.15)
    P.append(fk.limb(f"{R}-gaiter{sx}", [top, lerp(top, ankle, 0.5),
                                         V(ankle.x, ankle.y, 0.06)],
                     [0.054, 0.048, 0.047], GAITER, n=12,
                     caps=("flat", None)))
    for k in range(4):
        c = lerp(top, ankle, 0.15 + k * 0.2)
        P.append(fk.ball(f"{R}-gbutton{sx}{k}", 0.006,
                         c + V(sx * 0.05, 0.0, 0), fk.BRASS, seg=6, rings=3))
    P += fk.shoe(f"{R}-shoe", sx, ankle, 9, GAITER, sole=GAITER)
    return P, hip


# ------------------------------------------------------------- torso

def coat():
    n = 22
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-coat", rings, COAT, start="pole", end="pole")]

    # The team plastron down the front, buttoned both sides.
    def plastron(u, v):
        a = math.radians(lerp(-30, 30, u) * lerp(1.0, 0.75, v))
        return body_point(a, lerp(0.985, 0.7, v), 0.009)
    P.append(fk.sheet(f"{R}-plastron", plastron, [i / 6 for i in range(7)],
                      [0, 0.25, 0.5, 0.75, 1], FACING, rim=0.003,
                      inside=V(0, 0, 0.85)))
    for sx in (-1, 1):
        for k in range(5):
            z = lerp(0.95, 0.73, k / 4)
            a = math.radians(sx * 26 * lerp(1.0, 0.78, k / 4))
            P.append(fk.ball(f"{R}-button{sx}{k}", 0.0075,
                             body_point(a, z, 0.008), fk.BRASS,
                             scale=(1, 0.6, 1), seg=6, rings=3))
    # A standing team collar.
    ring = [V(math.sin(i / 16 * math.tau) * 0.062,
              math.cos(i / 16 * math.tau) * 0.058, 1.0) for i in range(16)]
    P.append(fk.loft(f"{R}-collar", [ring, [p + V(0, 0, 0.045) for p in
                                             ring]], FACING))
    # Short tails at the back with team turnbacks.
    for sx in (-1, 1):
        def tail(u, v, sx=sx):
            a = math.radians(sx * lerp(150, 178, u))
            return body_point(a, lerp(0.68, 0.5, v), 0.006 + 0.02 * v)
        P.append(fk.sheet(f"{R}-tail{sx}", tail, [0, 0.5, 1],
                          [0, 0.5, 1], COAT, rim=0.006, back=True,
                          rim_mat=FACING, inside=V(0, 0, 0.6)))
    # A white belt and the drum strap over the right shoulder.
    belt = [[body_point(i / n * math.tau, z, 0.005) for i in range(n)]
            for z in (0.66, 0.68, 0.7)]
    P.append(fk.loft(f"{R}-belt", belt, fk.CREAM))
    front = [HOOK + V(0.0, 0.0, 0.0)]
    for ad, z in ((-40, 0.76), (-12, 0.84), (14, 0.91), (36, 0.965)):
        front.append(body_point(math.radians(ad), z, 0.01))
    front.append(V(0.12, 0.0, 1.01))
    for ad, z in ((140, 0.95), (165, 0.86), (-165, 0.77), (-130, 0.7)):
        front.append(body_point(math.radians(ad), z, 0.01))
    front.append(HOOK + V(-0.03, -0.12, 0.0))
    path = kit.smooth_path(front, samples=3)
    P.append(fk.tube(f"{R}-strap", path, [(0.004, 0.016)] * len(path),
                     fk.CREAM, n=4, up=V(0, 0, 1), caps=("flat", "flat")))
    return P


def drum():
    """The snare: a brass shell, team hoops top and bottom, white rope
    zigzag between them, a white batter head."""
    P = []
    ax = DRUM_AX
    u = V(1, 0, 0) - ax * ax.x
    u.normalize()
    w = ax.cross(u)
    n = 24

    def ring(t, r):
        c = DRUM_C + ax * (t * DRUM_H / 2)
        return [c + (u * math.cos(i / n * math.tau) + w *
                     math.sin(i / n * math.tau)) * r for i in range(n)]
    P.append(fk.loft(f"{R}-shell", [ring(-0.8, DRUM_R), ring(0.8, DRUM_R)],
                     fk.BRASS))
    for t in (-1, 1):
        hoop = [ring(t * 0.86, DRUM_R + 0.008), ring(t * 1.0, DRUM_R + 0.01),
                ring(t * 1.0, DRUM_R - 0.004)]
        P.append(fk.loft(f"{R}-hoop{t}", hoop, FACING, closed=True))
        head = ring(t * 0.96, DRUM_R - 0.003)
        c = DRUM_C + ax * (t * 0.96 * DRUM_H / 2)
        if t > 0:
            P.append(fk.loft(f"{R}-batter", [head], fk.CREAM, end=c))
        else:
            P.append(fk.loft(f"{R}-snare", [head], FACING, start=c))
    # Rope tensioners: a zigzag round the shell.
    pts = []
    for k in range(13):
        a = k / 12 * math.tau
        t = 0.78 if k % 2 == 0 else -0.78
        c = DRUM_C + ax * (t * DRUM_H / 2)
        pts.append(c + (u * math.cos(a) + w * math.sin(a)) *
                   (DRUM_R + 0.006))
    P.append(fk.tube(f"{R}-rope", pts, [0.0045] * len(pts), fk.WHITE, n=4,
                     caps=(None, None)))
    # The hook on the strap.
    P.append(fk.ball(f"{R}-hook", 0.012, HOOK, fk.BRASS, seg=6, rings=4))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "m", scale=0.98)


def hairline(a):
    return fk.table([(0, 1.215), (40, 1.205), (70, 1.16), (90, 1.15),
                     (120, 1.11), (180, 1.08)], abs(a))


def shako():
    """A bell-topped shako: narrow at the head, wide at the crown, a short
    peak, white cords across the front, a brass plate, a white pompom."""
    P = []
    n = 24
    c = V(0, H.cy - 0.006, 1.2)
    prof = [(0.0, 0.085, 0.092), (0.02, 0.088, 0.094), (0.1, 0.098, 0.102),
            (0.16, 0.108, 0.11), (0.17, 0.108, 0.11)]
    rings = []
    for dz, rx_, ry_ in prof:
        rings.append([c + V(math.sin(i / n * math.tau) * rx_,
                            math.cos(i / n * math.tau) * ry_, dz)
                      for i in range(n)])
    top = c + V(0, 0, 0.17)
    P.append(fk.loft(f"{R}-shako", rings, SHAKO, end=top))
    # Brass band at the crown and a black lower band.
    def size(z):
        return fk.table([(p[0], p[1], p[2]) for p in prof], z)

    for k, (z0, z1, mat) in enumerate(((0.15, 0.17, fk.BRASS),
                                       (0.0, 0.022, fk.DARK))):
        band = []
        for z in (z0, z1):
            rx_, ry_ = size(z)
            band.append([c + V(math.sin(i / n * math.tau) * (rx_ + 0.003),
                               math.cos(i / n * math.tau) * (ry_ + 0.003),
                               z) for i in range(n)])
        P.append(fk.loft(f"{R}-sband{k}", band, mat))
    # The peak.
    def peak(u, v):
        a = math.radians(lerp(-75, 75, u))
        r = lerp(0.09, 0.15, v)
        return c + V(math.sin(a) * r, math.cos(a) * r * (1 + 0.15 * v),
                     -0.004 - 0.02 * v)
    P.append(fk.sheet(f"{R}-peak", peak, [i / 10 for i in range(11)],
                      [0, 0.5, 1], fk.DARK, rim=0.006, back=True,
                      inside=c + V(0, 0, 0.1)))
    # The brass plate and white cords swagged across the front.
    m = fk.basis(V(1, 0, 0), V(0, 0.15, 1).normalized(), V(0, -1, 0.15)
                 .normalized(), c + V(0, 0.108, 0.085))
    plate = [(0.0, -0.035), (0.03, -0.01), (0.026, 0.03), (0.0, 0.04),
             (-0.026, 0.03), (-0.03, -0.01)]
    P.append(fk.slab(f"{R}-plate", plate, 0.004, fk.BRASS, matrix=m))
    for k, dz in enumerate((0.03, 0.05)):
        pts = []
        for i in range(9):
            a = math.radians(lerp(-80, 80, i / 8))
            sag = 0.03 * math.cos(math.radians(lerp(-90, 90, i / 8)))
            r = 0.1 + 0.012 * (dz / 0.05)
            pts.append(c + V(math.sin(a) * r, math.cos(a) * r + 0.004,
                             dz + 0.035 - sag))
        P.append(fk.tube(f"{R}-cord{k}", pts, [0.0045] * 9, fk.WHITE, n=4,
                         caps=("dome", "dome")))
    P.append(fk.ball(f"{R}-pompom", 0.032, top + V(0, 0.07, 0.025),
                     fk.WHITE, scale=(1, 1, 1.1), seg=10, rings=6))
    P.append(fk.tube(f"{R}-stem", [top + V(0, 0.07, -0.01),
                                   top + V(0, 0.07, 0.01)], [0.014, 0.014],
                     fk.BRASS, n=8, caps=(None, None)))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P += fk.eyes(H, frown=0.007)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    P += shako()
    fk.transform(P, Matrix.Translation(V(0, 0, HEAD_DZ)))
    P.append(fk.neck(R, SKIN, r=0.045, bottom=0.97, top=1.09))
    return P


# ------------------------------------------------------------- arms

def arm(side):
    sx = 1 if side == "R" else -1
    s = S_R if sx > 0 else S_L
    # Each fist over the batter head, the stick tips meeting at its middle.
    c = TOP + V(0.1 if sx > 0 else -0.11, 0.0, 0.14)
    pole = s + V(sx * 0.5, -0.4, -0.3)
    e = fk.ik(s, c, UPPER, FORE + 0.04, pole)
    w = c - (c - e).normalized() * 0.04
    up = (e - s).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(0, 0, -0.018), COAT,
                     scale=(0.056, 0.058, 0.05), seg=10, rings=6),
             fk.limb(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5),
                                           e],
                     [0.054, 0.052, 0.047], COAT, n=12)]
    for k in range(3):
        t = 0.3 + k * 0.2
        p = lerp(s, e, t)
        upper.append(fk.limb(f"{R}-lace{side}{k}", [p - up * 0.008,
                                                    p + up * 0.008],
                             [0.056 - k * 0.002] * 2, LACE, n=12))
    lower = [fk.ball(f"{R}-elbow{side}", 0.046, e, COAT, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.6)],
                     [0.045, 0.043], COAT, n=12),
             fk.limb(f"{R}-cuff{side}", [lerp(e, w, 0.6),
                                         w + (w - e).normalized() * 0.005],
                     [0.05, 0.048], FACING, n=12, caps=(None, "flat"))]
    tip = TOP + V(sx * 0.02, 0.01, 0.01)
    g = (tip - c).normalized()
    lower += fk.hand(f"{R}-hand{side}", c, c - e, g, -sx, SKIN)
    stick = [fk.tube(f"{R}-stick{side}", [c - g * 0.05, tip],
                     [0.0095, 0.0055], WOOD, n=8, caps=("dome", None)),
             fk.ball(f"{R}-bead{side}", 0.011, tip, WOOD, seg=8, rings=5)]
    return upper, lower, stick, s, e, c


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="drummer"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.094, 0.02, 0.37)
        ankle = V(sx * 0.1, 0.02, 0.09)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    pieces = coat()
    tail_l = fk.take_parts(pieces, f"{R}-tail-1")
    tail_r = fk.take_parts(pieces, f"{R}-tail1")
    torso = part("torso", pieces, WAIST, root)
    part("skirtL", tail_l, V(-0.05, -0.085, 0.68), torso)
    part("skirtR", tail_r, V(0.05, -0.085, 0.68), torso)
    pieces = head()
    plume = fk.take_parts(pieces, f"{R}-pompom", f"{R}-stem")
    hat_parts = fk.take_parts(pieces, f"{R}-shako", f"{R}-sband",
                               f"{R}-peak", f"{R}-plate", f"{R}-cord")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    hat_obj = part("hat", hat_parts, V(0, H.cy - 0.006, 1.2 + HEAD_DZ), head_obj)
    part("antenna", plume, V(0, H.cy + 0.064, 1.36 + HEAD_DZ), hat_obj)
    part("extra", drum(), HOOK, torso)
    for side in ("R", "L"):
        upper, lower, stick, s, e, c = arm(side)
        hand = fk.take_parts(lower, f"{R}-hand{side}-")
        a = part(f"arm{side}", upper, s, torso)
        f = part(f"fore{side}", lower, e, a)
        h = part(f"hand{side}", hand, c - (c - e).normalized() * 0.04, f)
        part("weapon" if side == "R" else "offhand", stick, c, h, angle=40)
    return fk.finish(root, R, POSES, knee_z=0.37)


POSES = {
    "beatR": {"foreR": (0.5, 0, 0), "weapon": (0.5, 0, 0),
              "foreL": (-0.1, 0, 0), "head": (0.1, 0, 0)},
    "beatL": {"foreL": (0.5, 0, 0), "offhand": (0.5, 0, 0)},
    "walk": {"legL": (0.4, 0, 0), "kneeL": (-0.2, 0, 0),
             "legR": (-0.3, 0, 0), "extra": (0.05, 0, 0.05)},
}
