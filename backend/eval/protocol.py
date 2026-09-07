"""Evaluation protocol (implementation_garv.md section 7).

Not accuracy. Reports:
  - mAP@0.5 and mAP@0.5:0.95, per-class P / R / F1              (YOLO .val on the held-out split)
  - false-positive rate on seafloor-only tiles                  (the operational number)
  - error-radius coverage: does the stated circle actually contain the target?
    (validates the error budget, not the detector)

Run:  python -m backend.eval.protocol

ponytail: the cross-dataset delta (train AI4+SSS -> test SubPipe, implementation_garv.md
section 7.3) is not run here - SubPipe is a ~10 GB download that is not on this machine.
Everything below runs on data already in the repo tree.
"""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

WEIGHTS = "backend/detect/weights/best.pt"
DATA_YAML = "data/detect/yolo/data.yaml"
VAL_IMAGES = Path("data/detect/yolo/images/val")
VAL_LABELS = Path("data/detect/yolo/labels/val")
CLASSES = ["wreck", "milco", "nombo", "pipeline"]


# ------------------------------------------------------------------ detector metrics
def yolo_metrics() -> dict:
    from ultralytics import YOLO

    res = YOLO(WEIGHTS).val(data=DATA_YAML, split="val", verbose=False, plots=False)
    b = res.box
    out = {
        "mAP50": round(float(b.map50), 4),
        "mAP50_95": round(float(b.map), 4),
        "per_class": {},
    }
    for i, ci in enumerate(b.ap_class_index):
        name = CLASSES[int(ci)] if int(ci) < len(CLASSES) else str(ci)
        p, r = float(b.p[i]), float(b.r[i])
        f1 = 2 * p * r / (p + r) if (p + r) else 0.0
        out["per_class"][name] = {
            "P": round(p, 3), "R": round(r, 3), "F1": round(f1, 3),
            "mAP50": round(float(b.ap50[i]), 3),
        }
    return out


# ------------------------------------------------------------------ seafloor FP rate
def seafloor_fp_rate(conf: float = 0.25) -> dict:
    """Fraction of target-free tiles that still produce at least one box, and the mean
    number of spurious boxes per such tile. This is what a survey without targets costs
    an operator."""
    from ultralytics import YOLO

    import cv2

    model = YOLO(WEIGHTS)
    negatives = []
    for lf in VAL_LABELS.glob("*.txt"):
        if lf.stat().st_size == 0:
            img = next((VAL_IMAGES / (lf.stem + ext) for ext in (".jpg", ".png")
                        if (VAL_IMAGES / (lf.stem + ext)).exists()), None)
            if img:
                negatives.append(img)
    if not negatives:
        return {"n_tiles": 0}
    tiles_with_fp = 0
    total_fp = 0
    for img in negatives:
        r = model.predict(cv2.imread(str(img)), conf=conf, imgsz=640, verbose=False)[0]
        k = len(r.boxes)
        total_fp += k
        tiles_with_fp += k > 0
    return {
        "n_tiles": len(negatives),
        "tiles_with_fp": tiles_with_fp,
        "fp_tile_rate": round(tiles_with_fp / len(negatives), 4),
        "fp_per_tile": round(total_fp / len(negatives), 4),
        "conf": conf,
    }


# ------------------------------------------------------------------ error-radius coverage
def _synthetic_pings(n: int, turn_at: int | None = None):
    """Straight tow off Chennai, optional heading change part way. The RECORDED ship
    position trails the TRUE fish position forward along heading by a real layback plus
    GPS noise; cable-out / fish-depth are set so layback() computes an ESTIMATE that is a
    few metres long (catenary sag), exactly the residual the error budget is meant to
    cover."""
    from backend.ingest.models import PingRecord
    from backend.geometry.project import offset

    rng = np.random.default_rng(7)
    lat0, lon0 = 13.05, 80.30
    c, slant_range_m, alt_true = 1500.0, 90.0, 14.0
    width = 1024
    fs = (width // 2) * c / (2 * slant_range_m)
    t0 = datetime.now(timezone.utc).replace(microsecond=0)

    LB_TRUE = 45.0
    cable_out, fish_depth = 52.0, 15.0        # -> layback() estimate ~ sqrt(52^2-15^2) ~ 49.8 m

    true_fish = []          # (lat, lon) of the fish, exact
    pings = []
    step_m = 1.2            # along-track advance per ping
    lat = lat0
    lon = lon0
    for i in range(n):
        heading = 90.0 if (turn_at is None or i < turn_at) else 90.0 + 25.0 * min(1.0, (i - turn_at) / 30)
        # advance the fish
        lat, lon = offset(lat, lon, heading, step_m)
        true_fish.append((lat, lon))
        # recorded ship = fish projected FORWARD along heading by the true layback, + GPS noise
        s_lat, s_lon = offset(lat, lon, heading, LB_TRUE)
        s_lat += rng.normal(0, 3.0) / 111_320.0
        s_lon += rng.normal(0, 3.0) / (111_320.0 * math.cos(math.radians(lat)))
        pings.append(PingRecord(
            ping_number=i, time=t0 + timedelta(seconds=0.2 * i),
            lat=s_lat, lon=s_lon, heading_deg=heading + rng.normal(0, 1.0),
            pitch_deg=0.0, roll_deg=0.0, heave_m=0.0,
            altitude_m=alt_true + rng.normal(0, 0.3),
            sound_speed_ms=c, sample_rate_hz=fs, slant_range_m=slant_range_m,
            port=np.zeros(width // 2, np.uint8), starboard=np.zeros(width // 2, np.uint8),
            cable_out_m=cable_out, fish_depth_m=fish_depth,
        ))
    return pings, true_fish, dict(alt_true=alt_true, slant_range_m=slant_range_m, width=width)


def error_radius_coverage() -> dict:
    """Place known targets through the full geometry chain and check the predicted circle
    contains the true position. If the budget is an honest 1-sigma, coverage sits near or
    above ~0.68; well above means conservative, below means the budget is too tight."""
    from backend.geometry.locate import locate_detection
    from backend.geometry.project import geodesic_m, offset
    from backend.ingest.models import SurveyMeta

    pings, true_fish, cfg = _synthetic_pings(240, turn_at=150)
    half = cfg["width"] // 2
    meta = SurveyMeta(
        filename="synthetic", path="", ping_count=len(pings),
        samples_per_channel=half, range_m=cfg["slant_range_m"], frequency_khz=400,
        duration_s=0.2 * len(pings), altitude_source="xtf_header",
        altitude_mean_m=cfg["alt_true"], sound_speed_ms=1500.0,
        bounds={}, start_time=pings[0].time, sonar_name="synthetic",
        recording_program="protocol", warnings=[],
    )

    regimes = {"near_nadir": [10, 18], "mid": [35, 55], "far": [78, 95]}
    rows = []
    for pi in range(20, len(pings), 12):
        on_turn = 150 <= pi <= 190
        p = pings[pi]
        f_lat, f_lon = true_fish[pi]
        heading_true = 90.0 if pi < 150 else 90.0 + 25.0 * min(1.0, (pi - 150) / 30)
        for regime, grs in regimes.items():
            for gr in grs:
                for channel, sign in (("starboard", +1), ("port", -1)):
                    # true target: from the true fish position, perpendicular to true heading
                    t_lat, t_lon = offset(f_lat, f_lon, heading_true + sign * 90.0, gr)
                    slant = math.hypot(gr, cfg["alt_true"])
                    frac = min(slant / cfg["slant_range_m"], 1.0)
                    cx = half + sign * frac * half
                    bbox = {"x": int(cx - 6), "y": pi, "w": 12, "h": 10}
                    geo = locate_detection(all_pings=pings, ping_index=pi, bbox_px=bbox,
                                           channel=channel, width=cfg["width"], meta=meta)
                    if geo["lat"] is None or geo["_geometry"]["ground_range_m"] <= 0:
                        continue
                    err = geodesic_m(geo["lat"], geo["lon"], t_lat, t_lon)
                    rows.append((regime, on_turn, err, geo["error_radius_m"], err <= geo["error_radius_m"]))

    def summarise(sel):
        s = [r for r in rows if sel(r)]
        if not s:
            return None
        cov = sum(r[4] for r in s) / len(s)
        med_err = float(np.median([r[2] for r in s]))
        med_rad = float(np.median([r[3] for r in s]))
        return {"n": len(s), "coverage": round(cov, 3),
                "median_error_m": round(med_err, 1), "median_radius_m": round(med_rad, 1)}

    return {
        "overall": summarise(lambda r: True),
        "near_nadir": summarise(lambda r: r[0] == "near_nadir"),
        "mid": summarise(lambda r: r[0] == "mid"),
        "far": summarise(lambda r: r[0] == "far"),
        "on_turn": summarise(lambda r: r[1]),
        "straight": summarise(lambda r: not r[1]),
    }


# ------------------------------------------------------------------ report
def run() -> dict:
    report = {"generated_at": datetime.now(timezone.utc).isoformat()}
    print("== error-radius coverage (synthetic geometry) ==")
    cov = error_radius_coverage()
    report["error_radius_coverage"] = cov
    for k, v in cov.items():
        if v:
            print(f"  {k:11s} n={v['n']:3d}  coverage={v['coverage']:.2f}  "
                  f"err(med)={v['median_error_m']:5.1f} m  radius(med)={v['median_radius_m']:5.1f} m")

    print("\n== seafloor-only false positives ==")
    fp = seafloor_fp_rate()
    report["seafloor_fp"] = fp
    if fp.get("n_tiles"):
        print(f"  {fp['n_tiles']} target-free tiles  "
              f"fp_tile_rate={fp['fp_tile_rate']:.3f}  fp_per_tile={fp['fp_per_tile']:.3f}")

    print("\n== detector metrics (held-out val split) ==")
    m = yolo_metrics()
    report["yolo"] = m
    print(f"  mAP@0.5 = {m['mAP50']:.3f}   mAP@0.5:0.95 = {m['mAP50_95']:.3f}")
    for name, v in m["per_class"].items():
        print(f"  {name:9s}  P={v['P']:.2f}  R={v['R']:.2f}  F1={v['F1']:.2f}  mAP50={v['mAP50']:.2f}")

    return report


if __name__ == "__main__":
    run()
