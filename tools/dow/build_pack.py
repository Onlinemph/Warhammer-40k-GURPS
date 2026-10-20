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
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HERE = Path(__file__).resolve().parent
OUT = ROOT / "site" / "models"
MIME = {".jpg": "image/jpeg", ".png": "image/png"}
# what the page needs to know about a unit; the rest of an entry is for the exporter
PAGE_KEYS = ("id", "match", "not", "veh", "turret", "clips_from", "h", "yaw", "paint", "tint", "tall", "size", "kits", "stride")
# the page's name for a clip -> the game's names for it, first one the model has (a unit's own "clips" override these)
CLIPS = {"idle": ["idle_1", "idle", "idle_2"], "run": ["run_1", "run", "move_run_1", "walk_1", "walk", "move"],
         "fire": ["fire", "fire_1", "idle_firing", "idle_firing_1", "idle_fire", "fire_idle", "aim_idle"], "melee": ["melee_1", "melee", "attack_1", "melee_2"],
         "die": ["die_1", "die", "death_1", "die_2"], "hit": ["damage", "damage_1", "melee_damage_l"],
         "kneel": ["cover_idle_1"], "throw": [],
         # other ways to die, so a squad doesn't fall as one
         "die2": ["die_2", "die_normal_2", "die_normal_02", "death_2"], "die3": ["die_3", "die_normal_3"],
         # sync kills: Soulstorm numbers its finishing moves, and a killer's sync_kill_N goes with its victim's
         # sync_death_N (1 to 3 between infantry; 4 is a big model's)
         "kill1": ["sync_kill_1", "synckill_1", "sync_kill_1_chainsword", "sync_kill_1_witchblade"], "kill2": ["sync_kill_2", "synckill_2", "sync_kill_2_witchblade"],
         "kill3": ["sync_kill_3", "synckill_3", "synckill_3a", "sync_kill_3_witchblade"], "kill4": ["sync_kill_4", "synckill_4", "synckill_4a", "sync_kill_4_pound", "sync_kill_4_bashing"],
         "slain1": ["sync_death_1", "syncdeath_1"], "slain2": ["sync_death_2", "syncdeath_2", "sync_death_2_witchblade"],
         "slain3": ["sync_death_3", "syncdeath_3", "sync_death_3_witchblade"], "slain4": ["sync_death_4", "syncdeath_4"]}


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
          "kneel": ["fb_idle_crouch_01", "idle_crouch_01"], "throw": ["fb_grenade", "fb_grenade_throw_01"],
          # a sync kill: the killer's half and the victim's, which the game plays together when a melee blow kills. A
          # unit that carries a gun takes the killer's half from one of its melee sets (a name with a slash)
          "kill": ["fb_kill_sync_01", "fb_sync_kill_01", "fb_synckill_01", "sync_kill_01", "fb_sync_kill_03",
                   "melee_blade_range_pistol/fb_kill_sync_01", "melee_axe_range_pistol/fb_kill_sync_01", "combo_blade_pistol/fb_kill_sync_01",
                   "melee_powerfist_range_pistol/fb_kill_sync_01", "melee_twohand_hammer/fb_kill_sync_01", "melee_blade_melee_blade/fb_kill_sync_01",
                   "melee_staff/fb_sync_kill_01", "melee_claw/fb_synckill_01", "melee_blade/sync_kill_01", "talons_crushing/fb_sync_kill_03"],
          # a second pair, and the other ways to fall (the game's are by the side the blow came from)
          "killB": ["fb_kill_sync_02", "fb_sync_kill_02", "fb_synckill_02", "sync_kill_02", "fb_sync_kill_04",
                    "melee_blade_range_pistol/fb_kill_sync_02", "melee_axe_range_pistol/fb_kill_sync_02", "combo_blade_pistol/fb_kill_sync_02",
                    "melee_staff/fb_sync_kill_02", "melee_claw/fb_synckill_02", "melee_blade/sync_kill_02"],
          "slainB": ["fb_die_sync_02", "fb_death_sync_02", "fb_syncdeath_02", "die_sync_02",
                     "range_burst/fb_die_sync_02", "melee_blade_range_pistol/fb_die_sync_02", "melee_blade_range_pistol/fb_death_sync_02", "melee_claw/fb_syncdeath_02", "melee_blade/die_sync_02"],
          "die2": ["fb_die_normal_b", "die_normal_b", "fb_die_b", "fb_die_02", "fb_death_02", "fb_die_normal_02", "fb_die_normal_b01"],
          "die3": ["fb_die_normal_l", "die_normal_l", "fb_die_l", "fb_die_03", "fb_death_03", "fb_die_normal_03", "fb_die_normal_l01"],
          "die4": ["fb_die_normal_r", "die_normal_r", "fb_die_r", "fb_die_04", "fb_die_normal_04", "fb_die_normal_r01"],
          "slain": ["fb_die_sync_01", "fb_death_sync_01", "fb_syncdeath_01", "die_sync_01", "fb_sync_death_11",
                    "range_burst/fb_die_sync_01", "melee_blade_range_pistol/fb_die_sync_01", "melee_blade_range_pistol/fb_death_sync_01", "melee_claw/fb_syncdeath_01", "melee_blade/die_sync_01"]}
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


BADGES = 2   # bump to rebuild the units when what is read about badges changes

# Soulstorm keeps a texture's badge and banner places in the .wtp beside it: a rectangle in the texture's pixels.
# Its badge images are filed by race.
RACES = {"space_marines": "space_marine_race", "chaos": "chaos_marine_race", "imperial_guard": "guard_race", "orks": "ork_race", "eldar": "eldar_race",
         "dark_eldar": "dark_eldar_race", "sisters": "sisters_race", "tau": "tau_race", "necrons": "necron_race"}
_old = {"lock": threading.Lock(), "arcs": None, "wtp": {}}


def old_archives():
    """Soulstorm's archives, opened once (several units export at a time, so reads go through a lock)."""
    import sga
    with _old["lock"]:
        if _old["arcs"] is None:
            root = find_game("DOW_SOULSTORM", "Dawn of War Soulstorm")
            _old["arcs"] = []
            for p in sorted(root.glob("*/*.sga")) if root else []:
                try:
                    arc = sga.Archive(p)
                except Exception:   # not an archive this reader knows
                    continue
                _old["arcs"].append(arc)
                for name in arc.files:
                    if name.endswith("_default.wtp"):
                        _old["wtp"].setdefault(name.rsplit("/", 1)[-1][:-len("_default.wtp")], (arc, name))
    return _old["arcs"]


def old_badges(materials):
    """Where a Soulstorm unit's materials show the army's badge and banner, as read_badges gives them."""
    import struct
    old_archives()
    out = {}
    for mat in materials:
        hit = _old["wtp"].get(mat.lower())
        if not hit:
            continue
        arc, path = hit
        with _old["lock"]:
            buf = arc.read(path)

        def data(tag, fmt):
            i = buf.find(b"DATA" + tag)
            if i < 0:
                return None
            size, nlen = struct.unpack_from("<II", buf, i + 12)
            return struct.unpack_from("<" + fmt * (size // 4), buf, i + 20 + nlen)
        size = data(b"INFO", "I")
        race = RACES.get(path.split("/")[3] if path.count("/") > 3 else "")
        found = []
        for slot, tag in ((1, b"PTBD"), (3, b"PTBN")):
            r = data(tag, "f")
            if not r or not size or not race or r[2] <= 0 or r[3] <= 0:
                continue
            x, y, w, h = r[:4]
            # the rectangle is in pixels from the texture's top left; these textures are drawn head down (a face's
            # chin is at the top), so the badge goes in upside down to come out upright on the model
            found.append({"slot": slot, "race": race, "tex": "default", "m": [round(size[0] / w, 5), 0, 0, round(-size[1] / h, 5)], "t": [round(-x / w, 5), round((y + h) / h, 5)]})
        if found:
            out[mat] = found
    return out


def read_badges(buf):
    """Where a model's materials show the army's badges: {material: [{slot, tex, m, t}]}.

    The game lays a badge over a patch of the material's own texture. With (x, y) a point of that texture (y down
    from the top), the badge's own point is (m[0]*x + m[2]*y + t[0], m[1]*x + m[3]*y + t[1]), shown where both lie
    in 0..1. Slot 1 is the army's badge (a Chapter's symbol), slot 2 a marking of the unit's own (a company
    numeral). 'tex' is the badge the model carries by default.
    """
    import struct
    import dow2
    out = {}
    for _, _, name, _, _, kids in dow2.find(dow2.chunks(buf), "MTRL"):
        var = {}
        for _, typ, _, s, e, _ in kids:
            if typ.strip(" \0") != "VAR":
                continue
            n = struct.unpack_from("<I", buf, s)[0]
            key = buf[s + 4:s + 4 + n].decode("latin-1")
            kind, size = struct.unpack_from("<II", buf, s + 4 + n)
            raw = buf[s + 12 + n:s + 12 + n + size]
            if kind == 9:
                var[key] = raw.rstrip(b"\0").decode("latin-1").replace("\\", "/").lower().rsplit("/", 1)[-1]
            elif kind == 5 and size == 16:
                var[key] = struct.unpack("<4f", raw)
        found = []
        for slot in (1, 2):
            tex, m, t = var.get(f"badge{slot}Tex"), var.get(f"badge{slot}MatrixRow1Row2"), var.get(f"badge{slot}Translate")
            if not tex or not m or not t or tex.startswith("default") or abs(m[0] * m[3] - m[1] * m[2]) < 1e-6:
                continue
            found.append({"slot": slot, "tex": tex, "m": [round(v, 5) for v in m], "t": [round(v, 5) for v in t[:2]]})
        if found:
            out[name.split(".")[-1]] = found
    return out


def export_dow2(unit):
    """A Dawn of War II unit: read by tools/dow/dow2.py, no Blender."""
    import dow2
    arc = dow2_archives()
    glb, meta, textures = dow2.build(arc, {**unit, "clips": {**CLIPS2, **unit.get("clips", {})}})
    meta["badges"] = {}
    for spec in [unit["skeleton"], *unit["parts"].values()]:
        meta["badges"].update(read_badges(arc.read(spec if isinstance(spec, str) else spec["model"])))
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


def build_voices(force):
    """site/models/voices.js and voice_<id>.js from tools/dow/voices.json: unit speech, by what happens in the replay."""
    import re
    import dow2
    root = find_game("DOW_DOW2", "Dawn of War 2")
    spec = (HERE / "voices.json").read_bytes()
    dest, tag = OUT / "voices.js", OUT / "voices.tag"
    want = hashlib.sha1(spec + (HERE / "dow2.py").read_bytes()).hexdigest()
    if not root:
        return "voices: Dawn of War II not found, none built"
    if not force and dest.exists() and tag.exists() and tag.read_text() == want:
        return None
    newest = lambda p: ("delta" not in p.name.lower(), not p.name[0].isdigit(), p.name.lower())
    plain = lambda found: [p for p in sorted(found, key=newest) if "container" not in p.name.lower()]
    speech = dow2.Archives(plain((root / "GameAssets" / "Locale" / "English").glob("*.sga")))
    sounds = dow2.Archives(plain((root / "GameAssets" / "Archives").glob("*sound*.sga")))
    doc = json.loads(spec)
    limit, seconds = doc["max"], doc["seconds"]
    # Soulstorm's speech, for the factions Dawn of War II lacks: decoded here (it is in Relic's own codec) and
    # stored as 8-bit mu-law at 22050 Hz, which numpy can write quickly and the page reads as easily as ADPCM
    old_root, old = find_game("DOW_SOULSTORM", "Dawn of War Soulstorm"), []
    if old_root:
        import fda
        import numpy as np
        import sga
        old = [sga.Archive(p) for p in sorted(old_root.glob("*/Locale/English/*Sound-Speech.sga"), reverse=True)]

    def old_clips(folders, most):
        out = []
        for folder in folders:
            for arc in old:
                for p in arc.under("sound/speech/" + folder, ".fda"):
                    got = fda.decode(arc.read(p))
                    if not got or not 0.25 <= got[1].shape[1] / got[0] <= seconds:
                        continue
                    x = got[1].mean(axis=0)
                    x = np.clip((x[0:len(x) - 1:2] + x[1::2]) / 2, -1, 1)                  # 44100 -> 22050
                    y = np.sign(x) * np.log1p(255 * np.abs(x)) / np.log(256)
                    out.append([got[0] // 2, base64.b64encode(np.round((y + 1) * 127.5).astype("u1").tobytes()).decode(), "u"])
                    if len(out) == most:
                        return out
            if out:
                break
        return out

    # the speech files by unit code; of a line's alternate takes (...a, ...b) the first comes first
    by_code = {}
    for p in speech.under("wav/speech/mp", ".fsb"):
        m = re.match(r"\w(\w)_(\w{3})_", p.rsplit("/", 1)[-1])
        if m:
            by_code.setdefault(m.group(2), []).append((p.rsplit("/", 1)[-1][:-4], m.group(1), p))
    for lines in by_code.values():
        lines.sort(key=lambda x: (x[0][-1], x[0]))

    def clips(arc, paths, most):
        out = []
        for p in paths:
            got = dow2.read_sound(arc.read(p), 99)
            if got and len(got[1]) / 36 * 64 / got[0] <= seconds:
                out.append([got[0], base64.b64encode(got[1]).decode()])
                if len(out) == most:
                    break
        return out

    libs = {}
    for vid, v in doc["voices"].items():
        lib = libs[vid] = {}
        if "dow1" in v:
            for event, folders in {**doc["events1"], **v.get("events1", {})}.items():
                lib[event] = old_clips([v["dow1"] + "/" + f for f in folders], limit[event])
        elif "dirs" in v:
            for event, (folder, rx) in v["dirs"].items():
                lib[event] = clips(sounds, [p for p in sounds.under(folder, ".fsb") if re.search(rx, p.rsplit("/", 1)[-1][:-4])], limit[event])
        else:
            lines = by_code.get(v["code"], [])
            for event, chain in doc["events"].items():
                for foe in "asceoti":
                    for rx in chain:
                        some = clips(speech, [p for name, f, p in lines if f == foe and re.search(rx, name)], limit[event if foe == "a" else "foe"])
                        if some:
                            lib[event if foe == "a" else event + "." + foe] = some
                            break
    report, total = [], 0
    for vid, v in doc["voices"].items():
        lib = {k: c for k, c in libs[vid].items() if c}
        for event in doc["events"]:   # grunts and screams a unit lacks, from one that sounds like it
            if event not in lib and libs.get(v.get("borrow"), {}).get(event):
                lib[event] = libs[v["borrow"]][event]
        js = f"(window.DOW_VOICE = window.DOW_VOICE || {{}})[{json.dumps(vid)}] = " + json.dumps(lib, separators=(",", ":")) + ";\n"
        (OUT / f"voice_{vid}.js").write_text(js)
        total += len(js)
        report.append(f"{vid} " + ("/".join(str(len(lib.get(e, []))) for e in doc["events"]) if lib else "NONE"))
    made = [vid for vid in doc["voices"]]
    for stale in OUT.glob("voice_*.js"):
        if stale.stem[6:] not in made:
            stale.unlink()
    dest.write_text("window.DOW_VOICES = " + json.dumps({"rules": doc["rules"], "voices": made}, separators=(",", ":")) + ";\n")
    tag.write_text(want)
    return f"voices: {len(made)} voices, {total // 1024} KB  ({'/'.join(doc['events'])}: {', '.join(report)})"


def build_badges(force):
    """site/models/badges.js: Dawn of War II's army badges (Chapter symbols, Legion marks, clan glyphs), by name."""
    import dow2
    from PIL import Image
    root = find_game("DOW_DOW2", "Dawn of War 2")
    dest, tag = OUT / "badges.js", OUT / "badges.tag"
    want = hashlib.sha1((HERE / "dow2.py").read_bytes() + str(BADGES).encode()).hexdigest()
    if not root:
        return "badges: Dawn of War II not found, none built"
    if not force and dest.exists() and tag.exists() and tag.read_text() == want:
        return None
    arc = dow2_archives()
    out = {}
    for p in arc.under("art/badges/units", ".dds"):
        image = Image.open(io.BytesIO(arc.read(p))).convert("RGBA")
        image.thumbnail((128, 128))
        buf = io.BytesIO()
        image.save(buf, "PNG", optimize=True)
        out[p.rsplit("/", 1)[-1][:-4]] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    # Soulstorm's, by race: "ss/<race>/<name>" a badge, "ssb/<race>/<name>" a banner
    for arc in old_archives():
        for p in arc.files:
            kind = "ss" if p.startswith("art/badges/") else "ssb" if p.startswith("art/banners/") else None
            if not kind or not p.endswith(".tga") or p.count("/") != 3:
                continue
            key = f"{kind}/{p.split('/')[2]}/{p.rsplit('/', 1)[-1][:-4]}"
            if key in out:
                continue
            with _old["lock"]:
                raw = arc.read(p)
            buf = io.BytesIO()
            Image.open(io.BytesIO(raw)).convert("RGBA").save(buf, "PNG", optimize=True)
            out[key] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
    js = "window.DOW_BADGES = " + json.dumps(out, separators=(",", ":")) + ";\n"
    dest.write_text(js)
    tag.write_text(want)
    return f"badges: {len(out)} images, {len(js) // 1024} KB"


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
    missing = []
    models = {}
    for p in arc.files:
        if p.endswith(".model"):
            models.setdefault(p.rsplit("/", 1)[-1][:-6], p)

    def textures(want):
        tex = {}
        for name, path in want.items():
            path, gain = (path["path"], path.get("gain", 1)) if isinstance(path, dict) else (path, 1)
            if arc.has(path + "_dif.dds"):
                image = Image.open(io.BytesIO(arc.read(path + "_dif.dds"))).convert("RGB")
                tex[name] = jpeg_url(image.point(lambda v: min(255, round(v * gain))) if gain != 1 else image, 512)
            else:
                missing.append(name)
        return tex

    def objects(want):
        props = {}
        for name, p in want.items():
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
            p = dict(p)
            if "size" in p:   # yards across -> yards per unit of the model
                p["scale"] = round(p.pop("size") / max(meta["hi"][0] - meta["lo"][0], meta["hi"][2] - meta["lo"][2], 1e-3), 4)
            props[name] = {**p, **meta, "glb": base64.b64encode(glb).decode(), "tex": maps, "cut": [m for m in cut if cut[m]]}
        return props

    for stale in OUT.glob("scenery_*.js"):
        stale.unlink()
    sizes = []
    for theme, t in doc["themes"].items():
        js = f"(window.DOW_THEME = window.DOW_THEME || {{}})[{json.dumps(theme)}] = " + json.dumps({"tex": textures(t.get("textures", {})), "props": objects(t["props"])}, separators=(",", ":")) + ";\n"
        (OUT / f"scenery_{theme}.js").write_text(js)
        sizes.append(f"{theme} {len(js) // 1024} KB")
    shared = {"tex": textures(doc["textures"]), "props": objects(doc["props"]), "themes": list(doc["themes"])}
    js = "window.DOW_SCENERY = " + json.dumps(shared, separators=(",", ":")) + ";\n"
    dest.write_text(js)
    tag.write_text(want)
    return f"scenery: shared {len(js) // 1024} KB, {', '.join(sizes)}" + (f"  (not found: {', '.join(missing)})" if missing else "")


def data_url(path):
    return f"data:{MIME[path.suffix]};base64," + base64.b64encode(path.read_bytes()).decode()


def export(unit, blender, work):
    cfg = {"whm": unit["whm"], "mod_folder": mod_folder(unit["game"]), "looks": unit.get("looks"), "add": unit.get("add", []),
           "drop": unit.get("drop", []), "base": unit.get("base", []), "prefix": unit.get("prefix", ""), "borrows": bool(unit.get("clips_from")), "sets": unit.get("sets"),
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
    keep = {k: meta[k] for k in ("meshes", "looks", "bounds", "head", "mesh_material", "clips", "alias", "fps")}
    keep["badges"] = old_badges(meta["materials"])
    notes.append("clips " + " ".join(f"{k}<-{v['from']}" for k, v in meta["clips"].items()) + "".join(f" {a}=@{b}" for a, b in meta["alias"].items()))
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
    unknown = set(only) - {u["id"] for u in units} - {"sounds", "voices", "scenery", "badges"}
    if unknown:
        raise SystemExit("no such unit: " + ", ".join(sorted(unknown)))
    sys.path.insert(0, str(HERE))
    blender = find_blender() if any(u["game"] != "dow2" for u in units) else None
    OUT.mkdir(parents=True, exist_ok=True)
    stamp = hashlib.sha1((HERE / "bl_export.py").read_bytes() + (HERE / "dow2.py").read_bytes()).hexdigest()[:8]
    def build(u):
        dest, tag = OUT / f"{u['id']}.js", OUT / f"{u['id']}.tag"
        want = hashlib.sha1((json.dumps(u, sort_keys=True) + stamp + (json.dumps(CLIPS2, sort_keys=True) if u["game"] == "dow2" else "") + str(BADGES)).encode()).hexdigest()
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
    for what, make in (("sounds", build_sounds), ("voices", build_voices), ("scenery", build_scenery), ("badges", build_badges)):
        if not only or what in only:
            line = make(force)
            if line:
                print(line)
    shutil.copyfile(HERE / "gallery.html", OUT / "gallery.html")   # a viewer for the pack, beside it
    (OUT / "index.js").write_text("window.DOW_INDEX = " + json.dumps({"units": done}, separators=(",", ":")) + ";\n")
    print(f"site/models/index.js: {len(done)} of {len(units)} units")


if __name__ == "__main__":
    main(sys.argv[1:])
