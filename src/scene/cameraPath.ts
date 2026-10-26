import { MathUtils } from 'three'
import { CAMERA } from './layout'
import type { Vec3 } from './parts'

const [fx, fy, fz] = CAMERA.focus
const [ox, oy, oz] = CAMERA.offset
const radius = Math.hypot(ox, oy, oz)
const baseYaw = Math.atan2(ox, oz)
const basePitch = Math.asin(oy / radius)
const tanHalfFov = Math.tan((CAMERA.fov * Math.PI) / 360)

/** Orbit distance for a viewport. Constant while dragging; narrow screens sit further back so the desk fits the width. */
export function orbitDistance(aspect: number) {
  const fit = MathUtils.lerp(CAMERA.fitHalfWidthPhone, CAMERA.fitHalfWidth, MathUtils.clamp((aspect - 0.6) / 0.4, 0, 1))
  return Math.max(radius, fit / (tanHalfFov * aspect))
}

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
  return [x, y + MathUtils.lerp(CAMERA.lookLift, CAMERA.lookLiftDown, t), z]
}

/**
 * Allowed yaw offsets (rad). The radius never changes, so on narrow screens, where the camera is further away,
 * the range is reduced to keep the camera inside the room's width instead of zooming toward the robot.
 * The limit accounts for the focus point's own x, since the camera orbits it rather than the room centre.
 */
export function yawRange(aspect: number): [number, number] {
  const dist = orbitDistance(aspect)
  const tx = focusFor(aspect)[0]
  const hi = Math.asin(MathUtils.clamp((CAMERA.maxCameraX - tx) / dist, -1, 1))
  const lo = Math.asin(MathUtils.clamp((-CAMERA.maxCameraX - tx) / dist, -1, 1))
  return [Math.max(CAMERA.minYaw, lo - baseYaw), Math.min(CAMERA.maxYaw, hi - baseYaw)]
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
