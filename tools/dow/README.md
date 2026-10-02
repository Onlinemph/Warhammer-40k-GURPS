# Dawn of War models for the simulator's 3D view

The 3D replay draws every figure from simple shapes. If you own Dawn of War: Soulstorm and Dawn of War II, these tools convert their unit models into a local pack the page picks up instead: the games' meshes, repainted in each faction's colours, moving with the games' own animations. Dawn of War II has the better models, so its units are used where it has them (Space Marines, Chaos, Aeldari, Orks, Guardsmen and all Tyranids); Soulstorm supplies the rest, and stands in for all but the Tyranids if you only own that game.

**The pack is yours alone.** The models and textures belong to Relic and Games Workshop. `site/models/` is in `.gitignore`; don't commit it, publish it or share the built folder. The repository ships only the converter and the list of which model stands for which unit, and the site works the same without the pack.

## Building the pack

You need:

- Dawn of War: Soulstorm installed, for the factions and vehicles Dawn of War II lacks. A Steam install is found by itself; otherwise set `DOW_SOULSTORM` to the install folder.
- Blender 4.4 or newer with the [blender_dow](https://github.com/amorgun/blender_dow) extension enabled, for the Soulstorm units. Blender is found on `PATH`; otherwise set `BLENDER` to `blender.exe`.
- Dawn of War II installed (`DOW_DOW2` if it isn't found). Its units need no Blender: `dow2.py` reads the game's files itself.
- Python 3.10 or newer with Pillow and numpy.

```sh
python tools/dow/build_pack.py            # every unit that changed since the last build
python tools/dow/build_pack.py sm_marine  # only these units
python tools/dow/build_pack.py --force    # everything again
```

A full build runs Blender once per Soulstorm unit, four at a time (`DOW_JOBS` changes that), and takes a few minutes. To build only what one game provides, name those units. It writes `site/models/<id>.js` per unit and `site/models/index.js`. Open `site/index.html`, run a battle and switch on 3D: figures with a model in the pack use it. The page fetches three.js's glTF loader from jsDelivr the first time it needs it.

On Windows, run it with a Python installed from python.org or a virtual environment. The Microsoft Store Python gives Blender a private copy of `AppData`, where it can't see its extensions.

## What is covered

`units.json` lists 106 units: 36 from Dawn of War II (Space Marines with sergeants, Scouts and Terminators; Guardsmen; Chaos Marines, Plague Marines, Berzerkers, lords, sorcerers and cultists; Aeldari Guardians, Rangers, Banshees, Warlocks and Farseers; Ork Boyz, Kommandos, Nobz, a Warboss and a Weirdboy; ten Tyranids) and 70 from Soulstorm (63 infantry and 7 vehicles). Where both games have a unit, the Dawn of War II entry comes first in the file and wins; the Soulstorm one is used when that game's files aren't there. Most are the unit itself. The game has no model for some, so these use the nearest stand-in (marked `proxy` in the file):

| Simulator unit | Stand-in |
|---|---|
| Custodian Guardian, Shield-Captain | Grey Knight, tinted gold |
| Sister of Silence | Sororitas Veteran Superior |
| Skitarii Ranger and Vanguard | Kasrkin |
| Sicarian Ruststalker | Death Cult Assassin |
| Inquisitor, Interrogator | Guard captain, Ecclesiarchy missionary |
| Magos, Electro-Priest | Tech-Priest Enginseer |
| Autarch | Fire Dragon Exarch |
| Wrack | Tortured Slave |
| Lychguard, Deathmark, Skorpekh Destroyer | Pariah, Immortal, Destroyer |
| Earth and Air Caste, Water Caste | Pathfinder, Ethereal |

Not covered, so still drawn from shapes: any vehicle not in the list.

Known gaps: the Mandrake only has its idle animation (its others import upside down), tracks don't roll, and Soulstorm units keep one animation set whatever they carry, so a heavy bolter is held like a bolter. The Terminator entry has not been seen in the page, because no simulator loadout wears Terminator armour yet.

## Battlefields

`build_pack.py` also writes `site/models/scenery.js` from Dawn of War II's environment archives, and the 3D replay dresses its battlefields with it:

- the ground, the facility's deck plates, wall panels and gratings take the game's terrain textures;
- the cover crates on the facility and ruins maps become sandbags, barrels and ammunition cases, in the same hexes and about the same size;
- open ground gets the game's rocks, concrete rubble and twisted metal underfoot, with tank traps, containers and barricades around the edge;
- outdoor maps get a skyline of the game's city buildings around the field, and its storm sky. A building standing between the camera and what it looks at is hidden until the camera moves on.

None of this changes the fight. Whatever is big enough to hide behind stands at least six yards from anywhere a figure goes, and the cover the simulator models keeps its place.

```sh
python tools/dow/build_pack.py scenery    # only the scenery
```

`scenery.json` lists the textures and world objects and what each is used for. To see what else the game has, list an archive: `python tools/dow/dow2.py "<Dawn of War 2>/GameAssets/Archives/gameartenvironment.sga" world_objects`.

The ruins keep the page's own painted masonry: the game's wall textures tried so far read worse on hex columns.

## Sound

`build_pack.py` also writes `site/models/sounds.js` from Dawn of War II's sound archives: weapon fire for each of the simulator's weapon kinds, impacts on flesh, armour and shields, ricochets, explosions, melee swings and hits, and bodies falling. `sounds.json` says which of the game's sounds goes with which replay event. In the 3D view the **Sound** button switches them on; they play while the replay runs, louder near the camera and panned to their side of the screen. Like the models, the sound pack is the game's own audio and stays on your machine.

```sh
python tools/dow/build_pack.py sounds     # only the sounds
```

There are no voices yet, and weapons Dawn of War II doesn't have borrow the nearest sound (gauss and dark lances use the bright lance, pulse rifles the Aeldari pulse cannon, splinter weapons the shuriken pistol).

## How it works

1. `build_pack.py` reads `units.json` and runs `bl_export.py` in Blender for each unit.
2. `bl_export.py` imports the model straight from the game's archives, keeps the meshes the unit's looks need and a handful of animations, and writes a `.glb` with no textures, plus each material's base image and paint masks.
3. `build_pack.py` wraps those into one script per unit. Scripts and data URLs load from `file://`, so the page needs no server.
4. In the page, `tools/sim/page/31-view3d-models.js` loads the index, matches each figure to a unit, paints its textures and swaps the model in.

**Paint.** The game colours a unit with greyscale masks: primary, secondary, trim, weapons, eyes, and "dirt" for how much of the default texture shows through. The page applies the same formula with the faction's colours from the scheme table in `31-view3d-figures.js`, so one model serves every chapter, legion and regiment.

**Looks.** A model holds every weapon option as a separate mesh. Each unit's `looks` say which meshes show for which weapon the figure carries, keyed by the simulator's weapon kinds (`bolt`, `plasma`, `flame`, `bolt+power` for a ranged and melee pair, `default` otherwise). A look is the name of one of the game's own visibility animations (`vis_bolter`), a list of them, or a list of mesh names; `*` means the meshes the game shows by default.

**Animations.** The page uses up to eight clips: `idle`, `run`, `fire`, `melee`, `die`, `hit`, `kneel` and `throw`. The game names them differently from unit to unit, so the exporter tries the usual names, then the plainest name of the right kind. `clips` in a unit overrides that, `prefix` prefers names starting with it, and `clips_from` borrows another unit's clips where the game itself shares a skeleton (a Chaos Marine moves as a Space Marine).

## Dawn of War II units

That game keeps a unit in pieces: a skeleton, body and weapon models skinned to it by bone name, and one Havok animation file per move. `dow2.py` reads all of it directly (its docstring has the file formats, including the delta-compressed Havok animations) and writes the same `.glb` and paint layers as the Blender route. An entry looks like this:

| Field | Meaning |
|---|---|
| `game` | `dow2` |
| `skeleton` | The unit's own `.model`, which holds only bones |
| `parts` | Name to `.model` path for the body, head, backpack and each weapon. A body stored in the skeleton's own file is picked up by itself. `{"model": path, "remap": {bone: bone}}` moves a part to another bone |
| `looks` | Which parts show for which weapon, as for Soulstorm units |
| `sets` | A look's own animation folder, where a weapon is held differently (a missile launcher, a power fist) |
| `anims` | The folder of `.hkx` files for the weapon set these parts go with |
| `clips` | Page name to file name without `.hkx`, where the usual names don't fit; `other_folder/name` takes it from another of the unit's folders, `null` leaves it out |
| `tem` | What the team-colour texture's red, green, blue and alpha channels colour, one letter each: `p`rimary, `s`econdary, `t`rim, `w`eapons or `-`. It differs by race (default `ptsw`: carapace, details, flesh, the rest) |

`python tools/dow/dow2.py <archive.sga> [text]` lists an archive's files. Some weapon models in the archives are leftovers with no skinning or with textures that are gone; the `_common` and `_rare` ones are the ones the game uses.

## Adding or changing a unit

`bl_probe.py` writes down what a model holds (meshes, visibility animations, animation names, bones) as JSON:

```sh
blender --background --python tools/dow/bl_probe.py -- "<Soulstorm>/DXP2" out art/ebps/races/orks/troops/stormboyz.whm
```

`sga.py list <archive.sga> .whm` lists the models in an archive. Add an entry to `units.json` and rebuild that unit:

| Field | Meaning |
|---|---|
| `id` | Name of the built file |
| `whm` | The model's path inside the game's archives |
| `match`, `not` | Regular expressions tested against `<faction> <template> <vehicle> \| <ranged weapon>\|<melee weapon>\|<armour>`. The first unit in the file that matches is used, so put the specific ones first |
| `h` | Height in yards for a figure of Size Modifier 0 (vehicles: overall height) |
| `looks`, `base`, `drop` | Meshes per weapon; `base` is added to every look, `drop` removed from every look |
| `clips`, `prefix`, `clips_from`, `own` | Animations, as above; `own: false` takes every clip from `clips_from` |
| `veh`, `turret` | A vehicle, and the bone its turret turns on |
| `tint`, `paint` | A colour multiplied over the textures; fixed paint colours instead of the faction's |
| `size` | `bounds` sizes the model from its outline instead of its head bone |
| `proxy` | A note that this is a stand-in |
