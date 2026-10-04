"""The Linebacker (figure id `linebacker`) as a collector's miniature: a
1950s American football player in hand-painted resin, a quick mini-tank.

A soft brown leather helmet with ear flaps and a single grey face bar, an
auburn ponytail out of the back; a team-colour jersey over huge shoulder
pads, white sleeve stripes and a white 7 on the chest and back; eye black
under her eyes, a set jaw; cream canvas pants to the knee over knee pads;
team socks with white bands; black cleats. Fists closed, ready to tackle.

Parts (figures.py has the contract), none with a rest rotation:

  linebacker      root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: jersey, pads, pants' seat
      head        pivot at the neck: head, helmet, ponytail
      armL, armR  pivots on the shoulders, the upper arms
        foreL/R   pivots at the elbows, forearms and fists

LINEBACKER_POSE=<name> turns the parts as the game would before the
previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp
from mathutils import Matrix

R = "linebacker"
T = kit.tint

SKIN = fk.SKINS["tan"]
HAIR = fk.HAIRS["auburn"]
JERSEY = fk.TEAM
STRIPE = fk.WHITE
PANTS = fk.CREAM
SOCK = fk.TEAM2
HELMET = "hide:" + T("linebacker-helmet", "#8a5530")
BAR = fk.STEEL

HIP_X, HIP_Z = 0.088, 0.6
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.19, 0.955
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.02)
UPPER, FORE = 0.235, 0.21
HEAD_DZ = 0.0

BODY = [(0.63, 0.118, 0.09, 0.09), (0.68, 0.124, 0.092, 0.088),
        (0.75, 0.142, 0.104, 0.094), (0.82, 0.162, 0.118, 0.104),
        (0.88, 0.2, 0.128, 0.118), (0.93, 0.238, 0.13, 0.13),
        (0.97, 0.232, 0.118, 0.12), (1.0, 0.18, 0.09, 0.09),
        (1.02, 0.07, 0.055, 0.055)]
BODY_P = 2.4


def body_point(a, z, extra=0.0):
    p = fk.ring_point(BODY, BODY_P, a, z, extra)
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    # The pads ride up into domes over each shoulder.
    p.z += 0.03 * gauss(z, 0.97, 0.03) * (gauss(ad, 68, 18) +
                                          gauss(ad, -68, 18))
    return p


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    below = lerp(knee, ankle, 0.22)
    P = [fk.limb(f"{R}-pant{sx}", [hip + V(0, 0, 0.05), lerp(hip, knee, 0.5),
                                   knee, below],
                 [0.07, 0.068, 0.062, 0.058], PANTS, n=12),
         fk.ball(f"{R}-kneepad{sx}", 1.0, knee + V(0, 0.032, 0.0), PANTS,
                 scale=(0.058, 0.04, 0.062), seg=10, rings=6),
         fk.limb(f"{R}-sock{sx}", [below + V(0, 0, 0.01), lerp(below, ankle,
                                                              0.5),
                                   V(ankle.x, ankle.y, 0.07)],
                 [0.05, 0.044, 0.04], SOCK, n=10)]
    for t in (0.18, 0.34):
        c = lerp(below, ankle, t)
        P.append(fk.limb(f"{R}-band{sx}{t}", [c - V(0, 0, 0.012),
                                              c + V(0, 0, 0.012)],
                         [0.05, 0.05], STRIPE, n=10))
    P += fk.shoe(f"{R}-cleat", sx, ankle, 8, fk.DARK, sole=fk.DARK,
                 length=1.05, width=1.05, height=1.1)
    # Studs under the sole.
    for k, (x, y) in enumerate(((-0.02, 0.1), (0.02, 0.1), (-0.02, 0.04),
                                (0.02, 0.04), (0, -0.04))):
        P.append(fk.ball(f"{R}-stud{sx}{k}", 0.009, V(ankle.x + x,
                                                      ankle.y + y, 0.004),
                         STRIPE, seg=6, rings=3))
    return P, hip


# ------------------------------------------------------------- torso

def jersey():
    n = 24
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-jersey", rings, JERSEY, start="pole", end="pole")]
    # The pants' seat and waistband below.
    rings = []
    for z, rx_, ry_ in ((0.5, 0.05, 0.045), (0.54, 0.105, 0.085),
                        (0.6, 0.128, 0.098), (0.66, 0.122, 0.094),
                        (0.69, 0.116, 0.088)):
        rings.append([V(x, y, z) for x, y, _ in fk.sup(18, rx_, ry_, 2.3)])
    P.append(fk.loft(f"{R}-seat", rings, PANTS, start="pole", end=None))
    belt = [[fk.ring_point(BODY, BODY_P, i / 22 * math.tau, z, 0.006)
             for i in range(22)] for z in (0.632, 0.648, 0.664)]
    P.append(fk.loft(f"{R}-belt", belt, fk.LEATHER))
    # A V collar trim.
    pts = [body_point(math.radians(a), 1.0 - 0.04 * math.cos(math.radians(a)),
                      0.003) for a in range(-60, 61, 15)]
    P.append(fk.tube(f"{R}-collar", pts, [0.008] * len(pts), STRIPE, n=5,
                     caps=("dome", "dome")))
    # The 7, front and back.
    for k, a in enumerate((0.0, math.pi)):
        sgn = 1 if a == 0 else -1
        def on(u, v, a=a, sgn=sgn):
            return body_point(a + sgn * u / 0.15, v, 0.004)
        bars = [((-0.045, 0.875), (0.045, 0.875)),
                ((0.045, 0.875), (-0.012, 0.77))]
        for j, (p0, p1) in enumerate(bars):
            P.append(fk.tube(f"{R}-seven{k}{j}", [on(*p0), on(*p1)],
                             [(0.021, 0.005)] * 2, STRIPE, n=4,
                             up=V(0, sgn, 0), caps=("flat", "flat")))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "f")


def hairline(a):
    return 9.0


def helmet():
    """A soft leather helmet: a padded crown in panels, flaps over the
    ears, a face bar."""
    P = []
    n, m = 26, 7

    def at(ad, t):
        z = lerp(1.17 - 0.06 * max(0.0, -math.cos(math.radians(ad))) -
                 0.03 * fk.gauss(abs(ad), 90, 22), 1.27, t)
        z = min(z, 1.265)
        lift = 0.016 + 0.004 * math.sin(math.radians(ad) * 4) ** 2
        return H.point(ad, z) + H.normal(ad, z) * lift
    cols = [i / n * 360 - 180 for i in range(n)]
    mesh = fk.Mesh(f"{R}-helmet", HELMET)
    rows = [[mesh.v(at(a, j / m)) for a in cols] for j in range(m)]
    mesh.grid(rows, HELMET, closed=True)
    mesh.fan(rows[-1], V(0, H.cy, 1.293))
    P.append(mesh.obj(outward=H.hc))
    # The brow band round its rim.
    rim = [at(a, 0.0) for a in cols]
    P.append(fk.tube(f"{R}-hrim", rim + [rim[0]], [0.008] * (n + 1), HELMET,
                     n=5, caps=(None, None)))
    # Ear flaps down to the jaw.
    for sx in (-1, 1):
        c = H.point(sx * 88, 1.13) + H.normal(sx * 88, 1.13) * 0.018
        P.append(fk.ball(f"{R}-flap{sx}", 1.0, c, HELMET,
                         scale=(0.016, 0.035, 0.05), seg=10, rings=6))
    # The face bar: from flap to flap across the chin.
    pts = [H.point(sx * a, z) + H.normal(sx * a, z) * d for sx, a, z, d in
           ((-1, 84, 1.12, 0.035), (-1, 45, 1.075, 0.034),
            (1, 0, 1.06, 0.032), (1, 45, 1.075, 0.034),
            (1, 84, 1.12, 0.035))]
    pts = kit.smooth_path(pts, samples=3)
    P.append(fk.tube(f"{R}-bar", pts, [0.0065] * len(pts), BAR, n=6,
                     caps=("dome", "dome")))
    # A raised ridge front to back over the crown.
    pts = [at(0, t) for t in (0.1, 0.4, 0.75)] + [V(0, H.cy, 1.296)] + \
        [at(180, t) for t in (0.75, 0.4, 0.1)]
    pts = kit.smooth_path(pts, samples=3)
    P.append(fk.tube(f"{R}-ridge", pts, [0.009] * len(pts), HELMET, n=6,
                     caps=("dome", "dome")))
    return P


def ponytail():
    base = H.point(180, 1.19) + V(0, -0.012, 0)
    pts = [base, base + V(0, -0.035, -0.035), base + V(0, -0.045, -0.1),
           base + V(0, -0.035, -0.17)]
    pts = kit.smooth_path(pts, samples=3)
    radii = [lerp(0.026, 0.01, i / (len(pts) - 1)) for i in range(len(pts))]
    return [fk.tube(f"{R}-tail", pts, radii, HAIR, n=8, caps=(None, "dome")),
            fk.ball(f"{R}-tietail", 0.022, base + V(0, -0.006, 0), JERSEY,
                    seg=8, rings=5)]


def head():
    P = [H.skull(SKIN, HAIR)]
    P += fk.eyes(H, frown=0.009, squint=0.78)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    # Eye black on the cheekbones.
    for sx in (-1, 1):
        pts = [(sx * 18, 1.132), (sx * 36, 1.134), (sx * 36, 1.124),
               (sx * 18, 1.122)]
        if sx < 0:
            pts = pts[::-1]
        P.append(fk.decal(f"{R}-eyeblack{sx}", H.point, pts, 0.004, fk.INK,
                          depth=0.001, eps=0.05, ref=H.hc))
    P += helmet() + ponytail()
    fk.transform(P, Matrix.Translation(V(0, 0, HEAD_DZ)))
    P.append(fk.neck(R, SKIN, r=0.045, bottom=0.96, top=1.09))
    return P


# ------------------------------------------------------------- arms

def arm(side):
    sx = 1 if side == "R" else -1
    s = S_R if sx > 0 else S_L
    e = s + V(sx * 0.2, 0.06, -1).normalized() * UPPER
    c = e + V(sx * 0.05, 0.45, -0.85).normalized() * (FORE + 0.04)
    w = c - (c - e).normalized() * 0.04
    up = (e - s).normalized()
    upper = [fk.ball(f"{R}-pad{side}", 1.0, s + V(sx * 0.02, 0, 0.0), JERSEY,
                     scale=(0.085, 0.09, 0.07), seg=12, rings=7),
             fk.limb(f"{R}-sleeve{side}", [s + up * 0.02, lerp(s, e, 0.5)],
                     [0.068, 0.064], JERSEY, n=12),
             fk.limb(f"{R}-stripe{side}", [lerp(s, e, 0.5),
                                           lerp(s, e, 0.62)],
                     [0.065, 0.064], STRIPE, n=12),
             fk.limb(f"{R}-sleeve2{side}", [lerp(s, e, 0.62), e],
                     [0.063, 0.058], JERSEY, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.04, e, SKIN, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.5), w + (w - e)
                                         .normalized() * 0.01],
                     [0.04, 0.036, 0.028], SKIN, n=10)]
    # White tape round the wrists.
    lower.append(fk.limb(f"{R}-tape{side}", [lerp(e, w, 0.82),
                                             w + (w - e).normalized() * 0.008],
                         [0.032, 0.03], STRIPE, n=10, caps=("flat", "flat")))
    hand = fk.hand(f"{R}-hand{side}", c, c - e, V(sx, 0.15, 0.05),
                   -1 if sx > 0 else 1, SKIN, scale=1.08)
    return upper, lower, hand, s, e, w


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="linebacker"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.094, 0.025, 0.36)
        ankle = V(sx * 0.1, 0.02, 0.09)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    torso = part("torso", jersey(), WAIST, root)
    pieces = head()
    hair = fk.take_parts(pieces, f"{R}-tail", f"{R}-tietail")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    part("hair", hair, H.point(180, 1.19) + V(0, -0.012, HEAD_DZ), head_obj)
    for side in ("R", "L"):
        upper, lower, hand, s, e, w = arm(side)
        a = part(f"arm{side}", upper, s, torso)
        f = part(f"fore{side}", lower, e, a)
        part(f"hand{side}", hand, w, f)
    return fk.finish(root, R, POSES)


POSES = {
    "tackle": {"torso": (-0.55, 0.25, 0), "head": (0.45, -0.2, 0),
               "armR": (1.2, 0, 0.4), "foreR": (-1.1, 0, 0),
               "armL": (0.6, 0, -0.5), "foreL": (-1.4, 0, 0),
               "legL": (0.7, 0, 0), "kneeL": (-0.6, 0, 0),
               "legR": (-0.5, 0, 0), "kneeR": (-0.3, 0, 0)},
    "ready": {"torso": (-0.3, 0, 0), "head": (0.25, 0, 0),
              "armR": (0.3, 0, 0.2), "foreR": (-0.6, 0, 0),
              "armL": (0.3, 0, -0.2), "foreL": (-0.6, 0, 0),
              "legL": (0.35, 0, -0.1), "kneeL": (-0.6, 0, 0),
              "legR": (0.35, 0, 0.1), "kneeR": (-0.6, 0, 0)},
}
