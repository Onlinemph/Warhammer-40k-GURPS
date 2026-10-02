"""Checks on the file-format readers, with small files made up here (no game needed).

    python -m unittest tools/dow/test_formats.py      # needs numpy, as the readers do

They pin down the layouts the readers rely on: an SGA 2 archive, an FMOD sound bank (mono and stereo ADPCM), a
Relic .fda sound, and the glTF writer. They don't prove the readers right about the games' real files (the pack
build does that), only that a later change to a reader still reads what it read before.
"""
import json
import struct
import sys
import tempfile
import unittest
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import numpy as np  # noqa: E402

import dow2  # noqa: E402
import fda  # noqa: E402
import sga  # noqa: E402


def sga2(files):
    """A version 2 archive holding {path: bytes}; every other file is stored compressed."""
    folders = {}
    for path, data in files.items():
        folder, _, name = path.rpartition("\\")
        folders.setdefault(folder, []).append((name, data))
    names, name_at = b"", {}
    for text in [*folders, *[n for fs in folders.values() for n, _ in fs]]:
        if text not in name_at:
            name_at[text] = len(names)
            names += text.encode("latin-1") + b"\0"
    folder_recs, file_recs, blob, k = b"", b"", b"", 0
    for folder, entries in folders.items():
        folder_recs += struct.pack("<IHHHH", name_at[folder], 0, 0, k, k + len(entries))
        for name, data in entries:
            packed = zlib.compress(data) if k % 2 else data
            file_recs += struct.pack("<IIIII", name_at[name], 0x100 if k % 2 else 0, len(blob), len(packed), len(data))
            blob += packed
            k += 1
    drive = struct.pack("<64s64sHHHHI", b"data", b"data", 0, len(folders), 0, k, 0)
    offsets = [24, 24 + len(drive), 24 + len(drive) + len(folder_recs), 24 + len(drive) + len(folder_recs) + len(file_recs)]
    counts = [1, len(folders), k, len(name_at)]
    toc = b"".join(struct.pack("<IH", o, n) for o, n in zip(offsets, counts)) + drive + folder_recs + file_recs + names
    head = b"_ARCHIVE" + struct.pack("<I", 2) + bytes(16) + bytes(128) + bytes(16) + struct.pack("<II", len(toc), sga.TOC + len(toc))
    return head + toc + blob


def fsb4(rate, channels, data, samples):
    """An FMOD sound bank with one IMA ADPCM sample."""
    sample = struct.pack("<H30sIIIIIiHHHH", 80, b"test", samples, len(data), 0, samples - 1, 0x400000, rate, 255, 128, 255, channels).ljust(80, b"\0")
    return b"FSB4" + struct.pack("<IIII", 1, len(sample), len(data), 0x40000) + bytes(28) + sample + data


def relic_fda(rate, bitrate, frames):
    """A .fda: Relic Chunky with a file-info chunk, then FOLD FDA holding DATA INFO and DATA DATA."""
    chunk = lambda kind, name, body: kind + name + struct.pack("<III", 1, len(body), 0) + body
    info = chunk(b"DATA", b"INFO", struct.pack("<iiiiiii", 1, 16, bitrate, rate, 0, -1, 0))
    data = chunk(b"DATA", b"DATA", struct.pack("<I", len(frames)) + frames)
    return b"Relic Chunky\r\n\x1a\0" + struct.pack("<II", 1, 1) + chunk(b"DATA", b"FBIF", bytes(12)) + chunk(b"FOLD", b"FDA ", info + data)


def bits(*fields):
    """Pack (value, width) fields low bit first, as the codec reads them."""
    out, at = 0, 0
    for value, width in fields:
        out |= value << at
        at += width
    return out


class Sga(unittest.TestCase):
    def test_reads_stored_and_compressed_files(self):
        files = {"art\\a.whm": b"first" * 40, "art\\b.whm": b"second" * 40, "sound\\speech\\c.fda": b"third" * 40}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "t.sga"
            path.write_bytes(sga2(files))
            arc = sga.Archive(path)
            try:
                self.assertEqual(sorted(arc.files), ["art/a.whm", "art/b.whm", "sound/speech/c.fda"])
                self.assertEqual(arc.under("art", ".whm"), ["art/a.whm", "art/b.whm"])
                for name, data in files.items():
                    self.assertEqual(arc.read(name.replace("\\", "/")), data)
            finally:
                arc.fh.close()


class Fsb(unittest.TestCase):
    def test_mono_is_passed_through_and_cut(self):
        data = bytes(range(36)) * 10
        rate, got = dow2.read_sound(fsb4(22050, 1, data, 640), 99)
        self.assertEqual((rate, got), (22050, data))
        self.assertEqual(len(dow2.read_sound(fsb4(6400, 1, data, 640), 0.02)[1]), 36 * 2)   # 128 samples = 2 blocks

    def test_stereo_gives_the_left_channel_as_mono_blocks(self):
        left = bytes([1, 2, 3, 0]) + bytes(range(100, 132))
        right = bytes([9, 9, 9, 0]) + bytes(range(200, 232))
        block = left[:4] + right[:4] + b"".join(left[4 + 4 * k:8 + 4 * k] + right[4 + 4 * k:8 + 4 * k] for k in range(8))
        self.assertEqual(len(block), 72)
        rate, got = dow2.read_sound(fsb4(22000, 2, block * 3, 192), 99)
        self.assertEqual(got, left * 3)

    def test_other_formats_are_refused(self):
        plain = bytearray(fsb4(22050, 1, bytes(72), 64))
        struct.pack_into("<I", plain, 48 + 48, 0x10)   # 16-bit PCM, no ADPCM flag
        self.assertIsNone(dow2.read_sound(bytes(plain)))
        self.assertIsNone(dow2.read_sound(b"OggS" + bytes(200)))


class Fda(unittest.TestCase):
    def test_header(self):
        buf = relic_fda(22050, 512, bytes(64 * 3))
        channels, bitrate, rate, start, size = fda.read_header(buf)
        self.assertEqual((channels, bitrate, rate, size), (1, 512, 22050, 192))
        self.assertEqual(buf[start:start + size], bytes(192))

    def test_empty_frames_are_silence_of_the_right_length(self):
        rate, pcm = fda.decode(relic_fda(22050, 512, bytes(64 * 5)))
        self.assertEqual((rate, pcm.shape), (44100, (1, 5 * 512)))
        self.assertFalse(pcm.any())

    def test_one_coefficient_sounds_for_one_and_a_half_frames(self):
        # flags 3 (reset, second half repeats the first), no band widths, 4-bit steps; one coefficient at
        # position 8 with value +1 (two bits: sign 0, magnitude 1), then a zero step to end the list
        frame = bits((3, 2), (0, 3), (0, 2), (4, 4), (8, 4), (1, 2), (0, 4)).to_bytes(64, "little")
        rate, pcm = fda.decode(relic_fda(44100, 512, frame + bytes(64 * 2)))
        x = pcm[0]
        self.assertEqual(len(x), 3 * 512)
        self.assertFalse(x[:256].any())                 # the first half-window is the (empty) frame before
        self.assertGreater(np.abs(x[256:1024]).max(), 1e-5)
        self.assertFalse(x[1024:].any())                # and it is gone after the overlap into the next frame
        # a coefficient at bin 8 of 256 is a tone near 8.5 / 512 cycles a sample
        spectrum = np.abs(np.fft.rfft(x[256:1024] * np.hanning(768)))
        self.assertAlmostEqual(np.argmax(spectrum) / 768, 8.5 / 512, delta=2 / 768)

    def test_a_coefficient_above_the_nominal_rate_is_dropped(self):
        # 22050 Hz files keep only the lower 128 of the 256 bins; a step of 15 x 9 reaches bin 135
        fields = [(3, 2), (0, 3), (0, 2), (4, 4)] + [(15, 4), (1, 2)] * 9 + [(0, 4)]
        frame = bits(*fields).to_bytes(64, "little")
        low = fda.decode(relic_fda(22050, 512, frame + bytes(64)))[1]
        high = fda.decode(relic_fda(44100, 512, frame + bytes(64)))[1]
        self.assertGreater(np.abs(high).max(), np.abs(low).max())

    def test_not_a_sound(self):
        self.assertIsNone(fda.decode(b"RIFF" + bytes(100)))


class GlbWriter(unittest.TestCase):
    def test_accessors_and_layout(self):
        glb = dow2.Glb()
        pos = np.array([[0, 0, 0], [1, 2, 3]], "<f4")
        at = glb.accessor(pos, "VEC3", 5126, 34962, True)
        raw = glb.bytes()
        self.assertEqual(raw[:4], b"glTF")
        length, kind = struct.unpack_from("<I4s", raw, 12)
        doc = json.loads(raw[20:20 + length])
        self.assertEqual(kind, b"JSON")
        self.assertEqual(struct.unpack_from("<I", raw, 8)[0], len(raw))
        acc = doc["accessors"][at]
        self.assertEqual((acc["count"], acc["type"], acc["min"], acc["max"]), (2, "VEC3", [0, 0, 0], [1, 2, 3]))
        view = doc["bufferViews"][acc["bufferView"]]
        start = 20 + length + 8 + view.get("byteOffset", 0)
        self.assertEqual(raw[start:start + view["byteLength"]], pos.tobytes())

    def test_quaternion_of_a_quarter_turn(self):
        turn = np.array([[0, -1, 0], [1, 0, 0], [0, 0, 1]], float)   # 90 degrees about z
        q = np.array(dow2.quat_of(turn))
        np.testing.assert_allclose(np.abs(q), [0, 0, np.sqrt(.5), np.sqrt(.5)], atol=1e-6)


if __name__ == "__main__":
    unittest.main()
