#!/usr/bin/env python3
"""Build GCS (GURPS Character Sheet, file format v5) libraries from YAML source.

    python3 tools/build_gcs.py            # build everything in data/ -> library/
    python3 tools/build_gcs.py --check    # build to memory and validate only

Every YAML file in data/ declares what it produces:

    kind: equipment | traits | skills | template
    output: Imperium/Imperial Guard Weapons.eqp   # path under library/

See docs/data-format.md for the field reference. IDs are derived from a hash of
the output path and the entry's position/name, so rebuilding does not churn
every ID in git history.
"""
import argparse
import base64
import hashlib
import json
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
LIB = ROOT / "Library"
VERSION = 5

errors = []


def err(ctx, msg):
    errors.append(f"{ctx}: {msg}")


# --------------------------------------------------------------------------- ids

def make_id(prefix, *parts):
    h = hashlib.sha256("\x1f".join(str(p) for p in parts).encode()).digest()
    return prefix + base64.urlsafe_b64encode(h).decode()[:16]


# ---------------------------------------------------------------------- damage

DMG_TYPES = {"burn", "cor", "cr", "cut", "fat", "imp", "pi-", "pi", "pi+", "pi++", "tox", "aff", "spec", "sur"}
DMG_RE = re.compile(
    r"""^\s*
    (?:(?P<st>sw|thr)\s*)?                                 # ST-based
    (?P<base>[+-]?\s*\d+d(?:[+-]\d+)?(?:\s*x\s*\d+)?|[+-]?\d+)?\s*   # dice / flat
    (?:\((?P<ad>[\d.]+|inf|ignores DR)\))?\s*              # armor divisor
    (?P<type>[a-z+\-]+(?:\s+[^\[\s]+)*?)\s*
    (?:\[(?P<frag>\d+d(?:[+-]\d+)?)(?:\s+(?P<ftype>[a-z+\-]+))?\])?\s*$""",
    re.X,
)


def parse_damage(s, ctx):
    m = DMG_RE.match(s)
    if not m:
        err(ctx, f"unparseable damage '{s}'")
        return {"type": s}
    d = {"type": m["type"].strip()}
    if m["st"]:
        d["st"] = m["st"]
    if m["base"]:
        d["base"] = m["base"].replace(" ", "")
        if m["st"] is None or d["base"].startswith("+"):
            d["base"] = d["base"].lstrip("+")
    if m["ad"]:
        ad = m["ad"]
        d["armor_divisor"] = {"inf": -1, "ignores DR": -1}.get(ad) or (float(ad) if "." in ad else int(ad))
    if m["frag"]:
        d["fragmentation"] = m["frag"]
        d["fragmentation_type"] = m["ftype"] or "cut"
    if d["type"].split()[0] not in DMG_TYPES:
        err(ctx, f"unknown damage type '{d['type']}' in '{s}'")
    return d


# -------------------------------------------------------------------- defaults

def skill_ref(name, spec=None, mod=0):
    d = {"type": "skill", "name": {"compare": "is", "qualifier": name}}
    if spec:
        d["specialization"] = {"compare": "is", "qualifier": spec}
    if mod:
        d["modifier"] = mod
    return d


def attr_ref(attr, mod):
    return {"type": attr.lower(), "modifier": mod}


# Standard default families (Basic Set). Each entry: list of (skill, spec, mod).
MELEE_FAMILY = {
    "Broadsword": [("DX", -5), ("Force Sword", None, -4), ("Rapier", None, -4), ("Saber", None, -4),
                   ("Shortsword", None, -2), ("Two-Handed Sword", None, -4)],
    "Shortsword": [("DX", -5), ("Broadsword", None, -2), ("Force Sword", None, -3), ("Jitte/Sai", None, -3),
                   ("Knife", None, -4), ("Saber", None, -3), ("Smallsword", None, -4), ("Tonfa", None, -3)],
    "Knife": [("DX", -4), ("Force Sword", None, -3), ("Main-Gauche", None, -3), ("Shortsword", None, -3)],
    "Axe/Mace": [("DX", -5), ("Flail", None, -4), ("Two-Handed Axe/Mace", None, -3)],
    "Two-Handed Axe/Mace": [("DX", -5), ("Axe/Mace", None, -3), ("Polearm", None, -4), ("Two-Handed Flail", None, -4)],
    "Two-Handed Sword": [("DX", -5), ("Broadsword", None, -4), ("Force Sword", None, -4)],
    "Spear": [("DX", -5), ("Polearm", None, -4), ("Staff", None, -2)],
    "Polearm": [("DX", -5), ("Spear", None, -4), ("Staff", None, -4), ("Two-Handed Axe/Mace", None, -4)],
    "Staff": [("DX", -5), ("Polearm", None, -4), ("Spear", None, -2)],
    "Force Sword": [("DX", -5), ("Broadsword", None, -3)],
    "Flail": [("DX", -6), ("Axe/Mace", None, -4), ("Two-Handed Flail", None, -3)],
    "Brawling": [("DX", 0)],
    "Shield": [("DX", -4)],
}
RANGED_FAMILY = {
    "Beam Weapons": lambda spec: [("DX", -4), ("Beam Weapons", None, -4)]
    + ([("Guns", "Pistol", -4)] if spec == "Pistol" else [])
    + ([("Guns", "Rifle", -4)] if spec == "Rifle" else []),
    "Guns": lambda spec: [("DX", -4)] + [("Guns", s, -2) for s in
                                         ("Pistol", "Rifle", "Shotgun", "Light Machine Gun", "Submachine Gun") if s != spec]
    + [("Guns", s, -4) for s in ("Grenade Launcher", "Gyroc", "Light Anti-Armor Weapon") if s != spec],
    "Liquid Projector": lambda spec: [("DX", -4), ("Liquid Projector", None, -4)],
    "Gunner": lambda spec: [("DX", -4), ("Gunner", None, -4)],
    "Throwing": lambda spec: [("DX", -3)],
    "Artillery": lambda spec: [("IQ", -5)],
}


def parse_skill_name(s):
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", s)
    return (m[1], m[2]) if m else (s, None)


def build_defaults(skill, ctx, melee):
    name, spec = parse_skill_name(skill)
    out = [skill_ref(name, spec)]
    fam = MELEE_FAMILY.get(name) if melee else None
    if not melee and name in RANGED_FAMILY:
        fam = RANGED_FAMILY[name](spec)
    if fam is None:
        err(ctx, f"no default family for skill '{skill}'; give explicit 'defaults:'")
        return out
    for e in fam:
        if e[0] in ("DX", "IQ", "ST", "HT"):
            out.insert(0, attr_ref(e[0], e[1]))
        else:
            n, sp, mod = e
            out.append(skill_ref(n, sp, mod))
    seen, res = set(), []
    for d in out:
        k = json.dumps(d, sort_keys=True)
        if k not in seen:
            seen.add(k)
            res.append(d)
    return res


def explicit_defaults(lst):
    res = []
    for e in lst:
        if isinstance(e, str):
            m = re.match(r"^(.+?)\s*([+-]\d+)?$", e.strip())
            base, mod = m[1], int(m[2] or 0)
            if base in ("DX", "IQ", "ST", "HT", "Per", "Will"):
                res.append(attr_ref(base, mod))
            else:
                n, sp = parse_skill_name(base)
                res.append(skill_ref(n, sp, mod))
        else:
            res.append(e)
    return res


# --------------------------------------------------------------------- weapons

RANGED_KEYS = {"acc": "accuracy", "range": "range", "rof": "rate_of_fire", "shots": "shots",
               "bulk": "bulk", "rcl": "recoil", "st": "strength"}
MELEE_KEYS = {"reach": "reach", "parry": "parry", "block": "block", "st": "strength"}


def build_weapon(w, ctx, path, idx):
    melee = "reach" in w
    usage = str(w.get("usage", "")).lower()
    dmg = str(w.get("damage", ""))
    if (("field on" in usage or "field-on" in usage or "power-field" in usage)
            and "off" not in usage and "(" not in dmg.split(" ")[0] and "ignores DR" not in dmg):
        err(ctx, f"'{w.get('usage')}' is a power-field line but damage '{dmg}' has no armour divisor "
                 "(framework power-field rule: (10))")
    wid = make_id("w" if melee else "W", path, ctx, idx)
    out = {"id": wid, "sv": 1, "damage": parse_damage(str(w["damage"]), ctx)}
    for k, gk in (MELEE_KEYS if melee else RANGED_KEYS).items():
        if k in w:
            out[gk] = str(w[k])
    if "usage" in w:
        out["usage"] = w["usage"]
    if "notes" in w:
        out["usage_notes"] = w["notes"]
    if "defaults" in w:
        out["defaults"] = explicit_defaults(w["defaults"])
    elif "skill" in w:
        out["defaults"] = build_defaults(w["skill"], ctx, melee)
    else:
        err(ctx, "weapon has neither 'skill' nor 'defaults'")
    unknown = set(w) - set(RANGED_KEYS) - set(MELEE_KEYS) - {"damage", "usage", "notes", "skill", "defaults"}
    if unknown:
        err(ctx, f"unknown weapon keys {sorted(unknown)}")
    return out


# --------------------------------------------------------------------- features

LOCATIONS = {"skull", "eye", "face", "neck", "torso", "vitals", "groin", "arm", "hand", "leg", "foot",
             "tail", "wing", "fin", "brain", "all"}
ATTRS = {"st", "dx", "iq", "ht", "will", "per", "hp", "fp", "basic_speed", "basic_move", "sm",
         "dodge", "parry", "block", "lifting_st", "striking_st", "throwing_st"}


def build_dr(spec, ctx):
    """dr: {torso: 12, 'skull,face': 8}  or list of {locations, amount, vs}"""
    feats = []
    if isinstance(spec, dict):
        spec = [{"locations": k, "amount": v} for k, v in spec.items()]
    for e in spec:
        locs = e["locations"]
        if isinstance(locs, str):
            locs = [l.strip() for l in locs.split(",")]
        for l in locs:
            if l not in LOCATIONS:
                err(ctx, f"unknown hit location '{l}'")
        f = {"type": "dr_bonus", "locations": locs, "amount": int(e["amount"])}
        if e.get("vs"):
            f["specialization"] = e["vs"]
        feats.append(f)
    return feats


def build_features(item, ctx):
    feats = []
    if "dr" in item:
        feats += build_dr(item["dr"], ctx)
    for a, v in (item.get("attributes") or {}).items():
        a = a.lower()
        if a not in ATTRS:
            err(ctx, f"unknown attribute '{a}'")
        feats.append({"type": "attribute_bonus", "attribute": a, "amount": v})
    for s, v in (item.get("skill_bonuses") or {}).items():
        n, sp = parse_skill_name(s)
        f = {"type": "skill_bonus", "selection_type": "skills_with_name",
             "name": {"compare": "is", "qualifier": n}, "amount": v}
        if sp:
            f["specialization"] = {"compare": "is", "qualifier": sp}
        feats.append(f)
    for r in item.get("reactions") or []:
        feats.append({"type": "reaction_bonus", "situation": r["situation"], "amount": r["amount"]})
    for c in item.get("conditional") or []:
        feats.append({"type": "conditional_modifier", "situation": c["situation"], "amount": c["amount"]})
    feats += item.get("raw_features") or []
    return feats


def notes_of(item):
    parts = []
    if item.get("notes"):
        parts.append(str(item["notes"]).strip())
    if item.get("lore"):
        parts.append("Lore: " + str(item["lore"]).strip())
    if item.get("design"):
        parts.append("Design: " + str(item["design"]).strip())
    return "\n\n".join(parts)


def common(out, item):
    if item.get("ref"):
        out["reference"] = item["ref"]
    n = notes_of(item)
    if n:
        out["local_notes"] = n
    if item.get("tags"):
        out["tags"] = list(item["tags"])


# -------------------------------------------------------------------- equipment

EQ_KEYS = {"name", "tl", "lc", "cost", "weight", "qty", "tags", "ref", "notes", "lore", "design", "weapons",
           "dr", "attributes", "skill_bonuses", "reactions", "conditional", "raw_features", "children",
           "uses", "modifiers", "equipped", "weak_points", "weak_dr"}


def build_equipment(item, path, trail):
    ctx = f"{path} :: {item.get('name', '?')}"
    unknown = set(item) - EQ_KEYS
    if unknown:
        err(ctx, f"unknown keys {sorted(unknown)}")
    kids = item.get("children")
    out = {"id": make_id("E" if kids is not None else "e", path, *trail, item.get("name")),
           "description": item["name"]}
    common(out, item)
    if "weak_points" in item:
        wp = int(item["weak_points"])
        if not 3 <= wp <= 9:
            err(ctx, f"weak_points {wp} outside 3-9")
        line = (f"Weak Points {wp}: when a hit on this armour fails to penetrate, roll 3d; "
                f"on {wp} or less it found a gap and DR is halved against it.")
        if item.get("weak_dr"):
            # the DR a gap faces at a location, where it isn't simply half (a found Weak Point, or a chink, B400)
            line += " Gap DR: " + ", ".join(f"{k} {v}" for k, v in item["weak_dr"].items()) + "."
        out["local_notes"] = line + ("\n\n" + out["local_notes"] if out.get("local_notes") else "")
    if "tl" in item:
        out["tech_level"] = str(item["tl"])
    if "lc" in item:
        out["legality_class"] = str(item["lc"])
    if "cost" in item:
        out["base_value"] = str(item["cost"])
    if "weight" in item:
        w = str(item["weight"])
        out["base_weight"] = w if re.search(r"[a-z]", w) else w + " lb"
    if item.get("weapons"):
        out["weapons"] = [build_weapon(w, ctx, path, i) for i, w in enumerate(item["weapons"])]
    f = build_features(item, ctx)
    if f:
        out["features"] = f
    if item.get("modifiers"):
        out["modifiers"] = [{"id": make_id("f", path, *trail, item["name"], m["name"]), "name": m["name"],
                             "cost": str(m.get("cost", "")), "cost_type": m.get("cost_type", "to_original_cost"),
                             **({"local_notes": m["notes"]} if m.get("notes") else {}),
                             "disabled": not m.get("enabled", False)} for m in item["modifiers"]]
    if "uses" in item:
        out["uses"] = out["max_uses"] = int(item["uses"])
    out["quantity"] = int(item.get("qty", 1))
    if "equipped" in item or trail:
        out["equipped"] = item.get("equipped", True)
    if kids is not None:
        out["children"] = [build_equipment(c, path, trail + [item["name"]]) for c in kids]
    return out


# ------------------------------------------------------------------------ traits

TRAIT_KEYS = {"name", "points", "per_level", "levels", "tags", "ref", "notes", "lore", "design", "modifiers",
              "weapons", "dr", "attributes", "skill_bonuses", "reactions", "conditional", "raw_features",
              "children", "container", "cr", "round_down", "disabled", "max_levels", "base_cost_intended"}


def parse_cost_adj(c):
    c = str(c).strip()
    return c if c.endswith("%") or c.startswith(("x", "×")) else c


def build_modifier(m, path, trail, idx):
    if isinstance(m, str):  # "Name, +20%"
        name, _, cost = m.rpartition(",")
        m = {"name": name.strip(), "cost": cost.strip()}
    out = {"id": make_id("m", path, *trail, idx, m["name"]), "name": m["name"]}
    if m.get("ref"):
        out["reference"] = m["ref"]
    if m.get("notes"):
        out["local_notes"] = m["notes"]
    if "cost" in m:
        out["cost_adj"] = parse_cost_adj(m["cost"])
    if "levels" in m:
        out["levels"] = int(m["levels"])
    if m.get("disabled"):
        out["disabled"] = True
    f = build_features(m, f"{path} :: {m['name']}")
    if f:
        out["features"] = f
    return out


# A trait named after an attribute with points but no `attributes:` becomes a real bonus,
# so GCS raises the attribute instead of just charging for it.
ATTR_COST = {"ST": ("st", 10), "DX": ("dx", 20), "IQ": ("iq", 20), "HT": ("ht", 10), "Will": ("will", 5),
             "Per": ("per", 5), "Perception": ("per", 5), "HP": ("hp", 2), "Hit Points": ("hp", 2),
             "FP": ("fp", 3), "Fatigue Points": ("fp", 3), "Basic Speed": ("basic_speed", 20),
             "Basic Move": ("basic_move", 5)}


def auto_attribute(item, ctx):
    name = item.get("name", "")
    if name not in ATTR_COST or item.get("attributes") or item.get("children") is not None:
        return item
    attr, per = ATTR_COST[name]
    pts = item.get("points", 0) + item.get("per_level", 0) * item.get("levels", 0)
    lvl = pts / per
    if attr != "basic_speed" and lvl != int(lvl):
        err(ctx, f"{name} [{pts}] is not a whole number of levels at {per}/level")
    lvl = lvl if attr == "basic_speed" else int(lvl)
    return {**item, "attributes": {attr: lvl}} if lvl else item


def build_trait(item, path, trail):
    ctx = f"{path} :: {item.get('name', '?')}"
    item = auto_attribute(item, ctx)
    unknown = set(item) - TRAIT_KEYS
    if unknown:
        err(ctx, f"unknown keys {sorted(unknown)}")
    kids = item.get("children")
    out = {"id": make_id("T" if kids is not None else "t", path, *trail, item["name"]), "name": item["name"]}
    common(out, item)
    if item.get("modifiers"):
        out["modifiers"] = [build_modifier(m, path, trail + [item["name"]], i) for i, m in enumerate(item["modifiers"])]
    if kids is not None:
        ct = item.get("container", "meta_trait")
        if ct not in ("meta_trait", "ancestry", "alternative_abilities", "attributes", "group"):
            err(ctx, f"unknown container type '{ct}'")
        if ct != "group":
            out["container_type"] = ct
        out["children"] = [build_trait(c, path, trail + [item["name"]]) for c in kids]
    else:
        if "per_level" in item:
            if (item.get("points") and item["points"] == item["per_level"] * item.get("levels", 1)
                    and not item.get("base_cost_intended")):
                err(ctx, f"points {item['points']} equals per_level x levels: `points` is the BASE cost "
                         "added on top of the levels, so this charges twice (drop `points` or set it to the base)")
            out["points_per_level"] = item["per_level"]
            out["can_level"] = True
            out["levels"] = item.get("levels", 1)
            if "points" in item:
                out["base_points"] = item["points"]
        elif "points" in item:
            out["base_points"] = item["points"]
        if item.get("max_levels"):
            out["max_levels"] = item["max_levels"]
        if item.get("round_down"):
            out["round_down"] = True
        if item.get("cr"):
            out["cr"] = int(item["cr"])
    if item.get("disabled"):
        out["disabled"] = True
    if item.get("weapons"):
        out["weapons"] = [build_weapon(w, ctx, path, i) for i, w in enumerate(item["weapons"])]
    f = build_features(item, ctx)
    if f:
        out["features"] = f
    return out


# ------------------------------------------------------------------------ skills

DIFFS = {"e", "a", "h", "vh", "w"}
SKILL_KEYS = {"name", "spec", "diff", "defaults", "tl", "points", "tags", "ref", "notes", "lore", "design",
              "children", "skill_bonuses", "raw_features", "attributes", "reactions", "conditional", "dr",
              "technique_of", "limit"}


def build_skill(item, path, trail):
    ctx = f"{path} :: {item.get('name', '?')}"
    unknown = set(item) - SKILL_KEYS
    if unknown:
        err(ctx, f"unknown keys {sorted(unknown)}")
    kids = item.get("children")
    if kids is not None:
        out = {"id": make_id("S", path, *trail, item["name"]), "name": item["name"]}
        common(out, item)
        out["children"] = [build_skill(c, path, trail + [item["name"]]) for c in kids]
        return out
    tech = "technique_of" in item
    out = {"id": make_id("q" if tech else "s", path, *trail, item["name"], item.get("spec")), "name": item["name"]}
    common(out, item)
    if item.get("spec"):
        out["specialization"] = item["spec"]
    diff = str(item.get("diff", "")).lower()
    if tech:
        if diff not in ("a", "h"):
            err(ctx, "technique diff must be A or H")
        out["difficulty"] = diff
        out["default"] = explicit_defaults([item["technique_of"]])[0]
        if "limit" in item:
            out["limit"] = int(item["limit"])
    else:
        attr, _, lvl = diff.partition("/")
        if attr not in ("st", "dx", "iq", "ht", "will", "per") or lvl not in DIFFS:
            err(ctx, f"bad difficulty '{item.get('diff')}' (want e.g. IQ/H)")
        out["difficulty"] = diff
        if item.get("defaults"):
            out["defaults"] = explicit_defaults(item["defaults"])
    if "tl" in item:
        out["tech_level"] = str(item["tl"])
    out["points"] = int(item.get("points", 1))
    f = build_features(item, ctx)
    if f:
        out["features"] = f
    return out


# ---------------------------------------------------------------------- includes

_include_cache = {}


def resolve_includes(items, ctx, depth=0):
    """Replace {include: "dir/file.yaml#Entry Name"} with that entry from another data file.

    Extra keys next to `include` override the included entry's top-level fields
    (e.g. `disabled: true`, or a different `name`)."""
    out = []
    for it in items or []:
        if isinstance(it, dict) and "include" in it:
            if depth > 8:
                err(ctx, "include nesting too deep")
                continue
            target, _, name = it["include"].partition("#")
            src = DATA / target
            if src not in _include_cache:
                if not src.exists():
                    err(ctx, f"include file not found: {target}")
                    continue
                _include_cache[src] = yaml.safe_load(src.read_text())
            doc = _include_cache[src]
            pool = doc.get("items") or (doc.get("traits", []) + doc.get("skills", []) + doc.get("equipment", []))
            pool = resolve_includes(pool, f"{ctx} -> {target}", depth + 1)  # chained includes
            def find(items):
                for x in items:
                    if x.get("name") == name:
                        return x
                    hit = find(x.get("children") or [])
                    if hit:
                        return hit
            found = find(pool)  # top-level first, then nested entries
            if found is None:
                err(ctx, f"include target '{name}' not in {target}")
                continue
            merged = {**found, **{k: v for k, v in it.items() if k != "include"}}
            it = merged
        if isinstance(it, dict) and it.get("children") is not None:
            it = {**it, "children": resolve_includes(it["children"], ctx, depth + 1)}
        out.append(it)
    return out


# --------------------------------------------------------------------- templates

def build_template(doc, path):
    out = {"version": VERSION, "id": make_id("B", path)}
    if doc.get("notes"):
        out["notes"] = doc["notes"]
    out["traits"] = [build_trait(t, path, ["traits"]) for t in resolve_includes(doc.get("traits"), path)]
    out["skills"] = [build_skill(s, path, ["skills"]) for s in resolve_includes(doc.get("skills"), path)]
    out["equipment"] = [build_equipment(e, path, ["equipment"])
                        for e in resolve_includes(doc.get("equipment"), path)]
    return out


# ------------------------------------------------------------------------- main

EXT = {"equipment": ".eqp", "traits": ".adq", "skills": ".skl", "template": ".gct"}


def build_file(src):
    rel = src.relative_to(DATA).as_posix()
    doc = yaml.safe_load(src.read_text())
    kind, output = doc.get("kind"), doc.get("output")
    if kind not in EXT or not output:
        err(rel, "needs 'kind' (equipment|traits|skills|template) and 'output'")
        return None, None
    if not output.endswith(EXT[kind]):
        err(rel, f"output for kind {kind} must end in {EXT[kind]}")
    if kind == "template":
        return output, build_template(doc, output)
    rows = doc.get("items", [])
    fn = {"equipment": build_equipment, "traits": build_trait, "skills": build_skill}[kind]
    return output, {"version": VERSION, "rows": [fn(i, output, []) for i in resolve_includes(rows, output)]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate only, write nothing")
    ap.add_argument("files", nargs="*", help="specific data/*.yaml files (default: all)")
    a = ap.parse_args()
    # data/sim/ holds the combat simulator's loadouts, not GCS libraries
    srcs = [Path(f).resolve() for f in a.files] or sorted(
        p for p in DATA.rglob("*.yaml") if p.relative_to(DATA).parts[0] != "sim")
    outputs, built = {}, 0
    for src in srcs:
        try:
            output, doc = build_file(src)
        except Exception as e:  # yaml errors, missing keys
            err(src.relative_to(ROOT).as_posix(), f"{type(e).__name__}: {e}")
            continue
        if not output:
            continue
        if output in outputs:
            err(src.name, f"output '{output}' also produced by {outputs[output]}")
        outputs[output] = src.name
        if not a.check:
            dest = LIB / output
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(doc, indent="\t", ensure_ascii=False) + "\n")
        built += 1
    for e in errors:
        print("ERROR", e, file=sys.stderr)
    print(f"{built} file(s) {'checked' if a.check else 'built'}, {len(errors)} error(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
