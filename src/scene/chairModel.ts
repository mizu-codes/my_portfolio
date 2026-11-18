import {
  BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, ExtrudeGeometry, Float32BufferAttribute, LatheGeometry, Matrix4,
  Path, Shape, TorusGeometry, Vector2, Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Procedural geometry for the ergonomic chair (see Chair.tsx).
 *
 * Chair space: origin on the floor under the column, +y up, +z toward the desk (the robot faces +z), +x the visitor's right. Metres.
 *
 * Sized from the robot (layout.ts, drawn at scale 1.03): the pelvis underside is at about 0.536 m, the chest's back at about
 * z = -0.167 m, the shoulder joints at about y = 1.04 m, the elbows at about y = 0.785 m. So: seat 0.53 m, backrest top about
 * 1.03 m (upper back / shoulder line, far below the head), armrest pads 1.5 cm under the elbows.
 *
 * Everything is merged into one BufferGeometry per material (11 draw calls for the whole chair).
 */

export const CHAIR_DIM = {
  /** Height of the cushion's flat edge; its crown rises about 9 mm above this, right under the robot's pelvis. */
  seatTop: 0.528,
  /** Top of the rug (Rug.tsx: 12 mm slab); casters rest on it. */
  floorY: 0.012,
  /** Distance from the column to each caster axle. */
  baseRadius: 0.275,
  wheelRadius: 0.026,
  /** Backrest recline (rad), about the pivot below. */
  tilt: 0.09,
  /** Bottom centre of the backrest frame. */
  backPivot: [0, 0.51, -0.185] as [number, number, number],
  /** Height of the backrest frame (m). */
  backHeight: 0.518,
} as const

export interface ChairGeometries {
  /** Matte off-white polymer: the backrest frame with its integrated Y, spine, seat pan, base, hinge housings, armrest supports. */
  white: BufferGeometry
  /** Fine knitted mesh panel. */
  mesh: BufferGeometry
  /** Seat cushion. */
  cushion: BufferGeometry
  /** Seat stitching. */
  stitch: BufferGeometry
  /** Teal lumbar pad. */
  lumbar: BufferGeometry
  /** Thin cyan light rings (hinges, caster hubs); drawn slightly emissive like the robot's accents. */
  glow: BufferGeometry
  /** Black hard plastic: gas-lift sleeve and boot, caster forks, lever, hinge caps. */
  dark: BufferGeometry
  /** Soft-touch armrest pads. */
  pad: BufferGeometry
  /** Caster tyres. */
  rubber: BufferGeometry
  /** Caster hubs. */
  hub: BufferGeometry
  /** Satin metal: gas-lift piston and rings. */
  metal: BufferGeometry
  /** Plan positions (chair space, x/z) of the five casters, for the contact shadows. */
  casters: [number, number][]
}

type Bucket = BufferGeometry[]
const V = (x: number, y: number, z: number) => new Vector3(x, y, z)
const rotY = (a: number) => new Matrix4().makeRotationY(a)
const trans = (x: number, y: number, z: number) => new Matrix4().makeTranslation(x, y, z)
const mul = (...ms: Matrix4[]) => ms.reduce((a, b) => a.multiply(b), new Matrix4())

/** Adds a geometry to a bucket. Every geometry becomes non-indexed with creased normals so they can be merged. */
function put(bucket: Bucket, g: BufferGeometry, m?: Matrix4) {
  if (m) g.applyMatrix4(m)
  if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2))
  bucket.push(toCreasedNormals(g, 0.62))
}
const merged = (b: Bucket) => mergeGeometries(b, false)!

/** Extrusion with soft rounded edges. The side wall stays on the outline; only the caps are pulled in. Centred on z = 0. */
function extrude(shape: Shape, depth: number, bevel: number, segments = 3, curveSegments = 12) {
  const g = new ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: segments, curveSegments, steps: 1,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Applies a per-vertex warp to a geometry's positions. */
function warp(g: BufferGeometry, fn: (p: Vector3) => void) {
  const pos = g.getAttribute('position')
  const p = new Vector3()
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); fn(p); pos.setXYZ(i, p.x, p.y, p.z) }
  pos.needsUpdate = true
}

// ------------------------------------------------------------------------------------------------ 2D polygon helpers

/** Closed smooth outline through right-hand points (bottom centre to top centre), mirrored to the left. Counter-clockwise. */
function symmetricOutline(right: [number, number][], samples: number): Vector2[] {
  const pts: Vector3[] = [...right.map(([x, y]) => V(x, y, 0)), ...right.slice(1, -1).reverse().map(([x, y]) => V(-x, y, 0))]
  const curve = new CatmullRomCurve3(pts, true, 'centripetal')
  return curve.getSpacedPoints(samples).slice(0, samples).map((p) => new Vector2(p.x, p.y))
}

/** Moves every point of a counter-clockwise polygon inward by d(point). */
function inset(poly: Vector2[], d: (p: Vector2) => number): Vector2[] {
  const n = poly.length
  return poly.map((p, i) => {
    const t = poly[(i + 1) % n].clone().sub(poly[(i + n - 1) % n]).normalize()
    return p.clone().add(new Vector2(-t.y, t.x).multiplyScalar(d(p)))
  })
}

/** Even arc-length resampling of a closed polygon. */
function resample(poly: Vector2[], step: number): Vector2[] {
  const n = poly.length
  const len: number[] = [0]
  for (let i = 0; i < n; i++) len.push(len[i] + poly[i].distanceTo(poly[(i + 1) % n]))
  const total = len[n]
  const count = Math.max(12, Math.round(total / step))
  const out: Vector2[] = []
  let seg = 0
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total
    while (len[seg + 1] < s) seg++
    const f = (s - len[seg]) / Math.max(1e-9, len[seg + 1] - len[seg])
    out.push(poly[seg].clone().lerp(poly[(seg + 1) % n], f))
  }
  return out
}

/** Laplacian smoothing: rounds sharp corners to a radius of about sqrt(iterations / 2) x the sample spacing. */
function smooth(poly: Vector2[], iterations: number): Vector2[] {
  let p = poly
  for (let it = 0; it < iterations; it++) {
    const n = p.length
    p = p.map((q, i) => {
      const a = p[(i + n - 1) % n], b = p[(i + 1) % n]
      return new Vector2((a.x + 2 * q.x + b.x) / 4, (a.y + 2 * q.y + b.y) / 4)
    })
  }
  return p
}

/** Keeps the part of a polygon where n . p >= c (Sutherland-Hodgman). */
function clip(poly: Vector2[], n: Vector2, c: number): Vector2[] {
  const out: Vector2[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const da = n.dot(a) - c, db = n.dot(b) - c
    if (da >= 0) out.push(a)
    if ((da >= 0) !== (db >= 0)) out.push(a.clone().lerp(b, da / (da - db)))
  }
  return out
}

function inside(poly: Vector2[], x: number, y: number): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c
  }
  return c
}

/** Squircle outline (superellipse). */
function squircle(w: number, h: number, exp: number): Shape {
  const pts: Vector2[] = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2
    const c = Math.cos(a), s = Math.sin(a)
    pts.push(new Vector2(Math.sign(c) * Math.pow(Math.abs(c), 2 / exp) * (w / 2), Math.sign(s) * Math.pow(Math.abs(s), 2 / exp) * (h / 2)))
  }
  return new Shape(pts)
}

// ------------------------------------------------------------------------------------------------ 3D helpers

/**
 * Tube along a curve with a (super)elliptical cross-section that can change along its length. `lateral` is the half-size along the
 * direction perpendicular to both the curve and `ref`, `inplane` the other half-size. `exp` squares the section off (2 = ellipse).
 */
function sweep(points: Vector3[], ref: Vector3, prof: (t: number) => [number, number], samples = 30, seg = 20, exp = 2): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, 'centripetal')
  const pos: number[] = []
  const centres: Vector3[] = [], tangents: Vector3[] = []
  const pw = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / exp)
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const c = curve.getPointAt(t)
    const T = curve.getTangentAt(t).normalize()
    const B = new Vector3().crossVectors(T, ref).normalize()
    const N = new Vector3().crossVectors(B, T).normalize()
    const [lat, inp] = prof(t)
    centres.push(c); tangents.push(T)
    for (let j = 0; j < seg; j++) {
      const th = (j / seg) * Math.PI * 2
      const p = c.clone().addScaledVector(N, pw(Math.cos(th)) * lat).addScaledVector(B, pw(Math.sin(th)) * inp)
      pos.push(p.x, p.y, p.z)
    }
  }
  const tube: number[] = []
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < seg; j++) {
      const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = (i + 1) * seg + j, d = (i + 1) * seg + ((j + 1) % seg)
      tube.push(a, c, b, b, c, d)
    }
  }
  const P = (k: number) => V(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2])
  const n0 = new Vector3().crossVectors(P(tube[1]).sub(P(tube[0])), P(tube[2]).sub(P(tube[0])))
  const flip = n0.dot(P(tube[0]).sub(centres[0])) < 0
  const idx: number[] = []
  for (let i = 0; i < tube.length; i += 3) idx.push(tube[i], flip ? tube[i + 2] : tube[i + 1], flip ? tube[i + 1] : tube[i + 2])
  const cap = (ring: number, outward: Vector3) => {
    const base = pos.length / 3
    const c = centres[ring]
    pos.push(c.x, c.y, c.z)
    for (let j = 0; j < seg; j++) { const k = ring * seg + j; pos.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]) }
    for (let j = 0; j < seg; j++) {
      const a = base, b = base + 1 + j, d = base + 1 + ((j + 1) % seg)
      const nrm = new Vector3().crossVectors(P(b).sub(P(a)), P(d).sub(P(a)))
      if (nrm.dot(outward) >= 0) idx.push(a, b, d); else idx.push(a, d, b)
    }
  }
  cap(0, tangents[0].clone().negate())
  cap(samples, tangents[samples].clone())
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const rbox = (w: number, h: number, d: number, r: number, at: [number, number, number], m?: Matrix4) => {
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999)
  g.applyMatrix4(trans(...at))
  if (m) g.applyMatrix4(m)
  return g
}

/** Lathe from (radius, y) pairs. */
const lathe = (pts: [number, number][], seg = 40) => new LatheGeometry(pts.map(([r, y]) => new Vector2(r, y)), seg)

/** Wheels and hubs revolve around y; this lays them on their side so the axle runs along x. */
const axleX = new Matrix4().makeRotationZ(Math.PI / 2)
/** Rings made in the XY plane (facing +z) turned to face +x. */
const faceX = new Matrix4().makeRotationY(Math.PI / 2)

// ------------------------------------------------------------------------------------------------ Pillow (upholstered slab)

interface Pillow { hx: number; hz: number; hy: number; zc: number; yc: number; rE: number; n: number; crown: number; taper: number }

/** Maps a point of the unit cube to the pillow: a squircle plan, a circular edge, a domed top and a narrower front. */
function pillowMap(s: Pillow, X: number, Y: number, Z: number): Vector3 {
  const m = Math.max(Math.abs(X), Math.abs(Z))
  const L = Math.pow(Math.pow(Math.abs(X), s.n) + Math.pow(Math.abs(Z), s.n), 1 / s.n)
  const k = L > 1e-6 ? m / L : 1
  const Xp = X * k, Zp = Z * k
  const y = Y * s.hy
  const t = Math.min(1, Math.max(0, (Math.abs(y) - (s.hy - s.rE)) / s.rE))
  const d = s.rE * (1 - Math.sqrt(1 - t * t))
  const f = (1 - Xp * Xp) * (1 - Zp * Zp)
  const taper = 1 - (s.taper * (Zp + 1)) / 2
  return V(Xp * (s.hx - d) * taper, s.yc + y + (s.crown * f * (Y + 1)) / 2, s.zc + Zp * (s.hz - d))
}

function pillow(s: Pillow): BufferGeometry {
  const g = new BoxGeometry(2, 2, 2, 40, 12, 40)
  const pos = g.getAttribute('position')
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const p = pillowMap(s, pos.getX(i), pos.getY(i), pos.getZ(i))
    pos.setXYZ(i, p.x, p.y, p.z)
    uv[i * 2] = p.x + p.y * 0.5; uv[i * 2 + 1] = p.z + p.y * 0.5
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}

// ------------------------------------------------------------------------------------------------ Build

export function buildChair(): ChairGeometries {
  const white: Bucket = [], mesh: Bucket = [], cushion: Bucket = [], stitch: Bucket = [], lumbar: Bucket = [], glow: Bucket = []
  const dark: Bucket = [], pad: Bucket = [], rubber: Bucket = [], hub: Bucket = [], metal: Bucket = []
  const { seatTop, floorY, baseRadius, wheelRadius, tilt, backPivot, backHeight } = CHAIR_DIM
  const recline = mul(trans(...backPivot), new Matrix4().makeRotationX(-tilt))

  // ---------------------------------------------------------------- Backrest
  // One continuous sculpted shell: an outer outline with three windows, so the Y is part of the frame rather than bars laid on it.
  const outer = symmetricOutline([
    [0, 0.0], [0.165, 0.0], [0.212, 0.028], [0.232, 0.11], [0.224, 0.24], [0.232, 0.365], [0.218, 0.45], [0.178, 0.5],
    [0.09, 0.515], [0, backHeight],
  ], 140)
  const rim = (p: Vector2) => (p.y < 0.075 ? 0.062 : 0.04)
  const inner = resample(inset(outer, rim), 0.006)

  // Y: two arms from the upper corners meeting at a vertex, then a stem down to the bottom rail.
  const C = new Vector2(0, 0.255)
  const TL = new Vector2(-0.195, 0.47)
  const armDir = TL.clone().sub(C).normalize()
  const nL = new Vector2(armDir.y, -armDir.x)             // left arm normal, pointing up and inward
  const nR = new Vector2(-nL.x, nL.y)                      // right arm normal, mirrored
  const armHalf = 0.027, stemHalf = 0.034
  const above = (n: Vector2, h: number) => (poly: Vector2[]) => clip(poly, n, n.dot(C) + h)
  const topWin = above(nR, armHalf)(above(nL, armHalf)(inner))
  const leftWin = clip(clip(inner, nL.clone().negate(), -nL.dot(C) + armHalf), new Vector2(-1, 0), stemHalf)
  const rightWin = clip(clip(inner, nR.clone().negate(), -nR.dot(C) + armHalf), new Vector2(1, 0), stemHalf)
  const windows = [topWin, leftWin, rightWin].map((w) => smooth(resample(w, 0.006), 12))

  // Backrest curvature: the sides wrap a little toward the sitter and the top leans away.
  const backWarp = (p: Vector3) => { p.z += 0.42 * p.x * p.x - 0.03 * Math.pow(p.y / backHeight, 2) }

  const frameShape = new Shape(outer)
  for (const w of windows) frameShape.holes.push(new Path(w))
  const frame = extrude(frameShape, 0.03, 0.014, 3, 12)
  warp(frame, backWarp)
  put(white, frame, recline)

  // Knitted mesh: one sheet behind the whole frame mid-plane, only visible through the windows. UVs are metres.
  const sheet = resample(inset(outer, () => 0.012), 0.008)
  const nx = 28, ny = 32, x0 = -0.24, x1 = 0.24, y0 = 0, y1 = backHeight
  const mp: number[] = [], mu: number[] = []
  const gp = (i: number, j: number) => V(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny, 0)
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const a = gp(i, j), b = gp(i + 1, j), c = gp(i + 1, j + 1), d = gp(i, j + 1)
    for (const tri of [[a, b, c], [a, c, d]]) {
      const cx = (tri[0].x + tri[1].x + tri[2].x) / 3, cy = (tri[0].y + tri[1].y + tri[2].y) / 3
      if (!inside(sheet, cx, cy)) continue
      for (const p of tri) { mp.push(p.x, p.y, 0); mu.push(p.x, p.y) }
    }
  }
  const meshG = new BufferGeometry()
  meshG.setAttribute('position', new Float32BufferAttribute(mp, 3))
  meshG.setAttribute('uv', new Float32BufferAttribute(mu, 2))
  warp(meshG, (p) => { backWarp(p); p.z -= 0.004 })
  put(mesh, meshG, recline)

  // Lumbar pad: a teal, softly crowned rounded rectangle bolted to the front of the Y stem.
  const pad3 = extrude(squircle(0.2, 0.078, 4), 0.012, 0.012, 4, 12)
  pad3.applyMatrix4(trans(0, 0.205, 0.046))
  warp(pad3, (p) => { p.z += 0.45 * p.x * p.x - 0.03 * Math.pow(p.y / backHeight, 2) })
  put(lumbar, pad3, recline)

  // Spine: a broad sculpted bracket from the foot of the Y down and forward into the seat mechanism.
  put(white, sweep([V(0, 0.575, -0.2), V(0, 0.515, -0.222), V(0, 0.478, -0.2), V(0, 0.452, -0.125)], V(1, 0, 0), (t) => [0.046 - 0.014 * t, 0.02 - 0.003 * t], 24, 20, 2.6))

  // ---------------------------------------------------------------- Seat
  const cush: Pillow = { hx: 0.245, hz: 0.2, hy: 0.0235, zc: 0.01, yc: seatTop - 0.0235, rE: 0.02, n: 4, crown: 0.009, taper: 0.12 }
  put(cushion, pillow(cush))
  // Top-stitching just inside the rounded edge: short dashes following the plan outline.
  const dashes = 168
  const perimeter: [number, number][] = []
  const s = 0.965
  for (let k = 0; k < dashes; k++) {
    const u = (k / dashes) * 4
    const side = Math.floor(u), f = u - side
    const q = [[-s + 2 * s * f, -s], [s, -s + 2 * s * f], [s - 2 * s * f, s], [-s, s - 2 * s * f]][side]
    perimeter.push([q[0], q[1]])
  }
  const sp = perimeter.map(([X, Z]) => pillowMap(cush, X, 1, Z))
  for (let k = 0; k < dashes; k++) {
    const a = sp[k], b = sp[(k + 1) % dashes], c = sp[(k + dashes - 1) % dashes]
    const t = b.clone().sub(c)
    const ang = Math.atan2(-t.z, t.x)
    put(stitch, new BoxGeometry(0.0072, 0.0017, 0.0017), mul(trans(a.x, a.y + 0.0006, a.z), rotY(ang)))
  }

  const pan: Pillow = { hx: 0.238, hz: 0.193, hy: 0.0105, zc: 0.01, yc: seatTop - 0.047 - 0.0105, rE: 0.007, n: 4, crown: 0, taper: 0.12 }
  put(white, pillow(pan))
  put(white, rbox(0.21, 0.05, 0.23, 0.018, [0, seatTop - 0.047 - 0.021 - 0.025, -0.03]))
  // Tilt lever tucked under the right side of the seat.
  put(dark, rbox(0.008, 0.04, 0.008, 0.003, [0.17, 0.404, -0.085]))
  put(dark, rbox(0.055, 0.008, 0.022, 0.004, [0.17, 0.382, -0.085]))

  // ---------------------------------------------------------------- Column: hub, sleeve, piston, boot
  put(white, lathe([[0, 0.084], [0.062, 0.084], [0.074, 0.092], [0.071, 0.106], [0.056, 0.126], [0.042, 0.14], [0.036, 0.148], [0, 0.148]], 48))
  put(dark, new CylinderGeometry(0.034, 0.036, 0.1, 40), trans(0, 0.2, 0))                         // lower sleeve
  put(metal, new CylinderGeometry(0.0215, 0.0215, 0.16, 40), trans(0, 0.31, 0))                      // piston
  for (const y of [0.25, 0.372]) { const r = new TorusGeometry(0.0345, 0.0028, 10, 40); r.rotateX(Math.PI / 2); put(metal, r, trans(0, y, 0)) }
  put(dark, lathe([[0, 0.372], [0.03, 0.372], [0.034, 0.382], [0.046, 0.402], [0.052, 0.412], [0.052, 0.42], [0, 0.42]], 40)) // boot

  // ---------------------------------------------------------------- Five-star base
  // Sculpted spokes: wide and flat at the hub, tapering and squared-off toward the casters, one pointing straight back.
  const spokeCurve = [V(0.04, 0.126, 0), V(0.1, 0.123, 0), V(0.17, 0.115, 0), V(0.235, 0.106, 0), V(baseRadius, 0.1, 0)]
  const casters: [number, number][] = []
  const wheelY = floorY + wheelRadius
  const axle = 0.0385                                                                                // wheel centre height
  const plate = new Shape()
  plate.moveTo(-0.017, 0.073); plate.lineTo(0.017, 0.073); plate.lineTo(0.0125, 0.052)
  for (let a = 20; a <= 160; a += 14) { const r = (a * Math.PI) / 180; plate.lineTo(0.0115 * Math.cos(-r), axle - 0.0115 * Math.sin(r)) }
  plate.lineTo(-0.0125, 0.052); plate.closePath()
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i * 2 * Math.PI) / 5          // angle from +z; spoke 0 points to the back
    const R = rotY(a - Math.PI / 2)
    put(white, sweep(spokeCurve, V(0, 0, 1), (t) => { const e = t > 0.86 ? Math.sqrt(Math.max(0.1, 1 - Math.pow((t - 0.86) / 0.14, 2))) : 1; return [(0.036 - 0.0195 * t) * e, (0.021 - 0.0095 * t) * Math.max(0.55, e)] }, 30, 22, 2.8), R)
    const place = mul(R, trans(baseRadius, 0, 0))
    const local = mul(place, rotY([0.35, -0.5, 0.15, -0.25, 0.6][i]))
    // Mount boss under the spoke tip, black swivel cap, and a fork whose two plates hold the axle.
    put(white, lathe([[0, 0.072], [0.024, 0.072], [0.0235, 0.088], [0.02, 0.099], [0, 0.099]], 28), place)
    put(dark, rbox(0.052, 0.009, 0.036, 0.004, [0, 0.0675, 0]), local)
    for (const sx of [-1, 1]) {
      const pl = extrude(plate, 0.0035, 0.0012, 2, 6)
      pl.applyMatrix4(rotY(Math.PI / 2))
      put(dark, pl, mul(local, trans(sx * 0.0255, 0, 0)))
      // Twin wheels: tyre with a centre groove, dark hub with a thin cyan ring on its outer face.
      const tyre = lathe([[0.0135, -0.0068], [0.021, -0.0068], [0.0248, -0.0052], [0.0259, -0.003], [0.0259, -0.0008], [0.0252, 0], [0.0259, 0.0008], [0.0259, 0.003], [0.0248, 0.0052], [0.021, 0.0068], [0.0135, 0.0068]], 36)
      tyre.applyMatrix4(axleX)
      const wm = mul(local, trans(sx * 0.0105, wheelY, 0))
      put(rubber, tyre, wm)
      const cap = new CylinderGeometry(0.0138, 0.0138, 0.0185, 24)
      cap.applyMatrix4(axleX)
      put(hub, cap, wm)
      const ringG = new TorusGeometry(0.0098, 0.0011, 5, 20)
      ringG.applyMatrix4(faceX)
      put(glow, ringG, mul(local, trans(sx * (0.0105 + 0.0094), wheelY, 0)))
    }
    casters.push([Math.sin(a) * baseRadius, Math.cos(a) * baseRadius])
  }

  // ---------------------------------------------------------------- Armrests (flip-up style)
  // A round hinge housing on each side with a dark cap and a thin cyan light ring, a thick curved support, and a soft black pad.
  for (const sgn of [-1, 1]) {
    const hx = sgn * 0.252
    const hingeY = 0.575, hingeZ = -0.2
    const housing = new CylinderGeometry(0.039, 0.039, 0.04, 40)
    housing.applyMatrix4(axleX)
    put(white, housing, trans(hx, hingeY, hingeZ))
    const outerFace = hx + sgn * 0.02
    const capG = new CylinderGeometry(0.0235, 0.0235, 0.008, 32)
    capG.applyMatrix4(axleX)
    put(dark, capG, trans(outerFace + sgn * 0.001, hingeY, hingeZ))
    const ringG = new TorusGeometry(0.029, 0.0035, 6, 32)
    ringG.applyMatrix4(faceX)
    put(glow, ringG, trans(outerFace + sgn * 0.0005, hingeY, hingeZ))
    const bezel = new TorusGeometry(0.0375, 0.0028, 6, 32)
    bezel.applyMatrix4(faceX)
    put(white, bezel, trans(outerFace, hingeY, hingeZ))

    const support = [V(sgn * 0.262, hingeY, hingeZ), V(sgn * 0.288, 0.598, -0.19), V(sgn * 0.308, 0.632, -0.152), V(sgn * 0.318, 0.655, -0.09), V(sgn * 0.32, 0.664, -0.02)]
    put(white, sweep(support, V(1, 0, 0), (t) => [0.0125, 0.03 - 0.014 * t], 28, 20, 2.4))
    put(white, rbox(0.044, 0.014, 0.13, 0.005, [sgn * 0.32, 0.6665, 0.01]))
    put(pad, rbox(0.06, 0.026, 0.26, 0.012, [sgn * 0.32, 0.687, 0.03]))
  }

  return {
    white: merged(white), mesh: merged(mesh), cushion: merged(cushion), stitch: merged(stitch), lumbar: merged(lumbar), glow: merged(glow),
    dark: merged(dark), pad: merged(pad), rubber: merged(rubber), hub: merged(hub), metal: merged(metal), casters,
  }
}
