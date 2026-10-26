/**
 * Pure geometry helpers for the generated desk (public/models/desk-generated.glb).
 *
 * Nothing here imports three.js: every function works on flat [x, y, z, ...] position arrays and triangle index lists,
 * so the maths can be run and checked in plain Node. Desk.tsx wraps the results in BufferGeometry objects.
 *
 * The generated mesh is one closed, welded surface with no normals, UVs or materials, normalised to roughly 2 units wide.
 * Rather than hard-coding its numbers, `measureDesk` finds the tabletop plane, the slab underside and the slab footprint from
 * the triangles themselves, so a regenerated model of the same kind (slab on a body) still fits.
 */

export interface Pt { x: number; z: number }
export interface PathPt extends Pt { nx: number; nz: number }

export interface DeskMeasure {
  minY: number
  maxY: number
  /** Height of the flat upper surface of the tabletop. */
  topY: number
  /** Height of the flat underside of the slab (where the slab overhangs the body). */
  underY: number
  /** Plan-view bounds of the slab, bevels included. */
  slab: { minX: number; maxX: number; minZ: number; maxZ: number }
}

export interface DeskFit {
  sx: number; sy: number; sz: number
  /** Model-space values that map to the target origin. */
  cx: number; minY: number; backZ: number
  /** Target-space values. */
  floorGap: number; targetBackZ: number
}

export interface FitTarget {
  /** Slab width (x) and total depth (z), in metres. */
  width: number
  depth: number
  /** World height of the tabletop's upper surface, and of the body's lowest point. */
  top: number
  floorGap: number
  /** Desk-local z of the slab's back edge. The slab then grows toward +z. */
  backZ: number
}

/** [nx, ny, nz, area, centroidY] of one triangle, written into `out`. Degenerate triangles get area 0. */
function faceInfo(pos: ArrayLike<number>, index: ArrayLike<number>, t: number, out: Float64Array): void {
  const a = index[t * 3] * 3
  const b = index[t * 3 + 1] * 3
  const c = index[t * 3 + 2] * 3
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const len = Math.hypot(nx, ny, nz)
  out[0] = len > 0 ? nx / len : 0
  out[1] = len > 0 ? ny / len : 0
  out[2] = len > 0 ? nz / len : 0
  out[3] = len / 2
  out[4] = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3
}

function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) throw new Error('desk model: no triangles found for a reference surface')
  const order = values.map((_, i) => i).sort((p, q) => values[p] - values[q])
  let total = 0
  for (const w of weights) total += w
  let acc = 0
  for (const i of order) {
    acc += weights[i]
    if (acc >= total / 2) return values[i]
  }
  return values[order[order.length - 1]]
}

/** Finds the tabletop plane, the slab underside and the slab footprint in model space. */
export function measureDesk(pos: ArrayLike<number>, index: ArrayLike<number>): DeskMeasure {
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 1; i < pos.length; i += 3) {
    if (pos[i] < minY) minY = pos[i]
    if (pos[i] > maxY) maxY = pos[i]
  }
  const info = new Float64Array(5)
  const tris = index.length / 3

  const upY: number[] = []
  const upA: number[] = []
  for (let t = 0; t < tris; t++) {
    faceInfo(pos, index, t, info)
    if (info[3] > 0 && info[1] > 0.99) { upY.push(info[4]); upA.push(info[3]) }
  }
  const topY = weightedMedian(upY, upA)

  // Downward-facing flat surfaces in the upper half: the slab underside (the body's own bottom is in the lower half).
  const midY = (minY + topY) / 2
  const dnY: number[] = []
  const dnA: number[] = []
  for (let t = 0; t < tris; t++) {
    faceInfo(pos, index, t, info)
    if (info[3] > 0 && info[1] < -0.99 && info[4] > midY) { dnY.push(info[4]); dnA.push(info[3]) }
  }
  const underY = weightedMedian(dnY, dnA)

  const tol = (maxY - minY) * 0.003
  const slab = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
  for (let i = 0; i < pos.length; i += 3) {
    if (pos[i + 1] <= underY + tol) continue
    if (pos[i] < slab.minX) slab.minX = pos[i]
    if (pos[i] > slab.maxX) slab.maxX = pos[i]
    if (pos[i + 2] < slab.minZ) slab.minZ = pos[i + 2]
    if (pos[i + 2] > slab.maxZ) slab.maxZ = pos[i + 2]
  }
  return { minY, maxY, topY, underY, slab }
}

/**
 * Per-axis scale and offset that put the model's slab footprint on the target footprint, its tabletop plane on `top`, and its
 * lowest point on `floorGap`. Scaling is non-uniform on purpose: the generated slab (about 2.09 : 1) is fitted to the existing
 * desk footprint so the camera framing, props, rug and robot stay where they were.
 */
export function fitDesk(m: DeskMeasure, target: FitTarget): DeskFit {
  return {
    sx: target.width / (m.slab.maxX - m.slab.minX),
    sy: (target.top - target.floorGap) / (m.topY - m.minY),
    sz: target.depth / (m.slab.maxZ - m.slab.minZ),
    cx: (m.slab.minX + m.slab.maxX) / 2,
    minY: m.minY,
    backZ: m.slab.minZ,
    floorGap: target.floorGap,
    targetBackZ: target.backZ,
  }
}

export const fitY = (f: DeskFit, y: number): number => f.floorGap + (y - f.minY) * f.sy

/** Returns a new flat position array with the fit applied. */
export function applyFit(pos: ArrayLike<number>, f: DeskFit): Float32Array {
  const out = new Float32Array(pos.length)
  for (let i = 0; i < pos.length; i += 3) {
    out[i] = (pos[i] - f.cx) * f.sx
    out[i + 1] = fitY(f, pos[i + 1])
    out[i + 2] = f.targetBackZ + (pos[i + 2] - f.backZ) * f.sz
  }
  return out
}

/**
 * Reorders triangles so that the upward-facing ones (the tabletop and its upper bevel) come first. Returns the new index list
 * and how many triangles are in the first group, so the mesh can use one material on the top and another on everything else.
 */
export function partitionTopFaces(pos: ArrayLike<number>, index: ArrayLike<number>, minNy = 0.6): { index: Uint32Array; topCount: number } {
  const tris = index.length / 3
  const info = new Float64Array(5)
  const isTop = new Uint8Array(tris)
  let topCount = 0
  for (let t = 0; t < tris; t++) {
    faceInfo(pos, index, t, info)
    if (info[1] > minNy) { isTop[t] = 1; topCount++ }
  }
  const out = new Uint32Array(index.length)
  let a = 0
  let b = topCount * 3
  for (let t = 0; t < tris; t++) {
    const dst = isTop[t] ? a : b
    out[dst] = index[t * 3]
    out[dst + 1] = index[t * 3 + 1]
    out[dst + 2] = index[t * 3 + 2]
    if (isTop[t]) a += 3
    else b += 3
  }
  return { index: out, topCount }
}

/** Planar (top-down) UVs, one repeat per `metres`. Only meaningful on the upward-facing faces. */
export function planarUV(pos: ArrayLike<number>, metres: number): Float32Array {
  const uv = new Float32Array((pos.length / 3) * 2)
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    uv[j] = pos[i] / metres
    uv[j + 1] = pos[i + 2] / metres
  }
  return uv
}

/**
 * Cuts the closed mesh with the horizontal plane at height `y` and returns the longest closed outline, counter-clockwise in the
 * (x, z) plane (so the outward normal of a step (dx, dz) is (dz, -dx)). Crossing points are keyed by the mesh edge they lie on,
 * so adjacent triangles share them exactly and the loop closes without any distance tolerance.
 */
export function sliceLoop(pos: ArrayLike<number>, index: ArrayLike<number>, y: number): Pt[] | null {
  const nVert = pos.length / 3
  const points = new Map<number, Pt>()
  const adjacent = new Map<number, number[]>()

  const crossing = (a: number, b: number): number => {
    const key = a < b ? a * nVert + b : b * nVert + a
    if (!points.has(key)) {
      const ya = pos[a * 3 + 1]
      const yb = pos[b * 3 + 1]
      const t = (y - ya) / (yb - ya)
      points.set(key, {
        x: pos[a * 3] + (pos[b * 3] - pos[a * 3]) * t,
        z: pos[a * 3 + 2] + (pos[b * 3 + 2] - pos[a * 3 + 2]) * t,
      })
    }
    return key
  }
  const link = (p: number, q: number) => {
    const lp = adjacent.get(p)
    if (lp) lp.push(q)
    else adjacent.set(p, [q])
    const lq = adjacent.get(q)
    if (lq) lq.push(p)
    else adjacent.set(q, [p])
  }

  const tris = index.length / 3
  for (let t = 0; t < tris; t++) {
    const v = [index[t * 3], index[t * 3 + 1], index[t * 3 + 2]]
    const above = v.map((i) => pos[i * 3 + 1] > y)
    const count = (above[0] ? 1 : 0) + (above[1] ? 1 : 0) + (above[2] ? 1 : 0)
    if (count === 0 || count === 3) continue
    // The lone vertex is the one on its own side of the plane; the segment joins the two edges that leave it.
    const lone = count === 1 ? above.indexOf(true) : above.indexOf(false)
    const o1 = v[(lone + 1) % 3]
    const o2 = v[(lone + 2) % 3]
    link(crossing(v[lone], o1), crossing(v[lone], o2))
  }

  const visited = new Set<number>()
  let best: Pt[] | null = null
  for (const start of adjacent.keys()) {
    if (visited.has(start)) continue
    const loop: Pt[] = []
    let prev = -1
    let cur = start
    for (;;) {
      visited.add(cur)
      loop.push(points.get(cur) as Pt)
      let next = -1
      for (const n of adjacent.get(cur) as number[]) {
        if (n !== prev && !visited.has(n)) { next = n; break }
      }
      if (next === -1) break
      prev = cur
      cur = next
    }
    if (!best || loop.length > best.length) best = loop
  }
  if (!best || best.length < 8) return null

  let area = 0
  for (let i = 0; i < best.length; i++) {
    const p = best[i]
    const q = best[(i + 1) % best.length]
    area += p.x * q.z - q.x * p.z
  }
  return area < 0 ? best.slice().reverse() : best
}

/** Evenly spaced points (about `step` apart) around a closed polyline. */
function resampleClosed(loop: Pt[], step: number): Pt[] {
  const n = loop.length
  const cum = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) {
    const p = loop[i]
    const q = loop[(i + 1) % n]
    cum[i + 1] = cum[i] + Math.hypot(q.x - p.x, q.z - p.z)
  }
  const total = cum[n]
  const count = Math.max(16, Math.round(total / step))
  const out: Pt[] = []
  let seg = 0
  for (let k = 0; k < count; k++) {
    const s = (k / count) * total
    while (seg < n - 1 && cum[seg + 1] < s) seg++
    const p = loop[seg]
    const q = loop[(seg + 1) % n]
    const len = cum[seg + 1] - cum[seg]
    const t = len > 0 ? (s - cum[seg]) / len : 0
    out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t })
  }
  return out
}

/**
 * Turns the slab outline into the path of the LED strip: the front edge and both sides, from where each side stops being
 * straight at the back (the start of the back corners) round the front corners. The back edge is not lit. Points carry the
 * outward normal, taken from neighbouring points on the full closed outline so the ends are not one-sided.
 */
export function planStrip(loop: Pt[], step = 0.004): PathPt[] {
  const pts = resampleClosed(loop, step)
  const n = pts.length
  const full: PathPt[] = pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n]
    const b = pts[(i + 1) % n]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz) || 1
    return { x: p.x, z: p.z, nx: dz / len, nz: -dx / len }
  })

  // The back tangent point of each straight side: the lowest z among points still on the extreme x.
  let minX = Infinity, maxX = -Infinity
  for (const p of full) { if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x }
  const flat = 0.0005
  let zLeft = Infinity, zRight = Infinity
  for (const p of full) {
    if (p.x < minX + flat && p.z < zLeft) zLeft = p.z
    if (p.x > maxX - flat && p.z < zRight) zRight = p.z
  }
  const zCut = Math.max(zLeft, zRight)

  let start = -1
  for (let i = 0; i < n; i++) {
    if (full[i].z >= zCut && full[(i - 1 + n) % n].z < zCut) { start = i; break }
  }
  if (start === -1) return full
  const out: PathPt[] = []
  for (let k = 0; k < n; k++) {
    const p = full[(start + k) % n]
    if (p.z < zCut) break
    out.push(p)
  }
  return out
}

export interface ProfilePoint {
  /** Offset along the outward normal from the outline (m). */
  d: number
  /** Height above the strip's centre line (m). */
  dy: number
  /** Brightness 0..1, written to the vertex colour. */
  k: number
}

export interface Swept { positions: Float32Array; colors: Float32Array; indices: Uint32Array }

/**
 * Sweeps a 2D profile along the path. With `cap`, the first and last cross-sections are closed with a fan so a solid profile
 * has flat ends. Quads are emitted between consecutive profile points only; a profile that should be closed on its inner side
 * (against the desk) simply leaves that side out, because it can never be seen.
 */
export function sweepProfile(path: PathPt[], y: number, profile: ProfilePoint[], cap: boolean): Swept {
  const m = path.length
  const p = profile.length
  const positions = new Float32Array(m * p * 3)
  const colors = new Float32Array(m * p * 3)
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < p; j++) {
      const o = (i * p + j) * 3
      const pr = profile[j]
      positions[o] = path[i].x + path[i].nx * pr.d
      positions[o + 1] = y + pr.dy
      positions[o + 2] = path[i].z + path[i].nz * pr.d
      colors[o] = colors[o + 1] = colors[o + 2] = pr.k
    }
  }
  const quads = (m - 1) * (p - 1)
  const capTris = cap ? 2 * (p - 2) : 0
  const indices = new Uint32Array((quads * 2 + capTris) * 3)
  let w = 0
  for (let i = 0; i < m - 1; i++) {
    for (let j = 0; j < p - 1; j++) {
      const a = i * p + j
      const b = (i + 1) * p + j
      indices[w++] = a; indices[w++] = b; indices[w++] = b + 1
      indices[w++] = a; indices[w++] = b + 1; indices[w++] = a + 1
    }
  }
  if (cap) {
    for (const base of [0, (m - 1) * p]) {
      for (let j = 1; j < p - 1; j++) {
        indices[w++] = base; indices[w++] = base + j; indices[w++] = base + j + 1
      }
    }
  }
  return { positions, colors, indices }
}
