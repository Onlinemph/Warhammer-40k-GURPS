"""Read Dawn of War 1 / Soulstorm sound files (.fda): Relic's own audio codec, to plain samples.

    python tools/dow/fda.py IN.fda OUT.wav

A .fda is a Relic Chunky file: a file-info chunk, then a folder "FDA " holding "INFO" (channels, bits, bit rate,
sample rate) and "DATA" (a u32 size, then the frames). Each frame is bitrate / 8 bytes for each channel and gives
512 samples at 44100 Hz, whatever the nominal rate: a lower one only means the upper part of the spectrum is empty.

A frame, as bits read low bit first:
    2 flags (1: forget the band widths kept from the frame before; 2: the second half-frame repeats the first)
    3 bits per band step, 2 bits per band width, 4 bits per coefficient step
    band widths: (step, width) pairs walking through 26 critical bands, a zero step after the first ending the list;
        the width (0-3) is how many extra bits each coefficient in that band is stored with
    two half-frames of coefficients: (step, value) pairs walking through the spectrum, the value a sign bit over
        width + 1 magnitude bits, scaled by 10^(width+1) / (2^(width+1) - 1)
Each half-frame's 256 coefficients go through an inverse MDCT of 512 samples; the halves are overlapped and
windowed with a sine window against each other and against the frame before.

The layout and the transform follow the Relic decoder in vgmstream (https://github.com/vgmstream/vgmstream,
src/coding/libs/relic_lib.c, ISC licence), which was worked out from Relic's own tools; this is a fresh
implementation of it on numpy.
"""
import struct
import sys

import numpy as np

SIZE, HALF, QUARTER = 512, 256, 128
BANDS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 11, 13, 15, 17, 20, 23, 27, 31, 37, 43, 51, 62, 74, 89, 110, 139, 180, 256]
SCALES = [10.0 ** (i + 1) / ((1 << (i + 1)) - 1) for i in range(6)]
_ANGLE = (np.arange(QUARTER) + 0.125) * (2 * np.pi / SIZE)
_SIN, _COS = np.sin(_ANGLE), np.cos(_ANGLE)
_WINDOW = np.sin(np.arange(SIZE) * (np.pi / SIZE))


def read_header(buf):
    """(channels, bit rate, nominal sample rate, offset of the frames, their size in bytes), or None."""
    if buf[:16] != b"Relic Chunky\r\n\x1a\0":
        return None
    at = 0x18
    size, name = struct.unpack_from("<II", buf, at + 12)
    at += 20 + name + size                      # past the file info
    if buf[at + 4:at + 8] != b"FDA ":
        return None
    at += 20
    if buf[at + 4:at + 8] != b"INFO":
        return None
    size, name = struct.unpack_from("<II", buf, at + 12)
    at += 20 + name
    channels, _bits, bitrate, rate = struct.unpack_from("<iiii", buf, at)
    at += size
    if buf[at + 4:at + 8] != b"DATA":
        return None
    name = struct.unpack_from("<I", buf, at + 16)[0]
    at += 20 + name
    return channels, bitrate, rate, at + 4, struct.unpack_from("<I", buf, at)[0]


def _imdct(freq):
    """256 coefficients -> 512 samples (before windowing)."""
    a, b = freq[0:HALF:2] * 0.5, freq[HALF - 1::-2] * 0.5
    y = np.fft.fft((a * _COS + b * _SIN) + 1j * (-a * _SIN + b * _COS))
    k = 8.0 / np.sqrt(SIZE)
    tmp = np.empty(SIZE)
    tmp[0:HALF:2] = (y.real * _COS + y.imag * _SIN) * k
    tmp[HALF::2] = (-y.real * _SIN + y.imag * _COS) * k
    tmp[1::2] = -tmp[SIZE - 2::-2]
    return np.concatenate([tmp[QUARTER:], -tmp[:QUARTER]])


def _unpack(frame, widths, freq_half):
    """One frame's bytes -> its two half-frames of coefficients. `widths` (per coefficient) carries over."""
    bits = int.from_bytes(frame, "little")
    limit = len(frame) * 8
    at = 11
    flags, band_bits, width_bits, step_bits = bits & 3, bits >> 2 & 7, bits >> 5 & 3, bits >> 7 & 15
    if flags & 1:
        widths[:] = bytes(HALF)
    if band_bits and width_bits:
        pos = 0
        for i in range(len(BANDS) - 1):
            move = bits >> at & ((1 << band_bits) - 1)
            at += band_bits
            if i and not move:
                break
            pos += move
            width = bits >> at & ((1 << width_bits) - 1)
            at += width_bits
            if pos + 1 >= len(BANDS) or at > limit:
                return None
            widths[BANDS[pos]:BANDS[pos + 1]] = bytes([width]) * (BANDS[pos + 1] - BANDS[pos])
    halves = [np.zeros(HALF), np.zeros(HALF)]
    if not step_bits:
        return halves
    for n, freq in enumerate(halves):
        if n and flags & 2:
            halves[1] = halves[0].copy()
            break
        pos = 0
        for i in range(HALF):
            move = bits >> at & ((1 << step_bits) - 1)
            at += step_bits
            if i and not move:
                break
            pos += move
            if pos >= HALF or at > limit:
                return None
            width = widths[pos]
            value = bits >> at & ((1 << (width + 2)) - 1)
            at += width + 2
            if value >> (width + 1):
                value = -(value & ((1 << (width + 1)) - 1))
            if value and pos < freq_half:
                freq[pos] = value * SCALES[width]
    return halves


def decode(buf):
    """A .fda file -> (44100, float samples in -1..1, one row per channel), or None if it isn't one."""
    head = read_header(buf)
    if not head:
        return None
    channels, bitrate, rate, start, size = head
    if not 1 <= channels <= 2 or not 256 <= bitrate <= 2048:
        return None
    step = bitrate // 8
    freq_half = (128 if rate < 22050 else 256 if rate == 22050 else 512) // 2
    frames = min(size, len(buf) - start) // (step * channels)
    out = np.zeros((channels, frames * SIZE))
    widths = [bytearray(HALF) for _ in range(channels)]
    carry = [np.zeros(SIZE) for _ in range(channels)]
    for f in range(frames):
        for ch in range(channels):
            at = start + (f * channels + ch) * step
            halves = _unpack(buf[at:at + step], widths[ch], freq_half)
            if halves is None:
                return 44100, out[:, :f * SIZE] / 32768
            cur = carry[ch].copy()
            first, second = _imdct(halves[0]), _imdct(halves[1])
            cur[HALF:] = first[:HALF] * _WINDOW[:HALF] + cur[HALF:] * _WINDOW[HALF:]
            second[:HALF] = second[:HALF] * _WINDOW[:HALF] + first[HALF:] * _WINDOW[HALF:]
            carry[ch] = second
            out[ch, f * SIZE:(f + 1) * SIZE] = cur
    return 44100, out / 32768


def main(argv):
    if len(argv) != 3:
        raise SystemExit(__doc__)
    import wave
    got = decode(open(argv[1], "rb").read())
    if not got:
        raise SystemExit("not a .fda sound")
    rate, pcm = got
    with wave.open(argv[2], "wb") as w:
        w.setnchannels(pcm.shape[0])
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes((np.clip(pcm.T, -1, 1) * 32767).astype("<i2").tobytes())
    print(f"{argv[2]}: {pcm.shape[1] / rate:.2f} s, {pcm.shape[0]} channel(s)")


if __name__ == "__main__":
    main(sys.argv)
