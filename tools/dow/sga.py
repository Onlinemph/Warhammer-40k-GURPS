"""List and extract Relic SGA v2 archives (Dawn of War 1 / Soulstorm).

    python tools/dow/sga.py list  W40kData-Whm-High.sga [substring]
    python tools/dow/sga.py extract W40kData-Whm-High.sga OUTDIR [substring]

Layout (little-endian), worked out against the Soulstorm archives:
    0    "_ARCHIVE"
    8    u32 version (2)
    12   16 bytes tool MD5
    28   128 bytes archive name (UTF-16LE)
    156  16 bytes TOC MD5
    172  u32 TOC size
    176  u32 data offset
    180  TOC: 4 x (u32 offset, u16 count) = drives, folders, files, names (offsets relative to 180)
Drive  (138 bytes): char alias[64], char name[64], u16 firstFolder, lastFolder, firstFile, lastFile, u32 root
Folder (12 bytes):  u32 nameOffset, u16 firstSub, lastSub, firstFile, lastFile
File   (20 bytes):  u32 nameOffset, u32 flags (0 = stored, else zlib), u32 dataOffset, u32 compSize, u32 size
"""
import struct
import sys
import zlib
from pathlib import Path

TOC = 180


def read_toc(buf):
    if buf[:8] != b"_ARCHIVE":
        raise SystemExit("not an SGA archive")
    version = struct.unpack_from("<I", buf, 8)[0]
    if version != 2:
        raise SystemExit("SGA version %d, this reads v2 only" % version)
    toc_size, data_off = struct.unpack_from("<II", buf, 172)
    (d_off, d_n, f_off, f_n, fi_off, fi_n, s_off, s_n) = struct.unpack_from("<IHIHIHIH", buf, TOC)
    names = TOC + s_off

    def cstr(rel):
        end = buf.index(b"\0", names + rel)
        return buf[names + rel:end].decode("latin-1")

    folders = []
    for i in range(f_n):
        name_off, sub0, sub1, file0, file1 = struct.unpack_from("<IHHHH", buf, TOC + f_off + 12 * i)
        folders.append((cstr(name_off), file0, file1))
    files = []
    for i in range(fi_n):
        name_off, flags, off, csize, size = struct.unpack_from("<IIIII", buf, TOC + fi_off + 20 * i)
        files.append((cstr(name_off), flags, data_off + off, csize, size))
    out = []
    for folder, file0, file1 in folders:
        for i in range(file0, file1):
            name, flags, off, csize, size = files[i]
            out.append(((folder + "\\" + name).lstrip("\\"), flags, off, csize, size))
    return out


class Archive:
    """An archive kept open: `files` maps each path (lower case, forward slashes) to where it is; read(path)."""

    def __init__(self, path):
        self.fh = Path(path).open("rb")
        head = self.fh.read(TOC)
        self.fh.seek(0)
        entries = read_toc(self.fh.read(TOC + struct.unpack_from("<I", head, 172)[0]))
        self.files = {p.replace("\\", "/").lower(): rest for p, *rest in entries}

    def under(self, folder, suffix=""):
        folder = folder.lower().rstrip("/") + "/"
        return sorted(p for p in self.files if p.startswith(folder) and p.endswith(suffix))

    def read(self, path):
        flags, off, csize, size = self.files[path]
        self.fh.seek(off)
        data = self.fh.read(csize)
        return zlib.decompress(data) if csize != size else data


def main(argv):
    if len(argv) < 3 or argv[1] not in ("list", "extract"):
        raise SystemExit(__doc__)
    cmd, archive = argv[1], Path(argv[2])
    with archive.open("rb") as fh:
        head = fh.read(180 + 24)
        toc_size = struct.unpack_from("<I", head, 172)[0]
        fh.seek(0)
        buf = fh.read(TOC + toc_size)
        entries = read_toc(buf)
        if cmd == "list":
            needle = argv[3].lower() if len(argv) > 3 else ""
            for path, flags, off, csize, size in entries:
                if needle in path.lower():
                    print("%10d  %s" % (size, path))
            return
        outdir = Path(argv[3])
        needle = argv[4].lower() if len(argv) > 4 else ""
        n = 0
        for path, flags, off, csize, size in entries:
            if needle not in path.lower():
                continue
            fh.seek(off)
            data = fh.read(csize)
            if csize != size:
                data = zlib.decompress(data)
            if len(data) != size:
                raise SystemExit("size mismatch for %s" % path)
            dest = outdir / path.replace("\\", "/")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
            n += 1
        print("extracted %d files to %s" % (n, outdir))


if __name__ == "__main__":
    main(sys.argv)
