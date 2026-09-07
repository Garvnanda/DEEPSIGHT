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
  Rule 3  height-to-footprint — shadow length + altitude + range -> object height
          (geometry/shadow.py); a natural bottom object is roughly as tall as it is wide,
          a manufactured object is not (a pipe is long and low). Runs AFTER geometry, in
          rule3_height_footprint(). ponytail: heuristic ratio band tuned by eye against
          the demo, not a law - flat slabs and erratics violate it, so it only DROPS a
          detection when it is also low-confidence and classed as a target. Everything
          else is left exactly as-is (the object_height_m value carries the signal into
          the detail panel; the flag set stays the frozen contract's five values).

Conservative by design: on a sparse demo an aggressive filter empties the screen.
"""

from __future__ import annotations

import numpy as np

MIN_BOX_AREA_PX = 12 * 12        # Rule 2 placeholder floor - conservative, kills specks only
RULE1_BRIGHTER_MARGIN = 1.02     # far (outboard) strip brighter than the box itself -> no shadow -> artifact
RULE3_NATURAL_LO, RULE3_NATURAL_HI = 0.5, 1.6   # height/footprint band that reads as "rock"
RULE3_DROP_CONF = 0.40          # below this AND rock-shaped AND a target class -> drop


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
    return not far_mean > box_mean * RULE1_BRIGHTER_MARGIN


def _rule2_min_area(d: dict) -> bool:
    b = d["bbox_px"]
    return b["w"] * b["h"] >= MIN_BOX_AREA_PX


def apply_rules(dets: list[dict], wf: np.ndarray, width: int, enabled: bool = True) -> list[dict]:
    """Rules 1 and 2 - no geometry needed. Run right after de-dup."""
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


_TARGET_CLASSES = {"wreck", "milco", "pipeline"}


def rule3_height_footprint(dets: list[dict], enabled: bool = True) -> list[dict]:
    """Rule 3 - runs AFTER geometry so object_height_m and bbox_m_* are populated.
    A near-1 height/footprint ratio reads as a natural bottom object. Drop it only when it
    is also low-confidence and currently classed as a target; otherwise flag and keep."""
    if not enabled:
        return dets
    out = []
    for d in dets:
        h = d.get("object_height_m")
        foot = max(d.get("bbox_m_width") or 0.0, d.get("bbox_m_height") or 0.0)
        if (h and foot > 0 and RULE3_NATURAL_LO <= h / foot <= RULE3_NATURAL_HI
                and d["confidence"] < RULE3_DROP_CONF and d["class"] in _TARGET_CLASSES):
            continue                              # low-confidence rock-shaped target -> drop
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

    # Rule 3: rock-shaped (h/foot ~ 1) low-confidence target -> drop; flag otherwise
    rock = {"class": "milco", "confidence": 0.3, "object_height_m": 1.0,
            "bbox_m_width": 1.1, "bbox_m_height": 0.9, "flags": []}
    assert rule3_height_footprint([dict(rock)]) == [], "low-conf rock-shaped target should drop"
    assert rule3_height_footprint([{**rock, "confidence": 0.8}]), "high-conf rock-shaped should be kept"
    pipe = {"class": "pipeline", "confidence": 0.3, "object_height_m": 0.4,
            "bbox_m_width": 6.0, "bbox_m_height": 0.5, "flags": []}
    assert rule3_height_footprint([dict(pipe)]), "long-and-low object should be kept"
    print("suppress.py ok: rule1/2 as before; rule3 drops low-conf rock, keeps strong rock + pipe")
