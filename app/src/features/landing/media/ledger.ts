/**
 * Cleared King County plates for the Relief landing.
 * Color grade stays in CSS. These files are the ungraded originals
 * (or a Wikimedia size derivative), not a baked teal treatment.
 * Access date for every source below: 2026-11-12.
 */

export type PhotoPlate = {
  id: string
  src: string
  alt: string
  caption: string
  credit: string
  license: string
  sourceUrl: string
  geography: string
}

/** Elliott Bay locating plate. Crossfades with the relief of the same water and skyline. */
export const heroPhotograph: PhotoPlate = {
  id: 'elliott-bay',
  src: '/photography/elliott-bay-skyline.jpg',
  alt: 'Downtown Seattle and the Space Needle across Elliott Bay, under an overcast sky, seen from the water.',
  caption:
    'Elliott Bay and downtown Seattle, photographed 4 September 2010 from the water taxi. Geographic context for King County sales recorded May 2014–May 2015, not a current listing photo.',
  credit:
    'Dennis Hamilton. “2010-09-04: Seattle skyline from Elliott Bay,” originally posted to Flickr and reviewed on Wikimedia Commons. Accessed 2026-11-12.',
  license: 'CC BY 2.0',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:Seattle_skyline_from_Elliott_Bay.jpg',
  geography: 'Elliott Bay, Seattle, King County, Washington',
}

/** Neighborhood fabric for the lower documentary band. Not a second skyline. */
export const fabricPhotograph: PhotoPlate = {
  id: 'west-seattle-hillside',
  src: '/photography/west-seattle-hillside.jpg',
  alt: 'A residential street on a West Seattle hillside, with houses, trees, and the Duwamish industrial area and distant mountains beyond.',
  caption:
    'West Seattle hillside above the Duwamish, photographed 26 June 2022. Neighborhood context for King County sales recorded May 2014–May 2015, not a current listing photo.',
  credit:
    'Z3lvs. Own work on Wikimedia Commons, 26 June 2022. This file is the Commons 1280-pixel derivative of the 4008×3000 original. Accessed 2026-11-12.',
  license: 'CC0 1.0',
  sourceUrl:
    'https://commons.wikimedia.org/wiki/File:Hillside_street_in_West_Seattle_with_the_Duwamish_industrial_area_and_distant_mountains.jpg',
  geography:
    'West Seattle hillside, King County, Washington (Commons location 47.573, -122.379), looking toward the Duwamish',
}
