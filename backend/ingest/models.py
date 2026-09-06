"""PingRecord, SurveyMeta — the parsed shapes everything downstream consumes.

Fields follow implementation_garv.md section 3.1: a ping is a header plus two sample
arrays (port, starboard). SurveyMeta is the once-per-file summary that feeds
GET /api/surveys/{id} (apiendpoints.md section 1).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import numpy as np


@dataclass
class PingRecord:
    """One sonar pulse = one waterfall row, primary frequency only.

    port / starboard are raw sample amplitudes (int/float as recorded), index 0 =
    nadir side. slant range of sample i is  r_i = i * sound_speed_ms / (2 * sample_rate_hz).
    """

    ping_number: int
    time: datetime                 # UTC, from the ping nav fields
    lat: float                     # sensor (fish) latitude, decimal degrees; NaN if absent
    lon: float                     # sensor (fish) longitude, decimal degrees; NaN if absent
    heading_deg: float
    pitch_deg: float
    roll_deg: float
    heave_m: float
    altitude_m: float              # SensorPrimaryAltitude; 0.0 when the header left it blank
    sound_speed_ms: float          # 2 x XTF SoundVelocity (Isis records c/2 for this sonar)
    sample_rate_hz: float          # samples / TimeDuration for this ping
    slant_range_m: float           # recorded SlantRange (the operator range setting)
    port: np.ndarray
    starboard: np.ndarray

    @property
    def samples_per_channel(self) -> int:
        return int(self.port.size)


@dataclass
class SurveyMeta:
    """Once-per-file summary. Mirrors the stable fields of GET /api/surveys/{id}."""

    filename: str
    path: str
    ping_count: int
    samples_per_channel: int
    range_m: float
    frequency_khz: int
    duration_s: float
    altitude_source: str           # "xtf_header" | "blank_zone_estimate"
    altitude_mean_m: float
    sound_speed_ms: float
    bounds: dict                   # {"north","south","east","west"} decimal degrees
    start_time: datetime
    sonar_name: str
    recording_program: str
    warnings: list[str] = field(default_factory=list)
