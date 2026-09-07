"""False-alarm suppression — three deterministic rules (implementation_garv.md section 6.3).

No second model. Rules run after detection + de-dup.

  Rule 1  shadow direction   — a real proud object throws its acoustic shadow *away*
          from nadir, with the bright highlight on the nadir-facing side. A box whose
          far-side strip is brighter than the box itself has no shadow there and is
          almost certainly an artifact -> dropped. (This does NOT filter rocks; a
          rock's shadow is oriented correctly too.)
  Rule 2  minimum ground area — remove boxes below a small pixel-area floor. The true
          version is ~1 m^2 of ground area and needs the geometry module (Step 5) to
          convert; until then this is a conservative pixel floor. ponytail: pixel
          floor, swap for real ground area once geometry lands. Tune against labels.
  Rule 3  height-to-footprint — shadow length + altitude + range -> object height;
          manufactured objects violate the natural ratio. Needs geometry (Step 5).
          Not yet active.

Conservative by design: on a sparse demo an aggressive filter empties the screen.
"""

from __future__ import annotations

import numpy as np

MIN_BOX_AREA_PX = 12 * 12        # Rule 2 placeholder floor - conservative, kills specks only
RULE1_BRIGHTER_MARGIN = 1.02     # far (outboard) strip brighter than the box itself -> no shadow -> artifact


def _rule1_shadow_direction(d: dict, wf: np.ndarray, width: int) -> bool:
    """True = keep. Drops only clear 'no shadow away from nadir' artifacts."""
    b = d["bbox_px"]
    x, y, w, h = b["x"], b["y"], b["w"], b["h"]
    y0, y1 = max(0, y), min(wf.shape[0], y + h)
    if y1 - y0 < 3 or w < 3:
        return True
    nadir = width / 2
    outboard = +1 if (x + w / 2) >= nadir else -1
    # strip of width w immediately outboard (away from nadir) of the box
    if outboard > 0:
        fx0, fx1 = x + w, x + 2 * w
    else:
        fx0, fx1 = x - w, x
    fx0, fx1 = max(0, min(width, fx0)), max(0, min(width, fx1))
    if fx1 - fx0 < 3:
        return True
    box_mean = float(wf[y0:y1, max(0, x):min(width, x + w)].mean())
    far_mean = float(wf[y0:y1, fx0:fx1].mean())
    # a genuine object has a DARKER shadow outboard; drop only if outboard is clearly brighter
    if far_mean > box_mean * RULE1_BRIGHTER_MARGIN:
        return False
    if far_mean < box_mean * 0.8:
        d["flags"] = sorted(set(d["flags"]) | {"shadow_confirmed"})
    return True


def _rule2_min_area(d: dict) -> bool:
    b = d["bbox_px"]
    return b["w"] * b["h"] >= MIN_BOX_AREA_PX


def apply_rules(dets: list[dict], wf: np.ndarray, width: int, enabled: bool = True) -> list[dict]:
    if not enabled:
        return dets
    out = []
    for d in dets:
        if not _rule2_min_area(d):
            continue
        if not _rule1_shadow_direction(d, wf, width):
            continue
        out.append(d)
    return out


if __name__ == "__main__":
    # nadir at column 200. Box on the port side (cols 180-200): highlight faces nadir,
    # shadow falls outboard = to smaller x (cols 160-180).
    wf = np.full((200, 400), 120, np.uint8)
    wf[40:60, 180:200] = 240          # highlight, nadir-facing edge
    wf[40:60, 160:180] = 20           # shadow, outboard
    box = {"bbox_px": {"x": 180, "y": 40, "w": 20, "h": 20}, "class": "milco", "flags": []}
    assert apply_rules([dict(box, flags=[])], wf, 400), "shadowed object should be kept"

    wf2 = wf.copy(); wf2[40:60, 160:180] = 245        # bright outboard -> artifact
    assert apply_rules([dict(box, flags=[])], wf2, 400) == [], "bright-outboard should drop"

    tiny = {"bbox_px": {"x": 0, "y": 0, "w": 4, "h": 4}, "class": "milco", "flags": []}
    assert apply_rules([tiny], wf, 400) == [], "sub-floor box should drop"
    print("suppress.py ok: rule1 keeps shadowed, drops bright-outboard; rule2 drops tiny")
