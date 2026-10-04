"""The Diver (figure id `diver`) as a collector's miniature: an 1890s
deep-sea diver in hand-painted resin, a slow armoured tank.

A big round brass helmet with an open front port (his set face inside)
and two small side ports, bolted to a brass corselet over the shoulders;
a puffy team-colour canvas suit with dark rubber cuffs and a leather belt;
lead weights slung front and back; heavy lead boots with brass toe caps
and straps; an air hose from the back of the helmet; a huge iron wrench in
his right fist, carried on his shoulder-side, swung down on a target.

Parts (figures.py has the contract), none with a rest rotation:

  diver           root at the feet, facing +y
    legL, legR    pivots on the hips (knees and ankles split in build())
    torso         pivot at the waist: suit, corselet, weights, hose
      head        pivot at the neck: the head inside its helmet
      armR        pivot on the right shoulder, the upper arm
        foreR     pivot at the elbow, forearm and fist
          weapon  the wrench, pivot in the right fist
      armL        pivot on the left shoulder, the whole arm

DIVER_POSE=<name> turns the parts as the game would before the previews.
"""

import math

import kit
import figure_folk_kit as fk
from figure_folk_kit import V, lerp, smooth
from mathutils import Matrix

R = "diver"
T = kit.tint

SKIN = fk.SKINS["warm"]
SUIT = fk.TEAM
PATCH = fk.TEAM2
BRASS = fk.BRASS
LEAD = "gilt:" + T("diver-lead", "#5f656e")
RUBBER = fk.DARK
GLASS = "lacquer:" + T("diver-glass", "#1f3a4a")
LINING = "resin:" + T("diver-lining", "#8a7356")
HAIR = fk.HAIRS["brown"]

HIP_X, HIP_Z = 0.105, 0.6
WAIST = V(0, 0, 0.66)
SH_X, SH_Z = 0.225, 0.985
S_L, S_R = V(-SH_X, 0, SH_Z), V(SH_X, 0, SH_Z)
NECK = V(0, 0, 1.04)
UPPER, FORE = 0.25, 0.22
HEAD_DZ = 0.03
HELM_R = 0.178

# The suit: (z, half width, front, back), puffy.
BODY = [(0.5, 0.15, 0.13, 0.13), (0.56, 0.17, 0.145, 0.142),
        (0.64, 0.182, 0.152, 0.146), (0.72, 0.19, 0.16, 0.148),
        (0.8, 0.198, 0.166, 0.152), (0.88, 0.205, 0.163, 0.155),
        (0.94, 0.2, 0.15, 0.148), (0.98, 0.17, 0.12, 0.12),
        (1.02, 0.1, 0.08, 0.08)]
BODY_P = 2.2


def body_point(a, z, extra=0.0):
    return fk.ring_point(BODY, BODY_P, a, z, extra)


# ------------------------------------------------------------- legs

def leg(sx, knee, ankle):
    hip = V(sx * HIP_X, 0, HIP_Z)
    P = [fk.limb(f"{R}-trouser{sx}", [hip + V(0, 0, 0.05),
                                      lerp(hip, knee, 0.5), knee,
                                      lerp(knee, ankle, 0.5),
                                      V(ankle.x, ankle.y, 0.2)],
                 [0.078, 0.076, 0.07, 0.068, 0.066], SUIT, n=12,
                 flute=0.025)]
    # A canvas patch on the knee.
    P.append(fk.ball(f"{R}-kneepatch{sx}", 1.0, knee + V(0, 0.05, 0), PATCH,
                     scale=(0.05, 0.03, 0.05), seg=10, rings=6))
    # Lead boots: big, round-toed, brass toe caps, a strap over the instep.
    P += fk.shoe(f"{R}-boot", sx, ankle, 6, LEAD, sole=RUBBER, length=1.28,
                 width=1.45, height=1.55, toe=BRASS)
    top = V(ankle.x, ankle.y, 0.0)
    P.append(fk.limb(f"{R}-shaft{sx}", [top + V(0, -0.005, 0.07),
                                        top + V(0, 0.0, 0.215)],
                     [0.07, 0.074], LEAD, n=12, caps=(None, "flat")))
    for z in (0.11, 0.18):
        P.append(fk.limb(f"{R}-strap{sx}{z}", [top + V(0, 0, z - 0.008),
                                               top + V(0, 0, z + 0.008)],
                         [0.077, 0.077], fk.LEATHER, n=12,
                         caps=("flat", "flat")))
    return P, hip


# ------------------------------------------------------------- torso

def suit():
    P = [fk.trunk(f"{R}-suit", BODY, BODY_P, SUIT, n=22, top="pole",
                  bottom="pole")]
    # A wide leather belt and a brass buckle.
    rings = [[body_point(i / 24 * math.tau, z, 0.006) for i in range(24)]
             for z in (0.6, 0.62, 0.66, 0.68)]
    P.append(fk.loft(f"{R}-belt", rings, fk.LEATHER))
    P.append(fk.rbox(f"{R}-buckle", (0.05, 0.02, 0.04),
                     body_point(0, 0.64, 0.012), BRASS, levels=1))
    # The lead weights, front and back, on short chains of rope.
    for k, (a, y) in enumerate(((0.0, 1), (math.pi, -1))):
        c = body_point(a, 0.79, 0.024)
        P.append(fk.rbox(f"{R}-weight{k}", (0.15, 0.034, 0.1), c, LEAD,
                         levels=2, crease=0.6))
        P.append(fk.rbox(f"{R}-wrib{k}", (0.155, 0.04, 0.016),
                         c + V(0, 0, 0.0), LEAD, levels=1, crease=0.8))
    return P


def corselet():
    """The brass breastplate over the shoulders, its rim bolted."""
    P = []
    n = 24
    rows = []
    for z, k in ((0.86, 1.03), (0.92, 1.045), (0.98, 1.0), (1.02, 0.86),
                 (1.05, 0.66), (1.065, 0.52)):
        ring = []
        for i in range(n):
            a = i / n * math.tau
            p = body_point(a, min(z, 1.02), 0.012)
            ring.append(V(p.x * k if z > 1.0 else p.x * k,
                          p.y * k if z > 1.0 else p.y * k, z))
        rows.append(ring)
    P.append(fk.loft(f"{R}-corselet", rows, BRASS, start=None, end=None))
    # Its rolled rim and the bolts round it.
    rim = [body_point(i / n * math.tau, 0.862, 0.02) for i in range(n)]
    P.append(fk.tube(f"{R}-rim", rim + [rim[0]], [0.012] * (n + 1), BRASS,
                     n=6, caps=(None, None)))
    for k in range(10):
        a = (k + 0.5) / 10 * math.tau
        P.append(fk.ball(f"{R}-bolt{k}", 0.012,
                         body_point(a, 0.885, 0.03), BRASS,
                         scale=(1, 1, 0.8), seg=6, rings=3))
    return P


def hose():
    """The air hose from the back of the helmet down to a valve on the
    back weight."""
    pts = [V(0.0, -0.17, 1.13), V(0.05, -0.24, 1.08), V(0.09, -0.25, 0.96),
           V(0.08, -0.2, 0.86)]
    P = [fk.tube(f"{R}-hose", kit.smooth_path(pts, samples=3),
                 [0.022] * len(kit.smooth_path(pts, samples=3)), RUBBER, n=8,
                 caps=(None, None))]
    P.append(fk.ball(f"{R}-valve", 0.026, V(0.08, -0.19, 0.85), BRASS, seg=8,
                     rings=5))
    return P


# ------------------------------------------------------------- head

H = fk.head_of(R, "m", scale=0.96)


def hairline(a):
    return fk.table([(0, 1.22), (40, 1.21), (70, 1.16), (90, 1.15),
                     (120, 1.11), (180, 1.08)], abs(a))


def helmet():
    """A brass sphere round the head, open at the front port; a dark
    lining inside; a thick brass port frame; two small side ports."""
    P = []
    c = fk.HC + V(0, 0.005, 0.0)
    rr = HELM_R
    th0 = math.radians(47)
    zcut = c.z - 0.13
    n, m = 22, 10

    def sp(th, ph, r):
        p = c + V(math.sin(th) * math.cos(ph) * r, math.cos(th) * r,
                  math.sin(th) * math.sin(ph) * r)
        if p.z < zcut:
            p.z = zcut
        return p

    for label, r, mat, out in (("helm", rr, BRASS, True),
                               ("lining", rr - 0.012, LINING, False)):
        mesh = fk.Mesh(f"{R}-{label}", mat)
        rows = [[mesh.v(sp(lerp(th0, math.pi * 0.985, j / m),
                           i / n * math.tau, r)) for i in range(n)]
                for j in range(m + 1)]
        mesh.grid(rows, mat, closed=True)
        mesh.fan(rows[-1], sp(math.pi, 0, r))
        P.append(mesh.obj(outward=c) if out else mesh.obj(inward=c))
    # The front port frame.
    ring = [sp(th0, i / n * math.tau, rr - 0.006) for i in range(n)]
    P.append(fk.tube(f"{R}-port", ring + [ring[0]], [0.017] * (n + 1),
                     BRASS, n=7, caps=(None, None)))
    for k in range(6):
        ph = k / 6 * math.tau + 0.5
        P.append(fk.ball(f"{R}-pbolt{k}", 0.009, sp(th0 + 0.13, ph, rr +
                                                    0.004), BRASS,
                         seg=6, rings=3))
    # Side ports: dark glass behind a brass ring.
    for sx in (-1, 1):
        axis = V(sx, 0.15, 0.12).normalized()
        at = c + axis * (rr + 0.002)
        m_ = fk.look(axis, V(0, 0, 1), at)
        disc = [(math.cos(i / 14 * math.tau) * 0.048,
                 math.sin(i / 14 * math.tau) * 0.048) for i in range(14)]
        P.append(fk.slab(f"{R}-sideglass{sx}", disc, 0.008, GLASS,
                         matrix=m_))
        ring = [at + (m_.to_3x3() @ V(math.cos(i / 14 * math.tau) * 0.05,
                                      math.sin(i / 14 * math.tau) * 0.05,
                                      0.008)) for i in range(14)]
        P.append(fk.tube(f"{R}-sidering{sx}", ring + [ring[0]],
                         [0.011] * 15, BRASS, n=6, caps=(None, None)))
    # A top port and the hose union at the back.
    top = c + V(0, 0.02, rr)
    P.append(fk.tube(f"{R}-topport", [top - V(0, 0, 0.02),
                                      top + V(0, 0, 0.012)],
                     [0.04, 0.036], BRASS, n=12, caps=(None, "flat")))
    P.append(fk.tube(f"{R}-union", [c + V(0, -rr + 0.01, -0.02),
                                    c + V(0, -rr - 0.03, -0.03)],
                     [0.026, 0.024], BRASS, n=10, caps=(None, "flat")))
    # The neck ring where the helmet screws onto the corselet.
    nr = [V(math.cos(i / n * math.tau) * 0.13, c.y - 0.005 +
            math.sin(i / n * math.tau) * 0.125, zcut + 0.004)
          for i in range(n)]
    P.append(fk.tube(f"{R}-neckring", nr + [nr[0]], [0.016] * (n + 1),
                     BRASS, n=6, caps=(None, None)))
    return P


def head():
    P = [H.skull(SKIN, HAIR, hairline=hairline)]
    P += fk.eyes(H, frown=0.008)
    P += fk.mouth(H, kind="firm")
    P += H.ears(SKIN)
    # A short dark moustache.
    for sx in (-1, 1):
        pts = [H.point(sx * a, z) + H.normal(sx * a, z) * 0.004 for a, z in
               ((3, 1.106), (13, 1.103), (22, 1.096))]
        P.append(fk.tube(f"{R}-stache{sx}", pts, [0.006, 0.0075, 0.005],
                         HAIR, n=6, caps=("dome", "dome")))
    # The face sits forward in the port, so it reads from above.
    fk.transform(P, Matrix.Translation(V(0, 0.03, 0)))
    P += helmet()
    fk.transform(P, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return P


# ------------------------------------------------------------- arms

def sleeve(name, s, e, w):
    up = (e - s).normalized()
    fo = (w - e).normalized()
    P = [fk.ball(f"{name}-shoulder", 1.0, s + V(0, 0, -0.02), SUIT,
                 scale=(0.076, 0.078, 0.064), seg=12, rings=7),
         fk.limb(f"{name}-upper", [s + up * 0.01, lerp(s, e, 0.5), e],
                 [0.074, 0.072, 0.066], SUIT, n=12, flute=0.03)]
    lower = [fk.ball(f"{name}-elbow", 0.066, e, SUIT, seg=10, rings=6),
             fk.limb(f"{name}-fore", [e, lerp(e, w, 0.6)],
                     [0.064, 0.06], SUIT, n=12, flute=0.03),
             fk.limb(f"{name}-cuff", [lerp(e, w, 0.55), w + fo * 0.01],
                     [0.058, 0.05], RUBBER, n=12, caps=("flat", None))]
    return P, lower


# The right arm hangs a little forward, the forearm raised, fist at hip
# height holding the wrench upright on his shoulder side.
E_R = S_R + V(0.05, 0.02, -1).normalized() * UPPER
C_R = E_R + V(0.0, 0.75, 0.45).normalized() * (FORE + 0.04)
E_L = S_L + V(-0.07, 0.0, -1).normalized() * UPPER
C_L = E_L + V(-0.03, 0.4, -0.9).normalized() * (FORE + 0.04)


def arm_r():
    w = C_R - (C_R - E_R).normalized() * 0.04
    upper, lower = sleeve(f"{R}-armR", S_R, E_R, w)
    lower += fk.hand(f"{R}-handR", C_R, C_R - E_R, V(0, 0.12, 1), -1, SKIN,
                     scale=1.18)
    return upper, lower


def arm_l():
    w = C_L - (C_L - E_L).normalized() * 0.04
    upper, lower = sleeve(f"{R}-armL", S_L, E_L, w)
    lower += fk.hand(f"{R}-handL", C_L, C_L - E_L, V(1, 0.2, 0), 1, SKIN,
                     scale=1.18)
    return upper, lower


def wrench():
    """A huge iron spanner, gripped near the end of its handle, the open
    jaw up over his shoulder."""
    P = []
    g = V(0, 0.12, 1).normalized()
    base = C_R - g * 0.07
    tip = C_R + g * 0.36
    P.append(fk.tube(f"{R}-shank", [base, lerp(base, tip, 0.5), tip],
                     [(0.036, 0.02), (0.031, 0.018), (0.036, 0.02)],
                     fk.STEEL, n=8, up=V(1, 0, 0), power=3.0,
                     caps=("dome", None)))
    # The open jaw: a thick C at the top, opening forward.
    side = V(1, 0, 0)
    fwd = g.cross(side).normalized() * -1
    j = tip + g * 0.07
    arc = []
    for k in range(9):
        a = math.radians(lerp(-150, 150, k / 8))
        arc.append(j + g * math.cos(a) * 0.075 + fwd * math.sin(a) * -0.075)
    P.append(fk.tube(f"{R}-jaw", arc, [(0.04, 0.03)] * 9, fk.STEEL, n=8,
                     up=side, power=3.0, caps=("flat", "flat")))
    # A leather grip.
    P.append(fk.tube(f"{R}-wgrip", [base - g * 0.01, base + g * 0.12],
                     [(0.041, 0.025)] * 2, fk.LEATHER, n=8, up=side,
                     power=3.0, caps=("flat", "flat")))
    return P


# ------------------------------------------------------------- build

def part(name, pieces, pivot, par, angle=48):
    return fk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="diver"):
    assert root_name == R
    root = kit.empty(R)
    for side, sx, knee, ankle in (
            ("L", -1, V(-0.11, 0.015, 0.36), V(-0.115, 0.02, 0.09)),
            ("R", 1, V(0.11, 0.01, 0.36), V(0.115, 0.015, 0.09))):
        pieces, hip = leg(sx, knee, ankle)
        part(f"leg{side}", pieces, hip, root)
    torso = part("torso", suit() + corselet() + hose(), WAIST, root)
    fk.face_head(R, head(), NECK, torso)
    upper, lower = arm_r()
    hand = fk.take_parts(lower, f"{R}-handR-")
    a = part("armR", upper, S_R, torso)
    f = part("foreR", lower, E_R, a)
    h = part("handR", hand, C_R - (C_R - E_R).normalized() * 0.04, f)
    part("weapon", wrench(), C_R, h, angle=40)
    upper, lower = arm_l()
    hand = fk.take_parts(lower, f"{R}-handL-")
    a = part("armL", upper, S_L, torso)
    f = part("foreL", lower, E_L, a)
    part("handL", hand, C_L - (C_L - E_L).normalized() * 0.04, f)
    return fk.finish(root, R, POSES)


# Preview poses in three.js Euler terms, as moves/diver.ts sets them.
POSES = {
    "wind": {"armR": (2.3, 0, 0.1), "foreR": (-0.6, 0, 0),
             "weapon": (0.4, 0, 0), "torso": (0.1, 0.25, 0)},
    "strike": {"armR": (0.9, 0, 0), "foreR": (-0.1, 0, 0),
               "weapon": (1.0, 0, 0), "torso": (-0.12, -0.2, 0)},
    "walk": {"legL": (0.45, 0, 0), "kneeL": (-0.2, 0, 0),
             "footL": (-0.25, 0, 0), "legR": (-0.35, 0, 0),
             "kneeR": (-0.1, 0, 0), "footR": (0.45, 0, 0),
             "armL": (-0.3, 0, 0), "armR": (0.15, 0, 0)},
}
