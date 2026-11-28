import type { Vec3 } from './parts'

/**
 * Optional inspection cameras, selected with `?view=<name>` in the address bar. Without the parameter nothing here has any effect and the
 * visitor gets the normal drag-to-look camera. They exist so every wall, the door, the outside of the building and the cut-away plan can be
 * looked at (and tested) from outside the normal camera range. The studio geometry is the same in every view.
 */
export interface InspectPose { position: Vec3; target: Vec3; fov: number }

const POSES: Record<string, InspectPose> = {
  /** Standing in the doorway, looking into the studio the way a visitor walks in. */
  entrance: { position: [-2.35, 1.6, 3.3], target: [-0.6, 0.95, -1.6], fov: 58 },
  /** From beside the desk, looking back at the entrance wall with the door and its fairy lights. */
  door: { position: [0.9, 1.45, -0.4], target: [-2.35, 1.35, 3.5], fov: 60 },
  /** Straight-on, the whole entrance wall corner to corner. */
  entranceWall: { position: [0, 1.45, -0.2], target: [0, 1.5, 3.5], fov: 66 },
  /** The door's lever handle and the clean hinge edge, close up. */
  doorHardware: { position: [-2.3, 1.2, 2.45], target: [-3.2, 1.05, 3.5], fov: 38 },
  /** The left corner: lamp, door casing and the first scallops of the lights. */
  lampCorner: { position: [-1.3, 1.45, 1.6], target: [-3.5, 1.5, 3.5], fov: 55 },
  /** Same wall, closer. */
  doorClose: { position: [-1.4, 1.5, 1.7], target: [-2.35, 1.65, 3.5], fov: 55 },
  /** The left (shelf) and right (sofa) walls from the middle of the room. */
  left: { position: [1.2, 1.5, 0.8], target: [-4, 1.4, -0.6], fov: 70 },
  right: { position: [-1.5, 1.5, 0.8], target: [4, 1.3, -0.8], fov: 70 },
  /** From the street side, above the roofs in front of the window: the penthouse on its tower. */
  outside: { position: [30, 6, -50], target: [0, -7, 0], fov: 46 },
  /** From behind and above: tower, roof terrace and the studio's rear wall and door. */
  outsideRear: { position: [-24, 9, 34], target: [0, -6, 0.5], fov: 50 },
  /** Whole tower from the side, ground to roof. */
  outsideSide: { position: [-55, -6, -2], target: [0, -8, 0.5], fov: 44 },
  /** Roof taken off: all four walls and the whole interior from above. */
  cutaway: { position: [0, 11.5, 8.5], target: [0, 0, 0.2], fov: 55 },
  cutawayLow: { position: [7.5, 6.5, 8.5], target: [0, 0.6, -0.2], fov: 55 },
}

const name = typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('view') ?? ''

export const inspectView = {
  name,
  pose: POSES[name] as InspectPose | undefined,
  /** The roof and the ceiling are left out so the cut-away views can see inside. */
  cutaway: name.startsWith('cutaway'),
}
