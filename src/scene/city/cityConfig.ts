/**
 * Single source of truth for the exterior city: world-space constants, road network, moon position and a seeded PRNG.
 * World units are metres. The room's window is in the back wall (z = -3.2); the city lies behind it (-z).
 */

/**
 * Height of the street surface relative to the studio floor (y = 0). The studio is on an upper floor of a modern building,
 * about six storeys (19.5 m) above the street, so the road is seen from above and well below eye level.
 */
export const GROUND_Y = -19.5
/** Approximate eye height of the default camera. Used to cap skyline elevation angles. */
export const EYE_Y = 1.77
/** Camera far plane needed to see the whole city (the original scene used 120). */
export const CITY_FAR = 1500

export interface RoadType { lane: number; lanes: number; parking: number; walk: number }
/** Four-lane avenue (two lanes each way) with parking lanes and wide pavements. */
export const MAJOR: RoadType = { lane: 3.3, lanes: 2, parking: 2.3, walk: 4.0 }
/** Local street: one lane each way. */
export const MINOR: RoadType = { lane: 3.3, lanes: 1, parking: 2.2, walk: 3.6 }

export const carriageHalf = (r: RoadType) => r.lane * r.lanes
export const parkEdge = (r: RoadType) => carriageHalf(r) + r.parking
export const walkEdge = (r: RoadType) => parkEdge(r) + r.walk

/** Avenues run along x. Index 0 is the major avenue closest to the window; the rest are local streets. */
/** The avenue is ~44 m from the window: close enough to read cars and palm trunks from above, far enough to sit below the sill's view cone. */
export const AVENUE_Z0 = -47
export const AVENUE_SPACING = 109
export const avenueZ = (k: number) => AVENUE_Z0 - AVENUE_SPACING * k
export const avenueType = (k: number) => (k === 0 ? MAJOR : MINOR)

/** Cross streets run along z, every CROSS_SPACING metres. Cross street 0 meets the major avenue right in front of the window. */
export const CROSS_X0 = -58
export const CROSS_SPACING = 110
export const crossX = (k: number) => CROSS_X0 + CROSS_SPACING * k
export const CROSS_TYPE = MINOR

/** Part of the world that gets detailed streets, lamps, cars and trees. Everything further out is skyline only. */
export const NEAR_FIELD = { xMin: -470, xMax: 175, zMax: -14, zMin: -300 }

/** The moon: azimuth is measured from straight ahead (-z) towards the left (-x) as seen from the room. */
export const MOON = { azDeg: 28, elDeg: 8.3, radiusDeg: 1.35 }

export const DEG = Math.PI / 180

/** Small deterministic PRNG so the city is identical on every load. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type CityTier = 'high' | 'low'
