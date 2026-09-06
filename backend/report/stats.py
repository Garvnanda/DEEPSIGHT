"""Survey stats (apiendpoints.md section 7). Thin wrapper over backend.state.stats,
which owns the area / line-length / headline maths.
"""

from __future__ import annotations

from backend.state import Survey, stats as _stats


def survey_stats(s: Survey) -> dict:
    return _stats(s)
