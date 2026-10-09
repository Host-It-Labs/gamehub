"""Detailed private 1917 Biplane and connected pilot master, revision v1.

Shaped fabric airframe retained from the shipped construction; rivet collars,
turnbuckles, fabric seam relief and cockpit hardware are refined here. The
ace is a new authored adult connected sculpt, never the detached capsule
pilot. Normal figure_drake.py is intentionally unchanged until root review.
"""
import math
import json
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

import kit
import figure_folk_kit as geo
import figure_drake_airframe as craft
from figure_drake_contract import contract
from figure_drake_anatomy import Human, V, attach, make_rig, tag

R = "drake"
BASE = Path(__file__).resolve().parents[3]/"work/arena/2026-10-08-roster/drake"
SHIFT = Matrix.Translation(V(0,-craft.COM.y,0))


def vehicle(rig,name,pieces,bone,budget,region):
    for obj in pieces:
        kit.apply(obj);kit.apply_transform(obj);obj.data.transform(SHIFT)
    obj = kit.join(pieces,R+"."+name)
    tag(obj,budget,region)
    kit.shade(obj,48)
    attach(obj,rig,bone)
    return obj


def hardware():
    fittings = []
    # Cowling fasteners sit on the alloy, in an ordered construction line.
    for i in range(28):
        a=i/28*math.tau
        p=V(math.cos(a)*.118,.485,craft.NOSE.z+math.sin(a)*.118)
        fittings.append(geo.ball(R+f".cowl-rivet-{i}",.0016,p,craft.BRASS,seg=8,rings=5))
    # Real barrel-shaped turnbuckles and ferrules on taut flying wires.
    for s in (-1,1):
        for y in (.065,.225):
            p=V(s*.105,y,.39)
            q=V(s*.365,y+.02,.58)
            direction=(q-p).normalized()
            c=p+direction*.065
            fittings.append(geo.tube(R+f".turnbuckle-{s}-{y}",[c-direction*.007,c+direction*.007],
                                     [.003,.003],craft.ALU,n=8,up=(0,1,0)))
    return fittings


def pigment(root,human):
    import numpy as np
    for obj in kit.descendants(root):
        if obj.type!="MESH":continue
        count=len(obj.data.loops)
        rgba=np.ones((count,4),dtype=np.float32)
        if obj.get("humanComponent") and "head-neck" in obj.name:
            for loop in obj.data.loops:
                p=human.inverse@obj.data.vertices[loop.vertex_index].co
                cheeks=math.exp(-((abs(p.x)-.065)/.026)**2-((p.z-1.162)/.026)**2)*max(0,p.y+.02)/.09
                rgba[loop.index,:3]=[1,.99-.08*cheeks,.985-.10*cheeks]
        elif obj.get("humanComponent") and "jacket" in obj.name:
            for loop in obj.data.loops:
                p=human.inverse@obj.data.vertices[loop.vertex_index].co
                wear=.025*math.exp(-((p.z-.76)/.11)**2)
                rgba[loop.index,:3]=[.97+wear,.97+wear,.97+wear]
        for name in ("Pigment","AO"):
            layer=obj.data.color_attributes.get(name) or obj.data.color_attributes.new(name,"FLOAT_COLOR","CORNER")
            layer.data.foreach_set("color",rgba.ravel())
        obj.data.color_attributes.active_color=obj.data.color_attributes["AO"]
        obj.data.color_attributes.render_color_index=list(obj.data.color_attributes).index(obj.data.color_attributes["AO"])


def build_master(memory=None):
    root=kit.empty(R);record=contract(R);rig=make_rig(root,record)
    fixed,ailerons=craft.wings(R)
    tails,elevators,rudder=craft.tail(R)
    gear,wheels=craft.gear(R)
    rack,bomb=craft.bomb(R)
    vehicle(rig,"doped-linen-wings",fixed,"torso",3800,"staggered two wings, ribs, scallops, ring roundels")
    vehicle(rig,"fabric-fuselage",craft.fuselage(R),"torso",1500,"shaped linen fuselage and metal forward panels")
    vehicle(rig,"rotary-engine-cowling",craft.cowling(R),"torso",1000,"rolled alloy cowling, nine radial cylinders, fins and pushrods")
    vehicle(rig,"varnished-struts",craft.struts(R),"torso",700,"interplane and cabane struts with metal fittings")
    vehicle(rig,"tensioned-wire-rigging",craft.rigging(R),"torso",1200,"flying landing incidence and cabane rigging")
    vehicle(rig,"tail-fixed",tails,"torso",550,"linen tailplane and fixed fin")
    vehicle(rig,"undercarriage",gear,"torso",550,"wooden V legs, bungees and tail skid")
    vehicle(rig,"cockpit-coaming",craft.cockpit(R),"torso",320,"open dark cockpit and rolled leather coaming")
    vehicle(rig,"bomb-rack",rack,"torso",180,"belly rack and sway braces")
    vehicle(rig,"airframe-fittings",hardware(),"torso",360,"cowling fasteners and ordered wire turnbuckles")
    for s,side in ((-1,"L"),(1,"R")):
        vehicle(rig,"aileron-"+side,ailerons[s],"wing"+side,300,"hinged upper aileron and rib tape")
    vehicle(rig,"hinged-elevators",elevators,"tail",360,"separate elevator pair")
    vehicle(rig,"hinged-rudder",rudder,"extra",260,"cream and cobalt articulated rudder")
    vehicle(rig,"wire-spoke-wheels",wheels,"wheels",600,"two tyres, hubs and spokes on axle")
    vehicle(rig,"iron-belly-bomb",bomb,"weapon",320,"bomb body fins fuze")
    blades,_=craft.propeller(R)
    vehicle(rig,"laminated-propeller",blades,"spin",650,"twisted wood blades, laminated plies, brass tips and alloy spinner")
    drop=kit.empty(R+".bomb",record["positions"]["weapon"])
    world=drop.matrix_world.copy();drop.parent,drop.parent_type,drop.parent_bone=rig,"BONE",R+".torso";drop.matrix_world=world
    if memory:memory("airframe-complete")
    human=Human(R,rig,memory);human.build();pigment(root,human)
    root["restPose"]=record["restPose"]
    root["privateMasterRevision"]="v1";root["unoptimized"]=True
    root["vehicleContract"]="torso airframe; wingL/R ailerons; tail elevators; extra rudder; spin propeller; wheels axle; weapon bomb; bomb drop marker"
    root["humanContract"]=json.dumps(record)
    kit.refresh()
    return root
