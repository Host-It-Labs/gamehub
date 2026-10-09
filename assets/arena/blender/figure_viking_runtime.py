"""A separate budgeted topology of the independently reviewed v8 source.

The source generator still authors the full sculpt. This private optional
part hook reduces original named components before joining, so primary
anatomy does not lose its budget to numerous tiny tuft/rivet components.
After joining, normals are projected from the complete source part. The
normal build and retained detailed masters never enter this path.
"""

import json
import re

import bpy
from mathutils import Vector
import kit
import figure_viking_kit as vk

CEILING = 19676
DRAW_CEILING = 69
BUDGETS = {
    "torso": 4800, "head": 4300, "beard": 2200,
    "legL": 320, "legR": 320, "kneeL": 760, "kneeR": 760,
    "footL": 340, "footR": 340,
    "armL": 370, "armR": 370, "foreL": 310, "foreR": 310,
    "handL": 580, "handR": 580, "weapon": 1200,
    "skirtL": 550, "skirtR": 550,
    "eyeL": 140, "eyeR": 140, "pupilL": 100, "pupilR": 100,
    "browL": 96, "browR": 96, "mouth": 38,
}
PRIMARY = {
    "viking-tunic-sculpt": 1900,
    "viking-fur-padded-mantle": 450,
    "viking-belt": 156,
    "viking-buckle": 100,
    "viking-bplate": 36,
    "viking-tongue": 20,
    "viking-pouch": 100,
    "viking-flap": 80,
    "viking-woven-neck-edge": 48,
    "viking-weathered-skull": 1600,
    "viking-beard-cheek-connected": 800,
    "viking-beard-continuous-locks": 1300,
    "viking-helm": 650,
    "viking-browband": 144,
    "viking-nasal": 78,
    "viking-boss": 60,
    "viking-continuous-gripL": 520,
    "viking-continuous-gripR": 520,
    "viking-axe-ash-grain": 160,
    "viking-axe-forged-bearded-blade": 420,
    "viking-axe-hollow-eye": 180,
    "viking-axe-butt-cap": 80,
}
REPORTS = []


def begin():
    REPORTS.clear()


def grid_point(vertices, nu, nv, u, v, periodic=False):
    """Sample the actual reviewed source grid, without re-authoring its shape."""
    x = u*nu if periodic else u*(nu-1)
    y = v*(nv-1)
    i, j = min(int(x), nu-1), min(int(y), nv-1)
    k = (i+1) % nu if periodic else min(i+1, nu-1)
    l = min(j+1, nv-1)
    a = vertices[j*nu+i].lerp(vertices[j*nu+k], x-int(x))
    b = vertices[l*nu+i].lerp(vertices[l*nu+k], x-int(x))
    return a.lerp(b, y-int(y))


def structured_copy(ob):
    """Retain ring correspondence through important thin and curved forms."""
    import figure_viking as F
    vertices = [v.co.copy() for v in ob.data.vertices]
    name = ob.name
    reduced = None
    if "viking-skirt-drape" in name:
        assert len(vertices) == 45*29*2
        us = [0, .015, .034, .060, .10, .155, .235, .34, .47, .61, .75, .88, 1]
        vs = [0, .06, .14, .25, .39, .54, .70, .85, 25/28, 1]
        sx = -1 if "-1" in name else 1
        reduced = vk.sheet("__Viking structured skirt", lambda u, v: grid_point(vertices, 45, 29, u, v),
                           us, vs, lambda i, j: F.TRIM if j == len(vs)-2 else F.TEAM,
                           rim=.005, back=True, rim_mat=F.TEAM, inside=(sx*.05, 0, .5))
    elif "viking-calf-wrap-shaped" in name:
        rings = [[grid_point(vertices, 48, 81, i/12, j/24, True)
                  for i in range(12)] for j in range(25)]
        reduced = vk.loft("__Viking structured wraps", rings, F.WRAP, start="pole", end="pole")
    elif name == "viking-axe-forged-bearded-blade":
        rows = [0, 4, 8, 12, 13, 16, 20, 26, 28, 32, 40, 48, 56, 64, 68, 72]
        rings = [[vertices[j*13+i] for i in range(13)] for j in rows]
        reduced = vk.loft("__Viking structured blade", rings, F.IRON,
                          bands=lambda i, j: F.EDGE if 3 <= i <= 7 else None,
                          start="pole", end="pole")
    elif name == "viking-helm":
        assert len(vertices) == 96*26+1
        rows = [0, 1, 2, 4, 6, 8, 11, 14, 17, 20, 22, 24, 25]
        rings = [[vertices[j*96+i*4] for i in range(24)] for j in rows]
        reduced = vk.loft("__Viking structured helmet", rings, F.IRON, end=vertices[-1])
    elif name == "viking-browband":
        rings = [[vertices[j*96+i*4] for i in range(24)] for j in range(4)]
        reduced = vk.loft("__Viking structured brow band", rings, F.IRON)
    elif "viking-spangen" in name:
        assert len(vertices) >= 12*20
        rows = [0, 1, 2, 4, 8, 12, 15, 18, 19]
        rings = [[vertices[j*12+i*2] for i in range(6)] for j in rows]
        reduced = vk.loft("__Viking structured bronze band", rings, F.BRONZE, start="flat")
    if reduced is not None:
        old_data = ob.data
        ob.data = reduced.data
        bpy.data.objects.remove(reduced, do_unlink=True)
        if old_data.users == 0:
            bpy.data.meshes.remove(old_data)
    return reduced is not None


def component_normals(target, source, angle, structured):
    kit.shade(target, angle)
    # Sample only the matching authored component. The joined source can
    # project helmet bands onto the dome, or cloth onto nearby bindings.
    if not structured:
        kit.shade(source, angle)
        modifier = target.modifiers.new("Matching source component normals", "DATA_TRANSFER")
        modifier.object = source
        modifier.use_loop_data = True
        modifier.data_types_loops = {"CUSTOM_NORMAL"}
        modifier.loop_mapping = "POLYINTERP_NEAREST"
        bpy.ops.object.select_all(action="DESELECT")
        target.select_set(True)
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return [n.vector.copy() for n in target.data.corner_normals]


def targets(name, objects):
    budget = BUDGETS[name]
    counts = [vk.tris(ob) for ob in objects]
    fixed = [PRIMARY.get(ob.name) for ob in objects]
    for i, ob in enumerate(objects):
        if "viking-braid-strand" in ob.name:
            fixed[i] = 95
        elif "viking-braid-band" in ob.name:
            fixed[i] = 40
        elif "viking-braid-end" in ob.name:
            fixed[i] = 16
        elif "viking-spangen" in ob.name:
            fixed[i] = 100
        elif "viking-calf-wrap-shaped" in ob.name:
            fixed[i] = 600
        elif "viking-wrap-binding" in ob.name:
            fixed[i] = 80
        elif "viking-skirt-drape" in ob.name:
            fixed[i] = 516
        else:
            tuft = re.search(r"viking-pelt-(?:lock|split-tip)(\d)-(\d+)", ob.name)
            if tuft:
                fixed[i] = 16 if tuft[1] == "3" else 12
    floors = [min(n, f if f is not None else (6 if n > 24 else n))
              for n, f in zip(counts, fixed)]
    assert sum(floors) <= budget, f"{name}: component silhouettes exceed budget"
    remainder = budget-sum(floors)
    weights = [max(0, n-floor)**.74 if f is None else 0
               for n, floor, f in zip(counts, floors, fixed)]
    total = sum(weights)
    goals = [min(n, floor+int(remainder*w/total)) if total else floor
             for n, floor, w in zip(counts, floors, weights)]
    return counts, goals


def prepare(name, objects, angle):
    """Budget a part by authored components and keep its true source finish."""
    source_count = sum(vk.tris(ob) for ob in objects)
    removed = []
    # The padded mantle and the complete outside row preserve the source
    # silhouette. Hidden alternating interior tufts need fewer, fuller
    # volumes rather than collapsing every source clump into a triangle.
    for ob in list(objects):
        tuft = re.search(r"viking-pelt-(lock|split-tip)(\d)-(\d+)", ob.name)
        if tuft and int(tuft[2]) < 3 and (tuft[1] == "split-tip" or int(tuft[3]) % 3):
            removed.append(ob.name)
            objects.remove(ob)
            bpy.data.objects.remove(ob, do_unlink=True)
    counts, goals = targets(name, objects)
    report = {"part": name, "budget": BUDGETS[name], "source": source_count,
              "components": [], "interiorTuftsOmitted": removed}
    finish = {"normals": [], "coordinates": []}
    for ob, count, goal in zip(objects, counts, goals):
        original_name = ob.name
        source = ob.copy()
        source.data = ob.data.copy()
        bpy.context.scene.collection.objects.link(source)
        source.hide_render = True
        structured = structured_copy(ob)
        if not structured and count > goal:
            modifier = ob.modifiers.new("Separate runtime component topology", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = max(.0001, goal/count*.998)
            modifier.use_collapse_triangulate = True
            bpy.ops.object.select_all(action="DESELECT")
            ob.select_set(True)
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        finish["normals"].extend(component_normals(ob, source, angle, structured))
        finish["coordinates"].extend(ob.data.vertices[loop.vertex_index].co.copy() for loop in ob.data.loops)
        old_data = source.data
        bpy.data.objects.remove(source, do_unlink=True)
        if old_data.users == 0:
            bpy.data.meshes.remove(old_data)
        report["components"].append({"name": original_name, "source": count,
                                     "target": goal, "runtime": vk.tris(ob), "structured": structured})
    report["runtime"] = sum(vk.tris(ob) for ob in objects)
    assert report["runtime"] <= BUDGETS[name], report
    REPORTS.append(report)
    print("VIKING_RUNTIME_PART", name, report["runtime"], flush=True)
    return finish


def finish_part(target, source):
    """Transfer after joining so bmesh joining cannot discard source normals."""
    assert len(target.data.loops) == len(source["normals"])
    for loop, coordinate in zip(target.data.loops, source["coordinates"]):
        assert (target.data.vertices[loop.vertex_index].co-coordinate).length < 1e-7, target.name
    target.data.normals_split_custom_set(source["normals"])
    assert target.data.has_custom_normals, f"Missing source normals on {target.name}"


def finish(root):
    meshes = [ob for ob in kit.descendants(root) if ob.type == "MESH"]
    actual = sum(vk.tris(ob) for ob in meshes)
    # Export creates one glTF primitive per used material on each part.
    draws = sum(len({p.material_index for p in ob.data.polygons}) for ob in meshes)
    assert actual <= CEILING, f"Viking {actual} exceeds inherited {CEILING} triangles"
    assert draws <= DRAW_CEILING, f"Viking {draws} exceeds inherited {DRAW_CEILING} draws"
    root["runtimeTriangles"] = actual
    root["runtimeDrawPrimitives"] = draws
    root["inheritedTriangleCeiling"] = CEILING
    root["inheritedDrawCeiling"] = DRAW_CEILING
    root["runtimeReduction"] = "separate named component topology with reviewed source normals"
    root["runtimeBudgetReport"] = json.dumps(REPORTS, separators=(",", ":"))
    kit.refresh()
    return REPORTS
