"""Geodesic projection to WGS-84 (implementation_garv.md section 3.3).

Sonar looks perpendicular to track. Bearing to a target is heading + 90 deg (starboard)
or heading - 90 deg (port). Offset the ground range along that bearing from the FISH
position - not the ship's - on the ellipsoid with pyproj.Geod.fwd. Not flat-earth trig.

The fish position itself is the ship (GPS) position moved backwards along heading by the
horizontal layback (layback.py + fwd() with bearing = heading + 180).
"""

from __future__ import annotations

from pyproj import Geod

_GEOD = Geod(ellps="WGS84")


def offset(lat: float, lon: float, bearing_deg: float, dist_m: float) -> tuple[float, float]:
    """Point dist_m along bearing_deg from (lat, lon). Returns (lat, lon)."""
    lon2, lat2, _ = _GEOD.fwd(lon, lat, bearing_deg, dist_m)
    return lat2, lon2


def fish_position(ship_lat: float, ship_lon: float, heading_deg: float,
                  layback_m: float) -> tuple[float, float]:
    """Ship position projected backwards along heading by the horizontal layback."""
    return offset(ship_lat, ship_lon, (heading_deg + 180.0) % 360.0, layback_m)


def target_position(fish_lat: float, fish_lon: float, heading_deg: float,
                    ground_range_m: float, channel: str) -> tuple[float, float]:
    """Target position: ground_range_m perpendicular to track from the fish."""
    side = 90.0 if channel == "starboard" else -90.0
    return offset(fish_lat, fish_lon, (heading_deg + side) % 360.0, ground_range_m)


def geodesic_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    return _GEOD.inv(lon1, lat1, lon2, lat2)[2]


if __name__ == "__main__":
    # 100 m due east of the equator/prime-meridian origin
    la, lo = offset(0.0, 0.0, 90.0, 100.0)
    assert abs(la) < 1e-6 and abs(lo - 0.000898) < 1e-4, (la, lo)
    # round-trip: fish behind ship, target off to starboard, distances check out
    fl, fo = fish_position(10.0, 20.0, 0.0, 80.0)          # heading north -> fish is south
    assert fl < 10.0 and abs(geodesic_m(10.0, 20.0, fl, fo) - 80.0) < 0.5
    tl, to = target_position(fl, fo, 0.0, 50.0, "starboard")  # -> east
    assert to > fo and abs(geodesic_m(fl, fo, tl, to) - 50.0) < 0.5
    print("project.py ok")
