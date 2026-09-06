"""Slant range -> ground range, nadir gap (implementation_garv.md section 3.2).

Assumes a locally flat seabed. That assumption is stated in the report method_notes;
it is not relaxed here.

Only the slant->ground mapping lives here. Layback, geodesic projection and the error
budget are separate modules (Step 5) and are still stubs.
"""

from __future__ import annotations

import numpy as np


def sample_slant_range(n_samples: int, sound_speed_ms: float, sample_rate_hz: float) -> np.ndarray:
    """Slant range (m) of each sample index: r_i = i * c / (2 * f_s)."""
    i = np.arange(n_samples)
    return i * sound_speed_ms / (2.0 * sample_rate_hz)


def ground_range(slant_m: np.ndarray | float, altitude_m: float) -> np.ndarray | float:
    """sqrt(slant^2 - altitude^2), clamped at 0. Zero where slant < altitude (nadir gap)."""
    s2 = np.asarray(slant_m, dtype=float) ** 2 - float(altitude_m) ** 2
    return np.sqrt(np.clip(s2, 0.0, None))


def nadir_gap_samples(altitude_m: float, sound_speed_ms: float, sample_rate_hz: float) -> int:
    """How many leading samples per half-ping are water column (no seabed return)."""
    res = sound_speed_ms / (2.0 * sample_rate_hz)
    return int(max(0.0, altitude_m) / res) if res > 0 else 0


def slant_to_ground_row(half_row: np.ndarray, altitude_m: float,
                        sound_speed_ms: float, sample_rate_hz: float,
                        out_len: int | None = None) -> np.ndarray:
    """Resample one half-swath row (nadir at index 0) from slant to uniform ground range.

    Samples inside the nadir gap map to 0 (masked). Flat-seabed assumption.
    """
    n = half_row.size
    out_len = out_len or n
    slant = sample_slant_range(n, sound_speed_ms, sample_rate_hz)
    gr = ground_range(slant, altitude_m)
    gr_max = gr[-1] if gr[-1] > 0 else 1.0
    target = np.linspace(0.0, gr_max, out_len)
    # interp needs gr strictly increasing; it is, past the nadir gap
    valid = gr > 0
    if valid.sum() < 2:
        return np.zeros(out_len, dtype=half_row.dtype)
    out = np.interp(target, gr[valid], half_row[valid].astype(float), left=0.0, right=0.0)
    return out.astype(half_row.dtype)


if __name__ == "__main__":
    r = sample_slant_range(2048, 1500.0, 10291.5)
    assert abs(r[-1] - 149.25) < 0.5, r[-1]
    assert ground_range(50.0, 40.0) == 30.0
    assert ground_range(30.0, 40.0) == 0.0
    row = np.linspace(1, 100, 1024).astype(np.float32)
    g = slant_to_ground_row(row, altitude_m=20.0, sound_speed_ms=1500.0, sample_rate_hz=10291.5)
    assert g.shape == (1024,) and g[0] == 0.0
    print("slant.py ok: r_max", round(float(r[-1]), 2), "ground_range checks pass")
