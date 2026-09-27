"""The Cowboy (figure id `ranger`) as a collector's miniature: a weathered
1880s frontier gunslinger in hand-painted resin.

A long sand-dun canvas duster hanging open (lapels, turn-down collar, horn
buttons, top-stitching, a flap pocket, a buttoned half-belt at the back),
its right front swept back behind the holster; a team-colour shirt and
neckerchief under a dark leather vest with a small gilt star; a brown felt
hat with a wide curled brim, a cattleman crease and a leather band; a
cartridge gun belt slung low, the revolver in a holster tied to the right
thigh; charcoal trousers tucked into brown boots with spurs; a lever-action
rifle with a brass receiver and a walnut stock held ready across the body,
muzzle down to the left, the right fist at the stock's wrist by the lever
and the left under the fore-end.

Parts (troops.py has the contract), none with a rest rotation:

  ranger          root at the feet, facing +y
    legL, legR    pivots on the hips; each carries its half of the duster's
                  skirt, split at the rear vent and hung outside from a seam
                  at the waist (legR also the holster and revolver)
    torso         pivot at the waist; the coat goes on under the skirt
                  halves (inset), so a swinging leg uncovers coat, never a gap
      head        pivot at the neck, the hat on it
      armL, armR  pivots on the shoulders, which share one line along x
        weapon    the rifle, child of armR, pivot in the right fist

The hold is built so that one turn of BOTH arms by the same angle about x
(about +1.3 rad) brings the butt to the right cheek with the barrel level
and the left fist still under the fore-end, as the Samurai's two-handed
katana does. The rifle then points about 37 degrees to the left of the
torso's forward, so the torso must turn right (about -0.55 rad about the
vertical) to aim it at the target: a right-handed shooter's bladed stance.

The game draws front faces only, so the open coat and skirt carry linings
behind their front edges. RANGER_POSE=<name> turns the parts as the game
would (three.js Euler terms, see figure_ranger_kit.runtime_quat) before the
previews: `attack` is the game's current 'rifle' attack at the brief's test
values; `squared`, `kick3`, `lever` and `half` the two-handed variant this
hold is built for; `walk`/`walk2` the current stride (arms swinging
opposite), `walk3`/`walk4` a two-handed stride.
"""

import math
import os

import kit
import figure_ranger_kit as rk
from figure_ranger_kit import V, gauss, lerp, smooth, spow, table
from mathutils import Matrix, Vector

R = "ranger"
T = kit.tint

# ------------------------------------------------------------- paints
# Ten pots, one draw batch each at runtime; several things share a pot.

SKIN = "resin:" + T("cowboy-skin", "#b07b5a")
FELT = "weave:" + T("cowboy-felt", "#5b4535")        # the hat
DARK = "hide:" + T("cowboy-vest", "#3a281c")          # vest, hair, brows,
                                                     # eyes, soles, hat band
LEATHER = "hide:" + T("cowboy-leather", "#7b4e2c")   # boots, belt, holster
DUSTER = "weave:" + T("cowboy-duster", "#b09a72")
TEAM = "weave:team"                                  # shirt, neckerchief
CHAR = "weave:" + T("cowboy-trousers", "#3c3d42")    # trousers, stubble
BRASS = "gilt:" + T("cowboy-brass", "#c49c50")
STEEL = "gilt:" + T("cowboy-steel", "#50555d")
WALNUT = "wood:" + T("cowboy-walnut", "#6a3c21")

VEST = DARK
HAIR = DARK
STUBBLE = LEATHER

# ------------------------------------------------------------- joints

HIP_X, HIP_Z = 0.085, 0.63
WAIST = V(0, 0, 0.68)
SH_X, SH_Y, SH_Z = 0.172, 0.0, 0.985
S_L = V(-SH_X, SH_Y, SH_Z)
S_R = V(SH_X, SH_Y, SH_Z)
NECK = V(0, 0.0, 1.04)
UPPER, FORE = 0.25, 0.225
WRIST_FIST = 0.04

# The head is sculpted in the tower guard's head space and lifted onto
# this neck.
HEAD_DZ = 0.006
HC = V(0, 0.012, 1.162)          # skull centre (head space)
CY = 0.012

# ------------------------------------------------------------- the rifle hold
# The rifle's own frame: x its right side, y toward the muzzle, z its top;
# the origin is the stock's wrist in the right fist. At rest it points down
# and across to the left, top forward.

D_REST = V(-0.6, 0.18, -0.78).normalized()
_fwd = V(0, 1, 0)
_top = (_fwd - D_REST * _fwd.dot(D_REST)).normalized()
# Rolled a little so the butt's toe clears the coat and the top of the
# rifle faces up and out.
ROLL = math.radians(-22)
TOP_REST = (_top * math.cos(ROLL) + D_REST.cross(_top) * math.sin(ROLL))
X_REST = D_REST.cross(TOP_REST)
GRIP = V(0.046, 0.214, 0.805)
LEFT_S = 0.2                     # the left fist along the rifle
LEFT_Z = 0.015                   # and up from the wrist line


def rifle_frame():
    return rk.basis(X_REST, D_REST, TOP_REST, GRIP)


def rifle_point(x, y, z):
    return GRIP + X_REST * x + D_REST * y + TOP_REST * z


# ------------------------------------------------------------- body shapes

# (z, half width, front depth, back depth) of the shirt under everything.
BODY = [(0.575, 0.126, 0.097, 0.1), (0.64, 0.13, 0.1, 0.098),
        (0.70, 0.136, 0.104, 0.098), (0.78, 0.148, 0.112, 0.1),
        (0.86, 0.157, 0.118, 0.103), (0.92, 0.161, 0.12, 0.105),
        (0.965, 0.154, 0.106, 0.099), (1.0, 0.108, 0.078, 0.074),
        (1.035, 0.056, 0.052, 0.052)]
BODY_P = 2.3


def section(rows, z):
    return table([(r[0], r[1], r[2], r[3]) for r in rows], z)


def ring_point(rows, power, a, z, extra=0.0):
    """A point on a superellipse section at angle a (0 = front, toward +x
    at 90 degrees) and height z."""
    rx_, ryf, ryb = section(rows, z)
    e = 2.0 / power
    s, c = math.sin(a), math.cos(a)
    x = (rx_ + extra) * spow(s, e)
    y = ((ryf if c >= 0 else ryb) + extra) * spow(c, e)
    return V(x, y, z)


def body_point(a, z, extra=0.0):
    return ring_point(BODY, BODY_P, a, z, extra)


# The duster: loose over the chest, hanging straight past the waist and
# flaring toward the hem; the skirt below the hips rides on the legs.
COAT = [(0.24, 0.248, 0.176, 0.205), (0.3, 0.24, 0.172, 0.196),
        (0.36, 0.232, 0.168, 0.186), (0.42, 0.224, 0.164, 0.176),
        (0.48, 0.214, 0.158, 0.166), (0.56, 0.2, 0.15, 0.152),
        (0.64, 0.19, 0.143, 0.141), (0.72, 0.184, 0.14, 0.133),
        (0.8, 0.186, 0.142, 0.131), (0.88, 0.19, 0.143, 0.131),
        (0.94, 0.203, 0.138, 0.129), (0.98, 0.218, 0.125, 0.121),
        (1.006, 0.188, 0.105, 0.105), (1.021, 0.128, 0.087, 0.091),
        (1.032, 0.084, 0.07, 0.08)]
COAT_P = 2.2
# The skirt halves hang outside from a seam at the waist; the torso's coat
# carries on under them (inset) so a swinging leg shows coat, not a gap.
SEAM = 0.635
UNDER_BOTTOM = 0.47
UNDER_INSET = 0.009
HEM = 0.255


def coat_fold(a, z):
    """Soft pipe folds, growing toward the hem and strongest at the back."""
    back = 0.35 + 0.65 * max(0.0, -math.cos(a)) ** 0.7
    hang = smooth(0.95, 0.6, z) * 0.0065 + smooth(0.56, HEM, z) * 0.016
    w = math.sin(7 * a + 0.6 + 2.2 * z)
    ridge = (abs(w) ** 0.6) * math.copysign(1, w) * 0.55 + 0.45 * w
    fold = hang * back * (ridge + 0.3 * math.sin(12 * a + 1.3))
    return fold


def coat_point(a, z, extra=0.0):
    p = ring_point(COAT, COAT_P, a, z, extra + coat_fold(a, z))
    # The yoke across the shoulders stands a hair proud of the back.
    if math.cos(a) < -0.2:
        p += V(math.sin(a), math.cos(a), 0) * 0.0028 * smooth(0.884, 0.892, z)
    return p


# The coat's front edges (degrees from the front), right and left.
EDGE_R = [(HEM, 112), (0.42, 116), (0.5, 118), (0.56, 114), (0.6, 108),
          (SEAM, 90), (0.66, 62), (0.72, 38), (0.8, 30), (0.86, 29), (0.94, 31),
          (0.98, 36), (1.03, 41)]
EDGE_L = [(HEM, 36), (0.42, 35), (0.5, 34), (0.6, 31), (0.7, 29),
          (0.8, 28), (0.9, 29), (0.94, 31), (0.98, 36), (1.03, 41)]

# ------------------------------------------------------------- legs


def boot(sx, ankle, knee, toe_out):
    """A riding boot: a pointed toe, an underslung heel, a scalloped top
    with pull tabs, and a spur on a strap over the instep."""
    pieces = []
    # The foot in its own frame (toe along +y), then placed.
    foot = [(-0.064, 0.024, 0.036, 0.062), (-0.055, 0.036, 0.03, 0.084),
            (-0.03, 0.042, 0.03, 0.09), (0.01, 0.044, 0.024, 0.078),
            (0.05, 0.043, 0.018, 0.064), (0.09, 0.037, 0.016, 0.052),
            (0.122, 0.026, 0.017, 0.042), (0.145, 0.013, 0.02, 0.034)]
    rings = []
    for y, rx_, zb, zt in foot:
        ring = []
        for x, z, _ in rk.sup(10, rx_, (zt - zb) / 2, 2.4, math.pi / 10):
            ring.append(V(x, y, (zb + zt) / 2 + z))
        rings.append(ring)
    # The sole (the bottom of every ring) in the dark leather.
    pieces.append(rk.loft(f"{R}-foot{sx}", rings, LEATHER,
                          bands=lambda i, j: DARK if i in (6, 7) else None,
                          start=V(0, -0.069, 0.05), end=V(0, 0.152, 0.029)))
    # The heel block.
    heel = []
    for z, s in ((0.0, 0.8), (0.018, 0.92), (0.03, 1.0)):
        heel.append([V(x * s, -0.045 + y * s, z) for x, y, _ in
                     rk.sup(8, 0.031, 0.026, 2.6)])
    pieces.append(rk.loft(f"{R}-heel{sx}", heel, DARK, start="flat",
                          end="flat"))
    # The spur: a strap over the instep, a shank and a star rowel.
    strap = []
    for k in range(9):
        t = k / 8 * math.pi
        strap.append(V(math.cos(t) * 0.047, -0.03 + math.sin(t) * 0.012,
                       0.03 + math.sin(t) * 0.063))
    pieces.append(rk.tube(f"{R}-sstrap{sx}", strap, [(0.004, 0.0075)] * 9,
                          DARK, n=4, up=(0, 1, 0), caps=(None, None)))
    pieces.append(rk.tube(f"{R}-spurband{sx}",
                          [V(-0.04, -0.035, 0.034), V(0, -0.074, 0.04),
                           V(0.04, -0.035, 0.034)],
                          [0.004, 0.0045, 0.004], STEEL, n=4,
                          caps=("dome", "dome")))
    pieces.append(rk.tube(f"{R}-shank{sx}", [V(0, -0.072, 0.04),
                                            V(0, -0.098, 0.036)],
                          [0.0035, 0.003], STEEL, n=4, caps=(None, None)))
    star = []
    for i in range(16):
        a = i / 16 * math.tau
        r = 0.018 if i % 2 == 0 else 0.0075
        star.append((math.cos(a) * r, math.sin(a) * r))
    m = rk.basis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0),
                 V(-0.002, -0.106, 0.036))
    pieces.append(rk.slab(f"{R}-rowel{sx}", star, 0.004, STEEL, matrix=m))
    place = Matrix.Translation(V(ankle.x, ankle.y, 0)) @ \
        Matrix.Rotation(math.radians(-sx * toe_out), 4, "Z")
    rk.transform(pieces, place)

    # The shaft follows the shin; the top is scalloped, higher at the
    # front and back, with a pull tab on each side.
    def on_leg(z):
        t = (z - ankle.z) / (knee.z - ankle.z)
        c = lerp(ankle, knee, t)
        return V(c.x, c.y, z)

    n = 14
    shaft = []
    for z, r in ((0.045, 0.041), (0.1, 0.044), (0.16, 0.049), (0.22, 0.054),
                 (0.27, 0.058), (0.3, 0.061)):
        c = on_leg(z)
        ring = []
        for i in range(n):
            a = i / n * math.tau
            top = z >= 0.3
            zz = z + (0.022 * math.cos(a) ** 2 if top else 0.0)
            ring.append(V(c.x + math.sin(a) * r, c.y + math.cos(a) * r * 1.04,
                          zz))
        shaft.append(ring)
    pieces.append(rk.loft(f"{R}-shaft{sx}", shaft, LEATHER))
    # A stitched welt round the top and the pull tabs.
    top = [on_leg(0.3) + V(math.sin(i / n * math.tau) * 0.0615,
                           math.cos(i / n * math.tau) * 0.064,
                           0.022 * math.cos(i / n * math.tau) ** 2 - 0.004)
           for i in range(n)]
    pieces.append(rk.tube(f"{R}-bootrim{sx}", top + [top[0]], [0.0036] * (n + 1),
                          DARK, n=4, caps=(None, None)))
    for side in (-1, 1):
        c = on_leg(0.3) + V(side * 0.058, 0, 0)
        tab = [c + V(side * 0.001, 0.0, -0.01), c + V(side * 0.004, 0, 0.018)]
        pieces.append(rk.tube(f"{R}-tab{sx}{side}", tab,
                              [(0.0035, 0.009), (0.003, 0.008)], LEATHER,
                              n=4, up=(1, 0, 0), caps=("flat", "dome")))
    return pieces


def trouser_leg(sx, hip, knee, ankle):
    """Charcoal trousers from the hip ball, tucked into the boot."""
    below = lerp(knee, ankle, 0.1)
    inside = lerp(knee, ankle, 0.22)
    path = [hip + V(0, 0, 0.035), lerp(hip, knee, 0.33), lerp(hip, knee, 0.7),
            knee, V(below.x, below.y, 0.325), V(inside.x, inside.y, 0.285)]
    radii = [0.07, 0.066, 0.056, 0.05, 0.054, 0.053]
    limb = rk.tube(f"{R}-trouser{sx}", path, radii, CHAR, n=12, up=(0, 1, 0),
                   caps=(None, None))
    kneecap = rk.ball(f"{R}-knee{sx}", 0.03, knee + V(0, 0.026, 0.004), CHAR,
                      scale=(1.2, 0.75, 1.3), seg=8, rings=5)
    return [limb, kneecap]


def skirt(sx):
    """This leg's half of the duster's skirt: from the waist seam, where
    it laps over the torso's coat, down to the hem; the right one swept
    back behind the holster, the two overlapping at the rear vent."""
    if sx > 0:
        a1 = 186.0
        edge = EDGE_R
    else:
        a1 = -186.0
        edge = EDGE_L
    zs = [SEAM, 0.61, 0.56, 0.5, 0.46, 0.43, 0.38, 0.33, 0.29, HEM]
    us = [i / 14 for i in range(15)] if sx < 0 else [i / 10 for i in
                                                      range(11)]
    lift = 0.0045 + (0.003 if sx > 0 else 0.0)

    def fn(u, v, inset=0.0):
        z = zs[int(round(v))]
        a0 = table(edge, z) * (1 if sx > 0 else -1)
        a = math.radians(lerp(a0, a1, u))
        # The hem dips a little at the back and rises at the front edge.
        dz = 0.0
        if z <= HEM + 1e-6:
            dz = -0.012 * max(0.0, -math.cos(a)) + 0.02 * (1 - smooth(0, 0.25, u))
        return coat_point(a, z, lift - inset) + V(0, 0, dz)

    vs = list(range(len(zs)))
    out = [rk.sheet(f"{R}-skirt{sx}", fn, us, vs, DUSTER, rim=0.006,
                    inside=V(sx * 0.06, 0, 0.45))]
    # The lining behind the front edge, where the game (which draws front
    # faces only) would otherwise show through the open coat.
    far = fn(0.1, 4) * 3.0
    far.z = 0.45
    out.append(rk.sheet(f"{R}-skirtlining{sx}", lambda u, v: fn(u, v, 0.0058),
                        [0.0, 0.1, 0.2, 0.3], vs, DUSTER, inside=far))
    pts = []
    for k in range(8):
        z = lerp(SEAM - 0.006, HEM + 0.01, k / 7)
        a0 = table(edge, z) * (1 if sx > 0 else -1)
        a = math.radians(a0 + 3.2 * (1 if sx > 0 else -1))
        pts.append(coat_point(a, z, lift + 0.0012))
    out.append(rk.tube(f"{R}-sstitch{sx}", pts, [0.0012] * 8, DUSTER, n=3,
                       caps=(None, None)))
    if sx < 0:
        # A flap pocket on the left hip.
        def flap(u, v):
            a = math.radians(-lerp(50, 78, u))
            z = lerp(0.585, 0.555, v) - 0.004 * math.sin(math.pi * u) * v
            return coat_point(a, z, lift + 0.006 + 0.002 * v)

        out.append(rk.sheet(f"{R}-pocket", flap, [0, 0.5, 1], [0, 0.5, 1],
                            DUSTER, rim=0.004, inside=V(0, 0, 0.56),
                            rim_edges=("u0", "u1", "v1")))
    return out


def holster():
    """A tied-down holster on the right thigh with the revolver's walnut
    grip, hammer and cylinder above it, hung from a loop off the belt."""
    pieces = []
    top = V(0.171, 0.046, 0.572)
    bot = V(0.177, 0.012, 0.395)
    ax = (top - bot).normalized()
    path = [bot, lerp(bot, top, 0.35), lerp(bot, top, 0.75), top]
    pieces.append(rk.tube(f"{R}-holster", path,
                          [(0.012, 0.018), (0.014, 0.022), (0.016, 0.027),
                           (0.017, 0.03)], LEATHER, n=8, up=(1, 0, 0),
                          caps=("dome", None)))
    # The mouth's welt and a leather loop band across the holster.
    for k, t in enumerate((0.97, 0.62)):
        c = lerp(bot, top, t)
        r = (0.0185, 0.031) if k == 0 else (0.0175, 0.029)
        pieces.append(rk.tube(f"{R}-hloop{k}", [c - ax * 0.008, c + ax * 0.008],
                              [r, r], DARK if k == 0 else LEATHER, n=8,
                              up=(1, 0, 0), caps=(None, None)))
    # The revolver, barrel down in the holster: the cylinder at the
    # mouth, the hammer spur at the top (the gun's top faces forward) and
    # the walnut bird's-head grip curving back.
    fwd = V(0, 1, 0) - ax * ax.y
    fwd.normalize()
    side = ax.cross(fwd)
    cyl = top + ax * 0.008
    pieces.append(rk.tube(f"{R}-rcyl", [cyl - ax * 0.012, cyl + ax * 0.013],
                          [0.0138, 0.0138], STEEL, n=8, caps=("flat", "flat")))
    # The frame behind the cylinder, with the recoil shield.
    pieces.append(rk.rbox(f"{R}-rframe", (0.018, 0.03, 0.012), V(0, 0, 0),
                          STEEL, levels=1, crease=0.7,
                          matrix=rk.basis(side, fwd, ax,
                                          cyl + ax * 0.018 - fwd * 0.004)))
    hammer = [cyl + ax * 0.02 + fwd * 0.004, cyl + ax * 0.031 + fwd * 0.002,
              cyl + ax * 0.037 - fwd * 0.006]
    pieces.append(rk.tube(f"{R}-rhammer", hammer,
                          [(0.003, 0.004), (0.003, 0.004), (0.004, 0.005)],
                          STEEL, n=4, up=side, caps=(None, "dome")))
    grip = [cyl + ax * 0.016 - fwd * 0.012, cyl + ax * 0.026 - fwd * 0.03,
            cyl + ax * 0.03 - fwd * 0.048, cyl + ax * 0.026 - fwd * 0.058]
    pieces.append(rk.tube(f"{R}-rgrip", grip,
                          [(0.0085, 0.012), (0.0092, 0.012), (0.0098, 0.0125),
                           (0.0092, 0.011)], WALNUT, n=8, up=side,
                          caps=(None, "dome")))
    # The grip's brass butt cap and the trigger guard's loop.
    pieces.append(rk.ball(f"{R}-rcap", 0.0075, grip[-1] - fwd * 0.004 -
                          ax * 0.002, BRASS, seg=6, rings=4))
    guard = [cyl + ax * 0.012 - fwd * 0.012, cyl + ax * 0.0 - fwd * 0.022,
             cyl - ax * 0.008 - fwd * 0.018]
    pieces.append(rk.tube(f"{R}-rguard", guard, [0.0026] * 3, BRASS, n=4,
                          caps=("dome", "dome")))
    # The loop from the belt and the tie-down thong round the thigh.
    pieces.append(rk.tube(f"{R}-hdrop", [V(0.166, 0.018, 0.59),
                                        V(0.174, 0.028, 0.555)],
                          [(0.004, 0.02), (0.004, 0.022)], DARK, n=4,
                          up=(1, 0, 0), caps=(None, None)))
    thong = []
    kc = V(HIP_X + 0.004, 0.012, 0.44)
    for i in range(11):
        a = math.radians(90 - 150 + i * 30)
        thong.append(kc + V(math.sin(a) * 0.069, math.cos(a) * 0.066,
                            0.006 * math.cos(a)))
    pieces.append(rk.tube(f"{R}-thong", thong, [0.0028] * 11, DARK, n=3,
                          caps=("dome", "dome")))
    return pieces


def leg(side, sx, knee, ankle, toe_out):
    hip = V(sx * HIP_X, 0, HIP_Z)
    pieces = trouser_leg(sx, hip, knee, ankle)
    pieces += boot(sx, ankle, knee, toe_out)
    pieces += skirt(sx)
    if sx > 0:
        pieces += holster()
    return pieces, hip


# ------------------------------------------------------------- torso


def shirt():
    n = 20
    c = rk.Mesh(f"{R}-shirt", TEAM)
    rows = []
    for z, _, _, _ in BODY:
        row = []
        for i in range(n):
            a = i / n * math.tau
            p = body_point(a, z)
            # The placket down the front.
            p.y += 0.003 * gauss(math.degrees(a) if a < math.pi else
                                 math.degrees(a) - 360, 0, 5)
            row.append(c.v(p))
        rows.append(row)
    c.grid(rows, TEAM, closed=True)
    c.fan(rows[-1], V(0, 0, 1.05), TEAM)
    c.fan(rows[0], V(0, 0, 0.56), TEAM, flip=True)
    return c.obj(recalc=True)


def hips():
    """The trousers' seat and waistband under the gun belt."""
    rings = []
    for z, rx_, ry_ in ((0.52, 0.07, 0.06), (0.56, 0.118, 0.092),
                        (0.6, 0.131, 0.101), (0.65, 0.134, 0.104),
                        (0.662, 0.13, 0.1)):
        rings.append([V(x, y, z) for x, y, _ in rk.sup(18, rx_, ry_, 2.3)])
    return rk.loft(f"{R}-hips", rings, CHAR, start="pole", end=None)


def vest_fn(side):
    """A vest front: u from its front edge (0) round to under the arm (1),
    v from the hem (0) to the shoulder (1). The fronts meet below a deep V
    and end in points."""
    lap = -1.6 if side > 0 else 1.0

    def edge(z):
        if z < 0.845:
            return lap
        return lerp(lap, 44.0, smooth(0.845, 1.0, z) ** 0.8)

    def fn(u, v):
        hem = lerp(0.622, 0.656, smooth(0.0, 0.35, u))
        z = lerp(hem, 0.99, v)
        a = math.radians(lerp(edge(z), 128.0, u))
        extra = 0.006 + 0.0015 * math.sin(math.pi * v) + \
            (0.0012 if side > 0 else 0.0)
        p = body_point(a, z, extra)
        return V(side * p.x, p.y, p.z)
    return fn


def vest():
    pieces = []
    us = [0.0, 0.06, 0.16, 0.3, 0.46, 0.64, 0.82, 1.0]
    vs = [0.0, 0.1, 0.25, 0.42, 0.58, 0.72, 0.84, 0.93, 1.0]
    for side in (1, -1):
        fn = vest_fn(side)
        pieces.append(rk.sheet(f"{R}-vest{side}", fn, us, vs, VEST, rim=0.004,
                               inside=V(0, 0, 0.8),
                               rim_edges=("u0", "v0")))
        # Welt pockets and the edge stitching.
        pts = [(0.3, 0.3), (0.5, 0.33)]
        pa = fn(0.28, 0.33) + V(0, 0, 0)
        pb = fn(0.5, 0.36)
        n = (pb - pa).cross(V(0, 0, 1)).normalized()
        if n.dot(pa - V(0, 0, pa.z)) < 0:
            n = -n
        pieces.append(rk.tube(f"{R}-welt{side}", [pa + n * 0.001,
                                                 pb + n * 0.001],
                              [(0.0022, 0.005)] * 2, VEST, n=4, up=(0, 0, 1),
                              caps=("flat", "flat")))
    # Brass buttons down the closed front.
    for k, z in enumerate((0.8, 0.745, 0.69)):
        p = body_point(math.radians(-0.5), z, 0.0115)
        pieces.append(rk.ball(f"{R}-button{k}", 0.0055, p, BRASS,
                              scale=(1, 0.55, 1), seg=6, rings=3))
    # The small gilt star on the left breast.
    fn = vest_fn(-1)
    c = fn(0.3, 0.7)
    nrm = (fn(0.34, 0.7) - fn(0.26, 0.7)).cross(fn(0.3, 0.74) -
                                                fn(0.3, 0.66)).normalized()
    if nrm.y < 0:
        nrm = -nrm
    star = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = 0.02 if i % 2 == 0 else 0.0085
        star.append((math.cos(a) * r, math.sin(a) * r))
    m = rk.look(nrm, (0, 0, 1), c + nrm * 0.001)
    pieces.append(rk.slab(f"{R}-star", star, 0.0035, BRASS, matrix=m))
    return pieces


def kerchief():
    """The neckerchief: bunched round the neck, knotted at the front
    right, its point hanging over the chest."""
    pieces = []
    n = 18
    rings = []
    for z, r, amp in ((0.975, 0.066, 0.0), (0.99, 0.07, 0.004),
                      (1.008, 0.066, 0.005), (1.024, 0.06, 0.003),
                      (1.034, 0.054, 0.0)):
        ring = []
        for i in range(n):
            a = i / n * math.tau
            k = 1 + amp / r * math.sin(5 * a + z * 60)
            ring.append(V(math.sin(a) * r * k * 1.02,
                          -0.003 + math.cos(a) * r * k, z))
        rings.append(ring)
    pieces.append(rk.loft(f"{R}-kerchief", rings, TEAM))
    # The triangle hanging in front, with two soft folds.

    def tri(u, v):
        w = lerp(0.052, 0.003, v ** 0.85)
        x = u * w
        z = lerp(0.99, 0.912, v)
        y = body_point(0.0, max(0.9, z), 0.0).y + 0.016 + 0.01 * (1 - v) \
            - 0.02 * (u * u) * (1 - v)
        y += 0.004 * math.sin(u * 5.0 + 1.0) * math.sin(math.pi * v)
        y += 0.006 * (1 - abs(u)) * math.sin(math.pi * min(1.0, v * 1.3))
        return V(x + 0.004, y, z - 0.006 * u * u)

    pieces.append(rk.sheet(f"{R}-kpoint", tri, [-1, -0.6, -0.2, 0.2, 0.6, 1],
                           [0.0, 0.3, 0.6, 0.85, 1.0], TEAM, rim=0.004,
                           inside=V(0, 0, 0.95)))
    # The knot, front right, and two short ends.
    k = V(0.036, 0.072, 0.992)
    pieces.append(rk.ball(f"{R}-knot", 0.014, k, TEAM, scale=(1.15, 0.8, 0.9),
                          seg=8, rings=5))
    for j, (dx, dz) in enumerate(((0.012, -0.03), (0.024, -0.022))):
        pieces.append(rk.tube(f"{R}-kend{j}", [k, k + V(dx, 0.01, dz)],
                              [(0.004, 0.011), (0.003, 0.007)], TEAM, n=5,
                              up=(0, 1, 0), caps=(None, "dome")))
    return pieces


def coat_upper():
    """The duster from the collar down to the waist seam, open at the
    front, with folds and a yoke across the back; below the seam it goes
    on, inset and hidden, under the skirt halves on the legs."""
    zs = [UNDER_BOTTOM, 0.51, 0.56, 0.6, 0.618, SEAM, 0.68, 0.74, 0.8, 0.86,
          0.884, 0.892, 0.93, 0.96, 0.98, 1.0, 1.016, 1.032]
    us = [i / 30 for i in range(31)]

    def under(z):
        return smooth(SEAM, SEAM - 0.017, z)

    def fn(u, v):
        z = zs[int(round(v))]
        a0 = table(EDGE_R, z) + 5 * under(z)
        a1 = 360 - table(EDGE_L, z) - 5 * under(z)
        a = math.radians(lerp(a0, a1, u))
        return coat_point(a, z, -UNDER_INSET * under(z))

    obj = rk.sheet(f"{R}-coat", fn, us, list(range(len(zs))), DUSTER,
                   rim=0.006, inside=V(0, 0, 0.75),
                   rim_edges=("u0", "u1", "v0"))
    pieces = [obj]

    # Linings behind the front edges (the game draws front faces only, so
    # the coat's inside would show through the open front).
    lz = [z for z in zs if z >= SEAM]

    def lin(u, v):
        z = lz[int(round(v))]
        a = math.radians(lerp(table(EDGE_R, z), 360 - table(EDGE_L, z), u))
        return coat_point(a, z, -0.0058)

    for k, (u0, u1) in enumerate(((0.0, 0.14), (0.86, 1.0))):
        far = fn((u0 + u1) / 2, 9) * 3.0
        far.z = 0.75
        pieces.append(rk.sheet(f"{R}-lining{k}", lin,
                               [lerp(u0, u1, i / 4) for i in range(5)],
                               list(range(len(lz))), DUSTER, inside=far))

    # Lapels: the front edges folded back over the chest.
    for side, edge in ((1, EDGE_R), (-1, EDGE_L)):
        def lap(u, v, side=side, edge=edge):
            z = lerp(0.79, 0.985, v)
            a0 = table(edge, z)
            w = 13.0 * smooth(0.79, 0.975, z) ** 1.3
            a = math.radians(a0 + u * w + 0.3)
            p = coat_point(a, z, 0.0055 + 0.002 * u)
            return V(side * p.x, p.y, p.z)
        pieces.append(rk.sheet(f"{R}-lapel{side}", lap, [0, 0.5, 1],
                               [0, 0.3, 0.55, 0.8, 1.0], DUSTER, rim=0.004,
                               inside=V(0, 0, 0.85), rim_edges=("u1", "v1")))
    # The turn-down collar round the back of the neck.
    def col(u, v):
        a = math.radians(lerp(40, 320, u))
        s, c = math.sin(a), math.cos(a)
        r_in = V(0.074 * s, -0.004 + 0.07 * c, 1.046)
        front = max(0.0, c)
        r_out = V(0.126 * s, -0.004 + 0.118 * c, 0.998 - 0.03 * front ** 2)
        mid = lerp(r_in, r_out, 0.5) + V(0, 0, 0.012)
        if v <= 0.5:
            return lerp(r_in, mid, v * 2)
        return lerp(mid, r_out, (v - 0.5) * 2)

    pieces.append(rk.sheet(f"{R}-collar", col, [i / 16 for i in range(17)],
                           [0.0, 0.5, 1.0], DUSTER, rim=0.005,
                           inside=V(0, 0, 0.9), rim_edges=("u0", "u1", "v1")))
    # Top-stitching a finger's width in from each front edge.
    for side, edge in ((1, EDGE_R), (-1, EDGE_L)):
        pts = []
        for k in range(9):
            z = lerp(SEAM + 0.004, 0.79, k / 8)
            a = math.radians(table(edge, z) + 3.2)
            p = coat_point(a, z, 0.0012)
            pts.append(V(side * p.x, p.y, p.z))
        pieces.append(rk.tube(f"{R}-stitch{side}", pts, [0.0012] * 9, DUSTER,
                              n=3, caps=(None, None)))
    # Horn buttons down the left front edge (the coat hangs open).
    for k, z in enumerate((0.925, 0.845, 0.765, 0.685)):
        a = -math.radians(table(EDGE_L, z) + 5.5)
        pieces.append(rk.ball(f"{R}-cbutton{k}", 0.0072,
                              coat_point(a, z, 0.0045), DARK,
                              scale=(1, 1, 0.9), seg=6, rings=3))
    # A half-belt across the small of the back, buttoned at each end.
    def hb(u, v):
        a = math.radians(lerp(146, 214, u))
        z = lerp(SEAM - 0.012, SEAM + 0.022, v)
        return coat_point(a, z, 0.0085)

    pieces.append(rk.sheet(f"{R}-halfbelt", hb, [i / 8 for i in range(9)],
                           [0, 1], DUSTER, rim=0.005, inside=V(0, 0, 0.66)))
    for k, a in enumerate((151, 209)):
        p = coat_point(math.radians(a), SEAM + 0.005, 0.012)
        pieces.append(rk.ball(f"{R}-hbutton{k}", 0.0065, p, DARK,
                              scale=(1, 1, 1), seg=6, rings=3))
    return pieces


def gun_belt():
    """The cartridge belt slung low on the hips, lower on the holster side,
    with a brass buckle and a row of brass cartridges in their loops."""
    pieces = []
    n = 28

    def centre_z(a):
        return 0.592 - 0.028 * smooth(-0.2, 1.0, math.sin(a))

    def belt_pt(a, dz, off):
        z = centre_z(a) + dz
        base = V(0.134 * spow(math.sin(a), 0.87), 0.103 *
                 spow(math.cos(a), 0.87), z)
        out = V(math.sin(a), math.cos(a), 0)
        return base + out * off

    rings = []
    for dz, off in ((-0.022, 0.006), (-0.02, 0.013), (0.02, 0.013),
                    (0.022, 0.006)):
        rings.append([belt_pt(i / n * math.tau, dz, off) for i in range(n)])
    pieces.append(rk.loft(f"{R}-gunbelt", rings, LEATHER, closed=True))
    # Cartridges across the front and the right hip, where the open coat
    # (swept back behind the holster) shows them.
    for k in range(19):
        a = math.radians(-46 + k * 6.4)
        if -13 < math.degrees(a) < 12:
            continue
        b = belt_pt(a, -0.004, 0.0165)
        t = belt_pt(a, 0.021, 0.0165)
        up = (t - b).normalized()
        pieces.append(rk.tube(f"{R}-round{k}", [b, t], [0.0047, 0.0047],
                              BRASS, n=5, caps=("flat", t + up * 0.0045)))
    # The loops holding them: one band across the belt's middle.
    band = []
    for dz, off in ((-0.006, 0.0195), (0.009, 0.0205)):
        band.append([belt_pt(math.radians(-48 + i * 5.3), dz, off)
                     for i in range(24)])
    pieces.append(rk.loft(f"{R}-loops", band, LEATHER, closed=False))
    # The buckle.
    a = math.radians(-2)
    c = belt_pt(a, 0.0, 0.016)
    frame = [c + V(x, 0.004, z) for x, z, _ in rk.sup(12, 0.022, 0.024, 3.4)]
    pieces.append(rk.tube(f"{R}-buckle", frame + [frame[0]], [0.0035] * 13,
                          BRASS, n=4, up=(0, 1, 0), caps=(None, None)))
    pieces.append(rk.tube(f"{R}-tongue", [c + V(-0.03, 0.002, 0.0),
                                         c + V(-0.055, 0.0, -0.002)],
                          [(0.004, 0.018)] * 2, LEATHER, n=4, up=(0, 1, 0),
                          caps=("flat", "flat")))
    return pieces


# ------------------------------------------------------------- head
# The face follows the tower guard's sculpt (figure_guard.py), with a
# squarer, stubbled jaw, narrowed eyes and a full skull under the hat.

FACE_W = [(1.0, 0.03), (1.025, 0.041), (1.045, 0.051), (1.062, 0.0575),
          (1.076, 0.0615), (1.095, 0.064), (1.12, 0.0665), (1.145, 0.07),
          (1.17, 0.072), (1.2, 0.073), (1.225, 0.07), (1.245, 0.062),
          (1.26, 0.046), (1.268, 0.02)]
FACE_D = [(1.0, 0.03), (1.025, 0.04), (1.045, 0.055), (1.062, 0.067),
          (1.074, 0.072), (1.09, 0.074), (1.12, 0.077), (1.15, 0.074),
          (1.172, 0.081), (1.2, 0.082), (1.225, 0.076), (1.245, 0.066),
          (1.26, 0.048), (1.268, 0.02)]
BACK_D = [(1.0, 0.036), (1.04, 0.052), (1.07, 0.074), (1.1, 0.09),
          (1.14, 0.1), (1.18, 0.104), (1.21, 0.1), (1.235, 0.088),
          (1.255, 0.066), (1.268, 0.03)]
FACE_P = 2.5
NOSE_H = [(1.1, 0.0), (1.107, 0.006), (1.114, 0.016), (1.121, 0.022),
          (1.13, 0.02), (1.145, 0.0145), (1.16, 0.009), (1.172, 0.004),
          (1.186, 0.0)]
NOSE_S = [(1.11, 11.0), (1.13, 8.0), (1.17, 6.0)]


def face_disp(ad, z):
    a = abs(ad)
    d = table(NOSE_H, z) * gauss(ad, 0, table(NOSE_S, z))
    d += 0.006 * gauss(a, 12.5, 5) * gauss(z, 1.116, 0.006)       # nostrils
    d -= 0.011 * gauss(a, 26, 11) * gauss(z, 1.156, 0.0105)       # sockets
    bz = 1.173 - 0.003 * gauss(a, 9, 8)
    d += 0.0085 * gauss(z, bz, 0.0065) * smooth(52, 30, a)        # brow
    d -= 0.0025 * gauss(ad, 0, 4) * gauss(z, 1.169, 0.006)        # frown
    d += 0.007 * gauss(a, 47, 13) * gauss(z, 1.138, 0.012)        # cheekbone
    d -= 0.005 * gauss(a, 40, 12) * gauss(z, 1.104, 0.013)        # hollow
    d -= 0.003 * gauss(z, 1.0965, 0.0025) * gauss(ad, 0, 16)      # mouth
    d += 0.002 * gauss(z, 1.1, 0.004) * gauss(ad, 0, 15)
    d += 0.0026 * gauss(z, 1.087, 0.0035) * gauss(ad, 0, 12)      # lower lip
    d += 0.009 * gauss(z, 1.066, 0.011) * gauss(ad, 0, 20)        # chin
    d -= 0.0022 * gauss(z, 1.062, 0.005) * gauss(ad, 0, 3)        # cleft
    d += 0.004 * gauss(a, 68, 12) * gauss(z, 1.068, 0.014)        # jaw angle
    d -= 0.003 * gauss(a, 62, 10) * gauss(z, 1.175, 0.015)        # temples
    return d


def face_point(ad, z):
    a = math.radians(ad)
    w = table(FACE_W, z)
    front = table(FACE_D, z)
    back = table(BACK_D, z)
    e = 2.0 / FACE_P
    s_, c_ = math.sin(a), math.cos(a)
    x = w * spow(s_, e)
    dd = front if c_ >= 0 else back
    y = dd * spow(c_, e)
    gx = spow(x / w, FACE_P - 1) / w if x else 0.0
    gy = spow(y / dd, FACE_P - 1) / dd if y else 0.0
    n = V(gx, gy, 0)
    n = n.normalized() if n.length > 1e-9 else V(0, 1, 0)
    return V(x, CY + y, z) + n * face_disp(ad, z)


def face_normal(ad, z):
    du = face_point(ad + 0.5, z) - face_point(ad - 0.5, z)
    dz = face_point(ad, z + 0.001) - face_point(ad, z - 0.001)
    n = du.cross(dz).normalized()
    p = face_point(ad, z)
    if (p - HC).dot(n) < 0:
        n = -n
    return n


FACE_A = [0, 4, 8.5, 13.5, 19, 25, 32, 41, 52, 66, 82, 100, 124, 152]
FACE_Z = [1.012, 1.03, 1.047, 1.062, 1.075, 1.085, 1.093, 1.101, 1.108,
          1.115, 1.122, 1.131, 1.141, 1.15, 1.159, 1.167, 1.176, 1.187,
          1.202, 1.228, 1.252]


def hairline(a):
    """The hair's lower edge at angle a: sideburns in front of the ears,
    up over them, down to the collar at the nape."""
    return table([(62, 1.13), (70, 1.106), (80, 1.104), (84, 1.168),
                  (100, 1.176), (116, 1.13), (140, 1.08), (180, 1.064)],
                 abs(a))


STUBBLE_TOP = [(0, 1.0835), (11, 1.0835), (18, 1.0885), (25, 1.0955),
               (33, 1.1005), (44, 1.1045), (57, 1.1085), (68, 1.1115),
               (80, 1.111)]


def stubble():
    """A close stubble shell over the jaw, chin and upper lip. It is built
    on the face's own grid (so it follows the facets exactly and never
    sinks into them) with a smooth upper edge."""
    cols = sorted(set([-a for a in FACE_A] + FACE_A))
    cols = [a for a in cols if abs(a) <= 82]
    th = 0.0014
    c = rk.Mesh(f"{R}-stubble", STUBBLE)
    rows = []
    for a in cols:
        zt = table(STUBBLE_TOP, min(abs(a), 80))
        zs = [z for z in FACE_Z if z < zt - 0.003] + [zt]
        rows.append(zs)
    n = max(len(r) for r in rows)
    grid = []
    for a, zs in zip(cols, rows):
        # Pad short columns by repeating the top so every column has n
        # points (degenerate quads are merged away).
        zs = zs + [zs[-1]] * (n - len(zs))
        grid.append([c.v(face_point(a, z) + face_normal(a, z) * th)
                     for z in zs])
    # Quads between neighbouring columns, point by point up the column.
    for i in range(len(cols) - 1):
        for j in range(n - 1):
            q = (grid[i][j], grid[i + 1][j], grid[i + 1][j + 1],
                 grid[i][j + 1])
            if len({v.co.to_tuple(6) for v in q}) >= 3:
                c.face(q)
    obj = c.obj(outward=HC)
    # The upper lip.
    lip = rk.Mesh(f"{R}-lipstubble", STUBBLE)
    lc = [a for a in cols if abs(a) <= 19]
    lz = [1.101, 1.108]
    g = [[lip.v(face_point(a, z) + face_normal(a, z) * th) for z in lz]
         for a in lc]
    for i in range(len(lc) - 1):
        lip.face((g[i][0], g[i + 1][0], g[i + 1][1], g[i][1]))
    return [obj, lip.obj(outward=HC)]


def skull():
    cols = sorted(set([-a for a in FACE_A] + FACE_A + [180]))
    cols = [a for a in cols if a > -180]
    c = rk.Mesh(f"{R}-face", SKIN)
    rows = [[c.v(face_point(a, z)) for a in cols] for z in FACE_Z]
    n = len(cols)

    def mat(i, j):
        a0, a1 = cols[i], cols[(i + 1) % n]
        if i == n - 1:
            a1 += 360
        a = (a0 + a1) / 2
        a = a - 360 if a > 180 else a
        z = (FACE_Z[j] + FACE_Z[j + 1]) / 2
        if abs(a) > 66 and z > hairline(a):
            return HAIR
        return SKIN

    c.grid(rows, mat, closed=True)
    c.fan(rows[-1], V(0, CY - 0.005, 1.268), HAIR)
    return c.obj(outward=HC)


def eyes():
    """Narrowed eyes: a dark almond under a heavy lid line, and low brows."""
    out = []
    for sx in (-1, 1):
        ac, zc = sx * 25.5, 1.1565
        lens = []
        for i in range(12):
            t = i / 12 * math.tau
            x = math.cos(t)
            y = math.sin(t) * (0.7 if math.sin(t) > 0 else 0.55)
            lens.append((ac + x * 7.6, zc + y * 0.0052 + 0.0008 * x * sx))
        if sx < 0:
            lens.reverse()
        out.append(rk.decal(f"{R}-eye{sx}", face_point, lens, 0.0024, DARK,
                            depth=0.0018, eps=0.05, ref=HC))
        pts = []
        for ad, z in ((7, 1.1668), (15, 1.1702), (24, 1.1718), (33, 1.1712),
                      (42, 1.1685)):
            pts.append(face_point(sx * ad, z) + face_normal(sx * ad, z) *
                       0.0024)
        out.append(rk.tube(f"{R}-brow{sx}", pts,
                           [(0.0042, 0.0026), (0.0044, 0.0027),
                            (0.004, 0.0025), (0.0032, 0.0021),
                            (0.0022, 0.0015)], DARK, n=5,
                           caps=("dome", "dome")))
    return out


def ears():
    out = []
    for sx in (-1, 1):
        p = face_point(sx * 90, 1.142) + V(sx * 0.004, -0.008, 0)
        e = rk.ball(f"{R}-ear{sx}", 1.0, V(0, 0, 0), SKIN,
                    scale=(0.008, 0.02, 0.029), seg=8, rings=5)
        m = Matrix.Translation(p) @ Matrix.Rotation(math.radians(-sx * 14),
                                                    4, "Z") @ \
            Matrix.Rotation(math.radians(-10), 4, "X")
        rk.transform([e], m)
        out.append(e)
    return out


def nape():
    """A few locks of hair falling over the collar at the nape."""
    out = []
    for k, ad in enumerate((140, 158, 180, 202, 220)):
        z0 = hairline(ad) + 0.03
        p0 = face_point(ad, z0) + face_normal(ad, z0) * 0.002
        p1 = face_point(ad, hairline(ad) - 0.006) + \
            face_normal(ad, hairline(ad)) * 0.006
        out.append(rk.tube(f"{R}-lock{k}", [p0, lerp(p0, p1, 0.6), p1],
                           [(0.004, 0.009), (0.0045, 0.009), (0.002, 0.005)],
                           HAIR, n=4, up=V(0, 0, 1).cross(p0 - HC),
                           caps=(None, "dome")))
    return out


def neck():
    return rk.tube(f"{R}-neck", [V(0, 0.0, 0.965), V(0, 0.004, 1.03),
                                 V(0, 0.01, 1.07)],
                   [0.047, 0.046, 0.044], SKIN, n=12, caps=(None, None))


# The hat, in head space: sitting on the brow, tipped a little forward.
HAT_Z = 1.192
HAT_TILT = math.radians(-3)
BRIM = (0.19, 0.198)


def hat():
    pieces = []
    cy = -0.004
    # Crown rings: (z, rx, ry, crease depth, pinch).
    prof = [(HAT_Z - 0.006, 0.089, 0.106, 0.0, 0.0),
            (HAT_Z + 0.03, 0.087, 0.103, 0.0, 0.1),
            (HAT_Z + 0.066, 0.082, 0.098, 0.0, 0.35),
            (HAT_Z + 0.097, 0.074, 0.091, 0.0, 0.7),
            (HAT_Z + 0.119, 0.061, 0.082, 0.0, 0.95),
            (HAT_Z + 0.131, 0.042, 0.071, 0.0, 1.0),
            (HAT_Z + 0.128, 0.022, 0.062, 0.0, 1.0),
            (HAT_Z + 0.11, 0.005, 0.052, 0.0, 1.0)]
    n = 28
    rings = []
    for z, rx_, ry_, crease, pinch in prof:
        ring = []
        for i in range(n):
            a = i / n * math.tau
            s, c = math.sin(a), math.cos(a)
            x = rx_ * spow(s, 0.9)
            y = cy + ry_ * spow(c, 0.9) * (1.0 if c > 0 else 1.03)
            # Front pinches: dents either side of the front of the crown.
            dent = pinch * 0.38 * gauss(math.degrees(a) % 360, 36, 18) + \
                pinch * 0.38 * gauss(math.degrees(a) % 360, 324, 18)
            x *= 1 - dent
            # Side dents of the cattleman crease.
            x *= 1 - pinch * 0.06 * abs(s) ** 3
            ring.append(V(x, y, z))
        rings.append(ring)
    pieces.append(rk.loft(f"{R}-crown", rings, FELT, start=None, end="flat"))
    # The leather band with a small brass buckle on the left.
    band = []
    for z, off in ((HAT_Z - 0.003, 0.001), (HAT_Z - 0.001, 0.004),
                   (HAT_Z + 0.024, 0.004), (HAT_Z + 0.026, 0.001)):
        k0 = prof[0]
        band.append([V((k0[1] + off) * spow(math.sin(i / n * math.tau), 0.9),
                       cy + (k0[2] + off) * spow(math.cos(i / n * math.tau),
                                                 0.9) *
                       (1.0 if math.cos(i / n * math.tau) > 0 else 1.03), z)
                     for i in range(n)])
    pieces.append(rk.loft(f"{R}-hatband", band, DARK))
    bk = V(-0.093, cy + 0.03, HAT_Z + 0.011)
    frame = [bk + V(0, y, z) for y, z, _ in rk.sup(8, 0.011, 0.012, 3.2)]
    pieces.append(rk.tube(f"{R}-hatbuckle", frame + [frame[0]], [0.0022] * 9,
                          BRASS, n=4, up=(1, 0, 0), caps=(None, None)))

    # The brim: wide, the sides curled up hard, the front snapped down.
    m = 32
    ts = [0.0, 0.4, 0.78, 1.0]

    def brim(u, v):
        a = math.radians(u)
        s, c = math.sin(a), math.cos(a)
        k0 = prof[0]
        inner = V(k0[1] * spow(s, 0.9), cy + k0[2] * spow(c, 0.9), 0)
        outer = V(BRIM[0] * spow(s, 0.95), cy + BRIM[1] * spow(c, 0.95), 0)
        t = ts[int(round(v))]
        p = lerp(inner, outer, t)
        side = abs(s) ** 1.6
        curl = side * (0.052 * t ** 2.2)
        dip = -0.008 * max(0.0, c) ** 2 * t ** 1.5 - \
            0.006 * max(0.0, -c) ** 2 * t ** 1.5
        # The rolled edge.
        p.z = HAT_Z - 0.004 + curl + dip + 0.004 * (t > 0.95)
        return p

    pieces.append(rk.sheet(f"{R}-brim", brim, [i * 360 / m for i in range(m)],
                           list(range(len(ts))), FELT, rim=0.0055,
                           closed_u=True, back=True, inside=V(0, cy, 1.4)))
    tilt = Matrix.Translation(V(0, 0, HAT_Z)) @ \
        Matrix.Rotation(-HAT_TILT, 4, "X") @ \
        Matrix.Rotation(math.radians(-2.5), 4, "Y") @ \
        Matrix.Translation(V(0, 0, -HAT_Z))
    rk.transform(pieces, tilt)
    return pieces


def head():
    pieces = [skull(), neck()] + stubble() + eyes() + ears() + nape() + hat()
    rk.transform(pieces, Matrix.Translation(V(0, 0, HEAD_DZ)))
    return pieces


# ------------------------------------------------------------- arms and hands


def fist(name, c, xax, kax, chir, mat=SKIN):
    """A closed fist round a pole along Z (the index finger's end), its
    fingertips toward X and knuckles toward K; the wrist is at -X (the
    tower guard's fist)."""
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
        for x, y, ang in rk.sup(ring_n, hx * k, hy * k, 3.0, math.pi / 10):
            px, py = cx + x, cy + y
            if z in grooves and (px > 0.004 or py < -0.01):
                px -= 0.0022 * (1 if px > 0.004 else 0.5)
                py += 0.0016 if py < -0.01 else 0.0
            if px > 0.01 and py > 0.012 and z not in grooves:
                px += 0.0012
                py += 0.0012
            ring.append(V(px, py, z))
        rings.append(ring)
    pieces = [rk.loft(f"{name}-fist", rings, mat, start=V(cx, cy, -0.038),
                      end=V(cx, cy, 0.039))]
    thumb = [V(-0.024, -0.019, 0.016), V(-0.009, -0.027, 0.031),
             V(0.011, -0.022, 0.038)]
    pieces.append(rk.tube(f"{name}-thumb", thumb, [0.0098, 0.0086, 0.0078],
                          mat, n=6))
    pieces.append(rk.tube(f"{name}-heel", [V(-0.046, 0.002, -0.004),
                                           V(-0.03, 0.0, 0.0)],
                          [(0.022, 0.027), (0.025, 0.03)], mat, n=8,
                          up=(0, 1, 0), caps=("flat", None)))
    xax, kax = Vector(xax).normalized(), Vector(kax).normalized()
    zax = xax.cross(kax) * chir
    m = rk.basis(xax, kax, zax, c)
    rk.transform(pieces, m)
    return pieces


def sleeve(side, s, e, w, sx):
    """The duster's sleeve to the middle of the forearm with a turned-back
    cuff, the team shirt's sleeve and cuff below it to the wrist."""
    pieces = []
    up = (e - s).normalized()
    fo = (w - e).normalized()
    # One tube from above the shoulder through the elbow to the cuff.
    cuff_at = lerp(e, w, 0.58)
    path = [s + up * 0.004, lerp(s, e, 0.3), lerp(s, e, 0.65), e,
            lerp(e, cuff_at, 0.5), cuff_at]
    radii = [0.052, 0.055, 0.052, 0.05, 0.047, 0.047]
    tube = rk.tube(f"{R}-sleeve{side}", path, radii, DUSTER, n=12,
                   caps=(None, None))
    # Folds bunched at the inside of the elbow.
    bend = (up - fo)
    for v in tube.data.vertices:
        p = v.co
        d = min((p - e).length, 0.08)
        k = (1 - d / 0.08) ** 2
        out = (p - e)
        out = out - fo * out.dot(fo)
        if out.length > 1e-6:
            out.normalize()
            ang = math.atan2(out.dot(bend.cross(fo).normalized()),
                             out.dot(bend.normalized()))
            v.co = p + out * 0.006 * k * math.sin(3 * ang + 1.0)
    pieces.append(tube)
    pieces.append(rk.ball(f"{R}-shoulder{side}", 1.0, s + V(sx * 0.004, 0,
                                                           -0.026),
                          DUSTER, scale=(0.052, 0.054, 0.04), seg=10,
                          rings=6))
    # The turned-back cuff.
    pieces.append(rk.tube(f"{R}-cuff{side}", [cuff_at - fo * 0.03,
                                             cuff_at + fo * 0.006],
                          [0.051, 0.054], DUSTER, n=12, caps=(None, None)))
    # The shirt sleeve and its cuff.
    pieces.append(rk.tube(f"{R}-shirtsleeve{side}",
                          [cuff_at - fo * 0.01, lerp(cuff_at, w, 0.5),
                           w - fo * 0.012],
                          [0.04, 0.037, 0.034], TEAM, n=10,
                          caps=(None, None)))
    pieces.append(rk.tube(f"{R}-shirtcuff{side}", [w - fo * 0.03,
                                                  w + fo * 0.002],
                          [0.036, 0.035], TEAM, n=10,
                          caps=("flat", "flat")))
    return pieces


def arm_pose(s, c, pole):
    """The elbow and wrist that put a fist centre at c (its pole along the
    rifle), and the fist's X axis."""
    e0 = rk.ik(s, c, UPPER, FORE + WRIST_FIST, pole)
    xax = (c - e0) - D_REST * (c - e0).dot(D_REST)
    xax.normalize()
    w = c - xax * WRIST_FIST
    e = rk.ik(s, w, UPPER, FORE, pole)
    return e, w, xax


def build_arm(side):
    if side == "R":
        s, sx = S_R, 1
        c = GRIP
        pole = S_R + V(0.6, -0.35, -0.45)
        chir = -1
    else:
        s, sx = S_L, -1
        c = rifle_point(0.0, LEFT_S, LEFT_Z)
        pole = S_L + V(-0.6, -0.1, -0.4)
        chir = 1
    e, w, xax = arm_pose(s, c, pole)
    kax = D_REST.cross(xax) if chir > 0 else xax.cross(D_REST)
    pieces = sleeve(side, s, e, w, sx)
    pieces += fist(f"{R}-hand{side}", c, xax, kax, chir)
    return pieces, s, e, w


# ------------------------------------------------------------- the rifle


def rifle_local():
    """A lever-action rifle in its own frame (x right, y to the muzzle,
    z up), the stock's wrist at the origin; chunky, as miniature arms are."""
    P = []
    bore = 0.032
    # Walnut butt stock: wrist to butt, the comb dropping to the heel.
    stock = [(0.004, 0.005, 0.02, 0.0158), (-0.03, 0.001, 0.021, 0.016),
             (-0.058, -0.006, 0.025, 0.017), (-0.09, -0.017, 0.036, 0.0192),
             (-0.122, -0.028, 0.046, 0.021), (-0.146, -0.033, 0.05, 0.0215)]
    rings = []
    for y, zc, hz, hx in stock:
        rings.append([V(x, y, zc + z) for x, z, _ in
                      rk.sup(10, hx, hz, 2.3, math.pi / 2)])
    P.append(rk.loft(f"{R}-stock", rings, WALNUT, start=None, end=None))
    # The brass crescent butt plate.
    last = stock[-1]
    plate = []
    for y, s in ((-0.146, 1.0), (-0.152, 1.04), (-0.157, 1.02)):
        plate.append([V(x * s, y - 0.005 * (z / last[2]) ** 2, last[1] + z * s)
                      for x, z, _ in rk.sup(10, last[3], last[2], 2.3,
                                            math.pi / 2)])
    P.append(rk.loft(f"{R}-buttplate", plate, BRASS, start=None, end="flat"))
    # The brass receiver, its steel loading gate on the right and a saddle
    # ring on the left.
    P.append(rk.rbox(f"{R}-receiver", (0.033, 0.094, 0.064),
                     (0.0, 0.049, 0.02), BRASS, levels=2, crease=0.75))
    P.append(rk.rbox(f"{R}-gate", (0.004, 0.032, 0.018),
                     (0.0172, 0.064, 0.012), STEEL, levels=1, crease=0.6))
    ring = [V(-0.0185, 0.02 + math.cos(a) * 0.011,
              0.014 + math.sin(a) * 0.011) for a in
            (i / 6 * math.tau for i in range(7))]
    P.append(rk.tube(f"{R}-saddlering", ring, [0.0022] * 7, STEEL, n=4,
                     up=(1, 0, 0), caps=(None, None)))
    # The hammer, cocked back over the wrist.
    P.append(rk.tube(f"{R}-hammer", [V(0, 0.008, 0.047), V(0, -0.002, 0.063),
                                     V(0, -0.016, 0.07)],
                     [(0.0042, 0.007), (0.0038, 0.006), (0.0045, 0.006)],
                     STEEL, n=4, up=(0, 1, 0), caps=(None, "dome")))
    # The lever: a loop under the wrist for the fingers.
    lever = [V(0, 0.038, -0.012), V(0, 0.028, -0.03), V(0, 0.006, -0.039),
             V(0, -0.02, -0.041), V(0, -0.048, -0.046), V(0, -0.068, -0.037),
             V(0, -0.07, -0.022), V(0, -0.055, -0.014)]
    P.append(rk.tube(f"{R}-lever", lever, [0.0042] * len(lever), STEEL, n=4,
                     caps=("dome", "dome")))
    P.append(rk.tube(f"{R}-trigger", [V(0, 0.012, -0.012), V(0, 0.005, -0.03)],
                     [0.0026, 0.002], STEEL, n=4, caps=(None, "dome")))
    # Barrel (octagonal), magazine tube, walnut fore-end and fittings.
    P.append(rk.loft(f"{R}-barrel",
                     [[V(x, y, bore + z) for x, z, _ in
                       rk.sup(8, 0.0128, 0.0128, 2.0, math.pi / 8)]
                      for y in (0.09, 0.36, 0.645)],
                     STEEL, start="flat", end="flat"))
    P.append(rk.loft(f"{R}-magazine",
                     [[V(x, y, 0.009 + z) for x, z, _ in
                       rk.sup(8, 0.0094, 0.0094)]
                      for y in (0.09, 0.36, 0.62)],
                     STEEL, start="flat", end="flat"))
    fore = []
    for y, hz, hx in ((0.092, 0.024, 0.0182), (0.104, 0.0255, 0.0188),
                      (0.3, 0.024, 0.018), (0.322, 0.021, 0.0165)):
        fore.append([V(x, y, 0.015 + z) for x, z, _ in
                     rk.sup(10, hx, hz, 2.4, math.pi / 2)])
    P.append(rk.loft(f"{R}-forend", fore, WALNUT, start="flat", end="flat"))
    P.append(rk.loft(f"{R}-forecap",
                     [[V(x, y, 0.018 + z) for x, z, _ in
                       rk.sup(10, 0.0172, 0.027, 2.4, math.pi / 2)]
                      for y in (0.322, 0.335)],
                     STEEL, start="flat", end="flat"))
    P.append(rk.loft(f"{R}-band",
                     [[V(x, y, 0.021 + z) for x, z, _ in
                       rk.sup(10, 0.0148, 0.025, 2.6, math.pi / 2)]
                      for y in (0.566, 0.58)],
                     STEEL, start="flat", end="flat"))
    P.append(rk.rbox(f"{R}-sight", (0.004, 0.014, 0.012),
                     (0.0, 0.632, bore + 0.016), BRASS, levels=1, crease=0.5))
    P.append(rk.rbox(f"{R}-rearsight", (0.014, 0.01, 0.01),
                     (0.0, 0.17, bore + 0.015), STEEL, levels=1, crease=0.5))
    # The bore, a dark ring at the muzzle.
    P.append(rk.slab(f"{R}-bore", [(x, z) for x, z, _ in
                                   rk.sup(8, 0.0068, 0.0068)],
                     0.002, DARK, matrix=rk.basis(V(1, 0, 0), V(0, 0, 1),
                                                  V(0, 1, 0),
                                                  V(0, 0.6436, bore))))
    return P


# ------------------------------------------------------------- build


def part(name, pieces, pivot, par, angle=48):
    if os.environ.get("RANGER_DEBUG"):
        tally = {}
        for o in pieces:
            key = o.name.split("-", 1)[1] if "-" in o.name else o.name
            key = key.rstrip("0123456789.-LR")
            tally[key] = tally.get(key, 0) + rk.tris(o)
        for k, v in sorted(tally.items(), key=lambda kv: -kv[1]):
            print(f"  TALLY {name:8s} {k:16s} {v:6d}")
    return rk.part(R, name, pieces, pivot, par, angle=angle)


def build(root_name="ranger"):
    assert root_name == R
    root = kit.empty(R)

    for side, sx, knee, ankle, out in (
            ("L", -1, V(-0.094, 0.022, 0.36), V(-0.108, 0.03, 0.085), 12),
            ("R", 1, V(0.094, -0.012, 0.36), V(0.11, -0.022, 0.085), 9)):
        pieces, hip = leg(side, sx, knee, ankle, out)
        part(f"leg{side}", pieces, hip, root)

    torso = [shirt(), hips()] + vest() + kerchief() + coat_upper() + \
        gun_belt()
    torso_obj = part("torso", torso, WAIST, root)
    part("head", head(), NECK, torso_obj, angle=62)

    arm_r, s_r, _, _ = build_arm("R")
    arm_r_obj = part("armR", arm_r, s_r, torso_obj)
    gun = rifle_local()
    rk.transform(gun, rifle_frame())
    part("weapon", gun, GRIP, arm_r_obj, angle=40)
    arm_l, s_l, _, _ = build_arm("L")
    part("armL", arm_l, s_l, torso_obj)

    report(root)
    pose = os.environ.get("RANGER_POSE")
    if pose in POSES:
        rk.apply_runtime(root, POSES[pose])
    return root


# Poses in three.js Euler terms (x, y about the vertical, z), as troops.ts
# sets them: the game's current 'rifle' attack at the brief's test values;
# the two-handed variant this hold is built for (aim, recoil with the head
# tossed back, the lever throw, half-way up); strides.
POSES = {
    "attack": {"armR": (1.45, 0, 0), "armL": (1.5, 0, 0.35),
               "torso": (0.0, 0.32, 0), "head": (-0.18, -0.12, 0),
               "legL": (0.58, 0, 0), "legR": (-0.58, 0, 0)},
    "squared": {"armR": (1.35, 0, 0), "armL": (1.35, 0, 0),
                "torso": (0.0, -0.55, 0), "head": (0.0, 0.45, 0)},
    "kick": {"armR": (1.5, 0, 0), "armL": (1.5, 0, 0),
             "torso": (0.0, -0.55, 0), "head": (0.1, 0.45, 0),
             "weapon": (-0.25, 0, 0)},
    "lever": {"armR": (1.3, 0, 0), "armL": (1.3, 0, 0),
              "torso": (0.0, -0.55, 0), "head": (0.0, 0.45, 0),
              "weapon": (0.15, 0, 0)},
    "half": {"armR": (0.65, 0, 0), "armL": (0.65, 0, 0),
             "torso": (0.0, -0.27, 0), "head": (0.0, 0.22, 0)},
    # The current stride: arms swinging against each other.
    "walk": {"legL": (0.58, 0, 0), "legR": (-0.58, 0, 0),
             "armR": (-0.3, 0, 0), "armL": (0.3, 0, 0)},
    "walk2": {"legL": (-0.58, 0, 0), "legR": (0.58, 0, 0),
              "armR": (0.3, 0, 0), "armL": (-0.3, 0, 0)},
    # A two-handed stride: both arms together, a small swing.
    "walk3": {"legL": (0.58, 0, 0), "legR": (-0.58, 0, 0),
              "armR": (0.1, 0, 0), "armL": (0.1, 0, 0)},
    "walk4": {"legL": (-0.58, 0, 0), "legR": (0.58, 0, 0),
              "armR": (-0.1, 0, 0), "armL": (-0.1, 0, 0)},
}


def report(root):
    print("RANGER joints:")
    for o in kit.descendants(root):
        if o.type == "MESH":
            loc = o.matrix_world.translation
            print(f"  {o.name:16s} pivot ({loc.x:.4f}, {loc.y:.4f}, "
                  f"{loc.z:.4f}) tris {rk.tris(o)} mats "
                  f"{[m.name for m in o.data.materials]}")
    mats = sorted({m.name for o in kit.descendants(root) if o.type == "MESH"
                   for m in o.data.materials})
    print("RANGER materials", len(mats), mats)
