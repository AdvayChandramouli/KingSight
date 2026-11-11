"""Coarse King County extent used to reject coordinates far outside the sales.

The ring is the axis-aligned bounding box of ``lat`` / ``long`` in the raw file,
expanded by 0.02 degrees on every side. It is the data extent, not a shoreline.
"""

from __future__ import annotations

from functools import lru_cache

from kingsight.data.dataset import load_raw

MARGIN_DEG = 0.02
LABEL = "King County sales data extent"


@lru_cache(maxsize=1)
def bounds() -> tuple[float, float, float, float]:
    """``(west, south, east, north)`` in degrees."""
    raw = load_raw()
    west = float(raw["long"].min()) - MARGIN_DEG
    south = float(raw["lat"].min()) - MARGIN_DEG
    east = float(raw["long"].max()) + MARGIN_DEG
    north = float(raw["lat"].max()) + MARGIN_DEG
    return (west, south, east, north)


def polygon() -> list[list[float]]:
    """Closed ring of ``[longitude, latitude]`` corners, data extent box."""
    west, south, east, north = bounds()
    return [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
    ]


def in_coverage(lat: float, lon: float) -> bool:
    west, south, east, north = bounds()
    return south <= float(lat) <= north and west <= float(lon) <= east
