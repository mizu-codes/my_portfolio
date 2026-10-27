import type { Vec3 } from './parts'

/** World units are metres. Camera looks from +z toward the window on the back wall (-z). */
export const ROOM = { halfWidth: 3.6, height: 3.4, backZ: -3.2, frontZ: 5.5 } as const
/** `centerX` is the window's world x. It sits left of the room's centre so the pegboard and speaker have room to its right on the same wall, fully inside the opening camera view. */
export const WINDOW = { centerX: -1.2, halfWidth: 1.5, bottom: 1.1, top: 2.9 } as const

export const DESK_TOP = 0.75
/**
 * Desk size. The reference desk measures about 1.8 : 1 (width : depth) from the slopes of its two visible edges; the
 * workstation cannot be that deep, so the length is cut to the shortest that still carries the monitor, keyboard, mouse,
 * lamp, notes, book and phone (they span x -0.97 … +0.84 m from the desk centre).
 * width: 2.20 m (was 2.90 m, which projected to a 5 : 1 bench running far toward the visitor). depth: 0.70 m, unchanged.
 */
export const DESK = {
  width: 2.50,
  depth: 0.80,
  /** Extra tabletop toward the visitor (+z), added to the FRONT only. The back edge stays at DESK_Z - depth/2, so the robot, monitor, keyboard and chair (all positioned from DESK_Z) do not move. */
  frontExtension: 0.35,
  /** Slab thickness (m). The tabletop's upper surface stays at DESK_TOP; the slab grows downward. Kept ≤ 0.08 so the robot's knees (top at 0.662 m) clear the underside. */
  topThickness: 0.08,
  /** Solid side supports: thickness, and how far each is inset from the slab's end so the top overhangs. */
  side: { thickness: 0.07, inset: 0.12 },
  /** Solid front panel: thickness, how far it is set back from the slab's front edge, and its gap above the floor. The back stays open for the robot's legs. */
  front: { thickness: 0.04, setback: 0.07, floorGap: 0.03 },
} as const
/**
 * World x of the desk's centre. Shifted left so the workstation sits toward the left-centre of
 * the room, giving the right-side camera view a clear diagonal look across the setup.
 */
export const DESK_X = -0.65
/** World z of the desk's centre. Negative = toward the back wall / window. */
export const DESK_Z = -1.2
export const DESK_POS: Vec3 = [DESK_X, 0, DESK_Z]
/** Converts an x position measured from the desk's centre into world x. */
export const onDesk = (x: number) => DESK_X + x

/**
 * Working setup — physically aligned column: robot, keyboard and monitor share the same world X
 * so the monitor is directly in front of the robot. The monitor screen faces the robot (-z from
 * monitor toward robot); the rear panel with the cyan emblem and PROJECTS label faces the visitor.
 * The robot's head yaw is calculated from the actual monitor position, not assumed to be zero.
 */
export const ROBOT_POS: Vec3 = [DESK_X, 0, DESK_Z - 0.58]
export const CHAIR_POS: Vec3 = [ROBOT_POS[0], 0, ROBOT_POS[2] - 0.01]
export const KEYBOARD_POS: Vec3 = [DESK_X, DESK_TOP, DESK_Z - 0.12]
/**
 * Mechanical keyboard GLB (public/models/mechanical_keyboard_web.glb, a Meshopt/WebP build of mechanical_keyboard.glb).
 * KEYBOARD_POS stays the anchor, so the mouse (placed from it) does not move. The model is measured at load and re-centred so its
 * footprint centre sits over KEYBOARD_POS with its case bottom on the desk; these three values only orient and place it.
 * - yaw: the model's own frame has the typing edge on +x and the function row on -x. A quarter turn about y makes the typing edge
 *   face -z (towards the robot) and the function row face +z (towards the monitor), with the keys' left-to-right along world x.
 * - scale: 1 is the model's real size, about 0.31 x 0.15 m (a compact 75% board). The robot's hands are drawn at 1.45x and are
 *   spaced for the old 0.44 m board, so 1.25 (about 0.39 x 0.18 m, still a compact board) lets every fingertip land on the alpha block
 *   instead of on the outer columns.
 * - offset (m, world): toward +z moves the board toward the monitor so the fingertips (z about DESK_Z - 0.06) rest over the home
 *   (Z/A) rows. The old procedural board was deeper and centred further back.
 */
export const KEYBOARD_MODEL = {
  yaw: Math.PI / 2,
  scale: 2.65,
  offset: [0, 0, 0.12] as Vec3,
} as const

/**
 * Monitor â public/models/pc_monitor.glb (see monitorModel.ts and Monitor.tsx). The real screen faces -z (toward the robot); the sculpted
 * rear, with its four-sided sloping casing and recessed flat centre panel, faces +z (toward the visitor).
 * Positioned at the SAME world X as the robot so they are physically aligned.
 * yaw: 0 means the screen faces straight toward -z, i.e., directly at the robot.
 * Built procedurally by scripts/build-monitor-glb.py (no original GLB required).
 * Casing 0.60 x 0.375 m (aspect ~1.60), clearance 0.090 m, GLB origin on the desk surface under the casing centre.
 */
/** Sideways shift of the monitor from the robot's centre line (m, negative = the visitor's left of the robot, as seen from the default camera). 0 puts it exactly in line with the robot. */
export const MONITOR_OFFSET_X = 0

export const MONITOR = {
  position: [DESK_X + MONITOR_OFFSET_X, DESK_TOP, DESK_Z + 0.45] as Vec3,
  yaw: 0,
  /** Monitor-space z of the casing's front (screen-side) face. 0 = screen flush with GLB z-origin (screen faces -z, toward robot). */
  frontZ: 0.000,
  /**
   * Measured on public/models/pc_monitor.glb (metres, monitor space; built by scripts/build-monitor-glb.py):
   * casing 0.60 x 0.375 m (aspect ~1.60), clearance 0.090 m above desk, four-sided sloping rear
   * (rim rear at z=0.030, flat panel at z=0.060).
   */
  casing: { width: 0.60, height: 0.375, clearance: 0.090, rimZ: 0.030, panelZ: 0.060 },
  /** Anchor for the OPEN PROJECTS pill (monitor space, x = visitor's right). Pill is no longer monitor-tracked. */
  hotspot: [0.25, 0.278, 0.065] as Vec3,
} as const

const monitorPanelCentreY = MONITOR.position[1] + MONITOR.casing.clearance + MONITOR.casing.height / 2
/** Centre of the lit screen in world space, and the direction it faces (towards the robot). */
export const MONITOR_PANEL_CENTRE_Y = monitorPanelCentreY
export const MONITOR_FACING: [number, number] = [-Math.sin(MONITOR.yaw), -Math.cos(MONITOR.yaw)]
export const MONITOR_POS: Vec3 = MONITOR.position
export const MONITOR_YAW = MONITOR.yaw
/** World position of the OPEN PROJECTS anchor: MONITOR.hotspot turned by the monitor's yaw and moved to the monitor's position. */
export const MONITOR_HOTSPOT: Vec3 = [
  MONITOR.position[0] + MONITOR.hotspot[0] * Math.cos(MONITOR.yaw) + MONITOR.hotspot[2] * Math.sin(MONITOR.yaw),
  MONITOR.position[1] + MONITOR.hotspot[1],
  MONITOR.position[2] - MONITOR.hotspot[0] * Math.sin(MONITOR.yaw) + MONITOR.hotspot[2] * Math.cos(MONITOR.yaw),
]

/**
 * Robot head resting yaw — calculated from actual monitor position relative to robot.
 * Because robot and monitor share the same X, headDx = 0 and headYaw = 0
 * (the robot looks straight forward, directly at the monitor). The formula is kept
 * general so that any future X offset will still produce the correct gaze direction.
 */
// Aim at the centre of the lit screen: the monitor's position pushed out along its facing direction to the casing's front face.
const headDx = MONITOR.position[0] + MONITOR_FACING[0] * -MONITOR.frontZ - ROBOT_POS[0]
const headDz = MONITOR.position[2] + MONITOR_FACING[1] * -MONITOR.frontZ - ROBOT_POS[2]
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
  chest: { width: 0.38, height: 0.33, depth: 0.27, radius: 0.065, y: 0.855 },
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
  wrist: [0.190, 0.862, 0.372] as Vec3,
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
  casing: { width: 0.40, height: 0.32, depth: 0.235, radius: 0.042 },
  /**
   * Display frame, layered from the outside in: a glossy black outer frame (`frameWidth` wide, `thickness` tall), a lower graphite step
   * (`stepWidth` wide, `stepThickness` tall), then the black glass sitting below the step, so the screen reads as inset. The outer
   * size must fit the flat part of the front face (casing minus its rounded edges). `offsetY` moves the whole display up (+) or down (-).
   */
  bezel: { width: 0.312, height: 0.216, radius: 0.028, thickness: 0.0065, offsetY: -0.008, /** Soft rounded edge on the frame layers (m); the outer size does not change. */ bevel: 0.0014, frameWidth: 0.008, stepWidth: 0.005, stepThickness: 0.0035 },
  /** Flat black glass, centred on the bezel. It equals the bezel minus both frame layers. */
  screen: { width: 0.286, height: 0.19, radius: 0.015 },
  /** Eyes: `spacing` is centre to centre, `offsetY` is relative to the glass centre. (Glass centre is -0.008, so the eyes sit at the same head-local height as before.) */
  eyes: { width: 0.053, height: 0.066, radius: 0.023, spacing: 0.142, offsetY: 0.038 },
  /**
   * Mouth: one short, thin horizontal capsule below the eyes. `offsetY` is relative to the glass centre. Its head-local height is
   * unchanged (-0.060): the top edge of the monitor, seen from the default camera, cuts across the glass a little below that, so
   * anything lower starts to be clipped by the monitor.
   */
  mouth: { width: 0.10, thickness: 0.010, offsetY: -0.052 },
  /** Cyan ring of the side modules. */
  accents: { ringRadius: 0.036, ringTube: 0.0035 },
  /** Ear modules on each side of the casing. */
  ear: { radius: 0.055, depth: 0.032, rimTube: 0.0055, /** Height (m) of the dark joint flange between the module and the casing. */ gasket: 0.005 },
  /**
   * Top plate: a slim dark strip that lies on the top face near the front edge and follows the rounded top-front edge of the casing
   * (`arcDeg` is how far it wraps down the curve). `width` is along x and is kept inside the flat part of the top so it never floats
   * over the rounded corners; `back` is its rear edge (head-local z); `sink` is how far it is buried in the casing.
   */
  plate: { width: 0.30, thickness: 0.0055, sink: 0.002, bevel: 0.0012, back: 0.048, arcDeg: 55 },
  /** Antennae: wire radius, base spacing either side of centre, and the stem (head-local x is mirrored per side). */
  antenna: {
    wire: 0.0028,
    tipRadius: 0.0118,
    baseX: 0.072,
    baseZ: -0.03,
    path: [[0, 0], [0.005, 0.055], [0.011, 0.108], [0.018, 0.158]] as [number, number][],
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
/** Pegboard (1.3 m wide) and the speaker ledge under it share this x. Moved in from 2.45 so the board's right edge (2.65 m) and the ledge are no longer cut off by the screen edge at the default three-quarter camera. */
export const PEGBOARD_POS: Vec3 = [1.4, 1.90, ROOM.backZ]
/** Points on the right-hand wall group (board's right edge with its LED outline, ledge's right end) that must stay on screen at the default camera. */
export const RIGHT_WALL_FIT: Vec3[] = [
  [PEGBOARD_POS[0] + 0.7, PEGBOARD_POS[1], ROOM.backZ],
  [PEGBOARD_POS[0] + 0.7, PEGBOARD_POS[1] + 0.5, ROOM.backZ],
  [PEGBOARD_POS[0] + 0.45, 1.0, ROOM.backZ + 0.22],
]
/** Right side of the room: human sofa against the wall, coffee table in front. */
export const SOFA_POS: Vec3 = [3.13, 0, -1.85]
export const COFFEE_TABLE_POS: Vec3 = [1.95, 0, -1.85]
/**
 * Small cat bed on the left side of the room, beside the desk's left-front corner.
 * Pushed slightly forward (higher Z) so it remains clearly visible from the low oblique camera.
 */
export const CAT_BED_POS: Vec3 = [-2.75, 0, -0.10]
/** The rug follows the desk, sitting slightly right of the desk's centre so the chair stays on it. */
export const RUG = { center: [DESK_X + 0.08, DESK_Z - 0.05] as [number, number], size: [4.2, 3.0] as [number, number] }
export const CEILING_LIGHT_POS: Vec3 = [0, ROOM.height, -1.5]

export const CAMERA = {
  fov: 50,
  /**
   * Look-at target: the middle of the workstation, a little above the desktop, so the monitor, robot and
   * keyboard sit in the lower-centre of the frame with the window and city above them.
   */
  focus: [-0.40, 0.80, -1.55] as Vec3,
  /**
   * Offset from focus to the default camera position — a close, elevated three-quarter view from the
   * visitor's right, like the reference: yaw ≈ 40° (right of the desk), pitch ≈ 22° (looking down onto
   * the desk and the robot's hands). Orbit distance ≈ 4.0 m.
   */
  offset: [2.70, 1.45, 2.67] as Vec3,
  /**
   * The camera looks this far (m) above the orbit pivot. The camera position is unchanged (so what hides what
   * stays the same); only the framing shifts, lifting the shelf, window and pegboard into view and trimming empty floor.
   */
  lookLift: 0.3,
  /**
   * The camera also looks this far (m) to the right of the orbit pivot. The camera position is unchanged; only the aim pans, which
   * slides the left-of-centre window and the pegboard/speaker group into the frame instead of letting the right wall run off the edge.
   */
  lookShiftX: 0.3,
  /** Share of the screen half-width the right-wall group may reach at the default camera (keeps a margin to the edge). */
  rightWallMargin: 0.94,
  /** Value `lookLift` eases to at the end of the downward drag (negative = aiming below the pivot, at the desk, hands, chair and rug). */
  lookLiftDown: -0.2,
  /** Horizontal drag range (rad) relative to the base yaw. */
  minYaw: -1.0,
  maxYaw: 0.35,
  /** Keep the camera inside the room's side walls (|x| <= 3.4 m). */
  maxCameraX: 3.8,
  /** Keeps the camera safely below the ceiling (3.4 m). The pitch range is derived from this, so the camera never has to be clamped (which would silently change the orbit distance). */
  maxCameraY: 3.8,
  /** Half-width (m) that must stay visible at the focus point; narrow screens pull the camera back to fit it. */
  fitHalfWidth: 1.5,
  /** Tighter fit for phone-shaped screens (aspect ≤ 0.6). */
  fitHalfWidthPhone: 1.2,
  /** On portrait screens the focus drops this far so the desk sits above the bottom UI. */
  portraitFocusDrop: 0.35,
  /** Lowest camera pitch relative to the start (rad). Negative lowers the camera towards the floor-level view. */
  minPitch: -0.12,
  /**
   * Maximum downward-tilt offset (rad), an upper bound only. The usable limit is the smaller of this and
   * the ceiling-safe pitch computed in cameraPath.ts.
   */
  maxPitch: 0.65,
}