"""The Sumo (figure id `sumo`) as a collector's miniature: an Edo-era
sumo wrestler in hand-painted resin, the biggest troop on foot.

A huge round body on short thick legs set wide, bare skin; a team-colour
silk mawashi belt wound thick round the hips with a light team fringe of
stiff sagari cords at the front; black hair oiled back into a folded
topknot; a heavy brow set in a frown, teeth clenched. Both hands are open
for the slap, each on its own wrist joint.

Built at the usual figure size and scaled up by K at the end.

Parts (figures.py has the contract), none with a rest rotation:

  sumo            root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: the body and the mawashi
      head        pivot at the neck
      armL, armR  pivots on the shoulders, the upper arms
        foreL/R   pivots at the elbows
          offhand (left) / weapon (right): the open hands, pivots on the
                  wrists (+x tips the fingers up for a thrust)

SUMO_POSE=<name> turns the parts as the game would before the previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp
from mathutils import Matrix

R = "sumo"
T = kit.tint
K = 1.22

SKIN = fk.SKINS["warm"]
HAIR = fk.HAIRS["black"]
SILK = fk.TEAM
CORD = fk.TEAM3
BAND = fk.TEAM2

HIP_X, HIP_Z = 0.13, 0.5
WAIST = V(0, 0, 0.56)
SH_X, SH_Z = 0.25, 0.95
S_L, S_R = V(-SH_X, -0.01, SH_Z), V(SH_X, -0.01, SH_Z)
NECK = V(0, 0.0, 1.0)
UPPER, FORE = 0.19, 0.165
HEAD_DZ = -0.04

BODY = [(0.42, 0.16, 0.15, 0.14), (0.47, 0.22, 0.2, 0.17),
        (0.54, 0.255, 0.235, 0.19), (0.62, 0.275, 0.26, 0.2),
        (0.7, 0.28, 0.265, 0.2), (0.78, 0.275, 0.25, 0.195),
        (0.86, 0.268, 0.22, 0.19), (0.92, 0.255, 0.19, 0.18),
        (0.96, 0.225, 0.16, 0.16), (0.995, 0.15, 0.12, 0.12),
        (1.02, 0.08, 0.075, 0.075)]
BODY_P = 2.15


def body_point(a, z, extra=0.0):
    p = fk.ring_point(BODY, BODY_P, a, z, extra)
    ad = math.degrees(a)
    ad = ad - 360 if ad > 180 else ad
    # Heavy pecs over the belly, the crease beneath them.
    p.y += 0.022 * gauss(z, 0.875, 0.035) * (gauss(ad, 28, 16) +
                                             gauss(ad, -28, 16))
    p.y -= 0.012 * gauss(z, 0.82, 0.012) * (gauss(ad, 26, 20) +
                                            gauss(ad, -26, 20))
    return p


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-thigh{sx}", [hip + V(0, 0, 0.04), lerp(hip, knee, 0.5),
                                    knee],
                 [0.12, 0.118, 0.098], SKIN, n=14),
         fk.ball(f"{R}-knee{sx}", 0.096, knee, SKIN, seg=12, rings=7),
         fk.limb(f"{R}-calf{sx}", [knee, lerp(knee, ankle, 0.45),
                                   ankle + V(0, 0, 0.03)],
                 [0.095, 0.09, 0.062], SKIN, n=14)]
    # Bare broad feet, toes splayed.
    P += fk.shoe(f"{R}-foot", sx, ankle, 18, SKIN, sole=None, length=1.2,
                 width=1.5, height=1.05, heel=False)
    fwd = V(math.sin(math.radians(sx * 18)), math.cos(math.radians(18)), 0)
    side = V(fwd.y, -fwd.x, 0)
    for k in range(4):
        t = (k - 1.5) / 1.5
        at = V(ankle.x, ankle.y, 0.022) + fwd * (0.145 - 0.02 * abs(t)) + \
            side * (t * 0.045 * sx)
        P.append(fk.ball(f"{R}-toe{sx}{k}", 0.017, at, SKIN, seg=6,
                         rings=4))
    return P, hip


# ------------------------------------------------------------- torso

def body():
    n = 26
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-body", rings, SKIN, start="pole", end="pole")]
    # A navel.
    P.append(fk.ball(f"{R}-navel", 0.011, body_point(0, 0.7, -0.004),
                     fk.DARK, scale=(1, 0.5, 1.2), seg=6, rings=4))
    return P


def mawashi():
    """The belt: a thick band round the hips, the front panel and a knot
    at the back, and the stiff fringe of cords at the front."""
    P = []
    n = 26
    rings = []
    for z, off in ((0.41, 0.008), (0.425, 0.03), (0.6, 0.034),
                   (0.618, 0.012)):
        rings.append([body_point(i / n * math.tau, z, off) for i in range(n)])
    P.append(fk.loft(f"{R}-mawashi", rings, SILK))
    # The strip down between the legs, front and back.
    for k, a in enumerate((0.0, math.pi)):
        def strip(u, v, a=a):
            z = lerp(0.42, 0.33, v)
            w = lerp(0.08, 0.055, v) * u
            p = body_point(a, max(z, 0.43), 0.018)
            sgn = 1 if a == 0 else -1
            return V(w * sgn, p.y * lerp(1, 0.55, v), z)
        P.append(fk.sheet(f"{R}-strip{k}", strip, [-1, -0.5, 0, 0.5, 1],
                          [0, 0.5, 1], SILK, rim=0.01, back=True,
                          inside=V(0, 0, 0.38)))
    # A crotch block so the strip reads from below.
    P.append(fk.rbox(f"{R}-crotch", (0.11, 0.2, 0.08), V(0, 0, 0.37), SILK,
                     levels=2, crease=0.2))
    # The knot at the back.
    knot = body_point(math.pi, 0.53, 0.05)
    P.append(fk.rbox(f"{R}-knot", (0.13, 0.05, 0.12), knot, SILK, levels=2,
                     crease=0.3))
    P.append(fk.rbox(f"{R}-knotband", (0.06, 0.06, 0.13), knot, BAND,
                     levels=2, crease=0.3))
    # Sagari: stiff cords hanging from the front of the band.
    for k in range(9):
        ad = (k - 4) * 9.0
        top = body_point(math.radians(ad), 0.44, 0.04)
        bot = top + V(0, 0.012, -0.16 + 0.01 * abs(k - 4))
        P.append(fk.tube(f"{R}-cord{k}", [top, bot], [0.0085, 0.007], CORD,
                         n=5, caps=(None, "dome")))
    # A dark band over the top edge.
    rings = [[body_point(i / n * math.tau, z, 0.02) for i in range(n)]
             for z in (0.578, 0.6)]
    P.append(fk.loft(f"{R}-mband", rings, BAND))
    return P


# ------------------------------------------------------------- head

def disp(ad, z):
    """His face, with fuller cheeks and a heavier brow."""
    d = fk.his_disp(ad, z)
    a = abs(ad)
    d += 0.009 * gauss(a, 42, 16) * gauss(z, 1.11, 0.02)
    d += 0.004 * gauss(z, 1.172, 0.007) * gauss(a, 18, 14)
    return d


H = fk.head_of(R, "m", scale=1.04, disp=disp)


def hairline(a):
    return fk.table([(0, 1.215), (30, 1.21), (55, 1.185), (75, 1.15),
                     (95, 1.16), (120, 1.11), (180, 1.08)], abs(a))


def topknot():
    """The folded topknot: a short oiled loaf laid forward on the crown,
    tied at its root."""
    P = []
    base = V(0, H.cy - 0.03, 1.272)
    pts = [base + V(0, -0.035, -0.008), base + V(0, -0.01, 0.018),
           base + V(0, 0.035, 0.026), base + V(0, 0.075, 0.014)]
    P.append(fk.tube(f"{R}-mage", kit.smooth_path(pts, samples=3),
                     [(0.026, 0.022)] * len(kit.smooth_path(pts, samples=3)),
                     HAIR, n=10, up=V(1, 0, 0), caps=("dome", "dome")))
    P.append(fk.tube(f"{R}-tie", [base + V(0, -0.032, -0.006),
                                  base + V(0, -0.02, 0.006)],
                     [0.024, 0.024], IVORY_CORD, n=10, caps=(None, None)))
    return P


IVORY_CORD = fk.WHITE


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P.append(fk.hair_shell(H, f"{R}-hair", HAIR, hairline, th=0.01,
                           back=0.6))
    P += fk.eyes(H, frown=0.011, squint=0.74)
    P += fk.mouth(H, z=1.094, kind="grit")
    P += H.ears(SKIN)
    P += topknot()
    fk.transform(P, Matrix.Translation(V(0, 0, HEAD_DZ)))
    P.append(fk.neck(R, SKIN, r=0.085, bottom=0.93, top=1.08 + HEAD_DZ))
    return P


# ------------------------------------------------------------- arms

def arm(side):
    sx = 1 if side == "R" else -1
    s = S_R if sx > 0 else S_L
    e = s + V(sx * 0.62, 0.12, -1).normalized() * UPPER
    w = e + V(sx * 0.05, 0.75, -0.75).normalized() * FORE
    up = (e - s).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(sx * 0.01, 0, -0.02),
                     SKIN, scale=(0.098, 0.095, 0.09), seg=12, rings=7),
             fk.limb(f"{R}-upper{side}", [s + up * 0.02, lerp(s, e, 0.55), e],
                     [0.09, 0.084, 0.07], SKIN, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.074, e, SKIN, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.5), w],
                     [0.07, 0.064, 0.048], SKIN, n=12)]
    # The open hand hangs on with its palm in, fingers down.
    f = (w - e).normalized()
    c = w + f * 0.05
    hand = fk.palm(f"{R}-hand{side}", c, f, V(-sx, 0.0, -0.3), -sx, SKIN,
                   scale=1.55)
    return upper, lower, hand, s, e, w


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    fk.transform(pieces, Matrix.Scale(K, 4))
    return fk.part(R, name, pieces, pivot * K, par, angle=angle)


def build(root_name="sumo"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.17, 0.04, 0.29)
        ankle = V(sx * 0.18, 0.02, 0.075)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    belt = mawashi()
    cords = fk.take_parts(belt, f"{R}-cord")
    torso = part("torso", body() + belt, WAIST, root)
    part("extra", cords, V(0, 0.24, 0.44), torso)
    pieces = head()
    knot = fk.take_parts(pieces, f"{R}-mage", f"{R}-tie")
    head_obj = fk.face_head(R, pieces, NECK, torso, scale=K)
    part("hair", knot, V(0, H.cy - 0.03, 1.272 + HEAD_DZ), head_obj)
    for side in ("R", "L"):
        upper, lower, hand, s, e, w = arm(side)
        a = part(f"arm{side}", upper, s, torso)
        f = part(f"fore{side}", lower, e, a)
        part(f"hand{side}", hand, w, f)
    return fk.finish(root, R, POSES, knee_z=0.29 * K, ankle_z=0.09 * K)


POSES = {
    "slap": {"armR": (1.45, 0, 0.35), "foreR": (-0.15, 0, 0),
             "weapon": (1.1, 0, 0), "torso": (-0.1, -0.3, 0),
             "armL": (0.4, 0, -0.2), "foreL": (-0.6, 0, 0)},
    "stomp": {"legL": (0.2, 0, -0.55), "kneeL": (-0.5, 0, 0),
              "torso": (0, 0, 0.18), "armL": (0, 0, -0.5),
              "armR": (0, 0, 0.5)},
    "walk": {"legL": (0.35, 0, 0), "kneeL": (-0.25, 0, 0),
             "legR": (-0.25, 0, 0), "armL": (-0.2, 0, 0),
             "armR": (0.2, 0, 0)},
}
