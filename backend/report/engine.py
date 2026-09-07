"""Report generation — JSON + CSV (apiendpoints.md section 6).

method_notes is generated here, not templated in the UI. It is where the project's
honesty lives (apiendpoints.md section 6) - every note reflects an actual choice made
upstream.
"""

from __future__ import annotations

import csv
import io

from backend.report.stats import survey_stats
from backend.state import Survey, survey_detail

CSV_COLUMNS = [
    "detection_id", "timestamp", "lat", "lon", "error_radius_m", "class",
    "confidence", "bbox_m_width", "bbox_m_height", "object_height_m", "ping",
    "altitude_source",
]


def _method_notes(s: Survey) -> list[str]:
    notes = [
        "Slant-range correction applied assuming locally flat seabed.",
        "Confidence is a raw detector score and is not calibrated.",
        "Positions are WGS-84. Error radius is a 1-sigma search radius.",
    ]
    if s.meta:
        if s.meta.altitude_source == "blank_zone_estimate":
            notes.insert(1, "Altitude estimated from the water column — positions carry "
                            "higher uncertainty.")
        else:
            notes.insert(1, "Altitude read from XTF header.")
        notes.extend(s.meta.warnings)
    if not s.detections:
        notes.append("No detections yet — detection model not run for this survey.")
    return notes


def report_json(s: Survey) -> dict:
    return {
        "survey": survey_detail(s),
        "generated_at": _now(),
        "stats": survey_stats(s),
        "detections": [{k: v for k, v in d.items() if not k.startswith("_")}
                       for d in s.detections],
        "method_notes": _method_notes(s),
    }


def report_csv(s: Survey) -> str:
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_COLUMNS)
    for d in s.detections:
        w.writerow([d.get(c, "") for c in CSV_COLUMNS])
    return buf.getvalue()


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
