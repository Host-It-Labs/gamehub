"""The Explorer (figure id `explorer`) as a collector's miniature: a 1910s
polar explorer in hand-painted resin, whose frost shots slow what they hit.

A team-colour gabardine parka to mid-thigh with its hood up, a thick
cream fur ruff framing her face, brass goggles with blue lenses pushed up
on the hood; a fur hem and fur cuffs; dark team trousers into cream fur
mukluks; brown leather mittens; in both hands a frost rifle: a wooden stock,
a brass action, a barrel wound with a glowing ice coil and a frosted
muzzle.

Parts (figures.py has the contract), none with a rest rotation:

  explorer        root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: parka, belt, hem
      head        pivot at the neck: head, hood, ruff, goggles
      armR        pivot on the right shoulder, the whole arm
        weapon    the rifle, pivot in the right fist (+x raises the muzzle)
      armL        pivot on the left shoulder, the whole arm

Both mittens hold the rifle: turning both arms by the same angle about x
keeps them on it (the shoulders share one line along x).

EXPLORER_POSE=<name> turns the parts as the game would before the
previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, gauss, lerp
from mathutils import Matrix

R = "explorer"
T = kit.tint

SKIN = fk.SKINS["fair"]
HAIR = fk.HAIRS["brown"]
PARKA = fk.TEAM
TROUSER = fk.TEAM2
FUR = "weave:" + T("explorer-fur", "#ece1cb")
MITT = fk.LEATHER
WOOD = "lacquer:" + T("explorer-stock", "#9a5f35")
ICE = "glow:" + T("explorer-ice", "#86e4ff")
LENS = "lacquer:" + T("explorer-lens", "#4fa7d6")

HIP_X, HIP_Z = 0.086, 0.6
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.17, 0.95
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.015)
UPPER, FORE = 0.235, 0.215

BODY = [(0.4, 0.17, 0.142, 0.15), (0.48, 0.162, 0.134, 0.14),
        (0.56, 0.152, 0.124, 0.128), (0.64, 0.146, 0.118, 0.118),
        (0.72, 0.152, 0.122, 0.114), (0.8, 0.162, 0.13, 0.116),
        (0.86, 0.17, 0.13, 0.12), (0.91, 0.172, 0.122, 0.12),
        (0.945, 0.16, 0.108, 0.11), (0.975, 0.12, 0.085, 0.085),
        (1.0, 0.065, 0.055, 0.055)]
BODY_P = 2.25
HEM = 0.4

# The rifle: its axis, the right mitten at the wrist of the stock, the
# left forward under the barrel.
D = V(-0.22, 1, 0.32).normalized()
GRIP_R = V(0.12, 0.13, 0.68)
GRIP_L = GRIP_R + D * 0.27


def body_point(a, z, extra=0.0):
    p = fk.ring_point(BODY, BODY_P, a, z, extra)
    # Soft quilted folds down the parka.
    p += V(math.sin(a), math.cos(a), 0) * 0.004 * math.sin(a * 9) * \
        fk.smooth(0.75, HEM, z)
    return p


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-trouser{sx}", [hip + V(0, 0, 0.05),
                                      lerp(hip, knee, 0.5), knee],
                 [0.068, 0.064, 0.058], TROUSER, n=12)]
    # Fur mukluks up to the calf, tied with a thong.
    top = lerp(knee, ankle, 0.25)
    P.append(fk.limb(f"{R}-mukluk{sx}", [top, lerp(top, ankle, 0.5),
                                         V(ankle.x, ankle.y, 0.06)],
                     [0.066, 0.058, 0.056], FUR, n=12, flute=0.05,
                     caps=(None, None)))
    P.append(fk.limb(f"{R}-thong{sx}", [lerp(top, ankle, 0.35) - V(0, 0,
                                                                  0.008),
                                        lerp(top, ankle, 0.35) + V(0, 0,
                                                                   0.008)],
                     [0.064, 0.064], fk.LEATHER, n=12))
    P += fk.shoe(f"{R}-foot", sx, ankle, 8, FUR, sole=fk.LEATHER,
                 width=1.2, height=1.15, heel=False)
    return P, hip


# ------------------------------------------------------------- torso

def parka():
    n = 22
    zs = [r[0] for r in BODY]
    rings = [[body_point(i / n * math.tau, z) for i in range(n)] for z in zs]
    P = [fk.loft(f"{R}-parka", rings, PARKA, start="pole", end="pole")]
    # The fur hem.
    hem = [body_point(i / 24 * math.tau, HEM + 0.012, 0.012)
           for i in range(24)]
    P.append(fk.tube(f"{R}-hem", hem + [hem[0]], [0.024] * 25, FUR, n=8,
                     flute=0.12, caps=(None, None)))
    # A belt cinched at the waist with a brass buckle.
    belt = [[body_point(i / n * math.tau, z, 0.006) for i in range(n)]
            for z in (0.645, 0.665, 0.685)]
    P.append(fk.loft(f"{R}-belt", belt, fk.LEATHER))
    P.append(fk.rbox(f"{R}-buckle", (0.04, 0.014, 0.036),
                     body_point(0, 0.665, 0.012), fk.BRASS, levels=1))
    # A placket and toggles down the front.
    for k in range(3):
        z = lerp(0.92, 0.74, k / 2)
        P.append(fk.rbox(f"{R}-toggle{k}", (0.03, 0.012, 0.01),
                         body_point(0, z, 0.006), fk.BRASS, levels=1))
    # A pouch on her left hip.
    P.append(fk.rbox(f"{R}-pouch", (0.04, 0.07, 0.08),
                     body_point(math.radians(-95), 0.6, 0.03), fk.LEATHER,
                     levels=2, crease=0.4))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "f")


def hairline(a):
    return fk.table([(0, 1.205), (40, 1.2), (70, 1.17), (180, 1.1)], abs(a))


def hood():
    """The hood up over the head, open at the face, a fat fur ruff round
    the opening and the goggles pushed up on its brow."""
    P = []
    c = fk.HC + V(0, -0.012, 0.0)
    rr = 0.132
    th0 = math.radians(52)
    zcut = c.z - 0.15
    n, m = 22, 8

    def sp(th, ph, r):
        p = c + V(math.sin(th) * math.cos(ph) * r, math.cos(th) * r,
                  math.sin(th) * math.sin(ph) * r * 1.08)
        if p.z < zcut:
            p.z = zcut
        return p
    for label, r, mat, out in (("hood", rr, PARKA, True),
                               ("hoodin", rr - 0.01, FUR, False)):
        mesh = fk.Mesh(f"{R}-{label}", mat)
        rows = [[mesh.v(sp(lerp(th0, math.pi * 0.985, j / m),
                           i / n * math.tau, r)) for i in range(n)]
                for j in range(m + 1)]
        mesh.grid(rows, mat, closed=True)
        mesh.fan(rows[-1], sp(math.pi, 0, r))
        P.append(mesh.obj(outward=c) if out else mesh.obj(inward=c))
    ring = [sp(th0 + 0.04, i / n * math.tau, rr + 0.004) for i in range(n)]
    P.append(fk.tube(f"{R}-ruff", ring + [ring[0]], [0.032] * (n + 1), FUR,
                     n=10, flute=0.16, caps=(None, None)))
    # The goggles on the hood's brow: two brass-rimmed blue lenses.
    for sx in (-1, 1):
        axis = V(sx * 0.32, 0.7, 0.64).normalized()
        at = c + axis * (rr + 0.012)
        m_ = fk.look(axis, V(0, 0, 1), at)
        disc = [(math.cos(i / 12 * math.tau) * 0.026,
                 math.sin(i / 12 * math.tau) * 0.026) for i in range(12)]
        P.append(fk.slab(f"{R}-lens{sx}", disc, 0.012, LENS, matrix=m_))
        rim = [at + (m_.to_3x3() @ V(math.cos(i / 12 * math.tau) * 0.028,
                                     math.sin(i / 12 * math.tau) * 0.028,
                                     0.012)) for i in range(12)]
        P.append(fk.tube(f"{R}-grim{sx}", rim + [rim[0]], [0.007] * 13,
                         fk.BRASS, n=5, caps=(None, None)))
    strap = [sp(th0 + 0.55, math.radians(a), rr + 0.006) for a in
             range(-20, 210, 15)]
    P.append(fk.tube(f"{R}-gstrap", strap, [(0.005, 0.01)] * len(strap),
                     fk.LEATHER, n=4, up=V(0, 0, 1), caps=("flat", "flat")))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P += fk.eyes(H, frown=0.01, squint=0.76)
    P += fk.mouth(H, kind="firm")
    # Wind-reddened cheeks.
    for sx in (-1, 1):
        pts = [(sx * a, 1.122 + 0.009 * math.sin(t)) for t, a in
               ((i / 8 * math.tau, 40 + 7 * math.cos(i / 8 * math.tau))
                for i in range(8))]
        if sx < 0:
            pts = pts[::-1]
        P.append(fk.decal(f"{R}-cheek{sx}", H.point, pts, 0.0025, fk.LIP,
                          depth=0.0005, eps=0.05, ref=H.hc))
    P += hood()
    P.append(fk.neck(R, SKIN, r=0.042))
    return P


# ------------------------------------------------------------- arms

def arm(side):
    sx = 1 if side == "R" else -1
    s = S_R if sx > 0 else S_L
    c = GRIP_R if sx > 0 else GRIP_L
    pole = s + (V(0.6, -0.5, -0.2) if sx > 0 else V(-0.6, -0.1, -0.5))
    e0 = fk.ik(s, c, UPPER, FORE + 0.042, pole)
    xax = (c - e0) - D * (c - e0).dot(D)
    xax.normalize()
    w = c - xax * 0.042
    e = fk.ik(s, w, UPPER, FORE, pole)
    up = (e - s).normalized()
    fo = (w - e).normalized()
    upper = [fk.ball(f"{R}-shoulder{side}", 1.0, s + V(0, 0, -0.018), PARKA,
                 scale=(0.064, 0.066, 0.056), seg=10, rings=6),
         fk.limb(f"{R}-sleeve{side}", [s + up * 0.004, lerp(s, e, 0.5), e,
                                       ], [0.06, 0.058, 0.054], PARKA, n=12)]
    lower = [fk.ball(f"{R}-elbow{side}", 0.054, e, PARKA, seg=10, rings=6),
             fk.limb(f"{R}-fore{side}", [e, lerp(e, w, 0.7)],
                     [0.054, 0.052], PARKA, n=12),
             fk.limb(f"{R}-cuff{side}", [lerp(e, w, 0.7), w + fo * 0.004],
                 [0.06, 0.058], FUR, n=10, flute=0.12,
                 caps=(None, None))]
    hand = fk.hand(f"{R}-mitt{side}", c, xax, D, -sx, MITT, scale=1.22)
    return upper, lower, hand, s, e, w


def rifle():
    """The frost rifle along D: a wooden stock behind the right mitten,
    a brass action, a barrel wound with a glowing ice coil, a frosted
    muzzle."""
    P = []
    side = V(0, 0, 1).cross(D).normalized()
    up = D.cross(side).normalized()
    butt = GRIP_R - D * 0.2
    P.append(fk.tube(f"{R}-stock", [butt - up * 0.02, GRIP_R - D * 0.06,
                                    GRIP_R + D * 0.02],
                     [(0.028, 0.056), (0.024, 0.036), (0.021, 0.026)], WOOD,
                     n=8, up=up, caps=("flat", None)))
    P.append(fk.tube(f"{R}-action", [GRIP_R + D * 0.02, GRIP_R + D * 0.13],
                     [(0.022, 0.026)] * 2, fk.BRASS, n=8, up=up,
                     caps=("flat", "flat")))
    P.append(fk.tube(f"{R}-fore", [GRIP_R + D * 0.13, GRIP_L + D * 0.06],
                     [(0.018, 0.02)] * 2, WOOD, n=8, up=up,
                     caps=(None, "flat")))
    tip = GRIP_R + D * 0.58
    P.append(fk.tube(f"{R}-barrel", [GRIP_R + D * 0.12 + up * 0.014, tip +
                                     up * 0.014],
                     [0.017, 0.015], fk.STEEL, n=10, caps=(None, None)))
    # The ice coil round the barrel.
    coil = []
    for k in range(25):
        t = k / 24
        a = t * math.tau * 5
        p = lerp(GRIP_L + D * 0.07, tip - D * 0.05, t) + up * 0.012
        coil.append(p + (side * math.cos(a) + up * math.sin(a)) * 0.023)
    P.append(fk.tube(f"{R}-coil", coil, [0.0065] * len(coil), ICE, n=5,
                     caps=("dome", "dome")))
    # The frosted muzzle: a crystal cluster.
    m = tip + up * 0.012
    for k, (dx, dz, r) in enumerate(((0, 0, 0.022), (0.014, 0.01, 0.014),
                                     (-0.012, 0.012, 0.012),
                                     (0.004, -0.014, 0.012))):
        P.append(fk.ball(f"{R}-frost{k}", 1.0, m + side * dx + up * dz, ICE,
                         scale=(r, r * 1.4, r), seg=6, rings=4))
    # A brass sight and a sling.
    P.append(fk.rbox(f"{R}-sight", (0.01, 0.03, 0.02),
                     GRIP_R + D * 0.08 + up * 0.03, fk.BRASS, levels=1))
    return P


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="explorer"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx in (("L", -1), ("R", 1)):
        knee = V(sx * 0.09, 0.02, 0.36)
        ankle = V(sx * 0.1, 0.02, 0.09)
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    pieces = parka()
    pouch = fk.take_parts(pieces, f"{R}-pouch")
    torso = part("torso", pieces, WAIST, root)
    # Split only the existing hem; keep its cut, folds and fur trim.
    fk.cloth_below(torso, f"{R}.skirtL", 0.64, V(0, 0, 0.65))
    part("extra", pouch, body_point(math.radians(-95), 0.64, 0.03), torso)
    pieces = head()
    hood_parts = fk.take_parts(pieces, f"{R}-hood", f"{R}-ruff",
                                f"{R}-lens", f"{R}-grim", f"{R}-gstrap")
    head_obj = fk.face_head(R, pieces, NECK, torso)
    part("hat", hood_parts, fk.HC + V(0, -0.012, 0.0), head_obj)
    for side in ("R", "L"):
        upper, lower, hand, s, e, w = arm(side)
        a = part(f"arm{side}", upper, s, torso)
        f = part(f"fore{side}", lower, e, a)
        h = part(f"hand{side}", hand, w, f)
        if side == "R":
            part("weapon", rifle(), GRIP_R, h, angle=40)
    return fk.finish(root, R, POSES)


POSES = {
    "aim": {"armR": (0.55, 0, 0), "armL": (0.55, 0, 0),
            "head": (-0.1, 0, 0), "torso": (0.05, 0.12, 0)},
    "walk": {"legL": (0.4, 0, 0), "kneeL": (-0.2, 0, 0),
             "legR": (-0.3, 0, 0)},
}
