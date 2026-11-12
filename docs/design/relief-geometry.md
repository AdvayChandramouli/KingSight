# King County relief geometry

This is the coordinate set for the landing relief stage. The same arrays are copied into `app/src/features/landing/relief/geometry.ts` and `project.ts`. The scene does not download GIS at runtime.

**Depiction for orientation. Homes in this dataset are coordinates, not buildings.**

This model is stylized. It is not a survey, not a parcel map, and not a digital twin. Shorelines are coarse on purpose so streets do not appear. Do not use it for navigation, setbacks, or any measured distance.

## Projection

Local tangent frame, not a published CRS.

- Origin: latitude `47.432`, longitude `-121.8035` (midpoint of the simplified King County bounding box below).
- Meters per degree of latitude: `111320`.
- Meters per degree of longitude: `111320 * cos(origin latitude)`.
- One model unit = `100000` meters (100 km).
- `x` = easting / 100000.
- `z` = −northing / 100000, so north is −Z and Y is up.
- Property and neighbor pins use this projection of the latitude and longitude props. Their Y is the flat basswood board (`LAND_TOP` in `project.ts`), not a DEM elevation.

The initial camera is a high oblique from the southwest (`CAMERA_FRAME` in `project.ts`): polar angle stopped above the horizon, distance stopped before a landmark can fill the frame. There is no autorotate.

## What is published, and what was drawn

### County landward edge

North, south, and east edges are a Douglas–Peucker simplification (ε = 0.012°) of the US Census Bureau TIGERweb county polygon for GEOID `53033` (State_County map service, `geometryPrecision=4`), retrieved 2026-11-12. The open source ring had 11,682 vertices. The simplification used here has the 39 landward vertices in `CENSUS_LANDWARD`, rounded to 0.001°. That service is a cartographic boundary. It is not a survey.

The simplified legal outline’s western bulge runs through Puget Sound and around Vashon. Those vertices are omitted from the land board. A legal county line in the water would hide Elliott Bay.

### Mainland shore

`SHORE` is a planning outline, north to south, drawn through published coastal places so West Point, Elliott Bay, Alki, and Dash Point read. It is not a NOAA shoreline, not the census county line, and not a hydrographic survey. Control places, rounded: Richmond Beach, Shilshole, West Point, the downtown waterfront, Duwamish Head, Alki Point, Fauntleroy, Seahurst, Three Tree Point, Des Moines, Redondo, Dash Point.

`NORTH_RETURN` closes the north county line from the simplified census edge back to Richmond Beach along about 47.776°.

### Water and islands

Lake Washington, Lake Sammamish, Mercer Island, and Vashon–Maury are stylized outlines anchored to those features’ published extents. They are not National Hydrography Dataset shores. Lakes are holes in the basswood board with a flat darker sheet underneath. There is no water shader.

Puget Sound is the shore ring plus a western edge at longitude `-122.63`. Vashon sits on that sheet as its own land piece.

### Mount Rainier

Summit used for the coarse mass: latitude `46.8529`, longitude `-121.7604` (the widely published Columbia Crest / USGS position). That point is in Pierce County, outside the King County ring, and the test checks that it stays outside. The mesh is a faceted cone, exaggerated so the mass reads from the oblique camera. It is not a terrain tile.

### East crest

`EAST_CREST` is the simplified census edge east of longitude `-121.5`, extruded into a low wedge. Height dips near latitude `47.42` so Snoqualmie Pass reads as a saddle. This is not a DEM.

### Landmarks

Twelve silhouettes. Footprints and heights are exaggerated so they read on a county-scale board. They are not buildings, not selectable, and not properties. A raycast on them does nothing.

| Id | Name | Latitude | Longitude | Note |
|---|---|---:|---:|---|
| downtown-seattle | Downtown Seattle | 47.6044 | -122.3301 | Columbia Center gazetteer position, used as the downtown cluster |
| space-needle | Space Needle | 47.6205 | -122.3493 | Published tower position |
| university-of-washington | University of Washington | 47.6553 | -122.308 | Campus center, rounded |
| bellevue | Bellevue | 47.6101 | -122.2015 | Downtown |
| redmond | Redmond | 47.640 | -122.136 | Campus west of Lake Sammamish |
| sea-tac | Sea-Tac | 47.449 | -122.309 | Airport reference point, rounded |
| renton | Renton | 47.482 | -122.203 | Nudged south of the simplified lake so the block sits on the board. Boeing Renton is nearer 47.493, -122.216 |
| issaquah | Issaquah | 47.5301 | -122.0326 | Town center |
| enumclaw | Enumclaw | 47.2043 | -121.9876 | Town center |
| vashon | Vashon | 47.4473 | -122.4598 | Town |
| shoreline | Shoreline | 47.7556 | -122.341 | City center |
| snoqualmie-pass | Snoqualmie Pass | 47.422 | -121.440 | Inset west of the published I-90 summit (about 47.422, -121.414) so the bar sits on the simplified crest |

## Runtime rings

`geometry.ts` is the runtime copy. The census landward ring, in order:

```
[-122.335, 47.257], [-122.144, 47.258], [-122.095, 47.195], [-122.047, 47.171],
[-121.994, 47.173], [-121.938, 47.139], [-121.901, 47.156], [-121.840, 47.143],
[-121.778, 47.173], [-121.719, 47.151], [-121.629, 47.153], [-121.582, 47.119],
[-121.510, 47.123], [-121.442, 47.084], [-121.377, 47.089], [-121.403, 47.099],
[-121.394, 47.133], [-121.298, 47.149], [-121.318, 47.173], [-121.311, 47.208],
[-121.365, 47.224], [-121.332, 47.257], [-121.341, 47.281], [-121.427, 47.289],
[-121.445, 47.310], [-121.430, 47.335], [-121.466, 47.368], [-121.438, 47.372],
[-121.427, 47.421], [-121.312, 47.479], [-121.229, 47.566], [-121.180, 47.565],
[-121.172, 47.590], [-121.112, 47.599], [-121.129, 47.676], [-121.066, 47.709],
[-121.094, 47.758], [-121.119, 47.780], [-121.998, 47.775]
```

Mainland shore, north to south, then closed by the census edge and the north return `[-122.200, 47.776], [-122.340, 47.777]`:

```
[-122.392, 47.777], [-122.398, 47.748], [-122.402, 47.712], [-122.406, 47.690],
[-122.436, 47.662], [-122.408, 47.646], [-122.382, 47.632], [-122.358, 47.620],
[-122.340, 47.608], [-122.333, 47.599], [-122.350, 47.586], [-122.386, 47.594],
[-122.421, 47.576], [-122.406, 47.550], [-122.392, 47.523], [-122.374, 47.490],
[-122.364, 47.468], [-122.385, 47.451], [-122.352, 47.428], [-122.329, 47.401],
[-122.323, 47.372], [-122.328, 47.348], [-122.372, 47.332], [-122.412, 47.320]
```

Lake, island, and sound rings live beside those constants in `geometry.ts` under the same names (`LAKE_WASHINGTON`, `LAKE_SAMMAMISH`, `MERCER`, `VASHON`, `SOUND`).
