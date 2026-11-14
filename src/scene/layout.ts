import type { Vec3 } from './parts'
import { lampPlane } from './lampModel'

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
  frontExtension: 0.33,
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
 * monitor toward robot); the rear panel with the PROJECTS label faces the visitor.
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
 *   offset[0] = -0.07 slides the board toward the robot's right (-x) so the F/J home keys, which sit about 0.07 m off the 75% board's
 *   centre toward the function-key end, land on the robot's centre line, between the two hands. The mouse is derived from the board's edge, so it moves with it.
 */
export const KEYBOARD_MODEL = {
  yaw: Math.PI / 2,
  scale: 2.60,
  offset: [-0.07, 0, 0.12] as Vec3,
} as const

/**
 * Monitor — public/models/monitor.glb (see monitorModel.ts and Monitor.tsx). The real screen faces -z (toward the robot); the rear shell
 * and its flat centre panel face +z (toward the visitor).
 * Positioned at the SAME world X as the robot so they are physically aligned.
 * yaw: 0 means the screen faces straight toward -z, i.e., directly at the robot.
 * The GLB is used as supplied; Monitor.tsx turns, scales and offsets it (MONITOR_MODEL) so its origin is on the desk under the casing centre.
 * Casing 0.847 x 0.515 m (aspect ~1.65), clearance 0.107 m, casing centre 0.364 m above the desk.
 */
/** Sideways shift of the monitor from the robot's centre line (m, negative = the visitor's left of the robot, as seen from the default camera). 0 puts it exactly in line with the robot. */
export const MONITOR_OFFSET_X = 0

export const MONITOR = {
  position: [DESK_X + MONITOR_OFFSET_X, DESK_TOP, DESK_Z + 0.45] as Vec3,
  yaw: 0,
  /** Monitor-space z of the casing's front (screen-side) face. 0 = screen flush with GLB z-origin (screen faces -z, toward robot). */
  frontZ: 0.000,
  /**
   * Measured on public/models/monitor.glb after MONITOR_MODEL scaling (metres, monitor space):
   * casing 0.847 x 0.515 m (aspect ~1.65), clearance 0.107 m above the desk (the model's own stand),
   * flat rear panel 0.594 x 0.361 m at z=0.092 (rimZ is the shoulder where the rear shell steps back from the bezel, z=0.029).
   */
  casing: { width: 0.847, height: 0.515, clearance: 0.107, rimZ: 0.029, panelZ: 0.092 },
  /** Anchor for the OPEN PROJECTS pill (monitor space, x = visitor's right). Pill is no longer monitor-tracked. */
  hotspot: [0.25, 0.364, 0.092] as Vec3,
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
  /**
   * Y of the hip joint centres above the floor. Seat top is 0.50 m (chair); hipY sits on top of it.
   * Raised to 0.62 so the pelvis clears the seat and the thighs are fully visible.
   */
  hipY: 0.60,
  hipX: 0.130,
  /**
   * Pelvic girdle: lofted shell. Wider to give a broad humanoid hip.
   * Made more prominent with deeper profile matching IMAGE 1 "Pelvis / Hip".
   */
  pelvis: {
    z: -0.012,
    rings: [
      [0.520, 0.130, 0.110, 2.3], [0.545, 0.172, 0.138, 2.6], [0.580, 0.195, 0.150, 2.8],
      [0.612, 0.185, 0.140, 2.6], [0.632, 0.148, 0.112, 2.4], [0.650, 0.108, 0.088, 2.1],
    ] as [number, number, number, number][],
  },
  hipJoint: { radius: 0.078, z: 0.068 },
  waist: { y: 0.718, radius: 0.058, bottomY: 0.680, topY: 0.772 },
  /**
   * Ribcage loft rings. Very wide chest (halfWidth 0.214) with flat front face.
   * High superellipse exponents 3.0–3.4 for the premium flat-fronted chest plating.
   */
  chest: {
    z: -0.014, bottomY: 0.732, topY: 1.090,
    rings: [
      [0.752, 0.100, 0.088, 2.2], [0.782, 0.132, 0.110, 2.6], [0.830, 0.168, 0.138, 3.0],
      [0.880, 0.198, 0.154, 3.2], [0.930, 0.214, 0.158, 3.4], [0.978, 0.212, 0.154, 3.3],
      [1.015, 0.192, 0.136, 3.0], [1.050, 0.154, 0.108, 2.5], [1.075, 0.110, 0.082, 2.1],
      [1.090, 0.082, 0.068, 2.0],
    ] as [number, number, number, number][],
  },
  neck: { radius: 0.045, bottomY: 1.032, topY: 1.138, ringYs: [1.070, 1.096] as number[] },
  /**
   * Shoulder joint centres. Narrower (x: 0.218) matching the reference's slim mechanical yoke.
   * capRadius 0.052 — smaller exposed ball joint, not a large rounded pod.
   */
  shoulder: { x: 0.218, y: 1.010, z: -0.052, capRadius: 0.052 },
  /**
   * Arm lengths. Sized to reach keyboard naturally with elbow properly bent.
   */
  upperArm: 0.310,
  foreArm: 0.310,
  /**
   * Arm shell radius — robust arms matching the reference's prominent cylindrical segments.
   */
  armRadius: 0.060,
  handScale: 1.55,
  handYawFactor: 0.10,
  /**
   * Wrist target in robot-local space (x mirrored per side).
   * y=0.775: just above desk (0.75), low enough that fingers press on keys.
   * z=0.430: further forward so fingertips reach the home-row keys.
   * x=0.195: wider spread matching the reference's natural arm splay.
   */
  wrist: [0.195, 0.775, 0.430] as Vec3,
  elbowHint: [0.38, -0.12, -0.20] as Vec3,
  handPitch: 0.26,
  /**
   * Thigh radius — very prominent oval thighs matching IMAGE 1.
   * WIDEN = 1.60 in RobotBody gives the characteristic seated-thigh oval cross-section.
   */
  thighRadius: 0.086,
  shinRadius: 0.068,
  /**
   * Seated posture (IMAGE 1 "Seated Posture Reference"):
   * - Thighs nearly horizontal: hip at y=0.60, knee at y=0.58 (thigh forward toward desk)
   * - Knee goes forward in z from hip joint
   * - Shins go nearly straight down from knee to ankle
   * - Feet flat on floor (y≈0.08)
   * [x, y, z] in robot-local space. x is mirrored per side.
   */
  knee: [0.130, 0.580, 0.400] as Vec3,
  ankle: [0.130, 0.090, 0.400] as Vec3,
}

/**
 * Screen-faced head. Metres, in head-local space: +x is the robot's left, +y up, +z the front of the face.
 */
export const ROBOT_HEAD = {
  /** Neck pivot, relative to ROBOT_POS. Raised to 1.300 to match the taller torso. */
  position: [0, 1.300, 0] as Vec3,
  /** Resting pitch (rad). Positive tips the face down a little, towards the desk and monitor. */
  pitch: 0.04,
  casing: { width: 0.36, height: 0.32, depth: 0.235, radius: 0.04 },
  /**
   * Display module, layered from the outside in: a glossy black outer frame (`frameWidth` wide, `thickness` tall, standing out of the
   * casing's front face), a slightly lower graphite step (`stepThickness` tall), then the black glass sitting `recess` below the frame's
   * front rim. `offsetY` moves the whole display up (+) or down (-).
   */
  bezel: { width: 0.290, height: 0.232, radius: 0.034, /** How far the display module stands out of the casing's front face (m). */ thickness: 0.022, offsetY: -0.008, /** Soft rounded edge on the frame layers (m); the outer size does not change. */ bevel: 0.002, frameWidth: 0.013, stepWidth: 0.006, stepThickness: 0.019, /** How far the glass sits below the module's front rim (m). */ recess: 0.0045 },
  /** Flat black glass, centred on the bezel. It equals the bezel minus both frame layers. */
  screen: { width: 0.252, height: 0.194, radius: 0.016 },
  /** Eyes: `spacing` is centre to centre, `offsetY` is relative to the glass centre. (Glass centre is -0.008, so the eyes sit at the same head-local height as before.) */
  eyes: { width: 0.053, height: 0.066, radius: 0.023, spacing: 0.134, offsetY: 0.038 },
  /**
   * Mouth: one short, thin horizontal capsule below the eyes. `offsetY` is relative to the glass centre. Its head-local height is
   * unchanged (-0.060): the top edge of the monitor, seen from the default camera, cuts across the glass a little below that, so
   * anything lower starts to be clipped by the monitor.
   */
  mouth: { width: 0.10, thickness: 0.013, offsetY: -0.052 },
  /** Cyan ring of the side modules. */
  accents: { ringRadius: 0.036, ringTube: 0.0035 },
  /** Ear modules on each side of the casing. */
  ear: { radius: 0.055, depth: 0.032, rimTube: 0.0055, /** Height (m) of the dark joint flange between the module and the casing. */ gasket: 0.005 },
  /**
   * Top plate: a slim dark strip that lies on the top face near the front edge and follows the rounded top-front edge of the casing
   * (`arcDeg` is how far it wraps down the curve). `width` is along x and is kept inside the flat part of the top so it never floats
   * over the rounded corners; `back` is its rear edge (head-local z); `sink` is how far it is buried in the casing.
   */
  plate: { width: 0.27, thickness: 0.0055, sink: 0.002, bevel: 0.0012, back: 0.048, arcDeg: 55 },
  /** Antennae: wire radius, base spacing either side of centre, and the stem (head-local x is mirrored per side). */
  antenna: {
    wire: 0.0028,
    tipRadius: 0.0118,
    baseX: 0.072,
    baseZ: -0.03,
    path: [[0, 0], [0.005, 0.055], [0.011, 0.108], [0.018, 0.158]] as [number, number][],
  },
}

/**
 * Architect desk lamp (Lamp.tsx, dimensions in lampModel.ts). `base` is the centre of the weighted base on the desk, in the
 * same spot as the old lamp. The arm reaches in `facing` (a horizontal direction, x and z) over the desk's back-left corner.
 * `head` is the bulb and `aim` is where the shade's axis meets the desk surface; both are derived from the lamp's real geometry,
 * so Lighting.tsx's spot light always shines out of the shade the way the shade points.
 */
const LAMP_BASE: Vec3 = [DESK_X - 1.05, DESK_TOP, DESK_Z - 0.20]
const LAMP_FACING: [number, number] = (() => {
  const x = 0.95, z = 0.19
  const len = Math.hypot(x, z)
  return [x / len, z / len]
})()
const LAMP_SCALE = 1.5   // 1 = current size, 1.3 = 30% bigger
const lampPose = lampPlane()
const lampAt = (along: number, up: number): Vec3 => [LAMP_BASE[0] + along * LAMP_SCALE * LAMP_FACING[0], LAMP_BASE[1] + up * LAMP_SCALE, LAMP_BASE[2] + along * LAMP_SCALE * LAMP_FACING[1]]
const lampHead = lampAt(lampPose.bulb[0], lampPose.bulb[1])
/** Distance along the shade axis from the bulb to the desk surface. */
const lampReach = lampPose.bulb[1] / -lampPose.axis[1]   // in lamp units; lampAt applies LAMP_SCALE
export const LAMP = {
  base: LAMP_BASE,
  /** Rotation about y that turns the lamp's forward (+x) axis towards `facing`. */
  yaw: Math.atan2(-LAMP_FACING[1], LAMP_FACING[0]),
  facing: LAMP_FACING,
  scale: LAMP_SCALE,
  head: lampHead,
  aim: lampAt(lampPose.bulb[0] + lampPose.axis[0] * lampReach, 0),
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
   * Look-at target: focused on the robot's torso/chest area so the full robot body
   * is prominent in the frame, matching the reference image composition.
   */
  focus: [-0.35, 0.72, -1.60] as Vec3,
  /**
   * Offset from focus to the default camera position — a three-quarter view from the visitor's
   * right at a lower pitch so the monitor doesn't fully block the robot's body.
   * yaw ≈ 38°, pitch ≈ 18° (lower than before so more of the robot torso is visible).
   * Orbit distance ≈ 3.8 m.
   */
  offset: [2.45, 1.05, 2.80] as Vec3,
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