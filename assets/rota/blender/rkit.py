"""Rota's layer over Arena's Blender kit (assets/arena/blender/kit.py).

Rota's models are code too: one grid square is one metre, the ground is
z = 0, building fronts face -Y and vehicles drive towards +Y. Import this
module instead of kit directly; it points the kit at Rota's texture
sources, its miniature texture densities and a finer AO grid, then hands
the kit back:

    import rkit
    kit = rkit.kit

Run a build script headless:
  Blender -b --factory-startup --python assets/rota/blender/<script>.py -- <out.glb> [preview.png]

See docs/concepts/2026-10-02-rota-3d/brief.md for the asset list.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, os.path.join(ROOT, "assets", "arena", "blender"))

import bpy  # noqa: E402
import kit  # noqa: E402

TEX = os.path.join(ROOT, "assets", "rota", "textures")

# Metres covered by one repeat of each tile, at the miniature's scale: a
# house wall 0.12 m tall shows a dozen courses of brick.
TILE = {
    "grass": 1.2,
    "field": 0.9,
    "asphalt": 0.6,
    "ballast": 0.3,
    "brick": 0.14,
    "roof": 0.12,
    "slate": 0.12,
    "plaster": 0.25,
    "wood": 0.12,
    "stone": 0.2,
    "rock": 0.6,
    "foliage": 0.22,
    "bark": 0.1,
    "sand": 0.8,
    "cobble": 0.2,
    "paint": 1.0,
    "metal": 0.2,
    "chrome": 1.0,
    "rubber": 0.1,
    "glass": 1.0,
    "plastic": 1.0,
    "glow": 1.0,
    "plain": 1.0,
}
kit.TILE.clear()
kit.TILE.update(TILE)
kit.TILE_SMALL.clear()

# Small parts need vertices close together for the baked AO to show.
AO_EDGE = 0.035
kit.AO_EDGE = AO_EDGE

# Preview roughness and metalness for the plain families.
kit.FAMILY.update({
    "paint": (0.3, 0.0),
    "chrome": (0.1, 1.0),
    "rubber": (0.7, 0.0),
    "glass": (0.08, 0.0),
    "plastic": (0.45, 0.0),
})

# Arena's sources stand in for previews until Rota's own tiles exist
# (assets/rota/textures/<family>.png, written by scripts/rota-textures.mjs).
_FALLBACK = {
    "grass": "grass-v1-b", "stone": "stone-v1-b", "roof": "roof-v1-b",
    "wood": "wood-v1-a", "ballast": "pebbles-v1-b", "rock": "rock-v1-b",
    "foliage": "foliage-v1-b", "bark": "bark-v1-a", "metal": "metal-v1-b",
    "field": "dirt-v1-b", "cobble": "cobble-v4-b",
}
_images = {}


def _image(texture):
    if texture in _images:
        return _images[texture]
    img = None
    own = os.path.join(TEX, texture + ".png")
    arena = os.path.join(kit.TEX, _FALLBACK.get(texture, "") + ".png")
    for path in (own, arena):
        if os.path.exists(path) and os.path.isfile(path):
            img = bpy.data.images.load(path)
            break
    _images[texture] = img
    return img


kit._image = _image


_kit_material = kit.material


def material(name):
    """kit.material, plus a glow look for the preview renders."""
    m = _kit_material(name)
    family = name.partition(":")[0]
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if family == "glow" and bsdf:
        colour = kit.TINTS.get(name.partition(":")[2], (1.0, 0.85, 0.5))
        bsdf.inputs["Emission Color"].default_value = (*colour, 1)
        bsdf.inputs["Emission Strength"].default_value = 3
    return m


kit.material = material


def reset(seed=7):
    scene = kit.reset(seed)
    _images.clear()
    return scene
