import { BufferAttribute, BufferGeometry } from 'three'

export interface RugShape {
  /** Footprint (m) along x and z. */
  width: number
  depth: number
  /** Height of the flat top above the floor (m). The chair casters rest on this, so it must stay 12 mm. */
  height: number
  /** Plan-view corner radius (m): a slightly softened rectangle, not a circle. */
  corner: number
  /** How far in from the outline the flat top begins (m): the width of the pillowed edge. */
  edgeSpan: number
  /** How far the pillowed edge rolls down from the top before the short vertical side starts (m). */
  edgeDrop: number
}

const ARC_SEG = 8
const PROFILE_SEG = 8

/**
 * Border layout, in metres measured inward from the rug's outline (shared with the albedo generator so the painted band and line
 * line up exactly with the geometry): a near-black perimeter band, then a thin bronze line, then the field.
 * `inner` is where the flat-woven border material ends and the looped-pile field material begins; it is the line's far edge.
 */
export const RUG_BORDER = { band: 0.185, line: 0.018, inner: 0.203 } as const

/** Material slots of the slab: 0 = flat-woven border (rim, perimeter band, bronze line), 1 = looped-pile field. */
export const RUG_MATERIAL = { border: 0, field: 1 } as const

/** Points around a rounded rectangle, counter-clockwise in (x, z): per corner, the arc centre and the outward direction. */
function outline(hw: number, hd: number, R: number) {
  const pts: { cx: number; cz: number; dx: number; dz: number }[] = []
  const corners = [[1, 1, 0], [-1, 1, Math.PI / 2], [-1, -1, Math.PI], [1, -1, Math.PI * 1.5]] as const
  for (const [sx, sz, t0] of corners) {
    for (let i = 0; i <= ARC_SEG; i++) {
      const t = t0 + (i / ARC_SEG) * (Math.PI / 2)
      pts.push({ cx: sx * (hw - R), cz: sz * (hd - R), dx: Math.cos(t), dz: Math.sin(t) })
    }
  }
  return pts
}

/**
 * Rug slab: a flat top at `height` split into the border ring and the field, a pillowed edge (a quarter ellipse, `edgeSpan` wide and `edgeDrop` deep, so the rim rolls over
 * like a thick pile rather than ending in a hard bevel) and a short vertical side down to the floor. There is no underside: it is never
 * seen and the floor is right there.
 *
 * UVs are planar over the footprint (u = x / width, v = -z / depth, both centred) so one albedo map covers the whole rug and the
 * tiled detail maps keep a constant metric scale. On the rolled edge the planar UV is "unfolded" outward by the profile's arc length,
 * so the texture continues over the rim instead of being smeared down the side, and the tangent frame stays well-defined for normal mapping.
 */
export function buildRugGeometry(s: RugShape): BufferGeometry {
  const hw = s.width / 2, hd = s.depth / 2
  const R = s.corner, a = s.edgeSpan, b = s.edgeDrop, H = s.height
  const loop = outline(hw, hd, R)
  const M = loop.length

  // Cross-section, from the flat top outward and down. d = inset from the outline, h = height, n = outward normal (horizontal, vertical).
  const prof: { d: number; h: number; no: number; nu: number; s: number }[] = []
  for (let k = 0; k <= PROFILE_SEG; k++) {
    const phi = (k / PROFILE_SEG) * (Math.PI / 2)
    const d = a * (1 - Math.sin(phi)), h = H - b + b * Math.cos(phi)
    const gx = Math.sin(phi) / a, gy = Math.cos(phi) / b
    const len = Math.hypot(gx, gy)
    prof.push({ d, h, no: gx / len, nu: gy / len, s: 0 })
  }
  prof.push({ d: 0, h: 0, no: 1, nu: 0, s: 0 })
  for (let k = 1; k < prof.length; k++) prof[k].s = prof[k - 1].s + Math.hypot(prof[k].d - prof[k - 1].d, prof[k].h - prof[k - 1].h)

  const P = prof.length
  const vertCount = P * M + 1
  const pos = new Float32Array(vertCount * 3)
  const nor = new Float32Array(vertCount * 3)
  const uv = new Float32Array(vertCount * 2)
  for (let k = 0; k < P; k++) {
    const p = prof[k]
    for (let j = 0; j < M; j++) {
      const o = loop[j]
      const vi = k * M + j
      pos.set([o.cx + o.dx * (R - p.d), p.h, o.cz + o.dz * (R - p.d)], vi * 3)
      nor.set([o.dx * p.no, p.nu, o.dz * p.no], vi * 3)
      const ux = o.cx + o.dx * (R - a + p.s), uz = o.cz + o.dz * (R - a + p.s)
      uv.set([ux / s.width + 0.5, 0.5 - uz / s.depth], vi * 2)
    }
  }
  const centre = P * M
  pos.set([0, H, 0], centre * 3)
  nor.set([0, 1, 0], centre * 3)
  uv.set([0.5, 0.5], centre * 2)

  // Inner loop: where the border ends and the field starts. Same vertex count as the rim loops, with a tiny corner radius (a clean, square-ish inset).
  const D = RUG_BORDER.inner, r2 = 0.01
  const innerLoop = outline(hw - D, hd - D, r2)
  const innerBase = centre + 1
  const pos2 = new Float32Array((vertCount + M) * 3), nor2 = new Float32Array((vertCount + M) * 3), uv2 = new Float32Array((vertCount + M) * 2)
  pos2.set(pos); nor2.set(nor); uv2.set(uv)
  for (let j = 0; j < M; j++) {
    const o = innerLoop[j]
    const x = o.cx + o.dx * r2, z = o.cz + o.dz * r2
    pos2.set([x, H, z], (innerBase + j) * 3)
    nor2.set([0, 1, 0], (innerBase + j) * 3)
    uv2.set([x / s.width + 0.5, 0.5 - z / s.depth], (innerBase + j) * 2)
  }

  const idx: number[] = []
  for (let k = 0; k < P - 1; k++) {
    for (let j = 0; j < M; j++) {
      const j1 = (j + 1) % M
      const A = k * M + j, B = k * M + j1, C = (k + 1) * M + j, D2 = (k + 1) * M + j1
      idx.push(A, B, C, B, D2, C)
    }
  }
  // Flat border ring between the inner loop (inside) and the first rim row (outside), same winding as the rim quads.
  for (let j = 0; j < M; j++) {
    const j1 = (j + 1) % M
    const A = innerBase + j, B = innerBase + j1, C = j, D2 = j1
    idx.push(A, B, C, B, D2, C)
  }
  const borderCount = idx.length
  for (let j = 0; j < M; j++) idx.push(centre, innerBase + ((j + 1) % M), innerBase + j) // the field, fanned from the centre (convex, so this is exact)

  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos2, 3))
  g.setAttribute('normal', new BufferAttribute(nor2, 3))
  g.setAttribute('uv', new BufferAttribute(uv2, 2))
  g.setIndex(idx)
  g.addGroup(0, borderCount, RUG_MATERIAL.border)
  g.addGroup(borderCount, idx.length - borderCount, RUG_MATERIAL.field)
  g.computeBoundingSphere()
  return g
}

/**
 * Soft contact shadow on the floor around the rug: a ring that starts under the rug's rim and fades out over `reach` metres,
 * drawn with per-vertex alpha (no texture). Lying on the floor at a hair above y = 0, it is drawn after the opaque floor and does not write depth.
 */
export function buildRugShadowGeometry(s: RugShape, reach = 0.12, peak = 0.32): BufferGeometry {
  const hw = s.width / 2, hd = s.depth / 2
  const R = s.corner
  const loop = outline(hw, hd, R)
  const M = loop.length
  // Offsets outward from the outline (m). The first, negative one tucks under the rug so there is never a gap.
  const offs = [-0.02, 0, 0.008, 0.02, 0.035, 0.055, 0.08, reach]
  const alpha = (o: number) => (o <= 0 ? peak : peak * Math.pow(1 - o / reach, 2.4))
  const P = offs.length
  const pos = new Float32Array(P * M * 3)
  const col = new Float32Array(P * M * 4)
  for (let k = 0; k < P; k++) {
    for (let j = 0; j < M; j++) {
      const o = loop[j]
      const r = R + offs[k]
      const vi = k * M + j
      pos.set([o.cx + o.dx * r, 0, o.cz + o.dz * r], vi * 3)
      col.set([0, 0, 0, alpha(offs[k])], vi * 4)
    }
  }
  const idx: number[] = []
  for (let k = 0; k < P - 1; k++) {
    for (let j = 0; j < M; j++) {
      const j1 = (j + 1) % M
      const A = k * M + j, B = k * M + j1, C = (k + 1) * M + j, D = (k + 1) * M + j1
      idx.push(A, B, C, B, D, C)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(pos, 3))
  g.setAttribute('color', new BufferAttribute(col, 4))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}
