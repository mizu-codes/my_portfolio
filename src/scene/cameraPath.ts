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
 * Allowed yaw offsets (rad). The radius never changes, so on narrow screens, where the camera is further away,
 * the range is reduced to keep the camera inside the room's width instead of zooming toward the robot.
 */
export function yawRange(aspect: number): [number, number] {
  const limit = Math.asin(Math.min(1, CAMERA.maxCameraX / orbitDistance(aspect)))
  return [Math.max(CAMERA.minYaw, -limit - baseYaw), Math.min(CAMERA.maxYaw, limit - baseYaw)]
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
