"""Geometry helpers aligned with the frontend ray cast and haversine."""

from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_008.8

# Bounding box covering King County sales, closed ring (west, south) → clockwise.
FALLBACK_BOUNDS: list[float] = [-122.55, 47.05, -121.05, 47.82]
FALLBACK_POLYGON: list[list[float]] = [
    [-122.55, 47.05],
    [-121.05, 47.05],
    [-121.05, 47.82],
    [-122.55, 47.82],
    [-122.55, 47.05],
]
FALLBACK_LABEL = "King County, Washington"


def point_in_polygon(longitude: float, latitude: float, ring: list[list[float]]) -> bool:
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        intersects = (yi > latitude) != (yj > latitude) and longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
        if intersects:
            inside = not inside
        j = i
    return inside


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lon2 - lon1)
    h = math.sin(d_lat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def close_ring(points: list[list[float]]) -> list[list[float]]:
    if len(points) >= 2 and points[0] == points[-1]:
        return points
    return [*points, list(points[0])]
