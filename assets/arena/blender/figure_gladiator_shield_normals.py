"""Preserve the reviewed scutum's cylindrical face normals on its game copy."""
import numpy as np
from mathutils import Vector

import kit


def restore_bow(root):
    for o in kit.descendants(root):
        if o.type!="MESH":continue
        shield=o.name=="gladiator-shield"
        paint=o.name.startswith("gladiator.shield-lacquer")
        if not shield and not paint:continue
        me=o.data
        normals=np.empty(len(me.loops)*3,dtype=np.float32)
        me.corner_normals.foreach_get("vector",normals)
        normals=normals.reshape(-1,3)
        for polygon in me.polygons:
            if shield and not me.materials[polygon.material_index].name.startswith("lacquer:"):
                continue
            polygon.use_smooth=True
            for index in polygon.loop_indices:
                p=me.vertices[me.loops[index].vertex_index].co
                # Identical to shield_point(): height does not change the
                # bowed face's normal. Per-corner data retains the separate
                # rear/rim normals at the closed shell's shared boundary.
                normals[index]=Vector((p.x+.105,p.y+.108,0)).normalized()
        me.normals_split_custom_set(normals.tolist())
