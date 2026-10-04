"""The tower guard (figure id `guard`): a medieval longbowman standing watch
on each small watchtower, as a hand-painted collector's miniature.

A hooded wool gugel (hood and shoulder cape) over a quilted gambeson, a
team tabard with a cream chevron, a leather belt with a brass buckle, a
pouch and a bollock dagger, a hip quiver of team-fletched arrows, hose and
turnshoe boots, a yew longbow with horn nocks and a linen string.

Parts (see troops.py for the contract): legs from the hips, torso from the
waist, head from the neck, armL (the bow arm) and armR (the draw arm's
upper arm) from the shoulders, offhand (the left hand and the bow) from the
left wrist, weapon (the draw forearm and hand) from the right elbow, and
`guard.arrow`, the nocked arrow, a child of the weapon with its origin on
the nock so the game can hide it on release and spawn the flying arrow
there. No part has a rest rotation.

The root carries two poses (root["poses"], JSON): `draw` (full draw at a
target straight ahead along +y, level) and `loose` (the instant after the
release). Both are solved here from the geometry: the nock sits at the
right jaw, the arrow runs level along +y across the string and over the
bow hand, and the bow stands upright. GUARD_POSE=draw (or loose) applies a
pose before the previews are rendered.
"""

import json
import math
import os

import kit
import face_rig
import face_paint
import figure_guard_kit as gk
from figure_guard_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Quaternion, Vector

R = "guard"
T = kit.tint

# ------------------------------------------------------------- palette

SKIN = "resin:" + T("guard-skin", "#e5aa82")
LIP = "resin:" + T("guard-lip", "#a8735f")
BEARD = "resin:" + T("guard-beard", "#4b3627")
EYEW = "resin:" + T("guard-eyewhite", "#d2c9b8")
IRIS = "resin:" + T("guard-iris", "#2a231d")
WOOL = "weave:" + T("guard-wool", "#655340")
GAMB = "weave:" + T("guard-gambeson", "#a09176")
HOSE = "weave:" + T("guard-hose", "#4a463f")
TEAM = "weave:team"
TEAM2 = "weave:team2"
CREAM = "weave:" + T("guard-cream", "#e2d6bb")
BOOT = "leather:" + T("guard-boot", "#4a3222")
BELT = "leather:" + T("guard-belt", "#5a3b25")
TAN = "leather:" + T("guard-tan", "#77532f")
BRASS = "gilt:" + T("guard-brass", "#b08b4e")
IRON = "gilt:" + T("guard-iron", "#7b7e82")
YEW = "wood:" + T("guard-yew", "#915c35")
GRIP = "leather:" + T("guard-grip", "#3a2a1e")
HORN = "lacquer:" + T("guard-horn", "#d0bf9b")
STRING = "resin:" + T("guard-string", "#d6cdb6")
SHAFT = "wood:" + T("guard-shaft", "#b89868")
HILT = "wood:" + T("guard-hilt", "#4d3524")
FLETCH = "resin:team"

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.083, 0.648
WAIST = V(0, 0, 0.70)
SH_X, SH_Y, SH_Z = 0.168, -0.008, 0.975
S_L0 = V(-SH_X, SH_Y, SH_Z)
S_R0 = V(SH_X, SH_Y, SH_Z)
NECK = V(0, 0.004, 1.035)
HC = V(0, 0.012, 1.162)          # skull centre
CY = 0.012                       # the face's centre line (y)
UPPER, FORE = 0.25, 0.22
WRIST_FIST = 0.04                # wrist to the centre of the fist

# The bow arm at rest: the upper arm hangs a little out and back, the
# elbow bends 16 degrees, and the wrist is cocked so the bow's upper limb
# points forward and down at the ground.
U_L = V(-0.1, -0.03, -1).normalized()
E_L0 = S_L0 + U_L * UPPER
F_L = (Quaternion(U_L.cross(V(0, 1, 0)).normalized(), math.radians(16))
       @ U_L)
W_L0 = E_L0 + F_L * FORE
_K = V(-1, 0.18, 0)
K_L0 = (_K - F_L * _K.dot(F_L)).normalized()      # back of the left hand
X_L0 = Quaternion(K_L0, math.radians(52)) @ F_L    # wrist to fingertips
Z_L0 = X_L0.cross(K_L0)                           # bow's upper limb
C_L0 = W_L0 + X_L0 * WRIST_FIST                   # centre of the fist

# The draw arm at rest: the hand at the right hip, the arrow held low
# along the thigh (the arrow has its own turn into the draw, about the
# nock, so its rest line is free).
U_R = V(0.07, 0.1, -1).normalized()
E_R0 = S_R0 + U_R * UPPER
F_R0 = V(-0.02, 0.86, -0.51).normalized()
W_R0 = E_R0 + F_R0 * FORE
A_REST = V(0.2, 0.3, -0.93).normalized()

ARROW_LEN = 0.62
BOW_HALF = 0.56
BRACE = 0.118
# Where the arrow crosses the bow hand, in the fist frame (X, K, Z).
PASS = (0.0, 0.019, 0.045)
# The nock in the draw fist's frame.
NOCK = (0.012, -0.004, 0.017)

# ------------------------------------------------------------- pose solve


def rz(deg):
    return Quaternion((0, 0, 1), math.radians(deg))


def rx(rad):
    return Quaternion((1, 0, 0), rad)


def ry(rad):
    return Quaternion((0, 1, 0), rad)


def solve():
    """Every rotation of the draw and loose poses, and the draw-space
    geometry of the draw forearm (see build)."""
    s = {}
    q_t = rz(-72) @ rx(0.03)
    s["torso"] = q_t
    neck1 = WAIST + q_t @ (NECK - WAIST)
    # The head looks along the arrow, tipped a touch toward the string.
    q_h = rz(-2) @ ry(0.1) @ rx(-0.04)
    s["head_w"] = q_h
    anchor = V(0.072, 0.1, 1.098)                  # nock, head space
    nock = neck1 + q_h @ (anchor - NECK)
    s["nock"] = nock

    # The bow upright, its back to the target, canted a little.
    cant = math.radians(7)
    x1 = V(0, 1, 0)
    z1 = V(math.sin(cant), 0, math.cos(cant))
    k1 = z1.cross(x1)
    q_bow = gk.frame_quat(X_L0, Z_L0, x1, z1)
    s["bow_w"] = q_bow
    pass_w = k1 * PASS[1] + z1 * PASS[2]
    # The bow's plane holds the nock; the arrow is level.
    cz = nock.z - pass_w.z
    cx = nock.x - math.tan(cant) * (nock.z - cz)
    s_l1 = WAIST + q_t @ (S_L0 - WAIST)
    arm_len = (W_L0 - S_L0).length
    wrist_off = q_bow @ (C_L0 - W_L0)

    def gap(y):
        c = V(cx, y, cz)
        return (c - wrist_off - s_l1).length - arm_len

    lo, hi = s_l1.y, s_l1.y + 1.2
    for _ in range(60):
        mid = (lo + hi) / 2
        if gap(mid) > 0:
            hi = mid
        else:
            lo = mid
    c1 = V(cx, (lo + hi) / 2, cz)
    w1 = c1 - wrist_off
    s["fist_w"] = c1
    pass_pt = c1 + pass_w
    d = (pass_pt - nock).normalized()
    s["arrow_dir"] = d
    # The bow arm: the elbow turned so the wrist stays nearly straight.
    best = None
    for i in range(360):
        q = gk.twist_quat(W_L0 - S_L0, w1 - s_l1, math.radians(i))
        fore = q @ F_L
        cost = fore.angle(x1) + 0.4 * (q @ K_L0).angle(k1)
        elbow = s_l1 + q @ (E_L0 - S_L0)
        # Keep the elbow from dropping under the arm line.
        cost += max(0.0, (s_l1.z - 0.02) - elbow.z) * 8
        if best is None or cost < best[0]:
            best = (cost, q)
    q_al = best[1]
    s["armL_w"] = q_al

    # The draw hand: fingers hooked on the string at the nock, the back of
    # the hand turned out, the index finger over the arrow.
    xd = d
    kd = V(1, 0, -0.15)
    kd = (kd - xd * kd.dot(xd)).normalized()
    zd = -(xd.cross(kd))
    cd = nock - xd * NOCK[0] - kd * NOCK[1] - zd * NOCK[2]
    wd = cd - xd * WRIST_FIST
    s_r1 = WAIST + q_t @ (S_R0 - WAIST)
    pole = s_r1 + V(0.1, -0.22, 0.12)
    e1 = gk.ik(s_r1, wd, UPPER, FORE, pole)
    s.update(xd=xd, kd=kd, zd=zd, cd=cd, wd=wd, e1=e1, s_r1=s_r1)
    f1 = (wd - e1).normalized()
    u1 = (e1 - s_r1).normalized()
    # The elbow works as a hinge: the upper arm's roll puts its rest elbow
    # axis on the draw's bend axis, so the forearm's own turn is a plain
    # flexion plus a forearm roll (chosen so the back of the resting hand
    # faces out). A blend from rest then never spins the forearm.
    hinge = U_R.cross(F_R0).normalized()
    want = V(1, 0, 0.35).normalized()

    def arm_turns(u, f):
        h = u.cross(f).normalized()
        q_u = gk.frame_quat(U_R, hinge, u, h)
        f_loc = q_u.inverted() @ f
        flex = math.atan2(F_R0.cross(f_loc).dot(hinge), F_R0.dot(f_loc))
        return q_u, flex

    q_ar, flex = arm_turns(u1, f1)
    best = None
    for i in range(0, 136):
        roll = math.radians(i)
        q_w = q_ar @ Quaternion(hinge, flex) @ Quaternion(F_R0, roll)
        cost = -(q_w.inverted() @ kd).dot(want)
        if best is None or cost < best[0]:
            best = (cost, roll, q_w)
    _, roll, q_w = best
    s["flex"], s["roll"] = flex, roll
    s["armR_w"] = q_ar
    s["weapon_w"] = q_w
    # The arrow swings about the nock from its rest line onto the string.
    q_arrow = A_REST.rotation_difference(q_w.inverted() @ d)
    s["arrow_q"] = q_arrow

    # Loose: the hand flies back past the ear, the elbow follows; both are
    # small turns on from the draw.
    wl = wd + V(0.07, -0.12, 0.03)
    el = gk.ik(s_r1, wl, UPPER, FORE, s_r1 + V(0.12, -0.25, 0.1))
    fl = (wl - el).normalized()
    q_arl, flex_l = arm_turns((el - s_r1).normalized(), fl)
    q_wl = q_arl @ Quaternion(hinge, flex_l) @ Quaternion(F_R0, roll)
    s["armR_wl"] = q_arl
    s["weapon_wl"] = q_wl

    inv_t = q_t.inverted()
    # The nock sits in the bow's plane and the shaft rests beside the grip,
    # so the arrow yaws a hair; one turn of the whole upper body about the
    # waist squares it onto +y without changing any other local rotation.
    square = rz(math.degrees(math.atan2(d.x, d.y)))
    # World positions in the final draw pose, for the report (the build
    # keeps the unsquared ones: they are only construction space).
    for key in ("nock", "fist_w", "e1"):
        s[key + "_final"] = WAIST + square @ (s[key] - WAIST)
    s["arrow_final"] = square @ d
    draw = {
        "torso": square @ q_t,
        "head": inv_t @ q_h,
        "armL": inv_t @ q_al,
        "offhand": q_al.inverted() @ q_bow,
        "armR": inv_t @ q_ar,
        "weapon": q_ar.inverted() @ q_w,
        "arrow": q_arrow,
        "legL": rz(-28) @ rx(0.1),
        "legR": rz(-34) @ rx(-0.07),
    }
    # After the release the bow hand drops a hair and the bow tips forward.
    loose = dict(draw)
    loose["armL"] = inv_t @ (Quaternion(k1, -0.04) @ q_al)
    loose["armR"] = inv_t @ q_arl
    loose["weapon"] = q_arl.inverted() @ q_wl
    loose["head"] = inv_t @ (rx(0.03) @ q_h)
    s["poses"] = {"draw": draw, "loose": loose}
    return s


SOL = solve()

# ------------------------------------------------------------- legs


def boot(name, ankle, knee, toe_out, sx):
    """A turnshoe ankle boot with a turned-down cuff, on the ground."""
    pieces = []
    foot = [(-0.062, 0.022, 0.006, 0.056), (-0.05, 0.034, 0.0, 0.08),
            (-0.012, 0.04, 0.0, 0.088), (0.04, 0.043, 0.0, 0.066),
            (0.092, 0.042, 0.0, 0.047), (0.128, 0.033, 0.002, 0.038),
            (0.152, 0.019, 0.006, 0.029)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in gk.sup(10, rx_, (zt - zb) / 2, 2.6, math.pi / 10):
            ring.append(V(x, y, max(0.0015, (zb + zt) / 2 + z)))
        rings.append(ring)
    pieces.append(gk.loft(f"{name}-foot", rings, BOOT, start=V(0, -0.067, 0.03),
                          end=V(0, 0.16, 0.017)))
    # A welt line round the sole.
    welt = [V(x * 1.04, y, 0.012) for x, y, _ in
            gk.sup(14, 0.045, 0.108, 2.4)]
    welt = [p + V(0, 0.046, 0) for p in welt]
    pieces.append(gk.loft(f"{name}-welt",
                          [[p * 1.0 + V(0, 0, -0.006) for p in welt],
                           [p + V(0, 0, 0.0) for p in welt]],
                          BELT, start="flat", end=None))
    # An ankle strap with a small brass button on the outside.
    strap = gk.loft(f"{name}-strap",
                    [[V(x, y, z) for x, y, _ in gk.sup(10, 0.049, 0.05)]
                     for z in (0.075, 0.093)], BELT, start=None, end=None)
    pieces.append(strap)
    pieces.append(gk.ball(f"{name}-button", 0.0065, V(sx * 0.05, 0.004, 0.084),
                          BRASS, seg=6, rings=4))
    m = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    gk.transform(pieces, m)

    # The shaft and its turned-down cuff follow the shin.
    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    shaft = gk.tube(f"{name}-shaft", [on_leg(0.05), on_leg(0.13),
                                      on_leg(0.2)],
                    [0.049, 0.052, 0.056], BOOT, n=10, caps=(None, None))
    rings = []
    for z, r in ((0.198, 0.054), (0.21, 0.059), (0.2, 0.064), (0.17, 0.063),
                 (0.166, 0.055)):
        c = on_leg(z)
        rings.append([c + V(x, y, 0) for x, y, _ in gk.sup(10, r, r * 1.02)])
    cuff = gk.loft(f"{name}-cuff", rings, TAN, start=None, end=None)
    return pieces + [shaft, cuff]


def leg(sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    path = [hip + V(0, 0, 0.03), lerp(hip, knee, 0.35), lerp(hip, knee, 0.75),
            knee, lerp(knee, ankle, 0.32), lerp(knee, ankle, 0.66), ankle]
    radii = [0.072, 0.069, 0.058, 0.051, 0.056, 0.044, 0.037]
    limb = gk.tube(f"{R}-leg{sx}", path, radii, HOSE, n=10, up=(0, 1, 0),
                   caps=(None, "dome"))
    # A soft knee bump.
    kneecap = gk.ball(f"{R}-knee{sx}", 0.03, knee + V(0, 0.028, 0.008), HOSE,
                      scale=(1.1, 0.7, 1.2), seg=8, rings=5)
    pieces = [limb, kneecap] + boot(f"{R}-boot{sx}", ankle, knee, toe_out,
                                    sx)
    return pieces, hip


# ------------------------------------------------------------- torso

# (z, half width, front depth, back depth) of the gambeson.
BODY = [(0.49, 0.12, 0.11, 0.11), (0.472, 0.172, 0.158, 0.158),
        (0.48, 0.184, 0.168, 0.168), (0.54, 0.177, 0.161, 0.161),
        (0.61, 0.166, 0.148, 0.148), (0.69, 0.151, 0.124, 0.121),
        (0.8, 0.163, 0.133, 0.114), (0.91, 0.175, 0.134, 0.112),
        (0.97, 0.155, 0.11, 0.1), (1.035, 0.08, 0.068, 0.068)]
BODY_P = 2.3


def body_at(z):
    rows = [(b[0], b[1], b[2], b[3]) for b in BODY[2:]]
    return table(rows, z)


def body_point(a, z, extra=0.0):
    """A point on the gambeson at angle a (0 = front, toward +x) and z."""
    rx_, ryf, ryb = body_at(z)
    e = 2.0 / BODY_P
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def body_depth(x, z, side):
    rx_, ryf, ryb = body_at(z)
    t = min(0.999, abs(x) / rx_)
    return (ryf if side > 0 else ryb) * (1 - t ** BODY_P) ** (1 / BODY_P)


def gambeson():
    n = 24
    c = gk.Mesh(f"{R}-gambeson", GAMB)
    rows = []
    for k, (z, rx_, ryf, ryb) in enumerate(BODY):
        row = []
        quilt = 0.0 < z < 0.68 or 0.74 < z < 0.985
        for i in range(n):
            a = i / n * math.tau
            e = 2.0 / BODY_P
            s_, c_ = math.sin(a), math.cos(a)
            k2 = 0.966 if quilt and i % 2 else 1.0
            x = rx_ * spow(s_, e) * k2
            y = (ryf if c_ >= 0 else ryb) * spow(c_, e) * k2
            row.append(c.v(V(x, y, z)))
        rows.append(row)
    # Build bottom-up so the faces point out.
    c.grid(rows, GAMB, closed=True)
    c.fan(rows[-1], V(0, 0, 1.045), GAMB)
    return c.obj(recalc=True)


TAB_W = [(0.42, 0.162), (0.6, 0.142), (0.72, 0.128), (0.8, 0.132),
         (0.9, 0.136), (0.99, 0.128)]


def tabard_fn(side):
    k = 2.6 * math.pi
    ph = 0.5 if side > 0 else 1.7

    def fn(u, v):
        uu = u * side
        hem = 0.444 + 0.01 * math.sin(uu * k + ph)
        z = lerp(0.985, hem, v)
        w = table(TAB_W, z)
        x = uu * w
        y0 = body_depth(x, max(z, 0.485), side)
        below = smooth(0.69, 0.52, z)
        # Below the belt the cloth hangs straight over the flared skirt.
        hang = body_depth(x, 0.69, side) + 0.012 + (0.69 - z) * 0.07
        y = lerp(y0 + 0.009, max(y0 + 0.009, hang), below)
        y += below * (0.021 + 0.016 * math.sin(uu * k + ph) +
                      0.004 * math.sin(uu * 2.1 * k + 1.1))
        # The belt pinches the cloth in.
        y -= 0.004 * gauss(z, 0.715, 0.02)
        return V(x, side * y, z)
    return fn


def tabard(side):
    fn = tabard_fn(side)
    us = [-1, -0.9, -0.72, -0.54, -0.36, -0.18, 0.0, 0.18, 0.36, 0.54, 0.72,
          0.9, 1]
    vs = [0, 0.14, 0.28, 0.4, 0.47, 0.53, 0.64, 0.76, 0.87, 0.94, 1.0]
    trim_i = (0, len(us) - 2)

    def mat(i, j):
        if i in trim_i or j >= len(vs) - 3:
            return TEAM2
        return TEAM

    obj = gk.sheet(f"{R}-tabard{side}", fn, us, vs, mat, rim=0.007,
                   inside=V(0, 0, 0.7), rim_mat=TEAM2,
                   rim_edges=("u0", "u1", "v1"))
    # The chevron on the chest.
    arm = [(0.0, 0.2), (0.28, 0.252), (0.56, 0.305), (0.84, 0.36)]
    inner = [(0.0, 0.262), (0.27, 0.312), (0.55, 0.364), (0.84, 0.418)]
    # The outline walks: outer right arm, down to the inner right, the inner left,
    # then back up the outer left.
    pts = arm + [inner[-1]] + list(reversed(inner[1:-1])) + [inner[0]] + \
        [(-u, v) for u, v in inner[1:]] + [(-arm[-1][0], arm[-1][1])] + \
        [(-u, v) for u, v in reversed(arm[1:-1])]
    dev = gk.decal(f"{R}-chevron{side}", fn, pts, 0.0035, CREAM, depth=0.003)
    return [obj, dev]


def belt():
    pieces = []
    n = 28
    rings = []
    for z, off in ((0.692, 0.013), (0.694, 0.021), (0.736, 0.021),
                   (0.738, 0.013)):
        rings.append([body_point(i / n * math.tau, 0.715, off)
                      + V(0, 0, z - 0.715) for i in range(n)])
    pieces.append(gk.loft(f"{R}-belt", rings, BELT, closed=True))
    front = body_point(0.0, 0.715, 0.021).y
    # A brass buckle frame and pin, a little off centre.
    bx = 0.012
    loop = [V(bx + x, front + 0.004, 0.715 + z) for x, z, _ in
            gk.sup(10, 0.02, 0.025, 3.2)]
    loop.append(loop[0])
    pieces.append(gk.tube(f"{R}-buckle", loop, [0.0042] * len(loop), BRASS,
                          n=5, up=(0, 1, 0), caps=(None, None)))
    pieces.append(gk.tube(f"{R}-pin", [V(bx - 0.02, front + 0.006, 0.715),
                                       V(bx + 0.012, front + 0.007, 0.715)],
                          [0.0028, 0.0028], BRASS, n=4, caps=("pole", "pole")))
    # The belt tongue hangs down from the buckle, with a brass chape.
    tongue = [(x, z) for x, z in ((-0.011, 0.0), (0.011, 0.0), (0.011, -0.1),
                                  (0.0, -0.112), (-0.011, -0.1))]
    m = gk.basis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0),
                 V(bx - 0.03, front + 0.012, 0.708))
    pieces.append(gk.slab(f"{R}-tongue", [(x, z) for x, z in tongue], 0.005,
                          BELT, matrix=m))
    pieces.append(gk.slab(f"{R}-chape", [(-0.012, -0.075), (0.012, -0.075),
                                         (0.012, -0.1), (0.0, -0.114),
                                         (-0.012, -0.1)], 0.0065, BRASS,
                          matrix=m @ Matrix.Translation((0, 0, -0.0008))))
    return pieces


def pouch():
    """A leather belt pouch with a flap and a toggle, at the back left."""
    a = math.pi + 0.62
    top = body_point(a, 0.7, 0.03)
    out = V(math.sin(a), math.cos(a), 0)
    side = V(0, 0, 1).cross(out).normalized()
    rings = []
    for z, w, d in ((0.705, 0.03, 0.013), (0.69, 0.034, 0.019),
                    (0.655, 0.036, 0.021), (0.62, 0.033, 0.019),
                    (0.606, 0.022, 0.012)):
        rings.append([top + side * x + out * y + V(0, 0, z - 0.7)
                      for x, y, _ in gk.sup(12, w, d, 2.8)])
    bag = gk.loft(f"{R}-pouch", rings, TAN, start="pole", end="pole")
    flap = gk.sheet(f"{R}-flap",
                    lambda u, v: top + side * (u * 0.037) +
                    out * (0.021 + 0.004 * math.sin(v * 2.6)) +
                    V(0, 0, 0.007 - v * 0.05 - 0.004 * (1 - u * u) * v),
                    [-1, -0.5, 0, 0.5, 1], [0, 0.5, 1], BELT, rim=0.003,
                    inside=top)
    toggle = gk.tube(f"{R}-toggle", [top + out * 0.028 + V(0, 0, -0.037),
                                     top + out * 0.03 + V(0, 0, -0.052)],
                     [0.004, 0.004], HORN, n=5)
    return [bag, flap, toggle]


def dagger():
    """A bollock dagger in its sheath, hanging on the left front."""
    pieces = []
    a = -0.68
    hilt = body_point(a, 0.715, 0.034)
    out = V(math.sin(a), math.cos(a), 0)
    down = V(-0.12, 0.05, -1).normalized()
    side = down.cross(out).normalized()
    fwd = side.cross(down).normalized()
    m = gk.basis(side, fwd, -down, hilt)
    local = []
    # Sheath from the lobes down, a brass chape on the tip.
    rings = []
    for z, w in ((-0.012, 0.016), (-0.05, 0.015), (-0.13, 0.012),
                 (-0.19, 0.008)):
        rings.append([V(x, y, z) for x, y, _ in gk.sup(8, w, 0.008, 2.4)])
    local.append(gk.loft(f"{R}-sheath", rings, BELT, start="flat",
                         end=V(0, 0, -0.205)))
    local.append(gk.loft(f"{R}-dchape",
                         [[V(x, y, z) for x, y, _ in gk.sup(8, w, 0.009, 2.4)]
                          for z, w in ((-0.165, 0.0105), (-0.19, 0.0085))],
                         BRASS, start=None, end=V(0, 0, -0.208)))
    for sx in (-1, 1):
        local.append(gk.ball(f"{R}-lobe{sx}", 0.0125, V(sx * 0.0125, 0, 0.0),
                             HILT, seg=7, rings=5))
    local.append(gk.tube(f"{R}-dgrip", [V(0, 0, 0.005), V(0, 0, 0.07)],
                         [0.0085, 0.0075], HILT, n=6, caps=(None, None)))
    local.append(gk.loft(f"{R}-dpommel",
                         [[V(x, y, z) for x, y, _ in gk.sup(8, r, r)]
                          for z, r in ((0.068, 0.0085), (0.074, 0.0115),
                                       (0.08, 0.0095))],
                         BRASS, start=None, end=V(0, 0, 0.083)))
    gk.transform(local, m)
    pieces += local
    # A frog strap from the belt to the sheath.
    pieces.append(gk.tube(f"{R}-frog", [hilt + V(0, 0, 0.012) - out * 0.006,
                                        hilt - V(0, 0, 0.03) - out * 0.002],
                          [(0.004, 0.009), (0.004, 0.009)], BELT, n=6,
                          up=out, caps=(None, None)))
    return pieces


def quiver():
    """A leather hip quiver at the back right, with team-fletched arrows."""
    pieces = []
    top = V(0.142, -0.178, 0.845)
    bot = V(0.112, -0.132, 0.47)
    axis = (top - bot).normalized()
    radii = [0.03, 0.033, 0.036, 0.038, 0.039, 0.04]
    path = [lerp(bot, top, t) for t in (0.0, 0.08, 0.35, 0.7, 0.92, 1.0)]
    body = gk.tube(f"{R}-quiver", path, radii, TAN, n=10,
                   caps=("dome", None), bands={4: BELT, 5: BELT})
    pieces.append(body)
    # The rim, rolled.
    rim_rings = gk.rings_along([top - axis * 0.004, top + axis * 0.004],
                               [0.043, 0.043], n=10)
    inner = gk.rings_along([top, top - axis * 0.03], [0.036, 0.034], n=10)
    pieces.append(gk.loft(f"{R}-qrim", [rim_rings[0], rim_rings[1], inner[0],
                                        inner[1]], BELT, start=None,
                          end="pole"))
    # A hanging strap to the belt.
    belt_pt = body_point(math.radians(152), 0.716, 0.02)
    pieces.append(gk.tube(f"{R}-qstrap", [belt_pt, lerp(belt_pt, top, 0.5) +
                                          V(0.006, -0.004, -0.02),
                                          top - axis * 0.05 + V(0.03, 0.01, 0)],
                          [(0.004, 0.011)] * 3, BELT, n=6, up=(1, 0.3, 0),
                          caps=(None, None)))
    # Arrows fanning out of the mouth, fletching up and back.
    spots = [(0.012, 0.01, 0.0), (-0.014, 0.008, 0.2), (0.0, -0.015, -0.15),
             (0.018, -0.012, 0.35), (-0.016, -0.01, -0.3)]
    side = axis.cross(V(1, 0, 0)).normalized()
    other = axis.cross(side).normalized()
    for k, (a, b, lean) in enumerate(spots):
        base = top + side * a + other * b - axis * 0.06
        d = (axis + side * lean * 0.12 + other * (a - b) * 2.0).normalized()
        tip = base + d * (0.14 + 0.012 * (k % 3))
        pieces += arrow_top(f"{R}-qa{k}", base, tip, d, k * 0.9)
    return pieces


def arrow_top(name, base, tip, d, roll):
    """The part of an arrow that shows above the quiver: shaft, nock and
    three team vanes."""
    pieces = [gk.tube(f"{name}-shaft", [base, tip], [0.0042, 0.0042], SHAFT,
                      n=5, caps=(None, None))]
    pieces += vanes(name, tip - d * 0.01, d, roll)
    return pieces


def vanes(name, rear, d, roll, length=0.085, height=0.015):
    """Three fletching vanes ahead of `rear` along -d... as thin two-sided
    blades from the rear point forward (against d)."""
    d = Vector(d).normalized()
    ref = d.orthogonal().normalized()
    out = []
    for k in range(3):
        n = Quaternion(d, roll + k * math.tau / 3) @ ref
        # A vane: rear high, sloping down to the front.
        a0 = rear
        a1 = rear - d * length
        c = gk.Mesh(f"{name}-vane{k}", FLETCH)
        p = [a0 + n * 0.004, a0 + n * (0.004 + height),
             lerp(a0, a1, 0.55) + n * (0.004 + height * 0.8),
             a1 + n * 0.004]
        side = d.cross(n).normalized() * 0.0009
        front = [c.v(q + side) for q in p]
        back = [c.v(q - side) for q in p]
        c.face([front[0], front[1], front[2], front[3]])
        c.face([back[3], back[2], back[1], back[0]])
        out.append(c.obj(recalc=True))
    return out


def cape(hood_obj):
    """The wool gugel's shoulder cape: a collar rolled snug round the hood
    (fitted by ray casts against it), then down over the shoulders with
    soft folds toward the hem."""
    n = 34
    us = [i / n * math.tau for i in range(n)]
    # t, half width, front depth, back depth, z side, z front, z back
    rows = [
        (0.22, 0.132, 0.126, 0.118, 1.058, 1.034, 1.062),
        (0.45, 0.192, 0.142, 0.13, 1.042, 1.006, 1.036),
        (0.72, 0.224, 0.152, 0.138, 1.0, 0.952, 0.978),
        (1.0, 0.241, 0.158, 0.146, 0.954, 0.905, 0.922),
    ]

    def zfor(a, zs, zf, zb):
        s_, c_ = math.sin(a), math.cos(a)
        return lerp(zf if c_ >= 0 else zb, zs, s_ * s_)

    # The collar: tucked against the hood, then rolled over it.
    tuck = [zfor(a, 1.04, 1.018, 1.045) for a in us]
    roll = [zfor(a, 1.068, 1.042, 1.072) for a in us]
    r_tuck = [gk.radial_hits(hood_obj, (0, 0.002), z, [a], 0.09)[0]
              for a, z in zip(us, tuck)]
    r_roll = [gk.radial_hits(hood_obj, (0, 0.002), z, [a], 0.1)[0]
              for a, z in zip(us, roll)]
    pts = [[V(math.sin(a) * (r + 0.002), 0.002 + math.cos(a) * (r + 0.002), z)
            for a, r, z in zip(us, r_tuck, tuck)],
           [V(math.sin(a) * (r + 0.009), 0.002 + math.cos(a) * (r + 0.009), z)
            for a, r, z in zip(us, r_roll, roll)]]
    for t, rx_, ryf, ryb, zs, zf, zb in rows:
        row = []
        for a in us:
            s_, c_ = math.sin(a), math.cos(a)
            weight = 0.3 + 0.7 * abs(c_)
            # Pipe folds: broad rounded ridges, narrow valleys.
            w8 = math.sin(8 * a + 0.4)
            ridge = (abs(w8) ** 0.6) * math.copysign(1, w8) * 0.5 + 0.5 * w8
            fold = t ** 1.5 * weight * (0.02 * ridge +
                                        0.005 * math.sin(13 * a + 1.3))
            e = 2.0 / 2.2
            x = (rx_ + fold) * spow(s_, e)
            y = ((ryf if c_ >= 0 else ryb) + fold) * spow(c_, e) + 0.004
            z = zfor(a, zs, zf, zb) + t * t * weight * (
                0.009 * w8 + 0.004 * math.sin(3 * a + 2))
            row.append(V(x, y, z))
        pts.append(row)

    def fn(a, j):
        return pts[int(round(j))][us.index(a)]

    return gk.sheet(f"{R}-cape", fn, us, list(range(len(pts))), WOOL,
                    rim=0.008, inside=V(0, 0, 0.9), closed_u=True,
                    rim_edges=("v1",))


# ------------------------------------------------------------- head

FACE_W = [(1.0, 0.03), (1.03, 0.038), (1.048, 0.045), (1.062, 0.051),
          (1.076, 0.057), (1.095, 0.062), (1.12, 0.067), (1.145, 0.071),
          (1.17, 0.073), (1.2, 0.073), (1.235, 0.068)]
FACE_D = [(1.0, 0.028), (1.03, 0.038), (1.048, 0.053), (1.062, 0.066),
          (1.074, 0.071), (1.09, 0.074), (1.12, 0.077), (1.15, 0.074),
          (1.172, 0.081), (1.2, 0.082), (1.235, 0.074)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.006), (1.114, 0.016), (1.121, 0.022),
          (1.13, 0.019), (1.145, 0.0135), (1.16, 0.0085), (1.172, 0.004),
          (1.186, 0.0)]
NOSE_S = [(1.11, 11.0), (1.13, 8.5), (1.17, 6.0)]


def face_disp(ad, z):
    """Sculpted relief (metres, along the surface normal)."""
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.006 * gauss(a, 12.5, 5) * gauss(z, 1.116, 0.006)       # nostrils
    d -= 0.0105 * gauss(a, 26, 11) * gauss(z, 1.156, 0.011)       # sockets
    bz = 1.174 - 0.003 * gauss(a, 9, 8)
    d += 0.0075 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d -= 0.002 * gauss(ad, 0, 4) * gauss(z, 1.171, 0.006)         # frown
    d += 0.0065 * gauss(a, 47, 13) * gauss(z, 1.138, 0.012)       # cheekbone
    d -= 0.004 * gauss(a, 40, 12) * gauss(z, 1.106, 0.012)        # hollow
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.002 * gauss(z, 1.1, 0.004) * gauss(ad, 0, 15)
    d += 0.003 * gauss(z, 1.087, 0.0035) * gauss(ad, 0, 12)       # lower lip
    d += 0.008 * gauss(z, 1.068, 0.01) * gauss(ad, 0, 18)         # chin
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


def face_point(ad, z):
    a = math.radians(ad)
    w = table(FACE_W, z) + 0.004 * gauss(z, 1.078, 0.012) * \
        gauss(abs(ad), 70, 15)
    dd = table(FACE_D, z)
    e = 2.0 / FACE_P
    s_, c_ = math.sin(a), math.cos(a)
    x = w * spow(s_, e)
    y = dd * spow(c_, e) if c_ >= 0 else 0.6 * dd * spow(c_, e)
    # Surface normal of the section (superellipse gradient).
    gx = spow(x / w, FACE_P - 1) / w if x else 0.0
    gy = spow(y / dd, FACE_P - 1) / dd if y else 0.0
    n = V(gx, gy, 0)
    n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
    p = V(x, CY + y, z)
    return p + n * face_disp(ad, z)


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    p = face_point(ad, z)
    if (p - HC).dot(n) < 0:
        n = -n
    return n


FACE_A = [0, 4, 8.5, 13.5, 19, 25, 32, 41, 52, 66, 82]
FACE_Z = [1.01, 1.045, 1.066, 1.082, 1.09, 1.098, 1.106,
          1.114, 1.122, 1.131, 1.141, 1.15, 1.159, 1.167, 1.176, 1.187,
          1.202, 1.222, 1.24]


def face():
    cols = sorted(set([-a for a in FACE_A] + FACE_A))
    c = gk.Mesh(f"{R}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]

    def mat(i, j):
        a = (cols[i] + cols[i + 1]) / 2
        z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
        aa = abs(a)
        if aa < 14 and 1.088 < z < 1.097:
            return LIP
        return SKIN

    c.grid(rows, mat)
    return c.obj(outward=HC)


def eyes():
    return (face_paint.eyes(gk, R, face_point, HC, z=1.1565,
                            expression="focused") +
            face_paint.mouth(gk, R, face_point, HC,
                             expression="focused"))


# The hood: an ellipsoid round the skull, open round the face, closing
# down onto a ring round the neck inside the cape's collar.
HOOD = dict(rx=0.101, ryf=0.1, ryb=0.124, rzu=0.13, rzd=0.16)
POINT = V(0, -0.72, 0.69).normalized()


def hood_r(d):
    h = HOOD
    ry = h["ryf"] if d.y >= 0 else h["ryb"]
    rz = h["rzu"] if d.z >= 0 else h["rzd"]
    r = 1.0 / math.sqrt((d.x / h["rx"]) ** 2 + (d.y / ry) ** 2 +
                        (d.z / rz) ** 2)
    # A soft point at the back of the crown.
    r += 0.014 * max(0.0, d.dot(POINT)) ** 5
    return r


def opening(s):
    c, sn = math.cos(s), math.sin(s)
    a = 73 * spow(sn, 0.75)
    z = 1.132 + (0.092 if c > 0 else 0.084) * spow(c, 0.85)
    return a, z


def neck_ring(s):
    return V(0.09 * math.sin(s), -0.09 * math.cos(s) + 0.002,
             0.996 - 0.008 * math.cos(s))


# Where each column of the hood passes, going from the face edge to the
# neck ring: over the crown for the top, round behind the ear for the
# cheeks, straight down under the chin.
WAY = [(0.0, 0.0, -0.5, 0.87), (math.pi / 4, 0.56, -0.6, 0.57),
       (math.pi / 2, 0.8, -0.55, -0.18), (3 * math.pi / 4, 0.64, -0.12, -0.76),
       (math.pi, 0.0, 0.32, -0.95)]


def waypoint(s):
    sa = abs(((s + math.pi) % math.tau) - math.pi)
    wx, wy, wz = table(WAY, sa)
    return V(math.copysign(wx, math.sin(s) or 1.0), wy, wz).normalized()


def hood():
    n = 32
    ss = [i / n * math.tau for i in range(n)]
    centre = face_point(0, 1.135)
    lips = []
    for s in ss:
        a, z = opening(s)
        p = face_point(a, z)
        nn = face_normal(a, z)
        m = p - centre
        m = (m - nn * m.dot(nn)).normalized()
        lips.append((p, nn, m))
    ts = [0.08, 0.18, 0.3, 0.42, 0.55, 0.67, 0.78, 0.88, 1.0]
    c = gk.Mesh(f"{R}-hood", WOOL)
    rows = []
    rows.append([c.v(p + nn * 0.0045 - m * 0.001) for p, nn, m in lips])
    rows.append([c.v(p + nn * 0.011 - m * 0.003) for p, nn, m in lips])
    e2 = [p + nn * 0.0165 + m * 0.006 for p, nn, m in lips]
    rows.append([c.v(q) for q in e2])
    for t in ts:
        row = []
        for i, s in enumerate(ss):
            a0 = e2[i] - HC
            b0 = neck_ring(s) - HC
            da, db = a0.normalized(), b0.normalized()
            ctrl = waypoint(s) * 2 - (da + db) / 2
            d = (da * (1 - t) ** 2 + ctrl * 2 * t * (1 - t) + db * t * t)
            d.normalize()
            r = hood_r(d) + (a0.length - hood_r(da)) * (1 - t) ** 2 + \
                (b0.length - hood_r(db)) * t ** 2
            # Gathered folds down toward the neck, and the crown seam.
            r += 0.0055 * math.sin(6 * s + 0.5) * smooth(0.5, 1.0, t)
            r += 0.003 * math.sin(3 * s + 1.2) * math.sin(math.pi * t)
            r += 0.0055 * math.sin(5 * s + 7 * t + 0.6) * \
                math.sin(math.pi * t) ** 1.5 * abs(math.sin(s))
            if i == 0 and 0.05 < t < 0.8:
                r -= 0.0028
            row.append(c.v(HC + d * r))
        rows.append(row)

    def mat(i, j):
        return TEAM2 if j == 0 else WOOL

    c.grid(rows, mat, closed=True)
    return c.obj(outward=HC)


def liripipe():
    """The hood's short tail, hanging from the back of the crown."""
    path = [HC + V(0.0, -0.085, 0.075), HC + V(0.0, -0.125, 0.085),
            HC + V(0.004, -0.152, 0.05), HC + V(0.01, -0.163, -0.0),
            HC + V(0.016, -0.162, -0.05)]
    return gk.tube(f"{R}-liripipe", path,
                   [(0.036, 0.03), (0.03, 0.026), (0.022, 0.019),
                    (0.016, 0.014), (0.011, 0.01)], WOOL, n=8,
                   up=(1, 0, 0), caps=(None, "dome"))


def beard():
    """A short trimmed beard over the jaw and chin, a moustache and brows:
    separate sculpted shells so their edges run smooth."""
    top = [(0, 1.0835), (10, 1.084), (16, 1.0875), (21, 1.094), (26, 1.101),
           (34, 1.108), (45, 1.118), (58, 1.13), (70, 1.142), (84, 1.15)]
    cols = [0, 8, 16, 24, 33, 44, 57, 70, 84]
    cols = sorted(set([-a for a in cols] + cols))
    vs = [0.0, 0.14, 0.36, 0.64, 1.0]
    zbot = 1.03

    def fn(ad, v):
        zt = table(top, abs(ad))
        z = lerp(zt, zbot, v ** 1.15)
        th = lerp(0.0012, 0.0058, smooth(0.0, 0.3, v))
        th += 0.0011 * math.sin(ad * 0.7 + v * 5) * smooth(0.0, 0.2, v)
        # The chin tuft stands out a little more.
        th += 0.0025 * gauss(ad, 0, 16) * gauss(z, 1.063, 0.012)
        return face_point(ad, z) + face_normal(ad, z) * th

    shell = gk.sheet(f"{R}-beard", fn, cols, vs, BEARD, rim=0.0, inside=HC)
    pieces = [shell]
    must = []
    for ad in (-28, -21, -13, -6, 0, 6, 13, 21, 28):
        z = 1.1024 - 0.0000095 * ad * ad
        must.append(face_point(ad, z) + face_normal(ad, z) * 0.0036)
    radii = [(0.0019, 0.0015), (0.0028, 0.002), (0.0034, 0.0023),
             (0.0036, 0.0024), (0.0033, 0.0022)]
    radii = radii + radii[-2::-1]
    pieces.append(gk.tube(f"{R}-moustache", must, radii, BEARD, n=6,
                          caps=("dome", "dome")))
    for sx in (-1, 1):
        pts = []
        for ad, z in ((10, 1.1725), (17, 1.1758), (25, 1.1768), (33, 1.1752),
                      (41, 1.1712)):
            pts.append(face_point(sx * ad, z) +
                       face_normal(sx * ad, z) * 0.0022)
        pieces.append(gk.tube(f"{R}-brow{sx}", pts,
                              [(0.0034, 0.0021), (0.0036, 0.0022),
                               (0.0032, 0.002), (0.0026, 0.0017),
                               (0.0018, 0.0012)], BEARD, n=5,
                              caps=("dome", "dome")))
    return pieces


# ------------------------------------------------------------- arms and hands


def fist(name, c, xax, kax, chir, mat=SKIN):
    """A closed fist round a pole along Z (the index finger's end), with
    its fingertips toward X and knuckles toward K; the wrist is at -X."""
    zs = [-0.036, -0.029, -0.017, -0.0085, 0.0, 0.0085, 0.017, 0.029, 0.036]
    grooves = {-0.017, 0.0, 0.017}
    ring_n = 10
    cx, cy, hx, hy = -0.0035, 0.002, 0.0325, 0.027
    rings = []
    for z in zs:
        k = 1.0
        if abs(z) > 0.035:
            k = 0.74
        elif abs(z) > 0.03:
            k = 0.93
        if z < 0:
            k *= 0.94
        ring = []
        for x, y, ang in gk.sup(ring_n, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            # Finger grooves on the finger side (front and palm).
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.004 * (1 if px > 0.004 else 0.5)
                py += 0.003 if py < -0.01 else 0.0
            # Knuckle ridge along the back corner.
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0022
                py += 0.0022
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [gk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(gk.tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                          mat, n=6))
    # The heel of the hand toward the wrist.
    pieces.append(gk.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = gk.basis(xax, kax, zax, c)
    gk.transform(pieces, m)
    return pieces


def sleeve_path(s, e):
    pts = [s + (s - e).normalized() * 0.012]
    for t in (0.18, 0.36, 0.54, 0.72, 0.88):
        pts.append(lerp(s, e, t))
    pts.append(e)
    return pts


def upper_sleeve(name, s, e):
    """The quilted gambeson sleeve from the shoulder to the elbow, with a
    ball at the shoulder under the cape."""
    path = sleeve_path(s, e)
    radii = [0.047, 0.051, 0.049, 0.05, 0.047, 0.046, 0.044]
    sl = gk.tube(f"{name}-upper", path, radii, GAMB, n=10, caps=(None, None),
                 flute=0.055)
    ball = gk.ball(f"{name}-shoulder", 0.049, s, GAMB, seg=10, rings=6)
    return [sl, ball]


def build_armL():
    s, e, w = S_L0, E_L0, W_L0
    pieces = upper_sleeve(f"{R}-armL", s, e)
    fore = [e, lerp(e, w, 0.3), lerp(e, w, 0.62), w]
    pieces.append(gk.tube(f"{R}-foreL", fore, [0.044, 0.045, 0.04, 0.032],
                          GAMB, n=10, caps=(None, "flat"), flute=0.05))
    pieces.append(gk.ball(f"{R}-elbowL", 0.044, e, GAMB, seg=10, rings=6))
    # A leather bracer laced over the inside of the forearm.
    b0, b1 = lerp(e, w, 0.34), lerp(e, w, 0.97)
    pieces.append(gk.tube(f"{R}-bracer", [b0, lerp(b0, b1, 0.5), b1],
                          [0.0475, 0.0445, 0.0375], TAN, n=10,
                          caps=("flat", "flat")))
    for t in (0.3, 0.72):
        p = lerp(b0, b1, t)
        r = lerp(0.0485, 0.0385, t)
        pieces.append(gk.tube(f"{R}-bstrap{t}", [p - F_L * 0.006,
                                                 p + F_L * 0.006],
                              [r + 0.002, r + 0.002], BELT, n=10,
                              caps=(None, None)))
    return pieces


def bow_local():
    """The longbow in its own frame: along z, back toward +x, the string
    along -x; the grip centre at the origin."""
    pieces = []
    zs = [0.045, 0.1, 0.2, 0.3, 0.4, 0.48, 0.53, 0.56]

    def cx(z):
        return -BRACE * (abs(z) / BOW_HALF) ** 1.75

    for sign in (1, -1):
        path = [V(cx(z), 0, z * sign) for z in [0.0] + zs]
        radii = []
        for z in [0.0] + zs:
            t = (abs(z) / BOW_HALF) ** 1.1
            radii.append((lerp(0.0118, 0.0055, t), lerp(0.0128, 0.006, t)))
        pieces.append(gk.tube(f"{R}-limb{sign}", path, radii, YEW, n=6,
                              up=(1, 0, 0), power=2.3,
                              caps=(None, None)))
        # Horn nock with a string groove.
        tip = V(cx(BOW_HALF), 0, BOW_HALF * sign)
        d = (tip - V(cx(0.53), 0, 0.53 * sign)).normalized()
        pieces.append(gk.loft(f"{R}-nock{sign}", [
            [p for p in gk.rings_along([tip - d * 0.008, tip], [0.0068, 0.0068],
                                       n=6, up=(1, 0, 0))[0]],
            gk.rings_along([tip - d * 0.008, tip], [0.0068, 0.0068], n=6,
                           up=(1, 0, 0))[1],
            gk.rings_along([tip, tip + d * 0.012], [0.0052, 0.0052], n=6,
                           up=(1, 0, 0))[0],
            gk.rings_along([tip, tip + d * 0.022], [0.0052, 0.0046], n=6,
                           up=(1, 0, 0))[1]],
            HORN, start=None, end=tip + d * 0.03))
    # Leather grip wrap, with a raised edge each end.
    rings = []
    for z, r in ((-0.058, 0.0128), (-0.054, 0.0152), (-0.048, 0.0146),
                 (0.048, 0.0146), (0.054, 0.0152), (0.058, 0.0128)):
        rings.append([V(x, y, z) for x, y, _ in gk.sup(8, r * 0.96, r)])
    pieces.append(gk.loft(f"{R}-grip", rings, GRIP, start=None, end=None))
    # The string, tip to tip.
    top = V(cx(BOW_HALF) - 0.004, 0, BOW_HALF - 0.004)
    bot = V(cx(BOW_HALF) - 0.004, 0, -BOW_HALF + 0.004)
    pieces.append(gk.tube(f"{R}-string", [bot, lerp(bot, top, 0.5), top],
                          [0.0026] * 3, STRING, n=4, caps=(None, None)))
    return pieces


def build_offhand():
    pieces = fist(f"{R}-handL", C_L0, X_L0, K_L0, 1)
    bow = bow_local()
    m = gk.basis(X_L0, K_L0, Z_L0, C_L0)
    gk.transform(bow, m)
    return pieces + bow


def build_armR():
    pieces = upper_sleeve(f"{R}-armR", S_R0, E_R0)
    pieces.append(gk.ball(f"{R}-elbowR", 0.045, E_R0, GAMB, seg=10, rings=6))
    return pieces


def build_weapon():
    """The draw forearm and hand, made in the draw pose and turned back to
    rest; the arrow is returned separately."""
    s = SOL
    e1, wd, cd = s["e1"], s["wd"], s["cd"]
    fore = [e1, lerp(e1, wd, 0.32), lerp(e1, wd, 0.66), wd]
    pieces = [gk.tube(f"{R}-foreR", fore, [0.045, 0.045, 0.039, 0.031],
                      GAMB, n=10, caps=(None, "flat"), flute=0.05)]
    pieces.append(gk.ball(f"{R}-elbowR2", 0.044, e1, GAMB, seg=10, rings=6))
    # A leather cuff at the wrist.
    f = (wd - e1).normalized()
    pieces.append(gk.tube(f"{R}-cuffR", [wd - f * 0.05, wd - f * 0.004],
                          [0.037, 0.034], TAN, n=10, caps=("flat", "flat")))
    pieces += fist(f"{R}-handR", cd, s["xd"], s["kd"], -1)
    back = Matrix.Translation(E_R0) @ s["weapon_w"].inverted().to_matrix()\
        .to_4x4() @ Matrix.Translation(-e1)
    gk.transform(pieces, back)
    nock_rest = back @ s["nock"]
    # The nocked arrow, held low along the thigh at rest.
    arrow = arrow_full(f"{R}-arrow", nock_rest, A_REST)
    return pieces, arrow, nock_rest


def arrow_full(name, nock, d):
    tip = nock + d * ARROW_LEN
    pieces = [gk.tube(f"{name}-shaft", [nock + d * 0.004, tip - d * 0.03],
                      [0.0042, 0.0042], SHAFT, n=5, caps=(None, None))]
    pieces.append(gk.tube(f"{name}-nockb", [nock - d * 0.002,
                                            nock + d * 0.01],
                          [0.0055, 0.0048], HORN, n=5, caps=("dome", None)))
    # A slim iron bodkin head.
    frame_u = d.orthogonal().normalized()
    frame_v = d.cross(frame_u)

    def ring(at, r):
        return [at + frame_u * math.cos(a) * r + frame_v * math.sin(a) * r
                for a in (i / 4 * math.tau + math.pi / 4 for i in range(4))]

    pieces.append(gk.loft(f"{name}-head",
                          [ring(tip - d * 0.036, 0.005),
                           ring(tip - d * 0.03, 0.0072),
                           ring(tip - d * 0.022, 0.0068)],
                          IRON, start="pole", end=tip))
    pieces += vanes(name, nock + d * 0.026, -d, 0.35, length=0.07,
                    height=0.0115)
    return pieces


# ------------------------------------------------------------- build


def build(root_name="guard"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.094, 0.03, 0.362), V(-0.106, 0.034, 0.078), 13),
            ("R", 1, V(0.088, 0.008, 0.358), V(0.095, -0.008, 0.078), 7)):
        pieces, hip = leg(sx, knee, ankle, out)
        gk.part(R, f"leg{side}", pieces, hip, root)

    hood_obj = hood()
    head = [face(), hood_obj, liripipe()] + eyes() + beard()
    torso = [gambeson(), cape(hood_obj)] + tabard(1) + tabard(-1) + belt() + \
        pouch() + dagger() + quiver()
    torso_obj = gk.part(R, "torso", torso, WAIST, root)
    face_rig.head(gk.part, R, head, NECK, torso_obj, angle=62)

    arm_l = gk.part(R, "armL", build_armL(), S_L0, torso_obj)
    gk.part(R, "offhand", build_offhand(), W_L0, arm_l)
    arm_r = gk.part(R, "armR", build_armR(), S_R0, torso_obj)
    weapon, arrow, nock_rest = build_weapon()
    weapon_obj = gk.part(R, "weapon", weapon, E_R0, arm_r)
    gk.part(R, "arrow", arrow, nock_rest, weapon_obj)

    poses = {}
    for name, pose in SOL["poses"].items():
        poses[name] = {k: [round(c, 5) for c in q.normalized()]
                       for k, q in pose.items()}
    root["poses"] = json.dumps(poses, separators=(",", ":"))
    report(root, nock_rest)

    which = os.environ.get("GUARD_POSE")
    if which in poses:
        apply_pose(root, SOL["poses"][which], hide_arrow=(which == "loose"))
    return root


def apply_pose(root, pose, hide_arrow=False):
    for o in kit.descendants(root):
        if o.type != "MESH":
            continue
        key = o.name.split(".", 1)[1]
        if key in pose:
            o.rotation_mode = "QUATERNION"
            o.rotation_quaternion = pose[key]
        if hide_arrow and key == "arrow":
            kit.bpy.data.objects.remove(o, do_unlink=True)
    kit.refresh()


def report(root, nock_rest):
    s = SOL
    print("GUARD joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) rot {tuple(round(r, 4) for r in o.rotation_euler)}"
                  f" tris {gk.tris(o)}")
    tip = s["nock_final"] + s["arrow_final"] * ARROW_LEN
    print("GUARD draw: nock", tuple(round(c, 4) for c in s["nock_final"]),
          "tip", tuple(round(c, 4) for c in tip),
          "dir", tuple(round(c, 4) for c in s["arrow_final"]))
    print("GUARD draw: bow fist", tuple(round(c, 4) for c in s["fist_w_final"]),
          "elbow", tuple(round(c, 4) for c in s["e1_final"]))
    a_rest = A_REST
    print("GUARD rest arrow dir", tuple(round(c, 3) for c in a_rest),
          "nock", tuple(round(c, 4) for c in nock_rest),
          "tip", tuple(round(c, 4) for c in nock_rest + a_rest * ARROW_LEN))
    print("GUARD rest knuckles R", tuple(round(c, 3) for c in
                                         s["weapon_w"].inverted() @ s["kd"]))
