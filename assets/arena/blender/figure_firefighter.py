"""The Firefighter (figure id `firefighter`) as a collector's miniature: a
1930s fire brigade man in hand-painted resin, who holds troops back with a
jet of water.

A tall brass helmet with a crested comb and a long back brim over the
neck; a team-colour double-breasted tunic with two rows of brass buttons
and a team-light collar, a black leather belt with a small axe in its
pouch; dark team trousers into tall black rubber boots; in both fists a
long brass nozzle, braced at the hip and aimed forward, its canvas hose
running back down past his right hip and trailing over the ground.

Parts (figures.py has the contract), none with a rest rotation:

  firefighter     root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: tunic, belt, axe, the hose behind
      head        pivot at the neck: head and helmet
      armR        pivot on the right shoulder, the whole arm
        weapon    the nozzle and the hose's first bend, pivot in the
                  right fist (+x raises the jet)
      armL        pivot on the left shoulder, the whole arm

Both fists hold the nozzle: turning both arms by the same angle about x
keeps them on it (the arms share one shoulder line along x).

FIREFIGHTER_POSE=<name> turns the parts as the game would before the
previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, lerp
from mathutils import Matrix

R = "firefighter"
T = kit.tint

SKIN = fk.SKINS["deep"]
HAIR = fk.HAIRS["black"]
TUNIC = fk.TEAM
TROUSER = fk.TEAM2
COLLAR = fk.TEAM3
BOOT = fk.DARK
HOSE = "weave:" + T("firefighter-hose", "#cdb48a")
RED = "lacquer:" + T("firefighter-red", "#c8402e")

HIP_X, HIP_Z = 0.092, 0.62
WAIST = V(0, 0, 0.68)
SH_X, SH_Z = 0.19, 0.995
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.04)
UPPER, FORE = 0.26, 0.235
HEAD_DZ = 0.014

BODY = [(0.56, 0.135, 0.11, 0.105), (0.62, 0.14, 0.112, 0.106),
        (0.68, 0.142, 0.112, 0.104), (0.76, 0.152, 0.12, 0.104),
        (0.84, 0.168, 0.126, 0.11), (0.91, 0.178, 0.122, 0.116),
        (0.96, 0.172, 0.108, 0.11), (0.995, 0.13, 0.08, 0.082),
        (1.03, 0.06, 0.054, 0.054)]
BODY_P = 2.35

# The nozzle: its axis, the right fist at its back, the left ahead on it.
D = V(-0.2, 1, 0.05).normalized()
GRIP_R = V(0.13, 0.17, 0.7)
GRIP_L = GRIP_R + D * 0.24


def body_point(a, z, extra=0.0):
    return fk.ring_point(BODY, BODY_P, a, z, extra)


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-trouser{sx}", [hip + V(0, 0, 0.05),
                                      lerp(hip, knee, 0.5), knee],
                 [0.07, 0.066, 0.06], TROUSER, n=12)]
    # Tall rubber boots, wide at the top.
    top = lerp(knee, ankle, -0.06)
    P.append(fk.limb(f"{R}-boot{sx}", [top + V(0, 0.005, 0),
                                       lerp(top, ankle, 0.5),
                                       V(ankle.x, ankle.y, 0.06)],
                     [0.068, 0.058, 0.054], BOOT, n=12, caps=(None, None)))
    rim = [top + V(math.sin(i / 14 * math.tau) * 0.068,
                   0.005 + math.cos(i / 14 * math.tau) * 0.068, 0)
           for i in range(14)]
    P.append(fk.tube(f"{R}-bootrim{sx}", rim + [rim[0]], [0.008] * 15, BOOT,
                     n=5, caps=(None, None)))
    P += fk.shoe(f"{R}-sole", sx, ankle, 8, BOOT, sole=BOOT, width=1.15,
                 height=1.15)
    return P, hip


# ------------------------------------------------------------- torso

def tunic():
    n = 22
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-tunic", rings, TUNIC, start="pole", end="pole")]
    # The double row of brass buttons and the front edge.
    for sx in (-1, 1):
        for k in range(5):
            z = lerp(0.95, 0.72, k / 4)
            P.append(fk.ball(f"{R}-button{sx}{k}", 0.009,
                             body_point(math.radians(sx * 22), z, 0.006),
                             fk.BRASS, scale=(1, 0.6, 1), seg=6, rings=3))
    edge = [body_point(math.radians(-12), z, 0.003) for z in
            (0.99, 0.9, 0.8, 0.7, 0.6)]
    P.append(fk.tube(f"{R}-edge", edge, [(0.004, 0.003)] * 5, TROUSER, n=4,
                     caps=("flat", "flat")))
    # A standing light collar.
    ring = [V(math.sin(i / 16 * math.tau) * 0.068,
              math.cos(i / 16 * math.tau) * 0.062, 1.005) for i in range(16)]
    P.append(fk.loft(f"{R}-collar", [ring, [p * 1.0 + V(0, 0, 0.04) for p in
                                             ring]], COLLAR))
    # A broad black belt with a brass buckle.
    belt = [[body_point(i / n * math.tau, z, 0.006) for i in range(n)]
            for z in (0.64, 0.66, 0.7, 0.72)]
    P.append(fk.loft(f"{R}-belt", belt, BOOT))
    P.append(fk.rbox(f"{R}-buckle", (0.045, 0.014, 0.05),
                     body_point(0, 0.68, 0.012), fk.BRASS, levels=1))
    # The small axe in a pouch on his left hip.
    hip = body_point(math.radians(-100), 0.66, 0.02)
    P.append(fk.rbox(f"{R}-pouch", (0.03, 0.06, 0.08), hip + V(-0.01, 0, 0),
                     fk.LEATHER, levels=2, crease=0.4))
    P.append(fk.tube(f"{R}-axehandle", [hip + V(-0.02, 0.0, -0.05),
                                        hip + V(-0.02, 0.0, 0.1)],
                     [0.011, 0.011], fk.LEATHER, n=6, caps=("flat", "flat")))
    P.append(fk.rbox(f"{R}-axehead", (0.016, 0.07, 0.035),
                     hip + V(-0.02, 0.02, 0.11), fk.STEEL, levels=1,
                     crease=0.7))
    return P


def hose_trail():
    """The hose down past his right hip to the ground, trailing behind."""
    pts = [GRIP_R + V(0.02, -0.07, -0.05), V(0.2, 0.04, 0.55),
           V(0.22, -0.06, 0.25), V(0.18, -0.2, 0.05), V(0.1, -0.4, 0.03),
           V(-0.02, -0.55, 0.03)]
    pts = kit.smooth_path(pts, samples=4)
    return [fk.tube(f"{R}-hose", pts, [0.032] * len(pts), HOSE, n=8,
                    caps=(None, "flat"))]


# ------------------------------------------------------------- head

H = fk.head_of(R, "m")


def hairline(a):
    return fk.table([(0, 1.2), (40, 1.19), (70, 1.16), (90, 1.15),
                     (120, 1.11), (180, 1.08)], abs(a))


def helmet():
    """The brass helmet: a dome, a tall comb crest front to back, a short
    peak and a long back brim over the neck."""
    P = []
    n = 26
    c = V(0, H.cy - 0.004, 1.2)
    prof = [(0.0, 0.088, 0.096, 0.104), (0.04, 0.087, 0.095, 0.103),
            (0.07, 0.078, 0.086, 0.094), (0.095, 0.06, 0.066, 0.074),
            (0.11, 0.035, 0.04, 0.045)]
    rings = []
    for dz, rx_, rf, rb in prof:
        ring = []
        for i in range(n):
            a = i / n * math.tau
            ring.append(c + V(math.sin(a) * rx_, math.cos(a) * (rf if
                                                                math.cos(a)
                                                                >= 0
                                                                else rb),
                              dz))
        rings.append(ring)
    P.append(fk.loft(f"{R}-dome", rings, fk.BRASS, end=c + V(0, 0, 0.116)))

    # The brim: short at the front, long and sloping at the back.
    def brim(u, v):
        a = u * math.tau
        back = max(0.0, -math.cos(a))
        r0 = fk.table([(0, 0.09), (1, 0.1)], back)
        reach = 0.03 + 0.09 * back ** 1.5
        r = r0 + reach * v
        return c + V(math.sin(a) * r * 1.0, math.cos(a) * r,
                     -0.004 - (0.012 + 0.05 * back) * v)
    P.append(fk.sheet(f"{R}-brim", brim, [i / 26 for i in range(27)],
                      [0, 0.5, 1], fk.BRASS, rim=0.006, back=True,
                      closed_u=False, inside=c + V(0, 0, 0.1)))
    # The comb crest along the top, front to back.
    crest = []
    for k in range(9):
        t = k / 8
        y = lerp(0.085, -0.095, t)
        z = 0.07 + 0.085 * math.sin(math.pi * lerp(0.15, 0.95, t)) ** 0.7
        crest.append(c + V(0, y, z))
    P.append(fk.tube(f"{R}-comb", crest, [(0.01, 0.034)] * len(crest),
                     fk.BRASS, n=6, up=V(0, 0, 1), caps=("flat", "flat")))
    # A badge on the front and a leather chin strap.
    m = fk.look(V(0, 1, 0.25), V(0, 0, 1), c + V(0, 0.094, 0.035))
    badge = [(math.cos(i / 10 * math.tau) * 0.022,
              math.sin(i / 10 * math.tau) * 0.026) for i in range(10)]
    P.append(fk.slab(f"{R}-badge", badge, 0.004, RED, matrix=m))
    strap = [H.point(sx * a, z) + H.normal(sx * a, z) * 0.006 for sx, a, z in
             ((-1, 80, 1.19), (-1, 70, 1.12), (-1, 35, 1.055),
              (1, 0, 1.04), (1, 35, 1.055), (1, 70, 1.12), (1, 80, 1.19))]
    strap = kit.smooth_path(strap, samples=3)
    P.append(fk.tube(f"{R}-chin", strap, [0.005] * len(strap), fk.LEATHER,
                     n=5, caps=("dome", "dome")))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P += fk.eyes(H, frown=0.008, iris=fk.INK)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    # A trim moustache.
    for sx in (-1, 1):
        pts = [H.point(sx * a, z) + H.normal(sx * a, z) * 0.004 for a, z in
               ((3, 1.107), (12, 1.104), (20, 1.098))]
        P.append(fk.tube(f"{R}-stache{sx}", pts, [0.0065, 0.008, 0.0055],
                         HAIR, n=6, caps=("dome", "dome")))
    P += helmet()
    fk.transform(P, Matrix.Translation(V(0, 0, HEAD_DZ)))
    P.append(fk.neck(R, SKIN, r=0.05, bottom=0.97, top=1.1))
    return P


# ------------------------------------------------------------- arms

def arm(side):
    sx = 1 if side == "R" else -1
    s = S_R if sx > 0 else S_L
    c = GRIP_R if sx > 0 else GRIP_L
    pole = s + (V(0.6, -0.5, -0.2) if sx > 0 else V(-0.6, -0.1, -0.4))
    e0 = fk.ik(s, c, UPPER, FORE + 0.042, pole)
    xax = (c - e0) - D * (c - e0).dot(D)
    xax.normalize()
    w = c - xax * 0.042
    e = fk.ik(s, w, UPPER, FORE, pole)
    up = (e - s).normalized()
    fo = (w - e).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(0, 0, -0.018), TUNIC,
                 scale=(0.062, 0.064, 0.054), seg=10, rings=6),
         fk.limb(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5), e,
                                       ], [0.058, 0.056, 0.05], TUNIC, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.05, e, TUNIC, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.6)],
                     [0.05, 0.048], TUNIC, n=12),
             fk.limb(f"{R}-cuff{side}", [lerp(e, w, 0.6), w + fo * 0.008],
                 [0.053, 0.05], COLLAR, n=12, caps=(None, "flat"))]
    hand = fk.hand(f"{R}-hand{side}", c, xax, D, -sx, BOOT, scale=1.1)
    return upper, lower, hand, s, e, w


def nozzle():
    """The brass branch pipe: a coupling at the hose end, a long cone, a
    red-lacquered grip, and the first bend of the hose behind it."""
    P = []
    back = GRIP_R - D * 0.06
    tip = GRIP_R + D * 0.44
    P.append(fk.tube(f"{R}-coupling", [back - D * 0.03, back + D * 0.02],
                     [0.042, 0.042], fk.BRASS, n=12, caps=("flat", None)))
    P.append(fk.tube(f"{R}-pipe", [back, lerp(back, tip, 0.5), tip],
                     [0.034, 0.026, 0.016], fk.BRASS, n=12,
                     caps=(None, "flat")))
    P.append(fk.tube(f"{R}-grip", [GRIP_L - D * 0.04, GRIP_L + D * 0.04],
                     [0.031, 0.029], RED, n=12, caps=("flat", "flat")))
    for t in (0.42, 0.85):
        p = lerp(back, tip, t)
        P.append(fk.tube(f"{R}-ring{t}", [p - D * 0.008, p + D * 0.008],
                         [0.034 - 0.012 * t] * 2, fk.BRASS, n=10,
                         caps=("flat", "flat")))
    hose = [back - D * 0.03, back - D * 0.08 + V(0.01, 0, -0.03),
            GRIP_R + V(0.02, -0.07, -0.05)]
    P.append(fk.tube(f"{R}-hosebend", kit.smooth_path(hose, samples=3),
                     [0.032] * len(kit.smooth_path(hose, samples=3)), HOSE,
                     n=8, caps=(None, None)))
    return P


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="firefighter"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.096, 0.02, 0.37)
        ankle = V(sx * 0.104, 0.02, 0.09)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    torso = part("torso", tunic(), WAIST, root)
    pieces = head()
    hat_parts = fk.take_parts(pieces, f"{R}-dome", f"{R}-badge",
                               f"{R}-comb", f"{R}-brim")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    part("hat", hat_parts, V(0, H.cy, 1.23 + HEAD_DZ), head_obj)
    for side in ("R", "L"):
        upper, lower, hand, s, e, w = arm(side)
        a = part(f"arm{side}", upper, s, torso)
        f = part(f"fore{side}", lower, e, a)
        h = part(f"hand{side}", hand, w, f)
        if side == "R":
            tool = part("weapon", nozzle(), GRIP_R, h, angle=40)
            hose = part("cape", hose_trail(), GRIP_R + V(0.02, -0.07, -0.05), tool)
            fk.cloth_below(hose, f"{R}.cape2", 0.3, V(0.22, -0.06, 0.3))
    return fk.finish(root, R, POSES, knee_z=0.37)


POSES = {
    "spray": {"armR": (0.5, 0, 0), "armL": (0.5, 0, 0),
              "torso": (0.08, 0, 0), "legL": (0.3, 0, 0),
              "kneeL": (-0.35, 0, 0), "legR": (-0.25, 0, 0)},
    "walk": {"legL": (0.4, 0, 0), "kneeL": (-0.2, 0, 0),
             "legR": (-0.3, 0, 0), "armL": (0.1, 0, 0),
             "armR": (0.1, 0, 0)},
}
