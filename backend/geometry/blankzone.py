"""Blank-zone altitude fallback (implementation_garv.md section 3.7).

If the XTF header has no usable altitude: in a standard waterfall the first
~(altitude / range_resolution) samples per ping are near-zero - the water column before
the first bottom return. Threshold-detect that width, multiply by range resolution, get
an altitude estimate. Typical error +/-20-30%, which is why the error radius grows and
altitude_source becomes "blank_zone_estimate" everywhere it is used.
"""

from __future__ import annotations

import numpy as np

_NOISE_PCT = 20.0          # water-column samples sit below this percentile of the ping
_RUN = 8                   # need this many consecutive above-threshold samples = real return


def estimate_altitude_row(half_row: np.ndarray, sample_res_m: float) -> float:
    """One half-ping, nadir at index 0. Returns the water-column width in metres."""
    r = half_row.astype(np.float32)
    thr = np.percentile(r, _NOISE_PCT) + 0.05 * (r.max() - r.min() + 1e-6)
    above = r > thr
    # first index where a run of _RUN samples is all above threshold
    kernel = np.ones(_RUN, dtype=int)
    run = np.convolve(above.astype(int), kernel, mode="valid")
    hit = np.argmax(run >= _RUN) if (run >= _RUN).any() else 0
    return float(hit) * sample_res_m


def estimate_survey_altitude(pings, sample_positions: int = 200) -> float:
    """Median water-column altitude across a sample of pings. Use when the header
    altitude is missing/zero for most of the survey."""
    if not pings:
        return 0.0
    step = max(1, len(pings) // sample_positions)
    vals = []
    for p in pings[::step]:
        res = p.sound_speed_ms / (2.0 * p.sample_rate_hz) if p.sample_rate_hz else 0.0
        if res > 0:
            vals.append(estimate_altitude_row(np.asarray(p.starboard), res))
    return float(np.median(vals)) if vals else 0.0


if __name__ == "__main__":
    res = 0.05
    row = np.concatenate([np.full(300, 2.0), np.full(700, 90.0)]).astype(np.float32)
    est = estimate_altitude_row(row, res)
    assert abs(est - 300 * res) < 5 * res, est          # ~15 m
    print("blankzone.py ok: water column ~", round(est, 2), "m")
