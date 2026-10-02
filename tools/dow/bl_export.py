"""Turn one Dawn of War model into what the simulator's 3D view loads: a .glb (meshes, skeleton, a few
animations, no textures) and, per material, the paint layers as images.

    blender --background --python tools/dow/bl_export.py -- <unit.json> <out dir>

unit.json (one entry of tools/dow/units.json, plus "mod_folder"):
    {"whm": "art/ebps/races/space_marines/troops/space_marine.whm",   # path inside the game's archives
     "mod_folder": "<Soulstorm>/DXP2",                                # the folder holding the .sga archives
     "looks": {"default": "vis_bolter", "plasma": "vis_plasma"},      # which meshes show, per weapon the figure carries:
                                                                      #   the name of the game's own visibility animation,
                                                                      #   or a list of mesh names
     "add": [...], "drop": [...],                                     # meshes to add to / take out of every look
     "clips": {"idle": ["idle_1", "idle"], "run": "run_1", ...},      # name in the page -> the game's animation (first found)
     "sets": {"flame": "marine_flamer",                               # a look whose weapon is carried and fired differently:
              "shell": {"prefix": "marine_missile_launcher",          #   the prefix its animations share ("marine_flamer_idle_1"),
                        "fire": "marine_missile_launcher_fire_and_reload"}},   # and/or the animation for a clip by name
     "tex": 512}                                                      # longest texture side to keep

Out dir gets model.glb, <material>.base.png|jpg, <material>.m1.jpg, <material>.m2.jpg and meta.json.

The game paints a unit in its army's colours with greyscale masks: primary, secondary, trim, weapons, eyes and
"dirt" (how much of the painted default texture shows through). The page repaints with the same formula, so the
masks travel as two RGB images: m1 = primary, secondary, trim; m2 = weapons, eyes, dirt. A material with no
masks has only its base image.
"""
import json
import os
import re
import sys

import bpy
import mathutils
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
cfg = json.load(open(args[0], encoding="utf-8"))
out = args[1]
os.makedirs(out, exist_ok=True)
TEX = int(cfg.get("tex", 512))

bpy.ops.preferences.addon_enable(module="bl_ext.user_default.blender_dow")
from PIL import Image  # noqa: E402  (ships with the add-on)

bpy.ops.import_model.dow_whm_cli(filepath=cfg["whm"], mod_folder=cfg["mod_folder"])
scene = bpy.context.scene
rig = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)

# ---- 1. the looks, and the meshes they need ----------------------------------------------------------------
all_meshes = {o.name: o for o in bpy.data.objects if o.type == "MESH"}


def shown_by(action):
    """Meshes one of the game's animations switches on."""
    res = []
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag = strip.channelbag(slot)
                for fc in (bag.fcurves if bag else []):
                    if fc.data_path == '["force_invisible"]' and fc.keyframe_points and not fc.keyframe_points[0].co[1]:
                        res.append(slot.name_display)
    return res


# names in the older models are upper case, in the newer ones lower: match without regard to case
ACTS = {a.name.lower(): a for a in bpy.data.actions}
MESH = {n.lower(): n for n in all_meshes}
looks = {}
for kind, spec in (cfg.get("looks") or {"default": [n for n, o in all_meshes.items() if not o.get("force_invisible")]}).items():
    names, gone = [], []
    for item in [*cfg.get("base", []), *([spec] if isinstance(spec, str) else spec)]:
        if item == "*":
            names += [n for n, o in all_meshes.items() if not o.get("force_invisible")]
        elif item.lower() in ACTS:
            names += [MESH.get(n.lower(), n) for n in shown_by(ACTS[item.lower()])]
        elif item.lower() in MESH:
            names.append(MESH[item.lower()])
        else:
            gone.append(item)
    names += [MESH[n.lower()] for n in cfg.get("add", []) if n.lower() in MESH]
    drop = {n.lower() for n in cfg.get("drop", [])}
    if gone:
        print("MISSING in look", kind, gone)
    looks[kind] = [n for n in dict.fromkeys(names) if n in all_meshes and n.lower() not in drop]
keep = [all_meshes[n] for n in dict.fromkeys(n for v in looks.values() for n in v)]
for o in list(bpy.data.objects):
    if o is rig or o in keep:
        o.hide_set(False)
        o.hide_viewport = False
        o.hide_render = False
        continue
    bpy.data.objects.remove(o, do_unlink=True)
for o in keep:
    # the game switches weapon meshes on and off with animated properties; the page does that itself
    o.animation_data_clear()
    for k in [k for k in o.keys() if k not in ("_RNA_UI",)]:
        del o[k]
    o.color = (1, 1, 1, 1)

# each mesh's lowest and highest point: the page sizes the model from the body meshes it shows
bounds = {o.name: [round(min((o.matrix_world @ mathutils.Vector(c)).z for c in o.bound_box), 4),
                   round(max((o.matrix_world @ mathutils.Vector(c)).z for c in o.bound_box), 4)] for o in keep}
pts = [o.matrix_world @ mathutils.Vector(c) for o in keep for c in o.bound_box]
lo = [min(p[i] for p in pts) for i in range(3)]
hi = [max(p[i] for p in pts) for i in range(3)]


# ---- 2. textures: the base image and the paint masks of every material in use -------------------------------
def pixels(img):
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    return np.flipud(a.reshape(h, w, 4))   # top row first


def fit(a, w, h):
    if a.shape[0] == h and a.shape[1] == w:
        return a
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))
    return np.asarray(im.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255


def save(a, path, quality=90):
    im = Image.fromarray((np.clip(a, 0, 1) * 255 + .5).astype(np.uint8))
    if max(im.size) > TEX:
        k = TEX / max(im.size)
        im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
    if path.endswith(".jpg"):
        im.convert("RGB").save(path, quality=quality)
    else:
        im.save(path, optimize=True)


materials = {}
for mat in {s.material for o in keep for s in o.material_slots if s.material}:
    tex = {n.label: n.image for n in mat.node_tree.nodes
           if n.bl_idname == "ShaderNodeTexImage" and n.image and n.image.size[0] > 1}
    diffuse, default = tex.get("diffuse"), tex.get("color_layer_default")
    if not diffuse and not default:
        print("NOTEX", mat.name)
        continue
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in mat.name)
    entry = {}
    d = pixels(diffuse) if diffuse else None
    alpha = d[:, :, 3] if d is not None else None
    cutout = alpha is not None and float((alpha < .5).mean()) > .002
    base = pixels(default) if default else d
    h, w = base.shape[:2]
    rgba = np.dstack([base[:, :, :3], fit(alpha, w, h) if cutout else np.ones((h, w), np.float32)])
    name = safe + (".base.png" if cutout else ".base.jpg")
    save(rgba if cutout else rgba[:, :, :3], os.path.join(out, name))
    entry["base"] = name
    if cutout:
        entry["cutout"] = True
    if default:
        layer = lambda key: fit(pixels(tex[key])[:, :, 0], w, h) if key in tex else np.zeros((h, w), np.float32)
        m1 = np.dstack([layer("color_layer_primary"), layer("color_layer_secondary"), layer("color_layer_trim")])
        m2 = np.dstack([layer("color_layer_weapons"), layer("color_layer_eyes"), layer("color_layer_dirt")])
        save(m1, os.path.join(out, safe + ".m1.jpg"), 92)
        save(m2, os.path.join(out, safe + ".m2.jpg"), 92)
        entry["m1"], entry["m2"] = safe + ".m1.jpg", safe + ".m2.jpg"
    illum = tex.get("self_illumination")
    if illum:
        save(pixels(illum)[:, :, :3], os.path.join(out, safe + ".glow.jpg"))
        entry["glow"] = safe + ".glow.jpg"
    materials[mat.name] = entry
    # a plain material for the exporter: the page supplies the maps by material name
    mat.node_tree.nodes.clear()
    bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    outn = mat.node_tree.nodes.new("ShaderNodeOutputMaterial")
    mat.node_tree.links.new(bsdf.outputs[0], outn.inputs[0])

# The game's animation names vary from unit to unit (run_1, move_run_1, boyz_slugga_run_1, MOVE...). When none of
# the listed names is there, take the plainest name of the right kind, preferring the unit's "prefix".
KIND = {"idle": r"(^|_)idle(_?0?1a?)?$", "run": r"(^|_)(move_run|run|move)(_?0?1a?(_run)?)?$",
        "fire": r"(^|_)(idle_firing|fire_idle|idle_fire|fire)(_?[1a]|_sprifle|_sp)?$", "melee": r"(^|_)(melee_attack|melee|attack)(_?[12])?$",
        "die": r"(^|_)(die_normal|die|death)(_?0?1)?$", "hit": r"(^|_)(melee_)?damage(_l|_?1)?$",
        "kneel": r"(^|_)(idle_in_cover|cover_idle|idle_cover)(_?1)?$"}
OTHER = re.compile(r"sync|thrown|overlay|aim|tracking|talk|capture|flag|garrison|vis_|charge|block|underfire|fly|jump")


def guess(kind):
    if kind not in KIND:
        return None
    prefix = cfg.get("prefix", "").lower()
    found = [a for a in ACTS if re.search(KIND[kind], a) and not OTHER.search(a) and (kind == "kneel" or "cover" not in a)]
    found.sort(key=lambda a: (not (prefix and a.startswith(prefix)), len(a), a))
    return found[0] if found else None


def set_action(prefix, kind):
    """The animation of this kind in a weapon's family: <prefix>_idle_1, <prefix>_run..."""
    pre = prefix.lower().rstrip("_") + "_"
    core = KIND[kind][len("(^|_)"):-1]
    found = [a for a in ACTS if a.startswith(pre) and re.fullmatch(core, a[len(pre):])]
    return min(found, key=lambda a: (len(a), a)) if found else None


# ---- 3. animations: only the chosen ones, renamed for the page ------------------------------------------------
clips, alias = {}, {}
if rig:
    wanted = {}
    for name, srcs in cfg.get("clips", {}).items():
        if not srcs:
            continue
        src = next((c for c in ([srcs] if isinstance(srcs, str) else srcs) if c.lower() in ACTS), None)
        if not src and isinstance(srcs, str):
            print("MISSING action", srcs)
        src = src or (None if cfg.get("borrows") else guess(name))   # a unit that borrows another's clips takes only its own exact ones
        if not src:
            continue
        act = ACTS[src.lower()]
        wanted[name] = act.copy()
        clips[name] = {"from": src, "frames": int(act.frame_range[1] - act.frame_range[0])}
    # a look with animations of its own (a heavy bolter is carried at the hip, a launcher on the shoulder): its clips
    # are exported as "idle@<look>" and the page prefers them for a figure showing that look. Looks that name the
    # same animations share one copy.
    same = {}
    for look, spec in (cfg.get("sets") or {}).items():
        if look not in looks:
            print("MISSING look for set", look)
            continue
        spec = {"prefix": spec} if isinstance(spec, str) else spec
        sig = json.dumps(spec, sort_keys=True)
        if sig in same:
            alias[look] = same[sig]
            continue
        same[sig] = look
        for kind in KIND:
            src = spec.get(kind) or (set_action(spec["prefix"], kind) if spec.get("prefix") else None)
            if not src:
                continue
            if src.lower() not in ACTS:
                print("MISSING action", src)
                continue
            act = ACTS[src.lower()]
            wanted[kind + "@" + look] = act.copy()
            clips[kind + "@" + look] = {"from": src, "frames": int(act.frame_range[1] - act.frame_range[0])}
    for act in list(bpy.data.actions):
        if act not in wanted.values():
            bpy.data.actions.remove(act)
    for name, act in wanted.items():
        act.name = name
        act.use_fake_user = True
    rig.animation_data_create()
    for t in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(t)
    rig.animation_data.action = wanted.get("idle") or next(iter(wanted.values()), None)
    print("SLOTS", [(a.name, [(sl.name_display, sl.target_id_type) for sl in a.slots]) for a in bpy.data.actions][:3])

names = {o: o.name for o in keep}
for o in keep:
    o.name = "M_" + names[o]   # a mesh often shares its name with a bone; in the .glb the two must differ
bpy.ops.object.select_all(action="DESELECT")
for o in keep + ([rig] if rig else []):
    o.select_set(True)
bpy.context.view_layer.objects.active = rig or keep[0]
bpy.ops.export_scene.gltf(
    filepath=os.path.join(out, "model.glb"), export_format="GLB", use_selection=True,
    export_animations=bool(clips), export_animation_mode="ACTIONS", export_force_sampling=True,
    export_frame_step=1, export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False,
    export_skins=True, export_all_influences=False, export_def_bones=False, export_materials="EXPORT",
    export_image_format="NONE", export_texcoords=True, export_normals=True, export_tangents=False,
    export_morph=False, export_cameras=False, export_lights=False, export_yup=True, export_extras=False,
    export_reset_pose_bones=True, export_anim_slide_to_zero=True, export_anim_single_armature=True)

# how high the head sits: sizes a figure better than its outline does (a raised banner or halberd is taller than the trooper)
head = next((b for b in (rig.data.bones if rig else []) if b.name.lower() == "bip01 head"), None)
head_z = round((rig.matrix_world @ head.head_local).z, 4) if head else None
meta = {"whm": cfg["whm"], "meshes": [names[o] for o in keep], "looks": looks, "head": head_z, "materials": materials, "clips": clips, "alias": alias,
        "fps": scene.render.fps, "lo": [round(x, 4) for x in lo], "hi": [round(x, 4) for x in hi],
        "bounds": bounds,
        "mesh_material": {names[o]: (o.material_slots[0].material.name if o.material_slots and o.material_slots[0].material else None) for o in keep}}
json.dump(meta, open(os.path.join(out, "meta.json"), "w", encoding="utf-8"), indent=1)
print("EXPORTED", out, "meshes", len(keep), "clips", sorted(clips), "bytes", os.path.getsize(os.path.join(out, "model.glb")))
