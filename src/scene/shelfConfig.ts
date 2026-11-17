import { ROOM, SHELF_POS } from './layout'

/**
 * The floating shelf on the left wall. One place for its dimensions, so Shelf.tsx, Lighting.tsx and blender/bake_shelf_wall.py
 * (which must use the same numbers) cannot drift apart. Metres. Shelf-local frame: origin on the wall at the middle of the
 * slab's TOP surface, +x along the wall (the visitor's right), +y up, +z out into the room.
 */
export const SHELF = {
  /** Height of the slab's top surface. Unchanged from the previous shelf. */
  y: 1.28,
  /**
   * Centre along the wall (world z). The slab is now 1.5 m long, so the centre moves 0.2 m away from the camera (from -1.75 to -1.95):
   * it runs from z = -2.70 to -1.20, which keeps its near end inside the default view and leaves 0.5 m to the back corner.
   */
z: SHELF_POS[2] - 0.1 + 0.6,
  /** Length: 1.5 m (was 0.72 m). */
  length: 1.8,
  /** Depth: a touch deeper (was 0.27) because the books are drawn 11% larger and the deepest now measures 0.253 m. */
  depth: 0.40,
  thickness: 0.036,
  /** World x of the wall face the shelf sits against (nudged 2 mm into the room to avoid z-fighting with the wall). */
  wallX: -ROOM.halfWidth + 0.002,
} as const

/** Warm white of the LED strip, about 2800 K. */
export const LED_WARM = '#f79c46'

/**
 * The patch of wall a baked lightmap (blender/bake_shelf_wall.py) covers, in shelf-local metres: x from -width/2 to width/2, y from
 * `bottom` to `top`. Must match the constants at the top of that script.
 */
export const WALL_BAKE = {
  width: SHELF.length + 0.8,
  top: 0.1,
  bottom: -SHELF.thickness - 1.4,
} as const
