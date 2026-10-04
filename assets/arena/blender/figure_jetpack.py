"""The Jetpack (figure id `jetpack`) as a collector's miniature: a 1960s
space-age rocketeer in hand-painted resin, who flies.

A glass bubble helmet (a pale tinted shell round the back of her head and
a chrome rim round the open front, so her face reads) over a short dark
bob; a silver-white flight suit with a team-colour yoke, chest chevron,
belt, gloves and boots; on her back two chrome rocket tanks with
team-colour fins and glowing flames under their nozzles; a chrome ray gun
with red fins in her right hand.

Parts (figures.py has the contract), none with a rest rotation:

  jetpack         root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: suit and the jetpack
      extra       the flames, pivot at the nozzles
      head        pivot at the neck: head, hair and bubble
      armR        the upper arm
        foreR     elbow, forearm and glove
          weapon  the ray gun, pivot in the fist
      armL        the whole left arm

JETPACK_POSE=<name> turns the parts as the game would before the
previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp
from mathutils import Matrix

R = "jetpack"
T = kit.tint

SKIN = fk.SKINS["warm"]
HAIR = fk.HAIRS["black"]
SUIT = "lacquer:" + T("jetpack-suit", "#e9edf1")
TEAM = fk.TEAM
DARKTEAM = fk.TEAM2
CHROME = fk.STEEL
GLASS = "lacquer:" + T("jetpack-glass", "#b9e3f0")
FLAME = "glow:" + T("jetpack-flame", "#ffb444")
RAY = "glow:" + T("jetpack-ray", "#7cf3ff")
FIN = "lacquer:" + T("jetpack-fin", "#d8432f")

HIP_X, HIP_Z = 0.082, 0.61
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.158, 0.952
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.018)
UPPER, FORE = 0.235, 0.21

BODY = [(0.56, 0.12, 0.094, 0.1), (0.62, 0.121, 0.092, 0.096),
        (0.68, 0.116, 0.088, 0.088), (0.75, 0.126, 0.094, 0.088),
        (0.81, 0.138, 0.104, 0.09), (0.86, 0.146, 0.108, 0.094),
        (0.91, 0.15, 0.1, 0.097), (0.94, 0.146, 0.092, 0.094),
        (0.965, 0.13, 0.08, 0.082), (0.99, 0.092, 0.064, 0.064),
        (1.01, 0.05, 0.047, 0.047)]
BODY_P = 2.3
TANK_X = 0.068
NOZZLE_Z = 0.66


def body_point(a, z, extra=0.0):
    p = fk.ring_point(BODY, BODY_P, a, z, extra)
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    p.y += 0.016 * gauss(z, 0.83, 0.04) * (gauss(ad, 24, 17) +
                                           gauss(ad, -24, 17))
    return p


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-leg{sx}", [hip + V(0, 0, 0.05), lerp(hip, knee, 0.5),
                                  knee, lerp(knee, ankle, 0.4)],
                 [0.066, 0.06, 0.05, 0.046], SUIT, n=12)]
    # Team moon boots with a white turned-down cuff.
    top = lerp(knee, ankle, 0.42)
    P.append(fk.limb(f"{R}-boot{sx}", [top, V(ankle.x, ankle.y, 0.07)],
                     [0.055, 0.052], TEAM, n=12, caps=(None, None)))
    P.append(fk.limb(f"{R}-bootcuff{sx}", [top - V(0, 0, 0.015),
                                           top + V(0, 0, 0.012)],
                     [0.062, 0.062], SUIT, n=12, caps=("flat", "flat")))
    P += fk.shoe(f"{R}-sole", sx, ankle, 6, TEAM, sole=DARKTEAM, width=1.12,
                 height=1.15, heel=False)
    return P, hip


# ------------------------------------------------------------- torso

def suit():
    n = 22
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-suit", rings, SUIT, start="pole", end="pole")]
    # The team yoke over the shoulders.
    rows = [[body_point(i / n * math.tau, z, 0.004) for i in range(n)]
            for z in (0.92, 0.945, 0.97, 0.99)]
    P.append(fk.loft(f"{R}-yoke", rows, TEAM))

    # A chevron down the chest.
    def chev(u, v):
        a = math.radians(lerp(-34, 34, u))
        z = 0.86 - 0.07 * (1 - abs(u - 0.5) * 2) + 0.03 * v
        return body_point(a, z, 0.005)
    P.append(fk.sheet(f"{R}-chevron", chev, [i / 8 for i in range(9)],
                      [0, 1], TEAM, rim=0.003, inside=V(0, 0, 0.82)))
    belt = [[body_point(i / n * math.tau, z, 0.006) for i in range(n)]
            for z in (0.64, 0.66, 0.685)]
    P.append(fk.loft(f"{R}-belt", belt, DARKTEAM))
    P.append(fk.ball(f"{R}-buckle", 0.022, body_point(0, 0.662, 0.012),
                     CHROME, scale=(1.2, 0.5, 1), seg=10, rings=5))
    # The seat.
    rings = []
    for z, rx_, ry_ in ((0.5, 0.06, 0.05), (0.54, 0.11, 0.085),
                        (0.6, 0.122, 0.096)):
        rings.append([V(x, y, z) for x, y, _ in fk.sup(18, rx_, ry_, 2.3)])
    P.append(fk.loft(f"{R}-seat", rings, SUIT, start="pole", end=None))
    return P + jetpack()


def jetpack():
    """Two chrome tanks with round tops, fins, nozzles and a harness."""
    P = []
    y0 = -0.155
    for sx in (-1, 1):
        x = sx * TANK_X
        P.append(fk.tube(f"{R}-tank{sx}", [V(x, y0, NOZZLE_Z + 0.06),
                                           V(x, y0, 0.98)],
                         [0.058, 0.058], CHROME, n=14,
                         caps=("flat", "dome")))
        P.append(fk.tube(f"{R}-nozzle{sx}", [V(x, y0, NOZZLE_Z + 0.07),
                                             V(x, y0, NOZZLE_Z)],
                         [0.04, 0.05], fk.DARK, n=12, caps=(None, None)))
        P.append(fk.tube(f"{R}-band{sx}", [V(x, y0, 0.84), V(x, y0, 0.865)],
                         [0.061, 0.061], TEAM, n=14, caps=(None, None)))
        # A swept fin on the outside of each tank.
        m = fk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), V(x + sx * 0.05,
                                                            y0, 0.0))
        fin = [(0.03, 0.7), (-0.06, 0.66), (-0.05, 0.78), (0.01, 0.88),
               (0.03, 0.88)]
        if sx < 0:
            fin = fin[::-1]
        P.append(fk.slab(f"{R}-fin{sx}", fin, 0.012 * sx, TEAM, matrix=m))
    P.append(fk.rbox(f"{R}-pack", (0.15, 0.05, 0.22), V(0, y0 + 0.04, 0.84),
                     DARKTEAM, levels=2, crease=0.5))
    for sx in (-1, 1):
        pts = [body_point(math.radians(sx * 32), 0.78, 0.006),
               body_point(math.radians(sx * 40), 0.9, 0.006),
               V(sx * 0.09, -0.01, 0.985),
               body_point(math.radians(sx * 150), 0.92, 0.006)]
        pts = kit.smooth_path(pts, samples=3)
        P.append(fk.tube(f"{R}-harness{sx}", pts,
                         [(0.004, 0.013)] * len(pts), DARKTEAM, n=4,
                         up=V(0, 0, 1), caps=("flat", "flat")))
    return P


def flames():
    P = []
    for sx in (-1, 1):
        x = sx * TANK_X
        P.append(fk.tube(f"{R}-flame{sx}", [V(x, -0.155, NOZZLE_Z - 0.005),
                                            V(x, -0.16, NOZZLE_Z - 0.09),
                                            V(x, -0.165, NOZZLE_Z - 0.2)],
                         [0.04, 0.03, 0.006], FLAME, n=10,
                         caps=(None, "dome")))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "f")


def hairline(a):
    return fk.table([(0, 1.215), (25, 1.2), (60, 1.15), (85, 1.1),
                     (120, 1.06), (180, 1.05)], abs(a))


def bob():
    """A short dark bob with a fringe, curling under at the jaw."""
    P = [fk.hair_shell(H, f"{R}-bob", HAIR, hairline, th=0.02, back=1.2)]
    return P


def bubble():
    """The glass bubble: a pale tinted shell round the back of the head,
    open at the front with a chrome rim, a chrome collar at the neck and a
    little antenna."""
    P = []
    c = fk.HC + V(0, 0.0, 0.01)
    rr = 0.15
    th0 = math.radians(62)
    zcut = c.z - 0.115
    n, m = 22, 8

    def sp(th, ph, r):
        p = c + V(math.sin(th) * math.cos(ph) * r, math.cos(th) * r,
                  math.sin(th) * math.sin(ph) * r)
        if p.z < zcut:
            p.z = zcut
        return p
    for label, r, out in (("glass", rr, True), ("glassin", rr - 0.006,
                                                 False)):
        mesh = fk.Mesh(f"{R}-{label}", GLASS)
        rows = [[mesh.v(sp(lerp(th0, math.pi * 0.985, j / m),
                           i / n * math.tau, r)) for i in range(n)]
                for j in range(m + 1)]
        mesh.grid(rows, GLASS, closed=True)
        mesh.fan(rows[-1], sp(math.pi, 0, r))
        P.append(mesh.obj(outward=c) if out else mesh.obj(inward=c))
    ring = [sp(th0, i / n * math.tau, rr - 0.003) for i in range(n)]
    P.append(fk.tube(f"{R}-rim", ring + [ring[0]], [0.009] * (n + 1),
                     CHROME, n=6, caps=(None, None)))
    neck = [V(math.cos(i / n * math.tau) * 0.11, c.y + math.sin(i / n *
                                                                 math.tau)
              * 0.105, zcut + 0.004) for i in range(n)]
    P.append(fk.tube(f"{R}-collar", neck + [neck[0]], [0.016] * (n + 1),
                     CHROME, n=6, caps=(None, None)))
    a0 = c + V(0.07, -0.05, rr - 0.03)
    P.append(fk.tube(f"{R}-antenna", [a0, a0 + V(0.02, -0.02, 0.09)],
                     [0.0045, 0.003], CHROME, n=5, caps=(None, None)))
    P.append(fk.ball(f"{R}-antennatip", 0.012, a0 + V(0.02, -0.02, 0.095),
                     FIN, seg=8, rings=5))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P += bob()
    P += fk.eyes(H, frown=0.008)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    P += bubble()
    P.append(fk.neck(R, SKIN, r=0.04))
    return P


# ------------------------------------------------------------- arms

E_R = S_R + V(0.12, 0.25, -0.95).normalized() * UPPER
C_R = E_R + V(0.02, 0.95, 0.1).normalized() * (FORE + 0.04)
E_L = S_L + V(-0.2, -0.02, -1).normalized() * UPPER
C_L = E_L + V(-0.12, 0.35, -0.92).normalized() * (FORE + 0.04)


def arm_pieces(side, s, e, c):
    w = c - (c - e).normalized() * 0.04
    up = (e - s).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(0, 0, -0.018), TEAM,
                     scale=(0.05, 0.052, 0.045), seg=10, rings=6),
             fk.limb(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5),
                                           e],
                     [0.047, 0.045, 0.041], SUIT, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.041, e, SUIT, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.55)],
                     [0.04, 0.038], SUIT, n=12),
             fk.limb(f"{R}-glove{side}", [lerp(e, w, 0.5),
                                          w + (w - e).normalized() * 0.01],
                     [0.048, 0.034], TEAM, n=12, caps=("flat", None))]
    return upper, lower


def ray_gun():
    """A chrome ray gun: a round body, rings down a short barrel, red fins
    and a glowing tip, its grip in the fist."""
    P = []
    d = V(0, 1, 0.05).normalized()
    c = C_R + V(0, 0.0, 0.035)
    P.append(fk.tube(f"{R}-gunbody", [c - d * 0.05, c + d * 0.02],
                     [0.026, 0.03], CHROME, n=12, caps=("dome", None)))
    P.append(fk.tube(f"{R}-barrel", [c + d * 0.02, c + d * 0.12],
                     [0.016, 0.012], CHROME, n=10, caps=(None, None)))
    for k in range(3):
        p = c + d * (0.04 + k * 0.028)
        P.append(fk.tube(f"{R}-gring{k}", [p - d * 0.006, p + d * 0.006],
                         [0.021 - k * 0.002] * 2, FIN, n=10,
                         caps=("flat", "flat")))
    P.append(fk.ball(f"{R}-raytip", 0.016, c + d * 0.13, RAY, seg=10,
                     rings=6))
    m = fk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0), V(c.x - 0.003, 0, 0))
    fin = [(c.y - 0.05, c.z + 0.02), (c.y - 0.01, c.z + 0.02),
           (c.y - 0.06, c.z + 0.065)]
    P.append(fk.slab(f"{R}-gunfin", fin, 0.006, FIN, matrix=m))
    return P


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="jetpack"):
    assert root_name == R
    root = kit.empty(R)
    # Legs hang a little bent and together, as in flight.
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.084, 0.05, 0.36)
        ankle = V(sx * 0.09, -0.01, 0.09)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    torso = part("torso", suit(), WAIST, root)
    part("extra", flames(), V(0, -0.155, NOZZLE_Z), torso, angle=60)
    pieces = head()
    antenna = fk.take_parts(pieces, f"{R}-antenna")
    hair = fk.take_parts(pieces, f"{R}-bob")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    part("antenna", antenna, fk.HC + V(0.07, -0.062, 0.12), head_obj)
    part("hair", hair, V(0, H.cy, 1.225), head_obj)
    upper, lower = arm_pieces("R", S_R, E_R, C_R)
    lower += fk.hand(f"{R}-handR", C_R, C_R - E_R, V(0, -0.2, 1), -1, TEAM,
                     scale=1.05)
    hand = fk.take_parts(lower, f"{R}-handR-")
    a = part("armR", upper, S_R, torso)
    f = part("foreR", lower, E_R, a)
    h = part("handR", hand, C_R - (C_R - E_R).normalized() * 0.04, f)
    part("weapon", ray_gun(), C_R, h, angle=40)
    upper, lower = arm_pieces("L", S_L, E_L, C_L)
    lower += fk.hand(f"{R}-handL", C_L, C_L - E_L, V(1, 0.2, 0), 1, TEAM,
                     scale=1.05)
    hand = fk.take_parts(lower, f"{R}-handL-")
    a = part("armL", upper, S_L, torso)
    f = part("foreL", lower, E_L, a)
    part("handL", hand, C_L - (C_L - E_L).normalized() * 0.04, f)
    return fk.finish(root, R, POSES)


POSES = {
    "fly": {"legL": (0.35, 0, 0), "kneeL": (-0.7, 0, 0),
            "legR": (0.1, 0, 0), "kneeR": (-0.4, 0, 0),
            "torso": (-0.2, 0, 0), "armL": (-0.3, 0, -0.3)},
    "shoot": {"legL": (0.35, 0, 0), "kneeL": (-0.7, 0, 0),
              "legR": (0.1, 0, 0), "kneeR": (-0.4, 0, 0),
              "armR": (0.75, 0, 0), "foreR": (0.4, 0, 0),
              "weapon": (-0.2, 0, 0)},
}
