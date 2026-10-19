"""Low, layered gritstone outcrops for Rota's Ridge, 17 October 2026.

Blender -b --factory-startup --python assets/rota/blender/ridges.py -- \
    work/rota-rework/new-ridges.glb \
    docs/concepts/2026-10-17-rota-rework/ridge-previews

See the preserved brief in docs/concepts/2026-10-17-rota-rework/ridges.md.
One square = 25 m = one Blender metre; Z up, open bore along Y.
"""
import json
import math
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import rkit
import bpy
from mathutils import Vector
import building_kit as K
import works_kit as W

kit = rkit.kit

for name, colour in {
    'ridge-grit': '#948b79', 'ridge-bed': '#766e5e',
    'ridge-fresh': '#afa18b', 'ridge-shadow': '#625d53',
    'ridge-earth': '#70644d', 'ridge-grass': '#777c55',
    'ridge-heather': '#817269', 'ridge-heather-tip': '#99847f',
    'ridge-portal': '#b3a38a', 'ridge-portal-dim': '#978a74',
    'ridge-lining': '#514e47',
}.items():
    kit.tint(name, colour)

GRIT = 'rock:ridge-grit'
BED = 'rock:ridge-bed'
FRESH = 'rock:ridge-fresh'
SHADOW = 'rock:ridge-shadow'
EARTH = 'field:ridge-earth'
GRASS = 'grass:ridge-grass'
HEATHER = 'foliage:ridge-heather'
TIPS = 'foliage:ridge-heather-tip'
PORTAL = 'stone:ridge-portal'
PORTAL_DIM = 'stone:ridge-portal-dim'
LINING = 'stone:ridge-lining'


def portal(B, y, inward):
    """Separate wedge stones follow the actual arch, with no flat wall top."""
    half, spring, rise = .18, .14, .10
    depth = .028
    front = y
    rear = y + inward * depth
    for i in range(13):
        a0, a1 = math.pi * (i + .045) / 13, math.pi * (i + .955) / 13
        outer = .029 + (.006 if i == 6 else .002 * (i % 2))
        pts = [
            (math.cos(a0) * half, spring + math.sin(a0) * rise),
            (math.cos(a0) * (half + outer), spring + math.sin(a0) * (rise + outer)),
            (math.cos(a1) * (half + outer), spring + math.sin(a1) * (rise + outer)),
            (math.cos(a1) * half, spring + math.sin(a1) * rise),
        ]
        stone = K.prism_xz('arch-stone', pts, min(front, rear), max(front, rear),
                           PORTAL if i % 3 else PORTAL_DIM)
        B.add(stone)
    for side in (-1, 1):
        for course in range(4):
            height = spring / 4 - .0015
            B.add(K.gbox('jamb-stone', (.029, depth, height),
                         (side * (half + .0145), y + inward * depth / 2,
                          (course + .5) * spring / 4),
                         PORTAL if course % 2 else PORTAL_DIM,
                         edge=0, grid=False, bevel=.0012))


def build_outcrop(name, seed, handed):
    rnd = random.Random(seed)
    root = kit.empty(name)
    B = K.Build(name)

    def h(x, y):
        # Two broad unequal lobes, joined by a low saddle. The tunnel roof
        # has ample cover but no constant-height plateau.
        shift = handed * (.018 + .025 * math.sin(y * 4 + .7))
        ax = abs(x - shift)
        crest = .295 + .065 * max(0, 1 - abs(y - handed * .18) / .18)
        crest += .038 * max(0, 1 - abs(y + handed * .25) / .14)
        crest += .008 * W.fbm(x * 4, y * 3, seed * .7)
        width = .47 - .022 * math.cos(y * 8 + seed)
        cross = max(0, 1 - (ax / width) ** 1.65)
        v = crest * cross
        # A narrow cross-cleft interrupts the crown; bedding shelves break
        # the side planes. This is geometry, not painted contour stripes.
        v -= .014 * math.exp(-((y + handed * .035) / .035) ** 2) * cross
        if ax > .19:
            step = .045
            bed = math.floor((v + .008) / step) * step
            v = v * .35 + bed * .65
        # Thin corners peel into the ground rather than a square pedestal.
        corner = max(0, (abs(y) - .33) / .14) * max(0, (ax - .24) / .23)
        v *= max(0, 1 - corner)
        v += .011 * W.fbm(x * 5, y * 6, seed + 3) * cross
        # Cover follows the real, centred bore, not the shifted crest.
        # Without this envelope a side cleft can expose the tunnel lining.
        bore_half = .196
        if abs(x) <= bore_half:
            roof = .14 + .116 * math.sqrt(max(0, 1 - (x / bore_half) ** 2))
            v = max(v, roof + .027)
        return max(.001, v)

    mass = W.heightfield('sloping-gritstone', -.493, .493, -.468, .468,
                         28, 28, h, base=-.002, mat=GRIT, side_mat=BED)

    def material_at(c, normal):
        if c.z < .035:
            return EARTH if normal.z > .55 else SHADOW
        # Wide sedimentary bands, not random flecks or a flat purple lid.
        band = int((c.z + .009 * math.sin(c.y * 7)) / .048)
        if normal.z < .48:
            return BED if band % 2 else GRIT
        if c.z < .14 and W.fbm(c.x * 3, c.y * 4, seed + 2) > .12:
            return GRASS
        return GRIT

    W.paint(mass, material_at)
    B.body(mass)

    # Fractured ledges taper at both ends and stagger in height; their
    # slanted surfaces break the shoulder silhouette at game scale.
    for side in (-1, 1):
        for j, yy in enumerate((-.34, -.18, -.015, .17, .33)):
            x = side * (.245 + .02 * math.sin(j * 1.7 + seed))
            length = rnd.uniform(.12, .17)
            lower = max(.045, h(x, yy) - .065)
            for course in range(2):
                dims = (.105 - course * .012, length * (1 - course * .15),
                        .034 + .008 * ((j + course) % 2))
                slab = W.slab(B, dims,
                             (x - side * course * .013,
                              yy + course * .01, lower + course * .033),
                             rnd.uniform(-.18, .18), BED if course == 0 else GRIT,
                             seed * 71 + j * 11 + course + (100 if side > 0 else 0),
                             tilt=(rnd.uniform(-.06, .06), side * -.12), cuts=8)
                B.bodies.append(slab)

    # Broad cap beds are deliberately off-axis, with gaps between groups.
    crowns = [(-.09 * handed, -.20, .13, .10, .035),
              (.07 * handed, .15 * handed, .15, .12, .041),
              (-.09 * handed, .29 * handed, .13, .09, .034),
              (.075 * handed, -.34, .11, .09, .030)]
    for i, (x, y, width, depth, height) in enumerate(crowns):
        # Set the bed into the lower adjacent slope, not on top of its
        # highest centre: only the broken leading edge should stand proud.
        base = min(h(x + dx * width, y + dy * depth)
                   for dx in (-.45, .45) for dy in (-.45, .45)) - height * .40
        crown = W.slab(B, (width, depth, height), (x, y, base),
                       handed * (.29 + i * .35), FRESH if i == 1 else GRIT,
                       seed * 43 + i, tilt=(.11, -.14 * handed), cuts=12)
        B.bodies.append(crown)

    # Fallen scree is sparse and grouped at the foot of real ledges.
    for side in (-1, 1):
        for i in range(5):
            x = side * rnd.uniform(.35, .43)
            y = rnd.uniform(-.36, .36)
            size = rnd.uniform(.022, .049)
            W.slab(B, (size, size * .76, size * .42),
                   (x, y, h(x, y) - .006), rnd.uniform(0, math.pi),
                   BED if i % 2 else GRIT, seed * 97 + i + (30 if side > 0 else 0),
                   tilt=(.08, -.1 * side), cuts=6)

    # Small rooted clumps on the lower shoulders, never a blanket on top.
    for i, (x, y) in enumerate(((-.36, -.22), (.34, .27), (-.32, .24),
                               (.37, -.12), (.21 * handed, -.32))):
        z = h(x, y)
        for j in range(5):
            ang = math.tau * j / 5 + seed
            px, py = x + math.cos(ang) * .012, y + math.sin(ang) * .012
            tuft = K.ball('heather-clump', 1, (0, 0, 0),
                          GRASS if i % 2 else HEATHER, seg=5, rings=3,
                          scale=(.016, .012, .009))
            K.tf(tuft, K.T(px, py, max(z, h(px, py)) + .003))
            B.add(tuft)
        if i % 2 == 0:
            sprig = W.slab(B, (.013, .011, .008), (x, y, z + .013), .3,
                          TIPS, seed + i, cuts=5)

    portal(B, -.488, 1)
    portal(B, .488, -1)
    W.bore(B, 0, .18, .14, .10, -.485, .485, LINING, t=.015,
           cut_t=.016, cut_from=-.53, cut_to=.53)
    B.carve()

    # Preserve editable carved strata, slabs and individual portal stones.
    source = bpy.data.collections.new(name + '-editable-parts')
    bpy.context.scene.collection.children.link(source)
    source.hide_render = source.hide_viewport = True
    for obj, _ in B.parts:
        copy = obj.copy()
        copy.data = obj.data.copy()
        source.objects.link(copy)
    B.finish(root, angle=18)
    return root


def validate_clearance(root):
    """Check the bore and its cover, including deeply embedded rock beds."""
    from mathutils.bvhtree import BVHTree
    kit.refresh()
    deps = bpy.context.evaluated_depsgraph_get()
    trees = [(obj, BVHTree.FromObject(obj, deps))
             for obj in kit.descendants(root) if obj.type == 'MESH']
    for i in range(-6, 7):
        x = (.18 - .006) * i / 6
        top = .14 + .10 * math.sqrt(max(0, 1 - (x / .18) ** 2))
        for j in range(1, 8):
            z = .004 + (top - .01) * j / 7
            for obj, tree in trees:
                inv = obj.matrix_world.inverted()
                hit = tree.ray_cast(inv @ Vector((x, -.6, z)),
                                    Vector((0, 1, 0)), 1.2)
                assert hit[0] is None, ('blocked bore', root.name, x, z)
    minimum_cover = 1
    for x in (-.16, -.12, -.08, -.04, 0, .04, .08, .12, .16):
        roof = .14 + .116 * math.sqrt(1 - (x / .196) ** 2)
        for y in (-.42, -.28, -.14, 0, .14, .28, .42):
            heights = []
            for obj, tree in trees:
                hit = tree.ray_cast(obj.matrix_world.inverted() @ Vector((x, y, .5)),
                                    Vector((0, 0, -1)), .5)
                if hit[0] is not None:
                    heights.append((obj.matrix_world @ hit[0]).z)
            cover = max(heights, default=0) - roof
            assert cover >= .012, ('exposed tunnel roof', root.name, x, y, cover)
            minimum_cover = min(minimum_cover, cover)
    print('CLEARANCE', root.name, '91 clear bore rays; 63 covered roof points;',
          'minimum cover', round(minimum_cover, 4))


def main():
    rkit.reset(seed=1710)
    args = sys.argv[sys.argv.index('--') + 1:]
    out, preview_dir = args
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    os.makedirs(preview_dir, exist_ok=True)
    roots = [build_outcrop('outcrop_a', 31, 1), build_outcrop('outcrop_b', 83, -1)]
    for i, root in enumerate(roots):
        root.location.x = i * 2
    kit.refresh()
    meshes = [o for r in roots for o in kit.descendants(r) if o.type == 'MESH']
    kit.bake_ao(meshes, samples=64, distance=.045)
    for root in roots:
        root.location = (0, 0, 0)
    kit.refresh()
    W.report(roots)
    metrics = {}
    for root in roots:
        W.bore_check(root, .18, .14, .10, -.6, .6, 'straight through')
        validate_clearance(root)
        lo, hi = W.bounds(root)
        assert min(lo.x, lo.y) >= -.497 and max(hi.x, hi.y) <= .497, (lo, hi)
        assert hi.z <= .40, hi.z
        metrics[root.name] = {'min': list(lo), 'max': list(hi),
                              'triangles': sum(W.tris(o) for o in kit.descendants(root)
                                               if o.type == 'MESH')}
    with open(os.path.join(preview_dir, 'bounds.json'), 'w') as f:
        json.dump(metrics, f, indent=2)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(os.path.dirname(out), 'ridges-master.blend')))
    kit.export(roots, out)
    K.preview_look(strength=.18)
    W.stage()
    for root in roots:
        for other in roots:
            for obj in kit.descendants(other):
                obj.hide_render = other != root
        square = W.ref_square(Vector((0, 0, 0)))
        for label, elevation, azimuth in [('front', 18, 0), ('game', 55, 30),
                                          ('phone', 75, 0), ('rear', 35, 180)]:
            W.shot(os.path.join(preview_dir, root.name + '-' + label + '.png'),
                   Vector((0, 0, .10)), .67, elevation, azimuth,
                   size=700, samples=32)
        # Neutral clay is an explicit silhouette/primary-form check.
        material = bpy.data.materials.new('review-clay')
        material.diffuse_color = (.42, .42, .42, 1)
        scene = bpy.context.scene
        scene.view_layers[0].material_override = material
        W.shot(os.path.join(preview_dir, root.name + '-clay.png'),
               Vector((0, 0, .10)), .67, 55, 30, size=700, samples=32)
        scene.view_layers[0].material_override = None
        for obj in square:
            bpy.data.objects.remove(obj, do_unlink=True)


if __name__ == '__main__':
    main()
