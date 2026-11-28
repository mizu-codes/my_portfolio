import type { TreeData } from './cityLayout'

/**
 * The palm that stood on the roof of the low block straight in front of the studio tower (centre of the exterior view, roof about 13 m under
 * the studio floor). It is switched off in the generated layout (kept in the list but not drawn) instead of changing the generator or the list, so no random draw and
 * no index changes and every other tree, building, lamp and car stays exactly where it was. Only rooftop palms (those with an explicit base height) within 3 m of this spot go.
 */
const ROOFTOP_PALM = { x: 8.6, z: -24.1, radius: 3 }

export function withoutCentralRooftopPalm(trees: TreeData[]): TreeData[] {
  return trees.map((t) => (t.y !== undefined && t.y < 0 && Math.hypot(t.x - ROOFTOP_PALM.x, t.z - ROOFTOP_PALM.z) < ROOFTOP_PALM.radius ? { ...t, hidden: true } : t))
}
