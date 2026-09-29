# Data Format

Source files live in `data/` as YAML. `tools/build_gcs.py` turns them into GCS v5 libraries under `Library/`. Never edit `Library/` by hand; it's regenerated.

```sh
python3 tools/build_gcs.py           # build all
python3 tools/build_gcs.py --check   # validate without writing
python3 tools/build_gcs.py data/imperium/weapons/las.yaml   # one file
```

Each YAML file produces one GCS file:

```yaml
kind: equipment          # equipment | traits | skills | template
output: Imperium/Weapons/Las Weapons.eqp   # path under Library/; extension must match kind
items: [...]             # for equipment / traits / skills
```

## Shared fields

| Field | Meaning |
|---|---|
| `name` | Entry name. For equipment this becomes GCS `description`. |
| `tags` | List of GCS tags. Use GCS's standard category tags (`Missile Weapon`, `Melee Weapon`, `Body Armor`, `Advantage`, `Disadvantage`, `Physical`, `Mental`...) plus faction tags. |
| `ref` | Page reference. Use only real, known GURPS references (e.g. `B46`). Leave out rather than guess. |
| `notes` | Rules text a player needs at the table. |
| `lore` | Background and sources (see framework.md). |
| `design` | Derivation of the numbers. |

`notes`, `lore` and `design` are joined into GCS's notes field.

## Equipment (`kind: equipment`)

```yaml
- name: Lasgun, Kantrael M36 Pattern
  tl: 10
  lc: 3
  cost: 500
  weight: 7.9            # lb assumed if no unit
  tags: [Missile Weapon, Imperium, Astra Militarum]
  weapons:
    - usage: Standard
      damage: 4d burn    # "sw+1d cut", "6d(2) pi+", "6dx2(3) burn ex", "4d cr ex [2d]" (fragmentation)
      acc: 10
      range: 700/2100
      rof: 10
      shots: 60(3)
      st: 6
      bulk: -4
      rcl: 1
      skill: Beam Weapons (Rifle)   # standard defaults generated automatically
  dr: {"torso,vitals,groin": 8, skull: 6}   # or list of {locations, amount, vs: burn}
  children: [...]        # makes this a container (e.g., a kit)
  modifiers:             # equipment modifiers, disabled unless enabled: true
    - {name: Overcharge pack, cost: "+50", cost_type: to_original_cost, notes: ...}
```

Melee weapons use `reach`, `parry`, `block`, `st` instead of the ranged keys. `skill` gets a standard default family for: Beam Weapons, Guns, Gunner, Liquid Projector, Throwing, Artillery, Broadsword, Shortsword, Knife, Axe/Mace, Two-Handed Axe/Mace, Two-Handed Sword, Spear, Polearm, Staff, Force Sword, Flail, Brawling, Shield. For anything else give `defaults: ["DX-4", "Karate", "Brawling-2"]`.

Hit locations: skull, eye, face, neck, torso, vitals, groin, arm, hand, leg, foot, tail, wing, fin, brain, all.

## Traits (`kind: traits`)

```yaml
- name: Enhanced Reflexes
  points: 10            # base points
  per_level: 5          # makes it leveled; set levels: N
  levels: 2
  tags: [Advantage, Physical]
  modifiers:
    - "Warp, -10%"      # "Name, cost" shorthand
    - {name: Perils of the Warp, cost: "-20%", notes: ...}
  attributes: {st: 8, hp: 4}
  dr: {all: 3}
  skill_bonuses: {"Theology (Imperial Creed)": 2}
  reactions: [{situation: from the Imperial faithful, amount: 2}]
  conditional: [{situation: to resist Fright Checks, amount: 3}]
  weapons: [...]        # natural attacks
  cr: 12                # self-control roll for disadvantages
- name: Astartes
  container: meta_trait # or ancestry, alternative_abilities, group
  children: [...]       # nested traits; GCS sums the cost
```

## Skills (`kind: skills`)

```yaml
- name: Hidden Lore
  spec: Daemons
  diff: IQ/A            # no default (B199)
- name: Area Knowledge
  spec: Segmentum Obscurus
  diff: IQ/E
  defaults: ["IQ-4"]
- name: Psyniscience
  diff: Per/H
- name: Targeted Bolt Shot       # a technique
  technique_of: Guns (Pistol)
  diff: H
  limit: 0
```

## Templates (`kind: template`)

```yaml
kind: template
output: Imperium/Templates/Guardsman.gct
notes: Free text shown in GCS.
traits: [...]     # as in traits files
skills: [...]     # as in skills files, with points set
equipment: [...]
```

## Reusing entries across files (`include`)

Any list entry (trait, skill, equipment, or a container's child) can pull in an entry defined in another data file instead of copying it:

```yaml
traits:
  - include: "imperium/astartes/gene-seed.yaml#Astartes"
  - include: "imperium/astartes/gene-seed.yaml#Primaris Astartes"
    disabled: true        # keys beside include override the included entry
```

The path is relative to `data/`; the part after `#` is the entry's `name`. Templates should always include racial packages and shared traits this way, so a fix to the source updates every template on rebuild.

## Build checks

`build_gcs.py --check` also catches two recurring mistakes:

- A leveled trait whose `points` equals `per_level × levels`. `points` is the base cost added on top of the levels, so this charges twice. If a real base cost happens to equal one level (e.g. Warp Empowerment, 10 + 10/level), mark the entry `base_cost_intended: true`.
- A weapon line whose usage says "field on" or "power-field" but whose damage has no armour divisor.

## Simulator loadouts (`data/sim/loadouts.yaml`)

The combat simulator on the site (`tools/sim.js`) gives each template a default battle loadout. Keys are template titles exactly as the `.gct` file stems; add-ons are skipped.

```yaml
Astra Militarum Guardsman:
  armour: ["Flak Full Suit (Cadian Pattern)", "Flak Helmet"]   # equipment names; a suit container counts as one
  ranged: {item: "Lasgun, Kantrael Pattern", mode: "Standard"} # mode = the weapon line's usage
  melee: {item: "Bayonet, Lug-Mounted", mode: "Fixed to lasgun"}   # or {trait: "Rending Claws"} for natural weapons
  shield: {item: "Refractor Field", sp: 40, delay: 2, recharge: 10, ranged_only: true}   # recharge 0 = one-shot
  stance: shoot    # shoot | advance | charge
  note: One line on what this kit is and any choice made.
```

The simulator reads DR, Weak Points, servo ST and Basic Move changes from the armour items, and follow-up damage from the weapon line after the chosen one. `node tools/sim_test.js` runs a few reference fights against the built site.
