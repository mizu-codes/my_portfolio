import { GROUND_Y, mulberry32 } from './cityConfig'
import type { TreeData } from './cityLayout'

/** Height (m) of the model as exported (its bounding box is 0 .. 17.78 m on Y, with the trunk base at the origin). */
export const PALM_NATIVE_HEIGHT = 22.781
/** Palm height (m) = layout tree scale x this, then varied per palm and capped near the window (see palmHeight). */
const HEIGHT_PER_SCALE = 11.5
/** Tallest a street-level palm may become after its trunk has been lengthened (royal palms reach 25 m and more). */
export const MAX_PALM_HEIGHT = 26

/** One palm instance, in the exact terms PalmTrees feeds the GPU: position, Euler (YXZ) lean/heading, crown scale, width scale, extra trunk. */
export interface PalmInstance {
  x: number; y: number; z: number
  rx: number; ry: number; rz: number
  /** Uniform size of the palm as modelled (drives the canopy height and the fronds). */
  scale: number
  /** Horizontal scale: frond spread (and the trunk girth, which is a thin column at these scales). */
  wide: number
  /** Metres (native model units) added to the trunk only. */
  extra: number
  /** Overall height in metres. */
  height: number
}

/**
 * Palm height in metres. Layout trees can carry an explicit height (`h`); otherwise it comes from the layout's tree size,
 * varied per tree and capped near the window.
 */
export function palmHeight(t: TreeData, rnd: () => number) {
  if (t.h !== undefined) return t.h * (0.92 + rnd() * 0.16)
  const h = t.s * HEIGHT_PER_SCALE * (0.82 + rnd() * 0.36)
  const dist = Math.hypot(t.x, t.z + 3.2)
  const cap = 8 + 8 * Math.min(Math.max((dist - 40) / 90, 0), 1)
  return Math.min(h, cap)
}

/**
 * All variation comes from a PRNG seeded by the tree's position, so the layout is deterministic. The order of the draws is fixed:
 * existing palms keep their heading, lean and jitter.
 *
 * Trunk: the trunk is stretched along its own axis and the whole canopy lifted by `extra` (the fronds are never scaled for height).
 *  - street-level palms grow 85-175 % of their crown height of extra trunk (was 60-120 %), up to MAX_PALM_HEIGHT, so they rise
 *    into the window instead of ending below the sill;
 *  - rooftop palms (t.y set) keep the old proportions, since their base is already high up;
 *  - a palm with `top` is lengthened until its apex sits at exactly that world height.
 */
export function placePalm(t: TreeData, i: number): PalmInstance {
  const rnd = mulberry32(Math.floor(t.x * 131 + t.z * 977 + i * 7919))
  const crownHeight = palmHeight(t, rnd)
  const scale = crownHeight / PALM_NATIVE_HEIGHT
  const baseY = t.y ?? GROUND_Y
  const growth = t.y === undefined ? 0.85 + rnd() * 0.9 : 0.6 + rnd() * 0.6
  const cap = t.y === undefined ? MAX_PALM_HEIGHT : 22
  let extraWorld = Math.min(crownHeight * growth, Math.max(cap - crownHeight, 0))
  if (t.top !== undefined) extraWorld = Math.max(t.top - baseY - crownHeight, 0)
  const wide = scale * (0.92 + rnd() * 0.18) * (t.fuller ?? 1)
  const rx = (rnd() - 0.5) * 0.07, ry = rnd() * Math.PI * 2, rz = (rnd() - 0.5) * 0.07 // up to ~2 degrees of lean, any heading
  return {
    x: t.x + (rnd() - 0.5) * 0.6, y: baseY, z: t.z + (rnd() - 0.5) * 0.6,
    rx, ry, rz, scale, wide, extra: extraWorld / scale, height: crownHeight + extraWorld,
  }
}
