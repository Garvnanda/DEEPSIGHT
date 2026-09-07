"""AI4Shipwrecks binary masks -> YOLO boxes (implementation_garv.md section 2.2 / section 8 Step 6).

Masks are single-channel PNG, values {0,1}: 1 = shipwreck. A single wreck's return is
fragmented by its own shadow, so a naive connected-components pass yields ~6 boxes per
wreck and the detector learns a smeared target (wreck mAP50 ~0.30). Fix: morphological
CLOSE to bridge the shadow gaps, then merge components whose bounding boxes are within
_MERGE_GAP_PX of each other. Result is ~1-2 boxes per wreck.
"""

from __future__ import annotations

import cv2
import numpy as np

WRECK_CLASS = 0
_CLOSE_PX = 25           # bridge shadow gaps inside one wreck
_MERGE_GAP_PX = 40       # merge component bboxes closer than this
_MIN_AREA_PX = 80        # drop specks (post-close)
_MIN_SIDE_PX = 6


def _merge_close(boxes: list[list[int]], gap: int) -> list[tuple[int, int, int, int]]:
    """Union-merge boxes whose gap-expanded rects overlap. Repeats to fixpoint."""
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        out: list[list[int]] = []
        for b in boxes:
            bx0, by0, bx1, by1 = b[0] - gap, b[1] - gap, b[0] + b[2] + gap, b[1] + b[3] + gap
            for o in out:
                ox0, oy0, ox1, oy1 = o[0], o[1], o[0] + o[2], o[1] + o[3]
                if bx0 < ox1 and ox0 < bx1 and by0 < oy1 and oy0 < by1:
                    nx0, ny0 = min(o[0], b[0]), min(o[1], b[1])
                    nx1 = max(o[0] + o[2], b[0] + b[2])
                    ny1 = max(o[1] + o[3], b[1] + b[3])
                    o[0], o[1], o[2], o[3] = nx0, ny0, nx1 - nx0, ny1 - ny0
                    changed = True
                    break
            else:
                out.append(list(b))
        boxes = out
    return [tuple(b) for b in boxes]


def mask_to_boxes(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Return pixel boxes [(x, y, w, h), ...] for a {0,1} or {0,255} mask."""
    m = (mask > 0).astype(np.uint8)
    if not m.any():
        return []
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_CLOSE_PX, _CLOSE_PX))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    n, _, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    comps = [[int(stats[i, 0]), int(stats[i, 1]), int(stats[i, 2]), int(stats[i, 3])]
             for i in range(1, n)
             if stats[i, 4] >= _MIN_AREA_PX
             and stats[i, 2] >= _MIN_SIDE_PX and stats[i, 3] >= _MIN_SIDE_PX]
    return _merge_close(comps, _MERGE_GAP_PX)


def boxes_to_yolo(boxes, img_w: int, img_h: int, cls: int = WRECK_CLASS) -> list[str]:
    """Pixel (x,y,w,h) -> YOLO 'cls xc yc w h' normalised lines."""
    lines = []
    for x, y, w, h in boxes:
        xc = (x + w / 2) / img_w
        yc = (y + h / 2) / img_h
        lines.append(f"{cls} {xc:.6f} {yc:.6f} {w / img_w:.6f} {h / img_h:.6f}")
    return lines


if __name__ == "__main__":
    import glob
    import sys

    root = sys.argv[1] if len(sys.argv) > 1 else \
        "data/detect/ai4shipwrecks/AI4Shipwrecks"
    for split in ("train", "test"):
        tot_img = tot_box = with_box = 0
        for lf in sorted(glob.glob(f"{root}/{split}/labels/*.png")):
            tot_img += 1
            b = mask_to_boxes(cv2.imread(lf, cv2.IMREAD_UNCHANGED))
            tot_box += len(b)
            with_box += bool(b)
        print(f"{split}: {tot_img} masks, {with_box} with a wreck, {tot_box} boxes derived")
