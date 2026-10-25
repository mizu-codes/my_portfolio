import type { Vec3 } from './parts'

/** World units are metres. Camera looks from +z toward the window on the back wall (-z). */
export const ROOM = { halfWidth: 3.6, height: 3.4, backZ: -3.2, frontZ: 5.5 } as const
export const WINDOW = { halfWidth: 1.5, bottom: 1.1, top: 2.9 } as const

export const DESK_TOP = 0.76
export const DESK = { width: 1.96, depth: 0.9 } as const

/**
 * Working setup: the monitor sits in front of the robot, a little left of it, angled so the screen
 * faces the robot. The back (with the ring logo) faces the visitor and the robot's head is visible beside/above it.
 */
export const MONITOR_POS: Vec3 = [-0.3, DESK_TOP, 0.1]
export const MONITOR_SCALE = 0.72
export const MONITOR_YAW = -0.45
export const KEYBOARD_POS: Vec3 = [0.25, DESK_TOP, -0.25]
export const CHAIR_POS: Vec3 = [0.25, 0, -0.95]
export const ROBOT_POS: Vec3 = [0.25, 0, -0.85]
/** The robot looks toward its monitor (negative = toward the visitor's left). */
export const ROBOT_HEAD_YAW = -0.4

/** Desk lamp: base on the desk, head aimed at a spot on the desk surface. */
export const LAMP = {
  base: [-0.86, DESK_TOP, -0.32] as Vec3,
  head: [-0.8, 1.2, -0.2] as Vec3,
  aim: [-0.5, DESK_TOP, 0.06] as Vec3,
}

/** Wall pieces sit on the back-wall segments either side of the window. */
export const SHELF_POS: Vec3 = [-2.55, 0, ROOM.backZ]
export const PEGBOARD_POS: Vec3 = [2.45, 2.05, ROOM.backZ]
/** Right side of the room: human sofa against the wall, coffee table in front, small cat bed on the floor. */
export const SOFA_POS: Vec3 = [3.13, 0, -1.85]
export const COFFEE_TABLE_POS: Vec3 = [1.95, 0, -1.85]
export const CAT_BED_POS: Vec3 = [2.25, 0, -0.05]
export const RUG = { center: [0.1, -0.25] as [number, number], size: [2.7, 2.1] as [number, number] }
export const CEILING_LIGHT_POS: Vec3 = [0, ROOM.height, -1.5]

export const CAMERA = {
  fov: 38,
  focus: [0, 1.2, -1.0] as Vec3,
  /** Offset from focus to camera at a 16:9 viewport. The orbit radius never shrinks while dragging. */
  offset: [0, 0.8, 5.9] as Vec3,
  /** Moderate horizontal range (rad) either side of the default view. */
  minYaw: -0.45,
  maxYaw: 0.45,
  /** On narrow screens the radius is larger, so the yaw range is reduced to keep the camera at |x| <= this. */
  maxCameraX: 3.0,
  /** Keeps the camera below the ceiling (3.4) when a narrow screen pulls it far back. */
  maxCameraY: 2.9,
  /** Half-width (m) that must stay visible at the focus point; narrow screens pull the camera back to fit it. */
  fitHalfWidth: 1.6,
  /** Tighter fit for phone-shaped screens (aspect <= 0.6) so the robot and monitor stay readable. */
  fitHalfWidthPhone: 1.3,
  /** On portrait screens the focus drops this far so the desk sits above the bottom UI. */
  portraitFocusDrop: 0.35,
  minPitch: -0.04,
  maxPitch: 0.12,
}
