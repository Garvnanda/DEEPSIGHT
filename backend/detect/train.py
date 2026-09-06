"""YOLO training entry point (implementation_garv.md section 6.2).

Model: YOLO11s (--model yolo11s.pt), a user decision that supersedes the doc's frozen
YOLOv8s - same Ultralytics framework, smaller and higher mAP. YOLOv8s is still trained
once as an eval baseline (`--model yolov8s.pt --name deepsight_y8s`).

Local: `python -m backend.detect.train --epochs 100`
Colab: same, on a GPU runtime. Sessions die at 12 h, so this always resumes from the
last checkpoint if one exists - point --project at a Google Drive path there.

Weights land at <project>/<name>/weights/{last,best}.pt and best.pt is small enough to
commit so inference never depends on Colab being up.
"""

from __future__ import annotations

import argparse
from pathlib import Path


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/detect/yolo/data.yaml")
    ap.add_argument("--model", default="yolo11s.pt")
    ap.add_argument("--epochs", type=int, default=100)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=16)
    ap.add_argument("--device", default=None, help="cuda index, 'cpu', or None=auto")
    ap.add_argument("--project", default="runs/detect")
    ap.add_argument("--name", default="deepsight_y11s",
                    help="use deepsight_y8s with --model yolov8s.pt for the baseline run")
    ap.add_argument("--limit", type=int, default=0,
                    help="smoke test: cap train+val images actually used (0 = all)")
    args = ap.parse_args()

    from ultralytics import YOLO

    data = args.data
    if args.limit:
        data = _tiny_copy(args.data, args.limit)

    project = str(Path(args.project).resolve())   # absolute -> ultralytics won't re-nest it
    last = Path(project) / args.name / "weights" / "last.pt"
    if last.exists():
        print(f"resuming from {last}")
        YOLO(str(last)).train(resume=True)
        return

    YOLO(args.model).train(
        data=data, epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
        device=args.device, project=project, name=args.name,
        exist_ok=True, save_period=1,           # checkpoint every epoch (Colab safety)
        patience=30,
    )


def _tiny_copy(data_yaml: str, limit: int) -> str:
    """Build a throwaway data.yaml pointing at the first `limit` images per split."""
    import shutil
    import yaml

    d = yaml.safe_load(Path(data_yaml).read_text())
    root = Path(d["path"])
    out = root.parent / "yolo_smoke"
    if out.exists():
        shutil.rmtree(out)
    for split_key in ("train", "val"):
        src_img = root / d[split_key]
        dst_img = out / d[split_key]
        dst_lbl = Path(str(dst_img).replace("images", "labels"))
        dst_img.mkdir(parents=True, exist_ok=True)
        dst_lbl.mkdir(parents=True, exist_ok=True)
        for img in sorted(src_img.glob("*.jpg"))[:limit]:
            shutil.copy(img, dst_img / img.name)
            lbl = Path(str(img).replace("images", "labels")).with_suffix(".txt")
            if lbl.exists():
                shutil.copy(lbl, dst_lbl / lbl.name)
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: {d['train']}\nval: {d['val']}\n"
        "names:\n" + "".join(f"  {i}: {n}\n" for i, n in d["names"].items())
    )
    return str(out / "data.yaml")


if __name__ == "__main__":
    main()
