"""pyxtf wrapper -> SurveyMeta + PingRecord list.

pyxtf does the byte-level parse (implementation_garv.md: "pyxtf parses"). This module
owns channel selection, the header summary, and the mid-file-change guard.

This sonar (Benthos SIS-1625, recorded by Isis) writes 5 channels — PORT/STBD at two
frequencies plus a sub-bottom channel — and pyxtf's stock reader indexes past its own
filtered channel list and raises IndexError. `_patch_pyxtf_channels()` widens that
filter to include the sub-bottom slot; applied once at import.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pyxtf
import pyxtf.xtf_ctypes as _xc
from pyxtf.xtf_ctypes import XTFChannelType, XTFFileHeader, XTFHeaderType

from .models import PingRecord, SurveyMeta

_ALT_SOURCE_MIN_NONZERO = 0.5   # >= this fraction of pings with real altitude -> trust the header
_DEFAULT_SOUND_SPEED_MS = 1500.0


def _patch_pyxtf_channels() -> None:
    """Include the sub-bottom slot in file_header.sonar_info so per-ping indexing holds."""
    if getattr(XTFFileHeader, "_deepsight_patched", False):
        return
    orig = XTFFileHeader.create_from_buffer.__func__
    keep = (XTFChannelType.port.value, XTFChannelType.stbd.value, XTFChannelType.subbottom.value)

    def create_from_buffer(cls, buffer, file_header=None):
        obj = orig(cls, buffer, file_header)
        obj.sonar_info = [c for c in obj.ChanInfo if c.TypeOfChannel in keep][: obj.NumberOfSonarChannels]
        return obj

    XTFFileHeader.create_from_buffer = classmethod(create_from_buffer)
    XTFFileHeader._deepsight_patched = True


_patch_pyxtf_channels()


def _ping_time(p) -> datetime:
    try:
        return datetime(p.Year, p.Month, p.Day, p.Hour, p.Minute, p.Second,
                        tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return datetime(1970, 1, 1, tzinfo=timezone.utc)


def read_survey(path: str, primary_khz: int = 400) -> tuple[SurveyMeta, list[PingRecord]]:
    """Parse an XTF file. Returns (meta, pings) for the requested primary frequency.

    ponytail: loads every ping into RAM (fine for the snip files, ~40 MB of samples).
    Switch to a generator if a full 40k-ping line OOMs.
    """
    fh = None
    raw = []
    for pkt in pyxtf.xtf_read_gen(path):
        if isinstance(pkt, XTFFileHeader):
            fh = pkt
        elif pkt.HeaderType == XTFHeaderType.sonar:
            raw.append(pkt)
    if fh is None or not raw:
        raise ValueError(f"No sonar pings found in {path}")

    warnings: list[str] = []

    # --- pick the port/starboard data indices for the requested frequency ---
    freqs = [int(round(getattr(h, "Frequency", 0) or 0)) for h in raw[0].ping_chan_headers]
    types = [fh.ChanInfo[i].TypeOfChannel for i in range(len(freqs))]
    port_idx = stbd_idx = None
    for i, (f, t) in enumerate(zip(freqs, types)):
        if f == primary_khz and t == XTFChannelType.port.value and port_idx is None:
            port_idx = i
        if f == primary_khz and t == XTFChannelType.stbd.value and stbd_idx is None:
            stbd_idx = i
    if port_idx is None or stbd_idx is None:
        raise ValueError(
            f"{primary_khz} kHz PORT/STBD not found. Channel freqs={freqs} types={types}"
        )

    # --- sound speed: Isis stores c/2 in SoundVelocity for this sonar ---
    sv = float(raw[0].SoundVelocity or 0.0)
    sound_speed = sv * 2.0 if 600.0 < sv < 900.0 else _DEFAULT_SOUND_SPEED_MS
    if not 600.0 < sv < 900.0:
        warnings.append(
            f"SoundVelocity header value {sv} unusable; assumed {sound_speed} m/s"
        )

    n0 = raw[0].data[port_idx].size
    pings: list[PingRecord] = []
    lats, lons, alts = [], [], []
    changed_at = None

    for p in raw:
        port = np.asarray(p.data[port_idx])
        stbd = np.asarray(p.data[stbd_idx])
        if port.size != n0 and changed_at is None:
            changed_at = p.PingNumber
            warnings.append(
                f"Samples per ping changed at ping {p.PingNumber} ({n0} to {port.size})"
            )

        ch = p.ping_chan_headers[port_idx]
        dur = float(getattr(ch, "TimeDuration", 0) or getattr(ch, "SecondsPerPing", 0) or 0)
        fs = port.size / dur if dur > 0 else 0.0
        slant = float(getattr(ch, "SlantRange", 0) or 0)

        lat = float(p.SensorYcoordinate)
        lon = float(p.SensorXcoordinate)
        if lat == 0.0 and lon == 0.0:
            lat = lon = float("nan")
        alt = float(p.SensorPrimaryAltitude or 0.0)

        lats.append(lat); lons.append(lon); alts.append(alt)
        pings.append(PingRecord(
            ping_number=int(p.PingNumber),
            time=_ping_time(p),
            lat=lat, lon=lon,
            heading_deg=float(p.SensorHeading),
            pitch_deg=float(p.SensorPitch),
            roll_deg=float(p.SensorRoll),
            heave_m=float(getattr(p, "Heave", 0.0) or 0.0),
            altitude_m=alt,
            sound_speed_ms=sound_speed,
            sample_rate_hz=fs,
            slant_range_m=slant,
            port=port,
            starboard=stbd,
            cable_out_m=float(getattr(p, "CableOut", 0.0) or 0.0),
            fish_depth_m=float(getattr(p, "SensorDepth", 0.0) or 0.0),
        ))

    alts_arr = np.array(alts)
    nonzero = float(np.mean(alts_arr > 0)) if alts_arr.size else 0.0
    if nonzero < 1.0:
        warnings.append(
            f"{int((alts_arr <= 0).sum())} of {len(alts_arr)} pings "
            f"({(1 - nonzero) * 100:.1f}%) have no altitude"
        )
    altitude_source = "xtf_header" if nonzero >= _ALT_SOURCE_MIN_NONZERO else "blank_zone_estimate"

    lat_arr = np.array(lats); lon_arr = np.array(lons)
    finite = np.isfinite(lat_arr) & np.isfinite(lon_arr)
    bounds = {
        "north": float(np.nanmax(lat_arr[finite])) if finite.any() else None,
        "south": float(np.nanmin(lat_arr[finite])) if finite.any() else None,
        "east": float(np.nanmax(lon_arr[finite])) if finite.any() else None,
        "west": float(np.nanmin(lon_arr[finite])) if finite.any() else None,
    }

    duration_s = (pings[-1].time - pings[0].time).total_seconds()

    meta = SurveyMeta(
        filename=path.replace("\\", "/").split("/")[-1],
        path=path,
        ping_count=len(pings),
        samples_per_channel=n0,
        range_m=pings[0].slant_range_m,
        frequency_khz=primary_khz,
        duration_s=duration_s,
        altitude_source=altitude_source,
        altitude_mean_m=float(alts_arr[alts_arr > 0].mean()) if (alts_arr > 0).any() else 0.0,
        sound_speed_ms=sound_speed,
        bounds=bounds,
        start_time=pings[0].time,
        sonar_name=bytes(fh.SonarName).rstrip(b"\x00").decode(errors="replace"),
        recording_program=bytes(fh.RecordingProgramName).rstrip(b"\x00").decode(errors="replace"),
        warnings=warnings,
    )
    return meta, pings


if __name__ == "__main__":
    import sys

    src = sys.argv[1] if len(sys.argv) > 1 else (
        r"C:\Projects\DEEPSIGHT\data\MGDS_Download\NBP1001"
        r"\SS01-snip-2145-to-end.XTF\SS01 snip 2145 to end.XTF"
    )
    m, ps = read_survey(src)
    print(m)
    print("first ping:", ps[0].ping_number, ps[0].time, ps[0].lat, ps[0].lon,
          "alt", ps[0].altitude_m, "fs", round(ps[0].sample_rate_hz, 1),
          "c", ps[0].sound_speed_ms, "slant", ps[0].slant_range_m)
    # cheap self-check: slant range implied by geometry must match the recorded setting
    p = ps[0]
    implied = p.samples_per_channel * p.sound_speed_ms / (2 * p.sample_rate_hz)
    assert abs(implied - p.slant_range_m) < 1.0, (implied, p.slant_range_m)
    print(f"slant-range self-check ok: implied {implied:.2f} m vs recorded {p.slant_range_m} m")
