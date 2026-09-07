"""The error budget - the thing nobody else builds (implementation_garv.md section 3.5).

Root-sum-square the independent terms, add the systematic terms linearly. The radius
varies per target: far range + straight line + good GPS -> tight; near nadir + on a turn
+ long layback -> wide. `dominant_term` and `explanation` are what the UI renders and
what gets said out loud.

Shape matches GET /api/detections/{id}.error_budget in apiendpoints.md section 3.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from backend.geometry.layback import Layback

GNSS_SIGMA_M = 3.0            # standalone GNSS 1-sigma; ~0.5 m with RTK/DGPS (header flags)
HEADING_SIGMA_DEG = 2.0       # attitude/heading 1-sigma; larger on turns
HEADING_SIGMA_DEG_TURN = 5.0
SOUND_SPEED_REL = 0.002       # 0.1-0.3% of range, systematic
ALT_REL_HEADER = 0.03         # altitude 1-sigma when read from the XTF header
ALT_REL_BLANKZONE = 0.25      # ...when estimated from the water column (section 3.7)

_LABEL = {
    "gnss_fix": "GPS fix",
    "layback": "Layback estimate",
    "heading": "Heading x layback",
    "altitude": "Altitude error",
    "sound_speed": "Sound speed",
    "pixel": "Pixel quantisation",
    "target_extent": "Object size",
}


@dataclass
class Term:
    source: str
    label: str
    value_m: float
    kind: str            # "independent" | "systematic"

    def as_dict(self) -> dict:
        return {"source": self.source, "label": self.label,
                "value_m": round(self.value_m, 2), "kind": self.kind}


@dataclass
class ErrorBudget:
    total_m: float
    method: str
    terms: list[Term]
    dominant_term: str
    explanation: str

    def as_dict(self) -> dict:
        return {
            "total_m": round(self.total_m, 2),
            "method": self.method,
            "terms": [t.as_dict() for t in self.terms],
            "dominant_term": self.dominant_term,
            "explanation": self.explanation,
        }


def _explain(dom: str, flags: list[str], lb: Layback) -> str:
    if dom == "altitude" and "estimated_altitude" in flags:
        return ("Altitude was estimated from the water column, so the across-track "
                "distance is the least certain part of this fix.")
    if dom == "altitude" and "near_nadir" in flags:
        return ("Target sits close to nadir, where a small altitude error swings the "
                "ground range a long way.")
    if dom == "layback":
        if lb.source == "nominal_scope":
            return ("Cable-out was not recorded, so layback is a bounded estimate - it "
                    "dominates this position.")
        return "Long cable-out on this line - layback dominates this position."
    if dom == "heading":
        return "On a turn with the fish well behind the ship - heading error dominates here."
    if dom == "target_extent":
        return "The object is large; you locate a thing, not a point, so its own size leads."
    if dom == "sound_speed":
        return "Clean geometry - the residual is the sound-speed assumption over the range."
    return "Standalone GPS is the largest single term for this fix."


def error_budget(*, slant_range_m: float, ground_range_m: float, altitude_m: float,
                 altitude_source: str, layback: Layback, sample_res_m: float,
                 bbox_m_width: float | None, bbox_m_height: float | None,
                 flags: list[str], on_turn: bool = False,
                 gnss_sigma_m: float = GNSS_SIGMA_M) -> ErrorBudget:
    gr = max(ground_range_m, 1e-3)
    head_sigma = math.radians(HEADING_SIGMA_DEG_TURN if on_turn else HEADING_SIGMA_DEG)
    alt_rel = ALT_REL_BLANKZONE if altitude_source == "blank_zone_estimate" else ALT_REL_HEADER
    extent = 0.5 * max(bbox_m_width or 0.0, bbox_m_height or 0.0)

    # altitude -> ground-range error grows as slant -> altitude; cap it at the range
    # itself (past that the target is effectively unlocated, not "very precisely wrong").
    alt_term = min((altitude_m / gr) * (alt_rel * altitude_m), max(slant_range_m, 1.0))
    ind = [
        Term("gnss_fix", _LABEL["gnss_fix"], gnss_sigma_m, "independent"),
        Term("layback", _LABEL["layback"], layback.rel_error * layback.distance_m, "independent"),
        Term("heading", _LABEL["heading"], layback.distance_m * math.sin(head_sigma), "independent"),
        Term("altitude", _LABEL["altitude"], alt_term, "independent"),
        Term("pixel", _LABEL["pixel"], 0.5 * sample_res_m, "independent"),
    ]
    sysc = [
        Term("sound_speed", _LABEL["sound_speed"], SOUND_SPEED_REL * slant_range_m, "systematic"),
        Term("target_extent", _LABEL["target_extent"], extent, "systematic"),
    ]
    rss = math.sqrt(sum(t.value_m ** 2 for t in ind))
    total = rss + sum(t.value_m for t in sysc)
    terms = sorted(ind + sysc, key=lambda t: -t.value_m)
    return ErrorBudget(total, "rss_independent_plus_linear_systematic", terms,
                       terms[0].source, _explain(terms[0].source, flags, layback))


if __name__ == "__main__":
    from backend.geometry.layback import layback as _lb

    b = error_budget(slant_range_m=57.2, ground_range_m=38.4, altitude_m=42.3,
                     altitude_source="xtf_header", layback=_lb(0.0, 0.0, 42.3),
                     sample_res_m=0.07, bbox_m_width=11.2, bbox_m_height=4.6,
                     flags=["long_layback"])
    d = b.as_dict()
    assert d["method"] == "rss_independent_plus_linear_systematic"
    assert d["terms"] == sorted(d["terms"], key=lambda t: -t["value_m"])
    assert d["dominant_term"] == d["terms"][0]["source"]
    assert d["total_m"] > 0 and d["explanation"]
    print("budget.py ok: total", d["total_m"], "dominant", d["dominant_term"])
    print("  ", d["explanation"])
