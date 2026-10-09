"""C3's local right-grip correction, applied only to the separate game copy.

Pure coordinate functions keep the board/finger relationship inspectable without
Blender. The accepted v2 source and its fingerprint stay unchanged. The fixed
plate is held by the right hand; extra2's moving plate remains the left hand's.
"""
import math


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def section(rows, t):
    for a, b in zip(rows, rows[1:]):
        if t <= b[0]:
            u = max(0, min(1, (t - a[0]) / (b[0] - a[0])))
            u = u * u * (3 - 2 * u)
            return mix(a[1:], b[1:], u)
    return rows[-1][1:]


def glove_forms(wrist, elbow, board):
    """Return a cuff/palm surface and five open digit centreline paths.

    board is the fixed plate's actual centre, not the moving plate centre.
    Its half-width/thickness/height are .029/.005/.054 in the v2 source.
    Four pads wrap the +X edge onto +Y. The thumb opposes them above the top.
    All coordinates are Blender native, with the original anatomical pivots.
    """
    down = tuple(w - e for w, e in zip(wrist, elbow))
    length = math.sqrt(sum(v * v for v in down))
    down = tuple(v / length for v in down)
    # Same orthogonal cross-section as the source glove: x points towards
    # the palm, and out lies in the forward/up forearm plane.
    palm = (-1 - down[0] * -down[0], -down[1] * -down[0], -down[2] * -down[0])
    length = math.sqrt(sum(v * v for v in palm))
    palm = tuple(v / length for v in palm)
    out = (down[1] * palm[2] - down[2] * palm[1],
           down[2] * palm[0] - down[0] * palm[2],
           down[0] * palm[1] - down[1] * palm[0])
    # t, out radius, palm radius, outward X shift, forward out shift.
    # The roomy source gauntlet is retained above the wrist. The short
    # palm below it narrows before entering the plate gap, then turns round
    # the outer edge instead of ending in a paddle behind the wooden face.
    sections = [(-.080, .038, .034, 0, 0),
                (-.058, .040, .035, 0, 0),
                (-.049, .039, .034, 0, 0),
                (-.014, .025, .025, 0, .010),
                (0, .011, .028, .014, .054),
                (.004, .011, .010, .042, .052),
                (.018, .012, .010, .042, .036),
                (.032, .012, .009, .043, .034),
                (.055, .013, .008, .044, .030),
                (.074, .010, .007, .044, .029),
                (.080, .004, .006, .032, .026)]
    rows = []
    for j in range(65):
        t = -.080 + .160 * j / 64
        width, depth, shift, forward = section(sections, t)
        row = []
        for i in range(48):
            a = math.tau * i / 48
            cuff = .0022 * math.exp(-((t + .058) / .006) ** 2)
            cloth = .0006 * math.sin(a * 5 + t * 63) * math.exp(-((t - .018) / .018) ** 2)
            row.append(tuple(wrist[k] + down[k] * t + (shift if k == 0 else 0)
                             + out[k] * (forward + math.sin(a) * (width + cuff))
                             + palm[k] * math.cos(a) * (depth + cloth)
                             for k in range(3)))
        rows.append(row)

    edge = board[0] + .029
    front = board[1] + .005
    top = board[2] + .054
    fingers = []
    for i, (zoffset, radius, curl) in enumerate(zip(
            (.041, .024, .007, -.010), (.0068, .0070, .0068, .0062),
            (.025, .028, .026, .022))):
        z = board[2] + zoffset
        path = [(edge + .009, board[1] - .023, z),
                (edge + .014, board[1] - .012, z - .001),
                (edge + .014, front + .001, z - .002),
                (edge + .004, front + .0052, z - .003),
                (edge - curl, front + .0052, z - .003)]
        fingers.append({"path": path, "radius": radius, "index": i})
    thumb = [(edge - .007, board[1] - .024, top - .012),
             (edge + .009, board[1] - .028, top + .004),
             (edge + .008, board[1] - .014, top + .013),
             (edge - .006, board[1] - .003, top + .012),
             (edge - .015, board[1] - .003, top + .007)]
    return {"palm": rows, "fingers": fingers, "thumb": thumb,
            "board": tuple(board), "fixedEdgeX": edge, "frontY": front,
            "topZ": top, "voxel": .0014}


def replace_right_grip(root):
    """Replace the bad shell in memory, leaving the accepted master on disk."""
    import bpy
    import numpy as np
    import kit
    import figure_folk_kit as fk
    import figure_beekeeper_sculpt as sculpt

    rig = next(o for o in kit.descendants(root) if o.type == "ARMATURE")
    wr, el = sculpt.WR[1], sculpt.EL[1]
    down = (wr - el).normalized()
    grip = wr + down * .060 + sculpt.V(-.018, .040, .001)
    # Derive the unchanged plate from the same authored prop coordinates.
    board = grip + sculpt.V(.018, .001, .006)
    forms = glove_forms(tuple(wr), tuple(el), tuple(board))
    old = [o for o in kit.descendants(root)
           if o.name == sculpt.R + ".glove-shell1"
           or o.name.startswith(sculpt.R + ".glove-finger-seam1-")]
    if not any(o.name == sculpt.R + ".glove-shell1" for o in old):
        raise RuntimeError("Expected the reviewed v2 right glove before runtime repair")
    for o in old:
        mesh = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh.users == 0:
            bpy.data.meshes.remove(mesh)

    canvas = [fk.loft(sculpt.R + ".runtime-right-palm", forms["palm"],
                      sculpt.CANVAS, start="pole", end="pole")]
    stitching = []
    for finger in forms["fingers"]:
        pts = sculpt.curve(finger["path"], 8)
        radius = finger["radius"]
        radii = [(radius * (1 - .13 * j / (len(pts) - 1)),
                  radius * .84 * (1 - .10 * j / (len(pts) - 1)))
                 for j in range(len(pts))]
        canvas.append(fk.tube(sculpt.R + f".runtime-right-digit{finger['index']}",
                              pts, radii, sculpt.CANVAS, n=18, up=(0, 0, 1)))
        # A fine seam lies on the exposed top of each curved finger;
        # no dark groove or painted line substitutes for the real gap.
        seam = [p + sculpt.V(0, 0, radius * .88) for p in pts[2:-2]]
        stitching.append(fk.tube(sculpt.R + f".glove-finger-seam1-{finger['index']}",
                                 seam, [.00055] * len(seam), sculpt.SEAM, n=6))
    thumb = sculpt.curve(forms["thumb"], 8)
    canvas.append(fk.tube(sculpt.R + ".runtime-right-thumb", thumb,
                          [(.0095 - .003 * j / (len(thumb) - 1),
                            .009 - .0028 * j / (len(thumb) - 1))
                           for j in range(len(thumb))], sculpt.CANVAS, n=18,
                          up=(0, 0, 1)))
    shell = sculpt.union(canvas, sculpt.R + ".glove-shell1", sculpt.CANVAS, forms["voxel"])
    kit.apply(shell)
    kit.apply_transform(shell)
    pts = np.array([v.co[:] for v in shell.data.vertices])
    along = (pts - np.array(wr)).dot(np.array(down))
    hand = sculpt.ss(-.047, .010, along)
    # The opposed thumb sits above the board. Height-only or along-only
    # weighting would erroneously give it to the forearm. Give all exposed
    # gripping surfaces to handR; retain the exact source cuff blend above.
    grip_mask = np.maximum(sculpt.ss(.081, .098, pts[:, 1]),
                           sculpt.ss(.208, .224, pts[:, 0]))
    grip_mask *= sculpt.ss(.555, .530, pts[:, 2])
    hand = np.maximum(hand, grip_mask)
    sculpt.weights(shell, rig, {"foreR": 1 - hand, "handR": hand})
    for o in stitching:
        sculpt.attach(o, rig, "handR")
    root["runtimeGripRepair"] = "v2 fixed-bellows edge; four curled fingers and opposed thumb"
    return shell
