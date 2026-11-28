import { BUILDING, ROOM, WALL_T } from '../layout'
import { GROUND_Y } from './cityConfig'
import type { BuildingData } from './cityLayout'

/** Outer footprint of the tower that carries the studio (m). The window side is flush with the studio's outer front face; the other three sides carry the roof terrace. */
export const TOWER = (() => {
  const halfW = ROOM.halfWidth + WALL_T + BUILDING.terrace
  const zFront = ROOM.backZ - WALL_T
  const zRear = ROOM.frontZ + WALL_T + BUILDING.terrace
  return { halfW, zFront, zRear, depth: zRear - zFront, midZ: (zFront + zRear) / 2, top: -BUILDING.slab }
})()

/**
 * The supporting building, as one more block of the city: the same procedural facade shader as every neighbour (window grid, lit flats,
 * balconies, slab lines), standing on the street (GROUND_Y) and rising to the underside of the penthouse's floor slab. It is appended after
 * the city has been generated, so no existing building, tree, lamp or car moves.
 */
export function studioTower(): BuildingData {
  return {
    x: 0, z: TOWER.midZ, w: TOWER.halfW * 2, d: TOWER.depth, h: TOWER.top - GROUND_Y,
    style: 4, seed: 611, litProb: 0.5, sign: 0, tint: [0.2, 0.19, 0.2], warm: 0.85,
  }
}
