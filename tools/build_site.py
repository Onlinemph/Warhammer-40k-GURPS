#!/usr/bin/env python3
"""Build a single-page browser for the GCS libraries in Library/.

    python3 tools/build_site.py      # writes site/index.html

Reads the generated GCS files (run build_gcs.py first), computes point costs the
way GCS does (modifiers summed, -80% floor, rounded up; alternative abilities at
1/5 cost), and embeds everything as JSON in one HTML page.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "Library"
OUT = ROOT / "site" / "index.html"
TEMPLATE = ROOT / "tools" / "site_template.html"

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
    pct = mod_pct(t)
    if base > 0:
        return math.ceil(base * (1 + pct / 100) - 1e-9)
    return math.floor(base * (1 + pct / 100) + 1e-9) if pct < 0 else base


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
           "skill": skill or (fmt_default(defs[0]) if defs else ""), "notes": w.get("usage_notes", "")}
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


def template_entry(d, title):
    traits = [trait_entry(t) for t in d.get("traits", [])]
    skills = [skill_entry(s) for s in d.get("skills", [])]
    tp = sum(trait_cost(t) for t in d.get("traits", []))
    sp = sum(skill_cost(s) for s in d.get("skills", []))
    return {"name": title, "notes": d.get("notes", ""), "traitPoints": tp, "skillPoints": sp,
            "points": tp + sp, "traits": traits, "skills": skills,
            "equipment": [eq_entry(e) for e in d.get("equipment", [])]}


# --------------------------------------------------------------------- main

def main():
    libs = []
    for p in sorted(LIB.rglob("*")):
        kind = KIND.get(p.suffix)
        if not kind:
            continue
        rel = p.relative_to(LIB)
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
    data = json.dumps({"libraries": libs}, ensure_ascii=False, separators=(",", ":"))
    html = TEMPLATE.read_text().replace("/*__DATA__*/null", data.replace("</", "<\\/"))
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(html)
    print(f"{OUT.relative_to(ROOT)}: {len(libs)} libraries, {len(html) // 1024} KB")


if __name__ == "__main__":
    main()
