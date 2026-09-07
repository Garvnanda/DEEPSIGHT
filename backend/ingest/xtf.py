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
from pyproj import Transformer
from pyxtf.xtf_ctypes import XTFChannelType, XTFFileHeader, XTFHeaderType

from .models import PingRecord, SurveyMeta

_ALT_SOURCE_MIN_NONZERO = 0.5   # >= this fraction of pings with real altitude -> trust the header
_DEFAULT_SOUND_SPEED_MS = 1500.0

# GA0346 (Oceanic Shoals, Timor Sea) and other AUV side-scan lines store navigation as
# projected metres (XTF NavUnits == 0), not degrees. Zone is not in the XTF header, so it
# is configured here and overridable per call.
SURVEY_UTM_EPSG = 32752          # WGS84 / UTM zone 52S
_ALT_SANE_MAX_M = 150.0          # a fish/AUV altitude above this is a bad header value, not real
AUV_NOMINAL_ALTITUDE_M = 12.0    # used when the header altitude is unusable AND the water
                                 # column has been removed (no blank zone to measure); AUV
                                 # side-scan flies ~10-15 m over the seabed. Flagged
                                 # blank_zone_estimate so every error radius widens.
_TRIGGER_HZ_FALLBACK = 5.0       # readme.TXT: SSS trigger 5 Hz — used only if ping times are absent
# channel centre frequency when the ping headers don't carry it (readme.TXT bands)
_FREQ_KHZ_BY_NAME = (("LF", 105), ("HF", 410))


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


def _chan_type(fh, ch, pos: int) -> int:
    """TypeOfChannel for a per-ping channel header, via its ChannelNumber into ChanInfo,
    falling back to positional index when the field is absent."""
    idx = int(getattr(ch, "ChannelNumber", pos) or pos)
    if not 0 <= idx < len(fh.ChanInfo):
        idx = pos
    return fh.ChanInfo[idx].TypeOfChannel if 0 <= idx < len(fh.ChanInfo) else 0


def read_survey(path: str, primary_khz: int = 400, *,
                utm_epsg: int = SURVEY_UTM_EPSG,
                nominal_altitude_m: float = AUV_NOMINAL_ALTITUDE_M,
                ) -> tuple[SurveyMeta, list[PingRecord]]:
    """Parse an XTF file. Returns (meta, pings).

    `primary_khz` selects the port/starboard pair when the file carries more than one
    frequency and tags them; when the headers don't tag frequency (FugroXTF / EdgeTech
    AUV lines) the single recorded pair is taken and `primary_khz` is only a fallback
    label. Projected navigation (NavUnits == 0) is converted from EPSG:`utm_epsg` to WGS84.

    ponytail: loads every ping into RAM (~0.5 GB for the big HF lines). Switch to a
    generator if a full line OOMs.
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

    # --- pick the port/starboard data indices ---
    # prefer a pair tagged with primary_khz; otherwise take the first port + first stbd
    # channel present (single-frequency AUV lines don't tag frequency at all).
    hdrs = raw[0].ping_chan_headers
    PORT, STBD = XTFChannelType.port.value, XTFChannelType.stbd.value
    port_idx = stbd_idx = port_any = stbd_any = None
    for i, ch in enumerate(hdrs):
        t = _chan_type(fh, ch, i)
        f = int(round(getattr(ch, "Frequency", 0) or 0))
        if t == PORT:
            port_any = i if port_any is None else port_any
            if f == primary_khz and port_idx is None:
                port_idx = i
        elif t == STBD:
            stbd_any = i if stbd_any is None else stbd_any
            if f == primary_khz and stbd_idx is None:
                stbd_idx = i
    port_idx = port_idx if port_idx is not None else port_any
    stbd_idx = stbd_idx if stbd_idx is not None else stbd_any
    if port_idx is None or stbd_idx is None:
        raise ValueError(
            f"no PORT/STBD channel pair in {path}; "
            f"channel types={[_chan_type(fh, c, i) for i, c in enumerate(hdrs)]}"
        )

    # frequency label: from the header if present, else inferred from the channel name band
    cn_idx = int(getattr(hdrs[port_idx], "ChannelNumber", port_idx) or port_idx)
    cname = (bytes(fh.ChanInfo[cn_idx].ChannelName).rstrip(b"\x00").decode(errors="replace")
             if 0 <= cn_idx < len(fh.ChanInfo) else "").upper()
    freq_khz = int(round(getattr(hdrs[port_idx], "Frequency", 0) or 0))
    if not freq_khz:
        freq_khz = next((khz for tag, khz in _FREQ_KHZ_BY_NAME if tag in cname), primary_khz)
        warnings.append(
            f"channel frequency not in headers; inferred {freq_khz} kHz from name {cname!r}"
        )

    # --- sound speed: Isis stores c/2 in SoundVelocity for this sonar ---
    sv = float(raw[0].SoundVelocity or 0.0)
    sound_speed = sv * 2.0 if 600.0 < sv < 900.0 else _DEFAULT_SOUND_SPEED_MS
    if not 600.0 < sv < 900.0:
        warnings.append(
            f"SoundVelocity header value {sv} unusable; assumed {sound_speed} m/s"
        )

    # --- navigation: degrees (NavUnits == 3) or projected metres (NavUnits == 0) ---
    nav_is_utm = int(getattr(fh, "NavUnits", 3) or 0) == 0
    to_wgs84 = (Transformer.from_crs(f"EPSG:{utm_epsg}", "EPSG:4326", always_xy=True)
                if nav_is_utm else None)
    if nav_is_utm:
        warnings.append(f"navigation is projected metres; converted from EPSG:{utm_epsg} to WGS84")

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

        ny = float(p.SensorYcoordinate)
        nx = float(p.SensorXcoordinate)
        if nx == 0.0 and ny == 0.0:
            lat = lon = float("nan")
        elif to_wgs84 is not None:
            lon, lat = to_wgs84.transform(nx, ny)
        else:
            lat, lon = ny, nx
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
    sane = alts_arr[(alts_arr > 0) & (alts_arr < _ALT_SANE_MAX_M)]
    if sane.size >= _ALT_SOURCE_MIN_NONZERO * len(alts_arr):
        altitude_source = "xtf_header"
        altitude_mean = float(sane.mean())
        if sane.size < len(alts_arr):
            warnings.append(
                f"{len(alts_arr) - sane.size} of {len(alts_arr)} pings "
                f"({(1 - sane.size / len(alts_arr)) * 100:.1f}%) have no usable altitude"
            )
    else:
        # header altitude blank or absurd (FugroXTF writes AUV depth here, ~3000 m) and the
        # water column is gone, so there is no blank zone to measure - fall back to a nominal
        # AUV survey altitude and widen every error radius on this survey.
        altitude_source = "blank_zone_estimate"
        altitude_mean = float(nominal_altitude_m)
        med = float(np.median(alts_arr[alts_arr > 0])) if (alts_arr > 0).any() else 0.0
        for pr in pings:
            pr.altitude_m = float(nominal_altitude_m)
        warnings.append(
            f"header altitude unusable (median {med:.0f} m); using nominal AUV altitude "
            f"{nominal_altitude_m:.0f} m - positions carry higher uncertainty"
        )

    lat_arr = np.array(lats); lon_arr = np.array(lons)
    finite = np.isfinite(lat_arr) & np.isfinite(lon_arr)
    bounds = {
        "north": float(np.nanmax(lat_arr[finite])) if finite.any() else None,
        "south": float(np.nanmin(lat_arr[finite])) if finite.any() else None,
        "east": float(np.nanmax(lon_arr[finite])) if finite.any() else None,
        "west": float(np.nanmin(lon_arr[finite])) if finite.any() else None,
    }

    duration_s = (pings[-1].time - pings[0].time).total_seconds()
    if duration_s <= 0 and len(pings) > 1:
        duration_s = (len(pings) - 1) / _TRIGGER_HZ_FALLBACK
        warnings.append(
            f"ping timestamps absent; duration estimated at {_TRIGGER_HZ_FALLBACK:.0f} Hz trigger"
        )

    meta = SurveyMeta(
        filename=path.replace("\\", "/").split("/")[-1],
        path=path,
        ping_count=len(pings),
        samples_per_channel=n0,
        range_m=pings[0].slant_range_m,
        frequency_khz=freq_khz,
        duration_s=duration_s,
        altitude_source=altitude_source,
        altitude_mean_m=altitude_mean,
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
