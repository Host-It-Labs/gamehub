"""Filtered Samurai source/copy evidence, preserving every version separately.

Blender -b -t 4 --factory-startup --python figure_duelist_review.py -- BASE
Options: --load MASTER.blend, --views labels, --runtime, --export path.glb.
No shared bundle or manifest is written.
"""
import hashlib
import json
import math
import os
import shutil
import struct
import sys
from pathlib import Path

import bpy
import bmesh
import numpy as np
from mathutils import Vector

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
sys.dont_write_bytecode=True
import kit
import figure_duelist
import figure_duelist_kit as dk
import figure_duelist_sculpt as sculpt


def bounds(root):
    kit.refresh()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":
            continue
        ev=obj.evaluated_get(depsgraph)
        mesh=ev.to_mesh()
        try:
            coords=np.empty(len(mesh.vertices)*3,dtype=np.float64)
            mesh.vertices.foreach_get("co",coords)
            matrix=np.asarray(ev.matrix_world)
            points.append(coords.reshape(-1,3)@matrix[:3,:3].T+matrix[:3,3])
        finally:
            ev.to_mesh_clear()
    p=np.concatenate(points)
    return Vector(np.min(p,axis=0)),Vector(np.max(p,axis=0))


def render(root,path,elevation,azimuth,size=(1000,1000),focus=None,extent=None,samples=24):
    scene=bpy.context.scene
    scene.render.engine="BLENDER_EEVEE" if os.environ.get("DUELIST_STUDIO") != "cycles" else "CYCLES"
    scene.cycles.samples=samples
    scene.cycles.use_denoising=True
    scene.cycles.device="CPU"
    scene.render.threads_mode="FIXED"
    scene.render.threads=4
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.resolution_percentage=100
    scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    world=scene.world or bpy.data.worlds.new("Samurai review world")
    scene.world=world
    world.use_nodes=True
    world.node_tree.nodes["Background"].inputs[0].default_value=(.20,.215,.23,1)
    world.node_tree.nodes["Background"].inputs[1].default_value=.7
    lo,hi=bounds(root)
    target=Vector(focus) if focus else (lo+hi)/2
    data=bpy.data.cameras.new("Samurai orthographic review")
    data.type="ORTHO"
    camera=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(camera)
    el,az=math.radians(elevation),math.radians(azimuth)
    camera.location=target+Vector((math.sin(az)*math.cos(el),math.cos(az)*math.cos(el),math.sin(el)))*12
    camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
    scene.camera=camera
    frame=camera.rotation_euler.to_matrix().inverted()
    corners=[frame@(Vector((x,y,z))-target) for x in (lo.x,hi.x) for y in (lo.y,hi.y) for z in (lo.z,hi.z)]
    width=max(v.x for v in corners)-min(v.x for v in corners)
    height=max(v.y for v in corners)-min(v.y for v in corners)
    data.ortho_scale=extent or max(height,width*size[1]/size[0])*1.17
    lights=[]
    for label,offset,energy,area in (("key",(-4,4,7),720,5),
                                     ("fill",(5,3,4),360,5),("rim",(0,-5,6),620,4)):
        ld=bpy.data.lights.new("Samurai "+label,"AREA")
        ld.energy,ld.shape,ld.size=energy,"DISK",area
        light=bpy.data.objects.new(ld.name,ld)
        scene.collection.objects.link(light)
        light.location=target+Vector(offset)
        light.rotation_euler=(target-light.location).to_track_quat("-Z","Y").to_euler()
        lights.append(light)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,lo.z-.002))
    floor=bpy.context.object
    floor.name="Samurai review floor"
    fm=bpy.data.materials.new("Samurai floor")
    fm.use_nodes=True
    bsdf=fm.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(.20,.215,.23,1)
    bsdf.inputs["Roughness"].default_value=1
    floor.data.materials.append(fm)
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
    for obj in [camera,floor]+lights:
        bpy.data.objects.remove(obj,do_unlink=True)
    print("DUELIST_RENDER",path,flush=True)


def clay_materials(root):
    mat=bpy.data.materials.new("Samurai neutral clay")
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value=(.48,.49,.50,1)
    bsdf.inputs["Roughness"].default_value=.76
    originals={}
    for obj in kit.descendants(root):
        if obj.type=="MESH":
            originals[obj.name]=list(obj.data.materials)
            for i in range(len(obj.data.materials)):
                obj.data.materials[i]=mat
    return originals


def materials_back(root,originals):
    for obj in kit.descendants(root):
        if obj.type=="MESH" and obj.name in originals:
            for i,mat in enumerate(originals[obj.name]):
                obj.data.materials[i]=mat


def pose(rig,values):
    for key,value in values.items():
        bone=rig.pose.bones.get(rig.parent.name+key)
        if bone:
            bone.rotation_mode="QUATERNION"
            bone.rotation_quaternion=dk.runtime_quat(*value)
    kit.refresh()


def triangle_report(root):
    depsgraph=bpy.context.evaluated_depsgraph_get()
    report=[]
    for obj in kit.descendants(root):
        if obj.type!="MESH":
            continue
        ev=obj.evaluated_get(depsgraph)
        mesh=ev.to_mesh()
        report.append({"name":obj.name,"triangles":sum(len(p.vertices)-2 for p in mesh.polygons),
                       "vertices":len(mesh.vertices),"skinned":any(m.type=="ARMATURE" for m in obj.modifiers)})
        ev.to_mesh_clear()
    return report


def export_review(root,path):
    kit.export([root],str(path))
    blob=Path(path).read_bytes()
    length,kind=struct.unpack_from("<II",blob,12)
    assert kind==0x4E4F534A
    gltf=json.loads(blob[20:20+length])
    tri=sum(gltf["accessors"][p["indices"]]["count"]//3 for mesh in gltf["meshes"] for p in mesh["primitives"])
    skins=gltf.get("skins",[])
    assert len(skins)==1,"Native drivers share one Samurai-local skeleton"
    assert all("COLOR_1" not in p["attributes"] for m in gltf["meshes"] for p in m["primitives"])
    return {"path":str(path),"bytes":len(blob),"sha256":hashlib.sha256(blob).hexdigest(),
            "triangles":tri,"skins":len(skins),"joints":[gltf["nodes"][j]["name"] for j in skins[0]["joints"]]}



def refresh_cloth(root):
    """Contained V3 refinement of V2: keep its head, hands and hard armour."""
    d=figure_duelist
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    t=root.name
    for obj in list(kit.descendants(root)):
        if obj.type=="MESH" and obj.name in (t+".continuous-underrobe",t+".continuous-hakamaL",t+".continuous-hakamaR"):
            bpy.data.objects.remove(obj,do_unlink=True)
    arms={}
    for side,s,hand,pole in (("L",-1,d.HAND_L,dk.V(-.55,0,.62)),("R",1,d.HAND_R,dk.V(.55,0,.62))):
        shoulder,elbow,wrist=sculpt.arm_points(d,s,hand,pole)
        arms[side]=(s,shoulder,elbow,wrist,hand)
    robe=sculpt.robe(d,t,arms)
    sculpt.weight_robe(robe,rig,arms)
    for side,s in (("L",-1),("R",1)):
        lower,_,_,_=sculpt.lower_cloth(d,t,side,s)
        sculpt.weight_leg(lower,rig,side)
    sculpt.fine_materials(root)
    root["sourceVersion"]="V3 contained collar coverage and tensioned hakama pleat refinement"
    kit.refresh()


def refresh_hard_clearance(root):
    """V4 fits splints to the reviewed cloth while preserving exact V3 hands."""
    d=figure_duelist
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    robe=bpy.data.objects[root.name+".continuous-underrobe"]
    for side,s,hand,pole in (("L",-1,d.HAND_L,dk.V(-.55,0,.62)),("R",1,d.HAND_R,dk.V(.55,0,.62))):
        obj=bpy.data.objects[root.name+".fore"+side+"-shell"]
        world=obj.matrix_world.copy()
        bm=bmesh.new()
        bm.from_mesh(obj.data)
        remove=[f for f in bm.faces if obj.data.materials[f.material_index].name!=sculpt.SKIN]
        bmesh.ops.delete(bm,geom=remove,context="FACES")
        loose=[v for v in bm.verts if not v.link_faces]
        bmesh.ops.delete(bm,geom=loose,context="VERTS")
        for face in bm.faces:
            face.material_index=0
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.materials.clear()
        obj.data.materials.append(kit.material(sculpt.SKIN))
        obj.parent=None
        obj.matrix_world=world
        shoulder,elbow,wrist=sculpt.arm_points(d,s,hand,pole)
        kn=hand-elbow
        kn-=d.D*kn.dot(d.D)
        kn.normalize()
        objects=sculpt.arm_iron(d,root.name,side,s,shoulder,elbow,wrist,robe)
        objects+=[obj,sculpt.hand_plate(d,side,hand,kn)]
        sculpt.part(d,root.name,rig,"fore"+side,objects)
    root["sourceVersion"]="V4 exact V3 hands retained; metal splints fitted to connected garment surface"
    kit.refresh()


def refresh_visor(root):
    """Replace only the disconnected old visor; preserve face/control objects."""
    d=figure_duelist
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    pose(rig,{"head":(0,0,0)})
    obj=bpy.data.objects[root.name+".adult-head-shell"]
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    visited=set()
    old=[]
    for seed in bm.verts:
        if seed in visited:
            continue
        component=set([seed]);todo=[seed]
        while todo:
            v=todo.pop()
            for edge in v.link_edges:
                nxt=edge.other_vert(v)
                if nxt not in component:
                    component.add(nxt);todo.append(nxt)
        visited.update(component)
        if not 50<=len(component)<=90:
            continue
        coords=np.array([v.co+d.NECK for v in component])
        lo,hi=coords.min(axis=0),coords.max(axis=0)
        if lo[0]<-.12 and hi[0]>.12 and lo[1]>.040 and 1.210<lo[2]<1.23 and 1.245<hi[2]<1.260:
            old.append(component)
    assert len(old)==1,"Identify exactly the preserved old visor island"
    print("DUELIST_VISOR_REPLACEMENT",len(old[0]),flush=True)
    bmesh.ops.delete(bm,geom=list(old[0]),context="VERTS")
    peak=d.kabuto_visor(root.name)
    peak.data.transform(obj.matrix_world.inverted()@peak.matrix_world)
    offset=len(obj.data.materials)
    for mat in peak.data.materials:
        obj.data.materials.append(mat)
    for face in peak.data.polygons:
        face.material_index+=offset
    sculpt.white_colors(peak)
    bm.from_mesh(peak.data)
    bm.to_mesh(obj.data)
    bm.free()
    bpy.data.objects.remove(peak,do_unlink=True)
    root["sourceVersion"]="V5 exact V4 source retained; descending visor lip clears gold bowl band"
    kit.refresh()


def main():
    args=sys.argv[sys.argv.index("--")+1:]
    base=Path(args[0]).resolve()
    base.parent.mkdir(parents=True,exist_ok=True)
    if "--load" in args:
        bpy.ops.wm.open_mainfile(filepath=str(Path(args[args.index("--load")+1]).resolve()))
        root=bpy.data.objects["duelist"]
    else:
        kit.reset(seed=33)
        root=sculpt.build_master()
    rig=next(o for o in kit.descendants(root) if o.type=="ARMATURE")
    if "--refresh-cloth" in args:
        refresh_cloth(root)
    if "--refresh-armour" in args:
        refresh_hard_clearance(root)
    if "--refresh-visor" in args:
        refresh_visor(root)
    # V1-V3 dropped this old robe from the character hierarchy without
    # deleting its construction mesh. It never exported, but polluted clay
    # and pose review as a faceted dark oval beneath the raised sleeves.
    obsolete=bpy.data.objects.get(root.name+"-robe")
    if obsolete is not None and obsolete not in kit.descendants(root):
        bpy.data.objects.remove(obsolete,do_unlink=True)
    if "--runtime" in args:
        import figure_duelist_runtime
        figure_duelist_runtime.reduce_runtime(root)
    sculpt.finish_ao(root)
    # Equivalent to figures.py's established adult five-degree head lift.
    pose(rig,{"head":(math.radians(5),0,0)})
    master=Path(str(base)+"-master.blend")
    bpy.ops.wm.save_as_mainfile(filepath=str(master))
    parts=triangle_report(root)
    lo,hi=bounds(root)
    evidence={"master":str(master),"stage":"runtime copy" if "--runtime" in args else "detailed source review",
              "optimized":"--runtime" in args,"triangles":sum(p["triangles"] for p in parts),
              "parts":parts,"nativeScale":1.0,"bounds":{"min":list(lo),"max":list(hi)},
              "dimensions":list(hi-lo),"skeleton":[b.name for b in rig.data.bones]}
    descendants=set(kit.descendants(root))
    evidence["unattachedMeshes"]=[o.name for o in bpy.context.scene.objects if o.type=="MESH" and o not in descendants]
    assert not evidence["unattachedMeshes"],"Every visible construction mesh must belong to the reviewed character"
    names=["figure_duelist.py","figure_duelist_sculpt.py","figure_duelist_review.py"]
    if "--runtime" in args:
        names.append("figure_duelist_runtime.py")
        evidence["runtimeCeiling"]=root["runtimeCeiling"]
        evidence["reduction"]=json.loads(root["runtimeReduction"])
    for name in names:
        shutil.copyfile(HERE/name,str(base)+"-"+name+".txt")
    if "--export" in args:
        export=Path(args[args.index("--export")+1]).resolve()
        evidence["glb"]=export_review(root,export)
    Path(str(base)+"-evidence.json").write_text(json.dumps(evidence,indent=2)+"\n")
    print("DUELIST_MASTER",json.dumps(evidence),flush=True)
    if "--skip-renders" in args:
        return
    requested=None
    if "--views" in args:
        requested=set(args[args.index("--views")+1].split(","))
    originals=clay_materials(root)
    views=[("front",0,0,(1000,1100),None,None),
           ("side",0,90,(1100,1100),None,None),
           ("rear",0,180,(1000,1100),None,None),
           ("three-quarter",12,-35,(1100,1100),None,None),
           ("game-55",55,-15,(1000,1000),None,None),
           ("game-70",70,0,(800,1000),None,None),
           ("face",8,-25,(1200,1000),(0,.030,1.170),.34),
           ("grip",17,30,(1200,1000),(.012,.341,.749),.28),
           ("grip-front",5,-20,(1200,1000),(.012,.341,.749),.28)]
    for label,el,az,size,focus,extent in views:
        if requested is None or label in requested:
            render(root,str(base)+"-clay-"+label+".png",el,az,size,focus,extent)
    rest={b.name:b.rotation_quaternion.copy() for b in rig.pose.bones}
    for label,poses,el,az in (("overhead",figure_duelist.POSES["jodan"],10,-35),
                               ("cleave",figure_duelist.POSES["cut"],10,-35),
                               ("coil",figure_duelist.POSES["coil"],14,-35)):
        if requested is None or label in requested:
            poses=dict(poses)
            hx,hy,hz=poses.get("head",(0,0,0))
            poses["head"]=(hx+math.radians(5),hy,hz)
            pose(rig,poses)
            render(root,str(base)+"-clay-"+label+".png",el,az,(1100,1100))
            for b in rig.pose.bones:
                b.rotation_quaternion=rest[b.name]
            kit.refresh()
    materials_back(root,originals)
    for label,el,az,size,focus,extent in [("three-quarter",12,-35,(1100,1100),None,None),
                                        ("face",8,-25,(1200,1000),(0,.03,1.170),.34),
                                        ("grip",17,30,(1200,1000),(.012,.341,.749),.28),
                                        ("grip-front",5,-20,(1200,1000),(.012,.341,.749),.28),
                                        ("game",55,-15,(1000,1000),None,None)]:
        if requested is None or "material-"+label in requested:
            render(root,str(base)+"-material-"+label+".png",el,az,size,focus,extent)
    for label,poses,el,az in (("overhead",figure_duelist.POSES["jodan"],10,-35),
                             ("coil",figure_duelist.POSES["coil"],14,-35)):
        if requested is None or "material-"+label in requested:
            poses=dict(poses)
            hx,hy,hz=poses.get("head",(0,0,0))
            poses["head"]=(hx+math.radians(5),hy,hz)
            pose(rig,poses)
            render(root,str(base)+"-material-"+label+".png",el,az,(1100,1100))
            for bone in rig.pose.bones:
                bone.rotation_quaternion=rest[bone.name]
            kit.refresh()
    print("DUELIST_REVIEW_DONE",str(base),flush=True)


if __name__=="__main__":
    main()
