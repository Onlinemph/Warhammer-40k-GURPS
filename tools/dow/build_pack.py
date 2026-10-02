#!/usr/bin/env python3
"""Build site/models/ from your own Dawn of War install, for the simulator's 3D view.

    python3 tools/dow/build_pack.py [unit id ...] [--force]

Reads tools/dow/units.json, converts each unit (Soulstorm's through Blender and tools/dow/bl_export.py, Dawn of
War II's with tools/dow/dow2.py) and writes one script per unit plus an index:

    site/models/<id>.js      the model, its animations and its paint layers
    site/models/index.js     which roster entries use which model

site/models/ is in .gitignore and must stay there: the models and textures are Relic's and Games Workshop's,
and this only converts the copy you own for your own use. Nothing in the repository depends on it; without the
folder the 3D view draws its built miniatures.

Needs: Dawn of War: Soulstorm installed (Steam is found by itself; else set DOW_SOULSTORM to the install
folder) and Blender 4.4 or newer (found on PATH or set BLENDER) with the blender_dow extension enabled
(https://github.com/amorgun/blender_dow); for the Tyranids, Dawn of War II (DOW_DOW2), which tools/dow/dow2.py
reads without Blender. tools/dow/README.md has the details.
"""
import base64
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HERE = Path(__file__).resolve().parent
OUT = ROOT / "site" / "models"
MIME = {".jpg": "image/jpeg", ".png": "image/png"}
# what the page needs to know about a unit; the rest of an entry is for the exporter
PAGE_KEYS = ("id", "match", "not", "veh", "turret", "clips_from", "h", "yaw", "paint", "tint", "tall", "size")
# the page's name for a clip -> the game's names for it, first one the model has (a unit's own "clips" override these)
CLIPS = {"idle": ["idle_1", "idle", "idle_2"], "run": ["run_1", "run", "move_run_1", "walk_1", "walk", "move"],
         "fire": ["fire", "fire_1", "idle_firing", "idle_firing_1", "idle_fire", "fire_idle", "aim_idle"], "melee": ["melee_1", "melee", "attack_1", "melee_2"],
         "die": ["die_1", "die", "death_1", "die_2"], "hit": ["damage", "damage_1", "melee_damage_l"],
         "kneel": ["cover_idle_1"], "throw": []}


def find_blender():
    cands = [os.environ.get("BLENDER"), shutil.which("blender")]
    cands += sorted(Path.home().glob("kw-modding/blender/Blender Foundation/Blender */blender.exe"), reverse=True)
    cands += sorted(Path("C:/Program Files/Blender Foundation").glob("Blender */blender.exe"), reverse=True)
    for c in cands:
        if c and Path(c).exists():
            return str(c)
    raise SystemExit("Blender not found: put it on PATH or set BLENDER to blender.exe")


def find_game(env, folder):
    cands = [os.environ.get(env)]
    for steam in ("C:/Program Files (x86)/Steam", "C:/Program Files/Steam", str(Path.home() / ".steam/steam")):
        cands.append(f"{steam}/steamapps/common/{folder}")
        vdf = Path(steam) / "steamapps" / "libraryfolders.vdf"
        if vdf.exists():
            for line in vdf.read_text(errors="ignore").splitlines():
                if '"path"' in line:
                    cands.append(line.split('"')[3].replace("\\\\", "/") + f"/steamapps/common/{folder}")
    for c in cands:
        if c and Path(c).exists():
            return Path(c)
    return None


def mod_folder(game):
    if game == "soulstorm":
        root = find_game("DOW_SOULSTORM", "Dawn of War Soulstorm")
        if not root:
            raise SystemExit("Soulstorm not found: set DOW_SOULSTORM to its install folder")
        return str(root / "DXP2")   # Soulstorm's module; it pulls in the base game's W40k archives
    raise SystemExit(f"don't know how to read game '{game}'")


# Dawn of War II names its animations differently, and by file
CLIPS2 = {"idle": ["fb_idle_stand_01", "idle_stand_01", "fb_stand_idle_01", "fb_idle_01", "fb_melee_idle_01", "idle"],
          "run": ["fb_run", "run", "fb_run_01", "fb_run_f", "fb_run01", "moving"],
          "fire": ["fb_fire_stand", "fire_stand", "fb_fire_stand_01", "fb_range_attack_01", "fb_range_attack", "fb_range_fire"],
          "melee": ["fb_melee_attack_01", "melee_attack_01", "fb_melee_01", "fb_melee_attack01"],
          "die": ["fb_die_normal_f", "die_normal_f", "fb_death_01", "fb_die_01", "fb_death_die", "fb_die_f", "fb_die", "fb_death_f01", "fb_death", "fb_die_normal_01"],
          "kneel": ["fb_idle_crouch_01", "idle_crouch_01"], "throw": ["fb_grenade", "fb_grenade_throw_01"]}
_dow2 = []


def dow2_archives():
    """The game's art archives, patches first so that they win."""
    if not _dow2:
        import dow2
        root = find_game("DOW_DOW2", "Dawn of War 2")
        if not root:
            raise SystemExit("Dawn of War II not found: set DOW_DOW2 to its install folder")
        found = [p for p in (root / "GameAssets" / "Archives").glob("*.sga") if "art" in p.name.lower() or "_data" in p.name.lower()]
        found.sort(key=lambda p: ("delta" not in p.name.lower(), not p.name[0].isdigit(), [-ord(c) for c in p.name.lower()]))
        _dow2.append(dow2.Archives(found))
    return _dow2[0]


def export_dow2(unit):
    """A Dawn of War II unit: read by tools/dow/dow2.py, no Blender."""
    import dow2
    arc = dow2_archives()
    glb, meta, textures = dow2.build(arc, {**unit, "clips": {**CLIPS2, **unit.get("clips", {})}})
    tex = {}
    for name, images in textures.items():
        if "diffuseTex" not in images:
            continue
        entry = {}
        for kind, image in dow2.paint_layers(images, unit.get("tem", "ptsw")).items():
            image.thumbnail((unit.get("tex", 512),) * 2)
            out = io.BytesIO()
            image.save(out, "JPEG", quality=90)
            entry[kind] = "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()
        tex[name] = entry
    notes = ["clips " + " ".join(f"{k}<-{v['from']}" for k, v in meta["clips"].items())]
    lacks = [k for k in ("idle", "run", "die") if k not in meta["clips"]]
    if lacks:
        notes.append("LACKS " + ",".join(lacks))
    js = f'(window.DOW_MODELS = window.DOW_MODELS || {{}})[{json.dumps(unit["id"])}] = ' + json.dumps({"glb": base64.b64encode(glb).decode(), "tex": tex, "meta": meta}, separators=(",", ":")) + ";\n"
    return js, notes


def build_sounds(force):
    """site/models/sounds.js from tools/dow/sounds.json: the game's sounds as it stores them, by replay event."""
    import re
    import dow2
    root = find_game("DOW_DOW2", "Dawn of War 2")
    spec = (HERE / "sounds.json").read_bytes()
    dest, tag = OUT / "sounds.js", OUT / "sounds.tag"
    want = hashlib.sha1(spec + (HERE / "dow2.py").read_bytes()).hexdigest()
    if not root:
        return "sounds: Dawn of War II not found, none built"
    if not force and dest.exists() and tag.exists() and tag.read_text() == want:
        return None
    found = sorted((root / "GameAssets" / "Archives").glob("*sound*.sga"), key=lambda p: ("delta" not in p.name.lower(), not p.name[0].isdigit(), p.name.lower()))
    arc = dow2.Archives([p for p in found if "container" not in p.name.lower()])
    out, short = {}, []
    for key, s in json.loads(spec)["sounds"].items():
        names = [p for p in arc.under(s["dir"], ".fsb") if re.search(s["match"], p.rsplit("/", 1)[-1][:-4])]
        clips = [c for c in (dow2.read_sound(arc.read(p), s.get("seconds", 2.5)) for p in names) if c][:s.get("max", 4)]
        if not clips:
            short.append(key)
        out[key] = [[rate, base64.b64encode(data).decode()] for rate, data in clips]
    js = "window.DOW_SOUNDS = " + json.dumps(out, separators=(",", ":")) + ";\n"
    dest.write_text(js)
    tag.write_text(want)
    return f"sounds: {sum(map(len, out.values()))} in {len(out)} events, {len(js) // 1024} KB" + (f"  (none found for {', '.join(short)})" if short else "")


def jpeg_url(image, side, quality=88):
    image = image.convert("RGB")
    image.thumbnail((side, side))
    out = io.BytesIO()
    image.save(out, "JPEG", quality=quality)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode()


def build_scenery(force):
    """site/models/scenery.js from tools/dow/scenery.json: terrain textures and world objects for the battlefields."""
    import dow2
    from PIL import Image
    root = find_game("DOW_DOW2", "Dawn of War 2")
    spec = (HERE / "scenery.json").read_bytes()
    dest, tag = OUT / "scenery.js", OUT / "scenery.tag"
    want = hashlib.sha1(spec + (HERE / "dow2.py").read_bytes()).hexdigest()
    if not root:
        return "scenery: Dawn of War II not found, none built"
    if not force and dest.exists() and tag.exists() and tag.read_text() == want:
        return None
    found = sorted((root / "GameAssets" / "Archives").glob("*environment*.sga"), key=lambda p: ("delta" not in p.name.lower(), p.name.lower()))
    arc = dow2.Archives(found)
    doc = json.loads(spec)
    tex, props, missing = {}, {}, []
    for name, path in doc["textures"].items():
        path, gain = (path["path"], path.get("gain", 1)) if isinstance(path, dict) else (path, 1)
        if arc.has(path + "_dif.dds"):
            image = Image.open(io.BytesIO(arc.read(path + "_dif.dds"))).convert("RGB")
            tex[name] = jpeg_url(image.point(lambda v: min(255, round(v * gain))) if gain != 1 else image, 512)
        else:
            missing.append(name)
    models = {}
    for p in arc.files:
        if p.endswith(".model"):
            models.setdefault(p.rsplit("/", 1)[-1][:-6], p)
    for name, p in doc["props"].items():
        built = name in models and dow2.build_static(arc, models[name])
        if not built:
            missing.append(name)
            continue
        glb, meta, images = built
        cut = {m: i.mode == "RGBA" and i.getchannel("A").getextrema()[0] < 128 and p["role"] != "sky" for m, i in images.items()}
        side = 1024 if p["role"] == "sky" else 512 if p["role"] == "building" else 256
        maps = {}
        for m, i in images.items():
            if cut[m]:   # leaves and railings are cut out of their texture: keep the alpha
                i = i.copy()
                i.thumbnail((side, side))
                out = io.BytesIO()
                i.save(out, "PNG", optimize=True)
                maps[m] = "data:image/png;base64," + base64.b64encode(out.getvalue()).decode()
            else:
                maps[m] = jpeg_url(i, side)
        props[name] = {**p, **meta, "glb": base64.b64encode(glb).decode(), "tex": maps, "cut": [m for m in cut if cut[m]]}
    js = "window.DOW_SCENERY = " + json.dumps({"tex": tex, "props": props}, separators=(",", ":")) + ";\n"
    dest.write_text(js)
    tag.write_text(want)
    return f"scenery: {len(tex)} textures, {len(props)} objects, {len(js) // 1024} KB" + (f"  (not found: {', '.join(missing)})" if missing else "")


def data_url(path):
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(path.read_bytes()).decode()


def export(unit, blender, work):
    cfg = {"whm": unit["whm"], "mod_folder": mod_folder(unit["game"]), "looks": unit.get("looks"), "add": unit.get("add", []),
           "drop": unit.get("drop", []), "base": unit.get("base", []), "prefix": unit.get("prefix", ""), "borrows": bool(unit.get("clips_from")),
           "clips": ({**CLIPS, **unit.get("clips", {})} if unit.get("own", True) else unit.get("clips", {})), "tex": unit.get("tex", 512)}
    (work / "unit.json").write_text(json.dumps(cfg))
    run = subprocess.run([blender, "--background", "--python", str(HERE / "bl_export.py"), "--", str(work / "unit.json"), str(work)],
                         capture_output=True, text=True, errors="replace")
    notes = [l for l in run.stdout.splitlines() if l.startswith(("MISSING", "NOTEX"))]
    if not (work / "meta.json").exists():
        tail = "\n".join((run.stdout + run.stderr).splitlines()[-25:])
        raise RuntimeError(f"Blender did not export {unit['id']}:\n{tail}")
    meta = json.loads((work / "meta.json").read_text())
    tex = {name: {k: (data_url(work / v) if isinstance(v, str) else v) for k, v in t.items()} for name, t in meta["materials"].items()}
    keep = {k: meta[k] for k in ("meshes", "looks", "bounds", "head", "mesh_material", "clips", "fps")}
    notes.append("clips " + " ".join(f"{k}<-{v['from']}" for k, v in meta["clips"].items()))
    lacks = [k for k in ("idle", "run", "fire", "melee", "die") if k not in meta["clips"]]
    if lacks and not unit.get("clips_from") and not unit.get("veh"):
        notes.append("LACKS " + ",".join(lacks))
    glb = base64.b64encode((work / "model.glb").read_bytes()).decode()
    js = f'(window.DOW_MODELS = window.DOW_MODELS || {{}})[{json.dumps(unit["id"])}] = ' + json.dumps({"glb": glb, "tex": tex, "meta": keep}, separators=(",", ":")) + ";\n"
    return js, notes


def main(argv):
    force = "--force" in argv
    only = [a for a in argv if not a.startswith("--")]
    units = [u for u in json.loads((HERE / "units.json").read_text(encoding="utf-8"))["units"] if "id" in u]
    unknown = set(only) - {u["id"] for u in units} - {"sounds", "scenery"}
    if unknown:
        raise SystemExit("no such unit: " + ", ".join(sorted(unknown)))
    sys.path.insert(0, str(HERE))
    blender = find_blender() if any(u["game"] != "dow2" for u in units) else None
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = hashlib.sha1((HERE / "bl_export.py").read_bytes() + (HERE / "dow2.py").read_bytes()).hexdigest()[:8]
    def build(u):
        dest, tag = OUT / f"{u['id']}.js", OUT / f"{u['id']}.tag"
        want = hashlib.sha1((json.dumps(u, sort_keys=True) + stamp).encode()).hexdigest()
        if (only and u["id"] not in only) or (not force and dest.exists() and tag.exists() and tag.read_text() == want):
            return None
        with tempfile.TemporaryDirectory() as tmp:
            try:
                js, notes = export_dow2(u) if u["game"] == "dow2" else export(u, blender, Path(tmp))
            except (RuntimeError, ValueError, KeyError) as e:
                return f"{u['id']} not built: {e!r}"
        dest.write_text(js)
        tag.write_text(want)
        return f"{u['id']}: {len(js) // 1024} KB  " + "; ".join(notes)

    # Blender runs one unit at a time; a few side by side keeps a full build to minutes
    with ThreadPoolExecutor(max_workers=int(os.environ.get("DOW_JOBS", "4"))) as pool:
        for line in pool.map(build, units):
            if line:
                print(line, flush=True)
    done = [{k: u[k] for k in PAGE_KEYS if k in u} for u in units if (OUT / f"{u['id']}.js").exists()]
    for what, make in (("sounds", build_sounds), ("scenery", build_scenery)):
        if not only or what in only:
            line = make(force)
            if line:
                print(line)
    (OUT / "index.js").write_text("window.DOW_INDEX = " + json.dumps({"units": done}, separators=(",", ":")) + ";\n")
    print(f"site/models/index.js: {len(done)} of {len(units)} units")


if __name__ == "__main__":
    main(sys.argv[1:])
