"""Shared cartoon tower shells: broad dressed limestone, team-colour coping and banners.
Original Arena designs; retain the original guard/cannon anchors and 0.7 scale.
No tiny masonry. Bevels and baked AO carry detail; big readable pieces give
each tower character (1 October 2026): chunky corner quoins, gold finials,
a team banner hanging down the back, a flag on a pole at each side (both
waving in the game's wind: their second uv set, "Wave", says how free each
point of the cloth is), and on the king a tiled roof, a chimney, an oak door
and lit keep windows.
"""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kit
import bmesh

kit.reset(seed=28)
STONE = 'resin:' + kit.tint('cartoon-limestone', '#efd9b5')
TRIM = 'resin:' + kit.tint('cartoon-trim', '#c2a77f')
SHADOW = 'resin:' + kit.tint('cartoon-recess', '#514d48')
TEAM = 'lacquer:team'
ROOF = 'resin:' + kit.tint('cartoon-terracotta', '#ce8167')
GOLD = 'gilt:' + kit.tint('cartoon-gold', '#dfb251')
QUOIN = 'resin:' + kit.tint('cartoon-quoin', '#e2c596')
OAK = 'resin:' + kit.tint('cartoon-oak', '#8f6040')
IRON = 'resin:' + kit.tint('cartoon-iron', '#4d4a48')
WINDOW = 'resin:' + kit.tint('cartoon-window', '#ffd47e')
ROOF_DARK = 'resin:' + kit.tint('cartoon-terracotta-dark', '#b9694f')
# Cloth that waves in the game (materials.ts, 'flag').
FLAG = 'flag:team'
FLAG_GOLD = 'flag:' + kit.tint('cartoon-flag-gold', '#efc35a')


def block(root, name, size, at, mat, bevel=0.09, lean=False):
    """A softly bevelled block; `lean` ones (small trim repeated many
    times) keep few vertices."""
    o = kit.box(name, size, at, mat, bevel=bevel, segments=2 if lean else 5,
                grid=not lean)
    kit.apply(o)
    kit.shade(o)
    kit.parent(o, root)
    return o


def shell(root, name, width, profile, mat, power=5):
    """One continuous rounded-square surface, with a sculpted foot and lip.
    Dense rings supply smooth normals and real baked occlusion without seams.
    """
    bm = bmesh.new()
    rings = []
    n = 64
    for z, factor in profile:
        ring = []
        for i in range(n):
            a = i / n * math.tau
            x, y = math.cos(a), math.sin(a)
            r = width * factor / 2
            ring.append(bm.verts.new((r * math.copysign(abs(x)**(2/power), x),
                                      r * math.copysign(abs(y)**(2/power), y), z)))
        rings.append(ring)
    for lo, hi in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = kit._from_bmesh(name, bm, mat)
    kit.shade(obj)
    kit.parent(obj, root)
    return obj


def profile_at(profile, z):
    """The shell's width factor at a height (linear between its rings)."""
    for (z0, f0), (z1, f1) in zip(profile, profile[1:]):
        if z0 <= z <= z1:
            return f0 + (f1 - f0) * (z - z0) / max(1e-6, z1 - z0)
    return profile[-1][1]


def cloth(root, name, mat, at, free, cols, rows, phase, tile=0.7):
    """A sheet of cloth from a grid: `at(u, v)` places each point, `free(u,
    v)` says how far it may wave (0 fixed, 1 free). UVMap carries the cloth
    tile, Wave the freedom (x) and a phase (y) so flags never flap in step."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    wave = bm.loops.layers.uv.new('Wave')
    grid = [[bm.verts.new(at(u, v)) for u in cols] for v in rows]
    coords = {}
    for j, v in enumerate(rows):
        for i, u in enumerate(cols):
            coords[grid[j][i]] = (u, v)
    for j in range(len(rows) - 1):
        for i in range(len(cols) - 1):
            f = bm.faces.new((grid[j][i], grid[j + 1][i], grid[j + 1][i + 1],
                              grid[j][i + 1]))
            for loop in f.loops:
                u, v = coords[loop.vert]
                c = loop.vert.co
                loop[uv].uv = ((c.x + c.y) / tile, c.z / tile)
                loop[wave].uv = (free(u, v), phase)
    obj = kit._from_bmesh(name, bm, mat)
    kit.shade(obj, 80)
    kit.parent(obj, root)
    return obj


def side_banner(root, side, w, deck, phase):
    """A narrow team pennant hanging from a short gold arm on a side wall,
    over one of its ribbons; it stays inside the tower's size envelope."""
    x = side * (w * 0.5 + 0.06)
    y = -w * 0.27
    top = deck - 0.3
    arm = kit.cylinder('pennant-arm', .03, .03, .2, (side * (w * .5 - .1), y, top + .02),
                       verts=8, mat=GOLD)
    arm.rotation_euler.y = side * math.pi / 2
    kit.parent(arm, root)
    width, length = 0.42, 0.85

    def at(u, v):
        tail = 0.28 * (1 - abs(2 * u - 1)) if v >= 1 else 0
        bulge = 0.02 * math.sin(v * math.pi)
        return (x + side * bulge, y + (u - 0.5) * width,
                top - v * length + tail * length)
    cloth(root, 'side-pennant', FLAG, at, lambda u, v: v,
          [0, .5, 1], [0, .2, .4, .6, .8, 1], phase)


def corner_flag(root, sx, w, deck, phase):
    """A flag on a gold pole rising from a rear corner merlon, flying
    along the side (beside the guard, never across the deck)."""
    c = w * 0.405
    base = deck + 0.47
    pole = kit.cylinder('flag-pole', .04, .035, 0.98, (sx * c, -c, base),
                        verts=10, mat=GOLD)
    kit.parent(pole, root)
    kit.parent(kit.sphere('flag-finial', .07, (sx * c, -c, base + 1.0),
                          mat=GOLD, segments=12, rings=8), root)
    top, length, height = base + 0.93, 0.62, 0.38

    def at(u, v):
        # Swallowtail: the free edge is cut back towards the middle.
        cut = 0.24 * (1 - abs(2 * v - 1)) * u ** 4
        reach = length * u * (1 - cut)
        curl = 0.05 * math.sin(u * math.pi * 1.2) + 0.015 * math.sin(v * 5)
        return (sx * (c - curl), -c + reach, top - v * height * (1 - 0.1 * u))
    cloth(root, 'corner-flag', FLAG, at, lambda u, v: u,
          [0, .12, .25, .4, .55, .7, .85, 1], [0, .33, .66, 1], phase)


def back_banner(root, w, deck, width, length, phase):
    """A long team banner hanging from a gold rod down the back wall, with
    a gold crown; its foot sways, its top is fixed."""
    y = -(w * 0.478)
    top = deck - 0.3
    rod = kit.cylinder('banner-rod', .035, .035, width + .24,
                       (-(width + .24) / 2, y - .01, top + .02), verts=10,
                       mat=GOLD)
    rod.rotation_euler.y = math.pi / 2
    kit.parent(rod, root)
    for sx in (-1, 1):
        kit.parent(kit.sphere('banner-knob', .06,
                              (sx * (width / 2 + .13), y - .01, top + .02),
                              mat=GOLD, segments=10, rings=6), root)

    def at(u, v):
        tail = 0.2 * (1 - abs(2 * u - 1)) if v >= 1 else 0
        z = top - v * length + tail * length
        bulge = 0.025 * math.sin(v * math.pi) - 0.02 * v
        return ((u - 0.5) * width, y - bulge, z)
    cloth(root, 'back-banner', FLAG, at, lambda u, v: v,
          [0, .25, .5, .75, 1], [0, .15, .3, .45, .6, .75, .9, 1], phase)
    # A gold crown on the cloth, just proud of it, waving with it.
    pts = [(-.5, 0), (.5, 0), (.5, .55), (.62, 1), (.28, .62), (0, 1.12),
           (-.28, .62), (-.62, 1), (-.5, .55)]
    s = width * 0.28
    vc = 0.5
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    wave = bm.loops.layers.uv.new('Wave')
    verts = []
    for px, pz in pts:
        z = top - vc * length + pz * s - .25 * s
        v = (top - z) / length
        bulge = 0.025 * math.sin(v * math.pi) - 0.02 * v
        verts.append((bm.verts.new((px * s, y - bulge - .012, z)), v))
    f = bm.faces.new([vv for vv, _ in reversed(verts)])
    for loop in f.loops:
        v = next(vv for x, vv in verts if x is loop.vert)
        loop[uv].uv = (loop.vert.co.x, loop.vert.co.z)
        loop[wave].uv = (v, phase)
    bmesh.ops.triangulate(bm, faces=[f], ngon_method='EAR_CLIP')
    crest = kit._from_bmesh('banner-crown', bm, FLAG_GOLD)
    kit.parent(crest, root)


def quoins(root, w, profile, top):
    """Chunky dressed stones up each rounded corner, long and short in
    turn, a shade warmer than the wall."""
    z = 0.12
    k = 0
    while z < top - 0.3:
        tall = 0.3 if k % 2 == 0 else 0.24
        long = 0.5 if k % 2 == 0 else 0.34
        zc = z + tall / 2
        r = w * profile_at(profile, zc) / 2
        # The superellipse corner (power 5) sits at 0.87 of the radius.
        c = r * 0.5 ** 0.2 + 0.01
        for sx in (-1, 1):
            for sy in (-1, 1):
                q = block(root, 'quoin', (long, .13, tall - .035),
                          (sx * c, sy * c, zc), QUOIN, .045, lean=True)
                q.rotation_euler.z = math.atan2(sy, sx) + math.pi / 2
        z += tall
        k += 1


def badge(root, width, front, height):
    # A five-sided heraldic shield, softly bevelled with one raised gold crest.
    outline = [(-width/2, .45), (width/2, .45), (width/2, -.12),
               (0, -.52), (-width/2, -.12)]
    bm = bmesh.new()
    rings = [[bm.verts.new((x, front+d, height+z)) for x,z in outline]
             for d in (0, .10)]
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[1])
    for i in range(5):
        j=(i+1)%5
        bm.faces.new((rings[0][i],rings[0][j],rings[1][j],rings[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    shield=kit._from_bmesh('shield',bm,TEAM)
    kit.add_bevel(shield,.045,4)
    kit.parent(shield,root)
    crest = block(root, 'crest', (width*.29,.065,width*.29),
                  (0,front+.135,height+.04),GOLD,.04)
    crest.rotation_euler.y=math.pi/4


def stripe(root, width, angle, offset, gold=False):
    """A painted vertical ribbon follows the tapered wall, never a new tier."""
    bm=bmesh.new()
    rows=[]
    for z,f in ((.48,.98),(.8,.95),(1.2,.93),(1.6,.915),(2.0,.91),(2.38,.92)):
        half=.035 if gold else .105
        r=width*f/2
        rows.append([bm.verts.new((offset+x,r*(1-(abs(offset+x)/r)**5)**.2+.012,z))
                     for x in (-half+i*half/3 for i in range(7))])
    for lo,hi in zip(rows,rows[1:]):
        for i in range(6):
            bm.faces.new((lo[i+1],lo[i],hi[i],hi[i+1]))
    obj=kit._from_bmesh('gold-pinstripe' if gold else 'team-ribbon',bm,GOLD if gold else TEAM)
    obj.rotation_euler.z=angle
    kit.parent(obj,root)


def rear_badge(root,width):
    back=kit.empty('rear-heraldry')
    badge(back,.82,width*.465,1.63)
    back.rotation_euler.z=math.pi
    kit.parent(back,root)


def roof_courses(base, top, f0, f1, rows):
    """A hipped roof's profile in tile courses: each row of tiles ends in
    a lip over the row below."""
    out = [(base, 1), (base + .06, 1.03), (base + .14, 1)]
    z0 = base + .14
    for k in range(rows):
        za = z0 + (top - z0) * k / rows
        zb = z0 + (top - z0) * (k + 1) / rows
        fa = f0 + (f1 - f0) * k / rows
        fb = f0 + (f1 - f0) * (k + 1) / rows
        out += [(za + .01, fa + .032), (zb - .025, fb + .014), (zb, fb)]
    return out


def tower(kind):
    r = kit.empty(kind)
    king = kind == 'king'
    w = 3.55 if king else 2.7
    deck = 3.2 if king else 2.9
    profile = [(0,.99),(.06,1.015),(.16,1.02),(.30,1.01),(.48,.98),
               (.8,.95),(1.2,.93),(1.6,.915),(2.0,.91),
               (deck-.48,.92),(deck-.32,.94),(deck-.22,1.015),
               (deck-.13,1.04),(deck-.04,1.035),(deck,1.01)]
    shell(r, 'continuous-stone-shell', w, profile, STONE)
    quoins(r, w, profile, deck - .32)
    # A single rim with rounded corner battlements. No projecting body courses.
    for side in (-1,1):
        block(r,'parapet-front',(w*.73,.23,.30),
              (0,side*w*.45,deck+.09),TEAM,.10)
        block(r,'parapet-side',(.23,w*.73,.30),
              (side*w*.45,0,deck+.09),TEAM,.10)
    block(r,'inset-deck',(w*.78,w*.78,.08),(0,0,deck-.02),TRIM,.08)
    for x in (-1,1):
        for y in (-1,1):
            block(r,'corner-crown',(.55,.55,.55),
                  (x*w*.405,y*w*.405,deck+.20),TEAM,.13)
            kit.parent(kit.sphere('crown-finial',.085,
                                  (x*w*.405,y*w*.405,deck+.54),mat=GOLD,
                                  segments=12,rings=8),r)
    badge(r,1.05 if king else .86,w*.465,1.63)
    # The back carries a hanging banner in place of a second shield.
    back_banner(r, w, deck, 1.0 if king else .84, 1.3 if king else 1.12,
                .37 if king else .61)
    for side, phase in ((-1, .13), (1, .79)):
        side_banner(r, side, w, deck, phase + (.2 if king else 0))
        corner_flag(r, side, w, deck, phase + .41)
    for angle in (math.pi/2,math.pi,math.pi*1.5):
        for sign in (-1,1):
            stripe(r,w,angle,sign*w*.27)
            if king:
                stripe(r,w,angle,sign*w*.33,True)
    # Tall, softly recessed side arrow slits give scale, without noisy brickwork.
    for side in (-1,1):
        block(r,'side-recess',(.028,.26,.68),(side*w*.463,0,1.56),SHADOW,.012)
        block(r,'side-sill',(.055,.32,.075),(side*w*.474,0,1.23),TRIM,.025)
    if king:
        # A broad hipped terracotta roof nested into the rear of the platform.
        rear=shell(r,'rear-keep',1.85,[(3.05,1),(3.38,1),(3.74,.94)],STONE)
        rear.location.y=-.72
        roof=shell(r,'hipped-roof',2.15,
                   roof_courses(3.68,4.48,1,.15,6)+[(4.51,.11)],ROOF,power=4)
        roof.scale.y=.64
        roof.location.y=-.72
        # A darker ridge cap and a stone chimney (the game puffs smoke from
        # its top, the 'chimney-smoke' empty).
        ridge=block(r,'roof-ridge',(.36,.16,.07),(0,-.72,4.5),ROOF_DARK,.03)
        chim=block(r,'chimney',(.26,.26,.52),(.32,-.95,4.32),STONE,.05)
        block(r,'chimney-cap',(.34,.34,.08),(.32,-.95,4.6),TRIM,.03)
        kit.empty('chimney-smoke',(.32,-.95,4.68),r)
        # Two warm lit windows in the keep, and an oak door at the foot.
        # The keep's back wall rises just above the parapet.
        for sx in (-1,1):
            block(r,'keep-window',(.2,.05,.2),(sx*.45,-1.655,3.59),WINDOW,.04)
            block(r,'keep-sill',(.28,.08,.04),(sx*.45,-1.665,3.48),TRIM,.015)
        door_y=-(w*.5*.985)
        door=block(r,'door',(.72,.1,.95),(0,door_y,.47),OAK,.03)
        arch=kit.cylinder('door-arch',.36,.36,.08,(0,door_y+.04,.95),verts=24,
                          mat=OAK)
        arch.rotation_euler.x=math.pi/2
        kit.parent(arch,r)
        for z in (.25,.7):
            block(r,'door-band',(.76,.1,.06),(0,door_y-.005,z),IRON,.015)
        block(r,'door-step',(.95,.3,.1),(0,door_y-.1,.05),TRIM,.03)
        block(r,'roof-finial',(.15,.15,.20),(0,-.72,4.53),GOLD,.06)
        # A royal crest at the rear, a small ridge pennant and two corner
        # lanterns distinguish the keep without enlarging its footprint.
        for side in (-1,1):
            block(r,'rear-lantern-frame',(.23,.15,.38),(side*.72,-w*.468,2.20),GOLD,.05)
            block(r,'rear-lantern-glass',(.13,.025,.23),(side*.72,-w*.494,2.20),
                  'resin:'+kit.tint('cartoon-lantern','#ffe4a0'),.035)
        crown=kit.empty('royal-crown')
        block(crown,'crown-band',(.59,.07,.13),(0,w*.50,1.8),GOLD,.025)
        for x,z in ((-.23,2.00),(0,2.10),(.23,2.00)):
            tooth=block(crown,'crown-point',(.15,.07,.26),(x,w*.50,z),GOLD,.035)
        kit.parent(crown,r)
        pole=kit.cylinder('pennant-pole',.035,.035,.72,(0,-.72,4.5),verts=12,mat=GOLD)
        kit.parent(pole,r)

        def pennant(u, v):
            cut = .3 * (1 - abs(2 * v - 1)) * u ** 3
            return (.62 * u * (1 - cut), -.72 + .05 * math.sin(u * 3.4),
                    5.2 - v * .3 * (1 - .4 * u))
        cloth(r, 'roof-pennant', FLAG, pennant, lambda u, v: u,
              [0, .15, .3, .5, .7, .85, 1], [0, .5, 1], .5)
    return r


def wall():
    root = kit.empty('wall')
    block(root, 'wall-body', (2.0, 0.46, 0.35), (0, 0, 0.175), STONE, 0.08)
    block(root, 'wall-cap', (2.0, 0.54, 0.14), (0, 0, 0.40), TRIM, 0.055)
    return root


def bridge(name, timber=False):
    root = kit.empty(name)
    deck_mat = ('resin:' + kit.tint('cartoon-timber', '#c79869')) if timber else STONE
    # The nine broad deck sections follow the engine's existing walk height.
    count = 9
    step = 3.9 / count
    for i in range(count):
        y = -1.95 + step * (i + 0.5)
        z = 0.42 + 0.28 * (1 - (y / 1.95) ** 2)
        deck = block(root, 'deck', (2.4, step + 0.025, 0.18),
                     (0, y, z - 0.09), deck_mat, 0.018)
        deck.rotation_euler.x = math.atan(-0.56 * y / 1.95 ** 2)
    # Low, solid side rails: a clean continuous silhouette, no small masonry.
    for x in (-1.24, 1.24):
        rail = kit.tube('bridge-rail',
                        [(x, y, 0.72 + 0.28 * (1 - (y / 1.95) ** 2))
                         for y in (-1.95, -1.3, -0.65, 0, 0.65, 1.3, 1.95)],
                        0.09, TRIM if not timber else deck_mat, segments=8)
        kit.parent(rail, root)
        for y in (-1.85, 1.85):
            block(root, 'bridge-post', (0.25, 0.25, 0.65),
                  (x, y, 0.57), TRIM, 0.04)
    return root


def river():
    root = kit.empty('river')
    for y in (-1.24, 1.24):
        # Broad stone banks break at the bridges, where the deck joins them.
        for lo, hi in ((-9.5, -6.8), (-4.2, 4.2), (6.8, 9.5)):
            block(root, 'river-bank', (hi - lo, 0.32, 0.25),
                  ((lo + hi) / 2, y, 0.02), STONE, 0.08)
    return root


roots = [tower('king'), tower('princess'), wall(), bridge('bridge'),
         bridge('bridge-b', True), river()]
meshes = [o for r in roots for o in kit.descendants(r) if o.type == 'MESH']
# Separate during AO so individual assets never shadow one another.
for i, root in enumerate(roots):
    root.location.x = i * 24
kit.bake_ao(meshes, samples=128, distance=0.35)
for root in roots:
    root.location.x = 0
kit.export(roots, kit.out_path())
if os.environ.get('ARENA_TOWER_PREVIEW'):
    # Hide the scenery roots for a focused building review.
    for root in roots[2:]:
        for obj in kit.descendants(root):
            obj.hide_render = True
    roots[0].location.x=-2.4
    roots[1].location.x=2.4
    kit.refresh()
    kit.preview(os.environ['ARENA_TOWER_PREVIEW'], roots[:2], size=1200,
                elevation=35, azimuth=155, margin=1.04)
