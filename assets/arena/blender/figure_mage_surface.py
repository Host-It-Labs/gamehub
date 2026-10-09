"""Wizard-only preview surfaces matched to the runtime material families."""
import bpy

import kit


def configure(root):
    owned={m for o in kit.descendants(root) if o.type=='MESH' for m in o.data.materials}
    for m in owned:
        family=m.name.split(':')[0]
        bsdf=m.node_tree.nodes.get('Principled BSDF')
        if not bsdf:
            continue
        if family in ('weave','drape'):
            bsdf.inputs['Roughness'].default_value=.85
            bsdf.inputs['Sheen Weight'].default_value=.4
            tex=m.node_tree.nodes.new('ShaderNodeTexImage')
            tex.name='Mage woven-cloth preview relief'
            tex.image=kit._image('cloth')
            if tex.image:
                grey=m.node_tree.nodes.new('ShaderNodeRGBToBW')
                bump=m.node_tree.nodes.new('ShaderNodeBump')
                bump.inputs['Strength'].default_value=.12
                bump.inputs['Distance'].default_value=.00024
                m.node_tree.links.new(tex.outputs['Color'],grey.inputs[0])
                m.node_tree.links.new(grey.outputs[0],bump.inputs['Height'])
                m.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
        elif family=='skin':
            bsdf.inputs['Roughness'].default_value=.64
            bsdf.inputs['Coat Weight'].default_value=.025
            bsdf.inputs['Coat Roughness'].default_value=.65
        elif family=='hair':
            bsdf.inputs['Roughness'].default_value=.48
            bsdf.inputs['Coat Weight'].default_value=.05
            bsdf.inputs['Coat Roughness'].default_value=.55
        elif family=='glow':
            # The source uses the same restrained emissive strength as the
            # runtime family instead of a studio-white overexposed fireball.
            bsdf.inputs['Emission Strength'].default_value=2.6


def matched_team_names(g):
    """Private preview colours preserve the runtime's team tint parsing.

    Materials.get reads family and tint from the first two colon fields. The
    third marker scopes Blender's material data to the Wizard, so preview
    changes cannot repaint another figure built in the same scene.
    """
    kit.tint('team:mage','#2f63e0')
    kit.tint('team2:mage','#1c3a94')
    g.TEAM='weave:team:mage'
    g.TEAM2='weave:team2:mage'
