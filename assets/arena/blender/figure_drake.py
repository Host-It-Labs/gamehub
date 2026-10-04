"""The Biplane (card id `drake`) as a collector's miniature: a 1917 First
World War scout biplane built like a museum-grade scale model, wingspan
1.7 m, about 1.4 m long.

Two stacked, staggered wings of doped linen in the team colour, the fabric
drawn tight over raised rib tapes and sagging a touch between them, the
trailing edges scalloped between the ribs, the upper ailerons hinged
surfaces and the lower ones marked by a groove; cream-and-team roundels (plain concentric rings) on the upper
wing, under the lower wing and on the fuselage sides; varnished wooden
interplane and cabane struts with metal fittings and fine silver rigging
(flying, landing, incidence and cabane wires). A slim fabric fuselage
with short aluminium panels behind a polished rotary-engine cowling,
nine finned cylinders and their pushrods inside it; a two-blade
laminated wooden propeller with brass-sheathed tips and a polished
spinner (`spin`); fixed
wire-spoked wheels on a wooden V undercarriage with bungee-wrapped axle;
a tailplane with elevators and a fin and rudder striped team and cream;
a tail skid; a chunky iron bomb with a brass fuze slung under the belly;
and in the open, leather-padded cockpit a cartoon ace, his head and
shoulders well above scale so he reads from the game's camera: a
leather coat with a cross strap and a fleece collar, a brown leather
flying helmet with ear flaps and chunky brass goggles parked on it,
heavy brows over a gritted grin, gauntlet gloves on the rim, and a
silk scarf knotted at his nape, its two tails streaming behind.

Part contract (figures.py / troops.py): the root empty `drake` sits on
the ground under the centre of mass, facing +y, the wheels touching the
ground. `drake.torso` is the whole plane, its pivot on the centre of
mass (0, 0, 0.42 above the root). On it: `drake.spin`, the propeller and
its polished spinner, pivoting on the prop shaft (turns about Blender y);
`drake.wingL` / `drake.wingR`, the upper wing's ailerons, and
`drake.tail`, both elevators, hinged on their straight hinge lines
(about x); `drake.extra`, the rudder, on its hinge (about z);
`drake.wheels`, both wheels on the axle (about x); `drake.weapon`, the
bomb (lifted into the belly when it drops); `drake.neck`, the pilot from
the waist up, carrying `drake.head` (pivot at his neck), his arms
`drake.armL` / `drake.armR` (shoulders) with `drake.foreL` /
`drake.foreR` (elbows), and `drake.cape`, the scarf's tails: drape cloth
built hanging from the knot and turned back by its rest turn
(SCARF_REST) so the game's ripple runs across them. The empty
`drake.bomb` (child of the torso) marks where bombs drop from.
"""

import math

import kit
import face_rig
import figure_drake_kit as pk
from figure_drake_kit import V, X, Y, Z, TAU, lerp, clamp01, smooth, table
from mathutils import Matrix, Vector

# ------------------------------------------------------------- paints

LINEN = "weave:team"
CREAM = "weave:" + kit.tint("plane-linen", "#efe6cf")
WOOD = "lacquer:" + kit.tint("plane-wood", "#b27a43")
WALNUT = "lacquer:" + kit.tint("plane-walnut", "#5e3a21")
ALU = "gilt:" + kit.tint("plane-alu", "#c9ced6")
BRASS = "gilt:" + kit.tint("plane-brass", "#c49a45")
IRON = "resin:" + kit.tint("plane-iron", "#2d2f33")
SKIN = "resin:" + kit.tint("plane-skin", "#d6a283")
LEATHER = "hide:" + kit.tint("plane-leather", "#744526")
TYRE = IRON
BOMB = IRON
SCARF = CREAM

# ------------------------------------------------------------- layout

NOSE = V(0, 0, 0.36)            # the cowling and propeller axis (z)
PROP_Y = 0.585
COCKPIT_Y = -0.19
WHEEL = dict(x=0.18, y=0.2, r=0.078)
# A chunky bomb, a fifth larger than scale; its centre sits so its top
# meets the rack.
BOMB_SIZE = 1.2
BOMB_AT = V(0, 0.0, 0.2315 - 0.03 * BOMB_SIZE)
# The centre of mass in the build coordinates; the plane is moved back by
# its y so the root (the ground point below the pivot) sits under it.
COM = V(0, 0.035, 0.42)

# Fuselage stations: (y, half width, bottom z, shoulder z, top z, bottom
# squareness). Round behind the cowl, a box with a rounded deck behind.
BODY = [
    (0.47, 0.094, 0.268, 0.36, 0.452, 2.2),
    (0.40, 0.097, 0.265, 0.362, 0.456, 2.3),
    (0.33, 0.098, 0.263, 0.364, 0.46, 3.0),
    (0.255, 0.1, 0.261, 0.366, 0.465, 4.0),
    (0.245, 0.1, 0.26, 0.367, 0.466, 4.2),
    (0.06, 0.098, 0.26, 0.372, 0.478, 5.0),
    (-0.07, 0.094, 0.262, 0.376, 0.482, 5.0),
    (-0.19, 0.088, 0.267, 0.38, 0.47, 5.0),
    (-0.30, 0.079, 0.276, 0.384, 0.46, 5.0),
    (-0.41, 0.067, 0.29, 0.388, 0.449, 5.0),
    (-0.52, 0.052, 0.306, 0.392, 0.438, 5.0),
    (-0.61, 0.037, 0.325, 0.396, 0.43, 4.6),
    (-0.68, 0.022, 0.347, 0.4, 0.424, 4.0),
    (-0.705, 0.011, 0.362, 0.402, 0.42, 3.4),
]
RING_N = 24


def station(y):
    rows = sorted(BODY)
    return table(rows, y)


def body_pt(y, a, off=0.0, stringers=False):
    """The fuselage surface at station y, round angle a (0 = +x side,
    pi/2 = top)."""
    hw, zb, zm, zt, pb = station(y)
    c, s = math.cos(a), math.sin(a)
    p = pb if s < 0 else 2.2
    x = (hw + off) * spow(c, 2 / p)
    if s >= 0:
        z = zm + (zt - zm + off) * spow(s, 2 / p)
    else:
        z = zm + (zm - zb + off) * spow(s, 2 / p)
    return V(x, y, z)


def spow(c, e):
    return math.copysign(abs(c) ** e, c)


def side_x(y, z):
    """Half width of the fuselage at height z (its side surface)."""
    hw, zb, zm, zt, pb = station(y)
    if z < zm:
        f = clamp01((zm - z) / (zm - zb))
        p = pb
    else:
        f = clamp01((z - zm) / (zt - zm))
        p = 2.2
    s = f ** (p / 2)
    c = math.sqrt(max(0.0, 1 - s * s))
    return hw * c ** (2 / p)


def deck_z(y, x=0.0):
    """Height of the fuselage's upper surface at (x, y)."""
    hw, zb, zm, zt, pb = station(y)
    c = clamp01(abs(x) / hw)
    # Invert x = hw * cos^(2/2.2): cos = (x/hw)^(1.1).
    cs = c ** 1.1
    s = math.sqrt(max(0.0, 1 - cs * cs))
    return zm + (zt - zm) * s ** (2 / 2.2)


# ------------------------------------------------------------- fuselage

def fuselage(t):
    angs = [(i + 0.5) / RING_N * TAU for i in range(RING_N)]
    rings, mats = [], []
    for k, row in enumerate(BODY):
        y = row[0]
        ring = []
        for i, a in enumerate(angs):
            off = 0.0
            # The alloy panels stand a hair proud of the fabric at the join.
            if 0.25 <= y:
                off = 0.0022
            p = body_pt(y, a, off)
            # Fabric over the deck stringers behind the cockpit: sag
            # between them.
            s = math.sin(a)
            if y < -0.25 and s > 0.35 and i % 2 == 0:
                p.z -= 0.0022 * smooth((-0.25 - y) / 0.12)
            ring.append(p)
        rings.append(ring)
    alloy = sum(1 for r in BODY if r[0] >= 0.25) - 1

    def fm(i, j):
        if isinstance(i, tuple):
            return LINEN
        return ALU if i < alloy else LINEN
    out = [pk.loft(f"{t}-fuselage", rings, LINEN, face_mat=fm,
                   start="flat", end="pole")]
    # The brass fuel filler cap ahead of the cockpit.
    y = -0.035
    out.append(pk.lathe(f"{t}-filler", [(0.013, -0.004), (0.013, 0.003),
                                        (0.009, 0.006), (0.0, 0.006)],
                        V(0, y, deck_z(y) - 0.001), Z, BRASS, segments=10,
                        end="pole"))
    for sx in (-1, 1):
        out.append(side_roundel(t, sx))
    return out


def side_roundel(t, sx):
    y0, z0, r0 = -0.405, 0.372, 0.044

    def surf(a, r):
        y = y0 + r * math.cos(a)
        z = z0 + r * math.sin(a)
        x = side_x(y, z)
        p = V(sx * x, y, z)
        # Normal: across the side, leaning with the taper.
        dxdy = (side_x(y + 0.01, z) - side_x(y - 0.01, z)) / 0.02
        dxdz = (side_x(y, z + 0.01) - side_x(y, z - 0.01)) / 0.02
        n = V(sx, -dxdy, -dxdz).normalized()
        return p, n
    return pk.decal(f"{t}-roundelside{sx}", roundel_rings(r0), surf,
                    segments=16, lift=0.0022)


def roundel_rings(r):
    """Cream and team rings from the outside in (plain, no letters)."""
    return [(r, CREAM), (r * 0.72, LINEN), (r * 0.46, CREAM),
            (r * 0.22, LINEN)]


def cowling(t):
    out = []
    prof = [(0.105, 0.384), (0.11, 0.392), (0.111, 0.40), (0.116, 0.42),
            (0.1195, 0.45), (0.1205, 0.49), (0.1185, 0.52), (0.114, 0.54),
            (0.107, 0.552), (0.098, 0.558), (0.088, 0.557), (0.082, 0.552),
            (0.08, 0.545), (0.079, 0.535)]
    out.append(pk.lathe(f"{t}-cowl", [(r, y) for r, y in prof], NOSE, Y,
                        ALU, segments=26))
    # Inside: a dark back wall, the crankcase and nine finned cylinders
    # with their pushrods (a rotary engine).
    out.append(pk.lathe(f"{t}-firewall", [(0.082, 0.49), (0.0, 0.49)],
                        NOSE + Y * 0.0, Y, IRON, segments=18, end="pole"))
    out.append(pk.lathe(f"{t}-crank", [(0.036, 0.49), (0.036, 0.53),
                                       (0.031, 0.542), (0.019, 0.548),
                                       (0.0, 0.55)],
                        NOSE, Y, IRON, segments=16, end="pole"))
    for k in range(9):
        a = k / 9 * TAU + math.pi / 2
        d = V(math.cos(a), 0, math.sin(a))
        base = NOSE + Y * 0.522 + d * 0.028
        fins = [(0.011, 0.0), (0.011, 0.008), (0.0138, 0.009),
                (0.0138, 0.03), (0.011, 0.031), (0.011, 0.04),
                (0.0095, 0.044)]
        out.append(pk.lathe(f"{t}-cyl{k}", fins, base, d, IRON, segments=5,
                            end="pole"))
        out.append(pk.lathe(f"{t}-head{k}", [(0.009, 0.042), (0.009, 0.048),
                                             (0.0, 0.05)],
                            base, d, ALU, segments=5, end="pole"))
        # Pushrod from the crankcase nose to the rocker on the head.
        a0 = NOSE + Y * 0.546 + d * 0.018
        a1 = base + d * 0.046 + Y * 0.01
        out.append(pk.wire(f"{t}-rod{k}", a0, a1, 0.0022, ALU, n=3))
    return out


# ------------------------------------------------------------- wings

TOP_U = [0.0, 0.025, 0.08, 0.2, 0.38, 0.56, 0.74, 0.765, 0.79, 0.9, 1.0]
BOT_U = [0.9, 0.62, 0.34, 0.12, 0.03]


def foil_half(u):
    """Half thickness (fraction of max) of a thin section."""
    f = (0.2969 * math.sqrt(u) - 0.126 * u - 0.3516 * u * u
         + 0.2843 * u ** 3 - 0.1036 * u ** 4)
    return max(0.0, f / 0.1)


class Wing:
    """A fabric wing along x: plan with raked, rounded tips; ribs every
    `rib` along the span with raised tapes, the fabric sagging between
    them and the trailing edge scalloped; an aileron groove."""

    def __init__(self, name, half, chord, lead, z, thick, dihedral=0.0,
                 tip=0.12, rib=0.095, root=0.0, aileron=None, camber=0.035,
                 sag=0.0032, tape=0.0, tape_w=0.0, scallop=0.0035,
                 groove=0.0035, mirror=True, sag_rings=True, split=None):
        self.__dict__.update(locals())
        del self.__dict__["self"]
        self.x0 = half - tip
        xs = []
        n = max(1, round((self.x0 - root) / rib))
        step = (self.x0 - root) / n
        ribs = [root + i * step for i in range(n + 1)]
        self.ribs = ribs
        for k, r in enumerate(ribs):
            xs.append((r, "rib"))
            if k + 1 < len(ribs) and sag_rings:
                xs.append(((r + ribs[k + 1]) / 2, "sag"))
        for s in (0.3, 0.55, 0.75, 0.88, 0.96):
            xs.append((self.x0 + tip * s, "plain"))
        self.half_stations = sorted(xs)

    def plan(self, ax):
        s = clamp01((ax - self.x0) / self.tip)
        e = 1 - math.sqrt(max(0.0, 1 - s * s))
        lead = self.lead - 0.3 * self.chord * e
        trail = self.lead - self.chord + 0.7 * self.chord * e
        return lead, trail, s

    def section(self, x, kind, u, top=True):
        """A point on the wing at span x, chord fraction u."""
        ax = abs(x)
        lead, trail, s = self.plan(ax)
        if kind == "sag":
            trail += self.scallop * (1 - s)
        c = lead - trail
        th = self.thick * (0.5 + 0.5 * math.sqrt(max(0.0, 1 - s * s)))
        zc = self.z + math.tan(self.dihedral) * ax
        cam = self.camber * c * 4 * u * (1 - u)
        h = th / 2 * foil_half(u)
        off = cam + h if top else cam - h * 0.35
        body = clamp01((u - 0.1) / 0.06) * clamp01((0.99 - u) / 0.05)
        sgn = 1 if top else -1
        if kind == "sag":
            off -= sgn * self.sag * math.sin(math.pi * clamp01(
                (u - 0.1) / 0.89)) * (1 - s)
        if kind == "tape":
            off += sgn * self.tape * body
        if self.aileron and self.aileron[0] <= ax <= self.aileron[1] and \
                abs(u - 0.765) < 0.01:
            off -= sgn * self.groove * (0.6 if not top else 1.0)
        return V(x, lead - u * c, zc + off)

    def ring(self, x, kind):
        pts = [self.section(x, kind, u, True) for u in TOP_U]
        pts += [self.section(x, kind, u, False) for u in BOT_U]
        return pts

    def stations(self):
        if self.root == 0 and self.mirror:
            full = [(-x, k) for x, k in reversed(self.half_stations)
                    if x > 1e-6] + list(self.half_stations)
            return [full]
        return [[(-x, k) for x, k in reversed(self.half_stations)],
                list(self.half_stations)]

    def build(self, mat=LINEN):
        """The fixed wing, and with `split` (span from, span to, hinge y,
        gap) its hinged trailing surfaces: ({-1: [...], 1: [...]}), one
        set per side, cut on a straight hinge line."""
        if not self.split:
            out = []
            for side, st in enumerate(self.stations()):
                rings = [self.ring(x, k) for x, k in st]
                out.append(pk.loft(f"{self.name}{side}", rings, mat,
                                   start="flat", end="flat"))
            return out
        a0, a1, yh, gap = self.split
        fixed, moving = [], {-1: [], 1: []}
        n = 0
        for st in self.stations():
            runs = []
            for a, b in zip(st, st[1:]):
                inside = a0 - 1e-6 < abs((a[0] + b[0]) / 2) < a1 + 1e-6
                if runs and runs[-1][0] == inside:
                    runs[-1][1].append(b)
                else:
                    runs.append((inside, [a, b]))
            for inside, run in runs:
                n += 1
                if not inside:
                    fixed.append(pk.loft(
                        f"{self.name}{n}", [self.ring(x, k) for x, k in run],
                        mat, start="flat", end="flat"))
                    continue
                fixed.append(pk.loft(
                    f"{self.name}{n}m",
                    [self.cut_ring(x, k, yh, True) for x, k in run], mat,
                    start="flat", end="flat"))
                sx = 1 if run[0][0] + run[-1][0] > 0 else -1
                moving[sx].append(pk.loft(
                    f"{self.name}{n}a",
                    [self.cut_ring(x, k, yh - gap, False) for x, k in run],
                    mat, start="flat", end="flat"))
        return fixed, moving

    def u_at(self, x, kind, y):
        """Chord fraction of the line y at a station."""
        lead, trail, s = self.plan(abs(x))
        if kind == "sag":
            trail += self.scallop * (1 - s)
        return (lead - y) / (lead - trail)

    def cut_ring(self, x, kind, y, main):
        """A section cut at the hinge line y: the wing ahead of it (main)
        or the hinged surface behind it. Point counts stay fixed along a
        run (the cut moves a hair with the scallops)."""
        u = self.u_at(x, kind, y)
        ref = self.u_at(self.x0 / 2, "rib", y)
        if main:
            top = [v for v in TOP_U if v < ref - 0.03] + [u]
            bot = [u] + [v for v in BOT_U if v < ref - 0.03]
        else:
            top = [u] + [v for v in TOP_U if v > ref + 0.025]
            bot = [v for v in BOT_U if v > ref + 0.025] + [u]
        return ([self.section(x, kind, v, True) for v in top]
                + [self.section(x, kind, v, False) for v in bot])

    def hinge(self, x, y):
        """A point on the hinge line at span x, midway through the wing."""
        u = self.u_at(x, "rib", y)
        a = self.section(x, "rib", u, True)
        b = self.section(x, "rib", u, False)
        return (a + b) / 2

    def surface(self, x, u, top=True):
        """The built surface at (x, u), interpolated between stations."""
        st = self.half_stations
        ax = abs(x)
        k0 = st[0]
        for a, b in zip(st, st[1:]):
            if a[0] <= ax <= b[0]:
                f = (ax - a[0]) / (b[0] - a[0])
                pa = self.section(a[0], a[1], u, top)
                pb = self.section(b[0], b[1], u, top)
                p = pa.lerp(pb, f)
                return V(x, p.y, p.z)
        p = self.section(k0[0], k0[1], u, top)
        return V(x, p.y, p.z)

    def normal(self, x, u, top=True):
        e = 0.004
        lead, trail, _ = self.plan(abs(x))
        c = lead - trail
        du = e / c
        px = self.surface(x + e, u, top) - self.surface(x - e, u, top)
        pu = self.surface(x, u + du, top) - self.surface(x, u - du, top)
        n = px.cross(pu).normalized()
        # px points +x, pu points -y (aft): px x pu is -z; flip for the top.
        if (n.z < 0) == top:
            n = -n
        return n

    def u_of(self, x, y):
        lead, trail, _ = self.plan(abs(x))
        return (lead - y) / (lead - trail)

    def centre_of(self, x0, u0):
        lead, trail, _ = self.plan(abs(x0))
        return lead - u0 * (lead - trail)

    def tapes(self, t, avoid=(), us=(0.1, 0.3, 0.52, 0.74, 0.97),
              width=0.0075, height=0.0021):
        """Raised rib tapes across the top of each rib, crisp enough to
        read from above; they stop short of the roundels in `avoid`
        ((x, y, r) discs). With a `split` they stop at the hinge, and
        the hinged surfaces' own tapes come back apart:
        (fixed, {-1: [...], 1: [...]})."""
        out = []
        moving = {-1: [], 1: []}
        xs = [r for r in self.ribs if r > 1e-6]
        xs = [-x for x in reversed(xs)] + xs if self.mirror else xs
        if self.root == 0:
            xs.append(0.0)
        for x in xs:
            lead, trail, _ = self.plan(abs(x))
            c = lead - trail
            cuts = []
            for ax, ay, ar in avoid:
                dx = abs(x - ax)
                rr = ar + 0.008
                if dx < rr:
                    h = math.sqrt(rr * rr - dx * dx)
                    cuts.append(((lead - (ay + h)) / c, (lead - (ay - h)) / c))
            spans = [(us[0], us[-1])]
            for c0, c1 in cuts:
                nxt = []
                for a, b in spans:
                    if c1 <= a or c0 >= b:
                        nxt.append((a, b))
                        continue
                    if c0 - a > 0.04:
                        nxt.append((a, c0))
                    if b - c1 > 0.04:
                        nxt.append((c1, b))
                spans = nxt
            hinged = None
            if self.split:
                a0, a1, yh, gap = self.split
                if a0 - 1e-6 <= abs(x) <= a1 + 1e-6:
                    uc = self.u_at(x, "rib", yh)
                    ua = self.u_at(x, "rib", yh - gap)
                    cut = []
                    for a, b in spans:
                        if a < uc - 0.01:
                            cut.append((a, min(b, uc - 0.006)))
                    if a0 + 1e-6 < abs(x) < a1 - 1e-6:
                        hinged = (ua + 0.006, us[-1])
                    spans = cut
            for k, (a, b) in enumerate(spans):
                u_list = [a] + [u for u in us if a + 0.02 < u < b - 0.02] + [b]
                out.append(self._tape(f"{t}-tape{self.name[-5:]}", x, u_list,
                                      width, height))
            if hinged:
                a, b = hinged
                u_list = [a] + [u for u in us if a + 0.02 < u < b - 0.02] + [b]
                moving[1 if x > 0 else -1].append(self._tape(
                    f"{t}-tape{self.name[-5:]}h", x, u_list, width, height))
        return (out, moving) if self.split else out

    def _tape(self, name, x, u_list, width, height):
        rings = []
        for u in u_list:
            p = self.surface(x, u, True)
            n = self.normal(x, u, True)
            rings.append([p + X * width / 2 - n * 0.001,
                          p + X * width * 0.42 + n * height,
                          p - X * width * 0.42 + n * height,
                          p - X * width / 2 - n * 0.001])
        return _open_strip(name, rings)

    def roundel(self, t, key, x0, u0, r, top=True):
        y0 = self.centre_of(x0, u0)

        def surf(a, rr):
            x = x0 + rr * math.cos(a)
            y = y0 + rr * math.sin(a)
            u = self.u_of(x, y)
            return self.surface(x, u, top), self.normal(x, u, top)
        return pk.decal(f"{t}-roundel{key}", roundel_rings(r), surf,
                        segments=16, lift=0.003)


# The upper wing's ailerons are hinged surfaces (`wingL`, `wingR`) on the
# straight run of the trailing edge, between the ribs at 0.36 and 0.72.
AIL_Y = 0.285 - 0.77 * 0.34
UPPER = Wing("drake-upper", half=0.85, chord=0.34, lead=0.285, z=0.625,
             thick=0.029, tip=0.13, rib=0.095,
             split=(0.36, 0.72, AIL_Y, 0.0045))
LOWER = Wing("drake-lower", half=0.75, chord=0.30, lead=0.245, z=0.257,
             thick=0.026, dihedral=math.radians(4), tip=0.11, rib=0.095,
             root=0.1, aileron=(0.38, 0.7), sag_rings=False)
STRUT_X = 0.645
SPAR_U = (0.2, 0.72)


def _open_strip(name, rings):
    """A tape: rings of four points (a U open at the bottom), end caps."""
    c = pk.Cage(name, LINEN)
    vs = [c.ring(r) for r in rings]
    for a, b in zip(vs, vs[1:]):
        for j in range(3):
            c.face((a[j], a[j + 1], b[j + 1], b[j]))
    c.face(list(reversed(vs[0])))
    c.face(vs[-1])
    obj = c.obj(recalc=False)
    mid = [sum(r, Vector()) / 4 for r in rings]

    def outward(q):
        if (q - mid[0]).length < 1e-5:
            return mid[0] - mid[1]
        if (q - mid[-1]).length < 1e-5:
            return mid[-1] - mid[-2]
        best = min(mid, key=lambda m: (m - q).length)
        d = q - best
        d.z += 0.0005
        return d
    return pk.orient(obj, outward)


def wings(t):
    """The wings fixed to the plane, and the ailerons per side."""
    out, ail = UPPER.build()
    out += LOWER.build()
    up_r, up_u = 0.1, 0.42
    tapes, hinged = UPPER.tapes(t, [(sx * 0.6, UPPER.centre_of(0.6, up_u),
                                     up_r) for sx in (-1, 1)])
    out += tapes
    out += LOWER.tapes(t)
    for sx in (-1, 1):
        ail[sx] += hinged[sx]
        out.append(UPPER.roundel(t, f"up{sx}", sx * 0.6, up_u, up_r))
        out.append(LOWER.roundel(t, f"lo{sx}", sx * 0.52, 0.5, 0.092,
                                 top=False))
    return out, ail


def aileron_pivot(sx):
    return UPPER.hinge(sx * 0.54, AIL_Y - 0.00225)


def fitting(name, at, n):
    """A small metal strut socket on a wing surface."""
    return pk.lathe(name, [(0.012, -0.004), (0.012, 0.004), (0.0, 0.006)],
                    at, n, ALU, segments=6, end="pole")


def streamline(name, a, b, chord, thick, mat=WOOD, n=8):
    """A varnished streamlined strut from a to b, its chord along y."""
    a, b = Vector(a), Vector(b)
    d = (b - a).normalized()
    fwd = Y - d * Y.dot(d)
    fwd.normalize()
    side = d.cross(fwd)
    sec = [(0.5, 0.0), (0.38, 0.42), (0.1, 0.5), (-0.2, 0.36),
           (-0.5, 0.0), (-0.2, -0.36), (0.1, -0.5), (0.38, -0.42)]
    rings = []
    for p in (a, a.lerp(b, 0.5), b):
        rings.append([p + fwd * u * chord + side * v * thick
                      for u, v in sec])
    return pk.loft(name, rings, mat, start="flat", end="flat")


def struts(t):
    out = []
    for sx in (-1, 1):
        x = sx * STRUT_X
        tops = []
        for k, u in enumerate(SPAR_U):
            lo = LOWER.surface(x, u, True)
            hi = UPPER.surface(x, u, False)
            out.append(streamline(f"{t}-strut{sx}{k}", lo - Z * 0.004,
                                  hi + Z * 0.004, 0.028, 0.011))
            out.append(fitting(f"{t}-fitlo{sx}{k}", lo, Z))
            out.append(fitting(f"{t}-fithi{sx}{k}", hi, -Z))
            tops.append((lo, hi))
        # Incidence wires: an X between the front and rear struts.
        (lo0, hi0), (lo1, hi1) = tops
        out.append(pk.wire(f"{t}-inc{sx}a", lo0 + Z * 0.01, hi1 - Z * 0.01,
                           0.0017, ALU))
        out.append(pk.wire(f"{t}-inc{sx}b", lo1 + Z * 0.01, hi0 - Z * 0.01,
                           0.0017, ALU))
    # Cabane struts from the fuselage shoulders to the centre section.
    for sx in (-1, 1):
        for k, u in enumerate(SPAR_U):
            hi = UPPER.surface(sx * 0.105, u, False)
            y = hi.y - 0.012
            lo = V(sx * 0.064, y, deck_z(y, 0.064) - 0.006)
            out.append(streamline(f"{t}-cabane{sx}{k}", lo, hi + Z * 0.004,
                                  0.022, 0.009))
            out.append(fitting(f"{t}-fitcab{sx}{k}", hi, -Z))
    # Cabane cross wires (front view X) at the front spar.
    u = SPAR_U[0]
    hl = UPPER.surface(-0.105, u, False)
    hr = UPPER.surface(0.105, u, False)
    yb = hl.y - 0.012
    out.append(pk.wire(f"{t}-cabx0", hl, V(0.058, yb, deck_z(yb, 0.058)),
                       0.0016, ALU))
    out.append(pk.wire(f"{t}-cabx1", hr, V(-0.058, yb, deck_z(yb, 0.058)),
                       0.0016, ALU))
    return out


def rigging(t):
    """Flying wires up from the lower wing roots to the strut tops,
    landing wires down from the cabane to the strut feet; doubled at the
    front spar as on the real thing."""
    out = []
    for sx in (-1, 1):
        x = sx * STRUT_X
        for k, u in enumerate(SPAR_U):
            root_lo = LOWER.surface(sx * 0.108, u, True)
            root_hi = UPPER.surface(sx * 0.12, u, False)
            tip_hi = UPPER.surface(x, u, False) + Z * 0.004
            tip_lo = LOWER.surface(x, u, True) + Z * 0.006
            offs = (-0.006, 0.006) if k == 0 else (0.0,)
            for j, dy in enumerate(offs):
                out.append(pk.wire(f"{t}-fly{sx}{k}{j}", root_lo + Y * dy,
                                   tip_hi + Y * dy, 0.0017, ALU))
            out.append(pk.wire(f"{t}-land{sx}{k}", root_hi, tip_lo,
                               0.0016, ALU))
    return out


# ------------------------------------------------------------- tail

# The elevators (`tail`, both halves) hinge on the straight run of the
# stabiliser's trailing edge; the rudder (`extra`) on the fin's.
ELEV_Y = -0.505 - 0.66 * 0.2
STAB = Wing("drake-stab", half=0.29, chord=0.2, lead=-0.505, z=0.412,
            thick=0.016, tip=0.11, rib=0.09, root=0.012,
            camber=0.0, sag=0.0025, scallop=0.0025,
            split=(0.012, 0.18, ELEV_Y, 0.004))
# The fin and rudder outline: top and bottom z along y (front to back).
FIN_TOP = [(-0.705 - 0.086, 0.43), (-0.789, 0.475), (-0.784, 0.53),
           (-0.772, 0.575), (-0.752, 0.61), (-0.728, 0.63),
           (-0.705, 0.636), (-0.68, 0.625), (-0.655, 0.6),
           (-0.625, 0.56), (-0.595, 0.515), (-0.565, 0.47),
           (-0.535, 0.432)]
FIN_BOT = [(-0.791, 0.43), (-0.785, 0.385), (-0.768, 0.35),
           (-0.745, 0.336), (-0.72, 0.34), (-0.707, 0.355),
           (-0.703, 0.41), (-0.535, 0.414)]
HINGE_Y = -0.705


def fin(t):
    ys = [-0.537, -0.555, -0.58, -0.61, -0.64, -0.67, -0.695, -0.7015,
          -0.705, -0.7085, -0.716, -0.73, -0.7325, -0.74, -0.755, -0.7575, -0.765,
          -0.775, -0.783, -0.788]
    top = sorted(FIN_TOP)
    bot = sorted(FIN_BOT)
    vs = [0.0, 0.08, 0.3, 0.55, 0.8, 0.94, 1.0]
    rings = []
    for y in sorted(ys, reverse=True):
        zt = table(top, y)[0]
        zb = table(bot, y)[0]
        th = 0.0065
        if abs(y - HINGE_Y) < 0.002:
            th = 0.0035
        pts = []
        for v in vs:
            k = math.sin(math.pi * v) ** 0.5
            pts.append(V(th * k, y, lerp(zb, zt, v)))
        for v in reversed(vs[1:-1]):
            k = math.sin(math.pi * v) ** 0.5
            pts.append(V(-th * k, y, lerp(zb, zt, v)))
        rings.append(pts)
    ys_sorted = sorted(ys, reverse=True)

    def painted(ys_run):
        def fm(i, j):
            if isinstance(i, tuple):
                return LINEN
            y = (ys_run[i] + ys_run[i + 1]) / 2
            if y > HINGE_Y:
                return LINEN
            # The rudder: cream, team, cream stripes.
            if y > -0.7315:
                return CREAM
            if y > -0.7565:
                return LINEN
            return CREAM
        return fm
    # The fin ends on the hinge; the rudder starts a hair behind it.
    k = ys_sorted.index(HINGE_Y)
    fin_ys, rud_ys = ys_sorted[:k + 1], ys_sorted[k + 1:]
    return ([pk.loft(f"{t}-fin", rings[:k + 1], LINEN,
                     face_mat=painted(fin_ys), start="flat", end="flat")],
            [pk.loft(f"{t}-rudder", rings[k + 1:], LINEN,
                     face_mat=painted(rud_ys), start="flat", end="flat")])


RUDDER_AT = V(0, HINGE_Y - 0.0018, 0.49)


def elevator_pivot():
    p = STAB.hinge(0.1, ELEV_Y - 0.002)
    return V(0, p.y, p.z)


def tail(t):
    """The fixed tail, the elevators and the rudder."""
    out, elev = STAB.build()
    tapes, hinged = STAB.tapes(t, us=(0.1, 0.35, 0.62, 0.95), width=0.006,
                               height=0.0017)
    out += tapes
    elev = elev[-1] + elev[1] + hinged[-1] + hinged[1]
    fin_, rudder = fin(t)
    out += fin_
    # Tail skid: a sprung ash skid with a steel shoe.
    y0 = -0.6
    z0 = station(y0)[1]
    out.append(pk.tube(f"{t}-skid", [V(0, y0 + 0.03, z0 + 0.01),
                                     V(0, y0 - 0.02, z0 - 0.035),
                                     V(0, y0 - 0.06, z0 - 0.052)],
                       [(0.008, 0.012), (0.007, 0.01), (0.006, 0.008)],
                       WOOD, n=6, up=X))
    out.append(pk.tube(f"{t}-shoe", [V(0, y0 - 0.035, z0 - 0.049),
                                     V(0, y0 - 0.066, z0 - 0.056)],
                       [(0.007, 0.004), (0.006, 0.003)], ALU, n=4, up=Z))
    # Control horns and cables: elevator horns under the stab, rudder
    # horns low on the rudder, cables running into the fuselage.
    for sx in (-1, 1):
        hp = STAB.surface(sx * 0.07, 0.72, False)
        horn = pk.slab(f"{t}-elhorn{sx}", [(-0.012, 0.0), (0.012, 0.0),
                                            (0.0, -0.028)], 0.003, ALU,
                       pk.basis(Y, Z, X, hp + Z * 0.002))
        elev.append(horn)
        tip = hp - Z * 0.026
        into = V(sx * side_x(-0.5, 0.33) * 0.95, -0.5, 0.33)
        out.append(pk.wire(f"{t}-elcable{sx}", tip, into, 0.0012, ALU, n=3))
        rh = V(sx * 0.0065, -0.716, 0.36)
        rudder.append(pk.slab(f"{t}-ruhorn{sx}", [(-0.01, 0.0), (0.01, 0.0),
                                                  (0.0, 0.024)], 0.003, ALU,
                              pk.basis(Y, X * sx, -Z * sx, rh)))
        tip = rh + X * sx * 0.022
        into = V(sx * side_x(-0.55, 0.36) * 0.98, -0.55, 0.36)
        out.append(pk.wire(f"{t}-rucable{sx}", tip, into, 0.0012, ALU, n=3))
        # Bracing wires from the stab to the fin top and belly.
        s = STAB.surface(sx * 0.16, 0.25, True)
        out.append(pk.wire(f"{t}-tbrace{sx}", s, V(0, -0.62, 0.55), 0.0012,
                           ALU, n=3))
        s = STAB.surface(sx * 0.16, 0.25, False)
        out.append(pk.wire(f"{t}-bbrace{sx}", s,
                           V(0, -0.6, station(-0.6)[1] + 0.004), 0.0012,
                           ALU, n=3))
    return out, elev, rudder


# ------------------------------------------------------------- gear

def wheel(t, sx):
    x, y, r = WHEEL["x"], WHEEL["y"], WHEEL["r"]
    # The tyre's polygon sits a hair inside its radius: drop it to touch.
    c = V(sx * x, y, r - 0.0016)
    ax = X * sx
    out = []
    # Tyre: a fat torus from the rim out to the tread.
    tyre = []
    for k in range(8):
        a = -math.pi / 2 + k / 7 * math.pi
        tyre.append((r - 0.0145 + 0.0145 * math.cos(a),
                     0.0155 * math.sin(a)))
    # Go up the outside: from the inner lip on -z, round the tread, back in.
    out.append(pk.lathe(f"{t}-tyre{sx}", tyre, c, ax, TYRE, segments=18))
    rim = [(r - 0.0145, 0.0115), (r - 0.0175, 0.012),
           (r - 0.0185, 0.0), (r - 0.0175, -0.012), (r - 0.0145, -0.0115)]
    out.append(pk.lathe(f"{t}-rim{sx}", rim, c, ax, ALU, segments=18,
                        flip=False))
    # Hub drum with brass caps.
    out.append(pk.rounded_lathe(f"{t}-hub{sx}", [(0.013, -0.019),
                                                 (0.017, -0.012),
                                                 (0.017, 0.012),
                                                 (0.013, 0.019)],
                                c, ax, ALU, segments=10))
    out.append(pk.lathe(f"{t}-cap{sx}", [(0.009, 0.019), (0.009, 0.024),
                                         (0.0, 0.026)], c, ax, BRASS,
                        segments=8, end="pole"))
    # Wire spokes: two dished sets crossing to the rim.
    frame = pk.frame(ax)
    for set_i, side in enumerate((-1, 1)):
        for k in range(12):
            a = (k + 0.5 * set_i) / 12 * TAU
            e = frame @ V(math.cos(a), math.sin(a), 0).to_4d()
            e = e.to_3d().normalized()
            a0 = c + ax * side * 0.014 + e * 0.012
            a1 = c + ax * side * 0.003 + e * (r - 0.018)
            out.append(pk.wire(f"{t}-spoke{sx}{set_i}{k}", a0, a1, 0.0011,
                               ALU, n=3))
    return out


AXLE = V(0, WHEEL["y"], WHEEL["r"] - 0.0016)


def gear(t):
    """The undercarriage, and the two wheels (`wheels`, turning on the
    axle)."""
    x, y, r = WHEEL["x"], WHEEL["y"], WHEEL["r"]
    out = []
    wheels = []
    for sx in (-1, 1):
        wheels += wheel(t, sx)
        foot = V(sx * 0.14, y, r + 0.004)
        for k, fy in enumerate((0.34, 0.11)):
            top = V(sx * 0.074, fy, station(fy)[1] + 0.012)
            out.append(streamline(f"{t}-leg{sx}{k}", foot, top, 0.024,
                                  0.01))
        # Bungee cord wrapped round the axle at the V's foot.
        out.append(pk.lathe(f"{t}-bungee{sx}", [(0.012, -0.012),
                                                (0.0135, -0.006),
                                                (0.0135, 0.006),
                                                (0.012, 0.012)],
                            foot, X, WALNUT, segments=10))
        # Cross wires between the V's (front view X).
    out.append(pk.wire(f"{t}-gearx0", V(-0.135, y, r + 0.012),
                       V(0.072, 0.225, station(0.225)[1] + 0.006),
                       0.0016, ALU))
    out.append(pk.wire(f"{t}-gearx1", V(0.135, y, r + 0.012),
                       V(-0.072, 0.225, station(0.225)[1] + 0.006),
                       0.0016, ALU))
    # The axle in its streamlined wooden spreader.
    out.append(pk.tube(f"{t}-axle", [V(-0.197, y, r), V(0.197, y, r)],
                       [0.0055, 0.0055], ALU, n=8, up=Z))
    sec = []
    for u, v in [(0.5, 0.0), (0.35, 0.45), (0.05, 0.5), (-0.25, 0.35),
                 (-0.5, 0.0), (-0.25, -0.35), (0.05, -0.5), (0.35, -0.45)]:
        sec.append((u * 0.034, v * 0.016))
    rings = []
    for xx in (-0.14, 0.0, 0.14):
        rings.append([V(xx, y + u, r + 0.004 + v) for u, v in sec])
    out.append(pk.loft(f"{t}-spreader", rings, WOOD, start="flat",
                       end="flat"))
    return out, wheels


# ------------------------------------------------------------- bomb

def bomb(t):
    """The rack under the belly, and the bomb on it (`weapon`: drawn up
    into the belly when it drops, lowered again to reload)."""
    c = BOMB_AT
    k = BOMB_SIZE
    out = []
    rack = []
    prof = [(0.0, -0.066), (0.012, -0.062), (0.021, -0.05), (0.028, -0.03),
            (0.03, -0.01), (0.03, 0.02), (0.027, 0.045), (0.02, 0.064),
            (0.011, 0.076), (0.0, 0.08)]
    out.append(pk.rounded_lathe(f"{t}-bomb", [(r * k, h * k)
                                              for r, h in prof], c,
                                Y, BOMB, segments=16))
    # The brass nose fuze with its arming vane.
    out.append(pk.lathe(f"{t}-fuze", [(0.009 * k, 0.074 * k),
                                      (0.009 * k, 0.088 * k),
                                      (0.006 * k, 0.092 * k),
                                      (0.0, 0.093 * k)],
                        c, Y, BRASS, segments=8, end="pole"))
    for j in range(2):
        a = j * math.pi + 0.4
        d = V(math.cos(a), 0, math.sin(a))
        m = pk.basis(d, Y, d.cross(Y), c + Y * 0.087 * k + d * 0.012 * k)
        out.append(pk.slab(f"{t}-vane{j}", [(-0.009 * k, -0.003),
                                            (0.009 * k, -0.003),
                                            (0.009 * k, 0.003),
                                            (-0.009 * k, 0.003)], 0.0012,
                           BRASS, m))
    # A drum tail: four fins and a ring.
    for j in range(4):
        a = j * math.pi / 2 + math.pi / 4
        d = V(math.cos(a), 0, math.sin(a))
        n = d.cross(Y)
        m = pk.basis(-Y, d, n, c - Y * 0.052 * k)
        out.append(pk.slab(f"{t}-bfin{j}",
                           [(x * k, y * k) for x, y in
                            [(0.0, 0.004), (0.045, 0.004), (0.045, 0.028),
                             (0.02, 0.028), (0.0, 0.016)]], 0.0022, BOMB, m))
    out.append(pk.lathe(f"{t}-bring", [(r * k, h * k) for r, h in
                                       [(0.027, -0.1), (0.029, -0.098),
                                        (0.029, -0.082), (0.027, -0.08),
                                        (0.025, -0.082), (0.025, -0.098),
                                        (0.027, -0.1)]],
                        c, Y, BOMB, segments=14, start=None))
    out.append(pk.lathe(f"{t}-bband", [(0.0305 * k, -0.008 * k),
                                       (0.0305 * k, 0.004 * k)],
                        c, Y, BRASS, segments=16))
    # The rack: a slim beam under the belly, two shackle lugs and bands
    # holding the bomb, and sway braces from the beam's ends.
    zb = station(0.0)[1]
    top = c.z + 0.0295 * k
    rack.append(pk.box(f"{t}-rack", (0.011, 0.094, 0.011),
                       V(0, 0.005, zb - 0.003), ALU))
    for sy in (-1, 1):
        yy = 0.005 + sy * 0.026
        rack.append(pk.box(f"{t}-lug{sy}", (0.006, 0.008, zb - 0.006 - top),
                           V(0, yy, (zb - 0.006 + top) / 2), IRON))
        out.append(pk.lathe(f"{t}-shackle{sy}",
                            [(0.0302 * k, -0.003), (0.0312 * k, 0.0),
                             (0.0302 * k, 0.003)],
                            c + Y * (yy - c.y), Y, BRASS, segments=14))
        a = V(0, 0.005 + sy * 0.045, zb - 0.006)
        for sx in (-1, 1):
            b = c + V(sx * 0.022 * k, sy * 0.045, 0.016 * k)
            rack.append(pk.wire(f"{t}-sway{sy}{sx}", a + X * sx * 0.005, b,
                                0.0016, ALU))
    return rack, out


# ------------------------------------------------------------- cockpit

# The pilot is a cartoon: a head and shoulders well above scale, so he
# reads from the game's high camera. `neck` is his body from the waist up
# (he leans into banks), `head` turns on it, his arms (`armL`/`armR` and
# `foreL`/`foreR`) rest on the cockpit rim and come up to cheer, and the
# silk scarf's tails (`cape`, drape cloth) stream from a knot at his nape.
CY = COCKPIT_Y
COCK_RX, COCK_RY = 0.064, 0.086
WAIST = V(0, CY - 0.012, 0.44)
NECK = V(0, CY - 0.008, 0.553)
HEAD_R = 0.043
HEAD_C = NECK + V(0, 0.006, 0.046)
KNOT = V(0, NECK.y - 0.03, 0.556)
SCARF_REST = math.radians(-84)
EYE_WHITE = "resin:" + kit.tint("pilot-eye", "#fff4de")
SILK = "drape:" + kit.tint("plane-linen", "#efe6cf")


def arm_points(sx):
    """Shoulder, elbow, wrist and fist of one arm at rest, the hands
    gripping the front of the rim."""
    s = V(sx * 0.058, CY - 0.012, 0.516)
    e = V(sx * 0.075, CY + 0.014, 0.484)
    w = V(sx * 0.05, CY + 0.064, 0.494)
    g = w + (w - e).normalized() * 0.014
    return s, e, w, g


def cockpit(t):
    """The cockpit opening and its padded rim (on the plane)."""
    out = []
    cy = CY
    rx, ry = COCK_RX, COCK_RY

    def surf(a, r):
        x = rx * r * math.cos(a)
        y = cy + ry * r * math.sin(a)
        p = V(x, y, deck_z(y, x))
        e = 0.004
        dzdx = (deck_z(y, x + e) - deck_z(y, x - e)) / (2 * e)
        dzdy = (deck_z(y + e, x) - deck_z(y - e, x)) / (2 * e)
        return p, V(-dzdx, -dzdy, 1).normalized()
    # The dark cockpit opening, then the leather-padded coaming round it.
    out.append(pk.decal(f"{t}-well", [(1.0, IRON)], surf, segments=20,
                        lift=0.0012, skirt=0.002))
    path = []
    for i in range(22):
        a = i / 22 * TAU
        p, n = surf(a, 1.05)
        path.append(p + n * 0.003)
    out.append(pk.tube(f"{t}-coaming", path, [(0.0072, 0.0058)] * 22,
                       LEATHER, n=6, closed_path=True, up=Z))
    return out


def pilot_body(t):
    """His leather coat from the waist up, a fleece collar and the
    scarf wrapped round his neck."""
    out = []
    yc = CY - 0.012
    angs = [(i + 0.5) / 18 * TAU for i in range(18)]
    rows = [(0.43, 0.05, 0.04, 2.4), (0.47, 0.055, 0.042, 2.6),
            (0.497, 0.062, 0.044, 2.9), (0.517, 0.065, 0.043, 3.1),
            (0.533, 0.058, 0.038, 2.8), (0.543, 0.042, 0.031, 2.4),
            (0.548, 0.024, 0.02, 2.0)]
    rings = []
    for z, ax_, ay_, pw in rows:
        rings.append([V(ax_ * spow(math.cos(a), 2 / pw),
                        yc + ay_ * spow(math.sin(a), 2 / pw), z)
                      for a in angs])
    out.append(pk.loft(f"{t}-coat", rings, LEATHER, start="flat",
                       end="pole"))
    # A zip placket and two pocket flaps down the front of the coat.
    zf = [(0.474, 0.0), (0.5, 0.0), (0.526, 0.0)]
    out.append(pk.tube(f"{t}-placket", [V(0.006, yc + 0.0455, z)
                                        for z, _ in zf],
                       [(0.0032, 0.0016)] * 3, WALNUT, n=4, up=Y))
    # A leather cross strap over the chest from his right shoulder, with
    # a brass buckle, so the coat reads as more than one brown lump.

    def front(x, z, off):
        ax_, ay_, pw = table(rows, z)
        f = min(0.999, abs(x) / ax_)
        return V(x, yc + ay_ * (1 - f ** pw) ** (1 / pw) + off, z)
    strap = [front(x, z, 0.0016) for x, z in
             ((0.052, 0.522), (0.027, 0.508), (0.0, 0.494), (-0.026, 0.48),
              (-0.046, 0.469))]
    out.append(pk.tube(f"{t}-strap", strap, [(0.0058, 0.0017)] * 5, WALNUT,
                       n=4, up=Y))
    out.append(pk.box(f"{t}-strapbuckle", (0.011, 0.004, 0.009),
                      front(0.013, 0.501, 0.0034), BRASS))
    # The fleece collar, turned up round the neck, and the scarf's wrap.
    out.append(pk.lathe(f"{t}-collar", [(0.027, -0.014), (0.037, -0.006),
                                        (0.04, 0.003), (0.036, 0.011),
                                        (0.028, 0.013)],
                        NECK, Z, CREAM, segments=18))
    out.append(pk.lathe(f"{t}-wrap", [(0.02, 0.006), (0.0245, 0.009),
                                      (0.025, 0.019), (0.02, 0.023)],
                        NECK, Z, CREAM, segments=14))
    return out


def pilot_arm(t, sx):
    """One arm: the sleeve from the shoulder to the elbow, then the
    forearm and the gauntlet glove, a fist with its thumb up."""
    s, e, w, g = arm_points(sx)
    upper = [pk.ball(f"{t}-shoulder{sx}", 0.0195, s, LEATHER,
                     scale=(1.0, 1.0, 0.95), seg=10, rings=6),
             pk.tube(f"{t}-sleeve{sx}", [s, s.lerp(e, 0.5), e],
                     [0.0172, 0.0165, 0.0158], LEATHER, n=8),
             pk.ball(f"{t}-elbow{sx}", 0.0158, e, LEATHER, seg=8, rings=5)]
    d = (w - e).normalized()
    fore = [pk.tube(f"{t}-forearm{sx}", [e, e.lerp(w, 0.55), w - d * 0.006],
                    [0.0155, 0.015, 0.0145], LEATHER, n=8),
            # The gauntlet's flared cuff, then the fist.
            pk.lathe(f"{t}-cuff{sx}", [(0.0158, -0.016), (0.0185, -0.012),
                                       (0.0178, -0.002), (0.015, 0.0)],
                     w, d, WALNUT, segments=10),
            pk.ball(f"{t}-fist{sx}", 0.0158, g, WALNUT,
                    scale=(1.05, 1.15, 0.92), seg=10, rings=6),
            pk.tube(f"{t}-thumb{sx}", [g + V(-sx * 0.004, 0.004, 0.008),
                                       g + V(-sx * 0.005, 0.007, 0.022)],
                    [0.0062, 0.0056], WALNUT, n=6, caps=("flat", "pole"))]
    return upper, fore, s, e


def scarf_tails(t):
    """The scarf's two tails, built hanging straight down from the knot
    (their width across x, thickness along y) and turned back to stream
    behind him by the joint's rest turn; the game ripples them."""
    out = []
    k = KNOT
    out.append(pk.ball(f"{t}-knot", 0.0135, k + V(0.004, 0.002, -0.004),
                       CREAM, scale=(1.35, 0.85, 1.0), seg=10, rings=6))
    for j, (length, w0, w1, drift, dy) in enumerate(
            ((0.31, 0.056, 0.038, 0.045, 0.0), (0.2, 0.044, 0.03, 0.02,
                                                0.006))):
        rings = []
        n = 13
        for i in range(n):
            f = i / (n - 1)
            z = -0.006 - f * length
            x = drift * f ** 1.3 + 0.005 * math.sin(f * 7 + j)
            y = dy + 0.005 * math.sin(f * 9 + 1.3 * j)
            w = lerp(w0, w1, f ** 1.2)
            h = 0.0024
            # A twist down its length, so it shows its face from the side
            # as well as from above.
            roll = f * (0.3 + 0.75 * math.sin(f * 4.2 + j * 2.4))
            cx = V(math.cos(roll), math.sin(roll), 0)
            cyv = V(-math.sin(roll), math.cos(roll), 0)
            p = k + V(x, y, z)
            rings.append([p + cx * w / 2, p + cx * w / 6 + cyv * h,
                          p - cx * w / 6 + cyv * h, p - cx * w / 2,
                          p - cx * w / 6 - cyv * h, p + cx * w / 6 - cyv * h])
        out.append(pk.loft(f"{t}-scarf{j}", rings, SILK, start="flat",
                           end="flat"))
    return out


def head_dir(axis, fwd, side, phi_deg, a_deg):
    phi, a = math.radians(phi_deg), math.radians(a_deg)
    return axis * math.cos(phi) + math.sin(phi) * (
        fwd * math.cos(a) + side * math.sin(a))


def pilot_head(t):
    out = []
    c = HEAD_C
    R = HEAD_R
    q = R / 0.026
    out.append(pk.tube(f"{t}-neck", [NECK + V(0, 0, -0.01), c - Z * 0.02],
                       [0.0175, 0.017], SKIN, n=10))
    out.append(pk.ball(f"{t}-face", R, c + V(0, 0.002, -0.002), SKIN,
                       scale=(0.94, 0.98, 1.05), seg=18, rings=10))
    # A big round cartoon nose and a strong chin.
    out.append(pk.ball(f"{t}-nose", 0.0105, c + V(0, R * 0.96, -0.007),
                       SKIN, scale=(0.95, 0.85, 1.0), seg=10, rings=6))
    out.append(pk.ball(f"{t}-chin", 0.02, c + V(0, R * 0.62, -R * 0.72),
                       SKIN, scale=(1.1, 0.8, 0.75), seg=10, rings=6))
    # The leather helmet: a cap about a crown tilted a little back, cut
    # round the face, its ear flaps reaching down past the jaw.
    axis = V(0, -0.2, 1).normalized()
    fwd = (Y - axis * Y.dot(axis)).normalized()
    side = fwd.cross(axis)
    RH = R * 1.1
    edge = [(0, 56), (24, 62), (44, 86), (60, 122), (80, 128), (98, 112),
            (130, 104), (180, 110)]
    angs = [(i + 0.5) / 22 * 360 for i in range(22)]
    rows = [0.22, 0.44, 0.64, 0.82, 0.94, 1.0]
    rings = []
    for f in rows:
        ring = []
        for adeg in angs:
            aa = adeg if adeg <= 180 else 360 - adeg
            d = head_dir(axis, fwd, side, table(edge, aa)[0] * f, adeg)
            ring.append(c + d * RH * (1.0 - 0.05 * max(0.0, f - 0.85)))
        rings.append(ring)
    cap = pk.loft(f"{t}-helmet", list(reversed(rings)), LEATHER,
                  end=c + axis * RH, recalc=False)
    pk.orient(cap, lambda p: p - c)
    out.append(cap)
    # A rolled leather rim round the face and flaps, and the crown seam.
    rim = rings[-1]
    out.append(pk.tube(f"{t}-rim", [p + (p - c).normalized() * 0.0008
                                     for p in rim],
                       [(0.0034, 0.0034)] * len(rim), LEATHER, n=5,
                       closed_path=True, up=axis))
    seam = [c + head_dir(axis, fwd, side, -56 + k * 150 / 8, 0) *
            (RH + 0.0012) for k in range(9)]
    out.append(pk.tube(f"{t}-crown", seam, [(0.0032, 0.0022)] * 9,
                       LEATHER, n=4, up=side))
    # Chin strap under the jaw between the flaps, with a brass buckle.
    ends = [c + head_dir(axis, fwd, side, 124, 80 * s) * RH for s in (-1, 1)]
    mid = c + V(0, R * 0.5, -R * 1.05)
    strap = [ends[0], ends[0].lerp(mid, 0.5) + V(0, 0, -0.003), mid,
             ends[1].lerp(mid, 0.5) + V(0, 0, -0.003), ends[1]]
    out.append(pk.tube(f"{t}-chinstrap", strap, [(0.0045, 0.0018)] * 5,
                       LEATHER, n=4, up=V(0, 1, 0)))
    out.append(pk.box(f"{t}-buckle", (0.009, 0.004, 0.007),
                      ends[1].lerp(mid, 0.55) + V(0, 0.001, -0.002), BRASS))
    # Goggles parked on the forehead: chunky brass rims round glass, a
    # bridge over the nose, and a strap running back over the ear flaps.
    lens = []
    for s in (-1, 1):
        d = head_dir(axis, fwd, side, 40, 29 * s)
        at = c + d * (RH * 0.93)
        lens.append((at, d))
        out.append(pk.lathe(f"{t}-goggle{s}",
                            [(r * q, h * q) for r, h in
                             [(0.0072, -0.001), (0.0084, 0.0028),
                              (0.0084, 0.0048), (0.0068, 0.0054),
                              (0.006, 0.0036)]],
                            at, d, BRASS, segments=14))
        out.append(pk.lathe(f"{t}-lens{s}", [(0.0061 * q, 0.0036 * q),
                                             (0.0038 * q, 0.0044 * q),
                                             (0.0, 0.0047 * q)],
                            at, d, ALU, segments=14, end="pole"))
    (a0, d0), (a1, d1) = lens
    mid = c + head_dir(axis, fwd, side, 40, 0) * (RH * 0.93 + 0.0075 * q)
    out.append(pk.tube(f"{t}-bridge", [a0.lerp(a1, 0.3) + d0 * 0.006, mid,
                                       a0.lerp(a1, 0.7) + d1 * 0.006],
                       [0.0024] * 3, BRASS, n=5))
    strap = []
    for k in range(17):
        a = 44 + k * (360 - 88) / 16
        phi = 40 - 12 * ((1 - math.cos(math.radians(a))) / 2)
        strap.append(c + head_dir(axis, fwd, side, phi, a) * (RH + 0.0016))
    out.append(pk.tube(f"{t}-gstrap", strap, [(0.0016, 0.0058)] * 17,
                       WALNUT, n=4, up=axis))
    # Eyes under heavy, determined brows; a gritted grin.
    face_y = R * 0.98

    def on_face(x, z, lift=0.0):
        rr = R * 0.97
        yy = math.sqrt(max(0.0, rr * rr - x * x - (z / 1.05) ** 2))
        return c + V(x, min(yy, face_y) + lift, z)
    for sx in (-1, 1):
        at = on_face(sx * 0.0165, 0.004, -0.004)
        out.append(pk.ball(f"{t}-eye-white{sx}", 0.0112, at, EYE_WHITE,
                           scale=(0.9, 0.5, 0.95), seg=12, rings=6))
        out.append(pk.ball(f"{t}-pupil{sx}", 0.0058,
                           at + V(-sx * 0.0012, 0.0045, -0.0006), WALNUT,
                           scale=(0.85, 0.5, 1.0), seg=10, rings=5))
        b0 = on_face(sx * 0.0055, 0.0145, 0.0015)
        b1 = on_face(sx * 0.0275, 0.0215, 0.0)
        out.append(pk.tube(f"{t}-brow{sx}", [b0, b0.lerp(b1, 0.5)
                                              + V(0, 0, 0.002), b1],
                           [(0.0042, 0.003)] * 3, WALNUT, n=5,
                           caps=("pole", "pole")))
    teeth = on_face(0.003, -0.021, -0.003)
    out.append(pk.ball(f"{t}-teeth", 0.0118, teeth, EYE_WHITE,
                       scale=(1.45, 0.42, 0.52), seg=12, rings=6))
    lip = [on_face(x, z, 0.0005) for x, z in
           ((-0.0145, -0.0175), (0.003, -0.0265), (0.0195, -0.0155))]
    out.append(pk.tube(f"{t}-grin", lip, [0.0019] * 3, WALNUT, n=5,
                       caps=("pole", "pole")))
    return out


# ------------------------------------------------------------- propeller

def propeller(t):
    hub = V(0, PROP_Y, NOSE.z)
    out = []
    out.append(pk.tube(f"{t}-shaft", [hub - Y * 0.045, hub - Y * 0.015],
                       [0.009, 0.009], ALU, n=8, up=Z))
    # A polished spinner over the hub, the blades coming out of its sides,
    # on a brass backing ring.
    out.append(pk.lathe(f"{t}-spinner", [(0.0405, -0.019), (0.0418, -0.006),
                                         (0.041, 0.008), (0.037, 0.024),
                                         (0.03, 0.04), (0.021, 0.054),
                                         (0.011, 0.065), (0.0, 0.07)],
                        hub, Y, ALU, segments=20, end="pole"))
    out.append(pk.lathe(f"{t}-backing", [(0.036, -0.026), (0.0435, -0.024),
                                         (0.0445, -0.019), (0.0405, -0.017)],
                        hub, Y, BRASS, segments=20, end="pole"))
    # The laminated blades: dark glue lines between the plies run along
    # each blade, brass sheathing on the tips.
    us = [-0.5, -0.36, -0.3, -0.12, -0.06, 0.06, 0.12, 0.3, 0.36, 0.5]
    dark = {1, 4, 7}

    def v_of(u):
        return 0.5 * math.sqrt(max(0.0, 1 - (2 * u) ** 2)) ** 0.8

    blade = [(0.022, 0.03, 0.02, 48), (0.055, 0.039, 0.016, 40),
             (0.1, 0.052, 0.0125, 30), (0.15, 0.06, 0.0105, 24),
             (0.2, 0.062, 0.0092, 19), (0.24, 0.054, 0.008, 16),
             (0.255, 0.045, 0.0072, 15), (0.266, 0.032, 0.0065, 15),
             (0.273, 0.015, 0.0055, 15)]
    ring_pts = [(u, v_of(u)) for u in us] + \
        [(u, -v_of(u) * 0.55) for u in reversed(us[1:-1])]
    front_n = len(us)
    for k in range(2):
        a = math.radians(90 + 180 * k + 20)
        er = V(math.cos(a), 0, math.sin(a))
        et = Y.cross(er)
        rings = []
        for rr, ch, th, pitch in blade:
            p = math.radians(pitch)
            chord = et * math.cos(p) + Y * math.sin(p)
            thick = -et * math.sin(p) + Y * math.cos(p)
            centre = hub + er * rr
            rings.append([centre + chord * u * ch + thick * v * th * 2
                          for u, v in ring_pts])
        n = len(ring_pts)

        def fm(i, j):
            if isinstance(i, tuple):
                return WOOD
            if blade[i][0] >= 0.238:
                return BRASS
            if j < front_n - 1:
                return WALNUT if j in dark else WOOD
            jj = n - 1 - j
            return WALNUT if (jj - 0) in dark else WOOD
        out.append(pk.loft(f"{t}-blade{k}", rings, WOOD, face_mat=fm,
                           start=None, end="pole"))
    return out, hub


# ------------------------------------------------------------- build

def build(root_name="drake"):
    t = root_name
    root = kit.empty(t)
    shift = Matrix.Translation(V(0, -COM.y, 0))

    def moved(objs):
        for o in objs:
            kit.apply(o)
            kit.apply_transform(o)
            o.data.transform(shift)
        return objs

    wing_fixed, ailerons = wings(t)
    tail_fixed, elevators, rudder = tail(t)
    gear_fixed, wheels = gear(t)
    rack, bomb_ = bomb(t)
    pieces = (fuselage(t) + cowling(t) + wing_fixed + struts(t)
              + rigging(t) + tail_fixed + gear_fixed + rack + cockpit(t))
    report = {} if __import__("os").environ.get("DRAKE_DEBUG") else None

    def part(name, objs, pivot, par):
        if name == "head":
            return face_rig.head(pk.part, t, moved(objs), shift @ pivot, par, report=report)
        return pk.part(t, name, moved(objs), shift @ pivot, par,
                       report=report)
    plane = part("torso", pieces, COM, root)
    for sx, name in ((-1, "wingL"), (1, "wingR")):
        part(name, ailerons[sx], aileron_pivot(sx), plane)
    part("tail", elevators, elevator_pivot(), plane)
    part("extra", rudder, RUDDER_AT, plane)
    part("wheels", wheels, AXLE, plane)
    part("weapon", bomb_, BOMB_AT, plane)
    # The pilot: his body from the waist, then his head, arms and scarf.
    pilot = part("neck", pilot_body(t), WAIST, plane)
    part("head", pilot_head(t), NECK, pilot)
    for sx, side in ((-1, "L"), (1, "R")):
        upper, fore, s, e = pilot_arm(t, sx)
        arm = part(f"arm{side}", upper, s, pilot)
        part(f"fore{side}", fore, e, arm)
    scarf = part("cape", scarf_tails(t), KNOT, pilot)
    kit.drape(scarf)
    scarf.rotation_euler.x = SCARF_REST
    blades, hub = propeller(t)
    part("spin", blades, hub, plane)
    drop = kit.empty(f"{t}.bomb", shift @ BOMB_AT)
    kit.parent(drop, plane)
    if report:
        for k, v in sorted(report.items(), key=lambda kv: -kv[1]):
            print(f"  DRAKE {k:14s} {v:6d}")
    return root
