"""Analysis chain — log transform, nadir-gap mask, wavelet despeckle -> detector input
(implementation_garv.md section 4.2).

This is the *analysis* branch. It shares only the raw stacked array with the display
branch (`display.stack`) and never routes through `display.normalise` — despeckling
makes an image look nicer and destroys the texture statistics the detector needs, so the
two chains must not cross (idea.md section 6, golden rule).

Order:
  raw stack -> log10 + robust normalise -> zero the nadir gap -> 2D DWT soft-threshold
  speckle reduction -> u8
"""

from __future__ import annotations

import numpy as np
import pywt

from backend.imaging.display import stack

_WAVELET = "sym4"
_LEVEL = 2
_CLIP_LO, _CLIP_HI = 1.0, 99.5


def log_normalise(wf: np.ndarray) -> np.ndarray:
    """log10(I + 1e-6) then robust percentile stretch to [0, 1]. No TVG - the detector
    was trained on tiles that carry their own residual gain, and a second gain curve here
    would be a chain crossing."""
    x = np.log10(np.maximum(wf - wf.min(), 0.0) + 1e-6)
    lo, hi = np.percentile(x, [_CLIP_LO, _CLIP_HI])
    return np.clip((x - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


def mask_nadir_gap(norm: np.ndarray, pings) -> np.ndarray:
    """Zero the water-column samples either side of nadir, per ping. Nothing real is ever
    detected there (implementation_garv.md section 3.2); masking it keeps the detector from
    locking onto the bright first-return arc."""
    out = norm.copy()
    half = norm.shape[1] // 2
    for r, p in enumerate(pings):
        res = (p.sound_speed_ms / (2.0 * p.sample_rate_hz)) if p.sample_rate_hz else 0.0
        if res <= 0 or p.altitude_m <= 0:
            continue
        gap = int(min(half - 1, round(p.altitude_m / res)))
        if gap > 0:
            out[r, half - gap : half + gap] = 0.0
    return out


def wavelet_despeckle(img: np.ndarray, wavelet: str = _WAVELET, level: int = _LEVEL) -> np.ndarray:
    """2D DWT, soft-threshold the detail (high-frequency) sub-bands, reconstruct. The
    approximation sub-band (seabed structure) is left untouched; speckle lives in the
    details. VisuShrink universal threshold, noise sigma from the finest diagonal band
    via the MAD estimator. No GAN, no training."""
    img = img.astype(np.float32)
    coeffs = pywt.wavedec2(img, wavelet, level=level, mode="periodization")
    detail = coeffs[1:]
    finest_diag = detail[-1][2]
    sigma = np.median(np.abs(finest_diag)) / 0.6745
    thr = sigma * np.sqrt(2.0 * np.log(img.size))
    new = [coeffs[0]]
    for cH, cV, cD in detail:
        new.append(tuple(pywt.threshold(c, thr, mode="soft") for c in (cH, cV, cD)))
    rec = pywt.waverec2(new, wavelet, mode="periodization")
    rec = rec[: img.shape[0], : img.shape[1]]        # periodization can pad by 1
    return np.clip(rec, 0.0, 1.0)


def to_u8_analysis(pings, width: int | None = None) -> np.ndarray:
    """Full analysis chain. Returns (n_pings, width) uint8 for the detector."""
    raw = stack(pings)
    norm = log_normalise(raw)
    norm = mask_nadir_gap(norm, pings)
    den = wavelet_despeckle(norm)
    if width and width != den.shape[1]:
        idx = np.linspace(0, den.shape[1] - 1, width).round().astype(int)
        den = den[:, idx]
    return (den * 255.0).astype(np.uint8)


if __name__ == "__main__":
    import sys

    from backend.ingest.xtf import read_survey

    src = sys.argv[1] if len(sys.argv) > 1 else (
        r"C:\Users\Garv Nanda\Downloads\84545_xtf\XTF\GA0346_ssl_A4_patch1_line1.xtf"
    )
    _, pings = read_survey(src)
    sub = pings[:400]
    u8 = to_u8_analysis(sub)
    assert u8.dtype == np.uint8 and u8.shape[0] == 400
    assert u8.min() >= 0 and u8.max() <= 255

    # speckle reduction must lower local variance without collapsing global contrast
    from backend.imaging.display import normalise
    disp = (normalise(stack(sub)) * 255).astype(np.uint8)

    def local_var(a: np.ndarray) -> float:
        a = a.astype(np.float32)
        m = np.zeros_like(a)
        m[:, 1:-1] = (a[:, :-2] + a[:, 1:-1] + a[:, 2:]) / 3
        return float(np.mean((a[:, 1:-1] - m[:, 1:-1]) ** 2))

    lv_disp, lv_an = local_var(disp), local_var(u8)
    print(f"analysis.py ok: {u8.shape}  local var display={lv_disp:.1f} analysis={lv_an:.1f}"
          f"  global std display={disp.std():.1f} analysis={u8.std():.1f}")
    assert lv_an < lv_disp, "despeckle should reduce local variance"
    assert u8.std() > 8, "despeckle collapsed global contrast"
