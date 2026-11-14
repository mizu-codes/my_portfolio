/**
 * Architect desk lamp: dimensions and pose maths (metres).
 *
 * Everything here is expressed in the lamp's own vertical "arm plane": x runs forward along the direction the arm reaches
 * (towards the desk), y is up from the desk surface, and the lamp's third axis (z, the side) is where the joints' axles run.
 * Lamp.tsx draws the geometry from these numbers and layout.ts uses the same numbers to place the bulb (the light source) and
 * to aim the light along the shade's real axis, so the light always comes out of the shade the way the shade is pointing.
 *
 * This file must not import layout.ts (layout.ts imports it).
 */
export type Vec2 = [number, number]

const DEG = Math.PI / 180

export const LAMP_RIG = {
  /** Weighted base disc: radius, total height, and the rounded edge radius. */
  base: { radius: 0.085, height: 0.026, edge: 0.008 },
  /** Height of the lower hinge axle above the desk. */
  hingeY: 0.040,
  /** Arm segments: length between hinge axles, and lean from vertical (rad, + leans towards the desk / forward). */
  lowerLen: 0.35,
  lowerTilt: -12 * DEG,
  upperLen: 0.26,
  upperTilt: 58 * DEG,
  /** How far the shade's opening points below the horizontal (rad). */
  openingPitch: 65 * DEG,
  /**
   * Shade: a dome (quarter ellipse, apex to full width) plus a short straight lip. `radius` is the outer radius at the opening,
   * `depth` the dome height, `lip` the straight part, `wall` the shell thickness. Shade-local frame: the axis is y, the apex is
   * the origin and the opening faces -y.
   */
  shade: { radius: 0.082, depth: 0.085, lip: 0.036, wall: 0.0018 },
  /** Bulb centre below the apex along the shade axis. */
  bulbDrop: 0.047,
  /** Where on the dome's outline (angle from the apex, rad) the arm's pivot stud is attached. */
  pivotAngle: 45 * DEG,
} as const

/** One point of the dome outline, apex to rim: [radius, y]. `inset` pulls the surface inwards (used for the inner reflector). */
export function shadeProfile(inset = 0, steps = 22): Vec2[] {
  const { radius, depth, lip } = LAMP_RIG.shade
  const r = radius - inset
  const d = depth - inset
  const out: Vec2[] = []
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2)
    out.push([r * Math.sin(a), -inset - d * (1 - Math.cos(a))])
  }
  out.push([r, -(depth + lip)])
  return out
}

/** Pivot stud position on the dome's outline (shade-local, in the arm plane, on the side facing the arm) and its outward normal. */
export function pivotOnShade(): { point: Vec2; normal: Vec2 } {
  const { radius, depth } = LAMP_RIG.shade
  const a = LAMP_RIG.pivotAngle
  const point: Vec2 = [-radius * Math.sin(a), -depth * (1 - Math.cos(a))]
  // Gradient of the ellipse (r/R)^2 + ((y + depth)/depth)^2 = 1 at the pivot point.
  const nx = (2 * point[0]) / (radius * radius)
  const ny = (2 * (point[1] + depth)) / (depth * depth)
  const len = Math.hypot(nx, ny)
  return { point, normal: [nx / len, ny / len] }
}

export interface LampPlane {
  /** Lower hinge, elbow hinge and shade hinge (the end of the upper arm). */
  hinge: Vec2
  elbow: Vec2
  head: Vec2
  /** Rotation (about the side axis) that turns the shade-local frame into the arm plane. */
  shadeAngle: number
  /** Offset of the shade-local origin (the apex) from the head hinge, in the tilted shade frame. Puts the pivot stud on the hinge. */
  shadeOffset: Vec2
  /** Bulb centre in the arm plane, and the unit direction the shade points (opening direction). */
  bulb: Vec2
  axis: Vec2
  /** Lowest point of the shade rim in the arm plane. */
  rimLow: Vec2
}

/** Evaluates the arm pose. All values are in the arm plane, relative to the base centre on the desk surface. */
export function lampPlane(): LampPlane {
  const R = LAMP_RIG
  const hinge: Vec2 = [0, R.hingeY]
  const elbow: Vec2 = [hinge[0] + R.lowerLen * Math.sin(R.lowerTilt), hinge[1] + R.lowerLen * Math.cos(R.lowerTilt)]
  const head: Vec2 = [elbow[0] + R.upperLen * Math.sin(R.upperTilt), elbow[1] + R.upperLen * Math.cos(R.upperTilt)]
  const shadeAngle = Math.PI / 2 - R.openingPitch
  const c = Math.cos(shadeAngle)
  const s = Math.sin(shadeAngle)
  const rot = (v: Vec2): Vec2 => [v[0] * c - v[1] * s, v[0] * s + v[1] * c]
  const pivot = pivotOnShade().point
  const shadeOffset: Vec2 = [-pivot[0], -pivot[1]]
  const bulbRel = rot([shadeOffset[0], shadeOffset[1] - R.bulbDrop])
  const bulb: Vec2 = [head[0] + bulbRel[0], head[1] + bulbRel[1]]
  const axis: Vec2 = [Math.sin(shadeAngle), -Math.cos(shadeAngle)]
  const rimRel = rot([shadeOffset[0], shadeOffset[1] - (R.shade.depth + R.shade.lip)])
  const rimCentre: Vec2 = [head[0] + rimRel[0], head[1] + rimRel[1]]
  // The rim circle is perpendicular to the axis; its lowest point is `radius` along the in-plane perpendicular that points down.
  // The in-plane direction perpendicular to the axis that points down.
  const down: Vec2 = [-Math.sin(R.openingPitch), -Math.cos(R.openingPitch)]
  const rimLow: Vec2 = [rimCentre[0] + down[0] * R.shade.radius, rimCentre[1] + down[1] * R.shade.radius]
  return { hinge, elbow, head, shadeAngle, shadeOffset, bulb, axis, rimLow }
}
