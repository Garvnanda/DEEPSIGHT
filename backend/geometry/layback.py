"""Layback - where the fish actually is (implementation_garv.md section 3.4).

    horizontal_layback = sqrt(cable_out^2 - fish_depth^2)
    fish_position = ship_position projected backwards along heading by horizontal_layback

When cable-out and fish depth are not in the headers (the Larsen XTF records neither),
layback is *bounded* from a nominal cable scope instead of computed (section 2.1). That
path is honest but wide - `layback_source` says which was used and the error budget
widens the layback term accordingly.

This module returns only the along-track offset distance + its source. The geodesic
back-projection of the ship position is in project.py.
"""

from __future__ import annotations

from dataclasses import dataclass

# nominal tow geometry when nothing is recorded: assume the fish trails at roughly
# NOMINAL_SCOPE_RATIO x its own depth below the surface. Mid-range for a slow deep tow.
# implementation_garv.md section 3.4 / section 2.1 - tune if cruise notes appear.
NOMINAL_SCOPE_RATIO = 3.0
NOMINAL_LAYBACK_REL_ERR = 0.5      # +/-50% when bounded, vs 0.05-0.15 when computed
COMPUTED_LAYBACK_REL_ERR = 0.10


@dataclass
class Layback:
    distance_m: float
    source: str            # "cable_out" | "nominal_scope"
    rel_error: float       # fractional 1-sigma on distance_m


def layback(cable_out_m: float, fish_depth_m: float, altitude_m: float) -> Layback:
    if cable_out_m > 0.0 and fish_depth_m >= 0.0 and cable_out_m > fish_depth_m:
        d = (cable_out_m ** 2 - fish_depth_m ** 2) ** 0.5
        return Layback(d, "cable_out", COMPUTED_LAYBACK_REL_ERR)
    # nothing usable: bound from a nominal scope over the best depth proxy we have.
    depth_proxy = fish_depth_m if fish_depth_m > 0.0 else max(altitude_m, 1.0)
    d = NOMINAL_SCOPE_RATIO * depth_proxy
    return Layback(d, "nominal_scope", NOMINAL_LAYBACK_REL_ERR)


if __name__ == "__main__":
    a = layback(100.0, 60.0, 40.0)
    assert a.source == "cable_out" and abs(a.distance_m - 80.0) < 1e-6, a
    b = layback(0.0, 0.0, 40.0)
    assert b.source == "nominal_scope" and b.distance_m == 120.0, b
    print("layback.py ok:", a, b)
