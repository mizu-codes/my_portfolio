import type { Vec3 } from './parts'

/** World units are metres. Camera looks from +z toward the window on the back wall (-z). */
export const ROOM = { halfWidth: 3.6, height: 3.4, backZ: -3.2, frontZ: 5.5 } as const
export const WINDOW = { halfWidth: 1.5, bottom: 1.1, top: 2.9 } as const

export const DESK_TOP = 0.76
/**
 * Desk size — wider and shallower than before to match the reference's wide platform silhouette.
 * width: 2.70 m (wider than 2.3, desk spans more of the room width in the diagonal view).
 * depth: 0.72 m (shallower than 0.95, gives the low sleek platform look of the reference).
 */
export const DESK = { width: 2.70, depth: 0.72 } as const
/**
 * World x of the desk's centre. Shifted left so the workstation sits toward the left-centre of
 * the room, giving the right-side camera view a clear diagonal look across the setup.
 */
export const DESK_X = -0.55
/** World z of the desk's centre. Negative = toward the back wall / window. */
export const DESK_Z = -1.35
export const DESK_POS: Vec3 = [DESK_X, 0, DESK_Z]
/** Converts an x position measured from the desk's centre into world x. */
export const onDesk = (x: number) => DESK_X + x

/**
 * Working setup — physically aligned column: robot, keyboard and monitor share the same world X
 * so the monitor is directly in front of the robot. The monitor screen faces the robot (-z from
 * monitor toward robot); the rear panel with the cyan emblem and PROJECTS label faces the visitor.
 * The robot's head yaw is calculated from the actual monitor position, not assumed to be zero.
 */
export const ROBOT_POS: Vec3 = [DESK_X, 0, DESK_Z - 0.60]
export const CHAIR_POS: Vec3 = [ROBOT_POS[0], 0, ROBOT_POS[2] - 0.10]
export const KEYBOARD_POS: Vec3 = [DESK_X, DESK_TOP, DESK_Z - 0.12]

/**
 * Monitor — modern premium desktop display. Screen faces -z (toward the robot); rear faces +z
 * (toward the visitor). Positioned at the SAME world X as the robot so they are physically aligned.
 * yaw: 0 means the screen faces straight toward -z, i.e., directly at the robot.
 * Panel height 0.56 m — keeps proportions realistic while allowing the robot's head to be
 * visible above and to the right of the monitor from the default oblique camera.
 * Monitor pushed 0.10 m further forward (DESK_Z + 0.22) to create clear space from robot body.
 * PROJECTS label and cyan emblem on the rear panel face the visitor.
 */
export const MONITOR = {
  position: [DESK_X, DESK_TOP, DESK_Z + 0.22] as Vec3,
  yaw: 0,
  /** Distance from the desk to the bottom edge of the panel. */
  clearance: 0.06,
  /** Front panel (screen side). `frame` is the border width around the lit screen. */
  panel: { width: 1.04, height: 0.56, depth: 0.028, radius: 0.013, frame: 0.015 },
  /** Rear casing, slightly smaller than the panel so the monitor reads as a slab with a tapered back. */
  rear: { width: 0.90, height: 0.46, depth: 0.054, radius: 0.048 },
  /** Foot plate, neck and hinge block. */
  stand: { baseWidth: 0.36, baseDepth: 0.22, baseHeight: 0.017, neckWidth: 0.076, neckDepth: 0.034, hingeRadius: 0.022 },
  /** Rear label: PROJECTS text and cyan circular emblem on the visitor-facing panel. */
  label: { text: 'PROJECTS', width: 0.52, y: -0.04, logoY: 0.06, logoRadius: 0.065 },
} as const

const monitorPanelCentreY = MONITOR.position[1] + MONITOR.clearance + MONITOR.panel.height / 2
/** Centre of the lit screen in world space, and the direction it faces (towards the robot). */
export const MONITOR_PANEL_CENTRE_Y = monitorPanelCentreY
export const MONITOR_FACING: [number, number] = [-Math.sin(MONITOR.yaw), -Math.cos(MONITOR.yaw)]
export const MONITOR_POS: Vec3 = MONITOR.position
export const MONITOR_YAW = MONITOR.yaw

/**
 * Robot head resting yaw — calculated from actual monitor position relative to robot.
 * Because robot and monitor share the same X, headDx = 0 and headYaw = 0
 * (the robot looks straight forward, directly at the monitor). The formula is kept
 * general so that any future X offset will still produce the correct gaze direction.
 */
const headDx = MONITOR.position[0] - ROBOT_POS[0]
const headDz = MONITOR.position[2] - ROBOT_POS[2]
export const ROBOT_HEAD_YAW = Math.atan2(headDx, headDz)

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
  /** Short neck. */
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
 */
export const ROBOT_HEAD = {
  /** Neck pivot, relative to ROBOT_POS. */
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
  base: [DESK_X - 0.80, DESK_TOP, DESK_Z - 0.30] as Vec3,
  head: [DESK_X - 0.75, 1.20, DESK_Z - 0.25] as Vec3,
  aim: [DESK_X - 0.50, DESK_TOP, DESK_Z + 0.10] as Vec3,
}

/** Left-side wall display unit and wall pieces. */
export const SHELF_POS: Vec3 = [-3.45, 0, -1.85]
export const SHELF_ROT: Vec3 = [0, Math.PI / 2, 0]
export const PEGBOARD_POS: Vec3 = [2.45, 2.05, ROOM.backZ]
/** Right side of the room: human sofa against the wall, coffee table in front. */
export const SOFA_POS: Vec3 = [3.13, 0, -1.85]
export const COFFEE_TABLE_POS: Vec3 = [1.95, 0, -1.85]
/**
 * Small cat bed on the left side of the room, beside the desk's left-front corner.
 * Pushed slightly forward (higher Z) so it remains clearly visible from the low oblique camera.
 */
export const CAT_BED_POS: Vec3 = [-1.85, 0, -0.70]
/** The rug follows the desk, sitting slightly right of the desk's centre so the chair stays on it. */
export const RUG = { center: [DESK_X + 0.10, DESK_Z - 0.20] as [number, number], size: [2.9, 2.0] as [number, number] }
export const CEILING_LIGHT_POS: Vec3 = [0, ROOM.height, -1.5]

export const CAMERA = {
  fov: 52,
  /**
   * Look-at target: focused on the workstation at just below monitor height.
   * Slightly right of desk centre so the desk and robot frame well from the diagonal view.
   */
  focus: [-0.10, 0.95, -1.35] as Vec3,
  /**
   * Offset from focus to the default camera position.
   * Places the camera on the RIGHT side of the room at a LOW oblique angle — matching
   * Image 3's cinematic three-quarter view.
   * baseYaw ≈ 37°, basePitch ≈ 4° (nearly horizontal, just slightly elevated).
   * World camera pos ≈ [2.4, 1.25, 1.95].
   */
  offset: [2.50, 0.30, 3.30] as Vec3,
  /**
   * Horizontal drag range (rad) relative to the base yaw.
   * minYaw=-1.0: dragging right rotates the camera left/front to reach Image 4's frontal view.
   * maxYaw=0.15: small headroom rightward from the default right-side start.
   */
  minYaw: -1.0,
  maxYaw: 0.15,
  /** Keep camera within the room walls (|x| <= 3.4m). */
  maxCameraX: 3.4,
  /** Keeps camera safely below the ceiling (3.4m) when tilting upward into overhead view. */
  maxCameraY: 3.3,
  /** Half-width (m) that must stay visible at the focus point; narrow screens pull the camera back to fit it. */
  fitHalfWidth: 1.5,
  /** Tighter fit for phone-shaped screens (aspect ≤ 0.6). */
  fitHalfWidthPhone: 1.2,
  /** On portrait screens the focus drops this far so the desk sits above the bottom UI. */
  portraitFocusDrop: 0.35,
  /** Pitch limits (rad). Negative = camera tilts up (looks toward ceiling). */
  minPitch: -0.10,
  /**
   * Maximum downward pitch offset (rad). Dragging downward tilts the camera down to reveal
   * the desktop, keyboard, robot hands, chair and rug (matching Image 4).
   */
  maxPitch: 0.65,
}
