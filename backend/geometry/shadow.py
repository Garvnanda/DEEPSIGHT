"""Object height from its acoustic shadow (implementation_garv.md section 3.6).

Shadow is the single most informative cue in side-scan (idea.md section 3). Every object
standing proud of the seabed casts a dark shadow on the far side from nadir. Its length,
with the fish altitude and the object's ground range, gives the object's height by similar
triangles:

    fish at (0, altitude), object top at (ground_range, h), shadow far edge at (ground_range + L, 0)
    colinear  ->  (altitude - h) / ground_range = h / L
              ->  h = L * altitude / (ground_range + L)

L is the shadow length in ground metres. This height also feeds suppression Rule 3.
"""

from __future__ import annotations

import numpy as np

_DARK_FRAC = 0.4        # shadow samples sit below this fraction of the ping's seabed median
_MIN_RUN_PX = 3         # need at least this many consecutive dark samples to call it a shadow
_MAX_SCAN_PX = 400      # don't chase a "shadow" further out than this
_GAP_PX = 2             # tolerate this many non-dark samples inside a shadow run


def _shadow_length_px(wf: np.ndarray, ping_row: int, x_outer: int, outward: int) -> int:
    """Consecutive dark samples starting just outboard of the box's outer edge.
    `outward` is +1 (starboard, nadir on the left) or -1 (port, nadir on the right)."""
    row = wf[ping_row].astype(np.float32)
    lit = row[row > 0]
    if lit.size < 8:
        return 0
    thr = _DARK_FRAC * float(np.median(lit))
    if thr <= 0:
        return 0
    x = x_outer + outward
    run = gap = 0
    scanned = 0
    while 0 <= x < wf.shape[1] and scanned < _MAX_SCAN_PX:
        if row[x] < thr:
            run += 1
            gap = 0
        else:
            gap += 1
            if gap > _GAP_PX:
                break
            run += 1                     # count the small gap as part of the run
        x += outward
        scanned += 1
    return max(0, run - gap)             # trim the trailing gap


def object_height_m(wf: np.ndarray, bbox_px: dict, channel: str, *,
                    altitude_m: float, ground_range_m: float, slant_range_m: float,
                    m_per_px_across: float) -> float | None:
    """Height in metres, or None when the shadow can't be read (near nadir, off the edge,
    no altitude, degenerate range)."""
    if altitude_m <= 0 or ground_range_m <= 1e-3 or m_per_px_across <= 0:
        return None
    y = int(np.clip(bbox_px["y"] + bbox_px["h"] // 2, 0, wf.shape[0] - 1))
    if channel == "starboard":
        x_outer = min(wf.shape[1] - 1, bbox_px["x"] + bbox_px["w"])
        outward = 1
    else:
        x_outer = max(0, bbox_px["x"])
        outward = -1

    # median the shadow length over a few pings around the detection - one row is noisy
    lo = max(0, y - 2)
    hi = min(wf.shape[0], y + 3)
    lens = [_shadow_length_px(wf, r, x_outer, outward) for r in range(lo, hi)]
    lens = [v for v in lens if v >= _MIN_RUN_PX]
    if not lens:
        return None

    shadow_px = float(np.median(lens))
    # across-track px -> ground metres. m_per_px_across here is slant m/px; near-far it is
    # close enough to ground m/px once we are well off nadir, which the guard above ensures.
    L = shadow_px * m_per_px_across
    h = L * altitude_m / (ground_range_m + L)
    if not np.isfinite(h) or h <= 0 or h > altitude_m:
        return None
    return round(float(h), 2)


if __name__ == "__main__":
    # synthetic ping stack: bright object then a dark shadow then seabed
    W = 400
    half = W // 2
    wf = np.full((20, W), 120, np.uint8)
    # object highlight on starboard at x 260..272, shadow 272..300 (28 px), seabed after
    wf[:, 260:272] = 240
    wf[:, 272:300] = 5
    alt, gr = 12.0, 40.0
    mpp = 0.25                     # 0.25 m/px  -> shadow ~7 m
    h = object_height_m(wf, {"x": 258, "y": 8, "w": 14, "h": 6}, "starboard",
                        altitude_m=alt, ground_range_m=gr, slant_range_m=42.0,
                        m_per_px_across=mpp)
    # L ~ 28*0.25 = 7 m ; h = 7*12/(40+7) ~ 1.79 m
    assert h is not None and 1.3 < h < 2.3, h
    print(f"shadow.py ok: height {h} m from a ~28 px shadow at alt {alt} m, range {gr} m")
