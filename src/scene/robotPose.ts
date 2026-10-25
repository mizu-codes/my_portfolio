import { ROBOT_BODY } from './layout'
import type { Vec3 } from './parts'

/**
 * Pure pose maths for the robot's arms (no Three.js, so it is easy to test). Robot-local space, see ROBOT_BODY in layout.ts.
 * `side` is +1 for the +x arm and -1 for the -x arm.
 */

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2])
const norm = (a: Vec3): Vec3 => scale(a, 1 / (len(a) || 1))

export interface ArmPose {
  shoulder: Vec3
  elbow: Vec3
  wrist: Vec3
  /** Hand frame: yaw about +y, then pitch about x (positive tips the fingers down). Use Euler order 'YXZ'. */
  handYaw: number
  handPitch: number
  /** True if the target was out of reach and had to be pulled in. */
  clamped: boolean
}

/** Two-bone IK. The elbow lies in the plane of shoulder, wrist and `hint`, on the side the hint points to. */
export function solveArm(side: 1 | -1): ArmPose {
  const { shoulder, wrist, elbowHint, upperArm, foreArm, handPitch, handYawFactor } = ROBOT_BODY
  const S: Vec3 = [side * shoulder.x, shoulder.y, shoulder.z]
  const W0: Vec3 = [side * wrist[0], wrist[1], wrist[2]]
  const hint: Vec3 = [side * elbowHint[0], elbowHint[1], elbowHint[2]]

  let toWrist = sub(W0, S)
  let d = len(toWrist)
  const maxReach = (upperArm + foreArm) * 0.985
  const minReach = Math.abs(upperArm - foreArm) + 0.02
  const clamped = d > maxReach || d < minReach
  d = Math.min(Math.max(d, minReach), maxReach)
  const dir = norm(toWrist)
  toWrist = scale(dir, d)
  const W = add(S, toWrist)

  const a = (upperArm * upperArm - foreArm * foreArm + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(upperArm * upperArm - a * a, 0))
  const pole = norm(sub(hint, scale(dir, dot(hint, dir))))
  const E = add(add(S, scale(dir, a)), scale(pole, h))

  const f = norm(sub(W, E))
  return {
    shoulder: S,
    elbow: E,
    wrist: W,
    handYaw: Math.atan2(f[0], f[2]) * handYawFactor,
    handPitch: Math.asin(Math.min(1, Math.max(-1, -f[1]))) + handPitch,
    clamped,
  }
}
