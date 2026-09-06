"""AI4Shipwrecks binary masks -> YOLO boxes (implementation_garv.md section 2.2 / section 8 Step 6).

Masks are single-channel PNG, values {0,1}: 1 = shipwreck. One wreck often breaks into
several blobs, so the mask is dilated before connected-components to merge them, then
tiny specks are dropped. One box per surviving component, class 0 (wreck).

Used by backend/detect/dataset.py; also runnable standalone for a quick count.
"""

from __future__ import annotations

import cv2
import numpy as np

WRECK_CLASS = 0
_DILATE_PX = 9            # merge blobs of one wreck that the mask fragments
_MIN_AREA_PX = 25         # drop specks
_MIN_SIDE_PX = 4


def mask_to_boxes(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Return pixel boxes [(x, y, w, h), ...] for a {0,1} or {0,255} mask."""
    m = (mask > 0).astype(np.uint8)
    if not m.any():
        return []
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (_DILATE_PX, _DILATE_PX))
    m = cv2.dilate(m, k, iterations=1)
    n, _, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < _MIN_AREA_PX or w < _MIN_SIDE_PX or h < _MIN_SIDE_PX:
            continue
        # undo the dilation halo
        pad = _DILATE_PX // 2
        x, y = x + pad, y + pad
        w, h = max(1, w - 2 * pad), max(1, h - 2 * pad)
        out.append((int(x), int(y), int(w), int(h)))
    return out


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
