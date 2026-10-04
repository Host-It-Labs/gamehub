"""Articulate the original facial sculpts without changing their proportions.

Keep the surface paint, eyes, pupils and brows separate before the head is
joined. Every feature uses its own surface frame, including the Rex's eyes
on the sides of its skull. They still share the game's material batches.
"""
import re
from mathutils import Matrix, Vector
import kit


def bounds(objects):
    kit.refresh()
    points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    return (lo + hi) / 2, hi - lo


def head(part, troop, objects, pivot, parent, **kwargs):
    groups = {}
    fixed = []
    for obj in objects:
        label = obj.name.removeprefix(troop + '-').removeprefix('head-')
        match = re.fullmatch(r'(.*?)(-?1)(?:\.\d{3})?', label)
        key = None
        if match:
            feature, sign = match.groups()
            side = 'L' if sign == '-1' else 'R'
            if feature in ('eye-white', 'eye-outline', 'eye'):
                key = 'eye' + side
            elif feature in ('pupil', 'iris', 'glint', 'catchlight', 'catch'):
                key = 'pupil' + side
            elif 'brow' in feature or (troop == 'ogre' and feature == 'lid'):
                key = 'brow' + side
        if label in ('mouth', 'teeth', 'grin') or (
                troop == 'imps' and re.fullmatch(r'bar\d', label)):
            key = 'mouth'
        (groups.setdefault(key, []) if key else fixed).append(obj)

    root = part(troop, 'head', fixed, pivot, parent, **kwargs)
    joints = {}
    # Pupils are children of the eye so a blink also closes the iris.
    for key in ('eyeL', 'eyeR', 'browL', 'browR', 'mouth', 'pupilL', 'pupilR'):
        pieces = groups.get(key)
        if not pieces:
            continue
        centre, size = bounds(pieces)
        joint = part(troop, key, pieces, centre,
                     joints.get('eye' + key[-1], root) if key.startswith('pupil') else root)
        # Fit a tangent frame to the head, with z pointing up. Rotating the
        # frame leaves the mesh in exactly the same world position.
        if key.startswith('pupil'):
            axes = joints['eye' + key[-1]].matrix_world.to_3x3()
        else:
            normal = Vector(((-1 if key.endswith('L') else 1), 0.5, 0.12)) \
                if troop == 'ogre' else Vector((centre.x * 3, 1, 0))
            normal.normalize()
            up = Vector((0, 0, 1))
            up = (up - normal * up.dot(normal)).normalized()
            right = normal.cross(up).normalized()
            axes = Matrix((right, normal, up)).transposed()
        kit.refresh()
        before = joint.matrix_world.copy()
        after = Matrix.Translation(centre) @ axes.to_4x4()
        joint.data.transform(after.inverted() @ before)
        joint.matrix_world = after
        joint['faceWidth'] = max(size.x, size.y) if troop == 'ogre' else size.x
        joint['faceHeight'] = size.z
        joints[key] = joint
    # Save the surface-normal frame after the parent transforms settle.
    kit.refresh()
    return root
