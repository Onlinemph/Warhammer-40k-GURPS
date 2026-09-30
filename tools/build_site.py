#!/usr/bin/env python3
"""Build a single-page browser for the GCS libraries in Library/.

    python3 tools/build_site.py      # writes site/index.html

Reads the generated GCS files (run build_gcs.py first), computes point costs the
way GCS does (modifiers summed, -80% floor, rounded up; alternative abilities at
1/5 cost), and embeds everything as JSON in one HTML page.
"""
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "Library"
OUT = ROOT / "site" / "index.html"
TEMPLATE = ROOT / "tools" / "site_template.html"
SIM = ROOT / "tools" / "sim.js"

KIND = {".eqp": "equipment", ".adq": "traits", ".skl": "skills", ".gct": "template"}


# ------------------------------------------------------------------ point costs

def mod_pct(t):
    pct = 0.0
    for m in t.get("modifiers", []):
        if m.get("disabled"):
            continue
        c = str(m.get("cost_adj", "")).strip()
        if c.endswith("%"):
            try:
                pct += float(c[:-1]) * m.get("levels", 1)
            except ValueError:
                pass
    return max(pct, -80.0)


def trait_cost(t):
    """Return points for a trait or container, GCS-style."""
    if t.get("disabled"):
        return 0
    kids = t.get("children")
    if kids is not None:
        costs = [trait_cost(c) for c in kids]
        if t.get("container_type") == "alternative_abilities" and costs:
            top = max(costs)
            rest = sum(costs) - top
            return top + math.ceil(rest / 5)
        return sum(costs)
    base = t.get("base_points", 0) + t.get("points_per_level", 0) * t.get("levels", 0)
    mult = 1.0
    for m in t.get("modifiers", []):  # flat point and multiplier modifiers, as GCS applies them
        if m.get("disabled"):
            continue
        c = str(m.get("cost_adj", "")).strip()
        try:
            if c.lower().startswith("x"):
                mult *= eval(c[1:], {}, {}) if "/" in c else float(c[1:])
            elif c and not c.endswith("%"):
                base += float(c) * m.get("levels", 1)
        except (ValueError, SyntaxError, ZeroDivisionError):
            pass
    pct = mod_pct(t)
    v = base * (1 + pct / 100) * mult
    return math.ceil(v - 1e-9) if v > 0 else math.floor(v + 1e-9)


def skill_cost(s):
    if s.get("children") is not None:
        return sum(skill_cost(c) for c in s["children"])
    return s.get("points", 0)


# -------------------------------------------------------------------- notes

def split_notes(text):
    """build_gcs joins notes, 'Lore: ...' and 'Design: ...' with blank lines."""
    out = {"notes": [], "lore": [], "design": []}
    for para in (text or "").split("\n\n"):
        p = para.strip()
        if not p:
            continue
        if p.startswith("Lore: "):
            out["lore"].append(p[6:])
        elif p.startswith("Design: "):
            out["design"].append(p[8:])
        else:
            out["notes"].append(p)
    return {k: "\n\n".join(v) for k, v in out.items() if v}


# ----------------------------------------------------------------- weapons

def fmt_damage(d):
    s = ""
    if d.get("st"):
        s = d["st"]
        b = d.get("base", "")
        if b and not b.startswith(("-", "+")):
            b = "+" + b
        s += b
    else:
        s = d.get("base", "")
    ad = d.get("armor_divisor")
    if ad:
        s += "(∞)" if ad == -1 else f"({ad:g})"
    s += " " + d.get("type", "")
    if d.get("fragmentation"):
        s += f" [{d['fragmentation']} {d.get('fragmentation_type', 'cut').strip()}]"
    return s.strip()


def fmt_default(d):
    if d["type"] == "skill":
        n = d["name"]["qualifier"]
        if d.get("specialization"):
            n += f" ({d['specialization']['qualifier']})"
    else:
        n = d["type"].upper() if len(d["type"]) <= 3 else d["type"].title()
    m = d.get("modifier", 0)
    return n + (f"{m:+d}" if m else "")


def weapon(w):
    melee = "reach" in w
    defs = w.get("defaults", [])
    skill = next((fmt_default(d) for d in defs if d["type"] == "skill" and not d.get("modifier")), None)
    out = {"melee": melee, "usage": w.get("usage", ""), "damage": fmt_damage(w.get("damage", {})),
           "skill": skill or (fmt_default(defs[0]) if defs else ""), "notes": w.get("usage_notes", ""),
           "defaults": [fmt_default(d) for d in defs]}
    keys = ("reach", "parry", "block", "strength") if melee else \
        ("accuracy", "range", "rate_of_fire", "shots", "strength", "bulk", "recoil")
    for k in keys:
        if k in w:
            out[k] = w[k]
    return out


# ---------------------------------------------------------------- features

LOC_ORDER = ["skull", "eye", "face", "neck", "torso", "vitals", "groin", "arm", "hand", "leg", "foot", "all"]


def features(fs):
    dr, other = {}, []
    for f in fs or []:
        t = f["type"]
        if t == "dr_bonus":
            key = f.get("specialization") or ""
            for loc in f.get("locations", []):
                dr.setdefault(key, {})[loc] = dr.get(key, {}).get(loc, 0) + f["amount"]
        elif t == "attribute_bonus":
            a = f["attribute"].replace("_", " ")
            a = a.upper() if len(a) <= 3 else a.title()
            other.append(f"{a} {f['amount']:+g}")
        elif t == "skill_bonus":
            n = f["name"]["qualifier"] + (f" ({f['specialization']['qualifier']})" if f.get("specialization") else "")
            other.append(f"{n} {f['amount']:+d}")
        elif t in ("reaction_bonus", "conditional_modifier"):
            other.append(f"{f['amount']:+d} {f.get('situation', '')}")
    rows = []
    for vs, locs in dr.items():
        # group locations by DR value, in body order
        by = {}
        for loc in sorted(locs, key=lambda l: LOC_ORDER.index(l) if l in LOC_ORDER else 99):
            by.setdefault(locs[loc], []).append(loc)
        rows.append({"vs": vs, "groups": [{"dr": v, "locs": ls} for v, ls in
                                          sorted(by.items(), key=lambda kv: -kv[0]) if v]})
    return {"dr": [r for r in rows if r["groups"]], "other": other}


# ------------------------------------------------------------------ entries

def eq_entry(e):
    out = {"name": e.get("description", ""), "tl": e.get("tech_level"), "lc": e.get("legality_class"),
           "cost": e.get("base_value"), "weight": e.get("base_weight"), "qty": e.get("quantity", 1),
           "tags": e.get("tags", []), "ref": e.get("reference"), **split_notes(e.get("local_notes")),
           "weapons": [weapon(w) for w in e.get("weapons", [])], "feat": features(e.get("features"))}
    if "max_uses" in e:
        out["uses"] = e["max_uses"]
    mods = [{"name": m["name"], "cost": m.get("cost", ""), "notes": m.get("local_notes", "")}
            for m in e.get("modifiers", [])]
    if mods:
        out["mods"] = mods
    if e.get("children") is not None:
        out["children"] = [eq_entry(c) for c in e["children"]]
    return out


def trait_entry(t):
    out = {"name": t.get("name", ""), "points": trait_cost(t), "tags": t.get("tags", []),
           "ref": t.get("reference"), **split_notes(t.get("local_notes")),
           "weapons": [weapon(w) for w in t.get("weapons", [])], "feat": features(t.get("features"))}
    if t.get("disabled"):
        out["disabled"] = True
    if t.get("can_level"):
        out["levels"] = t.get("levels")
    if t.get("cr"):
        out["cr"] = t["cr"]
    mods = [{"name": m["name"], "cost": m.get("cost_adj", ""), "notes": m.get("local_notes", "")}
            for m in t.get("modifiers", []) if not m.get("disabled")]
    if mods:
        out["mods"] = mods
    if t.get("children") is not None:
        out["container"] = t.get("container_type", "group")
        out["children"] = [trait_entry(c) for c in t["children"]]
    return out


def skill_entry(s):
    if s.get("children") is not None:
        return {"name": s["name"], "children": [skill_entry(c) for c in s["children"]],
                "points": skill_cost(s), **split_notes(s.get("local_notes"))}
    diff = s.get("difficulty", "")
    if "default" in s:  # technique
        diff = f"Tech/{diff.upper()} (from {fmt_default(s['default'])})"
    else:
        a, _, l = diff.partition("/")
        diff = f"{a.upper() if len(a) <= 2 else a.title()}/{l.upper()}"
    return {"name": s["name"] + (f" ({s['specialization']})" if s.get("specialization") else ""),
            "diff": diff, "points": s.get("points", 0), "tl": s.get("tech_level"),
            "defaults": [fmt_default(d) for d in s.get("defaults", [])], "tags": s.get("tags", []),
            "ref": s.get("reference"), **split_notes(s.get("local_notes")), "feat": features(s.get("features"))}


# ------------------------------------------------------------ character stats

DMG = {1: ("1d-6", "1d-5"), 2: ("1d-6", "1d-5"), 3: ("1d-5", "1d-4"), 4: ("1d-5", "1d-4"), 5: ("1d-4", "1d-3"),
       6: ("1d-4", "1d-3"), 7: ("1d-3", "1d-2"), 8: ("1d-3", "1d-2"), 9: ("1d-2", "1d-1"), 10: ("1d-2", "1d"),
       11: ("1d-1", "1d+1"), 12: ("1d-1", "1d+2"), 13: ("1d", "2d-1"), 14: ("1d", "2d"), 15: ("1d+1", "2d+1"),
       16: ("1d+1", "2d+2"), 17: ("1d+2", "3d-1"), 18: ("1d+2", "3d"), 19: ("2d-1", "3d+1"), 20: ("2d-1", "3d+2"),
       21: ("2d", "4d-1"), 22: ("2d", "4d"), 23: ("2d+1", "4d+1"), 24: ("2d+1", "4d+2"), 25: ("2d+2", "5d-1"),
       26: ("2d+2", "5d"), 27: ("3d-1", "5d+1"), 28: ("3d-1", "5d+1"), 29: ("3d", "5d+2"), 30: ("3d", "5d+2"),
       31: ("3d+1", "6d-1"), 32: ("3d+1", "6d-1"), 33: ("3d+2", "6d"), 34: ("3d+2", "6d"), 35: ("4d-1", "6d+1"),
       36: ("4d-1", "6d+1"), 37: ("4d", "6d+2"), 38: ("4d", "6d+2"), 39: ("4d+1", "7d-1"), 40: ("4d+1", "7d-1"),
       45: ("5d", "7d+1"), 50: ("5d+2", "8d-1"), 55: ("6d", "8d+1"), 60: ("7d-1", "9d"), 65: ("7d+1", "9d+2"),
       70: ("8d", "10d")}


def dmg_for(st):
    st = max(1, int(st))
    key = st if st in DMG else max(k for k in DMG if k <= st)
    return DMG[key]


def active_traits(ts):
    """Yield enabled leaf traits (and containers) recursively, skipping disabled branches."""
    for t in ts:
        if t.get("disabled"):
            continue
        yield t
        if t.get("children") is not None:
            yield from active_traits(t["children"])


SKILL_BASE = {"e": 0, "a": -1, "h": -2, "vh": -3}


def skill_level(pts, diff):
    if pts <= 0:
        return None
    rel = SKILL_BASE[diff] + (0 if pts < 2 else 1 if pts < 4 else 1 + pts // 4)
    return rel


def combat_flags(t, flags):
    """Traits the combat simulator (tools/sim.js) needs, read from active trait names."""
    n = t.get("name", "")
    lv = t.get("levels") or 1
    if t.get("children") is not None:
        return
    low = n.lower()
    if n.startswith("High Pain Threshold") or n.startswith("No Pain Receptors"):   # the Necron name for HPT
        flags["hpt"] = 1
    elif n.startswith("Combat Reflexes"):
        flags["cr"] = 1
    elif n.startswith("Hard to Kill"):
        flags["htk"] = flags.get("htk", 0) + lv
    elif n.startswith("Enhanced Parry"):
        flags["enhParry"] = flags.get("enhParry", 0) + lv
    elif n.startswith("Enhanced Block"):
        flags["enhBlock"] = flags.get("enhBlock", 0) + lv
    elif n.startswith("Extra Attack"):
        flags["extraAttack"] = flags.get("extraAttack", 0) + lv
    elif n.startswith("Fearlessness"):
        flags["fearless"] = flags.get("fearless", 0) + lv
    elif n.startswith("Unfazeable"):
        flags["unfazeable"] = 1
    elif n.startswith("Weapon Master") or n.lower().startswith("trained by a master"):
        flags["master"] = 1         # halves Rapid Strike and extra-parry penalties (B93, B99)
        if n.startswith("Weapon Master"):
            flags["wm"] = 1         # and adds damage with the weapon (B99)
    elif n.startswith("Injury Tolerance (Damage Reduction"):
        flags["dmgRed"] = flags.get("dmgRed", 0) + lv   # divisor; lens upgrades add a level each
    elif n.startswith("Injury Tolerance"):
        for k in ("unliving", "homogenous", "diffuse", "no brain", "no vitals"):
            if k in low:
                flags[k.replace(" ", "")] = 1
    elif n.startswith("Regeneration"):
        # HP per second (B80); the tier is in the name or the notes ("Regeneration (Very Fast)")
        txt = n + " " + str(t.get("notes", "")) + " " + str(t.get("local_notes", ""))
        for tier, rate in (("Extreme", 10), ("Very Fast", 1), ("Fast", 1 / 60), ("Regular", 1 / 3600)):
            if "(" + tier + ")" in txt:
                flags["regen"] = max(flags.get("regen", 0), rate)
                break
    elif n.startswith("Ambidexterity"):
        flags["ambi"] = 1
    elif n.startswith("Pariah Gene"):
        flags["blank"] = 1          # warp sorcery fails against a blank (framework "Psykers and the warp")
    elif n.startswith("Shadow in the Warp"):
        # radius from the Area Effect modifier ("Area Effect, 16 yards"); psykers inside it are at -3
        txt = " ".join(str(x.get("name", x) if isinstance(x, dict) else x) for x in t.get("modifiers", [])) + " " + n
        yd = re.search(r"(\d+)\s*yards", txt)
        flags["shadow"] = max(flags.get("shadow", 0), int(yd.group(1)) if yd else 16)
    elif n.startswith("Reanimation"):
        flags["reanimation"] = 1
        flags["noMorale"] = 1       # soulless machines: Necrons do not break
    elif n.startswith("Synapse Discipline"):
        flags["fearless"] = flags.get("fearless", 0) + 5   # Fearlessness 5 while linked; the sim assumes synapse is near
    elif "slave mentality" in low or "machine mind" in low:
        flags["noMorale"] = 1
    if n.startswith("Necrodermis Machine-Body") or n.startswith("Machine Body") or n.startswith("Machine Mind") or n == "Machine":
        flags["machine"] = 1        # Machines have no FP to spend on extra effort (B16, B263; user direction for Necrons)
    if ("metabolic hazards" in low or "toxins" in low or "poison" in low) and (
            n.startswith("Immunity") or n.startswith("Resistant")):
        immune = n.startswith("Immunity") or any(m.get("name", "").startswith("Immunity") and not m.get("disabled")
                                                  for m in t.get("modifiers", []))
        flags["poison"] = "immune" if immune else "resist"


def character_stats(d):
    bonus = {}
    dr = {}
    names = set()
    skill_bonus = {}
    enh_dodge = 0
    flags = {}
    for t in active_traits(d.get("traits", [])):
        names.add(t.get("name", "").split(" (")[0])
        combat_flags(t, flags)
        if t.get("name") == "Enhanced Dodge":
            enh_dodge += t.get("levels", 1)
        mods_on = [m for m in t.get("modifiers", []) if not m.get("disabled")]
        for f in t.get("features", []) + [f for m in mods_on for f in m.get("features", [])]:
            if f["type"] == "attribute_bonus":
                bonus[f["attribute"]] = bonus.get(f["attribute"], 0) + f["amount"] * (
                    t.get("levels", 1) if f.get("per_level") else 1)
            elif f["type"] == "dr_bonus" and not f.get("specialization"):
                for loc in f.get("locations", []):
                    dr[loc] = dr.get(loc, 0) + f["amount"]
            elif f["type"] == "skill_bonus":
                k = f["name"]["qualifier"]
                skill_bonus[k] = skill_bonus.get(k, 0) + f["amount"]
    b = lambda k: bonus.get(k, 0)
    st, dx, iq, ht = 10 + b("st"), 10 + b("dx"), 10 + b("iq"), 10 + b("ht")
    will, per = iq + b("will"), iq + b("per")
    hp, fp = st + b("hp"), ht + b("fp")
    speed = (dx + ht) / 4 + b("basic_speed")
    move = int(speed) + b("basic_move")
    dodge = int(speed) + 3 + b("dodge") + enh_dodge + (1 if "Combat Reflexes" in names else 0)
    lift_st = st + b("lifting_st")
    thr, sw = dmg_for(st + b("striking_st"))
    attrs = {"st": st, "dx": dx, "iq": iq, "ht": ht, "will": will, "per": per}
    skills = []
    def walk(ss):
        for sk in ss:
            if sk.get("children") is not None:
                walk(sk["children"]); continue
            diff = sk.get("difficulty", "")
            if "default" in sk:  # technique: show relative level only
                skills.append({"name": sk["name"], "level": None, "points": sk.get("points", 0)})
                continue
            a, _, lv = diff.partition("/")
            rel = skill_level(sk.get("points", 0), lv) if lv in SKILL_BASE else None
            base = attrs.get(a)
            lvl = None if rel is None or base is None else base + rel + skill_bonus.get(sk["name"], 0)
            nm = sk["name"] + (f" ({sk['specialization']})" if sk.get("specialization") else "")
            skills.append({"name": nm, "level": lvl, "points": sk.get("points", 0)})
    walk(d.get("skills", []))
    return {"st": st, "dx": dx, "iq": iq, "ht": ht, "hp": hp, "will": will, "per": per, "fp": fp,
            "speed": round(speed, 2), "move": move, "dodge": dodge, "sm": b("sm"),
            "bl": round(lift_st * lift_st / 5), "thr": thr, "sw": sw,
            "dr": dr, "skills": skills, "bonus": bonus, "flags": flags}


def template_entry(d, title):
    traits = [trait_entry(t) for t in d.get("traits", [])]
    skills = [skill_entry(s) for s in d.get("skills", [])]
    tp = sum(trait_cost(t) for t in d.get("traits", []))
    sp = sum(skill_cost(s) for s in d.get("skills", []))
    return {"name": title, "notes": d.get("notes", ""), "traitPoints": tp, "skillPoints": sp,
            "stats": character_stats(d), "addon": "add-on" in title.lower(),
            "points": tp + sp, "traits": traits, "skills": skills,
            "equipment": [eq_entry(e) for e in d.get("equipment", [])]}


# --------------------------------------------------------------------- main

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--exclude", action="append", default=[],
                    help="Library/ subpath to leave out (e.g. unreviewed drafts); repeatable")
    args = ap.parse_args()
    libs = []
    for p in sorted(LIB.rglob("*")):
        kind = KIND.get(p.suffix)
        if not kind:
            continue
        rel = p.relative_to(LIB)
        if any(rel.as_posix().startswith(x.rstrip("/") + "/") for x in args.exclude):
            continue
        d = json.loads(p.read_text())
        entry = {"id": rel.with_suffix("").as_posix().lower().replace(" ", "-").replace("/", "--"),
                 "title": p.stem, "section": "/".join(rel.parts[:-1]), "kind": kind, "path": rel.as_posix()}
        if kind == "template":
            entry["template"] = template_entry(d, p.stem)
            entry["count"] = 1
        else:
            fn = {"equipment": eq_entry, "traits": trait_entry, "skills": skill_entry}[kind]
            entry["items"] = [fn(r) for r in d["rows"]]
            entry["count"] = len(entry["items"])
        libs.append(entry)
    import yaml
    def sim_data(name):
        f = ROOT / "data" / "sim" / name
        return (yaml.safe_load(f.read_text()) or {}) if f.exists() else {}
    data = json.dumps({"libraries": libs, "loadouts": sim_data("loadouts.yaml"), "simWeapons": sim_data("weapons.yaml"),
                       "powers": sim_data("powers.yaml"), "ai": sim_data("ai.yaml")}, ensure_ascii=False, separators=(",", ":"))
    html = TEMPLATE.read_text().replace("/*__DATA__*/null", data.replace("</", "<\\/"))
    html = html.replace("/*__SIM__*/", SIM.read_text())
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(f"{OUT.relative_to(ROOT)}: {len(libs)} libraries, {len(html) // 1024} KB")


if __name__ == "__main__":
    main()
