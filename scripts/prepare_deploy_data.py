"""Copy the demo-survey tiles into data/deploy_bucket/ for upload to the Cloud Run bucket.

Picks the same tiles as backend.state.create_a4sss_survey (first 24 sorted sss_*.jpg with a
non-empty label file) and mirrors the data/ layout, so the bucket mounted at /app/data
serves them at data/detect/yolo/images/val/. Output stays under data/ (gitignored).

Run from repo root:  python scripts/prepare_deploy_data.py
"""

import glob
import shutil
from pathlib import Path

N_TILES = 24  # must match create_a4sss_survey's n_tiles default
OUT = Path("data/deploy_bucket")

picked = []
for f in sorted(glob.glob("data/detect/yolo/images/val/sss_*.jpg")):
    lf = f.replace("images", "labels").replace(".jpg", ".txt")
    if Path(lf).is_file() and Path(lf).read_text().strip():
        picked.append((f, lf))
    if len(picked) >= N_TILES:
        break

assert len(picked) == N_TILES, f"only {len(picked)} boxed tiles found"
for img, lbl in picked:
    for src in (img, lbl):
        dst = OUT / Path(src).relative_to("data")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
print(f"copied {N_TILES} tiles + labels into {OUT}/detect/")
