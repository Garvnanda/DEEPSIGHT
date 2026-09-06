"""Display chain — gain normalise, contrast, resample -> u8 rows (implementation_garv.md section 4.1).

Signal processing only, no model. Order matters and is fixed:
  stack -> log -> windowed TVG -> percentile clip -> (square-pixel resample) -> u8

This is the *display* branch. The analysis branch (imaging/analysis.py) starts from the
same raw arrays and never routes through here.
"""

from __future__ import annotations

import numpy as np

_TVG_WINDOW = 400        # pings averaged for the across-track gain curve
_CLIP_LO, _CLIP_HI = 1.0, 99.0


def stack(pings, reverse_starboard: bool = True) -> np.ndarray:
    """PingRecord list -> (n_pings, 2*n_samples) float32, port reversed on the left,
    starboard on the right, nadir in the centre.

    reverse_starboard: this sonar stores starboard far->near; flip it so nadir meets
    the port side at the centre column (verified: corr +0.996 when flipped).
    """
    port = np.vstack([p.port.astype(np.float32) for p in pings])
    stbd = np.vstack([p.starboard.astype(np.float32) for p in pings])
    left = port[:, ::-1]
    right = stbd[:, ::-1] if reverse_starboard else stbd
    return np.hstack([left, right])


def normalise(wf: np.ndarray) -> np.ndarray:
    """log -> sliding-window TVG -> percentile clip -> [0,1]."""
    x = np.log10(wf - wf.min() + 1.0)
    out = np.empty_like(x)
    for a in range(0, x.shape[0], _TVG_WINDOW):
        b = min(a + _TVG_WINDOW, x.shape[0])
        curve = x[a:b].mean(axis=0)
        curve[curve < 1e-6] = 1e-6
        out[a:b] = x[a:b] / curve
    lo, hi = np.percentile(out, [_CLIP_LO, _CLIP_HI])
    return np.clip((out - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def to_u8(pings, width: int | None = None) -> np.ndarray:
    """Full chain. Returns (n_pings, width) uint8. width defaults to 2*n_samples."""
    norm = normalise(stack(pings))
    if width and width != norm.shape[1]:
        idx = np.linspace(0, norm.shape[1] - 1, width).round().astype(int)
        norm = norm[:, idx]
    return (norm * 255).astype(np.uint8)


if __name__ == "__main__":
    import sys

    from backend.ingest.xtf import read_survey

    src = sys.argv[1] if len(sys.argv) > 1 else (
        r"C:\Projects\DEEPSIGHT\data\MGDS_Download\NBP1001"
        r"\SS01-snip-2100-to-2115.XTF\SS01 snip 2100 to 2115.XTF"
    )
    _, pings = read_survey(src)
    u8 = to_u8(pings[:500], width=1024)
    assert u8.dtype == np.uint8 and u8.shape == (500, 1024), u8.shape
    assert u8.min() >= 0 and u8.max() <= 255
    print("display chain ok:", u8.shape, "range", u8.min(), u8.max())
