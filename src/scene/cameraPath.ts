import { MathUtils } from 'three'
import { CAMERA, RIGHT_WALL_FIT } from './layout'
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
  // Never pull back past the distance at which the default camera would reach the ceiling-safe height, or the height clamp would silently change the orbit.
  const maxDist = (CAMERA.maxCameraY - 0.1 - fy) / Math.sin(basePitch)
  const wall = 1 + (Math.min(wallFitDistance(aspect), maxDist) / radius - 1) * MathUtils.clamp((aspect - 0.7) / 0.3, 0, 1)
  return Math.max(radius, fit / (tanHalfFov * aspect), radius * wall)
}

/**
 * Smallest orbit distance (>= radius) at which the right-wall group (pegboard + speaker ledge, RIGHT_WALL_FIT) stays inside the
 * default view. Wide screens already fit, so this returns `radius`; squarer windows pull back just far enough. Uses the default
 * yaw/pitch, the look shift and look lift, so it matches the camera the visitor starts with.
 */
function wallFitDistance(aspect: number) {
  const [tx, ty, tz] = [fx, fy, fz]
  const dirX = Math.sin(baseYaw) * Math.cos(basePitch)
  const dirY = Math.sin(basePitch)
  const dirZ = Math.cos(baseYaw) * Math.cos(basePitch)
  const aimX = tx + CAMERA.lookShiftX, aimY = ty + CAMERA.lookLift, aimZ = tz
  const worst = (d: number) => {
    const cx = tx + dirX * d, cy = ty + dirY * d, cz = tz + dirZ * d
    let fxv = aimX - cx, fyv = aimY - cy, fzv = aimZ - cz
    const fl = Math.hypot(fxv, fyv, fzv); fxv /= fl; fyv /= fl; fzv /= fl
    // right = forward x up(0,1,0)
    let rx = -fzv, rz = fxv
    const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl
    let max = -Infinity
    for (const [px, py, pz] of RIGHT_WALL_FIT) {
      const dx = px - cx, dy = py - cy, dz = pz - cz
      const depth = dx * fxv + dy * fyv + dz * fzv
      max = Math.max(max, (dx * rx + dz * rz) / (depth * tanHalfFov * aspect))
    }
    return max
  }
  if (worst(radius) <= CAMERA.rightWallMargin) return radius
  let lo = radius, hi = radius * 3
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (worst(mid) > CAMERA.rightWallMargin) lo = mid; else hi = mid
  }
  return hi
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
  return [x + CAMERA.lookShiftX, y + MathUtils.lerp(CAMERA.lookLift, CAMERA.lookLiftDown, t), z]
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
