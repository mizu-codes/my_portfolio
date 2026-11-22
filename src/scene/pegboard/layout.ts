/**
 * Pegboard grid and hook positions.
 *
 * Everything in the pegboard group is in metres, in the board's own frame: origin at the board's centre on the wall
 * surface, +x to the right, +y up, +z out into the room. The group itself is placed at PEGBOARD_POS (scene/layout.ts).
 */
export const BOARD_W = 1.3
export const COLS = 44
export const ROWS = 21
/** Hole pitch (m). The panel is exactly COLS x ROWS pitches, so the margin around the outer holes is half a pitch on every side. */
export const PITCH = BOARD_W / COLS
export const BOARD_H = ROWS * PITCH
/** Hole radius (m). */
export const HOLE_R = 0.0052
/** z of the panel's front face. The panel is a thin steel sheet with a return flange, standing this far off the wall. */
export const FRONT = 0.024
/** z of the centre line of every hook arm, i.e. where a hanging object's pivot sits. */
export const ARM_Z = FRONT + 0.017
/** Hook arm radius (m). */
export const ARM_R = 0.0056

export const holeX = (col: number) => -BOARD_W / 2 + (col + 0.5) * PITCH
export const holeY = (row: number) => BOARD_H / 2 - (row + 0.5) * PITCH

export type Orient = 'v' | 'h'
export interface HookSpec {
  /** 'v': two prongs one above the other, the arm leaves from the lower one (col, row). 'h': two prongs side by side in (col, row) and (col + 1, row); the arm leaves from between them. */
  col: number
  row: number
  orient: Orient
}

/** Where the arm leaves the panel (x, y), which is also the x, y of the pivot of anything hung on it. */
export const hookAnchor = (h: HookSpec): [number, number] =>
  h.orient === 'h' ? [(holeX(h.col) + holeX(h.col + 1)) / 2, holeY(h.row)] : [holeX(h.col), holeY(h.row)]

/**
 * Every hook on the board. Hanging objects are children of a pivot group placed at `hookAnchor(spec)` and ARM_Z, so rotating that
 * group about z (side-to-side swing) or x (forward-back swing) moves the object about the real hook.
 */
export const HOOKS = {
  /** Two ID-card hooks fixed in the second and third hole rows from the top edge. */
  idMizhan: { col: 6, row: 2, orient: 'v' },
  idOlyvex: { col: 12, row: 2, orient: 'v' },
  /** Centred on the board: the pair of holes at columns 21 and 22 straddles x = 0. */
  headphones: { col: 21, row: 7, orient: 'h' },
  cable: { col: 32, row: 11, orient: 'v' },
  keys: { col: 37, row: 7, orient: 'v' },
  charm: { col: 41, row: 9, orient: 'v' },
} as const satisfies Record<string, HookSpec>
