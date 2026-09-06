"""Assemble the unified YOLO detection dataset (implementation_garv.md section 8 Step 6).

Sources (all under data/detect/, gitignored):
  - sss_mine/<year>/*.jpg + *.txt   SSS Mine Detection, native classes MILCO=0 NOMBO=1
  - ai4shipwrecks/AI4Shipwrecks/{train,test}/{images,labels}/*.png   waterfall + {0,1} mask
  - ai4shipwrecks/AI4Shipwrecks/extras/terrain/images/*.png          terrain-only negatives

Output: data/detect/yolo/{images,labels}/{train,val}/ + data.yaml

Class ids (from apiendpoints.md section 3 table order):
  0 wreck  1 milco  2 nombo  3 pipeline
`pipeline` is declared but has no training data here - SubPipe is held out for the
cross-dataset test (implementation_garv.md section 2.2) and is not downloaded.

Splits:
  - AI4Shipwrecks: keep the published site split. train -> train, test -> val
    (implementation_garv.md section 7.4 - do not reshuffle).
  - SSS Mine: no official split. Deterministic 85/15 by md5(filename).

Tall AI4 waterfall strips (width 1728, height up to ~18000) are tiled vertically into
1728 x 1024 windows with 128 px overlap. Tiles with a wreck are all kept; empty tiles
are capped at the positive-tile count per split so negatives don't swamp training.
"""

from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import cv2
import numpy as np

from scripts.derive_boxes import boxes_to_yolo, mask_to_boxes  # noqa: E402  (repo-root on path)

DATA = Path("data/detect")
OUT = DATA / "yolo"
CLASSES = ["wreck", "milco", "nombo", "pipeline"]

SSS_REMAP = {0: 1, 1: 2}          # native MILCO/NOMBO -> contract milco/nombo
SSS_VAL_FRACTION = 0.15
TILE_H = 1024
TILE_OVERLAP = 128


def _split_by_hash(name: str, val_fraction: float) -> str:
    h = int(hashlib.md5(name.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF
    return "val" if h < val_fraction else "train"


def _fresh_out() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    for sub in ("images/train", "images/val", "labels/train", "labels/val"):
        (OUT / sub).mkdir(parents=True, exist_ok=True)


def _write(split: str, stem: str, img: np.ndarray, lines: list[str]) -> None:
    cv2.imwrite(str(OUT / "images" / split / f"{stem}.jpg"), img)
    (OUT / "labels" / split / f"{stem}.txt").write_text("\n".join(lines))


def _add_sss(counts: dict) -> None:
    for jpg in sorted(DATA.glob("sss_mine/*/*.jpg")):
        txt = jpg.with_suffix(".txt")
        if not txt.exists():
            continue
        split = _split_by_hash(jpg.name, SSS_VAL_FRACTION)
        lines = []
        for ln in txt.read_text().split("\n"):
            p = ln.split()
            if len(p) != 5:
                continue
            c = int(p[0])
            if c not in SSS_REMAP:
                continue
            lines.append(" ".join([str(SSS_REMAP[c])] + p[1:]))
        img = cv2.imread(str(jpg))
        _write(split, f"sss_{jpg.stem}", img, lines)
        counts[f"sss/{split}"] = counts.get(f"sss/{split}", 0) + 1
        counts["sss_boxes"] = counts.get("sss_boxes", 0) + len(lines)


def _tile_ranges(height: int) -> list[tuple[int, int]]:
    if height <= TILE_H:
        return [(0, height)]
    step = TILE_H - TILE_OVERLAP
    starts = list(range(0, height - TILE_OVERLAP, step))
    return [(s, min(s + TILE_H, height)) for s in starts]


def _add_ai4(counts: dict) -> None:
    root = DATA / "ai4shipwrecks" / "AI4Shipwrecks"
    for src_split, dst_split in (("train", "train"), ("test", "val")):
        pos, empties = [], []
        for img_path in sorted((root / src_split / "images").glob("*.png")):
            mask_path = root / src_split / "labels" / img_path.name
            img = cv2.imread(str(img_path))
            mask = cv2.imread(str(mask_path), cv2.IMREAD_UNCHANGED)
            if img is None or mask is None:
                continue
            h = img.shape[0]
            for y0, y1 in _tile_ranges(h):
                itile, mtile = img[y0:y1], mask[y0:y1]
                boxes = mask_to_boxes(mtile)
                stem = f"ai4_{src_split}_{img_path.stem}_{y0}"
                lines = boxes_to_yolo(boxes, itile.shape[1], itile.shape[0], cls=0)
                (pos if lines else empties).append((stem, itile, lines))
        # terrain negatives only into train
        if dst_split == "train":
            for t in sorted((root / "extras" / "terrain" / "images").glob("*.png")):
                img = cv2.imread(str(t))
                if img is None:
                    continue
                for y0, y1 in _tile_ranges(img.shape[0]):
                    empties.append((f"ai4_terrain_{t.stem}_{y0}", img[y0:y1], []))

        rng = np.random.default_rng(0)
        rng.shuffle(empties)
        empties = empties[: len(pos)]           # cap negatives at positive count
        for stem, itile, lines in pos + empties:
            _write(dst_split, stem, itile, lines)
        counts[f"ai4/{dst_split}/pos"] = len(pos)
        counts[f"ai4/{dst_split}/neg"] = len(empties)
        counts[f"ai4/{dst_split}/boxes"] = sum(len(l) for _, _, l in pos)


def build() -> None:
    _fresh_out()
    counts: dict = {}
    _add_sss(counts)
    _add_ai4(counts)
    (OUT / "data.yaml").write_text(
        "path: " + str(OUT.resolve()).replace("\\", "/") + "\n"
        "train: images/train\n"
        "val: images/val\n"
        "names:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(CLASSES))
    )
    n_train = len(list((OUT / "images/train").glob("*.jpg")))
    n_val = len(list((OUT / "images/val").glob("*.jpg")))
    print("dataset assembled ->", OUT)
    for k in sorted(counts):
        print(f"  {k}: {counts[k]}")
    print(f"  TOTAL images: train={n_train} val={n_val}")


if __name__ == "__main__":
    build()
