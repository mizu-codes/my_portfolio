import type { Vec3 } from './parts'

/** World units are metres. Camera looks from +z toward the window on the back wall (-z). */
export const ROOM = { halfWidth: 3.6, height: 3.4, backZ: -3.2, frontZ: 5.5 } as const
export const WINDOW = { halfWidth: 1.5, bottom: 1.1, top: 2.9 } as const

export const DESK_TOP = 0.76
/** Slightly wider than before so the larger monitor, the robot's workspace and the lamp all fit with room to spare. */
export const DESK = { width: 2.2, depth: 0.9 } as const
/**
 * World x of the desk's centre. Stage 7.1 moves the whole workstation (desk, rug, robot, chair, keyboard, monitor, lamp and desk props)
 * left of the room's centre, closer to the original design. Change this one number to slide everything together.
 */
export const DESK_X = -0.35
export const DESK_POS: Vec3 = [DESK_X, 0, 0]
/** Converts an x position measured from the desk's centre into world x. */
export const onDesk = (x: number) => DESK_X + x

/**
 * Working setup. The robot sits at the keyboard; the monitor stands in front of it, a little to the visitor's left, turned so
 * its screen faces the robot. The back (ring logo and the PROJECTS label) faces the visitor, and the robot's head and
 * antennae stay visible above and to the right of the monitor.
 */
export const ROBOT_POS: Vec3 = [onDesk(0.15), 0, -0.72]
export const CHAIR_POS: Vec3 = [ROBOT_POS[0], 0, ROBOT_POS[2] - 0.1]
export const KEYBOARD_POS: Vec3 = [ROBOT_POS[0], DESK_TOP, -0.22]

/**
 * Monitor, in metres, in its own local space: the screen faces -z, the rear casing and label face +z.
 * `position` is the centre of the stand's base on the desk. `yaw` turns the screen towards the robot (negative = towards the
 * visitor's right on the back side, i.e. the screen swings to face the robot). Tune sizes here; Desk.tsx builds from this block.
 */
export const MONITOR = {
  position: [onDesk(-0.5), DESK_TOP, 0.12] as Vec3,
  yaw: -0.48,
  /** Distance from the desk to the bottom edge of the panel. */
  clearance: 0.09,
  /** Front panel (screen side). `frame` is the border width around the lit screen. */
  panel: { width: 1.04, height: 0.59, depth: 0.028, radius: 0.013, frame: 0.015 },
  /** Rear casing, slightly smaller than the panel so the monitor reads as a slab with a tapered back. */
  rear: { width: 0.9, height: 0.485, depth: 0.054, radius: 0.048 },
  /** Foot plate, neck and hinge block. */
  stand: { baseWidth: 0.38, baseDepth: 0.23, baseHeight: 0.017, neckWidth: 0.076, neckDepth: 0.034, hingeRadius: 0.022 },
  /** Rear label. `y` is the label centre relative to the panel centre; `width` is the plane width in metres. */
  label: { text: 'PROJECTS', width: 0.56, y: -0.028, logoY: 0.102, logoRadius: 0.057 },
} as const

const monitorPanelCentreY = MONITOR.position[1] + MONITOR.clearance + MONITOR.panel.height / 2
/** Centre of the lit screen in world space, and the direction it faces (towards the robot). */
export const MONITOR_PANEL_CENTRE_Y = monitorPanelCentreY
export const MONITOR_FACING: [number, number] = [-Math.sin(MONITOR.yaw), -Math.cos(MONITOR.yaw)]
export const MONITOR_POS: Vec3 = MONITOR.position
export const MONITOR_YAW = MONITOR.yaw

/**
 * The robot looks toward its monitor (negative = toward the visitor's left). Kept modest so the face still reads
 * from the default camera.
 */
export const ROBOT_HEAD_YAW = -0.3

/**
 * Body proportions, metres, in robot-local space (origin on the floor under the robot, +z forward toward the desk,
 * +x the visitor's right when seen from the front). Seat top is 0.54. Arms are solved with two-bone IK in robotPose.ts, so
 * moving `wrist` or the shoulder re-poses the arm and the elbow automatically.
 */
export const ROBOT_BODY = {
  hipY: 0.6,
  hipX: 0.1,
  pelvis: { width: 0.33, height: 0.13, depth: 0.25, radius: 0.055, y: 0.6 },
  waistY: 0.69,
  /** Chest spans y 0.71 to 1.00. Slightly bigger than Stage 7 so the torso feels more substantial next to the head. */
  chest: { width: 0.38, height: 0.29, depth: 0.27, radius: 0.065, y: 0.855 },
  /** Shoulder yoke: its top (y 1.0075) is where the short neck starts. */
  yoke: { width: 0.41, height: 0.065, depth: 0.22, radius: 0.028, y: 0.975 },
  /** Short neck. Only about 5 cm shows between the yoke and the head casing (casing bottom is at 1.06). */
  neck: { radius: 0.04, bottomY: 0.98, topY: 1.09, ringYs: [1.026, 1.046] as number[] },
  shoulder: { x: 0.24, y: 0.945, z: 0, capRadius: 0.062 },
  upperArm: 0.26,
  foreArm: 0.26,
  armRadius: 0.038,
  /** Hands are drawn larger than the arm they sit on, so the typing reads from the default camera. Scales the hand only. */
  handScale: 1.45,
  /** How much of the forearm's sideways angle the hand follows (0 = hands point straight ahead, 1 = in line with the forearm). Keeps the two hands from crossing. */
  handYawFactor: 0.35,
  /** Wrist target relative to the robot origin, per side (x is mirrored). The hand continues past it, over the keys. */
  wrist: [0.125, 0.862, 0.372] as Vec3,
  /** Direction the elbow wants to swing (x is mirrored): out and down. */
  elbowHint: [0.7, -0.8, -0.15] as Vec3,
  /** How far the hand pitches down past the forearm direction (rad), so the fingertips reach the keys. */
  handPitch: 0.42,
  thighRadius: 0.062,
  shinRadius: 0.05,
  knee: [0.1, 0.6, 0.36] as Vec3,
  ankle: [0.1, 0.085, 0.42] as Vec3,
}

/**
 * Screen-faced head. Metres, in head-local space: +x is the robot's left, +y up, +z the front of the face.
 * Everything RobotHead.tsx builds comes from this block, so proportions can be tuned here without touching geometry code.
 * Keep the bezel inside the casing's flat front area: `casing.width - 2 * casing.radius` by `casing.height - 2 * casing.radius`
 * (RobotHead warns in dev if it does not fit).
 */
export const ROBOT_HEAD = {
  /** Neck pivot, relative to ROBOT_POS. The casing bottom sits at 1.06 and overlaps the neck top (neck.topY is 1.09). */
  position: [0, 1.245, 0] as Vec3,
  /** Resting pitch (rad). Positive tips the face down a little, towards the desk and monitor. */
  pitch: 0.04,
  casing: { width: 0.43, height: 0.37, depth: 0.265, radius: 0.058 },
  /** Dark frame around the glass. `offsetY` moves the whole display up (+) or down (-) on the front face. */
  bezel: { width: 0.3, height: 0.225, radius: 0.047, thickness: 0.006, offsetY: 0.01 },
  /** Flat black glass, centred on the bezel. */
  screen: { width: 0.268, height: 0.19, radius: 0.038 },
  /** Eyes: `spacing` is centre to centre, `offsetY` is relative to the glass centre. */
  eyes: { width: 0.053, height: 0.076, radius: 0.023, spacing: 0.122, offsetY: 0.008 },
  /** Side speaker caps with a cyan ring, and a small status LED under the bezel. */
  accents: { ringRadius: 0.036, ringTube: 0.0035, ledWidth: 0.05, ledHeight: 0.006 },
  /** Ear modules on each side of the casing. */
  ear: { radius: 0.055, depth: 0.032, rimTube: 0.008 },
  /** Antennae: wire radius, base spacing either side of centre, and the curve (head-local x is mirrored per side). */
  antenna: {
    wire: 0.0022,
    tipRadius: 0.0105,
    baseX: 0.072,
    baseZ: -0.03,
    path: [[0, 0], [0.012, 0.055], [0.034, 0.108], [0.066, 0.152]] as [number, number][],
  },
}

/** Desk lamp: base on the desk, head aimed at a spot on the desk surface. */
export const LAMP = {
  base: [onDesk(-1.0), DESK_TOP, -0.33] as Vec3,
  head: [onDesk(-0.96), 1.2, -0.28] as Vec3,
  aim: [onDesk(-0.7), DESK_TOP, 0.1] as Vec3,
}

/** Wall pieces sit on the back-wall segments either side of the window. */
export const SHELF_POS: Vec3 = [-2.55, 0, ROOM.backZ]
export const PEGBOARD_POS: Vec3 = [2.45, 2.05, ROOM.backZ]
/** Right side of the room: human sofa against the wall, coffee table in front, small cat bed on the floor. */
export const SOFA_POS: Vec3 = [3.13, 0, -1.85]
export const COFFEE_TABLE_POS: Vec3 = [1.95, 0, -1.85]
export const CAT_BED_POS: Vec3 = [2.25, 0, -0.05]
/** The rug follows the desk, sitting a little right of the desk's centre so the chair stays on it. */
export const RUG = { center: [onDesk(0.05), -0.25] as [number, number], size: [2.7, 2.1] as [number, number] }
export const CEILING_LIGHT_POS: Vec3 = [0, ROOM.height, -1.5]

export const CAMERA = {
  fov: 38,
  focus: [0.05, 1.24, -1.0] as Vec3,
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
