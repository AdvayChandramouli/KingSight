/**
 * Stylized King County planning geometry.
 * Source notes, the accuracy disclaimer, and these same coordinates:
 * docs/design/relief-geometry.md
 *
 * Rings are [longitude, latitude]. They are not closed duplicates.
 * Do not treat any ring as a survey boundary.
 */

export type LngLat = [number, number]

/**
 * Mainland waterfront, north to south, through published coastal places
 * so Elliott Bay, West Point, and Alki read. The legal county line sits
 * farther west, in the sound; it is not this shore.
 */
export const SHORE: LngLat[] = [
  [-122.392, 47.777],
  [-122.398, 47.748],
  [-122.402, 47.712],
  [-122.406, 47.69],
  [-122.436, 47.662],
  [-122.408, 47.646],
  [-122.382, 47.632],
  [-122.358, 47.62],
  [-122.34, 47.608],
  [-122.333, 47.599],
  [-122.35, 47.586],
  [-122.386, 47.594],
  [-122.421, 47.576],
  [-122.406, 47.55],
  [-122.392, 47.523],
  [-122.374, 47.49],
  [-122.364, 47.468],
  [-122.385, 47.451],
  [-122.352, 47.428],
  [-122.329, 47.401],
  [-122.323, 47.372],
  [-122.328, 47.348],
  [-122.372, 47.332],
  [-122.412, 47.32],
]

/**
 * North, south, and east edges of GEOID 53033 after Douglas–Peucker
 * (ε = 0.012°) on the TIGERweb county ring, starting where the mainland
 * leaves the sound near Federal Way and ending on the north line.
 * Rounded to 0.001°. The sound-and-Vashon bulge of that ring is omitted
 * here because it is water, not shore.
 */
export const CENSUS_LANDWARD: LngLat[] = [
  [-122.335, 47.257],
  [-122.144, 47.258],
  [-122.095, 47.195],
  [-122.047, 47.171],
  [-121.994, 47.173],
  [-121.938, 47.139],
  [-121.901, 47.156],
  [-121.84, 47.143],
  [-121.778, 47.173],
  [-121.719, 47.151],
  [-121.629, 47.153],
  [-121.582, 47.119],
  [-121.51, 47.123],
  [-121.442, 47.084],
  [-121.377, 47.089],
  [-121.403, 47.099],
  [-121.394, 47.133],
  [-121.298, 47.149],
  [-121.318, 47.173],
  [-121.311, 47.208],
  [-121.365, 47.224],
  [-121.332, 47.257],
  [-121.341, 47.281],
  [-121.427, 47.289],
  [-121.445, 47.31],
  [-121.43, 47.335],
  [-121.466, 47.368],
  [-121.438, 47.372],
  [-121.427, 47.421],
  [-121.312, 47.479],
  [-121.229, 47.566],
  [-121.18, 47.565],
  [-121.172, 47.59],
  [-121.112, 47.599],
  [-121.129, 47.676],
  [-121.066, 47.709],
  [-121.094, 47.758],
  [-121.119, 47.78],
  [-121.998, 47.775],
]

/** Short north-line return from the simplified census edge to the beach. */
export const NORTH_RETURN: LngLat[] = [
  [-122.2, 47.776],
  [-122.34, 47.777],
]

export const MAINLAND: LngLat[] = [...SHORE, ...CENSUS_LANDWARD, ...NORTH_RETURN]

/** Eastern crest of the simplified county ring, south to north. */
export const EAST_CREST: LngLat[] = CENSUS_LANDWARD.filter(([longitude]) => longitude > -121.5)

/** Stylized Vashon and Maury outline anchored to the island's published extent. */
export const VASHON: LngLat[] = [
  [-122.463, 47.512],
  [-122.446, 47.488],
  [-122.44, 47.45],
  [-122.458, 47.41],
  [-122.45, 47.382],
  [-122.4, 47.378],
  [-122.376, 47.389],
  [-122.392, 47.36],
  [-122.45, 47.348],
  [-122.492, 47.34],
  [-122.51, 47.372],
  [-122.512, 47.42],
  [-122.498, 47.468],
  [-122.48, 47.5],
]

/** Stylized Lake Washington shore. A hole in the mainland board. */
export const LAKE_WASHINGTON: LngLat[] = [
  [-122.268, 47.748],
  [-122.246, 47.742],
  [-122.228, 47.7],
  [-122.212, 47.65],
  [-122.206, 47.61],
  [-122.208, 47.56],
  [-122.22, 47.515],
  [-122.252, 47.508],
  [-122.27, 47.54],
  [-122.28, 47.6],
  [-122.278, 47.66],
  [-122.282, 47.71],
]

/** Stylized Lake Sammamish shore. A hole in the mainland board. */
export const LAKE_SAMMAMISH: LngLat[] = [
  [-122.108, 47.658],
  [-122.09, 47.65],
  [-122.074, 47.61],
  [-122.062, 47.57],
  [-122.068, 47.548],
  [-122.092, 47.552],
  [-122.11, 47.59],
  [-122.116, 47.635],
]

/** Stylized Mercer Island, sitting in the Lake Washington inset. */
export const MERCER: LngLat[] = [
  [-122.242, 47.59],
  [-122.218, 47.586],
  [-122.212, 47.555],
  [-122.232, 47.532],
  [-122.25, 47.548],
  [-122.254, 47.574],
]

/**
 * Puget Sound sheet: the mainland shore plus a western edge.
 * Vashon is a separate land piece on top of this sheet.
 */
export const SOUND: LngLat[] = [
  ...SHORE,
  [-122.63, 47.3],
  [-122.63, 47.79],
]

/** USGS summit, outside King County, drawn as a coarse mass. */
export const RAINIER = {
  name: 'Mount Rainier',
  latitude: 46.8529,
  longitude: -121.7604,
} as const

export type LandmarkKind = 'block' | 'bar' | 'needle' | 'cluster'

export type Landmark = {
  id: string
  name: string
  latitude: number
  longitude: number
  kind: LandmarkKind
  /** Exaggerated model height. Not a measured building height. */
  height: number
  width: number
  depth: number
}

/**
 * Twelve orientation silhouettes. Footprints and heights are exaggerated
 * so they read on a county-scale board. They are not selectable properties.
 * Snoqualmie Pass is inset west of the published summit so it sits on the
 * simplified crest rather than outside the ring.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: 'downtown-seattle',
    name: 'Downtown Seattle',
    latitude: 47.6044,
    longitude: -122.3301,
    kind: 'cluster',
    height: 0.045,
    width: 0.016,
    depth: 0.012,
  },
  {
    id: 'space-needle',
    name: 'Space Needle',
    latitude: 47.6205,
    longitude: -122.3493,
    kind: 'needle',
    height: 0.07,
    width: 0.012,
    depth: 0.012,
  },
  {
    id: 'university-of-washington',
    name: 'University of Washington',
    latitude: 47.6553,
    longitude: -122.308,
    kind: 'block',
    height: 0.018,
    width: 0.028,
    depth: 0.02,
  },
  {
    id: 'bellevue',
    name: 'Bellevue',
    latitude: 47.6101,
    longitude: -122.2015,
    kind: 'cluster',
    height: 0.032,
    width: 0.014,
    depth: 0.012,
  },
  {
    id: 'redmond',
    name: 'Redmond',
    latitude: 47.64,
    longitude: -122.136,
    kind: 'bar',
    height: 0.012,
    width: 0.03,
    depth: 0.016,
  },
  {
    id: 'sea-tac',
    name: 'Sea-Tac',
    latitude: 47.449,
    longitude: -122.309,
    kind: 'bar',
    height: 0.01,
    width: 0.04,
    depth: 0.014,
  },
  {
    id: 'renton',
    name: 'Renton',
    latitude: 47.482,
    longitude: -122.203,
    kind: 'block',
    height: 0.016,
    width: 0.02,
    depth: 0.014,
  },
  {
    id: 'issaquah',
    name: 'Issaquah',
    latitude: 47.5301,
    longitude: -122.0326,
    kind: 'block',
    height: 0.014,
    width: 0.016,
    depth: 0.012,
  },
  {
    id: 'enumclaw',
    name: 'Enumclaw',
    latitude: 47.2043,
    longitude: -121.9876,
    kind: 'block',
    height: 0.012,
    width: 0.014,
    depth: 0.012,
  },
  {
    id: 'vashon',
    name: 'Vashon',
    latitude: 47.4473,
    longitude: -122.4598,
    kind: 'block',
    height: 0.012,
    width: 0.012,
    depth: 0.01,
  },
  {
    id: 'shoreline',
    name: 'Shoreline',
    latitude: 47.7556,
    longitude: -122.341,
    kind: 'block',
    height: 0.012,
    width: 0.016,
    depth: 0.012,
  },
  {
    id: 'snoqualmie-pass',
    name: 'Snoqualmie Pass',
    latitude: 47.422,
    longitude: -121.44,
    kind: 'bar',
    height: 0.01,
    width: 0.02,
    depth: 0.012,
  },
]
