import type { PropertyRecord, PropertyRole } from '@/services/types'

/**
 * Synthetic demo properties. Values were constructed by perturbing typical
 * ZIP-level coordinates, sizes, and prices from the 2014–2015 King County
 * sales data; no record is a genuine transaction. Only the mock client may
 * import this module.
 */

const H: PropertyRole = 'held_out_example'
const R: PropertyRole = 'reference_only'

/** [sqft_living, bedrooms, bathrooms, grade, condition, yr_built, waterfront] */
type AttributeTuple = [number, number, number, number, number, number, boolean]

function home(
  id: string,
  role: PropertyRole,
  [latitude, longitude]: [number, number],
  zipcode: string | null,
  sale_date: string | null,
  actual_price_usd: number | null,
  [sqft_living, bedrooms, bathrooms, grade, condition, yr_built, waterfront]: AttributeTuple,
): PropertyRecord {
  return {
    id,
    latitude,
    longitude,
    zipcode,
    sale_date,
    actual_price_usd,
    attributes: { sqft_living, bedrooms, bathrooms, grade, condition, yr_built, waterfront },
    role,
  }
}

export const FIXTURES: readonly PropertyRecord[] = [
  // Seattle
  home('KC-1001', H, [47.6844, -122.3433], '98103', '2015-02-03', 580_500, [1_210, 2, 1.75, 7, 4, 1950, false]),
  home('KC-1002', H, [47.6831, -122.2846], '98115', '2014-09-01', 610_000, [1_880, 4, 1.75, 7, 4, 1947, false]),
  home('KC-1003', H, [47.6825, -122.3735], '98117', '2014-09-16', 679_500, [1_510, 4, 2, 7, 4, 1947, false]),
  home('KC-1004', H, [47.6602, -122.3616], '98107', '2015-03-01', 229_000, [720, 1, 1, 6, 3, 1918, false]),
  home('KC-1005', H, [47.6721, -122.2946], '98105', '2014-10-27', 879_000, [2_380, 4, 2.5, 8, 5, 1909, false]),
  home('KC-1006', H, [47.6141, -122.3119], '98112', '2014-10-11', 649_500, [1_670, 3, 3.5, 8, 3, 2005, false]),
  home('KC-1007', H, [47.6076, -122.2917], '98122', '2014-05-23', 746_000, [1_840, 3, 2.25, 9, 4, 1928, false]),
  home('KC-1008', H, [47.5951, -122.2976], '98144', '2014-10-16', 386_000, [1_510, 2, 2.5, 7, 3, 2010, false]),
  home('KC-1009', H, [47.5264, -122.2869], '98118', '2014-07-15', 396_500, [2_470, 5, 3.25, 7, 3, 2013, false]),
  home('KC-1010', H, [47.5605, -122.4005], '98116', '2015-04-25', 1_801_500, [2_650, 3, 2.75, 9, 3, 1962, true]),
  home('KC-1011', H, [47.521, -122.3826], '98136', '2014-12-07', 714_500, [1_970, 4, 1.75, 8, 3, 1954, false]),
  home('KC-1012', H, [47.6457, -122.3942], '98199', '2014-08-07', 1_256_500, [4_460, 5, 3.75, 9, 3, 2012, false]),
  home('KC-1013', H, [47.6432, -122.3697], '98119', '2015-02-22', 899_000, [2_470, 4, 2.25, 8, 3, 1933, false]),
  home('KC-1014', H, [47.7143, -122.2902], '98125', '2014-10-24', 317_500, [1_210, 3, 2.5, 8, 3, 2007, false]),
  home('KC-1015', H, [47.7293, -122.3363], '98133', '2015-03-31', 385_500, [1_010, 2, 1, 7, 3, 1959, false]),
  home('KC-1016', H, [47.7623, -122.3651], '98177', '2014-06-22', 1_223_500, [2_740, 5, 2.75, 9, 4, 1955, false]),
  home('KC-1017', H, [47.518, -122.3599], '98106', '2014-07-06', 177_000, [910, 2, 1, 6, 3, 1924, false]),
  home('KC-1018', H, [47.5278, -122.3192], '98108', '2014-12-25', 167_500, [1_000, 2, 1.25, 6, 2, 1929, false]),
  home('KC-1019', H, [47.4943, -122.2781], '98178', '2014-06-21', 213_500, [1_480, 3, 2, 7, 4, 1937, false]),
  home('KC-1020', H, [47.5134, -122.3841], '98146', '2015-04-08', 433_000, [2_280, 4, 2.25, 6, 3, 1932, false]),
  home('KC-1021', H, [47.7373, -122.3144], '98155', '2014-10-18', 415_500, [1_020, 3, 1.75, 7, 5, 1955, false]),
  // Eastside
  home('KC-1022', H, [47.6066, -122.1976], '98004', '2015-01-25', 2_194_500, [5_420, 5, 4.5, 11, 3, 2006, false]),
  home('KC-1023', H, [47.6146, -122.2259], '98039', '2014-11-28', 5_789_500, [6_870, 5, 5.75, 13, 3, 2008, false]),
  home('KC-1024', H, [47.5592, -122.2445], '98040', '2014-08-06', 1_985_000, [2_880, 4, 2.75, 9, 4, 1978, true]),
  home('KC-1025', H, [47.6004, -122.1795], '98005', '2014-09-11', 870_000, [2_460, 4, 2.5, 9, 4, 1965, false]),
  home('KC-1026', H, [47.5537, -122.1739], '98006', '2015-04-04', 512_000, [1_670, 2, 2, 8, 4, 1960, false]),
  home('KC-1027', H, [47.6905, -122.2031], '98033', '2015-03-29', 756_000, [2_180, 4, 2, 7, 3, 1962, false]),
  home('KC-1028', H, [47.7334, -122.2285], '98034', '2014-09-30', 389_500, [1_040, 3, 2, 7, 4, 1965, false]),
  home('KC-1029', H, [47.6923, -122.1142], '98052', '2014-11-19', 516_000, [1_860, 4, 2.25, 8, 3, 1976, false]),
  home('KC-1030', H, [47.6363, -121.9632], '98053', '2014-06-07', 594_500, [2_390, 3, 2.75, 7, 3, 1990, false]),
  home('KC-1031', H, [47.6254, -122.0438], '98074', '2014-06-09', 442_500, [1_580, 2, 2, 8, 3, 1985, false]),
  home('KC-1032', H, [47.583, -122.0111], '98075', '2014-07-21', 2_329_000, [4_980, 4, 4.25, 12, 3, 2001, false]),
  home('KC-1033', H, [47.7418, -122.22], '98011', '2014-05-02', 627_000, [2_710, 5, 2.5, 9, 3, 2007, false]),
  // South county
  home('KC-1034', H, [47.4511, -122.2065], '98055', '2015-05-05', 449_000, [3_060, 3, 3.5, 8, 3, 2005, false]),
  home('KC-1035', H, [47.4609, -122.1751], '98058', '2014-12-18', 239_000, [1_040, 1, 1, 6, 3, 1956, false]),
  home('KC-1036', H, [47.4768, -122.1324], '98059', '2014-12-28', 442_000, [2_190, 5, 2.25, 7, 3, 2003, false]),
  home('KC-1037', H, [47.4185, -122.168], '98031', '2014-09-02', 249_000, [1_330, 3, 1.5, 7, 4, 1974, false]),
  home('KC-1038', H, [47.3661, -122.0868], '98042', '2015-03-25', 188_000, [1_140, 3, 1.5, 7, 3, 1977, false]),
  home('KC-1039', H, [47.2646, -122.2789], '98001', '2014-12-28', 191_500, [1_170, 3, 1, 7, 5, 1960, false]),
  home('KC-1040', H, [47.3123, -122.3829], null, null, null, [1_760, 4, 2.5, 7, 4, 1971, false]),
  home('KC-1041', H, [47.4103, -122.2929], '98198', '2014-11-22', 164_000, [1_330, 3, 1, 7, 3, 1953, false]),
  home('KC-1042', H, [47.6838, -122.2987], '98115', '2015-03-03', 598_000, [1_870, 3, 2, 8, 4, 1941, false]),
  home('KC-1043', H, [47.4756, -122.3365], '98166', null, null, [1_050, 3, 2, 6, 4, 1940, false]),
  // Issaquah, Snoqualmie Valley, and southeast outskirts
  home('KC-1044', H, [47.5325, -122.0297], '98027', '2014-11-06', 607_500, [2_500, 4, 2.5, 8, 3, 2004, false]),
  home('KC-1045', H, [47.5335, -121.7442], '98065', '2015-02-28', 439_000, [1_710, 3, 2.5, 7, 3, 1988, false]),
  home('KC-1046', H, [47.4444, -121.7762], '98045', '2014-06-29', 258_000, [1_170, 3, 1, 7, 3, 1982, false]),
  home('KC-1047', H, [47.7642, -121.9047], '98019', '2015-04-09', 390_000, [1_770, 4, 1.5, 7, 3, 1961, false]),
  home('KC-1048', H, [47.3896, -122.0284], '98038', '2014-05-06', 319_000, [2_310, 5, 2, 8, 3, 2005, false]),
  home('KC-1049', H, [47.1929, -121.9965], '98022', '2015-01-19', 219_000, [1_550, 3, 1.75, 6, 4, 1986, false]),
  home('KC-1050', H, [47.7158, -121.3352], '98014', '2014-07-20', 214_500, [1_240, 2, 1, 6, 3, 1952, false]),
  home('KC-1051', H, [47.1612, -121.6488], '98022', '2014-07-15', 144_000, [1_380, 2, 1.5, 6, 4, 1968, false]),
  // Reference-only context homes: graph neighbors, never selectable examples
  home('KC-1052', R, [47.6937, -122.359], '98103', '2014-06-16', 490_000, [2_460, 4, 1.5, 7, 4, 1914, false]),
  home('KC-1053', R, [47.6854, -122.2932], '98115', '2014-08-05', 425_000, [830, 2, 2, 7, 3, 1922, false]),
  home('KC-1054', R, [47.6949, -122.3724], '98117', '2015-05-11', 658_500, [2_000, 2, 2.5, 9, 3, 2010, false]),
  home('KC-1055', R, [47.6019, -122.3038], '98122', '2015-04-22', 508_000, [1_600, 3, 2.25, 8, 3, 2010, false]),
  home('KC-1056', R, [47.5305, -122.2883], '98118', '2014-12-04', 489_500, [2_630, 3, 1, 7, 4, 1914, false]),
  home('KC-1057', R, [47.6273, -122.2176], '98004', '2014-07-02', 992_000, [3_560, 5, 2.75, 8, 3, 1952, false]),
  home('KC-1058', R, [47.6331, -122.2262], '98039', '2014-07-15', 875_000, [1_690, 4, 2, 7, 3, 1967, false]),
  home('KC-1059', R, [47.6338, -122.0918], '98052', '2014-11-08', 598_500, [2_300, 4, 2, 9, 4, 1978, false]),
  home('KC-1060', R, [47.5741, -122.1483], '98006', '2015-03-02', 303_000, [1_640, 3, 1.75, 7, 3, 1956, false]),
  home('KC-1061', R, [47.4747, -122.1899], '98056', '2015-05-05', 416_000, [2_660, 3, 2.5, 7, 3, 2002, false]),
  home('KC-1062', R, [47.3475, -122.1711], '98030', '2014-10-12', 242_000, [1_260, 2, 2, 7, 4, 1987, false]),
  home('KC-1063', R, [47.571, -121.9987], '98029', '2014-08-05', 546_500, [2_140, 4, 2.25, 9, 3, 1990, false]),
  home('KC-1064', R, [47.5727, -121.9219], '98024', '2015-04-07', 691_000, [3_040, 3, 2.25, 9, 3, 2005, false]),
  home('KC-1065', R, [47.1781, -121.6955], '98022', '2015-02-19', 217_000, [1_510, 3, 1.75, 6, 3, 1974, false]),
  home('KC-1066', R, [47.6762, -122.1268], '98052', '2014-10-14', 598_000, [2_150, 4, 2.5, 8, 3, 1984, false]),
  home('KC-1067', R, [47.2905, -122.3204], '98003', '2015-01-08', 252_500, [1_720, 3, 2, 7, 4, 1968, false]),
  home('KC-1068', R, [47.4903, -121.7718], '98045', '2014-08-22', 349_000, [1_980, 3, 2.25, 7, 3, 1994, false]),
  home('KC-1069', R, [47.3958, -122.3087], '98198', '2014-11-30', 239_000, [1_460, 3, 1.5, 7, 3, 1962, false]),
  home('KC-1070', R, [47.6585, -121.9874], '98053', '2015-04-17', 612_000, [2_640, 4, 2.5, 8, 3, 1997, false]),
  home('KC-1071', R, [47.2088, -121.9761], '98022', '2014-09-05', 262_000, [1_640, 3, 2, 7, 3, 1979, false]),
]

export type FixtureProfile =
  | 'ordinary'
  | 'landing-preview'
  | 'waterfront'
  | 'small'
  | 'large'
  | 'renovated-context'
  | 'high-grade'
  | 'missing-metadata'
  | 'sparse-neighbors'
  | 'zero-neighbors'
  | 'model-disagreement'
  | 'reference-context'

/** Why notable fixtures exist; unlisted held-out IDs are ordinary homes. */
export const FIXTURE_PROFILES: Readonly<Record<string, { profile: FixtureProfile; note: string }>> = {
  'KC-1042': { profile: 'landing-preview', note: 'Complete, pleasant mid-size home with several graph neighbors; previewed on the landing page.' },
  'KC-1002': { profile: 'ordinary', note: 'Typical north Seattle home.' },
  'KC-1037': { profile: 'ordinary', note: 'Typical south county home.' },
  'KC-1010': { profile: 'waterfront', note: 'Waterfront home on the West Seattle shoreline.' },
  'KC-1024': { profile: 'waterfront', note: 'Waterfront home on the Mercer Island shoreline.' },
  'KC-1007': { profile: 'model-disagreement', note: 'The two demo models differ by roughly 19% for this grade-9 home.' },
  'KC-1004': { profile: 'small', note: 'Small one-bedroom home (720 sq ft).' },
  'KC-1022': { profile: 'large', note: 'Large newer Eastside home (5,420 sq ft, grade 11).' },
  'KC-1005': { profile: 'renovated-context', note: 'Built 1909 but in excellent condition (5), suggesting later upkeep or renovation.' },
  'KC-1023': { profile: 'high-grade', note: 'Unusually high building grade (13), very large.' },
  'KC-1032': { profile: 'high-grade', note: 'High building grade (12) on the Sammamish Plateau.' },
  'KC-1040': { profile: 'missing-metadata', note: 'No ZIP code, sale date, or recorded sale price.' },
  'KC-1043': { profile: 'missing-metadata', note: 'No sale date or recorded sale price.' },
  'KC-1051': { profile: 'sparse-neighbors', note: 'Remote southeast home with a single connected neighbor.' },
  'KC-1050': { profile: 'zero-neighbors', note: 'Remote Skykomish valley home with no connected neighbors.' },
  'KC-1047': { profile: 'zero-neighbors', note: 'Rural Duvall-area home with no connected neighbors.' },
  'KC-1065': { profile: 'reference-context', note: 'The only neighbor of KC-1051.' },
}
