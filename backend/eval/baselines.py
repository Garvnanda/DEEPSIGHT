"""Naive threshold detector - baseline 1 (implementation_garv.md section 7.2).

Threshold the log-intensity image at a fixed percentile, take connected components
above a minimum area, emit one box each. No learning. This is the number the trained
detector has to beat by the detection milestone (decision rule 5).
"""

from __future__ import annotations

import numpy as np


def detect(gray: np.ndarray, pct: float = 99.0, min_area_px: int = 40) -> list[tuple[int, int, int, int]]:
    """gray: 2-D uint8/float image. Returns pixel boxes [(x, y, w, h), ...]."""
    import cv2

    g = gray.astype(np.float32)
    g = np.log10(g - g.min() + 1.0)
    thr = np.percentile(g, pct)
    mask = (g >= thr).astype(np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,
                            cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    n, _, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    return [(int(stats[i, 0]), int(stats[i, 1]), int(stats[i, 2]), int(stats[i, 3]))
            for i in range(1, n) if stats[i, 4] >= min_area_px]


def _iou(a, b) -> float:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    ix, iy = max(ax, bx), max(ay, by)
    ix2, iy2 = min(ax + aw, bx + bw), min(ay + ah, by + bh)
    inter = max(0, ix2 - ix) * max(0, iy2 - iy)
    union = aw * ah + bw * bh - inter
    return inter / union if union else 0.0


def evaluate(data_yaml: str = "data/detect/yolo/data.yaml", split: str = "val",
             iou_thr: float = 0.3) -> dict:
    """Box-level precision/recall of the naive detector against the val labels."""
    from pathlib import Path

    import cv2
    import yaml

    d = yaml.safe_load(Path(data_yaml).read_text())
    img_dir = Path(d["path"]) / d[split]
    lbl_dir = Path(str(img_dir).replace("images", "labels"))
    tp = fp = fn = 0
    for img_path in sorted(img_dir.glob("*.jpg")):
        im = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        h, w = im.shape
        preds = detect(im)
        gt = []
        lf = lbl_dir / f"{img_path.stem}.txt"
        if lf.exists():
            for ln in lf.read_text().splitlines():
                p = ln.split()
                if len(p) == 5:
                    _, xc, yc, bw, bh = map(float, p)
                    gt.append((int((xc - bw / 2) * w), int((yc - bh / 2) * h),
                               int(bw * w), int(bh * h)))
        matched = set()
        for pr in preds:
            hit = next((j for j, g in enumerate(gt)
                        if j not in matched and _iou(pr, g) >= iou_thr), None)
            if hit is None:
                fp += 1
            else:
                tp += 1
                matched.add(hit)
        fn += len(gt) - len(matched)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(prec, 4),
            "recall": round(rec, 4), "f1": round(f1, 4)}


if __name__ == "__main__":
    print(evaluate())
