"""Private hot-air Balloon and elderly aviatrix detailed master, v1.

Retains measured source profile, basket footprint and suspension pivot.
Authored gore seams, layered wicker reeds, binding stakes, load-ring
hardware and a working burner distinguish it from a smooth generic sphere.
The aviatrix is an adult connected sculpt in cobalt, with white swept hair,
brass goggles, an effort mouth and five-digit gloves around a working bomb.
"""
import math
import json
from pathlib import Path

import numpy as np
from mathutils import Vector

import kit
import figure_folk_kit as geo
import figure_balloon_craft as craft
from figure_drake_contract import contract
from figure_drake_anatomy import Human, V, attach, make_rig, tag
from figure_drake_sculpt import pigment

R="balloon"
BASE=Path(__file__).resolve().parents[3]/"work/arena/2026-10-08-roster/balloon"


def vehicle(rig,name,pieces,bone,budget,region):
    obj=kit.join(pieces,R+"."+name)
    tag(obj,budget,region);kit.shade(obj,55);attach(obj,rig,bone)
    return obj


def envelope():
    # Add source sampling, keeping the approved radius and footprint.
    n=144; zs=[z for _,z in craft.envelope_profile(samples=5) if z<1.966]
    builder=geo.Mesh(R+".envelope-source",craft.TEAM)
    rows=[]
    for z in zs:
        rows.append([builder.v(craft.env_point(i/n*math.tau+math.pi/craft.GORES,z)) for i in range(n)])
    def material(i,j):
        z=(zs[j]+zs[j+1])/2
        return craft.TEAM2 if z>1.90 else craft.TEAM if (i//12)%2==0 else craft.CREAM
    builder.grid(rows,material,closed=True)
    builder.fan(rows[-1],V(0,0,1.966),craft.TEAM2)
    inner=[builder.v(V(v.co.x*.80,v.co.y*.80,v.co.z+.028)) for v in rows[0]]
    builder.grid([inner,rows[0]],craft.CREAM,closed=True)
    return [builder.obj(outward=V(0,0,1.35))]


def gore_seams():
    pieces=[]
    for k in range(craft.GORES):
        phi=k/craft.GORES*math.tau+math.pi/craft.GORES
        path=[craft.env_point(phi,float(z),.0016) for z in np.linspace(.765,1.942,72)]
        pieces.append(geo.tube(R+f".reinforced-gore-seam-{k}",path,[.0018]*72,craft.CREAM,n=5,
                              up=(1,0,0),caps=(None,None)))
    return pieces


def wicker():
    pieces=[]
    # Unequal radii and over/under offsets make an actual woven wall. Keep
    # the existing lined basket: the reeds sit just outside its wall.
    for j in range(17):
        z=.017+j*.0105
        path=[]
        for i in range(97):
            a=i/96*math.tau
            off=.004+.0021*math.cos(a*24+math.pi*j)
            path.append(craft.basket_point(a,z,off))
        pieces.append(geo.tube(R+f".wicker-course-{j}",path,[(.0038,.0042)]*97,craft.WICKER,n=6,
                              up=(0,0,1),caps=(None,None)))
    for i in range(24):
        a=i/24*math.tau
        path=[craft.basket_point(a,float(z),.006+.0018*math.cos(float(z)*math.pi/.0105+i*math.pi))
              for z in np.linspace(.015,.20,30)]
        pieces.append(geo.tube(R+f".binding-stake-{i}",path,[.0027]*30,craft.ROPE,n=5,
                              up=(1,0,0),caps=(None,None)))
    return pieces


def burner():
    pieces=[]
    # Compact heat shield and copper coil stand below the envelope mouth.
    # This is a hot-air craft; there is no gas-valve fiction in the model.
    copper="tin:"+kit.tint("balloon-burner-copper","#b77542")
    iron="tin:"+kit.tint("balloon-burner-iron","#3b4148")
    for s in (-1,1):
        for y in (-.043,.043):
            pieces.append(geo.tube(R+f".burner-frame-{s}-{y}",[V(s*.047,y,.618),V(s*.047,y,.712)],
                                   [.0035,.0035],iron,n=8,up=(0,1,0)))
    path=[]
    for i in range(180):
        a=i/179*math.tau*5
        path.append(V(math.cos(a)*.036,math.sin(a)*.036,.645+i/179*.054))
    pieces.append(geo.tube(R+".burner-helical-coil",path,[.0032]*180,copper,n=8,up=(0,0,1)))
    rings=[[V(math.cos(a)*r,math.sin(a)*r,z) for a in np.linspace(0,math.tau,40,endpoint=False)]
           for r,z in ((.043,.635),(.043,.641),(.048,.707),(.045,.713))]
    pieces.append(geo.loft(R+".burner-heat-shield",rings,iron,start=None,end=None))
    return pieces


def rigging_hardware():
    pieces=[]
    for i in range(12):
        a=i/12*math.tau
        c=V(math.cos(a)*craft.RING_R,math.sin(a)*craft.RING_R,.645)
        path=[c+V(math.cos(b)*.007,0,math.sin(b)*.011) for b in np.linspace(0,math.tau,33)]
        pieces.append(geo.tube(R+f".load-ring-eye-{i}",path,[.0025]*33,craft.BRASS,n=6,up=(0,1,0),caps=(None,None)))
    return pieces


def working_bomb(rig):
    iron="tin:"+kit.tint("balloon-bomb-iron","#252932")
    c=V(0,.125,.305)
    pieces=[geo.ball(R+".working-bomb-shell",.043,c,iron,seg=64,rings=36)]
    rings=[[c+V(math.cos(a)*radius,math.sin(a)*radius,z) for a in np.linspace(0,math.tau,32,endpoint=False)]
           for radius,z in ((.009,.039),(.012,.045),(.009,.051))]
    pieces.append(geo.loft(R+".working-bomb-fuze",rings,craft.BRASS,start="flat",end="flat"))
    path=[c+V(0,0,.050),c+V(.004,0,.060),c+V(.013,0,.066)]
    pieces.append(geo.tube(R+".working-bomb-fuse",path,[.0025]*3,craft.ROPE,n=8))
    return vehicle(rig,"working-bomb",pieces,"weapon",650,"black bomb with brass fuze and curved wick, tracked by both hands")


def build_master(memory=None):
    record=contract(R);root=kit.empty(R);rig=make_rig(root,record)
    vehicle(rig,"twelve-gore-envelope",envelope(),"torso",3800,"twelve inflated fabric gores with alternating cobalt and cream")
    vehicle(rig,"reinforced-gore-seams",gore_seams(),"torso",900,"load-carrying longitudinal seams")
    vehicle(rig,"diamond-rope-net",craft.net(),"torso",3000,"diamond rope net, twelve gathering lines and load ring")
    vehicle(rig,"lined-wicker-basket",craft.basket(),"basket",1100,"lined flared wicker shell, padded rim, four suspension ropes and skids")
    vehicle(rig,"woven-reed-construction",wicker(),"basket",3400,"seventeen over-and-under courses, twenty-four binding stakes")
    vehicle(rig,"sandbags-and-rack",craft.sandbags()+craft.bomb_rack(),"basket",950,"sandbags tied to rim and three black bombs in the side rack")
    vehicle(rig,"burner-construction",burner(),"torso",650,"metal burner frame, copper coil, vented heat shield below throat")
    vehicle(rig,"load-ring-hardware",rigging_hardware(),"torso",350,"brass suspension eyes at load-ring joints")
    working_bomb(rig)
    marker=kit.empty(R+".bomb",(0,.13,.20));world=marker.matrix_world.copy()
    marker.parent,marker.parent_type,marker.parent_bone=rig,"BONE",R+".basket";marker.matrix_world=world
    if memory:memory("balloon-craft-complete")
    human=Human(R,rig,memory);human.build();pigment(root,human)
    root["privateMasterRevision"]="v1";root["unoptimized"]=True
    root["restPose"]=record["restPose"]
    root["vehicleContract"]="torso envelope; basket suspension; weapon working bomb at rack pivot; bomb projectile marker"
    root["humanContract"]=json.dumps(record)
    kit.refresh();return root
