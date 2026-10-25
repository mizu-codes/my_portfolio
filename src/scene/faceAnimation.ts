/**
 * Pure logic for the robot's face (no Three.js). RobotFace.tsx applies this to the eye meshes every frame.
 *
 * To add an expression: add a name to `ExpressionName` and a row to `EXPRESSIONS`. RobotFace eases towards the target shape,
 * so switching expressions needs no other code. Sleep or idle animations can drive `heightScale` the same way.
 */

/** Eye shape as multipliers on the base eye size in `ROBOT_HEAD.eyes`. */
export interface EyeShape {
  widthScale: number
  /** 1 = fully open. Lower values squint; ~0.1 is a closed slit. Blinking is multiplied on top of this. */
  heightScale: number
  /** Roll (rad) of each eye about its own centre; mirrored so positive tilts the outer corners down (a calm or sleepy look). */
  tilt: number
  /** Vertical shift (m) of both eyes on the glass. */
  offsetY: number
}

export type ExpressionName = 'normal'

export const EXPRESSIONS: Record<ExpressionName, EyeShape> = {
  normal: { widthScale: 1, heightScale: 1, tilt: 0, offsetY: 0 },
}

/** Blink timing in seconds. Subtle: short, fairly rare, never fully closed to nothing. */
export const BLINK = {
  minInterval: 2.8,
  maxInterval: 5.8,
  closeTime: 0.07,
  openTime: 0.12,
  /** Remaining eye height at the deepest point of a blink (a thin glowing slit). */
  minOpen: 0.08,
  /** Chance that a blink is followed quickly by a second one. */
  doubleChance: 0.15,
  doubleGap: 0.16,
}

export interface BlinkState {
  /** Time at which the next blink starts. */
  nextAt: number
  /** Start time of the blink in progress, or -1 when idle. */
  startedAt: number
}

export function createBlinkState(now: number, rand: () => number = Math.random): BlinkState {
  return { nextAt: now + 1.5 + rand() * 2, startedAt: -1 }
}

const smooth = (k: number) => k * k * (3 - 2 * k)

/** Advances the blink state and returns eye openness: 1 = fully open, `BLINK.minOpen` = deepest point of a blink. */
export function updateBlink(state: BlinkState, now: number, rand: () => number = Math.random): number {
  if (state.startedAt < 0 && now >= state.nextAt) state.startedAt = now
  if (state.startedAt < 0) return 1

  const elapsed = now - state.startedAt
  const total = BLINK.closeTime + BLINK.openTime
  if (elapsed >= total) {
    state.startedAt = -1
    state.nextAt = now + (rand() < BLINK.doubleChance
      ? BLINK.doubleGap
      : BLINK.minInterval + rand() * (BLINK.maxInterval - BLINK.minInterval))
    return 1
  }
  const closedness = elapsed < BLINK.closeTime ? elapsed / BLINK.closeTime : 1 - (elapsed - BLINK.closeTime) / BLINK.openTime
  return 1 - smooth(closedness) * (1 - BLINK.minOpen)
}
