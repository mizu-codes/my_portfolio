import { MathUtils } from 'three'
import { CAMERA, RIGHT_WALL_FIT, ROOM } from './layout'
import type { Vec3 } from './parts'

const [fx, fy, fz] = CAMERA.focus
const [ox, oy, oz] = CAMERA.offset
const radius = Math.hypot(ox, oy, oz)
const baseYaw = Math.atan2(ox, oz)
const basePitch = Math.asin(oy / radius)
const rad = (deg: number) => (deg * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const tanHalf = (fov: number) => Math.tan(rad(fov) / 2)

/** Camera distance from the orbit pivot and vertical field of view (deg) for one window shape. */
export interface View { dist: number; fov: number }

/**
 * Largest orbit distance that keeps the default-direction camera inside the room: in front of the rear wall (frontMargin), inside the side
 * walls and under the ceiling. The room is compact, so this is the limit narrow screens may use before the field of view takes over.
 */
const distCap = (() => {
  const cy = Math.cos(basePitch)
  const dz = (ROOM.frontZ - CAMERA.frontMargin - fz) / (Math.cos(baseYaw) * cy)
  const dx = (CAMERA.maxCameraX - fx) / (Math.sin(baseYaw) * cy)
  const dy = (CAMERA.maxCameraY - 0.1 - fy) / Math.sin(basePitch)
  return Math.max(radius, Math.min(dz, dx, dy))
})()

/**
 * Worst (largest) lateral-offset-over-depth ratio of the right-wall group (pegboard + speaker ledge, RIGHT_WALL_FIT) as seen from the default
 * yaw/pitch at orbit distance d, with the look shift and look lift. The horizontal half-tangent of the view must be at least ratio / rightWallMargin
 * for the group to stay inside the frame.
 */
function wallRatio(d: number) {
  const dirX = Math.sin(baseYaw) * Math.cos(basePitch)
  const dirY = Math.sin(basePitch)
  const dirZ = Math.cos(baseYaw) * Math.cos(basePitch)
  const aimX = fx + CAMERA.lookShiftX, aimY = fy + CAMERA.lookLift, aimZ = fz
  const cx = fx + dirX * d, cy = fy + dirY * d, cz = fz + dirZ * d
  let fxv = aimX - cx, fyv = aimY - cy, fzv = aimZ - cz
  const fl = Math.hypot(fxv, fyv, fzv); fxv /= fl; fyv /= fl; fzv /= fl
  let rx = -fzv, rz = fxv // right = forward x up
  const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl
  let max = -Infinity
  for (const [px, py, pz] of RIGHT_WALL_FIT) {
    const dx = px - cx, dy = py - cy, dz = pz - cz
    const depth = dx * fxv + dy * fyv + dz * fzv
    max = Math.max(max, (dx * rx + dz * rz) / depth)
  }
  return max
}

/**
 * The orbit distance the camera used for a viewport before the room was shortened (the 10.7 m deep room had space to retreat in). It is kept
 * as the definition of the DESIGNED FRAMING: what the visitor sees on the desk / workstation plane at a given window shape. The compact room
 * cannot always give the camera that much distance, so viewFor() reproduces this framing with a nearer camera and a wider lens instead.
 */
function legacyDistance(aspect: number) {
  const tanH = tanHalf(CAMERA.fov)
  const fit = MathUtils.lerp(CAMERA.fitHalfWidthPhone, CAMERA.fitHalfWidth, MathUtils.clamp((aspect - 0.6) / 0.4, 0, 1))
  const ceilingDist = (CAMERA.maxCameraY - 0.1 - fy) / Math.sin(basePitch)
  // smallest distance (>= radius) at which the right-wall group stays inside the default view
  let wallDist = radius
  if (wallRatio(radius) / (tanH * aspect) > CAMERA.rightWallMargin) {
    let lo = radius, hi = radius * 3
    for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (wallRatio(mid) / (tanH * aspect) > CAMERA.rightWallMargin) lo = mid; else hi = mid }
    wallDist = hi
  }
  const wall = 1 + (Math.min(wallDist, ceilingDist) / radius - 1) * MathUtils.clamp((aspect - 0.7) / 0.3, 0, 1)
  return Math.max(radius, fit / (tanH * aspect), radius * wall)
}

const views = new Map<number, View>()

/**
 * Camera distance and field of view for a viewport. The room's geometry is never touched; only the camera adapts.
 *  1. Wherever the designed framing fits inside the room (every landscape window), nothing changes: the same distance and the same 50 deg lens as before.
 *  2. Narrow windows (phones, portrait tablets) used to retreat up to ~6 m. The camera now stops at maxOrbit, so it always stays well inside the walls
 *     (and never nearer than frontMargin to the rear wall), and the lens widens by exactly the factor that keeps the same width visible on the
 *     workstation plane: the framing of the desk is preserved, only the perspective is a little wider (never beyond fovMax).
 *  3. Very wide windows (ultrawide, letterbox) narrow the vertical field so the horizontal field stays natural (<= hfovMax), and back off a little if
 *     the narrowed field would no longer show the workstation's height.
 */
export function viewFor(aspect: number): View {
  const key = Math.round(aspect * 400)
  const hit = views.get(key)
  if (hit) return hit
  const a = key / 400
  const designed = legacyDistance(a)
  const maxD = Math.min(distCap, CAMERA.maxOrbit)
  let dist = Math.min(designed, maxD)
  let fov: number = CAMERA.fov
  if (designed > maxD) fov = Math.min(CAMERA.fovMax, deg(2 * Math.atan((tanHalf(CAMERA.fov) * designed) / maxD)))
  // Very wide windows
  const hCap = deg(2 * Math.atan(Math.tan(rad(CAMERA.hfovMax) / 2) / a)) // largest vertical fov whose horizontal fov is still <= hfovMax
  if (hCap < fov) {
    fov = hCap
    dist = Math.min(distCap, Math.max(dist, CAMERA.fitHalfHeight / tanHalf(fov)))
  }
  const view = { dist, fov }
  views.set(key, view)
  return view
}

/** Orbit distance for a viewport. Constant while dragging. */
export function orbitDistance(aspect: number) { return viewFor(aspect).dist }
/** Vertical field of view (deg) for a viewport. */
export function fieldOfView(aspect: number) { return viewFor(aspect).fov }

/** Look-at point. On portrait screens it drops so the desk sits above the bottom UI. */
export function focusFor(aspect: number): Vec3 {
  const portrait = MathUtils.clamp((1 - aspect) / 0.5, 0, 1)
  return [fx, fy - CAMERA.portraitFocusDrop * portrait, fz]
}

/**
 * The point the camera actually looks at: the orbit pivot raised by `CAMERA.lookLift`. As the visitor drags down (pitch offset
 * rises towards its limit) the lift eases to `CAMERA.lookLiftDown`, so the camera both rises and tilts down onto the desk.
 */
export function lookTarget(aspect: number, pitchOffset = 0): Vec3 {
  const [x, y, z] = focusFor(aspect)
  const hi = pitchRange(aspect)[1]
  const t = MathUtils.smoothstep(hi > 0 ? pitchOffset / hi : 0, 0, 1)
  return [x + CAMERA.lookShiftX, y + MathUtils.lerp(CAMERA.lookLift, CAMERA.lookLiftDown, t), z]
}

/**
 * Allowed yaw offsets (rad). The radius never changes, so on narrow screens, where the camera is further away,
 * the range is reduced to keep the camera inside the room: inside the side walls, and in front of the rear (entrance) wall by frontMargin.
 * The limits account for the focus point's own x and z, since the camera orbits it rather than the room centre.
 */
export function yawRange(aspect: number): [number, number] {
  const dist = orbitDistance(aspect)
  const [tx, , tz] = focusFor(aspect)
  const hi = Math.asin(MathUtils.clamp((CAMERA.maxCameraX - tx) / dist, -1, 1))
  const lo = Math.asin(MathUtils.clamp((-CAMERA.maxCameraX - tx) / dist, -1, 1))
  // Rear wall: camera z = tz + dist * cos(yaw) * cos(pitch) must stay <= frontZ - frontMargin, even at the lowest pitch (where cos(pitch) is largest).
  const zRatio = (ROOM.frontZ - CAMERA.frontMargin - tz) / (dist * Math.cos(basePitch + CAMERA.minPitch))
  const zLo = zRatio >= 1 ? -Infinity : Math.acos(MathUtils.clamp(zRatio, -1, 1)) // the camera must sit at |yaw| >= zLo
  return [Math.max(CAMERA.minYaw, lo - baseYaw, zLo - baseYaw), Math.min(CAMERA.maxYaw, hi - baseYaw)]
}

/**
 * Allowed pitch offsets (rad). Positive pitch lifts the camera and tilts it down onto the desk. The upper limit is the
 * pitch at which the camera reaches `maxCameraY` (just under the ceiling) at the current orbit distance, so the camera
 * never needs a height clamp that would quietly change its distance from the focus.
 */
export function pitchRange(aspect: number): [number, number] {
  const dist = orbitDistance(aspect)
  const ty = focusFor(aspect)[1]
  const ceilingPitch = Math.asin(MathUtils.clamp((CAMERA.maxCameraY - ty) / dist, -1, 1))
  return [CAMERA.minPitch, Math.min(CAMERA.maxPitch, ceilingPitch - basePitch)]
}

export function cameraPosition(yawOffset: number, pitchOffset: number, aspect: number): Vec3 {
  const dist = orbitDistance(aspect)
  const [tx, ty, tz] = focusFor(aspect)
  const yaw = baseYaw + yawOffset
  const pitch = basePitch + pitchOffset
  return [
    tx + dist * Math.sin(yaw) * Math.cos(pitch),
    Math.min(ty + dist * Math.sin(pitch), CAMERA.maxCameraY),
    tz + dist * Math.cos(yaw) * Math.cos(pitch),
  ]
}
