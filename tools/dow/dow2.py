"""Read Dawn of War II units straight from the game's archives and write them as .glb, with no Blender.

A unit in that game is put together from several files:
    art/race_x/troops/<unit>/<unit>.model                 the skeleton (no meshes)
    art/race_x/troops_wargear/armour/.../*.model           the body, skinned to that skeleton by bone name
    art/race_x/troops_wargear/weapons_*/.../*.model        claws, guns, tails, the same way
    art/race_x/troops/<unit>/animations/<set>/*.hkx        one Havok 4.5 file per animation

The formats, as far as this needs them (all little-endian):

SGA 5 archive   "_ARCHIVE", u16 5, u16 0, md5, name, md5, at 172: u32 toc size, u32 data offset, u32 toc offset.
                The table of contents is the same as SGA 2's (tools/dow/sga.py) but sits at the end of the file,
                and a file entry is 22 bytes: name, data offset, compressed size, size, time (u32 each), flags (u16).
Relic Chunky    36-byte header, then chunks: "FOLD" or "DATA", 4-char type, u32 version, u32 size, u32 name length,
                2 x u32, name, data. A FOLD's data is more chunks.
.model          FOLDSKEL holds one DATABONE per bone (the chunk's name is the bone's): i32 parent, u32, then the
                local matrix as 4 rows of 3 floats (three axes, then the translation), for row vectors.
                Meshes are FOLDMESH > FOLDMGRP > FOLDMESH (health state) > FOLDIMDG > FOLDMESH (level of detail) >
                FOLDIMOD > FOLDMESH (one per material) > FOLDTRIM > DATADATA: the vertex layout (type, version,
                format per element), the vertices, 16-bit triangle indices, the material's name and the bones the
                mesh is skinned to. Packed normals and weights are in D3DCOLOR byte order (z, y, x, w).
                FOLDMTRL holds a material's variables; the texture ones are paths without the .dds.
Havok packfile  Sections __classnames__, __types__ and __data__, each with fixup tables: local (pointer at A points
                to B), global (the same across sections) and virtual (the object at A is of class N). The file
                carries its own class layouts, but for Havok 4.5.1 they are fixed, so the offsets are written out
                below.
Delta-compressed animation (hkDeltaCompressedSkeletalAnimation)
                One 16-bit mask per track: bits 0-1, 2-3, 4-5 say how the position, rotation and scale are stored
                (0: per component, 1: all constant, 2: left at identity) and bits 6-15 mark the components that
                change (position z y x, rotation w z y x, scale z y x: each group back to front). Constant components are floats in track
                order. The changing ones are stored in blocks of `blockSize` poses: for each, its first value as a
                float, then one quantised step per later pose (step = offset + scale * q / (2^bits - 1)).

The game's space is left-handed with y up; glTF's is right-handed, so everything is mirrored in x on the way out.
"""
import io
import json
import struct
import threading
import zlib
from pathlib import Path

import numpy as np


# ------------------------------------------------------------------ archives

class Archives:
    """The files of several SGA 5 archives, by lower-case path with forward slashes. Earlier archives win."""

    def __init__(self, paths):
        self.files = {}
        self.lock = threading.Lock()
        for path in paths:
            fh = open(path, "rb")
            head = fh.read(196)
            if head[:8] != b"_ARCHIVE" or struct.unpack_from("<H", head, 8)[0] != 5:
                raise ValueError(f"{path} is not an SGA 5 archive")
            toc_size, data_off, toc_off = struct.unpack_from("<III", head, 172)
            fh.seek(toc_off)
            toc = fh.read(toc_size)
            _, _, f_off, f_n, fi_off, _, s_off, _ = struct.unpack_from("<IHIHIHIH", toc, 0)

            def name(rel):
                return toc[s_off + rel:toc.index(b"\0", s_off + rel)].decode("latin-1")

            for i in range(f_n):
                name_off, _, _, first, last = struct.unpack_from("<IHHHH", toc, f_off + 12 * i)
                folder = name(name_off).replace("\\", "/").lower()
                for j in range(first, last):
                    n, off, csize, size, _, _ = struct.unpack_from("<IIIIIH", toc, fi_off + 22 * j)
                    self.files.setdefault((folder + "/" + name(n).lower()).lstrip("/"), (fh, data_off + off, csize, size))

    def read(self, path):
        fh, off, csize, size = self.files[path.replace("\\", "/").lower()]
        with self.lock:   # the pack builder reads from several threads
            fh.seek(off)
            data = fh.read(csize)
        return zlib.decompress(data) if csize != size else data

    def has(self, path):
        return path.replace("\\", "/").lower() in self.files

    def locate(self, path):
        """The path itself, or a file of the same name elsewhere: some models still name a texture's old folder."""
        path = path.replace("\\", "/").lower()
        if path in self.files:
            return path
        if not hasattr(self, "by_name"):
            self.by_name = {}
            for p in self.files:
                self.by_name.setdefault(p.rsplit("/", 1)[-1], p)
        return self.by_name.get(path.rsplit("/", 1)[-1])

    def under(self, folder, suffix=""):
        folder = folder.replace("\\", "/").lower().rstrip("/") + "/"
        return sorted(p for p in self.files if p.startswith(folder) and p.endswith(suffix))


# ------------------------------------------------------------------ Relic Chunky and .model

def chunks(buf, pos=36, end=None):
    """[(kind, type, name, start, end, children)]"""
    end = len(buf) if end is None else end
    out = []
    while pos + 28 <= end:
        kind, typ = buf[pos:pos + 4].decode("latin-1"), buf[pos + 4:pos + 8].decode("latin-1")
        _, size, nlen = struct.unpack_from("<III", buf, pos + 8)
        start = pos + 28 + nlen
        name = buf[pos + 28:start].rstrip(b"\0").decode("latin-1")
        out.append((kind, typ, name, start, start + size, chunks(buf, start, start + size) if kind == "FOLD" else []))
        pos = start + size
    return out


def find(tree, typ, deep=True):
    for c in tree:
        if c[1] == typ:
            yield c
        if deep:
            yield from find(c[5], typ)


def read_skeleton(buf):
    """[(name, parent index, local 4x4 for column vectors)]"""
    bones = []
    for _, _, name, s, _, _ in find(chunks(buf), "BONE"):
        parent = struct.unpack_from("<i", buf, s)[0]
        m = np.identity(4)
        m[:3, :] = np.frombuffer(buf, "<f4", 12, s + 8).reshape(4, 3).T
        bones.append((name, parent, m))
    return bones


def read_materials(buf):
    """{material name: {variable: texture path}}"""
    out = {}
    for _, _, name, _, _, kids in find(chunks(buf), "MTRL"):
        tex = {}
        for _, typ, _, s, e, _ in kids:
            if typ.strip(" \0") != "VAR":
                continue
            n = struct.unpack_from("<I", buf, s)[0]
            var = buf[s + 4:s + 4 + n].decode("latin-1")
            kind, size = struct.unpack_from("<II", buf, s + 4 + n)
            if kind == 9:
                tex[var] = buf[s + 12 + n:s + 12 + n + size].rstrip(b"\0").decode("latin-1").replace("\\", "/").lower()
        out[name] = tex
    return out


SIZES = {2: 4, 3: 8, 4: 12, 14: 4}   # bytes per vertex element format


def read_meshes(buf):
    """The most detailed level of the first health state: [dict(material, pos, nrm, uv, joints, weights, tris, bones)]"""
    tree = chunks(buf)
    group = next(find(next(find(tree, "MGRP"))[5], "MESH", deep=False), None)
    if not group:
        return []
    lods = []
    for lod in find(next(find(group[5], "IMDG"))[5], "MESH", deep=False):
        imod = next(find(lod[5], "IMOD"))
        level = struct.unpack_from("<I", buf, imod[5][0][3])[0] if imod[5] and imod[5][0][0] == "DATA" else 0
        lods.append((level, imod))
    out = []
    for sub in find(min(lods, key=lambda x: x[0])[1][5], "MESH", deep=False):
        trim = next(find(sub[5], "TRIM"), None)
        data = trim and next(find(trim[5], "DATA", deep=False), None)
        if not data:
            continue
        p = data[3]
        n_el = struct.unpack_from("<I", buf, p)[0]
        elements = [struct.unpack_from("<III", buf, p + 4 + 12 * i) for i in range(n_el)]
        n_verts, stride = struct.unpack_from("<II", buf, p + 4 + 12 * n_el)
        p += 12 + 12 * n_el
        raw = np.frombuffer(buf, np.uint8, n_verts * stride, p).reshape(n_verts, stride)
        mesh, at = {}, 0
        for kind, _, fmt in elements:
            col = raw[:, at:at + SIZES[fmt]]
            if kind == 0:
                mesh["pos"] = col.copy().view("<f4").reshape(n_verts, 3).astype(np.float64)
            elif kind == 1:
                mesh["joints"] = col.astype(np.int32)
            elif kind == 2:
                mesh["weights"] = col[:, [2, 1, 0, 3]].astype(np.float64) / 255
            elif kind == 3:
                mesh["nrm"] = (col[:, [2, 1, 0]].astype(np.float64) - 127.5) / 127.5 if fmt == 2 else col.copy().view("<f4").reshape(n_verts, 3).astype(np.float64)
            elif kind == 8:
                mesh["uv"] = col.copy().view("<f4").reshape(n_verts, 2).astype(np.float64)
            at += SIZES[fmt]
        p += n_verts * stride + 4
        n_idx = struct.unpack_from("<I", buf, p)[0]
        mesh["tris"] = np.frombuffer(buf, "<u2", n_idx, p + 12).reshape(-1, 3).astype(np.int64)
        p += 12 + 2 * n_idx
        n = struct.unpack_from("<I", buf, p)[0]
        mesh["material"] = buf[p + 4:p + 4 + n].rstrip(b"\0").decode("latin-1")
        p += 4 + n
        bones = []
        for _ in range(struct.unpack_from("<I", buf, p)[0] if p + 4 <= data[4] else 0):
            n = struct.unpack_from("<I", buf, p + 4 + 96)[0]
            bones.append(buf[p + 104:p + 104 + n].rstrip(b"\0").decode("latin-1"))
            p += 100 + n
        mesh["bones"] = bones
        if "pos" in mesh and len(mesh["tris"]):
            out.append(mesh)
    return out


# ------------------------------------------------------------------ Havok 4.5 animation

class Packfile:
    def __init__(self, buf):
        if struct.unpack_from("<II", buf, 0) != (0x57E0E057, 0x10C0C010):
            raise ValueError("not a Havok packfile")
        self.buf = buf
        secs = [struct.unpack_from("<7I", buf, 64 + 48 * i + 20) for i in range(struct.unpack_from("<i", buf, 20)[0])]
        names = {}
        start, local = secs[0][0], secs[0][1]
        p = start
        while p < start + local and buf[p] != 0xFF:
            q = buf.index(b"\0", p + 5)
            names[p + 5 - start] = buf[p + 5:q].decode()
            p = q + 1
        self.ptr, self.objects = {}, {}
        for start, local, glob, virt, exp, _, _ in secs:
            for o in range(start + local, start + glob - 7, 8):
                a, d = struct.unpack_from("<ii", buf, o)
                if a != -1:
                    self.ptr[start + a] = start + d
            for o in range(start + glob, start + virt - 11, 12):
                a, sec, d = struct.unpack_from("<iii", buf, o)
                if a != -1:
                    self.ptr[start + a] = secs[sec][0] + d
            for o in range(start + virt, start + exp - 11, 12):
                a, _, d = struct.unpack_from("<iii", buf, o)
                if a != -1:
                    self.objects.setdefault(names.get(d, "?"), []).append(start + a)

    def string(self, at):
        t = self.ptr[at]
        return self.buf[t:self.buf.index(b"\0", t)].decode("latin-1")


# where the fields sit, for the two Havok versions the game's files come in: (animation class, binding class,
# skeleton class, first field after the base class, offset of the track-to-bone array in the binding)
LAYOUTS = {"hkDeltaCompressedSkeletalAnimation": ("hkAnimationBinding", "hkSkeleton", 32, 4),     # Havok 4.5
           "hkaDeltaCompressedAnimation": ("hkaAnimationBinding", "hkaSkeleton", 36, 8)}          # Havok 6.6
PLAIN = {"hkInterleavedSkeletalAnimation": ("hkAnimationBinding", "hkSkeleton", 32, 4),
         "hkaInterleavedUncompressedAnimation": ("hkaAnimationBinding", "hkaSkeleton", 36, 8)}


def read_animation(buf):
    """dict(duration, bones: [name per track], pos: (poses, tracks, 3), rot: (poses, tracks, 4 as x y z w))"""
    pk = Packfile(buf)
    cls = next((c for c in (*LAYOUTS, *PLAIN) if c in pk.objects), None)
    if not cls:
        raise ValueError("no animation this reads: " + ", ".join(k for k in pk.objects if "Animation" in k))
    binding_cls, skeleton_cls, base, map_at = (LAYOUTS.get(cls) or PLAIN[cls])
    a = pk.objects[cls][0]
    duration, n_tracks = struct.unpack_from("<fi", buf, a + 12)

    def named(pos, rot):
        rot = rot / np.maximum(np.linalg.norm(rot, axis=2, keepdims=True), 1e-9)
        binding, skeleton = pk.objects[binding_cls][0], pk.objects[skeleton_cls][0]
        names_at = pk.ptr[skeleton + 12]
        names = [pk.string(pk.ptr[names_at + 4 * i]) for i in range(struct.unpack_from("<i", buf, skeleton + 16)[0])]
        n_map = struct.unpack_from("<i", buf, binding + map_at + 4)[0]
        to_bone = struct.unpack_from(f"<{n_map}h", buf, pk.ptr[binding + map_at]) if n_map else range(n_tracks)
        return {"duration": duration, "bones": [names[i] for i in to_bone], "pos": pos, "rot": rot}

    if cls in PLAIN:   # every pose in full: translation, rotation, scale as four floats each
        count = struct.unpack_from("<i", buf, a + base + 4)[0]
        full = np.frombuffer(buf, "<f4", count * 12, pk.ptr[a + base]).reshape(-1, n_tracks, 12).astype(np.float64)
        return named(full[:, :, :3], full[:, :, 4:8])

    n_poses, block = struct.unpack_from("<ii", buf, a + base)
    preserved = buf[a + base + 9]
    n_dyn, off_i, scl_i, bw_i = struct.unpack_from("<IIII", buf, a + base + 12)
    q_i, _, mask_i, _, static_i = struct.unpack_from("<5I", buf, a + base + 28)
    block_bytes, last_bytes = struct.unpack_from("<II", buf, a + base + (52 if base == 32 else 60))
    data = pk.ptr[a + base + (60 if base == 32 else 68)]
    if preserved != 1:
        raise ValueError(f"{preserved} preserved values per block: not handled")
    masks = np.frombuffer(buf, "<u2", n_tracks, data + mask_i)
    offs = np.frombuffer(buf, "<f4", n_dyn, data + off_i).astype(np.float64)
    scls = np.frombuffer(buf, "<f4", n_dyn, data + scl_i).astype(np.float64)
    bits = np.frombuffer(buf, np.uint8, n_dyn, data + bw_i).astype(np.int64)

    # the changing components, pose by pose
    dyn = np.zeros((n_poses, n_dyn))
    p, done = data + q_i, 0
    while done < n_poses:
        n = min(block, n_poses - done)
        for d in range(n_dyn):
            dyn[done, d] = struct.unpack_from("<f", buf, p)[0]
            p += 4
            nbytes = (bits[d] * (n - 1) + 7) // 8
            if n > 1 and bits[d]:
                stream = int.from_bytes(buf[p:p + nbytes], "little")
                q = np.array([(stream >> (bits[d] * k)) & ((1 << bits[d]) - 1) for k in range(n - 1)])
                dyn[done + 1:done + n, d] = dyn[done, d] + np.cumsum(offs[d] + scls[d] * q / ((1 << bits[d]) - 1))
            elif n > 1:
                dyn[done + 1:done + n, d] = dyn[done, d]
            p += nbytes
        used = p - (data + q_i) - (done // block) * block_bytes
        if used != (block_bytes if n == block else last_bytes):
            raise ValueError(f"animation block is {used} bytes, the file says {block_bytes if n == block else last_bytes}")
        done += n

    # every track's ten components: position, rotation, scale
    out = np.zeros((n_poses, n_tracks, 10))
    out[:, :, 6] = 1
    out[:, :, 7:] = 1
    static = np.frombuffer(buf, "<f4", (off_i - static_i) // 4, data + static_i)
    s = d = 0
    for t, mask in enumerate(masks):
        for first, count, kind in ((0, 3, mask & 3), (3, 4, mask >> 2 & 3), (7, 3, mask >> 4 & 3)):
            for c in range(first, first + count):
                if kind == 0 and mask >> (6 + first + (first + count - 1 - c)) & 1:   # within a group the bits run from the last component to the first
                    out[:, t, c] = dyn[:, d]
                    d += 1
                elif kind != 2:
                    out[:, t, c] = static[s]
                    s += 1
    if d != n_dyn or s != len(static):
        raise ValueError(f"animation masks describe {d} changing and {s} constant values, the file has {n_dyn} and {len(static)}")
    return named(out[:, :, :3], out[:, :, 3:7])


# ------------------------------------------------------------------ sound

def read_sound(buf, seconds=2.5):
    """One sound from an FMOD sound bank (.fsb, version 4, one sample a file): (sample rate, IMA ADPCM bytes).

    48-byte header ("FSB4", sample count, size of the sample headers, size of the data, ...), then an 80-byte
    header per sample: its name, length in samples at 32, flags at 48, rate at 52, channels at 62. With flag
    0x400000 the data is IMA ADPCM in 36-byte blocks of 64 samples, which is how it goes into the pack (the page
    decodes it). None for anything else: stereo, plain samples or MPEG, which the game uses for music and ambience.
    """
    if buf[:4] != b"FSB4" or struct.unpack_from("<I", buf, 4)[0] != 1:
        return None
    headers, size = struct.unpack_from("<II", buf, 8)
    flags, rate = struct.unpack_from("<Ii", buf, 48 + 48)
    if not flags & 0x400000 or struct.unpack_from("<H", buf, 48 + 62)[0] != 1:
        return None
    blocks = min(size // 36, int(rate * seconds) // 64)
    return rate, buf[48 + headers:48 + headers + 36 * blocks]


# ------------------------------------------------------------------ glTF

def quat_of(m):
    """Rotation matrix (column vectors) -> quaternion x y z w."""
    t = m[0, 0] + m[1, 1] + m[2, 2]
    if t > 0:
        s = np.sqrt(t + 1) * 2
        q = [(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, s / 4]
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        q = [s / 4, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s]
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        q = [(m[0, 1] + m[1, 0]) / s, s / 4, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s]
    else:
        s = np.sqrt(1 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        q = [(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, s / 4, (m[1, 0] - m[0, 1]) / s]
    q = np.array(q)
    return q / np.linalg.norm(q)


MIRROR = np.diag([-1.0, 1, 1, 1])


class Glb:
    def __init__(self):
        self.bin = bytearray()
        self.doc = {"asset": {"version": "2.0"}, "scene": 0, "scenes": [{"nodes": []}], "nodes": [], "meshes": [], "materials": [],
                    "skins": [], "animations": [], "accessors": [], "bufferViews": [], "buffers": [{}]}

    def accessor(self, arr, kind, comp, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        while len(self.bin) % 4:
            self.bin.append(0)
        view = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": arr.nbytes}
        if target:
            view["target"] = target
        self.bin += arr.tobytes()
        self.doc["bufferViews"].append(view)
        acc = {"bufferView": len(self.doc["bufferViews"]) - 1, "componentType": comp, "count": len(arr), "type": kind}
        if minmax:
            flat = arr.reshape(len(arr), -1)
            acc["min"], acc["max"] = flat.min(axis=0).tolist(), flat.max(axis=0).tolist()
        self.doc["accessors"].append(acc)
        return len(self.doc["accessors"]) - 1

    def bytes(self):
        self.doc["buffers"][0]["byteLength"] = len(self.bin)
        doc = {k: v for k, v in self.doc.items() if v or k in ("scene",)}
        js = json.dumps(doc, separators=(",", ":")).encode()
        js += b" " * (-len(js) % 4)
        body = bytes(self.bin) + b"\0" * (-len(self.bin) % 4)
        return struct.pack("<III", 0x46546C67, 2, 28 + len(js) + len(body)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(body), 0x004E4942) + body


def build(arc, unit):
    """One unit -> (glb bytes, meta, {material: {texture kind: PIL image}}).

    unit: {"skeleton": path,
           "parts": {name: model path, or {"model": path, "remap": {bone: bone}}},
           "anims": folder, "clips": {page name: file stem or list of them},
           "sets": {look: folder}, "looks": {look: [part names]}}

    A part is skinned by bone name. A weapon brings a few bones of its own (the hand bone it hangs from, a reload
    lever, chain teeth): the ones the unit lacks are added under the bone of the same name as their parent, and
    every mesh is bound with the rest pose of the file it came from, so a gun modelled at the origin still ends
    up in the hand. "remap" moves a part to another bone (a right-hand pistol into the left hand).
    "sets" gives a look an animation folder of its own; its clips are named "idle@<look>" and the page prefers them.
    """
    from PIL import Image

    bones = [list(b) for b in read_skeleton(arc.read(unit["skeleton"]))]
    index = {b[0].lower(): i for i, b in enumerate(bones)}

    materials, textures, bounds, mesh_material, names, meshes = {}, {}, {}, {}, [], []
    glb = Glb()
    # some units' own files carry the body as well as the skeleton: that goes into every look
    for part, spec in [("base", unit["skeleton"]), *unit["parts"].items()]:
        spec = {"model": spec} if isinstance(spec, str) else spec
        buf = arc.read(spec["model"])
        remap = {k.lower(): v.lower() for k, v in spec.get("remap", {}).items()}
        own = read_skeleton(buf)
        own_world = []
        for name, parent, local in own:
            own_world.append(own_world[parent] @ local if parent >= 0 else local)
            key = remap.get(name.lower(), name.lower())
            if key not in index:   # a bone only this part has: hang it where the part has it
                up = own[parent][0].lower() if parent >= 0 else None
                index[key] = len(bones)
                bones.append([name, index.get(remap.get(up, up), 0) if up else -1, local])
        rest = {name.lower(): w for (name, _, _), w in zip(own, own_world)}
        mats = read_materials(buf)
        for k, mesh in enumerate(read_meshes(buf)):
            mat = mesh["material"].split(".")[-1]
            if mat not in materials:
                materials[mat] = len(glb.doc["materials"])
                glb.doc["materials"].append({"name": mat})
                tex = mats.get(mesh["material"]) or next((v for n, v in mats.items() if n.endswith(mat)), {})
                textures[mat] = {var: Image.open(io.BytesIO(arc.read(arc.locate(p + ".dds")))) for var, p in tex.items()
                                 if var in ("diffuseTex", "teamTex", "emissiveTex") and arc.locate(p + ".dds")}
            meshes.append((part if k == 0 else f"{part}.{k}", mat, mesh, remap, rest))

    world = []
    for name, parent, local in bones:
        world.append(world[parent] @ local if parent >= 0 else local)
    nodes = glb.doc["nodes"]
    for name, parent, local in bones:
        m = MIRROR @ local @ MIRROR
        nodes.append({"name": name, "translation": m[:3, 3].tolist(), "rotation": quat_of(m[:3, :3]).tolist()})
    for i, (_, parent, _) in enumerate(bones):
        if parent >= 0:
            nodes[parent].setdefault("children", []).append(i)
    roots = [i for i, (_, parent, _) in enumerate(bones) if parent < 0]

    for name, mat, mesh, remap, rest in meshes:
        used = mesh["bones"] or [bones[0][0]]
        joints_of = [index.get(remap.get(b.lower(), b.lower()), 0) for b in used]
        bind = [rest.get(b.lower(), world[j]) for b, j in zip(used, joints_of)]
        inverse = np.array([np.linalg.inv(MIRROR @ m @ MIRROR).T for m in bind], dtype="<f4")   # glTF matrices are column-major
        glb.doc["skins"].append({"joints": joints_of, "inverseBindMatrices": glb.accessor(inverse, "MAT4", 5126)})
        pos = mesh["pos"] * [-1, 1, 1]
        nrm = mesh.get("nrm", np.zeros_like(pos)) * [-1, 1, 1]
        tris = mesh["tris"]
        # front faces: the winding whose geometric normals agree with the stored ones
        geo = np.cross(pos[tris[:, 1]] - pos[tris[:, 0]], pos[tris[:, 2]] - pos[tris[:, 0]])
        if (geo * nrm[tris[:, 0]]).sum() < 0:
            tris = tris[:, [0, 2, 1]]
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        joints = np.minimum(mesh.get("joints", np.zeros((len(pos), 4), np.int32)), len(used) - 1)
        weights = mesh.get("weights", np.tile([1.0, 0, 0, 0], (len(pos), 1))).copy()
        weights[weights.sum(axis=1) == 0, 0] = 1
        weights /= weights.sum(axis=1, keepdims=True)
        joints[weights == 0] = 0
        prim = {"attributes": {"POSITION": glb.accessor(pos.astype("<f4"), "VEC3", 5126, 34962, True),
                               "NORMAL": glb.accessor(nrm.astype("<f4"), "VEC3", 5126, 34962),
                               "TEXCOORD_0": glb.accessor(mesh["uv"].astype("<f4"), "VEC2", 5126, 34962),
                               "JOINTS_0": glb.accessor(joints.astype("<u2"), "VEC4", 5123, 34962),
                               "WEIGHTS_0": glb.accessor(weights.astype("<f4"), "VEC4", 5126, 34962)},
                "indices": glb.accessor(tris.astype("<u2").reshape(-1), "SCALAR", 5123, 34963), "material": materials[mat]}
        glb.doc["meshes"].append({"name": name, "primitives": [prim]})
        nodes.append({"name": "M_" + name, "mesh": len(glb.doc["meshes"]) - 1, "skin": len(glb.doc["skins"]) - 1})
        roots.append(len(nodes) - 1)
        names.append(name)
        # how high it reaches in the rest pose of the whole unit (a weapon is modelled at the origin)
        move = np.array([world[j] @ np.linalg.inv(m) for j, m in zip(joints_of, bind)])
        high = np.einsum("vkij,vk,vj->vi", move[joints], weights, np.c_[mesh["pos"], np.ones(len(pos))])[:, 1]
        bounds[name] = [round(float(high.min()), 4), round(float(high.max()), 4)]
        mesh_material[name] = mat
    nodes.append({"name": "Armature", "children": roots})
    glb.doc["scenes"][0]["nodes"] = [len(nodes) - 1]

    clips = {}
    for look, folder in [(None, unit["anims"]), *unit.get("sets", {}).items()]:
        for clip, stems in unit.get("clips", {}).items():
            if not stems:
                continue
            # a name with a slash is in another of the unit's animation folders
            at = lambda s: f"{folder.rsplit('/', 1)[0]}/{s}.hkx" if "/" in s else f"{folder}/{s}.hkx"
            stem = next((s for s in ([stems] if isinstance(stems, str) else stems) if arc.has(at(s))), None)
            if not stem:
                continue
            anim = read_animation(arc.read(at(stem)))
            n = len(anim["pos"])
            times = glb.accessor(np.linspace(0, max(anim["duration"], 1e-3), n).astype("<f4"), "SCALAR", 5126, minmax=True)
            samplers, channels = [], []
            for t, bone in enumerate(anim["bones"]):
                node = index.get(bone.lower())
                if node is None:
                    continue
                rot = anim["rot"][:, t] * [1, -1, -1, 1]
                for k in range(1, n):   # keep neighbouring keys on the same side of the sphere, so they blend the short way
                    if (rot[k] * rot[k - 1]).sum() < 0:
                        rot[k] = -rot[k]
                for path, arr, kind in (("translation", anim["pos"][:, t] * [-1, 1, 1], "VEC3"), ("rotation", rot, "VEC4")):
                    samplers.append({"input": times, "output": glb.accessor(arr.astype("<f4"), kind, 5126), "interpolation": "LINEAR"})
                    channels.append({"sampler": len(samplers) - 1, "target": {"node": node, "path": path}})
            name = clip if look is None else f"{clip}@{look}"
            glb.doc["animations"].append({"name": name, "samplers": samplers, "channels": channels})
            clips[name] = {"from": stem, "frames": n}

    head = index.get("bip01 head")
    looks = {k: [n for n in names if n.split(".")[0] in ("base", *v)] for k, v in unit.get("looks", {"default": list(unit["parts"])}).items()}
    meta = {"meshes": names, "looks": looks, "bounds": bounds, "head": round(float(world[head][1, 3]), 4) if head is not None else None,
            "mesh_material": mesh_material, "clips": clips, "fps": 30}
    return glb.bytes(), meta, textures


def build_static(arc, path):
    """A world object (a rock, a crate, a building) -> (glb bytes, meta, {material: PIL image}).

    No skeleton and no animation: the meshes as modelled, mirrored like the units, one per material, with each
    material's diffuse texture. A model with no textured mesh gives None.
    """
    from PIL import Image

    buf = arc.read(path)
    mats = read_materials(buf)
    glb, textures, lo, hi = Glb(), {}, np.full(3, np.inf), np.full(3, -np.inf)
    for mesh in read_meshes(buf):
        mat = mesh["material"].split(".")[-1]
        tex = mats.get(mesh["material"]) or next((v for n, v in mats.items() if n.endswith(mat)), {})
        where = arc.locate(tex.get("diffuseTex", "") + ".dds")
        if not where or "uv" not in mesh:
            continue
        if mat not in textures:
            try:
                textures[mat] = Image.open(io.BytesIO(arc.read(where)))
            except NotImplementedError:   # a texture format Pillow can't read (a few are floating point): leave that mesh out
                continue
            glb.doc["materials"].append({"name": mat})
        pos = mesh["pos"] * [-1, 1, 1]
        nrm = mesh.get("nrm", np.zeros_like(pos)) * [-1, 1, 1]
        tris = mesh["tris"]
        geo = np.cross(pos[tris[:, 1]] - pos[tris[:, 0]], pos[tris[:, 2]] - pos[tris[:, 0]])
        if (geo * nrm[tris[:, 0]]).sum() < 0:
            tris = tris[:, [0, 2, 1]]
        nrm /= np.maximum(np.linalg.norm(nrm, axis=1, keepdims=True), 1e-9)
        prim = {"attributes": {"POSITION": glb.accessor(pos.astype("<f4"), "VEC3", 5126, 34962, True),
                               "NORMAL": glb.accessor(nrm.astype("<f4"), "VEC3", 5126, 34962),
                               "TEXCOORD_0": glb.accessor(mesh["uv"].astype("<f4"), "VEC2", 5126, 34962)},
                "indices": glb.accessor(tris.astype("<u2").reshape(-1), "SCALAR", 5123, 34963),
                "material": list(textures).index(mat)}
        glb.doc["meshes"].append({"name": mat, "primitives": [prim]})
        glb.doc["nodes"].append({"name": mat, "mesh": len(glb.doc["meshes"]) - 1})
        lo, hi = np.minimum(lo, pos.min(axis=0)), np.maximum(hi, pos.max(axis=0))
    if not textures:
        return None
    glb.doc["scenes"][0]["nodes"] = list(range(len(glb.doc["nodes"])))
    return glb.bytes(), {"lo": [round(float(v), 3) for v in lo], "hi": [round(float(v), 3) for v in hi]}, textures


def paint_layers(tex, slots="pstw"):
    """A material's textures as the page's paint layers: base, m1 (primary, secondary, trim), m2 (weapons, eyes, dirt).

    This game colours a unit where its team texture says so, over a grey diffuse texture: each of the team
    texture's four channels is one colour's mask. The page overlays a colour on a grey mask and adds the base
    texture times "dirt", so a mask here is the team channel times the diffuse's brightness, and dirt is what no
    channel covers. What a channel means differs from unit to unit, so `slots` says, for red, green, blue and
    alpha in turn, which of the page's colours it takes: p(rimary), s(econdary), t(rim), w(eapons) or - for none.
    """
    from PIL import Image

    dif = tex["diffuseTex"].convert("RGBA")
    out = {"base": dif.convert("RGB")}
    if "teamTex" in tex:
        team = np.asarray(tex["teamTex"].convert("RGBA").resize(dif.size), dtype=np.float64) / 255
        luma = np.asarray(dif.convert("L"), dtype=np.float64) / 255
        layer = {c: np.zeros_like(luma) for c in "pstw"}
        for i, slot in enumerate(slots.ljust(4, "-")[:4]):
            if slot in layer:
                layer[slot] = np.maximum(layer[slot], team[:, :, i])
        dirt = 1 - np.clip(sum(layer.values()), 0, 1)
        as_image = lambda *planes: Image.fromarray((np.dstack(planes) * 255 + .5).astype(np.uint8))
        out["m1"] = as_image(layer["p"] * luma, layer["s"] * luma, layer["t"] * luma)
        out["m2"] = as_image(layer["w"] * luma, np.zeros_like(luma), dirt)
    if "emissiveTex" in tex and np.asarray(tex["emissiveTex"].convert("L")).max() > 24:
        out["glow"] = tex["emissiveTex"].convert("RGB")
    return out


if __name__ == "__main__":   # list an archive: python tools/dow/dow2.py <archive.sga> [substring]
    import sys
    for path in Archives([sys.argv[1]]).files:
        if len(sys.argv) < 3 or sys.argv[2].lower() in path:
            print(path)
