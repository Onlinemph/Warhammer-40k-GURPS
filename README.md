# Warhammer 40,000 for GURPS 4e

Lore-accurate GURPS Fourth Edition conversions of the Warhammer 40,000 setting, published as GURPS Character Sheet (GCS) libraries.

## Using the library

The ready-to-load files are in `Library/`. In GCS, open **Settings → Libraries**, add a new library pointing at a local clone of this repository, or open individual `.eqp`, `.adq`, `.skl` and `.gct` files directly.

## How it's built

Stats are written as YAML in `data/` and compiled to GCS format:

```sh
pip install pyyaml
python3 tools/build_gcs.py
```

- `docs/framework.md`: conversion rules, lore-source priorities, and the fixed damage/armour anchors every entry is calibrated against.
- `docs/data-format.md`: YAML field reference.

Each entry carries its lore sources and the derivation of its numbers in the GCS notes field.

## Scope

Built in waves. Wave 1 is the core Imperium: Astra Militarum, Adeptus Astartes, Adepta Sororitas, the Inquisition, psykers, and their wargear.

Warhammer 40,000 is © Games Workshop. GURPS is © Steve Jackson Games. This is an unofficial fan project; it reproduces no rules text from either.
