"""Mage-only source evidence. No manifest or other figure is written."""
import argparse
import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import kit
import figure_mage as original
REVIEW_PREFIX = 'mage-master'


def material(name, color, roughness=.7, metallic=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return m


def camera(at, elevation, azimuth, scale, size=900):
    scene = bpy.context.scene
    if scene.camera:
        old = scene.camera
        bpy.data.objects.remove(old, do_unlink=True)
    data = bpy.data.cameras.new('Wizard review camera')
    data.type = 'ORTHO'
    data.ortho_scale = scale
    o = bpy.data.objects.new('Wizard review camera', data)
    scene.collection.objects.link(o)
    el, az = math.radians(elevation), math.radians(azimuth)
    at = Vector(at)
    o.location = at + Vector((math.sin(az)*math.cos(el), math.cos(az)*math.cos(el), math.sin(el))) * 5
    o.rotation_euler = (at-o.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera = o
    scene.render.resolution_x = scene.render.resolution_y = size


def light(name, at, target, energy, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape, data.size = energy, color, 'DISK', size
    o = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(o)
    o.location = at
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()


def studio():
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 28
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('Wizard neutral studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16,.18,.21,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    light('large neutral key', (-2.2,3.4,4.2), (0,0,.75), 190, (1,.91,.8), 3)
    light('soft fill', (3,1.3,2.2), (0,0,.8), 100, (.82,.9,1), 3)
    light('quiet rim', (.5,-3,3), (0,0,.8), 180, (.83,.9,1), 2.5)
    plane = kit.box('__mage-review-floor', (200,200,.02), (0,0,-.02), grid=False)
    plane.data.materials.append(material('Wizard studio floor', (.19,.205,.23), .95))


def pose(root, values):
    rig = next((o for o in kit.descendants(root) if o.type == 'ARMATURE'), None)
    if rig:
        for bone in rig.pose.bones:
            key = bone.name.removeprefix('mage').lstrip('.')
            bone.rotation_mode = 'XYZ'
            bone.rotation_euler = values.get(key, (0,0,0))
    else:
        for o in kit.descendants(root):
            key = o.name.removeprefix('mage').lstrip('.')
            if key in values:
                o.rotation_euler = values[key]
    kit.refresh()


def render(root, out, version, name, at, el, az, scale, clay=False, size=900):
    camera(at, el, az, scale, size)
    # Neutral-lit fast review renders expose the same full-resolution source
    # without waiting on the shared GPU's Cycles clients.
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    layer = bpy.context.view_layer
    layer.material_override = material('Wizard neutral clay', (.51,.53,.55), .75) if clay else None
    path = os.path.join(out, f'{REVIEW_PREFIX}-v{version}-{name}.png')
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    layer.material_override = None
    print('MAGE_REVIEW', path)


def main():
    global REVIEW_PREFIX
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default='1')
    parser.add_argument('--legacy', action='store_true')
    parser.add_argument('--runtime', action='store_true')
    parser.add_argument('--quick', action='store_true')
    parser.add_argument('--from-blend')
    parser.add_argument('--skip-bake', action='store_true')
    parser.add_argument('--nail-refinement', action='store_true')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.runtime:
        REVIEW_PREFIX = 'mage-runtime'
    base = os.path.join(kit.ROOT, 'work/arena/2026-10-04-three-characters/mage', 'v'+args.version)
    os.makedirs(base, exist_ok=True)
    kit.reset(seed=33)
    if args.from_blend:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.from_blend))
        root=bpy.data.objects['mage']
        import figure_mage_surface
        import figure_mage_sculpt
        # A finish-only review reads the exact saved editable source. It does
        # not regenerate the anatomy or disguise a geometry change.
        for o in kit.descendants(root):
            if o.type=='MESH':
                for i,m in enumerate(o.data.materials):
                    if m.name=='weave:team':
                        o.data.materials[i]=kit.material(original.TEAM)
                    elif m.name=='weave:team2':
                        o.data.materials[i]=kit.material(original.TEAM2)
        figure_mage_surface.configure(root)
        if args.nail_refinement:
            figure_mage_sculpt.refine_casting_nails(root)
        if args.runtime:
            import figure_mage_runtime
            try:
                root = figure_mage_runtime.reduce_runtime(root)
            except Exception:
                bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base,f'{REVIEW_PREFIX}-v{args.version}-rejected.blend'))
                raise
    elif args.legacy:
        root = getattr(original, 'build_legacy', original.build)()
    elif args.runtime:
        import figure_mage_runtime
        root = figure_mage_runtime.build_runtime()
    else:
        import figure_mage_sculpt
        root = figure_mage_sculpt.build_master()
    root.location = (0,0,0)
    kit.refresh()
    meshes = [o for o in kit.descendants(root) if o.type == 'MESH']
    # Save the editable geometry before any renderer bake can fail or stall.
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(base,f'{REVIEW_PREFIX}-v{args.version}-before-ao.blend'))
    if not args.quick and not args.skip_bake and not args.from_blend:
        kit.bake_ao(meshes, samples=32, distance=.15)
    if not args.legacy and not args.quick and not args.skip_bake and not args.from_blend:
        import figure_mage_sculpt
        figure_mage_sculpt.finish_ao(root)
    rig = next((o for o in kit.descendants(root) if o.type=='ARMATURE'), None)
    for o in meshes:
        for poly in o.data.polygons:
            poly.use_smooth = True
    blend = os.path.join(base, f'{REVIEW_PREFIX}-v{args.version}.blend')
    bpy.ops.wm.save_as_mainfile(filepath=blend)
    target = os.path.join(base, f'{REVIEW_PREFIX}-v{args.version}.glb')
    kit.export([root], target)
    if not args.legacy:
        dev = os.path.join(kit.ROOT, f'public/3d/arena/dev/three-mage-master-v{args.version}.glb')
        import shutil
        shutil.copy2(target, dev)
    report = {'version': args.version, 'runtime': args.runtime, 'triangles': sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
              'meshes': len(meshes), 'materials': sorted({m.name for o in meshes for m in o.data.materials}),
              'bytes': os.path.getsize(target), 'blend': blend, 'glb': target,
              'joints': {b.name:list(b.head_local) for b in rig.data.bones} if rig else {o.name:list(o.matrix_world.translation) for o in meshes}}
    with open(os.path.join(base, 'measurements.json'), 'w') as f:
        json.dump(report,f,indent=2)
    studio()
    views = [('clay-front', (0,0,.75), 2, 0, 1.8, True),
             ('clay-side', (0,0,.75), 2, 90, 1.8, True),
             ('clay-rear', (0,0,.75), 2, 180, 1.8, True),
             ('clay-three-quarter', (0,0,.75), 10, 30, 1.8, True),
             ('material-three-quarter', (0,0,.75), 10, 30, 1.8, False),
             ('material-face', (0,.06,1.052), 8, 25, .38, False),
             ('clay-face', (0,.06,1.052), 8, 25, .38, True),
             ('clay-grip', (.332,.158,.72), 25, 65, .24, True),
             ('material-palm', (-.244,.239,.82), 55, -5, .24, False),
             ('material-fabric', (-.09,0,.53), 18, -32, .65, False),
             ('game-portrait', (0,0,.75), 63, 0, 1.8, False),
             ('game-landscape', (0,0,.75), 55, 80, 1.8, False)]
    if args.quick:
        views = views[:4]
    if args.nail_refinement:
        views = [v for v in views if v[0] in ('material-three-quarter','material-palm')]
        views.append(('material-palm-nails',(-.244,.239,.82),15,-50,.24,False))
    for name, at, el, az, scale, clay in views:
        render(root,base,args.version,name,at,el,az,scale,clay, 800 if args.quick else 1000)
    pose(root, {'armR':(1.7,0,.1), 'foreR':(.5,0,0), 'weapon':(-1.5,0,0), 'handR':(-1.5,0,0),
                'armL':(.75,0,-.2), 'foreL':(-.3,0,0), 'offhand':(-.25,0,0),
                'torso':(-.1,0,.03), 'cape':(-.2,0,0), 'cape2':(-.25,0,0), 'hat':(.12,0,0)})
    render(root,base,args.version,'clay-cast',(0,0,.84),12,30,1.95,True)
    render(root,base,args.version,'material-cast',(0,0,.84),12,75,1.95,False)
    pose(root, {'legL':(.18,0,0),'kneeL':(-.38,0,0),'footL':(.2,0,0),
                'legR':(-.13,0,0),'kneeR':(-.10,0,0),'footR':(.23,0,0),
                'extra2':(.02,0,-.02),'cape':(-.12,0,0),'cape2':(-.1,0,0)})
    render(root,base,args.version,'material-loaded-step',(0,0,.73),8,75,1.8,False)
    print('MAGE_MEASUREMENTS',json.dumps(report))


if __name__ == '__main__':
    main()
