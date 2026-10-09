"""The Inventor's gear: the Tesla coil backpack and the copper zapper wand.

Hard parts, rigid on their joints: the pack on the chest, its coil ball on
`extra`, the wand on `weapon`. Built in Blender metres (+Y forward, Z up);
the wand is authored in its own frame (barrel +Y, top +Z) and placed in
her right fist.
"""
import math

import numpy as np
from mathutils import Matrix, Vector

import kit
import figure_inventor_mesh as M
from figure_inventor_mesh import g, ss
from figure_inventor_sculpt import BRASS, COPPER, LEATHER, LEATHER_DARK

TAU = math.tau
T = kit.tint
# Few paints, so the pack and the wand draw in few batches: a dark brown
# enamel (the case, the grips, the gauge's ink), a cream (dials and
# insulators), glass (gauge, jar and the goggles' lenses share it).
ENAMEL = "lacquer:" + T("inventor-enamel", "#45301f")
GLASS = "lacquer:" + T("inventor-glass", "#8ec4d8")
CERAMIC = "resin:" + T("inventor-cream", "#ece4d2")
DIAL = CERAMIC
INK = ENAMEL
CHROME = "chrome:" + T("inventor-chrome", "#d7dde3")
SPARK = "glow:" + T("inventor-spark", "#8eeeff")
WOOD = ENAMEL
HOSE = LEATHER_DARK
BAKELITE = ENAMEL

# Where the pack sits: its front face against the coat's back.
PACK_FRONT = -.093
PACK_DEPTH = .062
PACK_X = (-.074, .074)
PACK_Z = (.700, .930)
# The coil stands on a bracket at the case's top right, over her right
# shoulder and clear of her right puff.
COIL = np.array([.094, PACK_FRONT - .034, 0.0])
COIL_TOP = 1.212
BALL_R = .030
BALL = np.array([COIL[0], COIL[1], COIL_TOP + .034])


def ring_pts(c, axis, r, n=48, phase=0.0):
    axis = np.asarray(axis, float)
    axis /= np.linalg.norm(axis)
    a = np.cross(axis, [0, 1, 0] if abs(axis[1]) < .9 else [1, 0, 0])
    a /= np.linalg.norm(a)
    b = np.cross(axis, a)
    t = np.linspace(0, TAU, n, endpoint=False) + phase
    return np.asarray(c) + np.outer(np.cos(t) * r, a) + np.outer(np.sin(t) * r, b)


def lathe(name, profile, c, axis, mat, n=48, caps=("pole", "pole")):
    """Revolve [(radius, height)] about an axis through c."""
    axis = np.asarray(axis, float)
    axis /= np.linalg.norm(axis)
    rows = [ring_pts(np.asarray(c) + axis * h, axis, r, n) for r, h in profile]
    return M.grid(name, np.array(rows), mat, cap0=caps[0], cap1=caps[1])


def torus(name, c, axis, R, r, mat, n=64, m=16):
    axis = np.asarray(axis, float)
    axis /= np.linalg.norm(axis)
    ring = ring_pts(c, axis, R, n)
    ring = np.concatenate([ring, ring[:1]])
    return M.sweep(name, ring, [r] * len(ring), mat, n=m, up=tuple(axis), caps=(None, None))


def rbox(name, size, at, mat, levels=3, crease=0.75):
    import figure_folk_kit as fk
    o = fk.rbox(name, size, Vector(at), mat, levels=levels, crease=crease)
    o.data.shade_smooth()
    return o


# ------------------------------------------------------------- the pack

def pack():
    """The case, its brass trim and rivets, the gauge, glowing valves, the
    capacitor jar and the copper-wound coil (the ball is separate)."""
    out = []
    x0, x1 = PACK_X
    z0, z1 = PACK_Z
    yb = PACK_FRONT - PACK_DEPTH
    c = np.array([(x0 + x1) / 2, PACK_FRONT - PACK_DEPTH / 2, (z0 + z1) / 2])
    out.append(rbox("inventor.pack-case", (x1 - x0, PACK_DEPTH, z1 - z0), c, ENAMEL))
    # Brass edging round the back face and the top, corner guards.
    e = .006
    back = [np.array([x0 + e, yb - .001, z0 + e]), np.array([x1 - e, yb - .001, z0 + e]),
            np.array([x1 - e, yb - .001, z1 - e]), np.array([x0 + e, yb - .001, z1 - e])]
    for i in range(4):
        a, b = back[i], back[(i + 1) % 4]
        out.append(M.sweep(f"inventor.pack-edge-{i}", [a, b], [(.0035, .0035)] * 2, BRASS,
                           n=12, caps=("dome", "dome")))
    for i, p in enumerate(back):
        out.append(M.ball(f"inventor.pack-corner-{i}", .0065, p + [0, .004, 0], BRASS,
                          seg=16, rings=8))
    # Rivets along the edging.
    k = 0
    for i in range(4):
        a, b = back[i], back[(i + 1) % 4]
        for t in np.linspace(.18, .82, 4):
            p = a + (b - a) * t + np.array([0, -.0032, 0])
            out.append(M.ball(f"inventor.pack-rivet-{k}", .0021, p, BRASS, seg=10, rings=5))
            k += 1
    # Two copper bands round the case.
    for j, z in enumerate((z0 + .045, z1 - .055)):
        rows = []
        for dz in (-.007, .007):
            ring = []
            for t in np.linspace(0, TAU, 72, endpoint=False):
                ring.append([c[0] + math.copysign(abs(math.cos(t)) ** .25, math.cos(t)) * (x1 - x0) / 2 * 1.035,
                             c[1] + math.copysign(abs(math.sin(t)) ** .25, math.sin(t)) * PACK_DEPTH / 2 * 1.06,
                             z + dz])
            rows.append(ring)
        o = np.array(rows)
        i_ = o.copy()
        i_[..., 0] = c[0] + (o[..., 0] - c[0]) * .96
        i_[..., 1] = c[1] + (o[..., 1] - c[1]) * .90
        out.append(M.solid_shell(f"inventor.pack-band-{j}", o, i_, COPPER, closed=True))
    # The pressure gauge on the back, upper left.
    gc = np.array([-.034, yb - .002, .862])
    axis = np.array([0, -1.0, 0])
    out.append(lathe("inventor.gauge-bezel", [(.0245, -.001), (.0262, .004), (.0262, .009),
                                              (.0230, .011), (.0205, .010)], gc, axis, BRASS,
                     caps=("pole", "pole")))
    out.append(lathe("inventor.gauge-dial", [(.0205, .006), (.0204, .0072)], gc, axis, DIAL,
                     caps=("pole", "pole")))
    for t in np.linspace(-2.4, 2.4, 9):
        a = gc + axis * .0074 + np.array([math.sin(t) * .0165, 0, math.cos(t) * .0165])
        b = gc + axis * .0074 + np.array([math.sin(t) * .0195, 0, math.cos(t) * .0195])
        out.append(M.sweep(f"inventor.gauge-tick-{t:.1f}", [a, b], [.0007] * 2, INK, n=6,
                           caps=("dome", "dome")))
    out.append(M.sweep("inventor.gauge-needle", [gc + axis * .0080, gc + axis * .0080 +
                                                 np.array([.012, 0, .009])],
                       [(.0011, .0006), (.0005, .0004)], INK, n=6, caps=("dome", "dome")))
    out.append(lathe("inventor.gauge-glass", [(.0205, .0085), (.014, .0105), (.0001, .0112)],
                     gc, axis, GLASS, caps=("pole", None)))
    # Three glowing valves in a dark window, behind brass bars.
    wc = np.array([.030, yb - .0005, .770])
    out.append(rbox("inventor.valve-window", (.052, .004, .046), wc, INK, levels=2, crease=.6))
    for j, x in enumerate((-.016, 0.0, .016)):
        p = wc + np.array([x, -.006, -.016])
        out.append(M.sweep(f"inventor.valve-{j}", [p, p + [0, 0, .030]],
                           [.0058, .0058], SPARK, n=16, caps=("dome", "dome")))
        out.append(lathe(f"inventor.valve-socket-{j}", [(.0072, -.004), (.0075, .002), (.0062, .004)],
                         p, (0, 0, 1), BRASS, n=20))
    for j, x in enumerate(np.linspace(-.024, .024, 5)):
        p = wc + np.array([x, -.013, -.022])
        out.append(M.sweep(f"inventor.valve-bar-{j}", [p, p + [0, 0, .044]], [.0011] * 2,
                           BRASS, n=8, caps=("dome", "dome")))
    # A brass lever on her left side of the case.
    lp = np.array([x0 - .002, c[1], .80])
    out.append(lathe("inventor.lever-pivot", [(.008, 0), (.008, .006), (.004, .008)], lp,
                     (-1, 0, 0), BRASS, n=20))
    out.append(M.sweep("inventor.lever", [lp + [-.006, 0, 0], lp + [-.008, -.012, .032]],
                       [.0028, .0022], BRASS, n=10, caps=("dome", "dome")))
    out.append(M.ball("inventor.lever-knob", .0055, lp + [-.008, -.013, .035], BAKELITE,
                      seg=16, rings=8))
    # The coil: a brass bracket off the case's corner, a brass foot, a fat
    # copper winding with three brass bands, an insulator stack, a brass
    # toroid and the stalk the ball sits on.
    cc = COIL.copy()
    out.append(rbox("inventor.coil-bracket", (.040, .030, .020), [cc[0] - .012, cc[1] + .004, .930], BRASS,
                    levels=2, crease=.6))
    out.append(lathe("inventor.coil-foot", [(.040, .930), (.042, .940), (.036, .950),
                                            (.035, .960)], [cc[0], cc[1], 0], (0, 0, 1), BRASS, n=40))
    zs = np.linspace(.956, 1.140, 110)
    rows = []
    for z in zs:
        t = np.linspace(0, TAU, 56, endpoint=False)
        r = .0330 + .0013 * np.abs(np.sin((z - .956) / .0048 * math.pi))
        ring = np.stack([cc[0] + np.cos(t) * r, cc[1] + np.sin(t) * r, np.full_like(t, z)], 1)
        rows.append(ring)
    out.append(M.grid("inventor.coil-winding", np.array(rows), COPPER, cap0="pole", cap1="pole"))
    for j, z in enumerate((.972, 1.050, 1.128)):
        out.append(lathe(f"inventor.coil-band-{j}", [(.0355, z - .007), (.0372, z - .005),
                                                    (.0372, z + .005), (.0355, z + .007)],
                         [cc[0], cc[1], 0], (0, 0, 1), BRASS, n=40))
    for j, z in enumerate((1.148, 1.162, 1.176)):
        out.append(lathe(f"inventor.insulator-{j}", [(.015, z - .006), (.026, z - .002),
                                                    (.026, z + .002), (.015, z + .006)],
                         [cc[0], cc[1], 0], (0, 0, 1), CERAMIC, n=36))
    out.append(M.sweep("inventor.coil-core", [[cc[0], cc[1], 1.138], [cc[0], cc[1], COIL_TOP + .004]],
                       [.011, .010], BRASS, n=20, caps=("flat", "flat")))
    out.append(torus("inventor.coil-toroid", [cc[0], cc[1], 1.196], (0, 0, 1), .031, .0115,
                     BRASS, n=64, m=18))
    # The capacitor jar on her left, wired to the coil.
    jc = np.array([-.040, PACK_FRONT - .034, .930])
    out.append(lathe("inventor.jar-glass", [(.020, .000), (.024, .006), (.024, .074),
                                            (.020, .082), (.012, .086)], jc, (0, 0, 1), GLASS, n=40))
    out.append(lathe("inventor.jar-foil", [(.0247, .004), (.0252, .010), (.0252, .040),
                                           (.0247, .044)], jc, (0, 0, 1), COPPER, n=40))
    out.append(lathe("inventor.jar-lid", [(.0215, .080), (.0225, .085), (.0200, .090),
                                          (.0060, .093)], jc, (0, 0, 1), BRASS, n=40))
    top = jc + [0, 0, .093]
    out.append(M.sweep("inventor.jar-rod", [top, top + [0, 0, .018]], [.0028, .0028], BRASS,
                       n=12, caps=("flat", "flat")))
    out.append(M.ball("inventor.jar-knob", .0068, top + [0, 0, .022], BRASS, seg=20, rings=10))
    wire = M.catmull([top + [0, 0, .022], top + [.050, -.010, .045], [cc[0] - .026, cc[1] - .012, 1.09],
                      [cc[0] - .034, cc[1] - .002, 1.06]], 8)
    out.append(M.sweep("inventor.jar-wire", wire, [.0017] * len(wire), COPPER, n=10,
                       caps=("dome", "dome")))
    # A thick rubber cable from the case side up into the coil's foot.
    cable = M.catmull([[x1 + .002, c[1], .760], [x1 + .022, c[1] + .004, .820],
                       [x1 + .028, c[1] - .004, .890], [cc[0] + .026, cc[1], .936]], 8)
    out.append(M.sweep("inventor.pack-cable", cable, [.0055] * len(cable), HOSE, n=14,
                       shape=lambda t, a: .0007 * np.sin(t * 140), caps=("dome", "dome")))
    return out


def ball():
    """The coil's polished ball and three crackles of lightning hugging it,
    jagged arcs leaping from its surface back onto it."""
    out = [M.icosphere("inventor.coil-ball", BALL_R, BALL, CHROME, level=4)]
    rng = np.random.default_rng(11)
    for k, (d0, d1) in enumerate((([.9, .3, .2], [.3, .8, .7]), ([-.8, -.2, .5], [-.2, -.9, .3]),
                                  ([.2, -.7, .6], [.8, -.3, -.2]))):
        a = np.array(d0, float)
        b = np.array(d1, float)
        a /= np.linalg.norm(a)
        b /= np.linalg.norm(b)
        pts = []
        steps = 7
        for j in range(steps + 1):
            t = j / steps
            d = a * (1 - t) + b * t
            d /= np.linalg.norm(d)
            lift = BALL_R * (1.0 + 0.55 * math.sin(math.pi * t))
            jag = rng.uniform(-.005, .005, 3) * (0 if j in (0, steps) else 1)
            pts.append(BALL + d * lift + jag)
        out.append(M.sweep(f"inventor.spark-{k}", np.array(pts), [.0018] * (steps + 1),
                           SPARK, n=6, caps=("dome", "dome")))
    return out


# ------------------------------------------------------------- the wand

# The wand in its own frame: the grip's centre (her fist) at the origin,
# the barrel along +Y, its top +Z.
FRONT_GRIP = np.array([0.0, .125, .000])
MUZZLE = np.array([0.0, .268, .040])
BARREL_Z = .040


def wand_local():
    out = []
    # The pistol grip: walnut, oval, a brass butt cap.
    rows = []
    for z in np.linspace(-.048, .028, 26):
        t = np.linspace(0, TAU, 40, endpoint=False)
        rx = .0098 + .0006 * g(z, -.040, .010)
        ry = .0138 + .0008 * g(z, -.040, .010)
        # Finger grooves on its front.
        groove = .0012 * np.cos(np.clip(z, -.032, .020) * 2 * math.pi / .0115) * (np.sin(t) > .3)
        rows.append(np.stack([np.cos(t) * rx, np.sin(t) * (ry - groove) - .002, np.full_like(t, z)], 1))
    out.append(M.grid("inventor.wand-grip", np.array(rows), WOOD, cap0="pole", cap1="pole"))
    out.append(lathe("inventor.wand-butt", [(.0102, -.052), (.0128, -.049), (.0130, -.044),
                                            (.0110, -.042)], [0, -.002, 0], (0, 0, 1), BRASS, n=32))
    # The receiver: a brass body with a dial and a knurled knob.
    out.append(rbox("inventor.wand-receiver", (.026, .074, .030), [0, .004, .040], BRASS,
                    levels=3, crease=.65))
    out.append(lathe("inventor.wand-dial", [(.0001, .0135), (.0085, .0135), (.0095, .016),
                                            (.0001, .0165)], [0, -.010, .040], (1, 0, 0), DIAL, n=28))
    out.append(lathe("inventor.wand-knob", [(.0001, -.022), (.0065, -.022), (.0070, -.012),
                                            (.0001, -.012)], [0, -.010, .046], (1, 0, 0), COPPER, n=24))
    # The trigger and its guard.
    out.append(M.sweep("inventor.wand-trigger", M.catmull([[0, .019, .026], [0, .022, .016],
                                                           [0, .019, .010]], 4),
                       [.0022] * 9, COPPER, n=10, caps=("dome", "dome")))
    out.append(M.sweep("inventor.wand-guard", M.catmull([[0, .006, .025], [0, .012, .004],
                                                         [0, .032, .002], [0, .040, .025]], 6),
                       [(.0016, .0028)] * 19, BRASS, n=10, up=(1, 0, 0), caps=("dome", "dome")))
    # The barrel: copper tube, a fat wound coil, brass rings.
    out.append(M.sweep("inventor.wand-barrel", [[0, .038, BARREL_Z], [0, .232, BARREL_Z]],
                       [.0118, .0108], COPPER, n=32, caps=("flat", "flat")))
    rows = []
    for y in np.linspace(.160, .222, 54):
        t = np.linspace(0, TAU, 40, endpoint=False)
        r = .0185 + .0010 * abs(math.sin((y - .160) / .0036 * math.pi)) + .0015 * g(y, .191, .026)
        rows.append(np.stack([np.cos(t) * r, np.full_like(t, y), BARREL_Z + np.sin(t) * r], 1))
    out.append(M.grid("inventor.wand-coil", np.array(rows), COPPER, cap0="pole", cap1="pole"))
    for j, y in enumerate((.048, .058, .100, .156, .226)):
        out.append(lathe(f"inventor.wand-ring-{j}", [(.0150, -.003), (.0168, -.0015), (.0168, .0015),
                                                     (.0150, .003)], [0, y, BARREL_Z], (0, 1, 0),
                         BRASS, n=32))
    # The front grip for her left hand, ebony with a brass collar.
    out.append(M.sweep("inventor.wand-fore", [[0, FRONT_GRIP[1], .030], [0, FRONT_GRIP[1], -.030]],
                       [(.0108, .0118), (.0112, .0122)], BAKELITE, n=28, caps=("flat", "dome")))
    out.append(lathe("inventor.wand-fore-collar", [(.0128, -.006), (.0140, -.003), (.0140, .003),
                                                   (.0128, .006)], [0, FRONT_GRIP[1], .024], (0, 0, 1),
                     BRASS, n=28))
    # The emitter: a chrome bell, a glowing lens, three brass prongs.
    out.append(lathe("inventor.wand-bell", [(.0112, .228), (.0135, .236), (.0190, .252),
                                            (.0230, .262), (.0236, .266), (.0205, .266),
                                            (.0150, .258)], [0, 0, BARREL_Z], (0, 1, 0), CHROME,
                     n=40, caps=("pole", "pole")))
    out.append(lathe("inventor.wand-lens", [(.0001, .259), (.0175, .259), (.0190, .2625),
                                            (.0001, .2645)], [0, 0, BARREL_Z], (0, 1, 0), SPARK,
                     n=32, caps=("pole", "pole")))
    for j in range(3):
        a = j / 3 * TAU + .5
        base = np.array([math.cos(a) * .0205, .262, BARREL_Z + math.sin(a) * .0205])
        tip = np.array([math.cos(a) * .0085, .290, BARREL_Z + math.sin(a) * .0085])
        mid = (base + tip) / 2 + np.array([math.cos(a) * .004, 0, math.sin(a) * .004])
        out.append(M.sweep(f"inventor.wand-prong-{j}", M.catmull([base, mid, tip], 4),
                           np.linspace(.0024, .0014, 9), BRASS, n=10, caps=("dome", "dome")))
    # A ribbed hose from the receiver's tail to a brass coupling.
    hose = M.catmull([[0, -.030, .034], [0, -.046, .018], [.004, -.050, -.012],
                      [.006, -.042, -.034]], 8)
    out.append(M.sweep("inventor.wand-hose", hose, [.0060] * len(hose), HOSE, n=16,
                       shape=lambda t, a: .0008 * np.sin(t * 90), caps=("dome", "dome")))
    out.append(lathe("inventor.wand-coupling", [(.0072, 0), (.0080, .004), (.0080, .012),
                                                (.0060, .015)], [.006, -.042, -.034],
                     (.1, .2, -1), BRASS, n=24))
    return out


def place(objs, origin, X, Y, Z):
    """Move objects from the wand's frame into the world."""
    m = Matrix(((X[0], Y[0], Z[0], origin[0]), (X[1], Y[1], Z[1], origin[1]),
                (X[2], Y[2], Z[2], origin[2]), (0, 0, 0, 1)))
    for o in objs:
        o.data.transform(m)
        o.data.update()
    return objs


def wand(origin, f, u):
    """The wand in her right fist: barrel along the hand (f), top toward
    the thumb (u)."""
    Y = np.asarray(f, float)
    Z = np.asarray(u, float)
    X = np.cross(Y, Z)
    return place(wand_local(), origin, X, Y, Z), (X, Y, Z)


# ------------------------------------------------------------- the harness

def straps(surf):
    """The pack's leather shoulder straps: from the case's top over each
    shoulder, down the coat's front to a brass ring, and back under the
    arm to the case's foot. Lie on the trunk's skin (weighted from it)."""
    import figure_miner_clay as mc
    from figure_miner_clay import V
    out = []
    for s in (-1, 1):
        path = [V(s * 0.052, -0.120, 0.905), V(s * 0.072, -0.060, 0.968), V(s * 0.090, 0.010, 0.968),
                V(s * 0.090, 0.075, 0.905), V(s * 0.092, 0.090, 0.840)]
        out.append(mc.strip(f"inventor.harness{s}", surf, path, 0.022, 0.0040, 0.0032, LEATHER,
                            samples=40, across=7))
        low = [V(s * 0.100, 0.085, 0.826), V(s * 0.118, 0.040, 0.806), V(s * 0.118, -0.040, 0.792),
               V(s * 0.068, -0.110, 0.760)]
        out.append(mc.strip(f"inventor.harness-low{s}", surf, low, 0.018, 0.0036, 0.0028, LEATHER,
                            samples=30, across=7))
        p, n = surf.ray(V(s * 0.094, 0.4, 0.833), (0, -1, 0))
        if p is not None:
            c = p + n * 0.0085
            side = n.cross(V(0, 0, 1)).normalized()
            ring = [c + (side * math.cos(t) + V(0, 0, 1) * math.sin(t)) * 0.0105 for t in np.linspace(0, TAU, 33)]
            import figure_folk_kit as fk
            out.append(fk.tube(f"inventor.harness-ring{s}", ring, [0.0024] * 33, BRASS, n=10, caps=(None, None)))
    return out
