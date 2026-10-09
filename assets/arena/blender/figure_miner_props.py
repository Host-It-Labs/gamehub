"""The Miner's hard props: the lacquered hard hat with its brass carbide
lamp, and the pickaxe (steel head on a wooden haft).

Rigid parts: the hat rides the `hat` joint, the pick the `weapon` joint in
the right fist. Built in place around the sculpt's head and grip.
"""

import math

import bmesh
import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as fk
import figure_miner_clay as mc
from figure_miner_clay import V, g

T = kit.tint
HAT_MAT = "lacquer:" + T("miner-hat", "#a9792f")
BAND = "lacquer:" + T("miner-hatband", "#5a3b1c")
BRASS = "gilt:" + T("miner-brass", "#cfa04a")
LENS = "glow:" + T("miner-lamp", "#fff1bf")
STEEL = "gilt:" + T("miner-steel", "#6f7882")
EDGE = "gilt:" + T("miner-edge", "#c8d0d8")
WOOD = "wood:" + T("miner-haft", "#a06d3d")

# The hat's crown: base centre, half sizes across and along the head.
HAT_BASE = V(0, -0.010, 1.168)
HAT_RX, HAT_RY = 0.100, 0.112
HAT_H = 0.142


def crown_point(a, t, grow=0.0):
    """t 0 at the base to 1 at the top of the dome; a around (0 front)."""
    prof = [(0.0, 1.0, 0.0), (0.18, 0.995, 0.030), (0.38, 0.965, 0.064),
            (0.55, 0.905, 0.092), (0.70, 0.810, 0.114), (0.82, 0.680, 0.128),
            (0.91, 0.500, 0.137), (0.97, 0.260, 0.141), (1.0, 0.0, 0.142)]
    r, z = mc.table([(p[0], p[1], p[2]) for p in prof], t)
    # The crown sits a little lower at the back, rises to the front.
    tilt = 0.006 * math.cos(a)
    return V(math.sin(a) * (HAT_RX * r + grow), HAT_BASE.y + math.cos(a) * (HAT_RY * r + grow),
             HAT_BASE.z + z * HAT_H / 0.142 + tilt + grow * 0.5 * (t ** 2))


# The hat sits pushed back on the head (its front raised), so the brim
# clears the eyes from the game's high camera.
HAT_TILT = math.radians(9.0)


def hat():
    out = hat_parts()
    pivot = V(0, HAT_BASE.y, HAT_BASE.z)
    m = Matrix.Translation(pivot) @ Matrix.Rotation(HAT_TILT, 4, "X") @ Matrix.Translation(-pivot)
    for o in out:
        o.data.transform(m)
        o.data.update()
    return out


def hat_parts():
    out = []
    n, m = 96, 40
    outer = [[crown_point(i / n * math.tau, t) for i in range(n)] for t in np.linspace(0, 1, m)]
    inner = [[crown_point(i / n * math.tau, t, -0.006) for i in range(n)] for t in np.linspace(0, 1, m)][::-1]
    c = fk.Mesh("miner.hat-crown", HAT_MAT)
    vo = [[c.v(p) for p in r] for r in outer]
    vi = [[c.v(p) for p in r] for r in inner]
    c.grid(vo, HAT_MAT, closed=True)
    c.grid(vi, HAT_MAT, closed=True)
    c.grid([vo[0], vi[-1]], HAT_MAT, closed=True, flip=True)
    o = c.obj(recalc=True)
    out.append(o)
    # The raised comb from brow to nape over the crown.
    comb = []
    for t in np.linspace(-0.92, 0.92, 40):
        a = 0.0 if t >= 0 else math.pi
        tt = 1 - abs(t)
        comb.append(crown_point(a, max(0.0, min(1.0, 0.02 + tt)), 0.002))
    out.append(fk.tube("miner.hat-comb", mc.smooth_points(comb, 48),
                       [(0.0085, 0.0060)] * 48, HAT_MAT, n=16, up=(1, 0, 0), caps=("dome", "dome")))
    # Brim: wider behind than in front, the edge rolled up a little.
    rings = []
    for k, (w, lift) in enumerate([(0.0, 0.0), (0.35, -0.002), (0.7, -0.004), (0.9, -0.002), (1.0, 0.004)]):
        row = []
        for i in range(n):
            a = i / n * math.tau
            ext = 0.026 + 0.010 * (1 - math.cos(a)) * 0.5 + 0.004 * abs(math.sin(a))
            r = w * ext
            p = crown_point(a, 0.0)
            d = V(math.sin(a), math.cos(a), 0)
            row.append(p + d * (r - 0.004) + V(0, 0, lift - 0.004 * w * abs(math.sin(a))))
        rings.append(row)
    c = fk.Mesh("miner.hat-brim", HAT_MAT)
    top = [[c.v(p + V(0, 0, 0.0035)) for p in r] for r in rings]
    bot = [[c.v(p - V(0, 0, 0.0035)) for p in r] for r in rings]
    c.grid(top, HAT_MAT, closed=True)
    c.grid(bot, HAT_MAT, closed=True, flip=True)
    c.grid([top[-1], bot[-1]], HAT_MAT, closed=True)
    c.grid([bot[0], top[0]], HAT_MAT, closed=True)
    out.append(c.obj(levels=1, recalc=True))
    # Band round the crown's base.
    band = [[crown_point(i / n * math.tau, t, 0.0022) for i in range(n)] for t in np.linspace(0.0, 0.16, 5)]
    out.append(fk.loft("miner.hat-band", band, BAND, closed=True, recalc=True))
    out += lamp()
    for o in out:
        for p in o.data.polygons:
            p.use_smooth = True
    return out


def lamp():
    """Brass carbide lamp on a bracket on the front of the crown: a squat
    tank, a deep reflector and a glowing lens."""
    out = []
    front = crown_point(0.0, 0.42)
    fwd = V(0, 1, -0.16).normalized()
    up = V(0, 0.16, 1).normalized()
    side = fwd.cross(up).normalized()
    centre = front + fwd * 0.024 + V(0, 0, 0.006)
    # Bracket: a curved plate on the crown with two rivets.
    rows = []
    for t in np.linspace(0.20, 0.62, 10):
        row = []
        for a in np.linspace(-0.28, 0.28, 12):
            row.append(crown_point(a, t, 0.0025))
        rows.append(row)
    c = fk.Mesh("miner.lamp-bracket", BRASS)
    top = [[c.v(p) for p in r] for r in rows]
    bot = [[c.v(p - (p - HAT_BASE - V(0, 0, 0.05)).normalized() * 0.003) for p in r] for r in rows]
    c.grid(top, BRASS)
    c.grid(bot, BRASS, flip=True)
    for j in range(len(rows) - 1):
        c.face((top[j][0], bot[j][0], bot[j + 1][0], top[j + 1][0]), BRASS)
        c.face((top[j + 1][-1], bot[j + 1][-1], bot[j][-1], top[j][-1]), BRASS)
    c.face(top[0] + bot[0][::-1], BRASS)
    c.face(bot[-1][::-1] + top[-1], BRASS)
    out.append(c.obj(recalc=True))
    for a in (-0.18, 0.18):
        out.append(fk.ball(f"miner.lamp-rivet{a}", 0.0035, crown_point(a, 0.30, 0.0045), BRASS, seg=12))
    # The arm from the bracket to the lamp.
    out.append(fk.tube("miner.lamp-arm", [front + V(0, 0.002, 0.004), centre - fwd * 0.016],
                       [0.0075, 0.0068], BRASS, n=14, caps=("dome", "dome")))
    # Tank and reflector, along fwd.
    def ring(at, r, k=24):
        return [at + (side * math.cos(i / k * math.tau) + up * math.sin(i / k * math.tau)) * r for i in range(k)]
    prof = [(-0.018, 0.0), (-0.0178, 0.012), (-0.015, 0.0205), (-0.006, 0.0215), (0.000, 0.0222),
            (0.006, 0.0255), (0.014, 0.0300), (0.019, 0.0322), (0.0205, 0.0318), (0.0205, 0.0270),
            (0.0175, 0.0255)]
    rings = [ring(centre + fwd * d, max(1e-4, r), 40) for d, r in prof]
    out.append(fk.loft("miner.lamp-body", rings, BRASS, start="pole", end=None, recalc=True))
    lens = [ring(centre + fwd * (0.0172 + 0.002 * (1 - t * t)), 0.0256 * t, 40) for t in np.linspace(1, 0.02, 6)]
    out.append(fk.loft("miner.lamp-lens", lens, LENS, end="pole", recalc=True))
    # The knob on top (the water valve) and the striker wheel's boss.
    out.append(fk.tube("miner.lamp-valve", [centre + up * 0.020 - fwd * 0.010, centre + up * 0.031 - fwd * 0.010],
                       [0.0042, 0.0042], BRASS, n=14, caps=("flat", "dome")))
    out.append(fk.ball("miner.lamp-boss", 0.0052, centre + side * 0.024 + fwd * 0.004, BRASS, seg=14))
    return out


# ------------------------------------------------------------- pick

PICK_LEN = 0.74
PICK_HEAD_AT = 0.705
GRIP_R_AT = 0.150  # the right fist's place along the haft from the butt
GRIP_L_AT = 0.058  # the left fist's, near the knob


def pick_local():
    """The pickaxe in its own frame: +y along the haft from the butt (0)
    toward the head, +x toward the long point, z across."""
    out = []
    # Haft: oval, swelling a little toward the head, a knob at the butt.
    ys = np.linspace(0.0, PICK_LEN, 40)
    rad = []
    for y in ys:
        t = y / PICK_LEN
        r = 0.0158 + 0.0018 * t + 0.0042 * g(y, 0.010, 0.016)
        rad.append((r, r * 0.88))
    pts = [V(0, y, 0) for y in ys]
    h = fk.tube("miner.pick-haft", pts, rad, WOOD, n=20, up=(1, 0, 0), caps=("dome", "dome"))
    _uv_along(h, PICK_LEN)
    out.append(h)
    # The eye: a forged collar round the haft.
    hy = PICK_HEAD_AT
    eye = fk.rbox("miner.pick-eye", (0.040, 0.050, 0.036), V(0, hy, 0), STEEL, levels=2, crease=0.6)
    out.append(eye)
    # The long point and the broad chisel, curving back toward the hands.
    for name, side, length, droop, w0, flat in (("point", 1, 0.235, 0.060, 0.0145, False),
                                                 ("chisel", -1, 0.185, 0.045, 0.0150, True)):
        n = 22
        rings = []
        for k in range(n):
            t = k / (n - 1)
            x = side * (0.016 + length * t)
            y = hy - droop * t * t
            c = V(x, y, 0)
            # tangent along the curve
            d = V(side, -2 * droop * t / length, 0).normalized()
            nrm = V(-d.y, d.x, 0) * side
            if flat:
                hw = w0 * (1 - 0.45 * t)  # height in the curve's plane
                hz = 0.0145 + 0.010 * t ** 1.5  # widens across into a blade
                hw = max(0.0012, hw * (1 - t ** 3))
            else:
                hw = max(0.0006, w0 * (1 - t) ** 1.15)
                hz = max(0.0006, 0.0130 * (1 - t) ** 1.15)
            ring = []
            for i in range(16):
                a = i / 16 * math.tau
                ca, sa = math.cos(a), math.sin(a)
                ring.append(c + nrm * fk.spow(ca, 0.6) * hw + V(0, 0, fk.spow(sa, 0.6) * hz))
            rings.append(ring)
        o = fk.loft(f"miner.pick-{name}", rings, STEEL, start="pole", end="pole", recalc=True,
                    bands=lambda i, j: EDGE if isinstance(j, int) and j >= n - 6 else STEEL)
        out.append(o)
    # A wedge in the haft's top.
    out.append(fk.rbox("miner.pick-wedge", (0.010, 0.010, 0.030), V(0, PICK_LEN + 0.004, 0), STEEL,
                       levels=1, crease=0.4))
    for o in out:
        for p in o.data.polygons:
            p.use_smooth = True
    return out


def _uv_along(o, length):
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new(name="UVMap")
    uv = me.uv_layers.active.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            a = math.atan2(co.z, co.x)
            uv[li].uv = ((a / math.tau + 0.5) * 0.12, co.y / 0.45)


def place(objs, origin, x_axis, y_axis):
    """Move pick-local objects into the world: origin at the butt, y along
    the haft, x toward the point."""
    y = Vector(y_axis).normalized()
    x = (Vector(x_axis) - y * Vector(x_axis).dot(y)).normalized()
    z = x.cross(y)
    m = fk.basis(x, y, z, origin)
    for o in objs:
        o.data.transform(m)
        o.data.update()
    return objs
