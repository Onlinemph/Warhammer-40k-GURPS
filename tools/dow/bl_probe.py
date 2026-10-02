"""Write down what Dawn of War models hold, as JSON, to help fill in tools/dow/units.json.

    blender --background --python tools/dow/bl_probe.py -- <mod folder> <out dir> <model.whm> [more.whm ...]

The mod folder is the one that holds the game's .sga archives (for Soulstorm, <install>/DXP2); model paths are
paths inside the archives (art/ebps/races/<race>/troops/<unit>.whm). Each model gets <out dir>/<race>__<unit>.json:
its meshes (size, material, whether the game shows it by default), its animations (length, and which meshes
each one switches on) and its materials' texture layers.
"""
import json
import os
import sys

import bpy
import mathutils

mod_folder, out, *models = sys.argv[sys.argv.index("--") + 1:]
os.makedirs(out, exist_ok=True)
bpy.ops.preferences.addon_enable(module="bl_ext.user_default.blender_dow")


def shown_by(action):
    """Meshes an animation switches on or off: {mesh name: visible}."""
    res = {}
    try:
        for layer in action.layers:
            for strip in layer.strips:
                for slot in action.slots:
                    bag = strip.channelbag(slot)
                    if not bag:
                        continue
                    for fc in bag.fcurves:
                        if fc.data_path == '["force_invisible"]' and fc.keyframe_points:
                            res[slot.name_display] = not fc.keyframe_points[0].co[1]
    except Exception as exc:  # older or newer action layouts: the rest of the probe is still useful
        res["_error"] = repr(exc)
    return res


for whm in models:
    parts = whm.replace("\\", "/").split("/")
    dest = os.path.join(out, "%s__%s.json" % (parts[-3] if len(parts) > 2 else "x", parts[-1][:-4].replace(" ", "_")))
    if os.path.exists(dest):
        continue
    try:
        bpy.ops.import_model.dow_whm_cli(filepath=whm, mod_folder=mod_folder)
    except Exception as exc:
        json.dump({"whm": whm, "error": repr(exc)}, open(dest, "w"))
        print("PROBE FAILED", whm, exc)
        continue
    meshes = {}
    for m in (o for o in bpy.data.objects if o.type == "MESH"):
        pts = [m.matrix_world @ mathutils.Vector(c) for c in m.bound_box]
        meshes[m.name] = {"verts": len(m.data.vertices), "hidden": bool(m.get("force_invisible")),
                          "mat": [s.material.name for s in m.material_slots if s.material],
                          "lo": [round(min(p[i] for p in pts), 2) for i in range(3)], "hi": [round(max(p[i] for p in pts), 2) for i in range(3)]}
    mats = {mat.name: [[n.label, n.image.name, list(n.image.size)] for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeTexImage" and n.image and n.image.size[0] > 1]
            for mat in bpy.data.materials if mat.node_tree}
    acts = {a.name: {"frames": int(a.frame_range[1] - a.frame_range[0]), "shows": shown_by(a)} for a in bpy.data.actions}
    rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
    json.dump({"whm": whm, "bones": [b.name for b in rig.data.bones] if rig else [], "meshes": meshes, "materials": mats, "actions": acts},
              open(dest, "w"), indent=1)
    print("PROBED", whm, len(meshes), "meshes", len(acts), "actions")
