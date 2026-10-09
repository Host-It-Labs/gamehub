"""Authored Dino skin hierarchy: recessed fine scales and broad dermal scutes.

The source carries physical relief. There is no generic repeating leather
normal, and large facial/dorsal plates are placed against the actual sculpt.
"""

import math

import bpy
import numpy as np
from mathutils import Vector

import kit
import figure_ogre_kit as fk


def _cells(u, v, spacing, seed):
    u = u / spacing
    v = v / (spacing * .80)
    nearest = np.full(len(u), np.inf)
    second = np.full(len(u), np.inf)
    for dr in (-1, 0, 1):
        row = np.floor(v) + dr
        stagger = np.mod(row, 2) * .5
        col = np.floor(u - stagger)
        for dc in (-1, 0, 1):
            c = col + dc
            h = np.sin(c * 12.9898 + row * 78.233 + seed) * 43758.5453
            jitter = (h - np.floor(h) - .5) * .25
            g = np.sin(c * 43.712 + row * 17.583 + seed * 3) * 17498.916
            jitter_y = (g - np.floor(g) - .5) * .22
            d = ((u - (c + .5 + stagger + jitter)) ** 2 +
                 (v - (row + .5 + jitter_y)) ** 2)
            second = np.minimum(second, np.maximum(nearest, d))
            nearest = np.minimum(nearest, d)
    gap = np.sqrt(second) - np.sqrt(nearest)
    # Recessed irregular polygon boundaries, broad nearly flat cell interiors.
    return .20 - .70 * np.exp(-gap * 13) + .22 * np.exp(-nearest * 2.0)


def scale_relief(P, N, spacing=.050, amplitude=.0017):
    weight = np.abs(N) ** 8
    weight /= np.maximum(np.sum(weight, axis=1)[:, None], 1e-9)
    fields = np.stack((_cells(P[:, 1], P[:, 2], spacing, 1.17),
                       _cells(P[:, 0], P[:, 2], spacing, 4.21),
                       _cells(P[:, 1], P[:, 0], spacing, 8.73)), axis=1)
    return np.sum(weight * fields, axis=1) * amplitude


def scute(name, tree, origin, direction, width, height, depth, mat,
          tangent_hint=(0, 0, 1), seed=0):
    """A low, beveled angular plate, conforming to the sculpt beneath it."""
    centre, normal = fk.hit(tree, origin, direction)
    if centre is None:
        return None
    normal.normalize()
    up = Vector(tangent_hint)
    up = up - normal * up.dot(normal)
    if up.length < .01:
        up = Vector((0, 1, 0)) - normal * normal.y
    up.normalize()
    side = up.cross(normal).normalized()
    rings, verts, faces = [], [], []
    n = 8
    for radial, lift in ((1.0, -.0002), (.91, depth * .7),
                         (.82, depth), (.28, depth)):
        ring = []
        for k in range(n):
            a = math.tau * k / n
            boundary = 1 + .12 * math.sin(k * 2.3 + seed)
            p = centre + side * (math.cos(a) * width * radial * boundary) + \
                up * (math.sin(a) * height * radial * boundary)
            hit, no = fk.hit(tree, p + normal * .15, -normal, far=.4)
            if hit is None:
                hit, no = p, normal
            ring.append(len(verts))
            verts.append(tuple(hit + no.normalized() * lift))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(n):
            faces.append((a[k], a[(k + 1) % n], b[(k + 1) % n], b[k]))
    c = len(verts)
    verts.append(tuple(centre + normal * depth))
    for k in range(n):
        faces.append((rings[-1][k], rings[-1][(k + 1) % n], c))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(kit.material(mat))
    for p in mesh.polygons:
        p.use_smooth = True
    # Keep angular unequal plate boundaries and a flat interior, not a bead.
    return obj


def facial_scutes(skull, mat):
    tree = fk.tree([skull])
    pieces = []
    for sx in (-1, 1):
        locations = [(.835, 2.093, .038, .029),
                     (.934, 2.118, .047, .028),
                     (1.049, 2.105, .050, .027),
                     (.811, 1.901, .038, .044),
                     (.863, 1.866, .050, .032),
                     (.975, 1.856, .056, .030),
                     (.887, 1.938, .025, .032)]
        for k, (y, z, w, h) in enumerate(locations):
            obj = scute(f"ogre-facial-scute-{sx}-{k}x", tree,
                         (sx * 1, y, z), (-sx, 0, 0), w, h, .0026,
                         mat, seed=k * .73)
            if obj:
                pieces.append(obj)
        # Smaller labial scales beneath the large orbital/temporal scutes.
        for k, y in enumerate((1.11, 1.24, 1.37, 1.50, 1.63, 1.74)):
            z = 1.805 + (y - 1.11) * .065 + math.sin(k * 2.1) * .006
            obj = scute(f"ogre-labial-scute-{sx}-{k}x", tree,
                         (sx * 1, y, z), (-sx, 0, 0),
                         .060 - k * .0018, .028 + (k % 2) * .004,
                         .0018, mat, seed=2 + k * .54)
            if obj:
                pieces.append(obj)
    return pieces


def dorsal_scutes(shape, mat):
    tree = fk.tree([shape])
    pieces = []
    for k, y in enumerate((-.73, -.51, -.28, -.045, .19, .34)):
        for sx in (-1, 1):
            obj = scute(f"ogre-dorsal-scute-{k}-{sx}x", tree,
                         (sx * (.073 if k < 4 else .055), y, 3), (0, 0, -1),
                         .065 if k < 4 else .050, .084 if k < 4 else .066,
                         .0036, mat, tangent_hint=(0, 1, 0), seed=k + sx * .31)
            if obj:
                pieces.append(obj)
    return pieces


def honest_preview_materials(root):
    """Use registered linear tints and roughness, with no missing AO input."""
    materials = {mat for obj in kit.descendants(root) if obj.type == "MESH"
                 for mat in obj.data.materials}
    for mat in materials:
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        if mat.name == "reptile:dino-painted-white":
            # The same pigment+AO color used by the exported runtime mesh.
            continue
        for link in list(bsdf.inputs["Base Color"].links):
            mat.node_tree.links.remove(link)
        _, _, tint = mat.name.partition(":")
        bsdf.inputs["Base Color"].default_value = (*kit.TINTS.get(tint, (.2, .2, .2)), 1)


def _smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _pigment(P, name, palette):
    hide, back, belly = (np.asarray(palette[k]) for k in ("hide", "back", "belly"))
    # One axial rest-space classification spans every neck/trunk/tail cut.
    ys = [-3.01, -2.77, -2.48, -2.16, -1.84, -1.52, -1.24, -1.04,
          -.86, -.59, -.32, -.06, .19, .37, .43, .48, .57, .70,
          .80, .96, 1.12, 1.34, 1.56, 1.76, 1.87, 1.91]
    centres = [1.345, 1.325, 1.33, 1.355, 1.39, 1.425, 1.46, 1.495,
               1.505, 1.50, 1.47, 1.45, 1.46, 1.49, 1.51, 1.55, 1.63, 1.79,
               1.923, 1.963, 1.963, 1.943, 1.923, 1.909, 1.888, 1.868]
    tops = [.004, .022, .044, .069, .097, .128, .162, .20,
            .275, .33, .34, .33, .29, .28, .27, .242, .245, .252,
            .237, .262, .252, .217, .182, .151, .117, .08]
    bottoms = [.004, .022, .044, .069, .097, .128, .162, .185,
               .275, .34, .37, .35, .31, .28, .26, .245, .23, .16,
               .238, .263, .253, .217, .183, .152, .118, .08]
    centre = np.interp(P[:, 1], ys, centres)
    top = np.interp(P[:, 1], ys, tops)
    bottom = np.interp(P[:, 1], ys, bottoms)
    organic = np.sin(P[:, 1] * 7.1 + P[:, 0] * 4.3) * .012 + \
        np.sin(P[:, 1] * 18.4 - P[:, 0] * 14.7) * .004
    dorsal_line = centre + top * .48 + np.abs(P[:, 0]) * .20 + organic
    dorsal = _smooth(dorsal_line - .022, dorsal_line + .035, P[:, 2])
    under_line = centre - bottom * .42 + organic
    under = 1 - _smooth(under_line - .025, under_line + .036, P[:, 2])
    under *= 1 - _smooth(.67, .89, P[:, 1])
    if name.startswith("jaw"):
        under_line = np.interp(P[:, 1], [.77, .89, 1.08, 1.31, 1.55, 1.75, 1.86],
                               [1.525, 1.535, 1.57, 1.596, 1.632, 1.674, 1.70])
        under = 1 - _smooth(under_line - .015, under_line + .030, P[:, 2])
        dorsal *= 0
    elif name.startswith(("leg", "knee", "foot", "arm", "fore", "brow", "eye", "pupil")):
        dorsal *= 0
        under *= 0
        if name.startswith("leg"):
            # A little warm inner-thigh light, not an all-cream limb.
            under = (1 - _smooth(.25, .36, np.abs(P[:, 0]))) * .12
    C = np.tile(hide, (len(P), 1))
    C = C * (1 - dorsal[:, None]) + back * dorsal[:, None]
    C = C * (1 - under[:, None]) + belly * under[:, None]
    # Quiet broad olive variation sits beneath the geometry's scale hierarchy.
    variation = 1 + .025 * np.sin(P[:, 1] * 3.8 + P[:, 0] * 2.1) * \
        np.cos(P[:, 2] * 4.7 - P[:, 1])
    return C * variation[:, None]


def vertex_skin(root, palette):
    """Cache diffuse pigment separately so a later AO bake can be combined."""
    white = kit.material("reptile:" + kit.tint("dino-painted-white", "#ffffff"))
    prepare_ao(root)
    kit.refresh()
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        if not mesh.polygons:
            continue
        name = obj.name.removeprefix("ogre.")
        co, _ = fk.arrays(obj)
        M = np.asarray(obj.matrix_world)
        P = co @ M[:3, :3].T + M[:3, 3]
        pigment = _pigment(P, name, palette)
        if obj.get("continuousSkin"):
            # Limb regions share the fused surface, so keep the warm axial
            # underside from flooding down the legs or onto the small arms.
            # Pigment follows smooth anatomical fields, independently of
            # animation masks; a joint-region edge must never become paint.
            limb_share = _smooth(.12, .235, np.abs(P[:, 0])) * \
                (1 - _smooth(1.23, 1.58, P[:, 2])) * \
                _smooth(-.99, -.68, P[:, 1]) * \
                (1 - _smooth(.46, .76, P[:, 1]))
            limb_share = np.maximum(limb_share,
                                   1 - _smooth(.91, 1.10, P[:, 2]))
            arm_groups = {group.index for group in obj.vertex_groups
                          if group.name.startswith(("ogre.arm", "ogre.fore"))}
            arm_share = np.asarray([
                sum(g.weight for g in v.groups if g.group in arm_groups)
                for v in mesh.vertices])
            limb_share = np.maximum(limb_share, np.clip(arm_share, 0, 1))
            limb_pigment = _pigment(P, "arm", palette)
            pigment = pigment * (1 - limb_share[:, None]) + \
                limb_pigment * limb_share[:, None]
        loops = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get("vertex_index", loops)
        values = np.ones((len(mesh.loops), 4), dtype=np.float32)
        if white.name not in [mat.name for mat in mesh.materials]:
            mesh.materials.append(white)
        index = list(mesh.materials).index(white)
        for polygon in mesh.polygons:
            mat = mesh.materials[polygon.material_index]
            if mat.name.startswith("reptile:"):
                indices = polygon.loop_indices
                values[list(indices), :3] = pigment[loops[list(indices)]]
                polygon.material_index = index
        # Retained editable pigment is generic corner-vector data. Color-layer
        # caches are affected by a vertex-color bake and can steal COLOR_0
        # during glTF export, making the real character entirely white.
        attr = mesh.attributes.get("DinoPigment") or mesh.attributes.new(
            "DinoPigment", "FLOAT_VECTOR", "CORNER")
        attr.data.foreach_set("vector", values[:, :3].copy().reshape(-1))
        ao = mesh.color_attributes.get("AO") or mesh.color_attributes.new(
            "AO", "FLOAT_COLOR", "CORNER")
        ao.data.foreach_set("color", np.ones(len(mesh.loops) * 4, dtype=np.float32))
        mesh.color_attributes.active_color = ao
        mesh.color_attributes.render_color_index = list(mesh.color_attributes).index(ao)


def prepare_ao(root):
    """Migrate earlier editable masters without exposing caches as colors."""
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        for name in ("DinoPigment", "DinoOcclusion"):
            old = mesh.color_attributes.get(name)
            if not old or old.data_type not in ("FLOAT_COLOR", "BYTE_COLOR"):
                continue
            values = np.empty(len(mesh.loops) * 4, dtype=np.float32)
            old.data.foreach_get("color", values)
            mesh.color_attributes.remove(old)
            attr = mesh.attributes.new(name, "FLOAT_VECTOR", "CORNER")
            attr.data.foreach_set("vector", values.reshape(-1, 4)[:, :3].copy().reshape(-1))


def finish_ao(root):
    """Combine authored pigment with fresh AO into the sole export color."""
    prepare_ao(root)
    for obj in kit.descendants(root):
        if obj.type != "MESH":
            continue
        mesh = obj.data
        paint = mesh.attributes.get("DinoPigment")
        ao = mesh.color_attributes.get("AO")
        if not paint or not ao:
            continue
        P = np.empty(len(mesh.loops) * 3, dtype=np.float32)
        A = np.empty(len(mesh.loops) * 4, dtype=np.float32)
        paint.data.foreach_get("vector", P)
        ao.data.foreach_get("color", A)
        P, A = P.reshape(-1, 3), A.reshape(-1, 4)
        saved = mesh.attributes.get("DinoOcclusion")
        if np.max(np.abs(A[:, :3] - A[:, 0, None])) > .0001 and saved:
            raw = np.empty(len(mesh.loops) * 3, dtype=np.float32)
            saved.data.foreach_get("vector", raw)
            A[:, :3] = raw.reshape(-1, 3)
        else:
            saved = saved or mesh.attributes.new("DinoOcclusion", "FLOAT_VECTOR", "CORNER")
            saved.data.foreach_set("vector", A[:, :3].copy().reshape(-1))
        result = A.copy()
        result[:, :3] *= P
        ao.data.foreach_set("color", result.reshape(-1))
        mesh.color_attributes.active_color = ao
        mesh.color_attributes.render_color_index = list(mesh.color_attributes).index(ao)
