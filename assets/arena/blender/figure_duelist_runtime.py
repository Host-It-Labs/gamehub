"""Reduce a reviewed Samurai master copy; never lower its native scale.

V5's source and actual motion passed independent root review before this
module was introduced. Budgets preserve a strong face/hand/garment allocation
within the measured 19,140-triangle pre-rework ceiling. The detailed .blend
masters remain separate, unrestricted source artifacts.
"""
import json

import bpy
import bmesh

import kit

CEILING=19140
BUDGETS={
    "adult-head-shell":4460,
    "continuous-underrobe":2200,
    "continuous-hakamaL":1000,"continuous-hakamaR":1000,
    "foreL-shell":1300,"foreR-shell":1300,
    "browL":96,"browR":96,
    "eyeL":240,"eyeR":240,"pupilL":160,"pupilR":160,
    "mouth":100,"beard-shell":160,"cape-shell":450,
    "footL-shell":120,"footR-shell":120,"hat-shell":500,
    "kneeL-shell":210,"kneeR-shell":210,
    "legL-shell":92,"legR-shell":92,
    "skirtL-shell":600,"skirtR-shell":600,
    "sleeveL-shell":340,"sleeveR-shell":340,
    "tail-shell":260,"torso-shell":2140,
    # Blade, tip, grip length and edge samples are deliberately unchanged.
    "weapon-shell":548,
}


def triangles(obj):
    return sum(len(p.vertices)-2 for p in obj.data.polygons)


def normalized_weights(obj):
    for vertex in obj.data.vertices:
        weights=[(g.group,g.weight) for g in vertex.groups if g.weight>0]
        total=sum(w for _,w in weights)
        if total<=0:
            raise ValueError(f"Unweighted runtime cloth vertex {obj.name}:{vertex.index}")
        for index,weight in weights:
            obj.vertex_groups[index].add([vertex.index],weight/total,"REPLACE")


def collapse(obj,target):
    before=triangles(obj)
    if before<=target:
        return before
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active=obj
    # Collapse the undeformed authored cage; leave its real armature intact.
    skins=[m for m in obj.modifiers if m.type=="ARMATURE"]
    states=[(m,m.show_viewport,m.show_render) for m in skins]
    for m in skins:
        m.show_viewport=m.show_render=False
    try:
        for attempt in range(3):
            current=triangles(obj)
            if current<=target:
                break
            mod=obj.modifiers.new("Measured separate runtime surface", "DECIMATE")
            mod.decimate_type="COLLAPSE"
            mod.ratio=max(.00001,(target-.8)/current)
            mod.use_collapse_triangulate=True
            bpy.ops.object.modifier_apply(modifier=mod.name)
        after=triangles(obj)
        assert after<=target,f"{obj.name} exceeded its deliberate part budget: {after}/{target}"
        if skins:
            normalized_weights(obj)
        return after
    finally:
        for m,viewport,render in states:
            m.show_viewport,m.show_render=viewport,render


def clean_subset(mesh,keep):
    bm=bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.index not in keep],context="FACES")
    bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context="VERTS")
    bm.to_mesh(mesh)
    bm.free()


def source_preserving_collapse(obj,target,faces):
    """Protect exact source faces at material seams, without replacing nodes."""
    keeper=obj.data.copy()
    keep=set(faces)
    clean_subset(keeper,keep)
    protected=sum(len(f.vertices)-2 for f in keeper.polygons)
    assert protected<target
    clean_subset(obj.data,set(range(len(obj.data.polygons)))-keep)
    collapse(obj,target-protected)
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bm.from_mesh(keeper)
    bm.to_mesh(obj.data)
    bm.free()
    bpy.data.meshes.remove(keeper)
    obj["sourceProtectedTriangles"]=protected
    assert triangles(obj)<=target
    return triangles(obj)


def collar_faces(obj):
    """Identify the native neck collar island rather than the whole torso."""
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    bm.faces.ensure_lookup_table()
    visited=set();found=[]
    for seed in bm.verts:
        if seed in visited:
            continue
        component={seed};todo=[seed]
        while todo:
            vertex=todo.pop()
            for edge in vertex.link_edges:
                other=edge.other_vert(vertex)
                if other not in component:
                    component.add(other);todo.append(other)
        visited.update(component)
        points=[obj.matrix_world@v.co for v in component]
        lo=[min(p[i] for p in points) for i in range(3)]
        hi=[max(p[i] for p in points) for i in range(3)]
        if lo[0]<-.08 and hi[0]>.08 and hi[1]-lo[1]>.13 and .985<lo[2]<1.001 and 1.045<hi[2]<1.053:
            found.append({f.index for v in component for f in v.link_faces})
    assert len(found)==1,"Protect exactly the native standing collar"
    bm.free()
    return found[0]


def reduce_runtime(root):
    if not root.get("unoptimized",True):
        raise ValueError("Runtime reduction starts only from a separate detailed source copy")
    report=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":
            continue
        key=obj.name.removeprefix(root.name+".")
        assert key in BUDGETS,f"Measure the new Samurai part before reducing it: {key}"
        before=triangles(obj)
        if key=="adult-head-shell":
            # The lacquer bowl, gold band, crest and descending visor are
            # source engineering. Global collapse can move their shared
            # blue/gold boundaries, so retain these surfaces byte-for-byte.
            metal={i for i,m in enumerate(obj.data.materials) if m.name.split(":")[0] in ("lacquer","gilt")}
            keep=[f.index for f in obj.data.polygons if f.material_index in metal]
            after=source_preserving_collapse(obj,BUDGETS[key],keep)
        elif key=="torso-shell":
            after=source_preserving_collapse(obj,BUDGETS[key],collar_faces(obj))
        else:
            after=collapse(obj,BUDGETS[key])
        report.append({"name":obj.name,"source":before,"target":BUDGETS[key],"runtime":after,
                       "vertices":len(obj.data.vertices),"skinned":any(m.type=="ARMATURE" for m in obj.modifiers),
                       "sourceProtectedTriangles":obj.get("sourceProtectedTriangles",0)})
    total=sum(p["runtime"] for p in report)
    assert total<=CEILING,f"Samurai {total} triangles exceeded measured original {CEILING}"
    root["unoptimized"]=False
    root["runtimeTriangles"]=total
    root["runtimeCeiling"]=CEILING
    root["runtimeReduction"]=json.dumps(report)
    root["runtimeMethod"]="separate V5 copy; exact source helmet/collar/blade; curvature collapse with real skin interpolation; native scale 1"
    print("DUELIST_RUNTIME",json.dumps({"triangles":total,"ceiling":CEILING,"parts":report}),flush=True)
    return root
