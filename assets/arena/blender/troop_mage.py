"""The Wizard (card id `mage`): a plastic fantasy wizard in a long gold-
trimmed team robe with a belt and a shoulder mantle, a tall pointed team
hat with raised gold stars, a long white beard, a staff crowned by a
glowing orb, and a free casting hand holding a glowing flame.

The robe, mantle, hat and beard are crisp moulded shells with gentle folds;
hands, boots and nose are subdivided cages; stars, buckle and staff fittings
are bevelled hard pieces (see figures_b.py). The robe hides the legs: each
leg part is a boot that peeks out under the hem, so the walk still shows.
"""

import math

import kit
import figures_b as fb
from figures_b import V, lerp
from mathutils import Matrix

TEAM = "plastic:team"
TEAM2 = "plastic:team2"
GOLD = "plastic:" + kit.tint("mage-gold", "#e9b43e")
SKIN = "vinyl:" + kit.tint("mage-skin", "#f3c7a6")
NOSE = "vinyl:" + kit.tint("mage-nose", "#efa98f")
BEARD = "plastic:" + kit.tint("mage-beard", "#f4f2ec")
BELT = "plastic:" + kit.tint("mage-belt", "#6d4327")
BOOT = "plastic:" + kit.tint("mage-boot", "#5b3a27")
WOOD = "plastic:" + kit.tint("mage-wood", "#8d5b34")
ORB = "glow:" + kit.tint("mage-orb", "#ffb23c")
CORE = "glow:" + kit.tint("mage-core", "#fff1c4")

HIP_Z = 0.42
HIP_X = 0.08
WAIST = V(0, 0, 0.44)
SH_X, SH_Z = 0.165, 0.8
NECK = V(0, 0, 0.84)
HEAD_C = V(0, 0.02, 0.945)
HAT_Z = 1.045
HAT_TILT = math.radians(8)       # tipped back so the eyes show
# The staff stands at his right side; its orb crowns it.
STAFF_X, STAFF_Y = 0.3, 0.12
HAND_R = V(STAFF_X, STAFF_Y, 0.62)
ORB_C = V(STAFF_X, STAFF_Y, 1.35)
ORB_R = 0.066
# The casting hand, palm up in front of him, and its flame.
PALM = V(-0.245, 0.3, 0.655)
GLOW = PALM + V(0.0, 0.0, 0.09)

# Robe: (z, half width, half depth, fold strength).
ROBE = [(0.012, 0.28, 0.262, 1.0), (0.05, 0.28, 0.262, 1.0),
        (0.056, 0.268, 0.25, 1.0), (0.2, 0.24, 0.218, 0.8),
        (0.36, 0.202, 0.178, 0.45), (0.5, 0.172, 0.148, 0.1),
        (0.62, 0.176, 0.146, 0.0), (0.72, 0.184, 0.14, 0.0),
        (0.79, 0.164, 0.118, 0.0), (0.83, 0.108, 0.084, 0.0),
        (0.852, 0.066, 0.058, 0.0)]


def clamp01(t):
    return max(0.0, min(1.0, t))


def robe_r(z):
    for (z0, x0, y0, f0), (z1, x1, y1, f1) in zip(ROBE, ROBE[1:]):
        if z <= z1:
            t = clamp01((z - z0) / (z1 - z0))
            return lerp(x0, x1, t), lerp(y0, y1, t), lerp(f0, f1, t)
    return ROBE[-1][1:]


def adist(a, b):
    d = (a - b) % 360
    return min(d, 360 - d)


def robe(t):
    """The long robe: soft folds round the skirt, a raised gold hem that
    lifts at the front over the boots, and a gold band down the front."""
    band = 4.0
    angs = sorted(set([i * 12.0 for i in range(30) if adist(i * 12, 90) > 7]
                      + [90 - band, 90 + band]))
    c = fb.Cage(f"{t}-robe", TEAM)
    rings = []
    for k, (z, rx, ry, fold) in enumerate(ROBE):
        pts = []
        for a in angs:
            ar = math.radians(a)
            front = max(0.0, math.sin(ar))
            f = fold * 0.02 * math.cos(5 * (ar - math.pi / 2)) * \
                (1 - front ** 3)
            off = 0.012 if k < 2 else 0.0
            if adist(a, 90) <= band + 0.01 and 2 <= k <= 5:
                off += 0.004
            x = (rx + f + off) * math.cos(ar)
            y = (ry + f + off) * math.sin(ar)
            zz = z
            if k <= 2:
                zz += 0.075 * front ** 5
            pts.append(V(x, y, zz))
        rings.append(c.ring(pts))
    n = len(angs)
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        for i in range(n):
            j = (i + 1) % n
            mat = TEAM
            if k < 2:
                mat = GOLD
            elif k <= 4 and angs[i] == 90 - band:
                mat = GOLD
            f = c.bm.faces.new((a[i], a[j], b[j], b[i]))
            f.material_index = c.m(mat)
    c.ngon(rings[0], TEAM2, end=False)
    c.fan(rings[-1], V(0, 0, 0.86), TEAM, end=True)
    return c.obj(levels=0)


def mantle(t):
    """A short shoulder mantle in the dark team tone with a gold hem: it
    broadens the shoulders and covers where the sleeves meet the robe."""
    prof = [(0.866, 0.074, 0.066, 0.0), (0.846, 0.13, 0.112, 0.0),
            (0.812, 0.2, 0.152, 0.004), (0.77, 0.232, 0.17, 0.008),
            (0.728, 0.244, 0.178, 0.01), (0.716, 0.244, 0.178, 0.01),
            (0.712, 0.19, 0.15, 0.0)]
    rings = []
    for z, rx, ry, fold in prof:
        pts = []
        for i in range(24):
            a = i / 24 * math.tau
            f = fold * 0.6 * math.cos(4 * a)
            pts.append(V((rx + f) * math.cos(a), (ry + f) * math.sin(a), z))
        rings.append(pts)
    return fb.loft(f"{t}-mantle", rings, TEAM2, bands={4: GOLD, 5: GOLD},
                   start="pole", end=None, levels=0)


def belt(t):
    z0, z1 = 0.5, 0.548
    rings = []
    for z, off in ((z0, 0.004), (z0 + 0.004, 0.011), (z1 - 0.004, 0.011),
                   (z1, 0.004)):
        rx, ry, _ = robe_r(z)
        rings.append(fb.hring(z, rx + off, ry + off, 24))
    pieces = [fb.loft(f"{t}-belt", rings, BELT, start=None, end=None,
                      levels=0)]
    ry = robe_r(0.524)[1] + 0.011
    m = fb.basis(V(1, 0, 0), V(0, 0, 1), V(0, -1, 0), V(0, ry + 0.012, 0.524))
    outer = [(x, y) for x, y, _ in fb.sup(12, 0.036, 0.03, 3.2)]
    pieces.append(fb.slab(f"{t}-buckle", outer, 0.012, GOLD, bevel=0.003,
                          matrix=m))
    return pieces


def star_on(name, surface, h, a, r, depth=0.009, bevel=0.0028):
    """A raised gold star on a surface of revolution `surface(h, a)`."""
    p = surface(h, a)
    du = surface(h, a + 0.02) - surface(h, a - 0.02)
    dv = surface(h + 0.01, a) - surface(h - 0.01, a)
    normal = du.cross(dv).normalized()
    if normal.dot(p - surface(h, a + math.pi)) < 0:
        normal = -normal
    m = fb.look(normal, dv, p - normal * 0.006)
    return fb.slab(name, fb.outline_star(r, r * 0.45), depth, GOLD,
                   bevel=bevel, matrix=m)


def hat(t):
    """Built round a local base at the origin, then set on the head and
    tipped back."""
    pieces = []
    base = V(0, 0, 0)
    # The brim: a wide moulded ring whose edge droops at the front and
    # lifts a little at the back.
    prof = [(0.118, 0.018), (0.176, 0.006), (0.222, -0.01), (0.23, -0.018),
            (0.222, -0.026), (0.176, -0.012), (0.118, -0.004)]
    c = fb.Cage(f"{t}-brim", TEAM)
    rings = []
    for r, dz in prof:
        rings.append(c.ring([base + V(math.cos(a) * r, math.sin(a) * r * 1.04,
                                      dz - 0.016 * math.sin(a) *
                                      (r - 0.118) / 0.11)
                             for a in (i / 24 * math.tau for i in range(24))]))
    for k in range(len(rings)):
        c.bridge(rings[k], rings[(k + 1) % len(rings)])
    pieces.append(c.obj(levels=0, recalc=True))

    # The cone rises from the brim and flops back and aside near the tip.
    H = 0.5
    prof = [(0.0, 0.126), (0.012, 0.131), (0.052, 0.126), (0.058, 0.118),
            (0.14, 0.103), (0.22, 0.085), (0.29, 0.067), (0.35, 0.05),
            (0.4, 0.035), (0.44, 0.022), (0.475, 0.011), (H, 0.0)]

    def spine(h):
        k = max(0.0, h - 0.18) / (H - 0.18)
        return base + V(0.045 * k ** 2.5, -0.16 * k * k, h - 0.06 * k ** 3)

    def cone_r(h):
        for (h0, r0), (h1, r1) in zip(prof, prof[1:]):
            if h <= h1:
                q = clamp01((h - h0) / (h1 - h0))
                return lerp(r0, r1, q)
        return 0.0

    def surface(h, a):
        c = spine(h)
        r = cone_r(h)
        return c + V(math.cos(a) * r, math.sin(a) * r, 0)

    rings = [[surface(h, i / 20 * math.tau) for i in range(20)]
             for h, _ in prof[:-1]]
    pieces.append(fb.loft(f"{t}-cone", rings, TEAM, bands={1: GOLD, 2: GOLD},
                          start="flat", end=spine(H), levels=0))
    # Raised gold stars, a big one at the front.
    for i, (h, deg, r) in enumerate(((0.14, 90, 0.046), (0.27, 30, 0.03),
                                     (0.24, 150, 0.032), (0.13, 220, 0.036),
                                     (0.16, 325, 0.034))):
        pieces.append(star_on(f"{t}-star{i}", surface, h, math.radians(deg),
                              r))
    m = (Matrix.Translation(V(0, HEAD_C.y - 0.012, HAT_Z)) @
         Matrix.Rotation(HAT_TILT, 4, "X"))
    fb.transform(pieces, m)
    return pieces


def beard(t):
    """A long, crisp beard in three locks that rests on the chest."""
    keys = [(0.93, 0.106, 0.0, 0.13), (0.875, 0.116, 0.03, 0.166),
            (0.8, 0.106, 0.122, 0.21), (0.72, 0.09, 0.14, 0.226),
            (0.645, 0.064, 0.148, 0.218), (0.585, 0.034, 0.154, 0.198)]
    n = 16
    rings = []
    for j, (z, w, yb, yf) in enumerate(keys):
        pts = []
        curl = 0.02 * clamp01((0.72 - z) / 0.14) ** 2
        for i in range(n):
            a = i / n * math.tau
            s, c = math.sin(a), math.cos(a)
            x = w * c + curl
            if s >= 0:
                # Three locks: grooves between them on the front.
                lock = 0.016 * (math.cos(3 * (a - math.pi / 2)) - 0.3) * \
                    (w / 0.11)
                y = yb + (yf - yb) * (0.35 + 0.65 * s ** 0.7) + lock * s
            else:
                y = yb + (yf - yb) * 0.35 * (1 + s * 0.6)
            # The top grows from the cheeks and dips under the moustache.
            zz = z - (0.036 * max(0.0, s) ** 2 if j == 0 else 0.0)
            pts.append(V(x, y, zz))
        rings.append(pts)
    tip = V(0.03, 0.176, 0.548)
    return fb.loft(f"{t}-beard", rings, BEARD, start="flat", end=tip,
                   levels=0)


def hair(t):
    """White hair round the back and sides of the head under the brim, its
    lower edge in soft locks. At the front it tucks inside the face."""
    hc = HEAD_C
    rows = [(1.03, 0.09), (1.0, 0.116), (0.96, 0.126), (0.92, 0.122),
            (0.882, 0.104)]
    rings = []
    for j, (z, r) in enumerate(rows):
        pts = []
        for i in range(16):
            a = i / 16 * math.tau
            back = max(0.0, -math.sin(a))
            side = abs(math.cos(a)) * (1 if math.sin(a) < 0.2 else 0.0)
            rr = r * (0.72 + 0.28 * max(back ** 0.6, side * 0.75))
            zz = z
            if j == len(rows) - 1:
                zz += 0.016 * (i % 2) - 0.03 * back
            pts.append(V(math.cos(a) * rr, hc.y - 0.012 + math.sin(a) * rr,
                         zz))
        rings.append(pts)
    return fb.loft(f"{t}-hair", rings, BEARD, start="pole", end="pole",
                   levels=0)


def head(t):
    pieces = []
    hc = HEAD_C
    face = [(0.85, 0.05, 0.05), (0.875, 0.084, 0.086), (0.915, 0.1, 0.102),
            (0.96, 0.104, 0.106), (1.0, 0.098, 0.1), (1.04, 0.078, 0.08),
            (1.058, 0.04, 0.042)]
    rings = [fb.hring(z, rx, ry, 8, cy=hc.y, phase=math.pi / 8)
             for z, rx, ry in face[1:-1]]
    pieces.append(fb.loft(f"{t}-face", rings, SKIN, start="flat",
                          end="flat", levels=1))
    pieces.append(fb.tube(f"{t}-neck", [V(0, 0, 0.8), V(0, 0.01, 0.88)],
                          [0.052, 0.052], SKIN, n=10, levels=0,
                          caps=("pole", "pole")))
    # A big round nose, kind painted eyes and bushy brows.
    pieces.append(fb.cube_ball(f"{t}-nose", (0.052, 0.046, 0.05),
                               hc + V(0, 0.114, -0.01), NOSE, levels=2))
    for sx in (-1, 1):
        a = math.radians(sx * 23)
        at = hc + V(math.sin(a) * 0.1, math.cos(a) * 0.101, 0.024)
        pieces += fb.eye(f"{t}-eye{sx}", at, V(math.sin(a) * 0.8, 1, 0),
                         (0, 0, 1), 0.018, squash=1.1, iris_scale=0.64,
                         lid=(0.72, sx * 0.25))
        brow = [hc + V(sx * 0.014, 0.106, 0.054),
                hc + V(sx * 0.05, 0.1, 0.064),
                hc + V(sx * 0.09, 0.076, 0.05)]
        pieces.append(fb.tube(f"{t}-brow{sx}", brow, [0.013, 0.018, 0.009],
                              BEARD, n=6, levels=0, up=(0, 1, 0.4),
                              caps=("pole", "pole")))
        tash = [hc + V(sx * 0.008, 0.13, -0.042),
                hc + V(sx * 0.045, 0.128, -0.05),
                hc + V(sx * 0.078, 0.112, -0.074),
                hc + V(sx * 0.094, 0.1, -0.108)]
        pieces.append(fb.tube(f"{t}-moustache{sx}", fb_path(tash, 2),
                              [0.016, 0.019, 0.02, 0.017, 0.014, 0.01,
                               0.005], BEARD, n=6, levels=0, up=(0, 1, 0.3),
                              caps=("pole", "pole")))
    pieces.append(beard(t))
    pieces.append(hair(t))
    pieces += hat(t)
    return pieces


def fb_path(pts, samples):
    return [V(p) for p in kit.smooth_path(pts, samples)]


def sleeve(t, side, path, r0, r1):
    """A bell sleeve: widens to a gold cuff with a dark lining inside."""
    path = [V(p) for p in path]
    radii = [lerp(r0, r1, (i / (len(path) - 1)) ** 1.8)
             for i in range(len(path))]
    rings = fb.path_rings(path, radii, 12, up=(0, 0, 1))
    end = path[-1]
    tangent = (path[-1] - path[-2]).normalized()
    cuff_out = [end + (p - end) * 1.1 for p in rings[-1]]
    cuff_edge = [p + tangent * 0.022 for p in cuff_out]
    lip = [end + (p - end) * 0.86 + tangent * 0.022 for p in rings[-1]]
    inner = [end + (p - end) * 0.8 - tangent * 0.03 for p in rings[-1]]
    all_rings = rings + [cuff_out, cuff_edge, lip, inner]
    k = len(rings)
    bands = {k - 1: GOLD, k: GOLD, k + 1: GOLD, k + 2: TEAM2, "end": TEAM2}
    return fb.loft(f"{t}-sleeve{side}", all_rings, TEAM, bands=bands,
                   start="pole", end="flat", levels=0)


def staff_hand(t):
    """The right fist closed round the upright staff."""
    kn = V(0.25, 1, 0).normalized()
    x = kn.cross(V(0, 0, 1)).normalized()
    m = fb.basis(x, kn, V(0, 0, 1), HAND_R + kn * 0.004)
    block = fb.cube_ball(f"{t}-fistR", (0.07, 0.078, 0.088), (0, 0, 0),
                         SKIN, levels=2)
    fb.transform([block], m)
    thumb = fb.tube(f"{t}-thumbR", [HAND_R - x * 0.03 - kn * 0.012 +
                                    V(0, 0, 0.028),
                                    HAND_R - x * 0.037 + kn * 0.017 +
                                    V(0, 0, 0.038),
                                    HAND_R - x * 0.015 + kn * 0.037 +
                                    V(0, 0, 0.036)],
                    [0.02, 0.019, 0.017], SKIN, n=8, levels=0,
                    caps=("dome", "dome"))
    return [block, thumb]


def casting_hand(t):
    """An open mitten hand, palm up, fingers curling a little."""
    fwd = V(0.1, 1, 0.08).normalized()
    up = V(0, 0, 1)
    x = fwd.cross(up).normalized()
    up = x.cross(fwd)
    m = fb.basis(x, fwd, up, PALM)
    palm = fb.cube_ball(f"{t}-palm", (0.084, 0.104, 0.036), (0, 0.006, 0),
                        SKIN, levels=2)
    for v in palm.data.vertices:
        if v.co.y > 0.012:
            v.co.z += 16 * (v.co.y - 0.012) ** 2
    fb.transform([palm], m)
    thumb = fb.tube(f"{t}-thumbL", [PALM - x * 0.032 - fwd * 0.014,
                                    PALM - x * 0.05 + fwd * 0.012 +
                                    up * 0.014,
                                    PALM - x * 0.048 + fwd * 0.032 +
                                    up * 0.03],
                    [0.019, 0.017, 0.015], SKIN, n=8, levels=0,
                    caps=("dome", "dome"))
    return [palm, thumb]


def staff(t):
    """A turned staff with gold ferrules and a gold claw cradling the
    glowing orb."""
    x, y = STAFF_X, STAFF_Y
    pieces = [fb.tube(f"{t}-shaft", [V(x, y, 0.03), V(x, y, 0.5),
                                     V(x, y, 0.9), V(x, y, 1.27)],
                      [0.022, 0.024, 0.024, 0.026], WOOD, n=10, levels=0,
                      caps=("flat", "flat"))]
    for i, (z, h, r) in enumerate(((0.008, 0.05, 0.028), (0.44, 0.03, 0.031),
                                   (0.8, 0.03, 0.031), (1.2, 0.07, 0.034))):
        rings = [fb.hring(z + dz, rr, rr, 10, cx=x, cy=y)
                 for dz, rr in ((0, r - 0.004), (0.005, r), (h, r))]
        pieces.append(fb.loft(f"{t}-ferrule{i}", rings, GOLD, start="flat",
                              end="flat", levels=0))
    # Claw: four gold prongs rising round the orb.
    for k in range(4):
        a0 = k * math.tau / 4 + math.pi / 4
        pts = []
        for s, (r, dz) in enumerate(((0.028, -0.085), (0.056, -0.06),
                                     (0.074, -0.02), (0.07, 0.022),
                                     (0.046, 0.05))):
            a = a0 + s * 0.12
            pts.append(ORB_C + V(r * math.cos(a), r * math.sin(a), dz))
        pieces.append(fb.tube(f"{t}-prong{k}", pts,
                              [0.012, 0.012, 0.011, 0.009, 0.006], GOLD, n=6,
                              levels=0, caps=("pole", "pole")))
    pieces.append(fb.ball(f"{t}-orb", ORB_R, ORB_C, ORB, seg=14, rings=9))
    return pieces


def glow(t):
    """The flame dancing over the open palm: a bright core in a twisted
    teardrop of light."""
    prof = [(0.0, -0.04), (0.036, -0.028), (0.044, 0.0), (0.037, 0.034),
            (0.021, 0.08), (0.0, 0.116)]
    rings = []
    for r, z in prof[1:-1]:
        tw = (z + 0.04) * 6
        rings.append([GLOW + V(math.cos(a + tw) * r, math.sin(a + tw) * r, z)
                      for a in (i / 10 * math.tau for i in range(10))])
    flame = fb.loft(f"{t}-flame", rings, ORB, start=GLOW + V(0, 0, -0.04),
                    end=GLOW + V(0.008, 0, 0.116), levels=0)
    core = fb.ball(f"{t}-core", 0.024, GLOW + V(0, 0, -0.004), CORE, seg=8,
                   rings=6)
    return [flame, core]


def boot(t, sx):
    """A pointed wizard boot with an upturned toe."""
    ax = sx * HIP_X
    rings = []
    for yy, rz, rw, zc in ((-0.06, 0.042, 0.048, 0.062),
                           (0.0, 0.052, 0.056, 0.058),
                           (0.09, 0.042, 0.054, 0.044),
                           (0.165, 0.03, 0.042, 0.038),
                           (0.215, 0.018, 0.026, 0.046)):
        ring = []
        for x, z, _ in fb.sup(10, rw, rz, 2.4, math.pi / 10):
            ring.append(V(ax + sx * 0.012 * (yy + 0.06) + x, 0.1 + yy,
                          max(zc + z, 0.004)))
        rings.append(ring)
    tip = V(ax + sx * 0.02, 0.1 + 0.236, 0.07)
    return fb.loft(f"{t}-boot{'L' if sx < 0 else 'R'}", rings, BOOT,
                   start="flat", end=tip, levels=0)


def build(root_name="mage"):
    t = root_name
    root = kit.empty(t)

    for side, sx in (("L", -1), ("R", 1)):
        hip = V(sx * HIP_X, 0, HIP_Z)
        leg = fb.tube(f"{t}-leg{side}", [hip, V(sx * HIP_X, 0.06, 0.1)],
                      [0.05, 0.045], TEAM2, n=6, levels=0,
                      caps=("pole", "pole"))
        fb.part(t, f"leg{side}", [leg, boot(t, sx)], hip, root)

    torso = [robe(t), mantle(t)] + belt(t)
    torso_obj = fb.part(t, "torso", torso, WAIST, root)
    fb.part(t, "head", head(t), NECK, torso_obj)

    s_r = V(SH_X, 0, SH_Z)
    arm_r = [sleeve(t, "R", [s_r + V(-0.04, 0, -0.03), V(0.24, -0.03, 0.7),
                             V(0.27, 0.0, 0.62), V(0.285, 0.07, 0.61)],
                    0.058, 0.086)]
    arm_r += staff_hand(t)
    arm_r_obj = fb.part(t, "armR", arm_r, s_r, torso_obj)
    fb.part(t, "weapon", staff(t), HAND_R, arm_r_obj)

    s_l = V(-SH_X, 0, SH_Z)
    arm_l = [sleeve(t, "L", [s_l + V(0.04, 0, -0.03), V(-0.24, 0.0, 0.7),
                             V(-0.255, 0.1, 0.64), V(-0.245, 0.22, 0.645)],
                    0.058, 0.086)]
    arm_l += casting_hand(t)
    arm_l_obj = fb.part(t, "armL", arm_l, s_l, torso_obj)
    fb.part(t, "offhand", glow(t), GLOW, arm_l_obj)
    return root
