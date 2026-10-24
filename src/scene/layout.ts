import type { Vec3 } from './parts'

/** World units are metres. Camera looks from +z toward the window on the back wall (-z). */
export const ROOM = { halfWidth: 3.6, height: 3.4, backZ: -3.2, frontZ: 5.5 } as const
export const WINDOW = { halfWidth: 1.5, bottom: 1.1, top: 2.9 } as const

export const DESK_TOP = 0.76
/** ~18% smaller than Stage 1 (2.4 x 1.1). */
export const DESK = { width: 1.96, depth: 0.9 } as const

export const MONITOR_POS: Vec3 = [-0.5, DESK_TOP, 0.1]
export const MONITOR_SCALE = 0.92
/** Negative yaw turns the screen toward the robot, leaving the back mostly facing the visitor. */
export const MONITOR_YAW = -0.45
export const KEYBOARD_POS: Vec3 = [0.25, DESK_TOP, -0.25]
export const CHAIR_POS: Vec3 = [0.25, 0, -0.95]
export const ROBOT_POS: Vec3 = [0.25, 0, -0.85]
/** The robot's head turns toward the monitor (negative = toward the visitor's left). */
export const ROBOT_HEAD_YAW = -0.3

/** Wall-mounted items sit on the back-wall segments either side of the window. */
export const SHELF_POS: Vec3 = [-2.55, 0, ROOM.backZ]
export const PEGBOARD_POS: Vec3 = [2.45, 2.05, ROOM.backZ]
export const SOFA_POS: Vec3 = [3.1, 0, -1.6]

export const CAMERA = {
  fov: 38,
  focus: [0, 1.2, -1.0] as Vec3,
  /** Offset from focus to camera at a 16:9 viewport. */
  offset: [0, 0.8, 5.9] as Vec3,
  maxYaw: 0.28,
  minPitch: -0.06,
  maxPitch: 0.1,
}
