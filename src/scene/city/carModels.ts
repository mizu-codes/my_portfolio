import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, Matrix4 } from 'three'
import { boxAt, mergeAll, paint, type Col } from './cityGeometry'

/**
 * Procedural, low-poly but properly shaped cars. A body is lofted through a handful of cross-sections along its length
 * (nose, bonnet, windscreen base, roof, rear window base, boot, tail), so it has a sloped bonnet and windscreen, a narrower
 * glasshouse with tumblehome, and rounded shoulders, instead of stacked boxes. Glass, paint, tyres, rims, light units and mirrors
 * are separate colour slots (see solidMaterial.ts: flag 3 = metallic paint, flag 4 = glass, flag 2 = emissive lights).
 * One geometry per body style is shared by every instance of that style.
 */

const TINT_PAINT = 3, GLASS = 4, EMIT = 2, FIXED = 0
const paintCol: Col = [1, 1, 1, TINT_PAINT]
const glassCol: Col = [0.02, 0.03, 0.055, GLASS]
const tyreCol: Col = [0.02, 0.02, 0.024, FIXED]
const rimCol: Col = [0.55, 0.57, 0.63, FIXED]
const headCol: Col = [1.0, 0.95, 0.84, EMIT]
const tailCol: Col = [0.9, 0.05, 0.04, EMIT]
const tailBar: Col = [0.5, 0.03, 0.03, EMIT]
const trimCol: Col = [0.03, 0.03, 0.04, FIXED]

/** x along the car (+x = front), half-widths of body shoulder (wb) and glasshouse/deck top (wr), heights of sill, shoulder, belt and roof. */
interface Section { x: number; wb: number; wr: number; yb: number; ym: number; belt: number; roof: number }
type Pair = 'deck' | 'wind' | 'cabin' | 'rear' | 'cargo'

const S = (x: number, wb: number, wr: number, yb: number, ym: number, belt: number, roof: number): Section => ({ x, wb, wr, yb, ym, belt, roof })

/** One cross-section ring, left to right (z): sill, shoulder, belt, roof edge. */
function ring(s: Section): [number, number][] {
  return [
    [s.yb, -s.wb * 0.86], [s.ym, -s.wb], [s.belt, -s.wb * 0.97], [s.roof, -s.wr],
    [s.roof, s.wr], [s.belt, s.wb * 0.97], [s.ym, s.wb], [s.yb, s.wb * 0.86],
  ]
}

function loft(sections: Section[], pairs: Pair[]): BufferGeometry {
  const rings = sections.map((s) => ring(s).map(([y, z]) => [s.x, y, z] as [number, number, number]))
  const nS = sections.length, nR = 8
  // smooth per-vertex normals from the surrounding quads
  const nrm: number[][][] = rings.map((r) => r.map(() => [0, 0, 0]))
  const faceN = (a: number[], b: number[], c: number[]) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  }
  const quads: { j: number; k: number }[] = []
  for (let j = 0; j < nS - 1; j++) for (let k = 0; k < nR - 1; k++) quads.push({ j, k })
  const quadVerts = ({ j, k }: { j: number; k: number }) => [rings[j][k], rings[j + 1][k], rings[j + 1][k + 1], rings[j][k + 1]]
  const orient = (n: number[], p: number[][]) => { // make the quad normal point away from the car's centre line
    const cz = (p[0][2] + p[1][2] + p[2][2] + p[3][2]) / 4, cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4 - 0.7
    return n[2] * cz + n[1] * cy < 0 ? [-n[0], -n[1], -n[2]] : n
  }
  quads.forEach((q) => {
    const p = quadVerts(q)
    const n = orient(faceN(p[0], p[1], p[2]), p)
    const idx: [number, number][] = [[q.j, q.k], [q.j + 1, q.k], [q.j + 1, q.k + 1], [q.j, q.k + 1]]
    idx.forEach(([a, b]) => { nrm[a][b][0] += n[0]; nrm[a][b][1] += n[1]; nrm[a][b][2] += n[2] })
  })
  const norm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l] }

  const pos: number[] = [], nor: number[] = [], col: number[] = []
  const push = (j: number, k: number, c: Col) => {
    const p = rings[j][k], n = norm(nrm[j][k])
    pos.push(p[0], p[1], p[2]); nor.push(n[0], n[1], n[2]); col.push(c[0], c[1], c[2], c[3])
  }
  quads.forEach(({ j, k }) => {
    const type = pairs[j]
    let c: Col = paintCol
    const glassy = type === 'wind' || type === 'cabin' || type === 'rear'
    if ((k === 2 || k === 4) && glassy) c = glassCol
    if (k === 3 && (type === 'wind' || type === 'rear')) c = glassCol
    // winding chosen so faces point outwards; ring order runs +z to -z over the roof, so flip by side
    const a: [number, number] = [j, k], b: [number, number] = [j + 1, k], d: [number, number] = [j + 1, k + 1], e: [number, number] = [j, k + 1]
    const p = quadVerts({ j, k })
    const n = orient(faceN(p[0], p[1], p[2]), p)
    const raw = faceN(p[0], p[1], p[2])
    const flip = raw[0] * n[0] + raw[1] * n[1] + raw[2] * n[2] < 0
    const order = flip ? [a, e, d, a, d, b] : [a, b, d, a, d, e]
    order.forEach(([jj, kk]) => push(jj, kk, c))
  })
  // end caps (nose and tail): a fan around the ring centre, flat normals pointing out along ±x
  const cap = (j: number, dir: number, c: Col) => {
    const r = rings[j]
    const cx = r.reduce((a, p) => a + p[0], 0) / nR, cy = r.reduce((a, p) => a + p[1], 0) / nR, cz = 0
    for (let k = 0; k < nR; k++) {
      const p0 = r[k], p1 = r[(k + 1) % nR]
      const tri = dir > 0 ? [[cx, cy, cz], p0, p1] : [[cx, cy, cz], p1, p0]
      tri.forEach((p) => { pos.push(p[0], p[1], p[2]); nor.push(dir, 0, 0); col.push(c[0], c[1], c[2], c[3]) })
    }
  }
  cap(0, 1, paintCol)
  cap(nS - 1, -1, paintCol)

  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('aCol', new Float32BufferAttribute(col, 4))
  return g
}

/** Wheel with tyre and rim, axis along z. */
function wheel(x: number, y: number, z: number, r: number, w: number): BufferGeometry[] {
  const tyre = new CylinderGeometry(r, r, w, 14).applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2))
  const rim = new CylinderGeometry(r * 0.64, r * 0.64, w * 1.04, 12).applyMatrix4(new Matrix4().makeRotationX(Math.PI / 2))
  const t = new Matrix4().makeTranslation(x, y, z)
  return [paint(tyre, tyreCol, t), paint(rim, rimCol, t)]
}

interface Spec {
  sections: Section[]
  pairs: Pair[]
  wheelX: [number, number]; wheelR: number; wheelW: number
  head: { x: number; y: number; z: number; h: number }
  tail: { x: number; y: number; z: number; h: number }
  mirror: { x: number; y: number }
}

function build(spec: Spec): BufferGeometry {
  const body = loft(spec.sections, spec.pairs)
  const first = spec.sections[0], last = spec.sections[spec.sections.length - 1]
  const wb = spec.sections[Math.floor(spec.sections.length / 2)].wb
  const parts: BufferGeometry[] = [body]
  for (const x of spec.wheelX) for (const sd of [1, -1]) parts.push(...wheel(x, spec.wheelR, sd * (wb - spec.wheelW * 0.5 - 0.02), spec.wheelR, spec.wheelW))
  const { head, tail, mirror } = spec
  for (const sd of [1, -1]) {
    parts.push(boxAt(0.07, head.h, 0.34, head.x, head.y, sd * head.z, headCol))      // light units, set into the nose
    parts.push(boxAt(0.07, tail.h, 0.3, tail.x, tail.y, sd * tail.z, tailCol))
    parts.push(boxAt(0.2, 0.09, 0.14, mirror.x, mirror.y, sd * (spec.sections[3].wb + 0.07), paintCol)) // door mirrors
  }
  parts.push(boxAt(0.06, tail.h * 0.4, tail.z * 1.5, tail.x, tail.y + 0.01, 0, tailBar))   // light bar between the tail lamps
  parts.push(boxAt(0.05, 0.1, head.z * 1.2, first.x - 0.01, first.ym - 0.08, 0, trimCol))   // grille / intake
  parts.push(boxAt(0.05, 0.08, tail.z * 1.1, last.x + 0.01, last.ym - 0.1, 0, trimCol))     // rear valance
  return mergeAll(parts)
}

export function sedanModel() {
  return build({
    sections: [
      S(2.30, 0.80, 0.68, 0.30, 0.50, 0.58, 0.62), S(2.18, 0.86, 0.76, 0.26, 0.52, 0.72, 0.76), S(1.35, 0.90, 0.80, 0.26, 0.55, 0.82, 0.86),
      S(0.55, 0.91, 0.78, 0.26, 0.56, 0.86, 0.89), S(-0.35, 0.91, 0.68, 0.26, 0.56, 0.88, 1.38), S(-1.05, 0.91, 0.68, 0.26, 0.56, 0.88, 1.37),
      S(-1.85, 0.90, 0.76, 0.26, 0.56, 0.90, 0.95), S(-2.18, 0.87, 0.74, 0.26, 0.54, 0.90, 0.93), S(-2.30, 0.80, 0.66, 0.30, 0.50, 0.82, 0.86),
    ],
    pairs: ['deck', 'deck', 'deck', 'wind', 'cabin', 'rear', 'deck', 'deck'],
    wheelX: [1.4, -1.38], wheelR: 0.33, wheelW: 0.22,
    head: { x: 2.2, y: 0.7, z: 0.6, h: 0.1 }, tail: { x: -2.24, y: 0.78, z: 0.62, h: 0.1 }, mirror: { x: 0.45, y: 0.92 },
  })
}

export function suvModel() {
  return build({
    sections: [
      S(2.38, 0.84, 0.72, 0.34, 0.62, 0.76, 0.80), S(2.26, 0.92, 0.82, 0.30, 0.66, 0.90, 0.94), S(1.45, 0.95, 0.84, 0.30, 0.70, 1.00, 1.04),
      S(0.65, 0.96, 0.82, 0.30, 0.72, 1.04, 1.07), S(0.05, 0.96, 0.76, 0.30, 0.72, 1.06, 1.64), S(-1.9, 0.96, 0.76, 0.30, 0.72, 1.06, 1.66),
      S(-2.3, 0.94, 0.80, 0.30, 0.72, 1.08, 1.24), S(-2.38, 0.88, 0.76, 0.30, 0.68, 0.98, 1.02),
    ],
    pairs: ['deck', 'deck', 'deck', 'wind', 'cabin', 'rear', 'deck'],
    wheelX: [1.5, -1.45], wheelR: 0.38, wheelW: 0.26,
    head: { x: 2.31, y: 0.88, z: 0.64, h: 0.13 }, tail: { x: -2.36, y: 0.92, z: 0.68, h: 0.15 }, mirror: { x: 0.7, y: 1.08 },
  })
}

export function vanModel() {
  return build({
    sections: [
      S(2.65, 0.85, 0.74, 0.34, 0.68, 0.76, 0.82), S(2.52, 0.95, 0.86, 0.30, 0.72, 0.96, 1.00), S(1.75, 1.00, 0.90, 0.30, 0.75, 1.06, 1.10),
      S(1.12, 1.00, 0.90, 0.30, 0.75, 1.10, 1.95), S(0.72, 1.00, 0.92, 0.30, 0.75, 1.10, 2.06), S(-2.55, 1.00, 0.94, 0.30, 0.75, 1.10, 2.08),
      S(-2.65, 0.97, 0.9, 0.30, 0.72, 1.0, 2.0),
    ],
    pairs: ['deck', 'deck', 'wind', 'cabin', 'cargo', 'cargo'],
    wheelX: [1.7, -1.6], wheelR: 0.36, wheelW: 0.24,
    head: { x: 2.58, y: 0.82, z: 0.68, h: 0.13 }, tail: { x: -2.66, y: 1.0, z: 0.7, h: 0.28 }, mirror: { x: 1.3, y: 1.3 },
  })
}
